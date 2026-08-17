import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { LastFmHistoryProvider } from "@/modules/listening/infrastructure/lastfm-adapter";
import { ListeningSyncService } from "@/modules/listening/application/sync-service";
import { z } from "zod";

import { verifyCronAuth } from "@/lib/security/cron-auth";

const syncRequestSchema = z.object({
  username: z.string().min(1, "Last.fm username is required"),
});

export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ connection: null, latestRun: null });
  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId: user.id, provider: "lastfm" } },
    select: { username: true, status: true, lastSyncedAt: true, syncRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  if (!connection) return NextResponse.json({ connection: null, latestRun: null });
  const { syncRuns, ...details } = connection;
  return NextResponse.json({ connection: details, latestRun: syncRuns[0] ?? null });
}

export async function POST(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = syncRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { username } = parsed.data;

    let user = await prisma.user.findFirst();

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `${username.toLowerCase()}@spotstats.local`,
          displayName: username,
          timezone: "America/Sao_Paulo",
        },
      });
    }

    await prisma.providerConnection.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: "lastfm",
        },
      },
      update: {
        username,
      },
      create: {
        userId: user.id,
        provider: "lastfm",
        username,
        status: "ACTIVE",
      },
    });

    const provider = new LastFmHistoryProvider();
    const syncService = new ListeningSyncService(provider);
    const result = await syncService.runIncrementalSync(user.id, "lastfm");

    return NextResponse.json({
      success: true,
      user: { id: user.id, username },
      sync: result,
    });
  } catch (error: any) {
    console.error("Sync API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to synchronize history" },
      { status: 500 }
    );
  }
}
