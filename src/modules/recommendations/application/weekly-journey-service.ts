import { randomUUID } from "node:crypto";
import type { Prisma, WeeklyJourney, WeeklyJourneyEntry } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeText } from "@/modules/listening/domain/normalization";
import { DiscoveryConflict } from "../domain/feedback";
import { weeklyEntrySchema, weeklyWindow, WEEKLY_VERSION, type WeeklyView } from "../domain/weekly-journey";
import { albumSessionItems } from "./album-session-items";
import { WeeklySelector } from "./weekly-selector";
import { addWeeklyRecordingCredits } from "./weekly-recording-evidence";
import { readWeeklyNarrative } from "../domain/weekly-narrative";
import { CARTOLA_1976, curatedRecordingCue, matchesCuratedEdition } from "../domain/curated-albums";

const includeEntries = { entries: { orderBy: { position: "asc" as const } } };
const leaseMs = 75_000;
const retryMs = 3 * 60_000;

type StoredWeek = WeeklyJourney & { entries: WeeklyJourneyEntry[] };

export function weeklyView(row: StoredWeek | null): WeeklyView | null {
  if (!row) return null;
  const status = row.status === "READY" || row.status === "EMPTY" || row.status === "PREPARING" ? row.status : "FAILED";
  const entries = row.entries.flatMap((item) => {
    const parsed = weeklyEntrySchema.safeParse(item.snapshot);
    if (!parsed.success) return [];
    const value = parsed.data;
    return [{ id: item.id, position: item.position, role: value.role, kind: value.kind, artistName: value.artistName, style: value.style,
      reason: value.reason, reference: value.reference, sessionId: item.sessionId, exposedAt: item.exposedAt?.toISOString() ?? null, trackCount: value.tracks.length,
      ...(value.kind === "ALBUM" ? { album: value.album } : { tracks: value.tracks.map((track) => track.trackName), trackSource: value.trackSource }) }];
  });
  return { id: row.id, weekKey: row.weekKey, timezone: row.timezone, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(),
    status, personalized: row.personalized, limited: entries.length < 3, entries,
    ...(row.narrativeStatus ? { narrativeStatus: row.narrativeStatus === "PREPARING" && Date.now() - row.updatedAt.getTime() > leaseMs ? "FAILED" : row.narrativeStatus } : {}),
    ...(row.narrativeStatus === "READY" ? { narrative: readWeeklyNarrative(row.narrative, entries.map((item) => item.id)) } : {}),
  };
}

export class WeeklyJourneyService {
  constructor(private selector: Pick<WeeklySelector, "select"> = new WeeklySelector(),
    private enrich = addWeeklyRecordingCredits, private now = () => new Date()) {}

  async current(userId: string) {
    const now = this.now();
    const current = await prisma.weeklyJourney.findFirst({ where: { userId, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: "desc" }, include: includeEntries });
    const previous = current?.status === "READY" ? null : await prisma.weeklyJourney.findFirst({
      where: { userId, status: "READY", endsAt: { lte: now } }, orderBy: { startsAt: "desc" }, include: includeEntries,
    });
    return { current: weeklyView(current), previous: weeklyView(previous),
      canPrepare: !current || (["FAILED", "PREPARING"].includes(current.status) && (!current.retryAt || current.retryAt <= now)) };
  }

  async byId(userId: string, id: string) {
    const row = await prisma.weeklyJourney.findFirst({ where: { id, userId }, include: includeEntries });
    if (!row) throw new DiscoveryConflict("Jornada semanal não encontrada.", 404);
    return weeklyView(row);
  }

  async history(userId: string, before?: string) {
    const cursor = before ? await prisma.weeklyJourney.findFirst({ where: { id: before, userId }, select: { startsAt: true } }) : null;
    if (before && !cursor) throw new DiscoveryConflict("Página de jornadas indisponível.", 404);
    const rows = await prisma.weeklyJourney.findMany({ where: { userId, status: "READY", ...(cursor ? { startsAt: { lt: cursor.startsAt } } : {}) },
      orderBy: { startsAt: "desc" }, take: 7, include: includeEntries });
    return { weeks: rows.slice(0, 6).map(weeklyView), nextCursor: rows.length > 6 ? rows[5].id : null };
  }

