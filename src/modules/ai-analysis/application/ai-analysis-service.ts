import { prisma } from "@/lib/db/prisma";
import { type PeriodKey } from "@/modules/statistics/application/overview-service";
import { ProfileBuilder } from "./profile-builder";
import { readBudget } from "./ai-budget";
import { classifyAiError, errorStatus, logAi, rejectedText } from "./ai-log";
import { availableAngles } from "./listening-signals";
import {
  keepScanning,
  oldEnoughToCheck,
  packFingerprint,
  pickSlots,
  REFRESH_PRIORITY,
  refreshDecision,
  type RefreshDecision,
} from "./pack-freshness";
import { sanitizePack } from "./pack-sanitizer";
import { exampleTexts } from "../domain/voice-examples";
import { GeminiAdapter } from "../infrastructure/gemini-adapter";
import { LastFmFactsAdapter } from "../infrastructure/lastfm-facts-adapter";
import {
  readingPackSchema,
  ADDRESS_STYLES,
  type FactsProvider,
  type MusicProfileInput,
  type PackProvider,
  type PackView,
  type ProfileNarrative,
  type ReadingPack,
  type ScreenKey,
} from "../domain/ai-analysis.types";

/**
 * v11: o pacote. Uma chamada por período gera várias leituras, comentários
 * por disco do rack e frases pras outras telas; a interface sorteia a cada
 * visita. Renovação guiada pela impressão digital da escuta (pack-freshness),
 * feita pelo cron depois do sync — a visita só lê o que está pronto.
 * A voz é a v10: dois colegas jovens, tratamento escolhido em Ajustes.
 *
 * v12: o rack passou de 6 para RACK_SIZE discos. A versão sobe porque um
 * pacote da v11 só tem comentário para os 6 primeiros — servido contra o
 * rack novo, deixaria metade das capas muda. Subir invalida o guardado e
 * força uma geração por período, uma vez só.
 */
const PACK_PROMPT_VERSION = "v12-rack";

/** Leituras completas por pacote. */
const READINGS_PER_PACK = 4;

/** Uma geração em andamento há menos que isso bloqueia outra do mesmo período. */
const IN_PROGRESS_WINDOW_MS = 5 * 60 * 1000;

const packKind = (period: PeriodKey) => `PACK:${period}`;

/** Sem IA o app não fica mudo: frases fixas, honestas e sem inventar dado. */
const FALLBACK_SCREEN_LINES: Array<{ screen: ScreenKey; line: string }> = [
  { screen: "evolution", line: "O que entrou e o que saiu de moda no seu fone." },
  { screen: "evolution", line: "Comparação direta entre este período e o anterior." },
  { screen: "discovery", line: "Nomes novos, escolhidos a partir do que você já ouve." },
  { screen: "discovery", line: "Cada sugestão vem com o motivo de estar aqui." },
  { screen: "history", line: "Tudo o que tocou, do mais recente para trás." },
  { screen: "history", line: "Sua escuta em ordem cronológica, dia a dia." },
];

export type RefreshOutcome =
  | { status: "generated"; decision: RefreshDecision; pack: ReadingPack; builtAt: Date }
  | { status: "skipped"; decision: RefreshDecision | "in_progress" }
  | { status: "blocked"; reason: "budget" | "no_key" }
  | { status: "failed" };

interface StoredPack {
  pack: ReadingPack;
  builtAt: Date;
}

export class AIAnalysisService {
  constructor(
    private profileBuilder = new ProfileBuilder(),
    private adapter: PackProvider = new GeminiAdapter(),
    private facts: FactsProvider = new LastFmFactsAdapter(),
  ) {}

  /**
   * O pacote de um período pra tela. Com pacote pronto, responde na hora e,
   * se ele já tem idade pra ser conferido, agenda a renovação em segundo
   * plano (`schedule`, que a rota liga ao `after` do Next). Sem pacote
   * nenhum — só na primeira visita de um período — gera ali mesmo.
   */
  async getPack(
    userId: string,
    period: PeriodKey,
    schedule?: (task: () => Promise<unknown>) => void,
  ): Promise<PackView> {
    const stored = await this.findLatestPack(userId, period);

    if (stored) {
      if (schedule && oldEnoughToCheck(stored.builtAt, period)) {
        schedule(() => this.refreshPack(userId, period));
      }
      return this.toView(stored);
    }

    const outcome = await this.refreshPack(userId, period);
    if (outcome.status === "generated") return this.toView({ pack: outcome.pack, builtAt: outcome.builtAt });
    return this.fallbackView(userId, period);
  }

