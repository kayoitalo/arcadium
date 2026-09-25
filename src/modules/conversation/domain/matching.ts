import type { PeriodKey } from "@/modules/statistics/application/overview-service";
import type { EvidenceKind } from "./conversation.types";

/*
 * Como a frase da IA encontra a prova no banco — e como a conversa percebe
 * quando a frase não bate com o dado. Tudo aqui é função pura: recebe
 * texto e números, devolve a escolha, e é testado sem banco.
 */

/** Minúsculas, sem acento e sem "(feat. …)": o jeito de achar um nome dentro da frase. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .trim();
}

/** Nome inteiro dentro da frase: "Element" não pode casar com "elemento". */
export function mentions(text: string, name: string | null | undefined): boolean {
  const needle = name ? normalize(name) : "";
  if (needle.length < 3) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalize(text));
}

/**
 * O par de audições seguidas que a frase cita: cada lado vale 2 se a frase
 * cita a faixa e 1 se cita só o artista, os dois lados precisam estar nela
 * e ganha o par mais citado — o mais recente, no empate. Devolve o índice
 * da primeira audição do par, ou -1.
 */
export function pickTransition(events: Array<{ artist: string; track: string }>, text: string): number {
  const side = (event: { artist: string; track: string }) =>
    mentions(text, event.track) ? 2 : mentions(text, event.artist) ? 1 : 0;
  let best = 0;
  let at = -1;
  for (let index = events.length - 1; index > 0; index -= 1) {
    const [a, b] = [events[index - 1], events[index]];
    if (a.artist === b.artist) continue;
    const [left, right] = [side(a), side(b)];
    if (left > 0 && right > 0 && left + right > best) {
      best = left + right;
      at = index - 1;
      if (best === 4) break;
    }
  }
  return at;
}

/**
 * A linha que a frase cita. A manchete manda sobre a narrativa, que manda
 * sobre o detalhe; dentro do mesmo trecho, a ordem das listas decide
 * (disco antes de faixa antes de artista, por exemplo).
 */
export function focusIn<U extends string>(
  fields: string[],
  lists: Array<{ unit: U; labels: string[] }>,
): { unit: U; index: number } | null {
  for (const field of fields) {
    for (const { unit, labels } of lists) {
      const index = labels.findIndex((label) => mentions(field, label));
      if (index >= 0) return { unit, index };
    }
  }
  return null;
}

/** Os "N vezes" / "N audições" escritos em algarismo na frase. */
export function claimedCounts(text: string): number[] {
  const pattern = /(\d[\d.]*)\s*(?:vezes|audi[cç][oõ]es|plays|x)\b/giu;
  return [...text.matchAll(pattern)].map((match) => Number(match[1].replace(/\./g, ""))).filter(Number.isFinite);
}

/**
 * Os "N%" e "N por cento" da frase. De 100 para cima é jeito de falar
 * ("100% vibe"), não dado.
 */
