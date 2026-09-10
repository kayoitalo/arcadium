"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChroma } from "@/components/chroma/chroma-provider";
import { CoverWall } from "@/components/overview/cover-wall";
import { Groove } from "@/components/overview/groove";
import { RankList } from "@/components/overview/rank-list";
import { RecordConstellation } from "@/components/overview/record-constellation";
import { CountUp, EASE_OUT_EXPO, InViewFade, Reveal } from "@/components/ui/motion";
import { SectionHead } from "@/components/ui/editorial";
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
      <div className="border border-status-error/40 bg-status-error/[0.07] p-6">
        <span className="label text-status-error">Falha de leitura</span>
        <p className="mt-2 text-sm text-status-error">{error}</p>
      </div>
    );
  }

  const empty = !loading && data && summary?.totalPlays === 0;

  return (
    <div className="space-y-20 sm:space-y-24">
      {/* seletor de período: a gaveta do fichário */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-3">
          <span className="label">Período de leitura</span>
          <span className="catalog text-text-secondary">{PERIOD_SUBJECT[period]}</span>
        </div>

        <div className="flex divide-x divide-border border border-border">
          {PERIODS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setPeriod(entry.key)}
              data-active={period === entry.key}
              aria-pressed={period === entry.key}
              className="tab"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <section className="border-y border-border py-20">
          <span className="label">Ficha em branco</span>
          <h1 className="headline mt-4 max-w-[16ch] text-[clamp(2rem,5vw,3.6rem)]">
            Nada tocou {PERIOD_SUBJECT[period]}.
          </h1>
          <p className="liner mt-5 max-w-[46ch]">
            Escolha um intervalo maior, ou registre seu usuário do Last.fm na{" "}
            <em>ficha técnica</em> para trazer o histórico.
          </p>
        </section>
      ) : (
        <>
          {/* abertura: manchete de contracapa */}
          <section className="relative grid items-center gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.76fr)]">
            <div className="chroma-aura pointer-events-none absolute -inset-x-32 -top-24 -z-10 h-[520px]" />

            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${period}-${headline ?? "loading"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-accent" />
                    <span className="label">{story?.eyebrow ?? "Leitura do período"}</span>
                  </div>

                  <h1 className="headline mt-5 max-w-[15ch] text-[clamp(2.5rem,6vw,5rem)]">
                    {headline ? (
                      <Reveal>{headline}</Reveal>
                    ) : (
                      <span className="block h-[1em] w-[8ch] animate-pulse bg-surface-elevated" />
                    )}
                  </h1>

                  {narrative && (
                    <motion.p
                      className="liner-lead mt-7 max-w-[44ch]"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.25 }}
                    >
                      {narrative}
                    </motion.p>
                  )}

                  {Boolean(story?.tasteKeywords?.length) && (
                    <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
                      {story?.tasteKeywords?.map((keyword, index) => (
                        <motion.span
                          key={keyword}
                          className="catalog text-text-secondary"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.4 + index * 0.06 }}
                        >
                          <span className="text-accent">[</span> {keyword}{" "}
                          <span className="text-accent">]</span>
                        </motion.span>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="registered">
              <RecordConstellation albums={albums} selectedIndex={focused} onSelect={setFocused} />
              {focusedAlbum && (
                <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-2.5">
                  <span className="catalog truncate">
                    <span className="text-accent">GY·LP-{String(focused + 1).padStart(3, "0")}</span>{" "}
                    {focusedAlbum.title}
                  </span>
                  <span className="catalog shrink-0">tinta desta ficha</span>
                </div>
              )}
            </div>
          </section>

          {/* livro de contagem */}
          <section className="grid grid-cols-2 gap-px border border-border bg-border xl:grid-cols-4">
            {[
              { label: "Audições", value: summary?.totalPlays ?? 0, change: summary?.playsChangePercent },
              { label: "Artistas", value: summary?.uniqueArtists ?? 0, change: summary?.artistsChangePercent },
              { label: "Faixas", value: summary?.uniqueTracks ?? 0, change: summary?.tracksChangePercent },
              {
                label: "Tempo de agulha",
                value: summary?.listeningMinutes ?? 0,
                change: null,
                format: formatHours,
                approximate: summary?.durationSource === "ESTIMATE",
              },
            ].map((metric, index) => (
              <div
                key={metric.label}
                className="group relative overflow-hidden bg-background px-4 py-6 sm:px-5"
              >
                <span className="absolute bottom-0 left-0 h-px w-0 bg-accent transition-all duration-500 ease-out group-hover:w-full" />

                <div className="flex items-baseline justify-between gap-2">
                  <span className="label">{metric.label}</span>
                  <span className="catalog opacity-50">
                    {String(index + 1).padStart(2, "0")}/04
                  </span>
                </div>

                <strong className="numeral mt-4 block text-[clamp(1.9rem,4.2vw,3rem)]">
                  {metric.approximate && (
                    <span className="mr-1 align-middle text-[0.45em] text-text-muted">≈</span>
                  )}
                  <CountUp
                    value={metric.value}
                    format={metric.format ?? ((input) => Math.round(input).toLocaleString("pt-BR"))}
                  />
                </strong>

                {typeof metric.change === "number" && (
                  <span
                    className={`data mt-3 block ${
                      metric.change >= 0 ? "text-status-success" : "text-status-error"
                    }`}
                  >
                    {metric.change > 0 ? "+" : ""}
                    {metric.change}% vs. período anterior
                  </span>
                )}
                {metric.approximate && (
                  <span className="data mt-3 block text-text-muted">duração estimada</span>
                )}
              </div>
            ))}
          </section>

          {/* o sulco */}
          <InViewFade>
            <section>
              <SectionHead code="GY/01·A" title="O sulco" note="33⅓ · uma volta por ano" />
              <div className="mt-8 grid items-center gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
                <div>
                  <h3 className="headline max-w-[16ch] text-[clamp(1.7rem,3.4vw,2.6rem)]">
                    Cada volta é um ano da sua escuta.
                  </h3>
                  <p className="liner mt-5 max-w-[44ch]">
                    O tempo corre do centro para a borda. Cada traço é um dia, e o comprimento é o
                    quanto tocou — os vãos são os dias em silêncio. Passe o cursor para percorrer o
                    sulco.
                  </p>
                  {(insight || data) && (
                    <motion.p
                      key={insight ?? "fallback"}
                      className="liner mt-7 max-w-[42ch] border-l border-accent pl-5 text-[0.9375rem]"
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
              </div>
            </section>
          </InViewFade>

          {/* livro de prensagem: mais ouvidos */}
          <InViewFade>
            <section>
              <SectionHead
                code="GY/01·B"
                title="Mais ouvidos"
                note={`${(summary?.uniqueArtists ?? 0).toLocaleString("pt-BR")} artistas na gaveta`}
              />
              <RankList artists={data?.topArtists.slice(0, 8) ?? []} periodKey={period} />
            </section>
          </InViewFade>

          {/* movimento de gosto e novidades */}
          {data && (data.tasteShift.rising.length > 0 || data.discoveries.length > 0) && (
            <InViewFade>
              <section className="grid gap-x-12 gap-y-14 md:grid-cols-2">
                {data.tasteShift.rising.length > 0 && (
                  <div>
                    <SectionHead code="GY/01·C" title="Ganhou espaço" note="antes → agora" />
                    <ul className="m-0 list-none p-0">
                      {data.tasteShift.rising.slice(0, 5).map((entry, index) => (
                        <motion.li
                          key={entry.genre}
                          className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-3"
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.06 }}
                        >
                          <span className="section-title truncate text-[0.8125rem] text-text-primary">{entry.genre}</span>
                          <span className="data shrink-0 text-text-muted">
                            {entry.previousShare.toString().replace(".", ",")}%
                            <span className="mx-1.5 text-border">→</span>
                            <b className="text-accent">
                              {entry.currentShare.toString().replace(".", ",")}%
                            </b>
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.discoveries.length > 0 && (
                  <div>
                    <SectionHead code="GY/01·D" title="Entrou na gaveta" note="primeira audição no período" />
                    <ul className="m-0 list-none p-0">
                      {data.discoveries.slice(0, 5).map((entry, index) => (
                        <motion.li
                          key={entry.id}
                          className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-3"
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.06 }}
                        >
                          <span className="min-w-0 truncate text-sm text-text-primary">
                            {entry.artistName}
                          </span>
                          <span className="data shrink-0 truncate text-text-muted">{entry.albumName}</span>
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
                <SectionHead
                  code="GY/01·E"
                  title="Discos do período"
                  note="escolha um para tingir a ficha"
                />
                <CoverWall albums={albums} selectedIndex={focused} onSelect={setFocused} />
              </section>
            </InViewFade>
          )}

          {closing && (
            <InViewFade>
              <section className="border-t border-border pt-10">
                <span className="label">Fechando o período</span>
                <p className="liner-lead mt-4 max-w-[30ch] text-[clamp(1.4rem,3vw,2.1rem)] leading-[1.25] text-text-primary">
                  <em>{closing}</em>
                </p>
              </section>
            </InViewFade>
          )}
        </>
      )}
    </div>
  );
}
