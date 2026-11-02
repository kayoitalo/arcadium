CREATE TABLE "EditorialMemory" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "key" TEXT NOT NULL, "headline" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3), "dismissed" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EditorialMemory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EditorialMemory_userId_key_key" ON "EditorialMemory"("userId", "key");
ALTER TABLE "EditorialMemory" ADD CONSTRAINT "EditorialMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
