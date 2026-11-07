import { prisma } from "@/lib/db/prisma";
import { sameRecordingText } from "@/lib/music/recording-match";
import { ItunesCatalogAdapter } from "@/modules/enrichment/infrastructure/itunes-catalog-adapter";
import { filterGenreTags } from "@/modules/enrichment/domain/genre-tags";
import { normalizeText } from "@/modules/listening/domain/normalization";
import { trackFeedbackKey } from "../domain/feedback";
import { representativeArtists, type UserProfile } from "../domain/taste-profile";
import { lastFmSourceURL } from "../domain/cultural-context";
import { weeklyAlbumKey, weeklyEntrySchema, weeklyFamily, WEEKLY_ROLES, type WeeklyEntry, type WeeklyRole } from "../domain/weekly-journey";
import { LastFmSimilarArtistProvider } from "../infrastructure/lastfm-similar-adapter";
import { RecommendationService } from "./recommendation-service";
import { familiarWeeklyAlbums, weeklyAlbumHistoryKeys } from "./weekly-album-history";

type Source = WeeklyEntry["reference"];
type Candidate = {
  artistName: string; role: WeeklyRole; style: string | null; seed?: string; source: Source;
  album?: { title: string; collectionId?: string | null; group?: string | null; release?: string | null };
  localTracks?: { artistName: string; trackName: string }[];
};
type Remembered = { artistKey: string; albumKey: string | null; snapshot: unknown; exposedAt: Date | null; sessionId: string | null; weekStartsAt: Date };
export type WeeklySelection = { personalized: boolean; entries: { entry: WeeklyEntry; albumKey: string | null; releaseId: string | null }[];
  diagnostics: { appleCalls: number; lastFmCalls: number; failures: number; deadlineStops: number } };
const titleKey = (artist: string, track: string) => normalizeText(artist) + "|" + normalizeText(track);
const stylesFrom = (tags: string | null) => filterGenreTags(tags?.split(",") ?? []).filter((tag) => weeklyFamily(tag));
const catalogSource: Source = { provider: "catalog", url: null };
const historySource: Source = { provider: "history", url: null };
const chartSource = (url: unknown): Source => ({ provider: "lastfm", url: lastFmSourceURL(url) });
const artistChart = (artist: string, page = "+tracks") => chartSource(`https://www.last.fm/music/${encodeURIComponent(artist)}/${page}`);

function reason(row: Candidate, title: string | null, style: string | null, personalized: boolean) {
  const subject = title ? `“${title.slice(0, 110)}”` : row.artistName.slice(0, 110);
  if (row.role === "NEAR") return title
    ? `${subject} abre outro caminho por ${row.artistName.slice(0, 110)}, que aparece nas tuas escutas ou respostas.`
    : `${subject} já aparece nas tuas escutas ou respostas. Separei outras faixas pra seguir por aqui.`;
  if (row.role === "BRIDGE") return `O Last.fm aproxima ${row.artistName.slice(0, 95)} de ${row.seed?.slice(0, 95)}. Aqui a porta abre para ${style}.`;
  if (!personalized) return `${subject} é uma porta do catálogo para ${style ?? "este recorte"}.`;
  return `${subject} abre uma porta para ${style}, fora dos estilos mais presentes no teu histórico identificado.`;
}

function eligibleStyle(role: WeeklyRole, style: string | null, known: Set<string>, used: Set<string>, seedFamily?: string | null) {
  const family = style && weeklyFamily(style);
  if (!family) return false;
  if (used.has(family)) return false;
  if (role === "BRIDGE") return Boolean(seedFamily && family !== seedFamily);
  return role !== "TERRITORY" || !known.has(family);
}

export class WeeklySelector {
  constructor(
    private catalog: Pick<ItunesCatalogAdapter, "searchEditions" | "lookupEdition"> = new ItunesCatalogAdapter(),
    private lastFm: Pick<LastFmSimilarArtistProvider, "isConfigured" | "beginDiscoveryWindow" | "getDiagnostics" | "getSimilarArtists"
      | "getTopTracks" | "getWeeklyAlbums" | "getWeeklyArtists"> = new LastFmSimilarArtistProvider(),
  ) {}

