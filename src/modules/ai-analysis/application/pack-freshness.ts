import crypto from "crypto";
import type { PeriodKey } from "@/modules/statistics/application/overview-service";
import {
  NARRATIVE_FORMS,
  type MusicProfileInput,
  type NarrativeAngle,
  type PackSlot,
} from "../domain/ai-analysis.types";

/**
 * De quanto em quanto tempo o pacote de cada período pode (mínimo) e deve
 * (máximo) ser refeito. A semana muda rápido; "tudo" quase não muda.
 */
export const PACK_CADENCE: Record<PeriodKey, { minHours: number; maxHours: number }> = {
  "7d": { minHours: 6, maxHours: 24 },
  "30d": { minHours: 12, maxHours: 72 },
  "1y": { minHours: 24, maxHours: 24 * 7 },
  all: { minHours: 72, maxHours: 24 * 14 },
};

/** A ordem em que o cron olha os períodos: o que mais aparece na tela vem primeiro. */
export const REFRESH_PRIORITY: PeriodKey[] = ["30d", "7d", "1y", "all"];

/**
 * A impressão digital de uma escuta: só o que muda a HISTÓRIA que os textos
 * contam — quem está no topo, o ponto fora da curva, quem voltou, a
 * transição, o que mais tocou. Contagens mudam a cada sync e não entram,
 * senão todo pacote pareceria velho de hora em hora.
 */
export function packFingerprint(profile: MusicProfileInput): string {
  const signals = {
    top: profile.topArtists.slice(0, 5).map((artist) => artist.name),
    rising: profile.risingArtists.slice(0, 3).map((artist) => artist.name),
    track: profile.mostPlayed?.track?.name ?? null,
    album: profile.mostPlayed?.album?.name ?? null,
    outliers: (profile.outliers ?? []).map((artist) => artist.name),
    comebacks: (profile.comebacks ?? []).map((artist) => artist.name),
    transition: profile.transition ? [profile.transition.from.track, profile.transition.to.track] : null,
    loop: profile.loop?.track ?? null,
    era: profile.eras?.[0]?.decade ?? null,
    rack: (profile.rackAlbums ?? []).map((album) => album.album),
  };
  return crypto.createHash("sha256").update(JSON.stringify(signals)).digest("hex").slice(0, 16);
}

export type RefreshDecision = "missing" | "too_old" | "changed" | "fresh" | "too_recent";

/**
 * Se o pacote atual serve: sem pacote, gera; velho demais, gera; escuta
 * mudou e já passou o mínimo, gera. Mudança antes do mínimo espera — é o
 * que evita refazer o pacote a cada música nova.
 */
export function refreshDecision(
  current: { builtAt: Date; fingerprint: string } | null,
  fingerprint: string,
  period: PeriodKey,
  now = new Date(),
): RefreshDecision {
  if (!current) return "missing";
  const ageHours = (now.getTime() - current.builtAt.getTime()) / 3_600_000;
  const cadence = PACK_CADENCE[period];
  if (ageHours >= cadence.maxHours) return "too_old";
  if (current.fingerprint === fingerprint) return "fresh";
  return ageHours >= cadence.minHours ? "changed" : "too_recent";
}

export type RoundOutcome = "generated" | "skipped" | "blocked" | "failed";

/**
 * Depois de tentar um período, a rodada do cron segue para o próximo?
 *
 * Gerou: encerra — um pacote por execução é o combinado, e insistir agora
 * só gastaria cota. Bloqueado pelo teto: encerra também, porque o teto vale
 * para todos os períodos e os seguintes bateriam nele igual.
 *
 * Falhou: SEGUE. Encerrar aqui deixava quem vem depois na fila refém de um
 * período problemático — e como o `30d` é o primeiro, uma falha teimosa
 * nele significaria que `7d`, `1y` e `all` nunca seriam gerados. As
 * tentativas a mais já estão limitadas pelo teto por hora.
 */
export function keepScanning(outcome: RoundOutcome): boolean {
  return outcome === "skipped" || outcome === "failed";
}

/** Se vale sequer montar o perfil para comparar: antes do mínimo, nem olha. */
export function oldEnoughToCheck(builtAt: Date | null, period: PeriodKey, now = new Date()): boolean {
  if (!builtAt) return true;
  return (now.getTime() - builtAt.getTime()) / 3_600_000 >= PACK_CADENCE[period].minHours;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * As leituras do pacote: cada uma com um ângulo e uma forma diferentes.
 * Com menos ângulos que leituras, os ângulos se repetem — mas nunca com a
 * mesma forma.
 */
export function pickSlots(
  available: NarrativeAngle[],
  count = 4,
  random: () => number = Math.random,
): PackSlot[] {
  const angles = shuffled(available.length > 0 ? available : (["numeros"] as NarrativeAngle[]), random);
  const forms = shuffled([...NARRATIVE_FORMS], random);
  return Array.from({ length: count }, (_, index) => ({
    angle: angles[index % angles.length],
    form: forms[index % forms.length],
  }));
}
