import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  reserve: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => {
  const aIAnalysisRun = { findMany: db.findMany, findFirst: db.findFirst, update: db.update, create: db.create };
  return { prisma: {
    aIAnalysisRun,
    user: { findUnique: async () => ({ addressAs: "neutro" }) },
    $transaction: async (work: (tx: unknown) => unknown) => work({ aIAnalysisRun, $queryRaw: async () => [] }),
  } };
});
vi.mock("./ai-budget", () => ({
  readBudget: async () => ({ allowed: true }),
  reserveAttempt: db.reserve,
  budgetRefused: () => false,
}));

import { AIAnalysisService } from "./ai-analysis-service";
import { packBatchState } from "../infrastructure/gemini-adapter";
import type { PackBatchState, PackProvider } from "../domain/ai-analysis.types";

const slots = [{ angle: "mais-ouvido", form: "reacao" }];
const reading = {
  slot: 1, eyebrow: "últimos 30 dias", headline: "Rapaz, que mês", narrative: "Tu ouviu muito. Muito mesmo.", insight: "E voltou pro mesmo disco.",
  playfulClosing: "Sem condições.", tone: "PLAYFUL", referencedEvidence: ["mostPlayed"], tasteKeywords: ["rock", "noite", "volta"],
};
const queuedRun = (createdAt = new Date()) => ({
  id: "run", kind: "PACK:30d", model: "gemini-3.5-flash", inputHash: "fp", createdAt,
  rawOutput: JSON.stringify({ job: "batches/1", slots, attemptId: "attempt" }),
});
function serviceWith(state: PackBatchState) {
  const adapter: PackProvider = {
    generatePack: vi.fn(),
    readPackBatch: vi.fn().mockResolvedValue(state),
    cancelPackBatch: vi.fn().mockResolvedValue(undefined),
  };
  return { adapter, service: new AIAnalysisService(undefined, adapter, { collectFacts: async () => [] } as never) };
}

beforeEach(() => {
  db.findMany.mockReset();
  db.findFirst.mockReset().mockResolvedValue(null);
  db.create.mockReset().mockResolvedValue({ id: "run" });
  db.reserve.mockReset().mockResolvedValue({ id: "attempt" });
  db.update.mockReset().mockResolvedValue({ createdAt: new Date() });
});

