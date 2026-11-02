"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { collectionSnapshotSchema, type SelectedTrack } from "./selection";
import { migrateSelection, readStoredSelection, removeStoredSelection } from "./selection-storage";

interface Selection {
  items: SelectedTrack[]; localItems: SelectedTrack[]; ready: boolean; syncing: boolean; error: string | null;
  refresh: (notify?: boolean) => Promise<void>; importLocal: () => Promise<void>; remove: (item: SelectedTrack) => Promise<void>;
}
const Context = createContext<Selection | null>(null);
/** Account collection is authoritative. Old browser lists require explicit import. */
export function SelectionProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [items, setItems] = useState<SelectedTrack[]>([]);
  const [localItems, setLocalItems] = useState<SelectedTrack[]>([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true); const sequence = useRef(0); const mutation = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const key = `arcadium:selection:${userId}`;
  const refresh = useCallback(async (notify = false) => {
    if (notify) channel.current?.postMessage("changed");
    const token = ++sequence.current;
    try {
      const response = await privateFetch("/api/collection");
      if (!response.ok) throw new Error("Não consegui atualizar a coleção da conta. Suas respostas já salvas continuam guardadas.");
      const payload = await response.json();
      const parsed = collectionSnapshotSchema.safeParse(payload.items);
      if (!parsed.success) throw new Error("A coleção veio incompleta. Tente atualizar novamente.");
      if (mounted.current && sequence.current === token) { setItems(parsed.data); setReady(true); setError(null); }
    } catch (cause) { if (mounted.current && sequence.current === token) setError(cause instanceof Error ? cause.message : "Não consegui abrir a coleção."); }
  }, []);
  useEffect(() => {
    mounted.current = true; setItems([]); setReady(false); setLocalItems([]);
    try { migrateSelection(localStorage, key); setLocalItems(readStoredSelection(localStorage, key)); } catch { /* Account data remains available. */ }
    void refresh();
    const sync = () => { if (!mutation.current) void refresh(); };
    const visibility = () => { if (document.visibilityState === "visible") sync(); };
    if (typeof BroadcastChannel !== "undefined") {
      try { channel.current = new BroadcastChannel(`arcadium:collection:${userId}`); channel.current.onmessage = sync; } catch { /* Visibility refresh remains available. */ }
    }
    document.addEventListener("visibilitychange", visibility); window.addEventListener("online", sync);
    return () => { mounted.current = false; sequence.current += 1; channel.current?.close(); channel.current = null; document.removeEventListener("visibilitychange", visibility); window.removeEventListener("online", sync); };
  }, [key, refresh, userId]);
  const remove = useCallback(async (item: SelectedTrack) => {
    if (mutation.current) return; mutation.current = true; setSyncing(true);
    try {
      const response = await privateFetch("/api/collection", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artistName: item.artistName, trackName: item.trackName }) });
      if (!response.ok) throw new Error("Não consegui remover a faixa. Ela continua na coleção.");
      await refresh(true);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Falha na coleção."); }
    finally { mutation.current = false; if (mounted.current) setSyncing(false); }
  }, [refresh]);
  const importLocal = useCallback(async () => {
    if (mutation.current) return; mutation.current = true; setSyncing(true);
    try {
      const response = await privateFetch("/api/collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: localItems }) });
      if (!response.ok) throw new Error("Não consegui trazer a lista local. A cópia deste navegador foi preservada.");
      const result = await response.json();
      const acknowledgement = collectionSnapshotSchema.safeParse(result.importedItems);
      if (!acknowledgement.success) throw new Error("Não consegui confirmar a importação. A lista deste navegador foi preservada; tente atualizar a coleção.");
      const acknowledged = acknowledgement.data;
      try {
        const current = readStoredSelection(localStorage, key);
        for (const item of localItems) {
          const same = (entry: SelectedTrack) => entry.id === item.id && entry.artistName === item.artistName && entry.trackName === item.trackName && entry.action === item.action;
          if (acknowledged.some(same) && current.some(same)) removeStoredSelection(localStorage, key, item);
        }
        setLocalItems(readStoredSelection(localStorage, key));
      } catch { /* Retrying is safe. A concurrent browser edit is preserved. */ }
      await refresh(true);
      if (result.skipped?.length) setError("Parte da lista local ficou neste navegador por falta de vínculo com a conta ou de espaço.");
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Falha ao importar."); }
    finally { mutation.current = false; if (mounted.current) setSyncing(false); }
  }, [localItems, key, refresh]);
  const value = useMemo(() => ({ items, localItems, ready, syncing, error, refresh, remove, importLocal }), [items, localItems, ready, syncing, error, refresh, remove, importLocal]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSelection() { const value = useContext(Context); if (!value) throw new Error("SelectionProvider missing"); return value; }
