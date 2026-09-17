import { describe, expect, it } from "vitest";
import { classifyAiError, errorStatus, rejectedText } from "./ai-log";

const providerError = (status: number) => Object.assign(new Error(`[${status}] provider`), { status });

describe("classifyAiError", () => {
  it("tells quota, overload and timeout apart", () => {
    expect(classifyAiError(providerError(429))).toBe("quota");
    expect(classifyAiError(providerError(503))).toBe("overload");
    expect(classifyAiError(providerError(504))).toBe("timeout");
    expect(classifyAiError(new Error("Gemini timeout"))).toBe("timeout");
  });

  it("looks through the wrapper to the provider's original error", () => {
    const wrapped = new Error("Failed to generate AI narrative", { cause: providerError(429) });
    expect(classifyAiError(wrapped)).toBe("quota");
    expect(errorStatus(wrapped)).toBe(429);
  });

  it("recognises broken output and our own tone rejections", () => {
    expect(classifyAiError(new SyntaxError("Unexpected token"))).toBe("invalid_output");
    expect(classifyAiError(Object.assign(new Error("bad"), { name: "ZodError" }))).toBe("invalid_output");
    expect(classifyAiError(rejectedText("off_tone", "Texto fora do tom (crime)"))).toBe("off_tone");
    expect(classifyAiError(new Error("GEMINI_API_KEY is not configured."))).toBe("not_configured");
    expect(classifyAiError("?")).toBe("unknown");
  });
});
