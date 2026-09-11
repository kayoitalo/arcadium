"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useChroma } from "@/components/chroma/chroma-provider";
import { useScreenChrome } from "@/components/layout/chrome";
import { CoverWall } from "@/components/overview/cover-wall";
import { Decades } from "@/components/overview/decades";
import { Movement } from "@/components/overview/movement";
import { RankList } from "@/components/overview/rank-list";
import { Spectrum } from "@/components/overview/spectrum";
import { Turntable } from "@/components/overview/turntable";
import { Delta, Meter, Readout } from "@/components/ui/console";
import { CountUp, InViewFade } from "@/components/ui/motion";
import { SectionHead } from "@/components/ui/section-head";
import { Voice } from "@/components/ui/voice";
import type { OverviewData, PeriodKey } from "@/modules/statistics/application/overview-service";
import type { ProfileNarrative } from "@/modules/ai-analysis/domain/ai-analysis.types";

const PERIODS = [
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

/** Dias do intervalo — usado para medir quanto dele virou escuta. */
const PERIOD_DAYS: Record<PeriodKey, number | null> = { "7d": 7, "30d": 30, "1y": 365, all: null };

function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return hours >= 1 ? `${hours.toLocaleString("pt-BR")}h` : `${minutes}min`;
}

const decimal = (value: number) => value.toString().replace(".", ",");

