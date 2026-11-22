"use client";

import { useEffect, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { cleanTitle } from "@/lib/music/track-title";
import { genreLabel } from "@/lib/format/genre";

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
/** "às 19:53" hoje; "em 20 de nov., 19:53" noutro dia. */
const when = (date: Date) => (date.toDateString() === new Date().toDateString() ? `às ${time.format(date)}` : `em ${day.format(date)}, ${time.format(date)}`);

async function json<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const response = await privateFetch(url, { signal, cache: "no-store" });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * As notas do sumário do caderno, no celular: embaixo de cada tela, uma
 * linha com o que ela guarda agora. Só o que é barato e observado; cada nota
 * chega quando chega, e tela sem nota fica só com o nome.
 */
export function useMenuNotes(open: boolean): Record<string, string> {
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const put = (href: string, note: string | null) => { if (note && !controller.signal.aborted) setNotes((current) => ({ ...current, [href]: note })); };
    void json<{ events: Array<{ rawTrackName: string; playedAt: string }> }>("/api/history?limit=10", controller.signal).then((page) => {
      const last = page?.events[0];
      put("/history", last ? `a última: ${cleanTitle(last.rawTrackName)}, ${time.format(new Date(last.playedAt))}` : null);
    });
    void json<{ latest: { currentRank: number | null; total: number } | null }>("/api/discovery-memory?summary=1", controller.signal).then((summary) => {
      const latest = summary?.latest;
      put("/discovery", latest && latest.currentRank && latest.total ? `tua busca parou na indicação ${latest.currentRank} de ${latest.total}` : null);
    });
    void json<{ artists: Array<{ name: string }> }>("/api/portrait", controller.signal).then((portrait) => {
      const top = portrait?.artists?.[0];
      put("/portrait", top ? `${top.name} em 1º, desde o começo` : null);
    });
    void json<{ year: number; chapters: unknown[] }>("/api/year", controller.signal).then((year) => {
      put("/year", year && year.chapters.length > 0 ? `${year.year} em ${year.chapters.length} capítulos` : null);
    });
    // a conversa só ganha nota quando tem música tocando agora
    void json<{ playing: { track: string; artist: string } | null }>("/api/now-playing", controller.signal).then((now) => {
      put("/overview", now?.playing ? `tocando agora: ${cleanTitle(now.playing.track)}, ${now.playing.artist}` : null);
    });
    void json<{ tasteShift?: { rising: Array<{ genre: string }> } }>("/api/overview?period=30d", controller.signal).then((overview) => {
      const rising = overview?.tasteShift?.rising[0]?.genre;
      put("/taste-evolution", rising ? `${genreLabel(rising)} subindo nos últimos 30 dias` : null);
    });
    // a hora em que a última busca terminou — não a da última música, que é outra coisa
    void json<{ latestRun: { finishedAt: string | null; startedAt: string } | null }>("/api/sync", controller.signal).then((sync) => {
      const at = sync?.latestRun?.finishedAt ?? sync?.latestRun?.startedAt;
      put("/settings", at ? `última busca no Last.fm ${when(new Date(at))}` : null);
    });
    return () => controller.abort();
  }, [open]);
  return notes;
}
