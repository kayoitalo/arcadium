"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useScreenChrome } from "@/components/layout/chrome";
import { Key } from "@/components/ui/console";
import { LedColumns } from "@/components/ui/led-columns";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { CountUp } from "@/components/ui/motion";
import { ScreenLine } from "@/components/ui/screen-line";

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

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}h`;

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

/** As horas do dia em colunas de LED; o cursor lê cada hora. */
function HourMap({ hours }: { hours: number[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...hours);
  const peak = max > 0 ? hours.indexOf(max) : null;
  const shown = hovered ?? peak;

  return (
    <div className="border border-border bg-well">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule px-3 py-2">
        <span className="eyebrow">quando você ouve</span>
        <span className="data text-text-secondary">
          {shown === null ? (
            "sem audições"
          ) : (
            <>
              <span className="text-text-muted">{hovered === null ? "pico · " : ""}</span>
              {hourLabel(shown)} · <b className="text-text-primary">{hours[shown].toLocaleString("pt-BR")}</b>
            </>
          )}
        </span>
      </div>
      <div className="px-3 pt-3">
        <LedColumns values={hours} hot={shown} segments={10} onHover={setHovered} />
      </div>
      <div className="flex justify-between px-3 pb-2 pt-1.5">
        {[0, 6, 12, 18, 23].map((hour) => (
          <span key={hour} className="micro">
            {hourLabel(hour)}
          </span>
        ))}
      </div>
    </div>
  );
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

  return (
    <div className="gy-page flex flex-col gap-10">
      <header className="grid items-end gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div>
          <span className="eyebrow">Tudo o que tocou</span>
          <h1 className="display mt-4 text-[clamp(2.6rem,5.6vw,4.6rem)]">
            <span className="block overflow-hidden">
              <span className="gy-rise">Histórico</span>
            </span>
          </h1>
          <p className="data mt-4 text-text-muted">
            <CountUp value={totalItems} className="text-[13px] font-semibold text-text-primary" /> audições
            registradas · do mais recente para trás
          </p>
          <ScreenLine
            screen="history"
            label="histórico"
            fallback="Cada linha é uma audição que o Last.fm registrou, agrupada pelo dia em que tocou."
          />
        </div>

        <div className="flex flex-col gap-3">
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

          {hours.length === 24 && <HourMap hours={hours} />}
        </div>
      </header>

      {loading && (
        <p className="data flex items-center gap-2 text-text-muted">
          <span className="led" data-on="true" style={{ animation: "gy-blink 0.7s steps(1) infinite" }} />
          lendo o histórico
        </p>
      )}

      {error && (
        <div className="border border-status-error/50 bg-well p-5">
          <span className="eyebrow text-status-error">Falha de leitura</span>
          <p className="mt-2 text-sm text-status-error">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <section className="border border-border bg-well p-6">
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
        <div className="flex flex-col gap-8">
          {days.map(([key, dayEvents]) => (
            <section key={key}>
              <div className="sticky top-[var(--chrome-h)] z-20 flex items-center gap-3 border-y border-border bg-background-secondary px-3 py-2.5">
                <span className="led" data-on={dayLabel(dayEvents[0].playedAt) === "hoje"} aria-hidden />
                <h2 className="rank-name text-[15px]">{dayLabel(dayEvents[0].playedAt)}</h2>
                <span className="flex-1" />
                <span className="data text-text-muted">{dayEvents.length} audições</span>
              </div>

              <ol className="m-0 list-none p-0">
                {dayEvents.map((event, index) => (
                  <motion.li
                    key={event.id}
                    className="grid grid-cols-[46px_28px_minmax(0,1fr)] items-center gap-3 border-b border-rule px-3 py-2.5 transition-colors duration-150 hover:bg-surface md:grid-cols-[52px_28px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, delay: Math.min(0.3, index * 0.015) }}
                  >
                    <span className="data text-text-muted">{TIME_FORMAT.format(new Date(event.playedAt))}</span>

                    {/* miniatura só quando a capa existe; o vão mantém a coluna alinhada */}
                    {event.coverUrl ? (
                      <ResilientCover src={event.coverUrl} alt="" compact className="h-7 w-7" />
                    ) : (
                      <span className="h-7 w-7" aria-hidden />
                    )}

                    <span className="flex min-w-0 flex-col md:contents">
                      <b className="truncate text-[14px] font-semibold text-text-primary">{event.rawTrackName}</b>
                      <span className="truncate text-[13px] text-text-secondary">{event.rawArtistName}</span>
                    </span>

                    <span className="data hidden truncate text-text-label md:block">{event.rawAlbumName ?? "—"}</span>
                  </motion.li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="flex items-center justify-between border-t border-border pt-5">
          <span className="data text-text-muted">
            página {page} de {totalPages || 1}
          </span>
          <div className="keys">
            <Key
              size="sm"
              led={false}
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              anterior
            </Key>
            <Key
              size="sm"
              led={false}
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </Key>
          </div>
        </div>
      )}
    </div>
  );
}