export default function OverviewPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [story, setStory] = useState<ProfileNarrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(0);
  const heroRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { adoptCover } = useChroma();

  useScreenChrome({
    title: "Visão geral",
    periods: PERIODS,
    period,
    onPeriod: (key) => setPeriod(key as PeriodKey),
  });

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

  // o prato precisa liderar com imagem: só uma fração dos álbuns tem capa,
  // e cair num sem capa deixa a bolacha em branco no lugar de destaque
  useEffect(() => {
    if (albums.length === 0 || albums[focused]?.coverUrl) return;
    const withCover = albums.findIndex((album) => album.coverUrl);
    if (withCover >= 0) setFocused(withCover);
  }, [albums, focused]);

  useEffect(() => {
    adoptCover(focusedAlbum?.coverUrl, focusedAlbum?.title ?? null);
  }, [focusedAlbum?.coverUrl, focusedAlbum?.title, adoptCover]);

  /** Escolher no rack põe o disco na agulha — e leva o olho até a vitrola. */
  const putOnDeck = (index: number) => {
    setFocused(index);
    heroRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const headline = story?.headline ?? data?.aiStory.headline;
  const narrative = story?.narrative ?? data?.aiStory.narrative;
  const insight = story?.insight ?? data?.aiStory.insight;
  const closing = story?.playfulClosing;
  const summary = data?.summary;
  const activity = data?.listeningActivity ?? [];

  /** O que o intervalo escolhido tem de dias vira o denominador do tempo. */
  const listeningShare = useMemo(() => {
    const days = PERIOD_DAYS[period] ?? activity.length;
    if (!summary || !days) return null;
    return Math.min(100, Number((((summary.listeningMinutes / (days * 1440)) * 100)).toFixed(1)));
  }, [summary, period, activity.length]);

  if (error) {
    return (
      <div className="border border-status-error/50 bg-well p-6">
        <span className="eyebrow text-status-error">Falha de leitura</span>
        <p className="mt-2 text-sm text-status-error">{error}</p>
      </div>
    );
  }

  const empty = !loading && data && summary?.totalPlays === 0;

  if (empty) {
    return (
      <section className="gy-page border-y border-border py-24">
        <span className="eyebrow">Nada no período</span>
        <h1 className="display mt-5 max-w-[16ch] text-[clamp(2.2rem,5vw,3.8rem)]">
          Nada tocou {PERIOD_SUBJECT[period]}.
        </h1>
        <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-text-secondary">
          Escolha um intervalo maior, ou registre seu usuário do Last.fm nos ajustes para trazer o
          histórico.
        </p>
      </section>
    );
  }

  const metrics = [
    {
      label: "Artistas",
      value: summary?.uniqueArtists ?? 0,
      change: summary?.artistsChangePercent,
      bar: (data?.concentration.top5ArtistShare ?? 0) / 100,
      note: `top 5 = ${decimal(data?.concentration.top5ArtistShare ?? 0)}% da escuta`,
    },
    {
      label: "Faixas",
      value: summary?.uniqueTracks ?? 0,
      change: summary?.tracksChangePercent,
      bar: (data?.concentration.top10TrackShare ?? 0) / 100,
      note: `top 10 = ${decimal(data?.concentration.top10TrackShare ?? 0)}% da escuta`,
    },
    {
      label: "Tempo",
      value: summary?.listeningMinutes ?? 0,
      format: formatHours,
      change: null,
      bar: (listeningShare ?? 0) / 100,
      note:
        listeningShare == null ? "duração estimada" : `${decimal(listeningShare)}% do período com música`,
      approximate: summary?.durationSource === "ESTIMATE",
    },
  ];

  return (
    <div className="gy-page flex flex-col gap-16 sm:gap-20">
      {/* ---------- abertura: a manchete do Gemini e a vitrola ---------- */}
      <section
        ref={heroRef}
        className="relative grid items-center gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.75fr)]"
        style={{ scrollMarginTop: "calc(var(--chrome-h) + 24px)" }}
      >
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${period}-${headline ?? "loading"}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="eyebrow text-accent">gemini ▸</span>
                <span className="eyebrow">{story?.eyebrow ?? PERIOD_SUBJECT[period]}</span>
              </div>

              <h1 className="display mt-5 max-w-[17ch] text-[clamp(2.6rem,6.6vw,5.9rem)]">
                {headline ? (
                  <span className="block overflow-hidden">
                    <span className="gy-rise">{headline}</span>
                  </span>
                ) : (
                  <span className="block h-[1em] w-[8ch] animate-pulse bg-surface-elevated" />
                )}
              </h1>

              {narrative && (
                <p className="gy-up mt-7 max-w-[50ch] text-base leading-[1.66] text-text-secondary [animation-delay:260ms]">
                  {narrative}
                </p>
              )}

              {Boolean(story?.tasteKeywords?.length) && (
                <div className="mt-7 flex flex-wrap gap-1.5">
                  {story?.tasteKeywords?.map((keyword, index) => (
                    <span
                      key={keyword}
                      className="gy-up tag"
                      style={{ animationDelay: `${320 + index * 60}ms`, animationDuration: "450ms" }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <Turntable albums={albums} selectedIndex={focused} onSelect={setFocused} />
      </section>

      {/* ---------- números ---------- */}
      <section className="ruled grid-cols-2 border border-border xl:grid-cols-4">
        <Readout label="Audições" footer={<Delta value={summary?.playsChangePercent} />}>
          <strong className="numeral block text-[clamp(2.4rem,4.4vw,3.5rem)]">
            <CountUp value={summary?.totalPlays ?? 0} />
          </strong>
        </Readout>

        {metrics.map((metric) => (
          <Readout
            key={metric.label}
            label={metric.label}
            footer={
              <>
                <Meter ratio={metric.bar} label={metric.note} />
                <span className="data mt-2.5 block text-text-muted">{metric.note}</span>
                {typeof metric.change === "number" && (
                  <span className="mt-1.5 block">
                    <Delta value={metric.change} suffix="que antes" />
                  </span>
                )}
              </>
            }
          >
            <strong className="numeral block text-[clamp(2.4rem,4.4vw,3.5rem)]">
              {metric.approximate && <span className="mr-1 align-middle text-[0.45em] text-text-muted">≈</span>}
              <CountUp value={metric.value} format={metric.format} />
            </strong>
          </Readout>
        ))}
      </section>

      {/* ---------- espectro ---------- */}
      <InViewFade>
        <section>
          <SectionHead index="01" eyebrow="Espectro" title="Onde o volume subiu" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Spectrum activity={activity} days={PERIOD_DAYS[period]} />
            {insight ? (
              <Voice label="leitura">{insight}</Voice>
            ) : (
              data && (
                <p className="data border border-border bg-well p-4 leading-relaxed text-text-secondary">
                  Os cinco primeiros artistas somam {decimal(data.concentration.top5ArtistShare)}% de tudo que
                  você ouviu {PERIOD_SUBJECT[period]}.
                </p>
              )
            )}
          </div>
        </section>
      </InViewFade>

      {/* ---------- ranking ---------- */}
      <InViewFade>
        <section>
          <SectionHead
            index="02"
            eyebrow="Mais ouvidos"
            title="Quem carregou o período"
            aside={
              <div className="flex items-center gap-4 pb-1">
                <span className="data text-text-muted">
                  {(summary?.uniqueArtists ?? 0).toLocaleString("pt-BR")} artistas no total
                </span>
                <span className="tag">top 5 = {decimal(data?.concentration.top5ArtistShare ?? 0)}%</span>
              </div>
            }
          />
          <RankList artists={data?.topArtists.slice(0, 8) ?? []} periodKey={period} />
        </section>
      </InViewFade>

      {/* ---------- movimento e estreias ---------- */}
      {data && (data.tasteShift.rising.length > 0 || data.discoveries.length > 0) && (
        <InViewFade>
          <Movement
            rising={data.tasteShift.rising}
            declining={data.tasteShift.declining}
            discoveries={data.discoveries}
          />
        </InViewFade>
      )}

      {/* ---------- o rack ---------- */}
      {albums.length > 0 && (
        <InViewFade>
          <section>
            <SectionHead
              index="04"
              eyebrow="Discos do período"
              title="O rack"
              aside={<span className="data pb-1 text-text-muted">escolha um para pôr na agulha</span>}
            />
            <CoverWall albums={albums} selectedIndex={focused} onSelect={putOnDeck} />
          </section>
        </InViewFade>
      )}

      {/* ---------- décadas ---------- */}
      {data && data.decades.items.length > 0 && (
        <InViewFade>
          <section>
            <SectionHead
              index="05"
              eyebrow="Décadas"
              title="De que época é a sua escuta"
              aside={
                <span className="data pb-1 text-text-muted">ano de lançamento vindo do catálogo</span>
              }
            />
            <div className="mt-6">
              <Decades distribution={data.decades} />
            </div>
          </section>
        </InViewFade>
      )}

      {/* ---------- fecho ---------- */}
      {closing && (
        <InViewFade>
          <section className="flex flex-col gap-4">
            <Voice label="fechando o período" size="lg">
              {closing}
            </Voice>
            <Link href="/discovery" className="key self-end">
              ir para descobertas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </InViewFade>
      )}
    </div>
  );
}
