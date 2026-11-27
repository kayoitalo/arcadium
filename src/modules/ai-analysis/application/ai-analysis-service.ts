import { prisma } from "@/lib/db/prisma";
import { type PeriodKey } from "@/modules/statistics/application/overview-service";
import { ProfileBuilder } from "./profile-builder";
import { readBudget, reserveAttempt, budgetRefused } from "./ai-budget";
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
  type PackSlot,
  type PackView,
  type ReadingPack,
  type ScreenKey,
} from "../domain/ai-analysis.types";

/**
 * v11: o pacote. Uma chamada por período gera várias leituras, comentários
 * por disco do rack e frases pras outras telas; a interface sorteia a cada
 * visita. Renovação guiada pela impressão digital da escuta (pack-freshness),
 * feita pelo cron depois do sync — a visita só lê o que está pronto.
 *
 * v12: o rack passou de 6 para RACK_SIZE discos. A versão sobe porque um
 * pacote da v11 só tem comentário para os 6 primeiros — servido contra o
 * rack novo, deixaria metade das capas muda. Subir invalida o guardado e
 * força uma geração por período, uma vez só.
 *
 * v13: a voz mudou. Saiu "dois colegas jovens" com lista de gírias; entrou
 * o amigo com opinião, ironia seca e o limite da mordida, mais as regras de
 * gênero e liderança só com a prova. Pacote da v12 fala com a voz antiga
 * por até um mês (o durável), então ele deixa de valer.
 */
const PACK_PROMPT_VERSION = "v13-voz";

/** Leituras completas por pacote. */
const READINGS_PER_PACK = 4;

/** Uma geração em andamento há menos que isso bloqueia outra do mesmo período. */
const IN_PROGRESS_WINDOW_MS = 5 * 60 * 1000;

const packKind = (period: PeriodKey) => `PACK:${period}`;

/**
 * Quanto um lote pode demorar antes de desistirmos dele. A promessa do
 * provedor é 24h, mas costuma voltar em minutos; enquanto o lote espera,
 * o período fica travado, então passou disso ele é cancelado e a rodada
 * seguinte tenta de novo.
 */
const BATCH_PATIENCE_MS = 4 * 60 * 60 * 1000;

/** O que fica guardado na linha enquanto o lote corre. */
interface QueuedBatch { job: string; slots: PackSlot[]; attemptId: string }

/** Há uma geração em andamento: uma chamada recente, ou um lote ainda não recolhido. */
const inProgressWhere = (userId: string, kind: string) => ({
  userId, kind, OR: [{ status: "PENDING", createdAt: { gte: new Date(Date.now() - IN_PROGRESS_WINDOW_MS) } }, { status: "BATCHING" }],
});

