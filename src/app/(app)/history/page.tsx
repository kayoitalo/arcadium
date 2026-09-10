"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useScreenChrome } from "@/components/layout/chrome";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { CountUp, EASE_OUT_EXPO } from "@/components/ui/motion";

interface HistoryEvent {
  id: string;
  playedAt: string;
  rawArtistName: string;
  rawTrackName: string;
  rawAlbumName?: string | null;
  coverUrl?: string | null;
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
  const [hours, setHours] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useScreenChrome({ title: "Histórico" });

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
          setHours(payload.hourHistogram ?? []);
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

  const peakHour = useMemo(() => {
    if (hours.length === 0) return null;
    const max = Math.max(...hours);
    return max === 0 ? null : { hour: hours.indexOf(max), plays: max };
  }, [hours]);

  const hourPeak = Math.max(1, ...hours);

  return (
    <div className="gy-page flex flex-col gap-11">
      <header className="grid items-end gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-px w-[34px] bg-accent" />
            <span className="eyebrow text-accent">Tudo o que tocou</span>
          </div>
          <h1 className="display mt-5 text-[clamp(2.6rem,5.6vw,4.6rem)]">
            <span className="block overflow-hidden">
              <span className="gy-rise">Histórico</span>
            </span>
          </h1>
          <p className="data mt-5 text-text-muted">
            <CountUp value={totalItems} className="text-text-primary" /> audições registradas · do mais
            recente para trás
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar artista, faixa ou álbum"
              aria-label="Buscar no histórico"
              className="field field-search"
            />
          </div>

          {hours.length === 24 && (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="micro">quando você ouve</span>
                <span className="micro">
                  {peakHour
                    ? `pico às ${String(peakHour.hour).padStart(2, "0")}h`
                    : "0h — 23h"}
                </span>
              </div>
              <div className="flex h-9 items-end gap-0.5">
                {hours.map((plays, hour) => (
                  <motion.span
                    key={hour}
                    title={`${String(hour).padStart(2, "0")}h · ${plays.toLocaleString("pt-BR")} audições`}
                    className="flex-1 rounded-[1px]"
                    style={{
                      background: plays === 0 ? "#1b2129" : "var(--chroma)",
                      opacity: plays === 0 ? 1 : 0.35 + (plays / hourPeak) * 0.65,
                    }}
                    initial={{ height: 2 }}
                    animate={{ height: `${Math.max(6, (plays / hourPeak) * 100)}%` }}
                    transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: hour * 0.012 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {loading && <p className="eyebrow">Carregando…</p>}

      {error && (
        <div className="panel p-6">
          <span className="eyebrow text-status-error">Falha de leitura</span>
          <p className="mt-2 text-sm text-status-error">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <section className="py-16">
          <h2 className="headline max-w-[20ch] text-[clamp(1.6rem,3vw,2.4rem)]">
            {search ? "Nada com esse nome." : "Nada por aqui ainda."}
          </h2>
          <p className="mt-4 max-w-[42ch] text-[15px] leading-[1.66] text-text-secondary">
            {search
              ? "Tente parte do nome do artista, da faixa ou do álbum."
              : "Registre seu usuário do Last.fm em Ajustes para trazer o histórico."}
          </p>
        </section>
      )}

      {!loading && !error && days.length > 0 && (
        <div className="flex flex-col gap-9">
          {days.map(([key, dayEvents], dayIndex) => (
            <section key={key}>
              <div className="sticky top-[var(--chrome-h)] z-20 flex items-center gap-4 border-b border-border bg-background/[0.92] py-3 backdrop-blur-md">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <h2 className="rank-name text-[15px] capitalize">{dayLabel(dayEvents[0].playedAt)}</h2>
                </span>
                <span className="h-px flex-1 bg-border/60" />
                <span className="data text-text-muted">{dayEvents.length} audições</span>
              </div>

              <ul className="m-0 list-none p-0">
                {dayEvents.map((event, index) => (
                  <motion.li
                    key={event.id}
                    className="grid grid-cols-[46px_34px_minmax(0,1fr)] items-center gap-3 border-b border-border/45 px-1.5 py-3 transition-[padding,background] duration-500 ease-out hover:bg-surface-elevated/70 hover:pl-3.5 sm:grid-cols-[58px_44px_minmax(0,1fr)_auto] sm:gap-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      ease: EASE_OUT_EXPO,
                      delay: Math.min(0.5, dayIndex * 0.04 + index * 0.02),
                    }}
                  >
                    <span className="data text-text-muted">
                      {TIME_FORMAT.format(new Date(event.playedAt))}
                    </span>

                    {/* capa com a bolacha espiando atrás, como na pilha */}
                    <span className="relative block h-[34px] w-[34px] sm:w-11">
                      <span
                        className="absolute left-[11px] top-px hidden h-8 w-8 rounded-full sm:block"
                        style={{
                          background:
                            "radial-gradient(circle at 50% 50%, #101317 0 18%, #0b0d10 18% 100%)",
                          boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.06)",
                        }}
                      />
                      <ResilientCover
                        src={event.coverUrl}
                        alt=""
                        label={event.rawAlbumName ?? event.rawTrackName}
                        compact
                        className="absolute left-0 top-0 h-[34px] w-[34px] rounded-sm shadow-[0_2px_6px_rgb(0_0_0/0.5)]"
                      />
                    </span>

                    <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
                      <b className="truncate text-[15px] font-semibold text-text-primary">
                        {event.rawTrackName}
                      </b>
                      <span className="truncate text-[13px] text-text-muted">{event.rawArtistName}</span>
                    </span>

                    <span className="data hidden whitespace-nowrap text-text-label sm:block">
                      {event.rawAlbumName ?? "—"}
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
          <span className="data text-text-muted">
            página {page} de {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="pill"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="pill"
            >
              próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
