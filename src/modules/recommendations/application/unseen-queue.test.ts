import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), lock: vi.fn(), session: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { RecommendationService } from "./recommendation-service";
import { SessionMemoryService } from "./session-memory-service";
import { scoreAndRank } from "../domain/scoring";
import { trackFeedbackKey } from "../domain/feedback";
import { ALGORITHM_VERSION, type RawCandidate } from "../domain/recommendation.types";
import type { UserProfile } from "../domain/taste-profile";
let profile: UserProfile;
let session: any;
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks();
  profile = { topArtistNames: ["Seed"], topGenres: [], knownArtistNames: new Set(), knownTrackKeys: new Set(), feedbackMap: new Map(), totalPlays: 10, uniqueArtists: 1 };
  const candidates: RawCandidate[] = [
    { artistName: "A Control", trackName: "Control", source: "similar_track", evidence: [{ kind: "track_similarity", source: "lastfm", seedArtist: "Seed", seedTrack: "Other", rank: 1 }] },
    { artistName: "Z Linked", trackName: "Linked", source: "similar_track", evidence: [{ kind: "track_similarity", source: "lastfm", seedArtist: "Seed", seedTrack: "Reference", rank: 1 }] },
  ];
  const pending = scoreAndRank(candidates, profile, "BALANCED").map((candidate, index) => ({ ...candidate, id: candidate.trackName,
    rank: index + 2, exposedAt: null, feedback: [], scoreComponents: { candidate, marker: "preserve", previewIdentity: { sourceId: "preview" } } }));
  session = { id: "session", userId: "owner", algorithmVersion: ALGORITHM_VERSION, mode: "BALANCED", profilePeriod: "30d:55:50", currentRank: 2,
    items: [{ id: "voted", artistName: "Seed", trackName: "Reference", rank: 1, exposedAt: new Date(), feedback: [{ type: "LIKED" }], reason: "original shown reason" }, ...pending,
      { id: "already-seen", artistName: "Seen", trackName: "Seen", rank: 4, exposedAt: new Date(), feedback: [], reason: "original future shown reason" }] };
  mocks.session.mockResolvedValue(session);
  mocks.update.mockImplementation(async ({ where, data }) => Object.assign(session.items.find((item: any) => item.id === where.id), data));
  mocks.transaction.mockImplementation((task) => task({ $queryRaw: mocks.lock,
    recommendationSession: { findFirst: mocks.session }, recommendationItem: { update: mocks.update } }));
});
describe("evidenced corrections to unseen items", () => {
  it("reranks only unseen slots, preserving shown identities, reasons and preview evidence", async () => {
    const service = new RecommendationService();
    profile.feedbackMap.set(trackFeedbackKey("Seed", "Reference"), "LIKED");
    const build = vi.spyOn(service as any, "buildUserProfile").mockResolvedValue(profile);
    expect(await (service as any).refreshUnseenSession("owner", "session", "voted")).toBe(true);
    expect(session.items.find((item: any) => item.id === "Linked").rank).toBe(2);
    expect(session.items.find((item: any) => item.id === "Control").rank).toBe(3);
    expect(session.items[0].reason).toBe("original shown reason");
    expect(session.items.find((item: any) => item.id === "already-seen").reason).toBe("original future shown reason");
    expect(mocks.update.mock.calls.every(([args]) => ["Control", "Linked"].includes(args.where.id))).toBe(true);
    expect(session.items.find((item: any) => item.id === "Linked").scoreComponents.previewIdentity).toEqual({ sourceId: "preview" });
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(build.mock.invocationCallOrder[0]);
  });
  it("does not invent a taste connection when the rated track is not an evidenced reference", async () => {
    const service = new RecommendationService();
    session.items[0].trackName = "Unrelated";
    const build = vi.spyOn(service as any, "buildUserProfile");
    expect(await (service as any).refreshUnseenSession("owner", "session", "voted")).toBe(false);
    expect(build).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("never reports a committed decision as failed if optional queue recomputation fails", async () => {
    const service = new RecommendationService();
    vi.spyOn(SessionMemoryService.prototype, "recordFeedback").mockResolvedValue({ success: true, states: {}, currentRank: 2, feedbackId: "saved", revision: 1 });
    vi.spyOn(service as any, "refreshUnseenSession").mockRejectedValue(new Error("temporary read failure"));
    await expect(service.submitFeedback("owner", "voted", "LIKED", undefined, "session")).resolves.toMatchObject({ success: true, queueRefreshDeferred: true });
  });
});