  async select(userId: string, remembered: Remembered[], deadline: number): Promise<WeeklySelection> {
    const profile = await new RecommendationService().buildUserProfile(userId, "30d");
    const recentSeeds = representativeArtists(profile, 3).map((seed) => seed.name);
    const seedNames = [...new Set([...(profile.likedTracks ?? []).slice(0, 2).map((track) => track.artistName), ...recentSeeds])].slice(0, 3);
    const artistStyles = new Map<string, string[]>();
    for (const artist of profile.longTerm?.artists ?? []) if (artist.genres?.length) artistStyles.set(normalizeText(artist.name), artist.genres);
    const knownFamilies = new Set(profile.topGenres.flatMap((genre) => weeklyFamily(genre) ?? []));
    const personalized = profile.totalPlays > 0 || seedNames.length > 0;
    const personalizedTerritory = personalized && knownFamilies.size > 0;
    const provider = this.lastFm.isConfigured();
    const counters = { appleCalls: 0, failures: 0, deadlineStops: 0 };
    this.lastFm.beginDiscoveryWindow(Math.min(8_000, Math.max(0, deadline - Date.now())));
    const anchor = seedNames[0];
    const related = provider && anchor ? await this.lastFm.getSimilarArtists(anchor, 5) : [];
    const names = [...new Set([...seedNames, ...related.map((row) => row.name)])];
    const artistSelect = { id: true, name: true, tags: true, tracks: { take: 5, orderBy: { name: "asc" as const }, select: { name: true } },
      albums: { where: { OR: [{ itunesCollectionId: { not: null } }, { primaryType: "Album" }] }, take: 5,
        orderBy: [{ itunesCollectionId: { sort: "asc" as const, nulls: "last" as const } }, { name: "asc" as const }],
        select: { name: true, itunesGenre: true, itunesCollectionId: true, mbid: true, releaseGroupMbid: true } } };
    const [named, broader] = await Promise.all([
      prisma.artist.findMany({ where: { name: { in: names, mode: "insensitive" } }, take: 30, select: artistSelect }),
      prisma.artist.findMany({ where: { metadataStatus: "RESOLVED", tags: { not: null } }, orderBy: { name: "asc" }, take: 72, select: artistSelect }),
    ]);
    const local = new Map<string, typeof named[number]>();
    const collisions = new Set<string>();
    for (const row of [...named, ...broader]) {
      const key = normalizeText(row.name);
      if (local.has(key) && local.get(key)?.id !== row.id) collisions.add(key);
      else local.set(key, row);
    }
    for (const [key, row] of local) if (!collisions.has(key) && stylesFrom(row.tags).length) artistStyles.set(key, stylesFrom(row.tags));
    const counts = local.size ? await prisma.artist.groupBy({ by: ["normalizedName"], where: { normalizedName: { in: [...local.keys()] } }, _count: { id: true } }) : [];
    for (const row of counts) if (row._count.id > 1) {
      collisions.add(row.normalizedName); artistStyles.delete(row.normalizedName);
    }
    const referenceFamily = anchor ? artistStyles.get(normalizeText(anchor))?.map(weeklyFamily).find(Boolean) : null;
    const heard = new Set((profile.longTerm?.tracks ?? []).map((track) => titleKey(track.artistName, track.trackName)));
    const knownFeedback = new Set([...profile.knownTrackKeys].map(normalizeText));
    const knownTrack = (artist: string, track: string) => heard.has(titleKey(artist, track)) || knownFeedback.has(titleKey(artist, track));
    const unseenTrack = (artist: string, track: string) => !knownTrack(artist, track) && profile.feedbackMap?.get(trackFeedbackKey(artist, track)) !== "DISLIKED";

    const presented = new Set<string>();
    const recentArtists = new Set<string>();
    const savedUnopened = new Set<string>();
    for (const prior of remembered) {
      if (!prior.exposedAt && !prior.sessionId) { savedUnopened.add(prior.artistKey); continue; }
      if (Date.now() - prior.weekStartsAt.getTime() < 14 * 86_400_000) recentArtists.add(prior.artistKey);
      if (prior.albumKey) presented.add(prior.albumKey);
      const parsed = weeklyEntrySchema.safeParse(prior.snapshot);
      if (parsed.success && parsed.data.kind === "ALBUM") {
        presented.add(weeklyAlbumKey(parsed.data.artistName, parsed.data.album.albumName));
        presented.add(`apple:${parsed.data.album.storefront}:${parsed.data.album.collectionId}`);
      }
    }
    const candidates: Candidate[] = [];
    const pushArtist = (name: string, role: WeeklyRole, seed: string | undefined, source: Source, tag?: string) => {
      const key = normalizeText(name);
      if (!key || collisions.has(key)) return;
      const row = local.get(key);
      const style = tag ?? artistStyles.get(key)?.[0] ?? null;
      const common = { artistName: row?.name ?? name, role, seed, style, source };
      for (const album of row?.albums ?? []) candidates.push({ ...common, style: album.itunesGenre ?? style,
        album: { title: album.name, collectionId: album.itunesCollectionId, group: album.releaseGroupMbid, release: album.mbid } });
      candidates.push({ ...common, localTracks: row?.tracks.map((track) => ({ artistName: row.name, trackName: track.name })) });
    };
    for (const name of seedNames) pushArtist(name, "NEAR", name, historySource);
    for (const neighbor of related) if (anchor && normalizeText(neighbor.name) !== normalizeText(anchor)) {
      pushArtist(neighbor.name, "BRIDGE", anchor, artistChart(anchor, "+similar"));
    }
    const outside = [...local.values()].filter((row) => !profile.knownArtistNames.has(row.name.toLowerCase()) &&
      !recentArtists.has(normalizeText(row.name)) && !collisions.has(normalizeText(row.name)))
      .flatMap((row) => stylesFrom(row.tags).filter((tag) => !knownFamilies.has(weeklyFamily(tag)!)).slice(0, 1).map((tag) => ({ row, tag })));
    const targetTag = outside[0]?.tag ?? ["samba", "jazz", "dub", "folk", "electronic"].find((tag) => !knownFamilies.has(weeklyFamily(tag)!));
    for (const { row, tag } of outside.slice(0, 24)) pushArtist(row.name, "TERRITORY", undefined, catalogSource, tag);

    if (provider && Date.now() < deadline) {
      const neighbor = related.find((row) => normalizeText(row.name) !== normalizeText(anchor ?? ""));
      const [near, bridge, territory, territoryArtists] = await Promise.all([
        anchor ? this.lastFm.getWeeklyAlbums("artist", anchor, 4) : [],
        neighbor ? this.lastFm.getWeeklyAlbums("artist", neighbor.name, 3) : [],
        targetTag ? this.lastFm.getWeeklyAlbums("tag", targetTag, 4) : [],
        targetTag && !outside.length ? this.lastFm.getWeeklyArtists(targetTag, 3) : [],
      ]);
      for (const [role, rows, expected] of [["NEAR", near, anchor], ["BRIDGE", bridge, neighbor?.name], ["TERRITORY", territory, undefined]] as const) {
        for (const row of rows) {
          if (expected && !sameRecordingText(expected, row.artist.name)) continue;
          if (!row.name.trim() || !row.artist.name.trim()) continue;
          candidates.push({ artistName: row.artist.name, role, seed: anchor, source: role === "BRIDGE" ? artistChart(anchor!, "+similar") : chartSource(row.url),
            style: role === "TERRITORY" ? targetTag ?? null : artistStyles.get(normalizeText(row.artist.name))?.[0] ?? null,
            album: { title: row.name, release: row.mbid } });
        }
      }
      for (const artist of territoryArtists) pushArtist(artist.name, "TERRITORY", undefined, chartSource(artist.url), targetTag);
    }

    const familiarAlbums = await familiarWeeklyAlbums(userId, candidates.flatMap((row) => row.album ? [row.artistName] : []));
    const entries: WeeklySelection["entries"] = [];
    const selectedArtists = new Set<string>(); const selectedFamilies = new Set<string>();
    const checked = new Set<string>();
    const queryApple = async <T>(task: () => Promise<T>): Promise<T | null> => {
      const remaining = deadline - Date.now();
      if (counters.appleCalls >= 7 || remaining <= 0) { counters.deadlineStops++; return null; }
      counters.appleCalls++;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([task(), new Promise<null>((resolve) => { timeout = setTimeout(() => { counters.deadlineStops++; resolve(null); }, remaining); })]); }
      catch { counters.failures++; return null; }
      finally { clearTimeout(timeout); }
    };
    for (const role of WEEKLY_ROLES) {
      const startingAppleCalls = counters.appleCalls;
      const pool = candidates.filter((row) => row.role === role && !recentArtists.has(normalizeText(row.artistName)))
        .sort((a, b) => Number(savedUnopened.has(normalizeText(a.artistName))) - Number(savedUnopened.has(normalizeText(b.artistName)))
          || Number(Boolean(b.album)) - Number(Boolean(a.album)) || Number(Boolean(b.album?.collectionId)) - Number(Boolean(a.album?.collectionId)));
      let albumAttempts = 0; let artistAttempts = 0;
      for (const row of pool) {
        const artistKey = normalizeText(row.artistName);
        if (selectedArtists.has(artistKey) || collisions.has(artistKey)) continue;
        if (role === "TERRITORY" && profile.knownArtistNames.has(row.artistName.toLowerCase())) continue;
        let result: WeeklySelection["entries"][number] | null = null;
        if (row.album && albumAttempts < 3 && counters.appleCalls - startingAppleCalls < 2) {
          const key = weeklyAlbumKey(row.artistName, row.album.title, row.album.group);
          const alias = weeklyAlbumKey(row.artistName, row.album.title);
          const historyKeys = weeklyAlbumHistoryKeys(row.artistName, row.album.title, row.album.group, row.album.collectionId);
          if (checked.has(key) || presented.has(key) || presented.has(alias) || historyKeys.some((value) => familiarAlbums.has(value))) continue;
          checked.add(key);
          if (/\b(?:greatest hits|best of|karaoke|tribute to)\b/i.test(row.album.title)) continue;
          albumAttempts++;
          const options = row.album.collectionId ? null : await queryApple(() => this.catalog.searchEditions(row.artistName, row.album!.title));
          const id = row.album.collectionId ?? (options?.length === 1 ? options[0].collectionId : undefined);
          if (!id || familiarAlbums.has(`collection:${id}`)) continue;
          const edition = await queryApple(() => this.catalog.lookupEdition(id));
          if (!edition || !sameRecordingText(edition.album.artistName, row.artistName) || !sameRecordingText(edition.album.albumName, row.album.title)) continue;
          if (presented.has(`apple:${edition.album.storefront}:${edition.album.collectionId}`)) continue;
          const style = edition.album.genre ?? null;
          if (!eligibleStyle(role, style, knownFamilies, selectedFamilies, referenceFamily)) continue;
          const familiar = edition.tracks.filter((track) => knownTrack(track.artistName, track.trackName)).length;
          if (familiar * 2 >= edition.tracks.length || edition.tracks.every((track) => profile.feedbackMap?.get(trackFeedbackKey(track.artistName, track.trackName)) === "DISLIKED")) continue;
          result = { albumKey: key, releaseId: row.album.release ?? null, entry: { kind: "ALBUM", role, artistName: edition.album.artistName,
            style, family: style && weeklyFamily(style), reason: reason(row, edition.album.albumName, style, personalizedTerritory), reference: row.source,
            album: edition.album, tracks: edition.tracks } };
        } else if (!row.album && artistAttempts < 3 && eligibleStyle(role, row.style, knownFamilies, selectedFamilies, referenceFamily)) {
          const key = `artist:${role}:${artistKey}`;
          if (checked.has(key)) continue;
          checked.add(key); artistAttempts++;
          const suitable = (track: { artistName: string; trackName: string }) =>
            sameRecordingText(track.artistName, row.artistName) && unseenTrack(track.artistName, track.trackName);
          const ranked = provider && Date.now() < deadline ? (await this.lastFm.getTopTracks(row.artistName, 8)).filter(suitable) : [];
          const source = ranked.length && row.role !== "BRIDGE" ? artistChart(row.artistName) : row.source;
          const unique = new Map((ranked.length ? ranked : (row.localTracks ?? []).filter(suitable))
            .map((track) => [titleKey(track.artistName, track.trackName), track]));
          const tracks = [...unique.values()].slice(0, 3);
          if (!tracks.length) continue;
          result = { albumKey: null, releaseId: null, entry: { kind: "ARTIST", role, artistName: row.artistName,
            style: row.style, family: row.style && weeklyFamily(row.style), reason: reason(row, null, row.style, personalizedTerritory), reference: source,
            tracks, trackSource: ranked.length ? "lastfm" : "catalog" } };
        }
        const validated = weeklyEntrySchema.safeParse(result?.entry);
        if (result && validated.success) {
          entries.push({ ...result, entry: validated.data });
          selectedArtists.add(artistKey); if (validated.data.family) selectedFamilies.add(validated.data.family);
          break;
        }
      }
    }
    const stats = this.lastFm.getDiagnostics();
    return { personalized, entries, diagnostics: { appleCalls: counters.appleCalls, lastFmCalls: stats.externalAttempts,
      failures: counters.failures + stats.failures, deadlineStops: counters.deadlineStops + stats.deadlineStops } };
  }
}
