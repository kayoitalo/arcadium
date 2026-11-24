import { afterEach, describe, expect, it, vi } from "vitest";
import { deadline } from "./deadline";

afterEach(() => vi.useRealTimers());

describe("deadline", () => {
  it("aborts when the time runs out and says so", () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const limit = deadline(parent.signal, 1000);
    vi.advanceTimersByTime(999);
    expect(limit.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(limit.signal.aborted).toBe(true);
    expect(limit.expired()).toBe(true);
  });

  it("follows the caller without calling it a timeout", () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const limit = deadline(parent.signal, 1000);
    parent.abort();
    expect(limit.signal.aborted).toBe(true);
    expect(limit.expired()).toBe(false);
  });

  it("stops counting once the response is read", () => {
    vi.useFakeTimers();
    const limit = deadline(new AbortController().signal, 1000);
    limit.done();
    vi.advanceTimersByTime(5000);
    expect(limit.signal.aborted).toBe(false);
  });
});
