import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiAdapter, responseJson } from "./gemini-adapter";

type Request = { model: string; contents: string; config: { abortSignal?: AbortSignal } };
/** Um adaptador com o SDK trocado por `generate`: o resto (tentativas, reserva, auditoria) é o de verdade. */
function adapterWith(generate: (request: Request) => Promise<unknown>, model = "primary") {
  const adapter = new GeminiAdapter("synthetic", model);
  const spy = vi.fn(generate);
  Reflect.set(adapter, "ai", { models: { generateContent: spy } });
  return { adapter, spy };
}
const run = (adapter: GeminiAdapter, audit: unknown, timeout = 1000) =>
  Reflect.get(adapter, "attemptModel").call(adapter, { model: "fake", config: {} }, "synthetic", 1, timeout, audit);
afterEach(() => vi.useRealTimers());

describe("SDK attempt audit", () => {
  it("reserves again for both retry and fallback, and can stop before the fallback SDK call", async () => {
    vi.useFakeTimers();
    const { adapter, spy } = adapterWith(() => Promise.reject(Object.assign(new Error("busy"), { status: 503 })));
    const audit = { before: vi.fn().mockResolvedValueOnce("one").mockResolvedValueOnce("two").mockRejectedValue(new Error("cap")), after: vi.fn().mockResolvedValue(undefined) };
    const outcome = Reflect.get(adapter, "generateWithRetry").call(adapter, { model: "primary", config: {} }, "synthetic", 2, 10000, audit).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(1100);
    expect((await outcome).message).toBe("cap");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.every(([request]) => request.model === "primary")).toBe(true);
    expect(audit.before.mock.calls.map(([model]) => model)).toEqual(["primary", "primary", "gemini-3.5-flash-lite"]);
  });
  it("hands the fallback the same config", async () => {
    vi.useFakeTimers();
    const { adapter, spy } = adapterWith((request) => request.model === "primary"
      ? Promise.reject(Object.assign(new Error("quota"), { status: 429 }))
      : Promise.resolve({ text: "{}" }));
    const outcome = Reflect.get(adapter, "generateWithRetry").call(adapter, { model: "primary", config: { temperature: 0.4 } }, "synthetic", 1, 10000);
    expect((await outcome).model).toBe("gemini-3.5-flash-lite");
    expect(spy.mock.calls[1][0]).toMatchObject({ model: "gemini-3.5-flash-lite", config: { temperature: 0.4 } });
  });
  it("never invokes the SDK when reservation is refused", async () => {
    const { adapter, spy } = adapterWith(() => Promise.resolve({}));
    const audit = { before: vi.fn().mockRejectedValue(new Error("cap")), after: vi.fn() };
    await expect(run(adapter, audit)).rejects.toThrow("cap");
    expect(spy).not.toHaveBeenCalled();
  });
  it("records observed tokens and keeps unavailable usage unknown", async () => {
    const audit = { before: vi.fn().mockResolvedValue("attempt"), after: vi.fn() };
    await run(adapterWith(() => Promise.resolve({ usageMetadata: { totalTokenCount: 42 } })).adapter, audit);
    expect(audit.after).toHaveBeenCalledWith("attempt", { status: "COMPLETED", tokens: 42 });
    await run(adapterWith(() => Promise.resolve({})).adapter, audit);
    expect(audit.after).toHaveBeenLastCalledWith("attempt", { status: "COMPLETED", tokens: undefined });
  });
  it("aborts timed-out SDK work instead of leaving an overlapping request running", async () => {
    vi.useFakeTimers();
    const audit = { before: vi.fn().mockResolvedValue("attempt"), after: vi.fn().mockResolvedValue(undefined) };
    const { adapter } = adapterWith((request) => new Promise((_, reject) => request.config.abortSignal?.addEventListener("abort", () => reject(new Error("aborted")))));
    const outcome = run(adapter, audit, 50).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(60);
    expect((await outcome).message).toContain("timeout");
    expect(audit.after).toHaveBeenCalledWith("attempt", { status: "FAILED" });
  });
});

describe("responseJson", () => {
  it("strips a markdown fence and survives an empty answer", () => {
    expect(responseJson({ text: "```json\n{\"a\":1}\n```" } as never)).toBe('{"a":1}');
    expect(responseJson({} as never)).toBe("");
  });
});
