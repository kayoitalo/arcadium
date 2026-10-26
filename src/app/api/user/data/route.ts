import { authorizeApi } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) {
    if (access.response.status === 401 && (request.headers.get("sec-fetch-mode") === "navigate" || request.headers.get("accept")?.includes("text/html"))) {
      const response = NextResponse.redirect(new URL("/login?expired=1", request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    return access.response;
  }
  const userId = access.userId;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        connections: true,
        listeningEvents: {
          take: 5000,
          orderBy: { playedAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "No user account found." }, { status: 404 });
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
      connections: user.connections.map((c) => ({
        provider: c.provider,
        username: c.username,
        status: c.status,
        lastSyncedAt: c.lastSyncedAt,
      })),
      totalListeningEvents: user.listeningEvents.length,
      listeningEvents: user.listeningEvents.map((e) => ({
        playedAt: e.playedAt,
        artistName: e.rawArtistName,
        trackName: e.rawTrackName,
        albumName: e.rawAlbumName,
        provider: e.provider,
      })),
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="arcadium_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/user/data error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to export user data" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const userId = access.userId;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "No user account found to purge." }, { status: 404 });
    }

    const deletedEvents = await prisma.$transaction(async (tx) => {
      // Sync acquires its lock by updating these same rows. Lock them until
      // all deletes commit, or refuse the purge if a sync already owns them.
      const connections = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status" FROM "ProviderConnection" WHERE "userId" = ${userId} ORDER BY "id" FOR UPDATE
      `;
      if (connections.some((connection) => connection.status === "SYNCING")) return null;
      const events = await tx.listeningEvent.deleteMany({ where: { userId } });
      await tx.syncRun.deleteMany({ where: { connection: { userId } } });
      await tx.providerConnection.deleteMany({ where: { userId } });
      return events;
    });
    if (!deletedEvents) return NextResponse.json({ error: "Há uma sincronização em andamento. Aguarde terminar antes de apagar o histórico." }, { status: 409 });

    return NextResponse.json({
      success: true,
      message: `Successfully purged ${deletedEvents.count} listening events and reset provider connections.`,
    });
  } catch (error: any) {
    console.error("DELETE /api/user/data error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to purge user data" },
      { status: 500 }
    );
  }
}
