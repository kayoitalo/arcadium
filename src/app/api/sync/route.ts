import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { LastFmHistoryProvider } from "@/modules/listening/infrastructure/lastfm-adapter";
import { ListeningSyncService } from "@/modules/listening/application/sync-service";
import { z } from "zod";

import { verifyCronAuth } from "@/lib/security/cron-auth";

const syncRequestSchema = z.object({
  username: z.string().min(1, "Last.fm username is required"),
  userId: z.string().optional(),
});

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

    const { username, userId: inputUserId } = parsed.data;

    // Find or create default user for MVP single-user setup
    let user = inputUserId
      ? await prisma.user.findUnique({ where: { id: inputUserId } })
      : await prisma.user.findFirst();

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `${username.toLowerCase()}@spotstats.local`,
          displayName: username,
          timezone: "America/Sao_Paulo",
        },
      });
    }

    // Upsert ProviderConnection
    await prisma.providerConnection.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: "lastfm",
        },
      },
      update: {
        username,
        status: "ACTIVE",
      },
      create: {
        userId: user.id,
        provider: "lastfm",
        username,
        status: "ACTIVE",
      },
    });

    // Run sync service
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
