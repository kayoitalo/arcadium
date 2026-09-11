-- Catálogo da Apple: vínculo do álbum, gênero de reserva, prévias e links.
-- Tudo opcional: o código anterior continua funcionando com o banco migrado.

-- AlterTable
ALTER TABLE "Album" ADD COLUMN "itunesCollectionId" TEXT,
ADD COLUMN "appleMusicUrl" TEXT,
ADD COLUMN "itunesGenre" TEXT,
ADD COLUMN "itunesFetchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Track" ADD COLUMN "previewUrl" TEXT,
ADD COLUMN "itunesTrackId" TEXT,
ADD COLUMN "appleMusicUrl" TEXT;

-- AlterTable
ALTER TABLE "RecommendationItem" ADD COLUMN "appleMusicUrl" TEXT;

-- CreateIndex
CREATE INDEX "Album_itunesFetchedAt_idx" ON "Album"("itunesFetchedAt");
