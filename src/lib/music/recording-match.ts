import { splitTrackTitle, withoutFeat } from "./track-title";

/** Text compatibility is evidence, never a verified recording identifier.
 * Keep all version/guest words: remasters, live performances, remixes and
 * clean edits must not silently borrow another recording's preview.
 */
export function recordingText(value: string): string {
  return value.normalize("NFKC").toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, " ").trim();
}

export function sameRecordingText(expected: string, found: string): boolean {
  const key = recordingText(expected);
  return Boolean(key) && key === recordingText(found);
}

/** "(From "God of War" Soundtrack)", "- From the Motion Picture …": diz de onde veio, não muda a música. */
const FROM_SOURCE = /\s*(?:[([]\s*from\s[^)\]]*[)\]]|\s[-–—]\s+from\s.+)\s*$/i;

/** O título sem o que só diz a edição: remaster, edição de luxo, trilha de origem, convidado. */
export function editionlessTitle(value: string): string {
  const clean = withoutFeat(splitTrackTitle(value.replace(FROM_SOURCE, "").trim() || value).title);
  return clean || value;
}

/**
 * A mesma música em outra edição: "Go Your Own Way - 2004 Remaster" aceita
 * "Go Your Own Way" quando a loja não tem aquele remaster. O que muda a
 * música (ao vivo, remix, demo, acústica) continua exigido dos dois lados.
 * Só para prévias de escuta: identidade de gravação continua no estrito.
 */
export function sameSongAnyEdition(
  expected: { artistName: string; trackName: string },
  found: { artistName: string; trackName: string },
): boolean {
  return sameRecordingText(expected.artistName, found.artistName)
    && sameRecordingText(editionlessTitle(expected.trackName), editionlessTitle(found.trackName));
}

export function compatibleRecording(
  expected: { artistName: string; trackName: string },
  found: { artistName: string; trackName: string },
): boolean {
  return sameRecordingText(expected.artistName, found.artistName)
    && sameRecordingText(expected.trackName, found.trackName);
}
