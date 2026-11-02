CREATE TABLE "CollectionEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "sourceItemId" TEXT NOT NULL,
  "artistName" TEXT NOT NULL,
  "trackName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CollectionEntry_userId_key_key" ON "CollectionEntry"("userId", "key");
CREATE INDEX "CollectionEntry_userId_createdAt_idx" ON "CollectionEntry"("userId", "createdAt" DESC);
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
