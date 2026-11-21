"use client";

import { useEffect, useState } from "react";
import { coverProxyUrl } from "@/lib/cover";
import { privateFetch } from "@/lib/http/private-fetch";
import { cleanTitle } from "@/lib/music/track-title";
import type { Folha } from "./aviso";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

interface HistoryPage {
  events: Array<{ id: string; playedAt: string; rawArtistName: string; rawTrackName: string; rawAlbumName: string | null; coverUrl: string | null }>;
  totalItems: number;
  since: string | null;
}

/** As últimas capas que tocaram, um disco por vez, e quantas audições ele está lendo: o que mostrar enquanto espera. */
export function fitaFrom(page: HistoryPage, limit = 10): { fita: Folha[]; later: string | null } {
  const seen = new Set<string>();
  const fita: Folha[] = [];
  for (const event of page.events) {
    const url = event.coverUrl ? coverProxyUrl(event.coverUrl) : null;
    const album = `${event.rawArtistName}|${event.rawAlbumName ?? event.rawTrackName}`;
    if (!url || seen.has(album)) continue;
    seen.add(album);
    fita.push({ key: event.id, coverUrl: url, caption: `${cleanTitle(event.rawTrackName)} · ${event.rawArtistName} · ${time.format(new Date(event.playedAt))}` });
    if (fita.length >= limit) break;
  }
  const since = page.since ? new Date(page.since) : null;
  const later = page.totalItems > 0 && since && !Number.isNaN(since.getTime())
    ? `São ${page.totalItems.toLocaleString("pt-BR")} audições desde ${MONTHS[since.getMonth()]} de ${since.getFullYear()}. Tô no meio.`
    : null;
  return { fita, later };
}

/**
 * O histórico recente chega em um segundo; a conversa pode levar dez. Ele
 * busca uma vez, e a espera mostra o que já sabe: a fita e a conta real.
 */
export function useFita(enabled = true): { fita: Folha[]; later: string | null } {
  const [value, setValue] = useState<{ fita: Folha[]; later: string | null }>({ fita: [], later: null });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    privateFetch("/api/history?limit=30", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<HistoryPage>) : null))
      .then((page) => { if (page && !controller.signal.aborted) setValue(fitaFrom(page)); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled]);
  return value;
}
