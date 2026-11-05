import { describe, expect, it } from "vitest";
import { privateDownloadFailure } from "./private-download";
describe("private downloads", () => {
  it("redirects an expired browser download and retains API error semantics otherwise", () => {
    const blocked = new Response("unauthorized", { status: 401 });
    const redirect = privateDownloadFailure(new Request("https://app.test/api/collection?download=1", { headers: { "sec-fetch-mode": "navigate" } }), blocked);
    expect(redirect.headers.get("location")).toBe("https://app.test/login?expired=1");
    expect(redirect.headers.get("cache-control")).toBe("private, no-store");
    expect(privateDownloadFailure(new Request("https://app.test/api/collection?download=1"), blocked)).toBe(blocked);
    expect(privateDownloadFailure(new Request("https://app.test/api/collection"), blocked)).toBe(blocked);
  });
});
