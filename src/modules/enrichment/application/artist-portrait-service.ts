import { prisma } from "@/lib/db/prisma";
import { DiscoveryConflict } from "@/modules/recommendations/domain/feedback";
import { SpotifyArtistPortraitAdapter } from "@/modules/spotify/infrastructure/spotify-artist-portrait-adapter";
import { LastFmSimilarArtistProvider } from "@/modules/recommendations/infrastructure/lastfm-similar-adapter";
import type { ArtistPhotoResult, ArtistPortraitProvider } from "../domain/artist-portrait";

export class ArtistPortraitService {
  constructor(private provider: ArtistPortraitProvider = new SpotifyArtistPortraitAdapter(), private fallback: Pick<LastFmSimilarArtistProvider, "getArtistPortrait"> = new LastFmSimilarArtistProvider()) {}
  async load(userId: string, artistName: string): Promise<ArtistPhotoResult> {
    const [track] = await prisma.listeningEvent.groupBy({
      by: ["rawTrackName"], where: { userId, rawArtistName: artistName },
      _count: { rawTrackName: true }, orderBy: [{ _count: { rawTrackName: "desc" } }, { rawTrackName: "asc" }], take: 1,
    });
    if (!track) throw new DiscoveryConflict("Artista não encontrado neste histórico.", 404);
    if (!track.rawTrackName.trim()) return { status: "MISSING", reason: "NO_REFERENCE" };
    let primary: ArtistPhotoResult | null = null;
    try { primary = await this.provider.lookup({ artistName, trackName: track.rawTrackName }); } catch { /* Try only the other already-integrated provider. */ }
    if (primary?.status === "READY" || primary?.status === "MISSING" && primary.reason === "AMBIGUOUS") return primary;
    try {
      const secondary = await this.fallback.getArtistPortrait(artistName);
      if (secondary.status === "READY") return secondary;
      if (!primary) throw new Error("Primary source temporarily unavailable");
      return secondary.reason === "NOT_CONFIGURED" ? primary : secondary;
    } catch { throw new DiscoveryConflict("As fontes de fotos estão ocupadas ou indisponíveis. Você pode tentar novamente em instantes.", 503, "PHOTO_TEMPORARY"); }
  }
}
