import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search") || "";

    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ events: [], totalPages: 0, totalItems: 0, page });
    }

    const where: any = { userId: user.id };
    if (search.trim()) {
      where.OR = [
        { rawArtistName: { contains: search, mode: "insensitive" } },
        { rawTrackName: { contains: search, mode: "insensitive" } },
        { rawAlbumName: { contains: search, mode: "insensitive" } },
      ];
    }

    const totalItems = await prisma.listeningEvent.count({ where });
    const totalPages = Math.ceil(totalItems / limit);

    const events = await prisma.listeningEvent.findMany({
      where,
      orderBy: { playedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        playedAt: true,
        rawArtistName: true,
        rawTrackName: true,
        rawAlbumName: true,
        provider: true,
      },
    });

    return NextResponse.json({
      events,
      page,
      totalPages,
      totalItems,
    });
  } catch (error: any) {
    console.error("History API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch history" }, { status: 500 });
  }
}
