import { z } from "zod";
import { sameRecordingText } from "@/lib/music/recording-match";
import type { AlbumEdition, EditionTrack } from "./album-journey";

export const CARTOLA_EDITORIAL_URL = "https://www.universalmusic.com.br/2026/03/04/a-janela-de-cartola/";

export const curationCreditSchema = z.object({
  id: z.string().min(1).max(100),
  version: z.number().int().positive(),
  title: z.string().min(1).max(120),
  sourceUrl: z.literal(CARTOLA_EDITORIAL_URL),
});
export type CurationCredit = z.infer<typeof curationCreditSchema>;

export const recordingCreditCueSchema = z.object({
  kind: z.literal("RECORDING_CREDIT"),
  fact: z.string().min(1).max(700),
  invitation: z.string().min(1).max(700),
  source: z.object({
    provider: z.literal("universal-music-brasil"),
    scope: z.literal("recording-credit"),
    identity: z.literal("curated-catalog-entry"),
    collectionId: z.string().regex(/^\d{1,20}$/),
    sourceId: z.string().regex(/^\d{1,20}$/),
    storefront: z.string().regex(/^[A-Z]{2}$/),
    url: z.literal(CARTOLA_EDITORIAL_URL),
    checkedOn: z.string().date(),
  }),
});

// The ordered IDs were checked against the Brazilian Apple lookup and the
// sequence published by Universal. A changed edition needs another review.
export const CARTOLA_1976 = {
  credit: { id: "cartola-1976-v1", version: 1, title: "Uma porta para o samba", sourceUrl: CARTOLA_EDITORIAL_URL },
  artistName: "Cartola",
  albumName: "Cartola (1976)",
  releaseYear: "1976",
  collectionId: "1444042772",
  storefront: "BR",
  sourceCheckedOn: "2026-11-05",
  trackIds: ["1444042773", "1444042776", "1444042777", "1444042778", "1444042779", "1444043174",
    "1444043176", "1444043177", "1444043179", "1444043182", "1444043183", "1444043186"],
} as const;
export const CARTOLA_JOURNEY_HREF = `/discovery/albums?curadoria=${CARTOLA_1976.credit.id}`;

const recordingCredits: Record<string, { title: string; fact: string; invitation: string }> = {
  "1444042773": {
    title: "O Mundo É um Moinho",
    fact: "Altamiro Carrilho apresenta a melodia de abertura na flauta, segundo a Universal Music Brasil.",
    invitation: "Segue a melodia da flauta e repara no que muda quando Cartola começa a cantar.",
  },
  "1444042776": {
    title: "Minha",
    fact: "A gravadora destaca o diálogo do trombone de Nelsinho com o canto de Cartola.",
    invitation: "Escuta o espaço entre as frases cantadas. Onde você percebe a resposta do trombone?",
  },
  "1444042779": {
    title: "Preciso Me Encontrar",
    fact: "A Universal Music Brasil atribui a introdução no fagote a Airton Barbosa.",
    invitation: "Presta atenção no timbre grave da abertura e acompanha a passagem para a voz.",
  },
  "1444043177": {
    title: "As Rosas Não Falam",
    fact: "A gravadora destaca o violão de sete cordas e a flauta de Altamiro Carrilho no arranjo desta faixa.",
    invitation: "Escolhe um dos dois para seguir. Na próxima escuta, troca de instrumento e repara no que aparece entre os versos.",
  },
};

export function findCuratedAlbum(id: string) {
  return id === CARTOLA_1976.credit.id ? CARTOLA_1976 : null;
}

export function matchesCuratedEdition(curation: typeof CARTOLA_1976, edition: AlbumEdition | null): edition is AlbumEdition {
  if (!edition) return false;
  const { album, tracks } = edition;
  return album.collectionId === curation.collectionId && album.storefront === curation.storefront
    && sameRecordingText(album.artistName, curation.artistName) && sameRecordingText(album.albumName, curation.albumName)
    && album.releaseDate?.slice(0, 4) === curation.releaseYear
    && album.trackCount === curation.trackIds.length && tracks.length === curation.trackIds.length
    && tracks.every((track, index) => track.trackId === curation.trackIds[index] && track.disc === 1 && track.number === index + 1
      && sameRecordingText(track.artistName, curation.artistName));
}

export function curatedRecordingCue(curation: typeof CARTOLA_1976, track: EditionTrack): z.infer<typeof recordingCreditCueSchema> | null {
  const credit = recordingCredits[track.trackId];
  if (!credit || !sameRecordingText(track.trackName, credit.title)) return null;
  return {
    kind: "RECORDING_CREDIT", fact: credit.fact, invitation: credit.invitation,
    source: {
      provider: "universal-music-brasil", scope: "recording-credit", identity: "curated-catalog-entry",
      collectionId: curation.collectionId, storefront: curation.storefront, sourceId: track.trackId,
      url: curation.credit.sourceUrl, checkedOn: curation.sourceCheckedOn,
    },
  };
}