export function claimedShares(text: string): number[] {
  const pattern = /(\d{1,3}(?:[.,]\d+)?)\s*(?:%|por\s*cento\b)/giu;
  return [...text.matchAll(pattern)]
    .map((match) => Number(match[1].replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value < 100);
}

/**
 * A frase bate com o dado? Todo número que ela afirma ("N vezes", "N%")
 * precisa estar perto de um número verdadeiro da prova. A folga é a do
 * jeito de falar — "quase 40%" para 39,4 —, não a de um dado velho: a
 * prova é medida na janela que a leitura viu. Frase sem número passa.
 */
export function claimsAgree(claims: number[], truths: number[], tolerance = 2): boolean {
  return claims.every((claim) => truths.some((truth) => Math.abs(truth - claim) <= tolerance));
}

/** As décadas de que a frase fala: "anos 90", "2000s", "década passada"… */
export function decadesIn(text: string, now = new Date()): number[] {
  const plain = normalize(text);
  const found = new Set<number>();
  const current = Math.floor(now.getFullYear() / 10) * 10;
  const twoDigits = (value: number) => (value >= 30 ? 1900 + value : 2000 + value);

  for (const match of plain.matchAll(/\banos\s+(\d{2}|\d{4})\b/g)) {
    const value = Number(match[1]);
    found.add(match[1].length === 2 ? twoDigits(value) : Math.floor(value / 10) * 10);
  }
  // só com quatro algarismos: "30s" sozinho é mais provável ser "prévia de 30s" que 1930
  for (const match of plain.matchAll(/\b((?:19|20)\d0)'?s\b/g)) found.add(Number(match[1]));
  for (const match of plain.matchAll(/\bdecada de\s+(\d{2}|\d{4})\b/g)) {
    const value = Number(match[1]);
    found.add(match[1].length === 2 ? twoDigits(value) : Math.floor(value / 10) * 10);
  }
  // "a década passada e a retrasada": o substantivo aparece uma vez só
  if (/\bdecadas?\b/.test(plain)) {
    if (/\bpassada\b/.test(plain)) found.add(current - 10);
    if (/\bretrasada\b/.test(plain)) found.add(current - 20);
  }

  return [...found].filter((decade) => decade >= 1900 && decade <= current).sort((a, b) => a - b);
}

/**
 * "Voltou depois de X" só vale se a pessoa estava ouvindo música nesse
 * meio-tempo. Com um buraco no histórico (meses sem nenhum registro), todo
 * artista pareceria ter voltado de anos sumido — e a frase seria mentira.
 * Recebe as audições por mês ("2023-06" → 728) e o intervalo do sumiço.
 */
export function observedGap(
  monthly: Map<string, number>,
  from: Date,
  to: Date,
  { minPlays = 30, minShare = 0.7 }: { minPlays?: number; minShare?: number } = {},
): boolean {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor < end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  if (months.length === 0) return true;
  const active = months.filter((month) => (monthly.get(month) ?? 0) >= minPlays).length;
  return active / months.length >= minShare;
}

const PERIOD_ORDER: PeriodKey[] = ["7d", "30d", "1y", "all"];
const KIND_ORDER: EvidenceKind[] = ["transition", "ranking", "decades"];

/**
 * O que o amigo conta, e em que ordem: do mais recente para o mais antigo,
 * no máximo `perPeriod` assuntos de cada janela, sem repetir o tipo de
 * prova dentro dela nem usar o mesmo tipo mais de `perKind` vezes na
 * conversa inteira, até `limit` no total.
 */
export function selectMoments<T extends { period: PeriodKey; kind: EvidenceKind }>(
  candidates: T[],
  { limit = 6, perPeriod = 2, perKind = 2 }: { limit?: number; perPeriod?: number; perKind?: number } = {},
): T[] {
  const chosen: T[] = [];
  const used = new Map<EvidenceKind, number>();
  for (const period of PERIOD_ORDER) {
    const kinds = new Set<EvidenceKind>();
    const pool = candidates
      .filter((candidate) => candidate.period === period)
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    for (const candidate of pool) {
      if (chosen.length >= limit || kinds.size >= perPeriod) break;
      if (kinds.has(candidate.kind) || (used.get(candidate.kind) ?? 0) >= perKind) continue;
      kinds.add(candidate.kind);
      used.set(candidate.kind, (used.get(candidate.kind) ?? 0) + 1);
      chosen.push(candidate);
    }
  }
  return chosen;
}

/** A janela dita pelo amigo, em vez do nome técnico do período. */
export function windowLabel(period: PeriodKey, firstPlay: Date | null, timeZone = "America/Sao_Paulo"): string {
  if (period === "7d") return "essa semana";
  if (period === "30d") return "nesse último mês";
  if (period === "1y") return "de um ano pra cá";
  if (!firstPlay) return "desde que eu te conheço";
  const month = firstPlay.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone });
  return `desde que eu te conheço, lá em ${month}`;
}

/** "31 ago · 21:19": a hora em que tocou, no fuso de quem ouviu. */
export function formatWhen(date: Date, timeZone = "America/Sao_Paulo"): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replace(".", "")} · ${part("hour")}:${part("minute")}`;
}
