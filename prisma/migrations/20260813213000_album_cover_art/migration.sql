ALTER TABLE "Album"
ADD COLUMN "coverUrl" TEXT,
ADD COLUMN "coverSource" TEXT,
ADD COLUMN "coverFetchedAt" TIMESTAMP(3);

CREATE INDEX "Album_coverFetchedAt_idx" ON "Album"("coverFetchedAt");
