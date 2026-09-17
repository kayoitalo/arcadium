import { censorProfanity } from "../domain/profanity";
import { findCopiedExample, findOffTonePhrases, replaceReportWords } from "../domain/text-guard";
import {
  profileNarrativeSchema,
  SCREEN_KEYS,
  type PackSlot,
  type ProfileNarrative,
  type ReadingPack,
  type ScreenKey,
} from "../domain/ai-analysis.types";

/** O texto pronto pra tela: sem vocabulário de relatório e com palavrão censurado. */
export function polish(text: string): string;
export function polish(text: string | null): string | null;
export function polish(text: string | null): string | null {
  return censorProfanity(replaceReportWords(text));
}

const LINE_MIN = 8;
const LINE_MAX = 200;

export interface SanitizedPack {
  readings: ProfileNarrative[];
  albumLines: ReadingPack["albumLines"];
  screenLines: ReadingPack["screenLines"];
  dropped: { readings: number; albumLines: number; screenLines: number };
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** Passa pelo tom e não copia exemplo do prompt. */
function acceptable(texts: Array<string | null | undefined>, examples: string[]): boolean {
  return findOffTonePhrases(texts).length === 0 && !findCopiedExample(texts, examples);
}

function cleanLine(value: unknown, examples: string[]): string | null {
  if (typeof value !== "string") return null;
  const line = polish(value.trim());
  if (line.length < LINE_MIN || line.length > LINE_MAX) return null;
  return acceptable([line], examples) ? line : null;
}

/**
 * O JSON do pacote, item a item. Uma leitura fora do tom ou um comentário
 * que copiou exemplo saem sozinhos — o resto do pacote fica. Cada leitura
 * ganha o ângulo e a forma do slot que o modelo recebeu.
 */
export function sanitizePack(output: unknown, slots: PackSlot[], examples: string[]): SanitizedPack {
  const root = asRecord(output);
  const rawReadings = asArray(root.readings);
  const rawAlbumLines = asArray(root.albumLines);
  const rawScreenLines = asArray(root.screenLines);

  const readings: ProfileNarrative[] = [];
  rawReadings.forEach((raw, index) => {
    const parsed = profileNarrativeSchema.safeParse(raw);
    if (!parsed.success) return;

    const reading = parsed.data;
    const polished: ProfileNarrative = {
      ...reading,
      eyebrow: polish(reading.eyebrow),
      headline: polish(reading.headline),
      narrative: polish(reading.narrative),
      insight: polish(reading.insight),
      playfulClosing: polish(reading.playfulClosing),
    };
    const texts = [polished.eyebrow, polished.headline, polished.narrative, polished.insight, polished.playfulClosing];
    if (!acceptable(texts, examples)) return;

    const slotNumber = Number(asRecord(raw).slot);
    const slot = slots[Number.isInteger(slotNumber) && slotNumber >= 1 ? slotNumber - 1 : index];
    readings.push({ ...polished, angle: slot?.angle, form: slot?.form });
  });

  const albumLines: ReadingPack["albumLines"] = [];
  for (const raw of rawAlbumLines) {
    const record = asRecord(raw);
    const line = cleanLine(record.line, examples);
    if (!line || typeof record.album !== "string" || typeof record.artist !== "string") continue;
    albumLines.push({ album: record.album, artist: record.artist, line });
  }

  const screenLines: ReadingPack["screenLines"] = [];
  for (const raw of rawScreenLines) {
    const record = asRecord(raw);
    const line = cleanLine(record.line, examples);
    if (!line || !SCREEN_KEYS.includes(record.screen as ScreenKey)) continue;
    screenLines.push({ screen: record.screen as ScreenKey, line });
  }

  return {
    readings,
    albumLines,
    screenLines,
    dropped: {
      readings: rawReadings.length - readings.length,
      albumLines: rawAlbumLines.length - albumLines.length,
      screenLines: rawScreenLines.length - screenLines.length,
    },
  };
}
