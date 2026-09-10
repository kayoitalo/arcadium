"use client";

import { useEffect, useMemo, useState } from "react";
import { ScreenLine } from "@/components/ui/screen-line";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

const ROW = "grid grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-4 sm:grid-cols-[4rem_minmax(0,1fr)_12rem] sm:gap-6";

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
    <div className="space-y-14">
      <header className="border-b border-border pb-9">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <span className="catalog text-accent">GY/04</span>
              <span className="label">Livro de audições</span>
            </div>

            <h1 className="headline mt-4 text-[clamp(2.2rem,5.4vw,3.9rem)]">
              <Reveal>Histórico</Reveal>
            </h1>

            <p className="data mt-4 text-text-muted">
              <CountUp value={totalItems} className="text-text-secondary" /> audições lançadas no livro
            </p>

            <div className="max-w-[52ch]">
              <ScreenLine screen="history" fallback="Tudo o que tocou, do mais recente para trás." />
            </div>
          </div>

          <label className="w-full lg:w-80">
            <span className="label mb-1.5 block">Busca no livro</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="artista, faixa ou álbum"
              aria-label="Buscar no histórico"
              className="field"
            />
          </label>
        </div>
      </header>

      {loading && <p className="label">Lendo o livro…</p>}

      {error && (
        <div className="border border-status-error/40 bg-status-error/[0.07] p-6">
          <span className="label text-status-error">Falha de leitura</span>
          <p className="mt-2 text-sm text-status-error">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <section className="py-14">
          <h2 className="headline max-w-[20ch] text-[clamp(1.6rem,3vw,2.4rem)]">
            {search ? "Nada com esse nome." : "Nenhum lançamento ainda."}
          </h2>
          <p className="liner mt-4 max-w-[42ch]">
            {search
              ? "Tente parte do nome do artista, da faixa ou do álbum."
              : "Registre seu usuário do Last.fm na ficha técnica para começar o livro."}
          </p>
        </section>
      )}

      {!loading && !error && days.length > 0 && (
        <div className="space-y-12">
          {days.map(([key, dayEvents], dayIndex) => (
            <section key={key}>
              <div className="sticky top-[6.1rem] z-10 flex items-baseline justify-between gap-4 border-b border-border bg-background/95 py-2.5 backdrop-blur-md">
                <div className="flex items-baseline gap-3">
                  <span className="catalog text-accent">Sessão</span>
                  <h2 className="section-title text-[0.9375rem]">{dayLabel(dayEvents[0].playedAt)}</h2>
                </div>
                <span className="label">{dayEvents.length} audições</span>
              </div>

              <ul className="m-0 list-none p-0">
                {dayEvents.map((event, index) => (
                  <motion.li
                    key={event.id}
                    className={`${ROW} group relative isolate border-b border-border-subtle py-3 transition-[padding] duration-500 ease-out hover:pl-2.5`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      ease: EASE_OUT_EXPO,
                      delay: Math.min(0.5, dayIndex * 0.04 + index * 0.02),
                    }}
                  >
                    <span className="absolute inset-y-0 left-0 z-0 w-0 bg-accent/[0.07] transition-all duration-500 ease-out group-hover:w-full" />

                    <span className="data relative z-10 text-text-muted transition-colors group-hover:text-accent">
                      {TIME_FORMAT.format(new Date(event.playedAt))}
                    </span>

                    <span className="relative z-10 flex min-w-0 flex-col gap-0.5">
                      <b className="truncate text-sm font-semibold text-text-primary">{event.rawTrackName}</b>
                      <span className="truncate text-xs text-text-secondary">{event.rawArtistName}</span>
                    </span>

                    <span className="catalog relative z-10 hidden truncate text-right sm:block">
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
          <span className="catalog">
            Folha {page} de {totalPages || 1}
          </span>
          <div className="flex divide-x divide-border border border-border">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Folha anterior"
              className="stamp border-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Próxima folha"
              className="stamp border-0"
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
