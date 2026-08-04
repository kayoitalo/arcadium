import { describe, expect, it } from "vitest";
import { generateProviderEventKey } from "../event-key";

describe("generateProviderEventKey", () => {
  it("generates deterministic SHA-256 key", () => {
    const key1 = generateProviderEventKey("user-123", "lastfm", 1700000000, "Radiohead", "Karma Police");
    const key2 = generateProviderEventKey("user-123", "lastfm", 1700000000, "  radiohead  ", "karma police");
    
    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64); // hex SHA-256 string
  });

  it("produces different keys for different timestamps", () => {
    const key1 = generateProviderEventKey("user-123", "lastfm", 1700000000, "Radiohead", "Karma Police");
    const key2 = generateProviderEventKey("user-123", "lastfm", 1700000100, "Radiohead", "Karma Police");
    
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different users", () => {
    const key1 = generateProviderEventKey("user-1", "lastfm", 1700000000, "Radiohead", "Karma Police");
    const key2 = generateProviderEventKey("user-2", "lastfm", 1700000000, "Radiohead", "Karma Police");
    
    expect(key1).not.toBe(key2);
  });
});