describe("collectBatches", () => {
  it("turns a finished batch into a saved pack and closes the attempt with its tokens", async () => {
    db.findMany.mockResolvedValue([queuedRun()]);
    const { service } = serviceWith({ state: "done", output: { readings: [reading], albumLines: [], screenLines: [] }, tokens: 900 });
    expect(await service.collectBatches("user")).toEqual([{ period: "30d", outcome: "collected" }]);
    expect(db.update).toHaveBeenCalledWith({ where: { id: "attempt" }, data: { status: "COMPLETED", tokenCount: 900 } });
    const saved = db.update.mock.calls.find(([call]) => call.where.id === "run")![0];
    expect(saved.data.status).toBe("COMPLETED");
    expect(saved.data.validatedOutput).toMatchObject({ fingerprint: "fp", model: "gemini-3.5-flash" });
  });
  it("leaves a batch that is still running alone", async () => {
    db.findMany.mockResolvedValue([queuedRun()]);
    const { service } = serviceWith({ state: "running" });
    expect(await service.collectBatches("user")).toEqual([{ period: "30d", outcome: "waiting" }]);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("cancels a batch past its patience and frees the period", async () => {
    db.findMany.mockResolvedValue([queuedRun(new Date(Date.now() - 5 * 3_600_000))]);
    const { service, adapter } = serviceWith({ state: "running" });
    expect(await service.collectBatches("user")).toEqual([{ period: "30d", outcome: "failed", detail: "timeout" }]);
    expect(adapter.cancelPackBatch).toHaveBeenCalledWith("batches/1");
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "run" }, data: expect.objectContaining({ status: "FAILED" }) }));
  });
  it("marks a pack with no usable reading as invalid output", async () => {
    db.findMany.mockResolvedValue([queuedRun()]);
    const { service } = serviceWith({ state: "done", output: { readings: [], albumLines: [], screenLines: [] } });
    expect(await service.collectBatches("user")).toEqual([{ period: "30d", outcome: "failed", detail: "invalid_output" }]);
  });
  it("keeps the batch when asking about it fails on the network", async () => {
    db.findMany.mockResolvedValue([queuedRun()]);
    const { service, adapter } = serviceWith({ state: "running" });
    vi.mocked(adapter.readPackBatch!).mockRejectedValue(Object.assign(new Error("busy"), { status: 503 }));
    expect(await service.collectBatches("user")).toEqual([{ period: "30d", outcome: "waiting", detail: "overload" }]);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("refreshPack in batch mode", () => {
  const profile = { totalPlays: 40, topArtists: [{ name: "A", plays: 40 }], risingArtists: [], topGenres: [], mostPlayed: { track: { name: "x", artist: "A", plays: 9 } } };
  const builder = { buildProfile: async () => profile };
  const pack = { readings: [reading], albumLines: [], screenLines: [] };
  const withAdapter = (adapter: PackProvider) => new AIAnalysisService(builder as never, adapter, { collectFacts: async () => [] } as never);
  beforeEach(() => { process.env.GEMINI_API_KEY = "synthetic"; });

  it("queues the pack and reserves one attempt only after the batch is accepted", async () => {
    const adapter: PackProvider = { generatePack: vi.fn(), submitPackBatch: vi.fn().mockResolvedValue({ job: "batches/9", model: "m" }) };
    const outcome = await withAdapter(adapter).refreshPack("user", "30d", { batch: true });
    expect(outcome).toEqual({ status: "queued", decision: "missing" });
    expect(adapter.generatePack).not.toHaveBeenCalled();
    expect(db.reserve).toHaveBeenCalledTimes(1);
    const stored = db.update.mock.calls.find(([call]) => call.data.status === "BATCHING")![0];
    expect(JSON.parse(stored.data.rawOutput)).toMatchObject({ job: "batches/9", attemptId: "attempt" });
  });
  it("generates on the spot when the account refuses batches", async () => {
    const adapter: PackProvider = {
      generatePack: vi.fn().mockResolvedValue({ output: pack, model: "m" }),
      submitPackBatch: vi.fn().mockRejectedValue(Object.assign(new Error("Precondition check failed."), { status: 400 })),
    };
    const outcome = await withAdapter(adapter).refreshPack("user", "30d", { batch: true });
    expect(outcome.status).toBe("generated");
    expect(adapter.generatePack).toHaveBeenCalledTimes(1);
    expect(db.update.mock.calls.some(([call]) => call.data.status === "BATCHING")).toBe(false);
  });
});

describe("packBatchState", () => {
  it("reads the inlined answer, which comes without the .text shortcut", () => {
    const state = packBatchState({
      state: "JOB_STATE_SUCCEEDED" as never,
      dest: { inlinedResponses: [{ response: { candidates: [{ content: { parts: [{ text: '```json\n{"ok":true}\n```' }] } }], usageMetadata: { totalTokenCount: 7 } } as never }] },
    });
    expect(state).toEqual({ state: "done", output: { ok: true }, tokens: 7 });
  });
  it("tells running, lost and broken apart", () => {
    expect(packBatchState({ state: "JOB_STATE_RUNNING" as never })).toEqual({ state: "running" });
    expect(packBatchState({ state: "JOB_STATE_EXPIRED" as never })).toMatchObject({ state: "failed" });
    expect(packBatchState({ state: "JOB_STATE_SUCCEEDED" as never, dest: { inlinedResponses: [{ response: { candidates: [{ content: { parts: [{ text: "{quebrado" }] } }] } as never }] } }))
      .toMatchObject({ state: "failed", invalid: true });
  });
});
