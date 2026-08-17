ALTER TABLE "Album"
ADD COLUMN "releaseGroupMbid" TEXT,
ADD COLUMN "releaseGroupFetchedAt" TIMESTAMP(3),
ADD COLUMN "coverEntityType" TEXT,
ADD COLUMN "coverMbid" TEXT;

CREATE INDEX "Album_releaseGroupMbid_idx" ON "Album"("releaseGroupMbid");
CREATE INDEX "Album_releaseGroupFetchedAt_idx" ON "Album"("releaseGroupFetchedAt");
