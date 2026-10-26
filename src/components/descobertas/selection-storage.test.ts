import { describe, expect, it } from "vitest";
import { migrateSelection, readStoredSelection, removeStoredSelection, storeSelected } from "./selection-storage";
import type { SelectedTrack } from "./selection";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); }, clear: () => data.clear() };
}
const first: SelectedTrack = { id: "1", artistName: "Artist", trackName: "First", action: "saved" };
const second: SelectedTrack = { ...first, id: "2", trackName: "Second" };

describe("cross-tab selection storage", () => {
  it("keeps additions from two tabs even if both initially read an empty list", () => {
    const storage = memoryStorage();
    expect(readStoredSelection(storage, "owner")).toEqual([]);
    expect(readStoredSelection(storage, "owner")).toEqual([]);
    storeSelected(storage, "owner", first);
    storeSelected(storage, "owner", second);
    expect(readStoredSelection(storage, "owner")).toEqual([first, second]);
    expect(readStoredSelection(storage, "another-owner")).toEqual([]);
  });
  it("does not resurrect a removal when another tab adds a different track", () => {
    const storage = memoryStorage();
    storeSelected(storage, "owner", first);
    removeStoredSelection(storage, "owner", first);
    storeSelected(storage, "owner", second);
    expect(readStoredSelection(storage, "owner")).toEqual([second]);
  });
  it("migrates existing lists once without discarding newer per-track edits", () => {
    const storage = memoryStorage();
    storage.setItem("owner", JSON.stringify([first]));
    const newer = { ...first, action: "liked" as const };
    storeSelected(storage, "owner", newer);
    migrateSelection(storage, "owner");
    expect(readStoredSelection(storage, "owner")).toEqual([newer]);
    expect(storage.getItem("owner")).toBeNull();
    removeStoredSelection(storage, "owner", first);
    migrateSelection(storage, "owner");
    expect(readStoredSelection(storage, "owner")).toEqual([]);
  });
});
