"use client";

import { useEffect, useMemo, useState } from "react";
import { ScreenLine } from "@/components/ui/screen-line";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { motion } from "framer-motion";
import { CountUp, EASE_OUT_EXPO, Reveal } from "@/components/ui/motion";

interface HistoryEvent {
  id: string;
  playedAt: string;
  rawArtistName: string;
  rawTrackName: string;
  rawAlbumName?: string;
  provider: string;
}

const DAY_FORMAT = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (dayKey(date.toISOString()) === dayKey(today.toISOString())) return "hoje";
  if (dayKey(date.toISOString()) === dayKey(yesterday.toISOString())) return "ontem";
  const formatted = DAY_FORMAT.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function HistoryPage() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({ page: String(page), limit: "30", search });

      fetch(`/api/history?${query}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Não foi possível carregar o histórico.");
          return response.json();
        })
        .then((payload) => {
          setEvents(payload.events ?? []);
          setTotalPages(payload.totalPages ?? 1);
          setTotalItems(payload.totalItems ?? 0);
        })
        .catch((cause: Error) => {
          if (cause.name !== "AbortError") setError(cause.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [page, search]);

  /** Um log corrido é ilegível; o dia é a unidade natural de leitura. */
  const days = useMemo(() => {
    const grouped = new Map<string, HistoryEvent[]>();
    for (const event of events) {
      const key = dayKey(event.playedAt);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(event);
      else grouped.set(key, [event]);
    }
    return [...grouped.entries()];
  }, [events]);

  return (
    <div className="space-y-14 pb-10">
      <header className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div>
          <span className="eyebrow">Tudo o que tocou</span>
          <h1 className="display-xl mt-4 text-[clamp(2.2rem,5vw,4rem)]">
            <Reveal>Histórico</Reveal>
          </h1>
          <p className="mt-4 font-mono text-xs text-text-muted">
            <CountUp value={totalItems} className="text-text-secondary" /> audições registradas
          </p>
          <ScreenLine screen="history" fallback="Tudo o que tocou, do mais recente para trás." />
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar artista, faixa ou álbum"
            aria-label="Buscar no histórico"
            className="w-full border-b border-border bg-transparent py-2.5 pl-7 pr-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </header>

      {loading && <p className="font-mono text-xs text-text-muted">Carregando…</p>}

      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-6 text-sm text-status-error">{error}</div>
      )}

      {!loading && !error && events.length === 0 && (
        <section className="py-16">
          <h2 className="display-lg max-w-[20ch] text-[clamp(1.6rem,3vw,2.4rem)]">
            {search ? "Nada com esse nome." : "Nada por aqui ainda."}
          </h2>
          {search && (
            <p className="mt-4 max-w-[42ch] text-sm text-text-secondary">
              Tente parte do nome do artista, da faixa ou do álbum.
            </p>
          )}
        </section>
      )}

      {!loading && !error && days.length > 0 && (
        <div className="space-y-12">
          {days.map(([key, dayEvents], dayIndex) => (
            <section key={key}>
              <div className="sticky top-[57px] z-10 flex items-baseline justify-between gap-4 border-b border-border bg-background/90 py-2.5 backdrop-blur-md">
                <h2 className="font-display text-sm" style={{ fontVariationSettings: '"wdth" 104, "wght" 700' }}>
                  {dayLabel(dayEvents[0].playedAt)}
                </h2>
                <span className="eyebrow">{dayEvents.length} audições</span>
              </div>

              <ul className="m-0 list-none p-0">
                {dayEvents.map((event, index) => (
                  <motion.li
                    key={event.id}
                    className="group relative isolate grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-border/60 py-3.5 transition-[padding] duration-500 ease-out hover:pl-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      ease: EASE_OUT_EXPO,
                      delay: Math.min(0.5, dayIndex * 0.04 + index * 0.02),
                    }}
                  >
                    <span className="absolute inset-y-0 left-0 z-0 w-0 bg-accent/10 transition-all duration-500 ease-out group-hover:w-full" />

                    <span className="relative z-10 flex min-w-0 flex-col gap-0.5">
                      <b className="truncate text-sm font-semibold text-text-primary">{event.rawTrackName}</b>
                      <span className="truncate text-xs text-text-secondary">
                        {event.rawArtistName}
                        {event.rawAlbumName && <span className="text-text-muted"> · {event.rawAlbumName}</span>}
                      </span>
                    </span>

                    <span className="relative z-10 whitespace-nowrap font-mono text-[11px] tabular-nums text-text-muted">
                      {TIME_FORMAT.format(new Date(event.playedAt))}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="flex items-center justify-between border-t border-border pt-5">
          <span className="font-mono text-[11px] text-text-muted">
            página {page} de {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Página anterior"
              className="rounded-full border border-border p-2 text-text-secondary transition-colors hover:border-accent hover:text-text-primary disabled:opacity-25 disabled:hover:border-border"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Próxima página"
              className="rounded-full border border-border p-2 text-text-secondary transition-colors hover:border-accent hover:text-text-primary disabled:opacity-25 disabled:hover:border-border"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