  /**
   * O cron chama isto depois do sync: confere os períodos na ordem de
   * prioridade e gera no máximo UM pacote por execução — o primeiro que
   * precisar. Falha ou teto encerram a rodada: não adianta insistir agora.
   */
  async refreshStalest(userId: string): Promise<Array<{ period: PeriodKey; outcome: RefreshOutcome["status"]; detail?: string }>> {
    const report: Array<{ period: PeriodKey; outcome: RefreshOutcome["status"]; detail?: string }> = [];

    for (const period of REFRESH_PRIORITY) {
      const outcome = await this.refreshPack(userId, period);
      const detail =
        outcome.status === "generated" || outcome.status === "skipped"
          ? outcome.decision
          : outcome.status === "blocked"
            ? outcome.reason
            : undefined;
      report.push({ period, outcome: outcome.status, detail });
      if (!keepScanning(outcome.status)) break;
    }

    return report;
  }

  /**
   * Gera o pacote do período se ele precisar — sem pacote, velho demais, ou
   * com a escuta mudada depois do tempo mínimo. Tudo o mais é pulado sem
   * gastar cota.
   */
  async refreshPack(userId: string, period: PeriodKey): Promise<RefreshOutcome> {
    const kind = packKind(period);
    if (!process.env.GEMINI_API_KEY) return { status: "blocked", reason: "no_key" };

    const stored = await this.findLatestPack(userId, period);
    if (stored && !oldEnoughToCheck(stored.builtAt, period)) {
      return { status: "skipped", decision: "too_recent" };
    }

    const running = await prisma.aIAnalysisRun.findFirst({
      where: { userId, kind, status: "PENDING", createdAt: { gte: new Date(Date.now() - IN_PROGRESS_WINDOW_MS) } },
      select: { id: true },
    });
    if (running) return { status: "skipped", decision: "in_progress" };

    const profile = await this.profileBuilder.buildProfile(userId, period);
    if (profile.totalPlays === 0) return { status: "skipped", decision: "fresh" };

    const fingerprint = packFingerprint(profile);
    const decision = refreshDecision(
      stored ? { builtAt: stored.builtAt, fingerprint: stored.pack.fingerprint } : null,
      fingerprint,
      period,
    );
    if (decision === "fresh" || decision === "too_recent") {
      logAi("ai.pack_skipped", { kind, decision });
      return { status: "skipped", decision };
    }

    const budget = await readBudget(userId);
    if (!budget.allowed) {
      logAi("ai.budget_blocked", {
        kind,
        blockedBy: budget.blockedBy,
        usedToday: budget.usedToday,
        dailyLimit: budget.dailyLimit,
        usedThisHour: budget.usedThisHour,
        hourlyLimit: budget.hourlyLimit,
      }, "warn");
      return { status: "blocked", reason: "budget" };
    }

    const startedAt = Date.now();
    // a linha nasce PENDENTE antes da chamada: tentativa que falha também gasta
    // cota, e o teto e a trava de "em andamento" precisam enxergar isso
    const run = await prisma.aIAnalysisRun.create({
      data: {
        userId,
        kind,
        provider: "gemini",
        model: process.env.AI_MODEL || "gemini-3.5-flash",
        promptVersion: PACK_PROMPT_VERSION,
        inputHash: fingerprint,
        status: "PENDING",
      },
    });

    try {
      const slots = pickSlots(availableAngles(profile), READINGS_PER_PACK);
      const { output, model } = await this.adapter.generatePack(await this.enrich(profile, userId), slots);
      const sanitized = sanitizePack(output, slots, exampleTexts());

      if (sanitized.readings.length === 0) {
        throw rejectedText("invalid_output", `Nenhuma leitura do pacote sobrou (${sanitized.dropped.readings} descartadas)`);
      }

      const pack: ReadingPack = {
        readings: sanitized.readings,
        albumLines: sanitized.albumLines,
        screenLines: sanitized.screenLines,
        fingerprint,
        model,
      };

      const saved = await prisma.aIAnalysisRun.update({
        where: { id: run.id },
        // o modelo que respondeu de fato: com a cota do principal esgotada, é o reserva
        data: { status: "COMPLETED", model, validatedOutput: pack as any },
        select: { createdAt: true },
      });

      logAi("ai.call_ok", {
        kind,
        model,
        decision,
        readings: pack.readings.length,
        albumLines: pack.albumLines.length,
        screenLines: pack.screenLines.length,
        dropped: sanitized.dropped,
        ms: Date.now() - startedAt,
        promptVersion: PACK_PROMPT_VERSION,
      });

      return { status: "generated", decision, pack, builtAt: saved.createdAt };
    } catch (error) {
      const reason = classifyAiError(error);
      const message = error instanceof Error ? error.message : String(error);
      logAi("ai.call_failed", {
        kind,
        reason,
        status: errorStatus(error),
        ms: Date.now() - startedAt,
        message: message.slice(0, 200),
      }, "error");
      await prisma.aIAnalysisRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errorMessage: `[${reason}] ${message}`.slice(0, 500) },
      }).catch((auditError) => logAi("ai.audit_failed", { kind, message: String(auditError).slice(0, 200) }, "error"));
      return { status: "failed" };
    }
  }

  /**
   * As frases de uma tela, de TODOS os pacotes prontos — assim a legenda não
   * fica presa ao mês: uma visita cita a semana, outra o ano. A Evolução,
   * que tem período escolhido, passa o período e recebe só dele.
   */
  async getScreenLines(userId: string, screen?: ScreenKey, period?: PeriodKey) {
    const periods = period ? [period] : REFRESH_PRIORITY;
    const packs = await Promise.all(periods.map((each) => this.findLatestPack(userId, each)));
    const lines = packs
      .flatMap((stored) => stored?.pack.screenLines ?? [])
      .filter((entry) => !screen || entry.screen === screen);

    if (lines.length > 0) return { lines, source: "ai" as const };
    return {
      lines: FALLBACK_SCREEN_LINES.filter((entry) => !screen || entry.screen === screen),
      source: "fallback" as const,
    };
  }

  /**
   * O que só interessa na hora de chamar o modelo: os fatos do Last.fm e o
   * jeito como a pessoa quer ser tratada.
   */
  private async enrich(profile: MusicProfileInput, userId: string): Promise<MusicProfileInput> {
    const [facts, user] = await Promise.all([
      this.facts.collectFacts(profile).catch(() => []),
      prisma.user.findUnique({ where: { id: userId }, select: { addressAs: true } }).catch(() => null),
    ]);
    const addressAs = ADDRESS_STYLES.find((style) => style === user?.addressAs) ?? "neutro";
    return { ...profile, ...(facts.length > 0 ? { facts } : {}), listener: { addressAs } };
  }

  private async findLatestPack(userId: string, period: PeriodKey): Promise<StoredPack | null> {
    const run = await prisma.aIAnalysisRun.findFirst({
      where: { userId, kind: packKind(period), promptVersion: PACK_PROMPT_VERSION, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { validatedOutput: true, createdAt: true },
    });
    if (!run?.validatedOutput) return null;
    const parsed = readingPackSchema.safeParse(run.validatedOutput);
    return parsed.success ? { pack: parsed.data, builtAt: run.createdAt } : null;
  }

  private toView(stored: StoredPack): PackView {
    return {
      readings: stored.pack.readings,
      albumLines: stored.pack.albumLines,
      builtAt: stored.builtAt.toISOString(),
      source: "ai",
    };
  }

  private async fallbackView(userId: string, period: PeriodKey): Promise<PackView> {
    const profile = await this.profileBuilder.buildProfile(userId, period).catch(() => null);
    return { readings: [this.getFallbackNarrative(profile)], albumLines: [], builtAt: null, source: "fallback" };
  }

  /**
   * Sem chave de IA ou com o provedor fora do ar, o texto ainda precisa
   * soar como alguém falando. Continua 100% determinístico: cada frase
   * é escolhida pelos próprios números, nada é inventado.
   */
  private getFallbackNarrative(profile: MusicProfileInput | null): ProfileNarrative {
    const emptyState: ProfileNarrative = {
      eyebrow: "Sem leitura deste período",
      headline: "Silêncio por aqui",
      narrative: "Nada tocou nesse intervalo, ou o histórico ainda não chegou até aqui.",
      insight: "Escolha um intervalo maior para ver o quadro completo.",
      tasteKeywords: [],
      playfulClosing: null,
      tone: "ANALYTICAL",
      referencedEvidence: [],
    };

    if (!profile) return emptyState;

    const mainArtist = profile.topArtists[0]?.name;
    const plays = profile.totalPlays;
    if (!plays || !mainArtist) return { ...emptyState, referencedEvidence: ["totalPlays"] };

    const topGenre = profile.topGenres[0]?.name;
    const artists = profile.uniqueArtists ?? 0;
    const share = Math.round((profile.topArtists[0]?.share ?? 0) * 100);
    // o ProfileBuilder entrega fração (0.17), não porcentagem
    const top5 = Math.round((profile.concentration?.top5ArtistShare ?? 0) * 100);

    const headline =
      share >= 20
        ? `${mainArtist} não deixou espaço para mais ninguém`
        : share >= 10
          ? `${mainArtist} liderou, mas sem folga`
          : `Nenhum nome dominou — ${mainArtist} só ficou na frente`;

    const narrative = topGenre
      ? `${mainArtist} ficou no topo entre ${artists} artistas, puxando ${topGenre} junto.`
      : `${mainArtist} ficou no topo entre ${artists} artistas diferentes.`;

    const insight =
      top5 >= 50
        ? `Metade da sua escuta cabe em cinco nomes — ${top5}%, para ser exato.`
        : `Os cinco primeiros somam ${top5}%: o resto ficou bem espalhado.`;

    return {
      eyebrow: "Destaque do período",
      headline,
      narrative,
      insight,
      tasteKeywords: profile.topGenres.slice(0, 3).map((genre) => genre.name),
      playfulClosing: null,
      tone: "ANALYTICAL",
      referencedEvidence: topGenre
        ? ["totalPlays", "topArtists", "topGenres", "concentration"]
        : ["totalPlays", "topArtists", "concentration"],
    };
  }
}
