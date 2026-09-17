import type { AlbumLine } from "@/modules/ai-analysis/domain/ai-analysis.types";

/**
 * Título e artista sem acento, caixa nem pontuação: o modelo reescreve os
 * nomes na resposta e volta "Tim Maia - Racional" onde o banco tem
 * "Tim Maia — Racional".
 */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * O comentário escrito para um disco, ou null. O par disco+artista vem
 * primeiro: dois discos homônimos de artistas diferentes não podem herdar
 * a frase um do outro. Sem par exato, o título sozinho resolve o caso do
 * artista grafado de outro jeito ("Jorge Ben" e "Jorge Ben Jor").
 *
 * Sem correspondência não há comentário: uma frase sobre o disco errado é
 * pior do que nenhuma.
 */
export function findAlbumLine(
  lines: AlbumLine[],
  album: { title: string; artistName: string } | undefined | null,
): AlbumLine | null {
  if (!album) return null;

  const title = normalize(album.title);
  const artist = normalize(album.artistName);
  if (!title) return null;

  return (
    lines.find((entry) => normalize(entry.album) === title && normalize(entry.artist) === artist) ??
    lines.find((entry) => normalize(entry.album) === title) ??
    null
  );
}