export type RefreshReport = Array<{ period: PeriodKey; outcome: RefreshOutcome["status"] | "collected" | "waiting"; detail?: string }>;

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
  | { status: "queued"; decision: RefreshDecision }
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
   * O pacote guardado de um período, sem gerar nada: para quem lê vários
   * períodos de uma vez (a conversa) e não pode esperar uma geração em cada
   * um. `stale` diz se ele já tem idade para ser conferido — quem chamou
   * decide se agenda a renovação.
   */
  async peekPack(userId: string, period: PeriodKey): Promise<{ view: PackView; stale: boolean } | null> {
    const stored = await this.findLatestPack(userId, period);
    if (!stored) return null;
    return { view: this.toView(stored), stale: oldEnoughToCheck(stored.builtAt, period) };
  }

  /**
   * O cron chama isto depois do sync: confere os períodos na ordem de
   * prioridade e gera no máximo UM pacote por execução — o primeiro que
   * precisar. Falha ou teto encerram a rodada: não adianta insistir agora.
   */
  async refreshStalest(userId: string, options: { batch?: boolean } = {}): Promise<RefreshReport> {
    // primeiro recolhe o que o modo em lote já devolveu: é o que libera o período
    const report: RefreshReport = options.batch ? await this.collectBatches(userId) : [];

    for (const period of REFRESH_PRIORITY) {
      const outcome = await this.refreshPack(userId, period, options);
      const detail =
        outcome.status === "generated" || outcome.status === "queued" || outcome.status === "skipped"
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
  async refreshPack(userId: string, period: PeriodKey, options: { batch?: boolean } = {}): Promise<RefreshOutcome> {
    const kind = packKind(period);
    if (!process.env.GEMINI_API_KEY) return { status: "blocked", reason: "no_key" };

    const stored = await this.findLatestPack(userId, period);
    if (stored && !oldEnoughToCheck(stored.builtAt, period)) {
      return { status: "skipped", decision: "too_recent" };
    }

    const running = await prisma.aIAnalysisRun.findFirst({ where: inProgressWhere(userId, kind), select: { id: true } });
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
    const run = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (await tx.aIAnalysisRun.findFirst({ where: inProgressWhere(userId, kind), select: { id: true } })) return null;
      return tx.aIAnalysisRun.create({
      data: {
        userId,
        kind,
        provider: "gemini-pack",
        model: process.env.AI_MODEL || "gemini-3.5-flash",
        promptVersion: PACK_PROMPT_VERSION,
        inputHash: fingerprint,
        status: "PENDING",
      },
      });
    });
    if (!run) return { status: "skipped", decision: "in_progress" };

    try {
      const slots = pickSlots(availableAngles(profile), READINGS_PER_PACK);
      const enriched = await this.enrich(profile, userId);

      if (options.batch && this.adapter.submitPackBatch) {
        // conta sem faturamento não aceita lote (400, FAILED_PRECONDITION): aí a
        // geração segue na hora, como antes. Recusa não custa nada, então a
        // tentativa só é reservada quando o lote entra.
        const queued = await this.adapter.submitPackBatch(enriched, slots).catch((error) => {
          logAi("ai.batch_unavailable", { kind, status: errorStatus(error), message: String(error).slice(0, 160) }, "warn");
          return null;
        });
        if (queued) {
          const attempt = await reserveAttempt(userId, queued.model).catch(async (error) => {
            await this.adapter.cancelPackBatch?.(queued.job).catch(() => undefined);
            throw error;
          });
          const stored: QueuedBatch = { job: queued.job, slots, attemptId: attempt.id };
          await prisma.aIAnalysisRun.update({ where: { id: run.id }, data: { status: "BATCHING", model: queued.model, rawOutput: JSON.stringify(stored) } });
          logAi("ai.batch_queued", { kind, model: queued.model, decision, ms: Date.now() - startedAt });
          return { status: "queued", decision };
        }
      }

      const { output, model } = await this.adapter.generatePack(enriched, slots, {
        before: async (model) => (await reserveAttempt(userId, model)).id,
        after: async (id, result) => { await prisma.aIAnalysisRun.update({ where: { id }, data: { status: result.status, tokenCount: result.tokens ?? null } }); },
      });
      // o modelo que respondeu de fato: com a cota do principal esgotada, é o reserva
      const { pack, builtAt, dropped } = await this.savePack(run.id, output, slots, fingerprint, model);

      logAi("ai.call_ok", {
        kind,
        model,
        decision,
        readings: pack.readings.length,
        albumLines: pack.albumLines.length,
        screenLines: pack.screenLines.length,
        dropped,
        ms: Date.now() - startedAt,
        promptVersion: PACK_PROMPT_VERSION,
      });

      return { status: "generated", decision, pack, builtAt };
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
        data: { status: budgetRefused(error) ? "BLOCKED" : "FAILED", errorMessage: `[${reason}] ${message}`.slice(0, 500) },
      }).catch((auditError) => logAi("ai.audit_failed", { kind, message: String(auditError).slice(0, 200) }, "error"));
      return budgetRefused(error) ? { status: "blocked", reason: "budget" } : { status: "failed" };
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

  /** Valida o JSON cru item a item e guarda o pacote na linha da geração. Sem leitura que preste, é falha. */
  private async savePack(runId: string, output: unknown, slots: PackSlot[], fingerprint: string, model: string) {
    const sanitized = sanitizePack(output, slots, exampleTexts());
    if (sanitized.readings.length === 0) {
      throw rejectedText("invalid_output", `Nenhuma leitura do pacote sobrou (${sanitized.dropped.readings} descartadas)`);
    }
    const pack: ReadingPack = { readings: sanitized.readings, albumLines: sanitized.albumLines, screenLines: sanitized.screenLines, fingerprint, model };
    const saved = await prisma.aIAnalysisRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", model, validatedOutput: pack as any },
      select: { createdAt: true },
    });
    return { pack, builtAt: saved.createdAt, dropped: sanitized.dropped };
  }

  /**
   * Recolhe os lotes que o modo em lote já devolveu. Pronto vira pacote;
   * perdido, ou esperando além da paciência, vira falha — e libera o
   * período pra rodada tentar de novo. O pacote fica datado do envio, que é
   * de quando são os dados que ele leu.
   */
  async collectBatches(userId: string): Promise<RefreshReport> {
    const adapter = this.adapter;
    if (!adapter.readPackBatch) return [];
    const runs = await prisma.aIAnalysisRun.findMany({
      where: { userId, status: "BATCHING", kind: { startsWith: "PACK:" } },
      select: { id: true, kind: true, model: true, inputHash: true, rawOutput: true, createdAt: true },
    });
    const report: RefreshReport = [];
    for (const run of runs) {
      const period = run.kind.slice("PACK:".length) as PeriodKey;
      const fail = async (reason: string, message: string, attemptId?: string) => {
        await prisma.aIAnalysisRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: `[${reason}] ${message}`.slice(0, 500) } });
        if (attemptId) await prisma.aIAnalysisRun.update({ where: { id: attemptId }, data: { status: "FAILED" } }).catch(() => undefined);
        logAi("ai.batch_failed", { kind: run.kind, reason, message: message.slice(0, 200) }, "error");
        report.push({ period, outcome: "failed", detail: reason });
      };
      let queued: QueuedBatch;
      try { queued = JSON.parse(run.rawOutput ?? ""); } catch { await fail("unknown", "Lote sem registro do envio."); continue; }

      try {
        const state = await adapter.readPackBatch(queued.job);
        if (state.state === "running") {
          if (Date.now() - run.createdAt.getTime() < BATCH_PATIENCE_MS) { report.push({ period, outcome: "waiting" }); continue; }
          await adapter.cancelPackBatch?.(queued.job).catch(() => undefined);
          await fail("timeout", "O lote passou da paciência e foi cancelado.", queued.attemptId);
          continue;
        }
        if (state.state === "failed") { await fail(state.invalid ? "invalid_output" : "unknown", state.message, queued.attemptId); continue; }

        await prisma.aIAnalysisRun.update({ where: { id: queued.attemptId }, data: { status: "COMPLETED", tokenCount: state.tokens ?? null } }).catch(() => undefined);
        const { pack, dropped } = await this.savePack(run.id, state.output, queued.slots, run.inputHash ?? "", run.model ?? "");
        logAi("ai.batch_collected", { kind: run.kind, model: run.model, readings: pack.readings.length, dropped, waitedMs: Date.now() - run.createdAt.getTime() });
        report.push({ period, outcome: "collected" });
      } catch (error) {
        // erro de rede ao consultar não perde o lote: a próxima rodada pergunta de novo
        const reason = classifyAiError(error);
        if (reason === "invalid_output") { await fail(reason, error instanceof Error ? error.message : String(error)); continue; }
        logAi("ai.batch_check_failed", { kind: run.kind, reason, message: String(error).slice(0, 200) }, "warn");
        report.push({ period, outcome: "waiting", detail: reason });
      }
    }
    return report;
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
}
