import { cleanTitle } from "@/lib/music/track-title";
import type { Evidence } from "./conversation.types";

/*
 * A frase só afirma o que a prova mostra. Os números já eram conferidos; aqui
 * entram os nomes e a unidade. Um nome entre aspas que não está na prova, um
 * "disco mais rodado" em cima de uma prova de faixas, ou uma contagem de
 * artistas novos sem a prova de estreia: a leitura não vira assunto.
 */

const normalize = (value: string) =>
  cleanTitle(value).normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Tudo que a prova nomeia: faixas, discos, artistas, gêneros. */
export function vocabulary(evidence: Evidence): string[] {
  const words: string[] = [];
  const add = (...values: Array<string | null | undefined>) => { for (const value of values) if (value) words.push(value); };
  if ("cover" in evidence && evidence.cover) add(evidence.cover.title, evidence.cover.artist);
  switch (evidence.kind) {
    case "transition":
      add(evidence.from.track, evidence.from.artist, evidence.from.genre, evidence.from.cover.title, evidence.to.track, evidence.to.artist, evidence.to.genre, evidence.to.cover.title);
      for (const step of [...evidence.context.before, ...evidence.context.after]) add(step.track, step.artist);
      break;
    case "ranking":
      for (const row of evidence.rows) add(row.label, row.sub);
      add(evidence.previewTrack);
      break;
    case "decades":
      break;
    case "outlier":
      add(evidence.artist, evidence.genre, ...evidence.dominant.map((entry) => entry.genre));
      break;
    case "night":
      for (const step of evidence.steps) add(step.track, step.artist);
      break;
    case "binge":
      add(evidence.artist, ...evidence.tracks.map((entry) => entry.track));
      break;
    case "debut":
      add(evidence.artist, evidence.firstTrack);
      break;
    default:
      add((evidence as { artist?: string }).artist, (evidence as { track?: string }).track);
  }
  return words;
}

/** Os nomes que a frase cita entre aspas: 'Out of Time', "Dawn FM", “Currents”. */
export function quotedNames(text: string): string[] {
  return [...text.matchAll(/['"‘“]([^'"‘’“”]{2,80})['"’”]/gu)].map((match) => match[1].trim()).filter((name) => /\p{L}/u.test(name));
}

/** Cada nome entre aspas aparece na prova (de um lado ou do outro: "Out of Time" casa com "Out of Time - Single"). */
export function namesAgree(text: string, evidence: Evidence): boolean {
  const known = vocabulary(evidence).map(normalize).filter(Boolean);
  return quotedNames(text).every((name) => {
    const wanted = normalize(name);
    return !wanted || known.some((word) => word === wanted || word.includes(wanted) || (wanted.length > 3 && wanted.includes(word) && word.length > 3));
  });
}

const RANKS_ALBUM = /\b(disco|[aá]lbum)\b[^.!?]{0,60}\bmais\s+(rodado|tocado|ouvido|escutado)\b|\bmais\s+(rodado|tocado|ouvido|escutado)\b[^.!?]{0,20}\b(disco|[aá]lbum)\b/iu;
const RANKS_TRACK = /\b(faixa|m[uú]sica|can[cç][aã]o)\b[^.!?]{0,60}\bmais\s+(rodada|tocada|ouvida|escutada)\b/iu;
const NEW_ARTISTS = /\d[\d.]*\s+(artistas|nomes)\s+(novos|diferentes|que nunca)/iu;

/** A unidade da frase é a da prova: ranking de faixas não sustenta "o disco mais rodado". */
export function unitsAgree(text: string, evidence: Evidence): boolean {
  if (evidence.kind === "ranking") {
    if (evidence.unit !== "album" && RANKS_ALBUM.test(text)) return false;
    if (evidence.unit !== "track" && RANKS_TRACK.test(text)) return false;
  }
  // quantos artistas novos só a prova de estreia mostra
  if (evidence.kind !== "debut" && NEW_ARTISTS.test(text)) return false;
  return true;
}

export function factsAgree(text: string, evidence: Evidence): boolean {
  return namesAgree(text, evidence) && unitsAgree(text, evidence);
}
