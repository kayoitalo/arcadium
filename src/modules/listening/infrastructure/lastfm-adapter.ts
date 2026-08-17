import { z } from "zod";
import {
  FetchListensInput,
  ListeningHistoryProvider,
  ListenPage,
} from "../domain/listening-provider.interface";

const lastfmTrackSchema = z.object({
  artist: z.object({
    "#text": z.string(),
    mbid: z.string().optional(),
  }),
  name: z.string(),
  album: z
    .object({
      "#text": z.string(),
      mbid: z.string().optional(),
    })
    .optional(),
  mbid: z.string().optional(),
  date: z
    .object({
      uts: z.string(),
      "#text": z.string(),
    })
    .optional(),
  "@attr": z
    .object({
      nowplaying: z.string().optional(),
    })
    .optional(),
});

const lastfmRecentTracksResponseSchema = z.object({
  recenttracks: z.object({
    track: z.array(lastfmTrackSchema).or(lastfmTrackSchema),
    "@attr": z.object({
      user: z.string(),
      page: z.string(),
      perPage: z.string(),
      totalPages: z.string(),
      total: z.string(),
    }),
  }),
});

export class LastFmHistoryProvider implements ListeningHistoryProvider {
  private apiKey: string;
  private userAgent: string;
  private baseUrl = "https://ws.audioscrobbler.com/2.0/";

  constructor(apiKey?: string, userAgent?: string) {
    this.apiKey = apiKey || process.env.LASTFM_API_KEY || "";
    this.userAgent = userAgent || process.env.LASTFM_USER_AGENT || "SpotStats/0.1.0";
  }

  async fetchListens(input: FetchListensInput): Promise<ListenPage> {
    if (!this.apiKey) {
      throw new Error("Last.fm API key is missing. Set LASTFM_API_KEY in environment.");
    }

    const params = new URLSearchParams({
      method: "user.getrecenttracks",
      user: input.username,
      api_key: this.apiKey,
      format: "json",
      page: (input.page || 1).toString(),
      limit: (input.limit || 200).toString(),
    });

    if (input.from) {
      params.append("from", input.from.toString());
    }
    if (input.to) {
      params.append("to", input.to.toString());
    }

    const url = `${this.baseUrl}?${params.toString()}`;
    const maxRetries = 4;
    let attempt = 0;
    let response: Response | null = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        response = await fetch(url, {
          headers: {
            "User-Agent": this.userAgent,
          },
        });

        if (response.ok) {
          break;
        }

        if (response.status >= 500 || response.status === 429) {
          const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.warn(
            `⚠️ Last.fm HTTP ${response.status} on attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(backoffMs)}ms...`
          );
          await new Promise((res) => setTimeout(res, backoffMs));
          continue;
        }

        const errorText = await response.text();
        throw new Error(`Last.fm API error (${response.status}): ${errorText}`);
      } catch (err: any) {
        if (attempt >= maxRetries) {
          throw err;
        }
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Fetch network error on attempt ${attempt}/${maxRetries}: ${err.message}. Retrying...`);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }

    if (!response || !response.ok) {
      throw new Error(`Failed to fetch from Last.fm after ${maxRetries} attempts.`);
    }

    const rawData = await response.json();
    const parsed = lastfmRecentTracksResponseSchema.safeParse(rawData);

    if (!parsed.success) {
      console.error("Last.fm response parsing error:", parsed.error);
      throw new Error("Invalid response payload received from Last.fm API");
    }

    const recentTracks = parsed.data.recenttracks;
    const rawTrackList = Array.isArray(recentTracks.track)
      ? recentTracks.track
      : [recentTracks.track];

    const items = rawTrackList
      .filter((t) => !t["@attr"]?.nowplaying && t.date?.uts)
      .map((t) => ({
        rawArtistName: t.artist["#text"],
        rawTrackName: t.name,
        rawAlbumName: t.album?.["#text"] || undefined,
        playedAtUtcSeconds: parseInt(t.date!.uts, 10),
        mbid: t.mbid || t.artist.mbid || undefined,
      }));

    const attr = recentTracks["@attr"];
    return {
      items,
      page: parseInt(attr.page, 10),
      totalPages: parseInt(attr.totalPages, 10),
      totalItems: parseInt(attr.total, 10),
    };
  }
}
