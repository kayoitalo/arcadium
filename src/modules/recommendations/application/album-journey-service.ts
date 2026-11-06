import { prisma } from "@/lib/db/prisma";
import { ItunesCatalogAdapter } from "@/modules/enrichment/infrastructure/itunes-catalog-adapter";
import { sameRecordingText } from "@/lib/music/recording-match";
import type { AlbumSource, AlbumEditionProvider } from "../domain/album-journey";
import { DiscoveryConflict } from "../domain/feedback";
import { RecommendationService } from "./recommendation-service";
import { curatedRecordingCue, findCuratedAlbum, matchesCuratedEdition } from "../domain/curated-albums";

const algorithmVersion = "album-v1";
export class AlbumJourneyService {
  constructor(private catalog: AlbumEditionProvider = new ItunesCatalogAdapter()) {}

  async library(userId: string, query = "") {
    const albums = await prisma.album.findMany({ where: { listeningEvents: { some: { userId } },
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { artist: { name: { contains: query, mode: "insensitive" as const } } }] } : {}) },
      orderBy: [{ name: "asc" }, { id: "asc" }], take: 21, select: { id: true, name: true, artist: { select: { name: true } } } });
    return { albums: albums.slice(0, 20).map((row) => ({ source: { kind: "library" as const, id: row.id }, artistName: row.artist.name, albumName: row.name })), more: albums.length > 20 };
  }

  async source(userId: string, source: AlbumSource) {
    if (source.kind === "curated") {
      const curation = findCuratedAlbum(source.id);
      if (!curation) throw new DiscoveryConflict("Curadoria indisponível.", 404);
      return { artistName: curation.artistName, albumName: curation.albumName };
    }
    if (source.kind === "library") {
      const album = await prisma.album.findFirst({ where: { id: source.id, listeningEvents: { some: { userId } } }, select: { name: true, artist: { select: { name: true } } } });
      if (album) return { artistName: album.artist.name, albumName: album.name };
    } else {
      const item = await prisma.recommendationItem.findFirst({ where: { id: source.id, session: { userId, status: "ACTIVE" } }, select: { artistName: true, albumName: true } });
      if (item?.albumName) return { artistName: item.artistName, albumName: item.albumName };
    }
    throw new DiscoveryConflict("Álbum não encontrado nesta conta.", 404);
  }

  async editions(userId: string, source: AlbumSource) {
    const reference = await this.source(userId, source);
    const curation = source.kind === "curated" ? findCuratedAlbum(source.id) : null;
    if (curation) {
      const edition = await this.catalog.lookupEdition(curation.collectionId);
      return { reference, editions: matchesCuratedEdition(curation, edition) ? [edition.album] : [] };
    }
    return { reference, editions: await this.catalog.searchEditions(reference.artistName, reference.albumName) };
  }

  async begin(userId: string, source: AlbumSource, collectionId: string, requestKey: string) {
    const fingerprint = JSON.stringify({ algorithmVersion, source, collectionId });
    const replay = async () => {
      const previous = await prisma.recommendationSession.findUnique({ where: { userId_requestKey: { userId, requestKey } } });
      if (!previous || previous.requestFingerprint !== fingerprint) throw new DiscoveryConflict("Chave já utilizada em outro pedido.");
      if (previous.status === "GENERATING" && previous.updatedAt.getTime() < Date.now() - 5 * 60_000) {
        const changed = await prisma.recommendationSession.updateMany({ where: { id: previous.id, status: "GENERATING", updatedAt: previous.updatedAt }, data: { status: "FAILED" } });
        if (changed.count === 0) {
          const session = await new RecommendationService().getSession(previous.id, userId);
          if (session) return session;
        }
        throw new DiscoveryConflict("A tentativa anterior foi interrompida. Inicie outra tentativa.", 409, "GENERATION_FAILED");
      }
      if (previous.status !== "ACTIVE") throw new DiscoveryConflict(previous.status === "GENERATING" ? "A jornada está sendo preparada. Tente novamente em instantes." : "Não consegui preparar a jornada. Inicie outra tentativa.", 409,
        previous.status === "GENERATING" ? "GENERATION_PENDING" : "GENERATION_FAILED");
      const session = await new RecommendationService().getSession(previous.id, userId);
      if (!session) throw new DiscoveryConflict("Jornada não encontrada.", 404);
      return session;
    };
    if (await prisma.recommendationSession.findUnique({ where: { userId_requestKey: { userId, requestKey } } })) return replay();
    const reference = await this.source(userId, source);
    const curation = source.kind === "curated" ? findCuratedAlbum(source.id) : null;
    if (curation && collectionId !== curation.collectionId) throw new DiscoveryConflict("Escolha a edição publicada nesta curadoria.", 400);
    let reservation;
    try {
      reservation = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        if (await tx.recommendationSession.findFirst({ where: { userId, status: "GENERATING", updatedAt: { gte: new Date(Date.now() - 5 * 60_000) } }, select: { id: true } })) {
          throw new DiscoveryConflict("Há uma busca em andamento. Aguarde antes de iniciar o álbum.", 409, "GENERATION_PENDING");
        }
        return tx.recommendationSession.create({ data: { userId, mode: "BALANCED", context: "GENERAL", algorithmVersion,
          profilePeriod: "all:55:50", status: "GENERATING", requestKey, requestFingerprint: fingerprint, currentRank: 1, lastOpenedAt: new Date() } });
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") return replay();
      throw error;
    }
    try {
      const chosen = curation ? null : (await this.catalog.searchEditions(reference.artistName, reference.albumName)).find((row) => row.collectionId === collectionId);
      if (!curation && !chosen) throw new DiscoveryConflict("Essa edição não está entre os resultados deste álbum. Consulte as edições novamente.", 400);
      const edition = await this.catalog.lookupEdition(collectionId);
      if (curation && !matchesCuratedEdition(curation, edition)) throw new DiscoveryConflict("A edição publicada desta curadoria está indisponível no catálogo. Tente novamente mais tarde.", 422);
      if (!edition || (chosen && (edition.album.collectionId !== collectionId || edition.tracks.length !== edition.album.trackCount || edition.album.storefront !== chosen.storefront || !sameRecordingText(edition.album.artistName, reference.artistName)
        || !sameRecordingText(edition.album.albumName, reference.albumName) || edition.album.trackCount !== chosen.trackCount
        || (edition.album.explicitness ?? null) !== (chosen.explicitness ?? null)))) {
        throw new DiscoveryConflict("Não consegui confirmar a edição e a ordem completa das faixas. Escolha outro álbum.", 422);
      }
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "RecommendationSession" WHERE "id" = ${reservation.id} AND "userId" = ${userId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        const current = await tx.recommendationSession.findFirst({ where: { id: reservation.id, userId, status: "GENERATING",
          updatedAt: { gte: new Date(Date.now() - 5 * 60_000) } } });
        if (!current) throw new DiscoveryConflict("Esta tentativa foi encerrada. Inicie outra jornada.");
        await tx.recommendationSession.update({ where: { id: reservation.id }, data: { status: "ACTIVE",
          discoveryContext: { version: 1, intent: "ALBUM", journey: { action: "ALBUM", album: edition.album, ...(curation ? { curation: curation.credit } : {}) } },
          items: { create: edition.tracks.map((track, index) => ({ artistName: track.artistName, trackName: track.trackName,
            albumName: edition.album.albumName, score: 0, rank: index + 1,
            reason: `Disco ${track.disc}, faixa ${track.number} de “${edition.album.albumName}”, na edição que você escolheu.`,
            coverUrl: edition.album.artworkUrl, previewUrl: track.previewUrl, appleMusicUrl: track.sourceUrl ?? edition.album.sourceUrl,
            scoreComponents: { albumEdition: { ...edition.album, trackId: track.trackId, disc: track.disc, number: track.number },
              ...(curation ? { recordingCue: curatedRecordingCue(curation, track) } : {}),
              catalogFacts: { durationMs: track.durationMs, fetchedAt: edition.album.fetchedAt },
              previewIdentity: { source: "itunes", sourceId: track.trackId, artistName: track.artistName, trackName: track.trackName, match: "compatible-text-v1" } } })) },
        } });
      });
      const session = await new RecommendationService().getSession(reservation.id, userId);
      if (!session) throw new DiscoveryConflict("Jornada não encontrada.", 404);
      return session;
    } catch (error) {
      await prisma.recommendationSession.updateMany({ where: { id: reservation.id, status: "GENERATING" }, data: { status: "FAILED" } }).catch(() => undefined);
      throw new DiscoveryConflict(error instanceof DiscoveryConflict ? error.message : "O catálogo está indisponível. Tente preparar a jornada novamente.",
        error instanceof DiscoveryConflict ? error.status : 503, "GENERATION_FAILED");
    }
  }
}
