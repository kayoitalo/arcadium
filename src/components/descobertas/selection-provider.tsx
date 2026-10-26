"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addSelected, selectionKey, type SelectedTrack } from "./selection";
import { migrateSelection, readStoredSelection, removeStoredSelection, selectionPrefix, storeSelected } from "./selection-storage";

interface Selection {
  items: SelectedTrack[];
  ready: boolean;
  add: (item: SelectedTrack) => void;
  remove: (item: SelectedTrack) => void;
}

const Context = createContext<Selection | null>(null);

/** Scoped to the signed-in account; survives map changes and navigation. No credentials are stored. */
export function SelectionProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [items, setItems] = useState<SelectedTrack[]>([]);
  const [ready, setReady] = useState(false);
  const key = `arcadium:selection:${userId}`;
  useEffect(() => {
    const refresh = () => {
      try { setItems(readStoredSelection(window.localStorage, key)); } catch { /* Keep the in-memory selection. */ }
    };
    try { migrateSelection(window.localStorage, key); } catch { /* Storage may be disabled. */ }
    refresh();
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === null || event.key === key || event.key.startsWith(selectionPrefix(key)))) refresh();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  const add = useCallback((item: SelectedTrack) => {
    try { setItems(storeSelected(window.localStorage, key, item)); }
    catch { setItems((current) => addSelected(current, item)); }
  }, [key]);
  const remove = useCallback((item: SelectedTrack) => {
    try { setItems(removeStoredSelection(window.localStorage, key, item)); }
    catch { setItems((current) => current.filter((entry) => selectionKey(entry) !== selectionKey(item))); }
  }, [key]);
  const value = useMemo(() => ({ items, ready, add, remove }), [items, ready, add, remove]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("SelectionProvider missing");
  return value;
}
