import { prisma } from "@/lib/db/prisma";
import { DiscoveryConflict } from "@/modules/recommendations/domain/feedback";
import { SpotifyArtistPortraitAdapter } from "@/modules/spotify/infrastructure/spotify-artist-portrait-adapter";
import type { ArtistPhotoResult, ArtistPortraitProvider } from "../domain/artist-portrait";

export class ArtistPortraitService {
  constructor(private provider: ArtistPortraitProvider = new SpotifyArtistPortraitAdapter()) {}
  async load(userId: string, artistName: string): Promise<ArtistPhotoResult> {
    const [track] = await prisma.listeningEvent.groupBy({
      by: ["rawTrackName"], where: { userId, rawArtistName: artistName },
      _count: { rawTrackName: true }, orderBy: [{ _count: { rawTrackName: "desc" } }, { rawTrackName: "asc" }], take: 1,
    });
    if (!track) throw new DiscoveryConflict("Artista não encontrado neste histórico.", 404);
    if (!track.rawTrackName.trim()) return { status: "MISSING", reason: "NO_REFERENCE" };
    try { return await this.provider.lookup({ artistName, trackName: track.rawTrackName }); }
    catch { throw new DiscoveryConflict("A fonte de fotos está ocupada ou indisponível. Você pode tentar novamente em instantes.", 503, "PHOTO_TEMPORARY"); }
  }
}
