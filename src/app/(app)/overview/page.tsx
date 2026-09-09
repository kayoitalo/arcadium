"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChroma } from "@/components/chroma/chroma-provider";
import { CoverWall } from "@/components/overview/cover-wall";
import { Groove } from "@/components/overview/groove";
import { RankList } from "@/components/overview/rank-list";
import { RecordConstellation } from "@/components/overview/record-constellation";
import { CountUp, EASE_OUT_EXPO, InViewFade, Reveal } from "@/components/ui/motion";
import type { OverviewData, PeriodKey } from "@/modules/statistics/application/overview-service";
import type { ProfileNarrative } from "@/modules/ai-analysis/domain/ai-analysis.types";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "1y", label: "1 ano" },
  { key: "all", label: "Tudo" },
];

const PERIOD_SUBJECT: Record<PeriodKey, string> = {
  "7d": "na última semana",
  "30d": "nos últimos 30 dias",
  "1y": "no último ano",
  all: "desde o começo",
};

function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return hours >= 1 ? `${hours.toLocaleString("pt-BR")}h` : `${minutes}min`;
}

export default function OverviewPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [story, setStory] = useState<ProfileNarrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(0);
  const { adoptCover } = useChroma();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setFocused(0);

    fetch(`/api/overview?period=${period}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("A leitura do período falhou.");
        return response.json();
      })
      .then((payload: OverviewData) => setData(payload))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "A leitura do período falhou.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    fetch(`/api/ai/narrative?period=${period}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ProfileNarrative | null) => setStory(payload))
      .catch(() => undefined);

    return () => controller.abort();
  }, [period]);

  const albums = useMemo(() => data?.topAlbums.slice(0, 8) ?? [], [data]);
  const focusedAlbum = albums[focused];

  // o centro da constelação precisa liderar com imagem: só 6% dos álbuns têm
  // capa, e cair num sem capa deixa a bolacha em branco no lugar de destaque
  useEffect(() => {
    if (albums.length === 0 || albums[focused]?.coverUrl) return;
    const withCover = albums.findIndex((album) => album.coverUrl);
    if (withCover >= 0) setFocused(withCover);
  }, [albums, focused]);

  useEffect(() => {
    adoptCover(focusedAlbum?.coverUrl);
  }, [focusedAlbum?.coverUrl, adoptCover]);

  const headline = story?.headline ?? data?.aiStory.headline;
  const narrative = story?.narrative ?? data?.aiStory.narrative;
  const insight = story?.insight ?? data?.aiStory.insight;
  const closing = story?.playfulClosing;
  const summary = data?.summary;

  if (error) {
    return (
      <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-8 text-sm text-status-error">
        {error}
      </div>
    );
  }

  const empty = !loading && data && summary?.totalPlays === 0;

  return (
    <div className="space-y-24 pb-10">
      {/* seletor de período */}
      <div className="flex items-center justify-between gap-4">
        <span className="eyebrow">{PERIOD_SUBJECT[period]}</span>
        <div className="flex gap-1 rounded-full border border-border p-1">
          {PERIODS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setPeriod(entry.key)}
              aria-pressed={period === entry.key}
              className={`relative isolate rounded-full px-3.5 py-1.5 font-mono text-[10px] tracking-wide transition-colors ${
                period === entry.key ? "text-background" : "text-text-muted hover:text-text-primary"
              }`}
            >
              {period === entry.key && (
                <motion.span
                  layoutId="period-pill"
                  className="absolute inset-0 z-0 rounded-full bg-text-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <section className="py-20 text-center">
          <h1 className="display-lg mx-auto max-w-[16ch] text-4xl sm:text-5xl">
            Nada tocou {PERIOD_SUBJECT[period]}.
          </h1>
          <p className="mx-auto mt-5 max-w-[42ch] text-sm text-text-secondary">
            Escolha um intervalo maior ou conecte sua conta do Last.fm em Ajustes para trazer o histórico.
          </p>
        </section>
      ) : (
        <>
          {/* abertura */}
          <section className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
            <div className="chroma-aura pointer-events-none absolute -inset-x-32 -top-24 -z-10 h-[560px]" />

            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${period}-${headline ?? "loading"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {story?.eyebrow && <span className="eyebrow">{story.eyebrow}</span>}
                  <h1 className="display-xl mt-4 max-w-[14ch] text-[clamp(2.6rem,6vw,5.2rem)]">
                    {headline ? (
                      <Reveal>{headline}</Reveal>
                    ) : (
                      <span className="block h-[1em] w-[8ch] animate-pulse rounded bg-surface-elevated" />
                    )}
                  </h1>
                  {narrative && (
                    <motion.p
                      className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-text-secondary"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.25 }}
                    >
                      {narrative}
                    </motion.p>
                  )}
                  {Boolean(story?.tasteKeywords?.length) && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {story?.tasteKeywords?.map((keyword, index) => (
                        <motion.span
                          key={keyword}
                          className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-text-secondary"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.4 + index * 0.06 }}
                        >
                          {keyword}
                        </motion.span>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <RecordConstellation albums={albums} selectedIndex={focused} onSelect={setFocused} />
          </section>

          {/* números */}
          <section className="grid grid-cols-2 gap-px border-y border-border bg-border xl:grid-cols-4">
            {[
              { label: "Audições", value: summary?.totalPlays ?? 0, change: summary?.playsChangePercent },
              { label: "Artistas", value: summary?.uniqueArtists ?? 0, change: summary?.artistsChangePercent },
              { label: "Faixas", value: summary?.uniqueTracks ?? 0, change: summary?.tracksChangePercent },
              {
                label: "Tempo",
                value: summary?.listeningMinutes ?? 0,
                change: null,
                format: formatHours,
                approximate: summary?.durationSource === "ESTIMATE",
              },
            ].map((metric, index) => (
              <div
                key={metric.label}
                className="group relative overflow-hidden bg-background px-5 py-7 sm:px-6"
              >
                <span className="absolute bottom-0 left-0 h-px w-0 bg-accent transition-all duration-500 ease-out group-hover:w-full" />
                <span className="eyebrow">{metric.label}</span>
                <strong className="numeral mt-3.5 block text-[clamp(2rem,4.4vw,3.25rem)]">
                  {metric.approximate && <span className="mr-1 text-[0.5em] align-middle text-text-muted">≈</span>}
                  <CountUp value={metric.value} format={metric.format ?? ((input) => Math.round(input).toLocaleString("pt-BR"))} />
                </strong>
                {typeof metric.change === "number" && (
                  <span className={`mt-3 block font-mono text-[10px] ${metric.change >= 0 ? "text-status-success" : "text-status-error"}`}>
                    {metric.change > 0 ? "+" : ""}
                    {metric.change}% que antes
                  </span>
                )}
              </div>
            ))}
          </section>

          {/* o disco */}
          <InViewFade>
            <section className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
              <div>
                <span className="eyebrow">O disco</span>
                <h2 className="display-lg mt-4 max-w-[15ch] text-[clamp(1.9rem,3.6vw,3rem)]">
                  Cada volta é um ano da sua escuta.
                </h2>
                <p className="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-text-secondary">
                  O tempo corre do centro para fora. Cada traço é um dia e o comprimento é o quanto tocou —
                  os vazios são os dias em silêncio. Passe o cursor para percorrer.
                </p>
                {(insight || data) && (
                  <motion.p
                    key={insight ?? "fallback"}
                    className="mt-7 max-w-[42ch] border-l-2 border-accent/60 pl-4 text-sm leading-relaxed text-text-secondary"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.2 }}
                  >
                    {insight ??
                      `Os cinco primeiros artistas somam ${data!.concentration.top5ArtistShare}% de tudo que você ouviu ${PERIOD_SUBJECT[period]}.`}
                  </motion.p>
                )}
              </div>
              <Groove activity={data?.listeningActivity ?? []} totalPlays={summary?.totalPlays ?? 0} />
            </section>
          </InViewFade>

          {/* ranking */}
          <InViewFade>
            <section>
              <div className="flex items-baseline justify-between gap-6 border-b border-border pb-4">
                <h2 className="display-lg text-[clamp(1.4rem,2.6vw,1.9rem)]">Mais ouvidos</h2>
                <span className="eyebrow">{(summary?.uniqueArtists ?? 0).toLocaleString("pt-BR")} artistas no total</span>
              </div>
              <RankList artists={data?.topArtists.slice(0, 8) ?? []} periodKey={period} />
            </section>
          </InViewFade>

          {/* movimento de gosto e novidades */}
          {data && (data.tasteShift.rising.length > 0 || data.discoveries.length > 0) && (
            <InViewFade>
              <section className="grid gap-12 md:grid-cols-2">
                {data.tasteShift.rising.length > 0 && (
                  <div>
                    <h2 className="display-lg text-[clamp(1.2rem,2.2vw,1.6rem)]">O que subiu</h2>
                    <ul className="mt-5 space-y-3">
                      {data.tasteShift.rising.slice(0, 5).map((entry, index) => (
                        <motion.li
                          key={entry.genre}
                          className="flex items-baseline justify-between gap-4 text-sm"
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.06 }}
                        >
                          <span className="text-text-primary">{entry.genre}</span>
                          <span className="font-mono text-[11px] text-text-muted tabular-nums">
                            {entry.previousShare.toString().replace(".", ",")}% → {" "}
                            <b className="text-accent">{entry.currentShare.toString().replace(".", ",")}%</b>
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.discoveries.length > 0 && (
                  <div>
                    <h2 className="display-lg text-[clamp(1.2rem,2.2vw,1.6rem)]">Entrou agora</h2>
                    <ul className="mt-5 space-y-3">
                      {data.discoveries.slice(0, 5).map((entry, index) => (
                        <motion.li
                          key={entry.id}
                          className="flex items-baseline justify-between gap-4 text-sm"
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.06 }}
                        >
                          <span className="min-w-0 truncate text-text-primary">{entry.artistName}</span>
                          <span className="shrink-0 font-mono text-[11px] text-text-muted">{entry.albumName}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </InViewFade>
          )}

          {/* discos do período */}
          {albums.length > 0 && (
            <InViewFade>
              <section>
                <div className="mb-5 flex items-baseline justify-between gap-6">
                  <h2 className="display-lg text-[clamp(1.4rem,2.6vw,1.9rem)]">Discos do período</h2>
                  <span className="eyebrow">escolha um para tingir a tela</span>
                </div>
                <CoverWall albums={albums} selectedIndex={focused} onSelect={setFocused} />
              </section>
            </InViewFade>
          )}
          {closing && (
            <InViewFade>
              <section className="border-t border-border pt-12">
                <span className="eyebrow">Fechando o período</span>
                <p className="display-lg mt-5 max-w-[24ch] text-[clamp(1.5rem,3.2vw,2.4rem)] text-accent">
                  {closing}
                </p>
              </section>
            </InViewFade>
          )}
        </>
      )}
    </div>
  );
}
