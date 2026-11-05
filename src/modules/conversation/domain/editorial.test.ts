import { describe, expect, it } from "vitest";
import { editorialAvailable, editorialKey } from "./editorial";
import type { ConversationMoment } from "./conversation.types";
const moment = { period: "7d", evidence: { kind: "ranking", unit: "artist", rows: [{ label: "Band", sub: "", plays: 3 }], focusIndex: 0 } } as ConversationMoment;
describe("account editorial memory", () => {
  it("recognizes the same subject across different wording, dates and windows", () => {
    expect(editorialKey(moment)).toBe(editorialKey({ ...moment, period: "30d", headline: "Another headline" }));
    expect(editorialKey(moment)).not.toBe(editorialKey({ ...moment, evidence: { ...moment.evidence, rows: [{ label: "Other band", sub: "", plays: 3 }] } } as ConversationMoment));
  });
  it("respects dismissal, cooldown and explicit revisits without inferring dislike", () => {
    const now = Date.now();
    expect(editorialAvailable({ dismissed: true, seenAt: null }, true, now)).toBe(false);
    expect(editorialAvailable({ dismissed: false, seenAt: new Date(now) }, false, now)).toBe(false);
    expect(editorialAvailable({ dismissed: false, seenAt: new Date(now) }, true, now)).toBe(true);
    expect(editorialAvailable({ dismissed: false, seenAt: new Date(now - 73 * 3600000) }, false, now)).toBe(true);
  });
});
