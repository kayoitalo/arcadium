import { prisma } from "@/lib/db/prisma";
import { filterGenreTags } from "@/modules/enrichment/domain/genre-tags";
import { sameRecordingText } from "@/lib/music/recording-match";
import { DiscoveryConflict } from "../domain/feedback";
import { CURATION_PROPOSALS, TERRITORY_VERSION, exactGenre, type TerritoryRequest, type TerritorySnapshot } from "../domain/territories";
import type { SimilarArtistProvider } from "../domain/similar-artist-provider.interface";
import type { RawCandidate } from "../domain/recommendation.types";
import { mergeCandidates } from "./hybrid-candidates";
import { isCollaborationOfKnownArtist } from "../domain/candidate-filters";

export class TerritoryService {
  async doors() {
    const rows = await prisma.artist.findMany({ where: { metadataStatus: "RESOLVED", tags: { not: null }, enrichedAt: { not: null } },
      orderBy: [{ name: "asc" }, { id: "asc" }], take: 201, select: { name: true, tags: true } });
    const genres = new Map<string, Set<string>>();
    for (const artist of rows.slice(0, 200)) for (const genre of filterGenreTags((artist.tags ?? "").split(","))) {
      const names = genres.get(genre) ?? new Set(); names.add(artist.name); genres.set(genre, names);
    }
    return { version: TERRITORY_VERSION, scope: "artist-tag", limited: rows.length > 200,
      doors: [...genres].sort(([a], [b]) => a.localeCompare(b)).slice(0, 24).map(([genre, names]) => ({ genre, artists: names.size, examples: [...names].slice(0, 3) })),
      proposals: CURATION_PROPOSALS,
      capabilities: { territoryScope: "Associação de artista no catálogo; não certifica gênero de cada gravação.",
        repertoire: ["albumGenre", "maxDurationMs"], unavailable: ["moment", "vocals", "instrumentation", "mood"] } };
  }

  async resolve(request: TerritoryRequest, knownArtists: Set<string>): Promise<TerritorySnapshot> {
    const rows = await prisma.artist.findMany({ where: { metadataStatus: "RESOLVED", tags: { contains: request.genre, mode: "insensitive" }, enrichedAt: { not: null } },
      orderBy: [{ name: "asc" }, { id: "asc" }], take: 201,
      include: { tracks: { orderBy: [{ name: "asc" }, { id: "asc" }], take: 3, select: { id: true, name: true } } } });
    const matches = rows.slice(0, 200).filter((row) => exactGenre(row.tags, request.genre) && !isCollaborationOfKnownArtist(row.name, knownArtists));
    // Check all same-name catalog rows, including rows outside the sampled tag.
    const collisions = matches.length ? await prisma.artist.groupBy({ by: ["name"], where: { name: { in: matches.map((row) => row.name), mode: "insensitive" } }, _count: { id: true } }) : [];
    const counts = new Map<string, number>();
    for (const row of collisions) counts.set(row.name.toLowerCase(), (counts.get(row.name.toLowerCase()) ?? 0) + row._count.id);
    return { ...request, genre: request.genre.toLowerCase(), scope: "artist-tag", capturedAt: new Date().toISOString(),
      artists: matches.filter((row) => counts.get(row.name.toLowerCase()) === 1).slice(0, 6).map((row) => ({
        id: row.id, name: row.name, mbid: row.mbid, enrichedAt: row.enrichedAt!.toISOString(), tracks: row.tracks,
      })) };
  }

  async candidates(destination: TerritorySnapshot, provider: SimilarArtistProvider): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];
    if (provider.isConfigured()) provider.beginDiscoveryWindow?.(20_000);
    // No similarity lookup, graph expansion, reach lookup or fill from profile.
    for (const artist of destination.artists) {
      const evidence = [{ kind: "territory_tag" as const, source: "catalog" as const, genre: destination.genre, seedArtist: artist.name }];
      for (const track of artist.tracks) candidates.push({ artistName: artist.name, trackName: track.name, artistId: artist.id, trackId: track.id,
        source: "territory_catalog", genre: destination.genre, evidence });
      const tracks = provider.isConfigured() ? await provider.getTopTracks(artist.name, 3).catch(() => []) : [];
      for (const track of tracks) if (sameRecordingText(track.artistName, artist.name)) candidates.push({ artistName: artist.name, trackName: track.trackName,
        artistId: artist.id, source: "territory_catalog", genre: destination.genre, evidence });
    }
    return mergeCandidates(candidates);
  }
}

export function assertSupportedRestrictions(restriction: { moment?: string; vocals?: string } | undefined) {
  if (restriction?.moment || restriction?.vocals) throw new DiscoveryConflict("A cobertura atual não sustenta filtros de momento, voz ou instrumentação. Escolha gênero do álbum ou duração catalogada, ou retire explicitamente a restrição.", 422, "INSUFFICIENT_EVIDENCE");
}
