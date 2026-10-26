import { addSelected, readSelection, selectionKey, type SelectedTrack } from "./selection";

export const selectionPrefix = (key: string) => `${key}:track:`;
const trackKey = (key: string, item: SelectedTrack) => `${selectionPrefix(key)}${encodeURIComponent(selectionKey(item))}`;

/** Separate keys prevent one tab's stale list from overwriting another's edits. */
export function readStoredSelection(storage: Storage, key: string): SelectedTrack[] {
  let items: SelectedTrack[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const entryKey = storage.key(index);
    if (!entryKey?.startsWith(selectionPrefix(key))) continue;
    const item = readSelection(`[${storage.getItem(entryKey)}]`)[0];
    if (item && entryKey === trackKey(key, item)) items = addSelected(items, item);
  }
  return items;
}

export function migrateSelection(storage: Storage, key: string) {
  const previous = readSelection(storage.getItem(key));
  for (const item of previous) {
    const entryKey = trackKey(key, item);
    if (storage.getItem(entryKey) === null) storage.setItem(entryKey, JSON.stringify(item));
  }
  storage.removeItem(key);
}

export function storeSelected(storage: Storage, key: string, item: SelectedTrack) {
  const items = readStoredSelection(storage, key);
  const updated = addSelected(items, item);
  if (updated !== items) storage.setItem(trackKey(key, item), JSON.stringify(item));
  return readStoredSelection(storage, key);
}

export function removeStoredSelection(storage: Storage, key: string, item: SelectedTrack) {
  storage.removeItem(trackKey(key, item));
  return readStoredSelection(storage, key);
}
