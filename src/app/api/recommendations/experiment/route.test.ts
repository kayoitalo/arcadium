import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), session: vi.fn(), candidates: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.access }));
vi.mock("@/modules/recommendations/application/recommendation-service", () => ({ RecommendationService: class { getSession = mocks.session; } }));
vi.mock("@/modules/recommendations/infrastructure/listenbrainz-experiment", () => ({ ListenBrainzExperiment: class { candidates = mocks.candidates; } }));
import { POST } from "./route";
const request = () => new Request("https://arcadium.test/api/recommendations/experiment", { method: "POST", body: JSON.stringify({ recordingMbid: "8a49dba0-253a-4535-b87f-78bb035336ce", baselineSessionId: "s" }) });
beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({ userId: "owner" }); vi.stubEnv("ARCADIUM_LISTENBRAINZ_EXPERIMENT", "true"); });
afterEach(() => vi.unstubAllEnvs());
describe("isolated experiment route", () => {
  it("is disabled by default without consulting sources", async () => {
    vi.stubEnv("ARCADIUM_LISTENBRAINZ_EXPERIMENT", "");
    expect((await POST(request())).status).toBe(404); expect(mocks.candidates).not.toHaveBeenCalled();
  });
  it("requires an owned baseline before querying ListenBrainz", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.session).toHaveBeenCalledWith("s", "owner"); expect(mocks.candidates).not.toHaveBeenCalled();
  });
  it("reports textual overlap without changing the baseline or combining scores", async () => {
    mocks.session.mockResolvedValue({ sessionId: "s", algorithmVersion: "control", items: [{ artistName: "Band", trackName: "Song" }] });
    mocks.candidates.mockResolvedValue([{ artistName: "BAND", trackName: "Song", rawScore: 350 }, { artistName: "Other", trackName: "Other", rawScore: 99 }]);
    const data = await (await POST(request())).json();
    expect(data.comparison).toMatchObject({ total: 2, textOverlap: 1 });
    expect(data.candidates[0].rawScore).toBe(350);
  });
});
