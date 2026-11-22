import type { Evidence } from "./conversation.types";

/*
 * A frase escolhe a prova. Os números já são conferidos com o dado; aqui a
 * unidade da frase decide qual prova mostrar: "o disco mais rodado" pede o
 * ranking de discos, "a faixa mais tocada" o de faixas, e uma contagem de
 * artistas novos pede a prova de estreia. Nada disso derruba leitura: sem a
 * prova ideal, fica a que existe.
 */

const RANKS_ALBUM = /\b(disco|[aá]lbum)\b[^.!?]{0,60}\bmais\s+(rodado|tocado|ouvido|escutado)\b|\bmais\s+(rodado|tocado|ouvido|escutado)\b[^.!?]{0,20}\b(disco|[aá]lbum)\b/iu;
const RANKS_TRACK = /\b(faixa|m[uú]sica|can[cç][aã]o)\b[^.!?]{0,60}\bmais\s+(rodada|tocada|ouvida|escutada)\b/iu;
const NEW_ARTISTS = /\d[\d.]*\s+(artistas|nomes)\s+(novos|diferentes|que nunca)/iu;

/** O que a frase ranqueia: o disco mais rodado, a faixa mais tocada, ou nada dito. */
export function rankedUnit(text: string): "album" | "track" | null {
  if (RANKS_ALBUM.test(text)) return "album";
  if (RANKS_TRACK.test(text)) return "track";
  return null;
}

/** A frase conta artistas novos: "294 artistas novos". */
export function countsNewArtists(text: string): boolean {
  return NEW_ARTISTS.test(text);
}

/** A prova é a ideal pra frase? Ranking de faixas não é a prova ideal de "o disco mais rodado". */
export function unitsAgree(text: string, evidence: Evidence): boolean {
  const unit = rankedUnit(text);
  if (evidence.kind === "ranking" && unit && evidence.unit !== unit) return false;
  if (evidence.kind !== "debut" && countsNewArtists(text)) return false;
  return true;
}
