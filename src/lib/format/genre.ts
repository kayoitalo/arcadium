/**
 * Gêneros chegam em caixa baixa das fontes. Capitalizar direto transforma
 * sigla em nome próprio ("mpb" vira "Mpb"), então o que é curto e sem
 * espaço sobe inteiro para caixa alta e o resto vira Título.
 */
export function formatGenre(genre: string): string {
  const trimmed = genre.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= 4 && !trimmed.includes(" ")) return trimmed.toUpperCase();
  return trimmed.replace(
    /(^|[\s-])(\p{L})/gu,
    (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
  );
}
