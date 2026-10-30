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

export function compatibleRecording(
  expected: { artistName: string; trackName: string },
  found: { artistName: string; trackName: string },
): boolean {
  return sameRecordingText(expected.artistName, found.artistName)
    && sameRecordingText(expected.trackName, found.trackName);
}