  async prepare(userId: string) {
    const now = this.now();
    const token = randomUUID();
    const reserved = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const account = await tx.user.findUnique({ where: { id: userId }, select: { timezone: true } });
      if (!account) throw new DiscoveryConflict("Conta indisponível.", 404);
      const window = weeklyWindow(now, account.timezone);
      const current = await tx.weeklyJourney.findFirst({ where: { userId, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: "desc" } });
      const existing = current ?? await tx.weeklyJourney.findUnique({ where: { userId_weekKey: { userId, weekKey: window.weekKey } } });
      if (existing && (existing.status === "READY" || existing.status === "EMPTY" || (existing.retryAt && existing.retryAt > now))) return null;
      const latest = current ? null : await tx.weeklyJourney.findFirst({ where: { userId }, orderBy: { startsAt: "desc" }, select: { endsAt: true } });
      const startsAt = latest && latest.endsAt > window.startsAt ? latest.endsAt : window.startsAt;
      const reservation = { status: "PREPARING", lease: token, retryAt: new Date(now.getTime() + leaseMs) };
      return existing
        ? tx.weeklyJourney.update({ where: { id: existing.id }, data: reservation, select: { id: true } })
        : tx.weeklyJourney.create({ data: { ...window, startsAt, ...reservation, userId, selectorVersion: WEEKLY_VERSION }, select: { id: true } });
    });
    if (!reserved) return this.current(userId);

    try {
      const earlier = await prisma.weeklyJourney.findMany({ where: { userId, id: { not: reserved.id }, status: "READY" },
        orderBy: { startsAt: "desc" }, take: 8, include: includeEntries });
      const remembered = earlier.flatMap((week) => week.entries.map((entry) => ({ ...entry, weekStartsAt: week.startsAt })));
      const deadline = Date.now() + 35_000;
      const selection = await this.selector.select(userId, remembered, deadline);
      const entries = await this.enrich(selection.entries, deadline);
      const transient = !entries.length && (selection.diagnostics.failures > 0 || selection.diagnostics.deadlineStops > 0);
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        const current = await tx.weeklyJourney.updateMany({ where: { id: reserved.id, userId, status: "PREPARING", lease: token,
          retryAt: { gt: this.now() } }, data: {
          status: entries.length ? "READY" : transient ? "FAILED" : "EMPTY", lease: null,
          retryAt: transient ? new Date(this.now().getTime() + retryMs) : null,
          diagnostics: { ...selection.diagnostics, elapsedMs: Date.now() - (deadline - 35_000),
            recordingCredits: entries.reduce((count, { entry }) => count + (entry.kind === "ALBUM" ? entry.tracks.filter((track) => track.credit).length : 0), 0) },
          personalized: selection.personalized,
        } });
        if (current.count && entries.length) await tx.weeklyJourneyEntry.createMany({ data: entries.map(({ entry, albumKey }, index) => ({
          journeyId: reserved.id, position: index + 1, artistKey: normalizeText(entry.artistName), albumKey,
          snapshot: entry as Prisma.InputJsonValue,
        })) });
      });
    } catch {
      await prisma.weeklyJourney.updateMany({ where: { id: reserved.id, userId, status: "PREPARING", lease: token },
        data: { status: "FAILED", lease: null, retryAt: new Date(this.now().getTime() + retryMs) } });
    }
    return this.current(userId);
  }

  async expose(userId: string, entryId: string) {
    await prisma.weeklyJourneyEntry.updateMany({ where: { id: entryId, exposedAt: null, journey: { userId, status: "READY" } },
      data: { exposedAt: this.now() } });
    return { success: true };
  }

  async start(userId: string, entryId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const row = await tx.weeklyJourneyEntry.findFirst({ where: { id: entryId, journey: { userId, status: "READY" } }, include: {
        session: { select: { userId: true, status: true } },
      } });
      if (!row) throw new DiscoveryConflict("Porta da semana não encontrada.", 404);
      if (row.sessionId && row.session?.userId === userId && row.session.status === "ACTIVE") return { sessionId: row.sessionId };
      const saved = weeklyEntrySchema.safeParse(row.snapshot);
      if (!saved.success) throw new DiscoveryConflict("Não consegui recuperar esta edição da semana.", 422);
      const entry = saved.data;
      const ordered = entry.kind === "ALBUM";
      const knownCuration = ordered && matchesCuratedEdition(CARTOLA_1976, { album: entry.album, tracks: entry.tracks });
      const weekly = { journeyId: row.journeyId, entryId: row.id, kind: entry.kind };
      const session = await tx.recommendationSession.create({ data: {
        userId, mode: "BALANCED", context: "GENERAL", profilePeriod: "30d:55:50", algorithmVersion: "weekly-v1",
        status: "ACTIVE", currentRank: 1, lastOpenedAt: this.now(),
        discoveryContext: { version: 1, intent: ordered ? "ALBUM" : "DISCOVER",
          journey: { action: ordered ? "ALBUM" : "ENTRY", ...(ordered ? { album: entry.album } : {}), weekly } },
        items: { create: ordered ? albumSessionItems({ album: entry.album, tracks: entry.tracks },
          (track, index) => (knownCuration ? curatedRecordingCue(CARTOLA_1976, track) : null) ?? entry.tracks[index].credit ?? null)
          : entry.tracks.map((track, index) => ({ artistName: track.artistName, trackName: track.trackName,
            rank: index + 1, score: 0, reason: entry.reason })) },
      }, select: { id: true } });
      await tx.weeklyJourneyEntry.update({ where: { id: row.id }, data: { sessionId: session.id } });
      return { sessionId: session.id };
    });
  }
}
