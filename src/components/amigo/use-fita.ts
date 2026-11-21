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

/** O dia de hoje, só com o que tocou: de ontem pra cá, a última audição e as capas desse tempo. */
export interface Dia {
  /** "sexta, 20 de novembro" */
  date: string;
  plays: number;
  /** Bateu no limite da página: são pelo menos essas. */
  atLeast: boolean;
  last: { track: string; artist: string; time: string; /** "quinta", quando não foi hoje nem ontem; "ontem" ou "hoje". */ day: string } | null;
  capas: Folha[];
}

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

export function diaFrom(page: HistoryPage, now = new Date(), limit = 100): Dia {
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const recent = page.events.filter((event) => new Date(event.playedAt) >= since);
  // sem nada de ontem pra cá, a fita mostra o que tocou por último
  const { fita } = fitaFrom({ ...page, events: recent.length > 0 ? recent : page.events }, 14);
  const first = page.events[0];
  const lastAt = first ? new Date(first.playedAt) : null;
  const dayOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = lastAt ? Math.round((dayOf(now) - dayOf(lastAt)) / 86_400_000) : 0;
  return {
    date: `${weekday.format(now).replace(/-feira$/, "")}, ${dayMonth.format(now)}`,
    plays: recent.length,
    atLeast: recent.length >= limit,
    last: first && lastAt ? {
      track: cleanTitle(first.rawTrackName), artist: first.rawArtistName, time: time.format(lastAt),
      day: daysAgo <= 0 ? "hoje" : daysAgo === 1 ? "ontem" : weekday.format(lastAt).replace(/-feira$/, ""),
    } : null,
    capas: fita,
  };
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
export function useFita(enabled = true): { fita: Folha[]; later: string | null; dia: Dia | null } {
  const [value, setValue] = useState<{ fita: Folha[]; later: string | null; dia: Dia | null }>({ fita: [], later: null, dia: null });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    privateFetch("/api/history?limit=100", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<HistoryPage>) : null))
      .then((page) => { if (page && !controller.signal.aborted) setValue({ ...fitaFrom(page), dia: diaFrom(page) }); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled]);
  return value;
}
