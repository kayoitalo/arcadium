import { SpotifyService } from "@/modules/spotify/application/spotify-service";
import { NextResponse } from "next/server";

const spotifyService = new SpotifyService();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tracks, accessToken, spotifyUserId, customTitle } = body || {};

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide a non-empty 'tracks' array." },
        { status: 400 }
      );
    }

    const exportResult = await spotifyService.exportTracks(
      tracks,
      accessToken,
      spotifyUserId,
      customTitle
    );

    return NextResponse.json({
      success: true,
      data: exportResult,
    });
  } catch (error: any) {
    console.error("POST /api/spotify/export error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process Spotify export" },
      { status: 500 }
    );
  }
}
