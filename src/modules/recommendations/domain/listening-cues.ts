import { z } from "zod";
import { albumTrackEditionSchema, catalogTrackURL, catalogURL } from "./album-journey";
import { compatiblePreviewIdentity } from "./preview-identity";
import { recordingCreditCueSchema } from "./curated-albums";
import { weeklyCredit } from "./weekly-journey";
export const CUE_VERSION = "catalog-cues-1" as const;
const source = z.object({ provider: z.literal("itunes"), sourceId: z.string().regex(/^\d{1,20}$/),
  url: z.string().refine((value) => catalogURL(value) === value), fetchedAt: z.string().datetime(),
  scope: z.literal("catalog-track"), identity: z.literal("compatible-text-v1") });
const boundWeeklyCredit = z.object({ credit: weeklyCredit, trackId: z.string(), collectionId: z.string(), storefront: z.string() });
const weeklyCue = z.object({ kind: z.literal("WEEKLY_RECORDING_CREDIT"), fact: z.string().max(1300), invitation: z.string().max(700), source: weeklyCredit });
export const listeningCuesSchema = z.object({ version: z.literal(CUE_VERSION), artistName: z.string(), trackName: z.string(),
  status: z.enum(["AVAILABLE", "INSUFFICIENT_EVIDENCE"]),
  cues: z.array(z.union([z.object({ kind: z.enum(["EDITION_POSITION", "DURATION", "VERSION_LABEL"]),
    fact: z.string().max(700), invitation: z.string().max(700), source }), recordingCreditCueSchema, weeklyCue])).max(4),
  limitation: z.string(),
});
export type ListeningCues = z.infer<typeof listeningCuesSchema>;

/** Deterministic invitations are anchored in catalog facts, never inferred
 * timbre, mood, instrumentation, personnel or waveform analysis. */
export function buildListeningCues(item: { artistName: string; trackName: string; appleMusicUrl?: string | null; scoreComponents?: unknown }): ListeningCues {
  const components = item.scoreComponents as Record<string, unknown> | null;
  const identity = compatiblePreviewIdentity(components?.previewIdentity, item);
  const edition = albumTrackEditionSchema.safeParse(components?.albumEdition);
  const facts = z.object({ durationMs: z.number().int().positive().max(86_400_000).nullable(), fetchedAt: z.string().datetime() }).safeParse(components?.catalogFacts);
  const url = identity ? catalogTrackURL(item.appleMusicUrl, identity.sourceId) : null;
  const cues: ListeningCues["cues"] = [];
  const recordingCue = recordingCreditCueSchema.safeParse(components?.recordingCue);
  if (recordingCue.success && edition.success && identity && edition.data.trackId === identity.sourceId
    && recordingCue.data.source.sourceId === identity.sourceId && recordingCue.data.source.collectionId === edition.data.collectionId
    && recordingCue.data.source.storefront === edition.data.storefront
    && catalogTrackURL(item.appleMusicUrl, identity.sourceId, edition.data.collectionId)) {
    cues.push(recordingCue.data);
  }
  const weekly = boundWeeklyCredit.safeParse(components?.weeklyRecordingCredit);
  if (!cues.length && weekly.success && edition.success && identity && identity.sourceId === edition.data.trackId
    && weekly.data.trackId === identity.sourceId && weekly.data.collectionId === edition.data.collectionId
    && weekly.data.storefront === edition.data.storefront && catalogTrackURL(item.appleMusicUrl, identity.sourceId, edition.data.collectionId)) {
    const credit = weekly.data.credit;
    cues.push({ kind: "WEEKLY_RECORDING_CREDIT", fact: `O MusicBrainz credita ${credit.instrument} a ${credit.artist} nesta gravação.`,
      invitation: "Tenta acompanhar esse instrumento. Se ele aparecer no trecho, repara em como divide espaço com os outros sons.", source: credit });
  }
  const sourceValue = identity && url && facts.success ? source.safeParse({ provider: "itunes", sourceId: identity.sourceId, url,
    fetchedAt: facts.data.fetchedAt, scope: "catalog-track", identity: "compatible-text-v1" }) : null;
  if (sourceValue?.success) {
    const provenance = sourceValue.data;
    if (edition.success && edition.data.trackId === identity!.sourceId) cues.push({ kind: "EDITION_POSITION",
      fact: `Nesta edição de “${edition.data.albumName.slice(0, 300)}”: disco ${edition.data.disc}, faixa ${edition.data.number}.`,
      invitation: "Ouça esta posição na sequência que você escolheu. A prévia é só um trecho; a ordem do álbum fica disponível na jornada.", source: provenance });
    if (facts.success && facts.data.durationMs) cues.push({ kind: "DURATION", fact: `O catálogo informa ${Math.floor(facts.data.durationMs / 60000)}:${String(Math.floor(facts.data.durationMs / 1000) % 60).padStart(2, "0")} para a faixa completa.`,
      invitation: "Compare o trecho da prévia com a faixa completa pelo link da fonte, se quiser. O trecho não revela sozinho a forma inteira da gravação.", source: provenance });
    const label = identity!.trackName.match(/\([^)]*(?:live|remix|remaster|acoustic|version|edit|ao vivo)[^)]*\)|(?: - | – ).*(?:live|remix|remaster|acoustic|version|edit|ao vivo).*/i)?.[0];
    if (label) cues.push({ kind: "VERSION_LABEL", fact: `O título desta entrada do catálogo inclui “${label.slice(0, 300)}”.`,
      invitation: "Ao comparar com outra versão, confira primeiro o título e a edição. O rótulo sozinho não comprova diferenças sonoras ou a identidade global da gravação.", source: provenance });
  }
  return { version: CUE_VERSION, artistName: item.artistName, trackName: item.trackName,
    status: cues.length ? "AVAILABLE" : "INSUFFICIENT_EVIDENCE", cues,
    limitation: cues.some((cue) => cue.kind === "RECORDING_CREDIT")
      ? "O crédito se refere à gravação do álbum documentada pela gravadora. Se o instrumento ficar fora do trecho da prévia, ouça a faixa completa pelo link do catálogo."
      : cues.some((cue) => cue.kind === "WEEKLY_RECORDING_CREDIT")
        ? "Crédito ligado à gravação pela sequência, pela versão e pela duração da edição. A prévia pode trazer só parte da gravação."
        : "Pistas a partir de metadados desta entrada Apple, com correspondência textual. Não são análise sonora nem certificação de MusicBrainz. Contexto de artista, álbum e música não prova o som desta versão." };
}
