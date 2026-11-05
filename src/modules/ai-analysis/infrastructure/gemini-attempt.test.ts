import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiAdapter } from "./gemini-adapter";
const run = (model: unknown, audit: unknown, timeout = 1000) => Reflect.get(new GeminiAdapter("synthetic"), "attemptModel")(model, "synthetic", 1, timeout, audit);
afterEach(() => vi.useRealTimers());
describe("SDK attempt audit", () => {
  it("reserves again for both retry and fallback, and can stop before the fallback SDK call", async () => {
    vi.useFakeTimers();
    const adapter = new GeminiAdapter("synthetic", "primary");
    const primary = { model: "primary", generateContent: vi.fn().mockRejectedValue(Object.assign(new Error("busy"), { status: 503 })) };
    const fallback = { model: "fallback", generateContent: vi.fn().mockResolvedValue({ response: {} }) };
    Reflect.set(adapter, "ai", { getGenerativeModel: () => fallback });
    const audit = { before: vi.fn().mockResolvedValueOnce("one").mockResolvedValueOnce("two").mockRejectedValue(new Error("cap")), after: vi.fn().mockResolvedValue(undefined) };
    const outcome = Reflect.get(adapter, "generateWithRetry").call(adapter, primary, "synthetic", 2, 10000, audit).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(1100);
    expect((await outcome).message).toBe("cap"); expect(primary.generateContent).toHaveBeenCalledTimes(2);
    expect(audit.before.mock.calls.map(([model]) => model)).toEqual(["primary", "primary", "fallback"]); expect(fallback.generateContent).not.toHaveBeenCalled();
  });
  it("never invokes the SDK when reservation is refused", async () => {
    const model = { model: "fake", generateContent: vi.fn() }; const audit = { before: vi.fn().mockRejectedValue(new Error("cap")), after: vi.fn() };
    await expect(run(model, audit)).rejects.toThrow("cap"); expect(model.generateContent).not.toHaveBeenCalled();
  });
  it("records observed tokens and keeps unavailable usage unknown", async () => {
    const audit = { before: vi.fn().mockResolvedValue("attempt"), after: vi.fn() };
    await run({ model: "fake", generateContent: vi.fn().mockResolvedValue({ response: { usageMetadata: { totalTokenCount: 42 } } }) }, audit);
    expect(audit.after).toHaveBeenCalledWith("attempt", { status: "COMPLETED", tokens: 42 });
    await run({ model: "fake", generateContent: vi.fn().mockResolvedValue({ response: {} }) }, audit);
    expect(audit.after).toHaveBeenLastCalledWith("attempt", { status: "COMPLETED", tokens: undefined });
  });
  it("aborts timed-out SDK work instead of leaving an overlapping request running", async () => {
    vi.useFakeTimers(); const audit = { before: vi.fn().mockResolvedValue("attempt"), after: vi.fn().mockResolvedValue(undefined) };
    const task = run({ model: "fake", generateContent: (_: string, options: { signal: AbortSignal }) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))) }, audit, 50);
    const outcome = task.catch((error: Error) => error); await vi.advanceTimersByTimeAsync(60); expect((await outcome).message).toContain("timeout");
    expect(audit.after).toHaveBeenCalledWith("attempt", { status: "FAILED" });
  });
});
