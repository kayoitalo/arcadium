import { prisma } from "@/lib/db/prisma";
import { filterGenreTags } from "@/modules/enrichment/domain/genre-tags";

/**
 * Os gêneros de um artista: as tags do MusicBrainz quando existem; sem
 * elas, o gênero que o catálogo da Apple dá aos discos dele — o mais
 * frequente. O MusicBrainz é mais fino ("pop punk"); o catálogo é mais
 * grosso ("rock"), mas cobre quase todo artista.
 */
export function mergeArtistGenres(tags: string | null | undefined, catalogGenres: Array<string | null>): string[] {
  const curated = filterGenreTags(tags?.split(",") ?? []);
  if (curated.length > 0) return curated;

  const counts = new Map<string, number>();
  for (const genre of catalogGenres) {
    if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top ? [top[0]] : [];
}

/** Os gêneros de cada artista pelo nome, com a reserva do catálogo aplicada. */
export async function loadArtistGenres(names: string[]): Promise<Map<string, string[]>> {
  const unique = [...new Set(names)];
  if (unique.length === 0) return new Map();

  const [artists, albums] = await Promise.all([
    prisma.artist.findMany({ where: { name: { in: unique } }, select: { name: true, tags: true } }),
    prisma.album.findMany({
      where: { itunesGenre: { not: null }, artist: { name: { in: unique } } },
      select: { itunesGenre: true, artist: { select: { name: true } } },
    }),
  ]);

  const tagsByArtist = new Map(artists.map((artist) => [artist.name, artist.tags]));
  const catalogByArtist = new Map<string, string[]>();
  for (const album of albums) {
    const list = catalogByArtist.get(album.artist.name) ?? [];
    list.push(album.itunesGenre!);
    catalogByArtist.set(album.artist.name, list);
  }

  return new Map(
    unique.map((name) => [name, mergeArtistGenres(tagsByArtist.get(name), catalogByArtist.get(name) ?? [])]),
  );
}
