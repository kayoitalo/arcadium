/**
 * Normalizes text for matching and key generation.
 * Performs trimming, lowercasing, unicode normalization (NFD -> NFC), and collapses multiple spaces.
 * Raw source strings are preserved separately in the database.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents/diacritics for matching key
    .toLowerCase()
    .replace(/\s+/g, " ");
}
