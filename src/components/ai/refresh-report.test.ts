import { describe, expect, it } from "vitest";
import { describeRefresh } from "./refresh-report";

describe("describeRefresh", () => {
  it("names the period it wrote, and invites another click while periods remain", () => {
    const message = describeRefresh([
      { period: "30d", outcome: "skipped", detail: "too_recent" },
      { period: "7d", outcome: "generated", detail: "missing" },
    ]);
    expect(message).toContain("7 dias");
    expect(message).toContain("Clique de novo");
  });

  it("does not invite another click when the whole round was covered", () => {
    const message = describeRefresh([
      { period: "30d", outcome: "skipped", detail: "fresh" },
      { period: "7d", outcome: "skipped", detail: "fresh" },
      { period: "1y", outcome: "skipped", detail: "fresh" },
      { period: "all", outcome: "generated", detail: "too_old" },
    ]);
    expect(message).toContain("tudo");
    expect(message).not.toContain("Clique de novo");
  });

  it("separates the two reasons for being blocked", () => {
    expect(describeRefresh([{ period: "30d", outcome: "blocked", detail: "no_key" }])).toContain("chave");
    expect(describeRefresh([{ period: "30d", outcome: "blocked", detail: "budget" }])).toContain("teto");
  });

  it("points at the log when a period failed", () => {
    const message = describeRefresh([
      { period: "30d", outcome: "failed" },
      { period: "7d", outcome: "skipped", detail: "fresh" },
    ]);
    expect(message).toContain("30 dias");
    expect(message).toContain("[ai]");
  });

  it("says everything is current when nothing needed doing", () => {
    expect(describeRefresh([{ period: "30d", outcome: "skipped", detail: "fresh" }])).toContain("em dia");
  });

  it("handles an empty report", () => {
    expect(describeRefresh([])).toContain("Nada a fazer");
    expect(describeRefresh(undefined)).toContain("Nada a fazer");
  });
});
