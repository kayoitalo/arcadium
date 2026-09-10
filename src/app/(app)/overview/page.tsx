"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useChroma } from "@/components/chroma/chroma-provider";
import { useScreenChrome } from "@/components/layout/chrome";
import { CoverWall } from "@/components/overview/cover-wall";
import { Groove } from "@/components/overview/groove";
import { Movement } from "@/components/overview/movement";
import { RankList } from "@/components/overview/rank-list";
import { Turntable } from "@/components/overview/turntable";
import { CountUp, EASE_OUT_EXPO, InViewFade } from "@/components/ui/motion";
import { SectionHead } from "@/components/ui/section-head";
import { Sparkline } from "@/components/ui/sparkline";
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
      <div className="panel p-6">
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
          Escolha um intervalo maior, ou registre seu usuário do Last.fm na ficha técnica para trazer
          o histórico.
        </p>
      </section>
    );
  }

  return (
    <div className="gy-page flex flex-col gap-24 sm:gap-28">
      {/* ---------- abertura ---------- */}
      <section className="relative grid items-center gap-x-14 gap-y-12 overflow-x-clip lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.75fr)]">
        <div className="chroma-aura pointer-events-none absolute -inset-x-36 -top-36 -z-10 h-[620px]" />

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
                <span className="h-px w-[34px] bg-accent" />
                <span className="eyebrow text-accent">{story?.eyebrow ?? PERIOD_SUBJECT[period]}</span>
              </div>

              <h1 className="display mt-5 max-w-[17ch] text-[clamp(2.6rem,6.6vw,5.9rem)]">
                {headline ? (
                  <span className="block overflow-hidden">
                    <span className="gy-rise">{headline}</span>
                  </span>
                ) : (
                  <span className="block h-[1em] w-[8ch] animate-pulse rounded bg-surface-elevated" />
                )}
              </h1>

              {narrative && (
                <p className="gy-up mt-7 max-w-[48ch] text-base leading-[1.66] text-text-secondary [animation-delay:260ms]">
                  {narrative}
                </p>
              )}

              {Boolean(story?.tasteKeywords?.length) && (
                <div className="mt-7 flex flex-wrap gap-2">
                  {story?.tasteKeywords?.map((keyword, index) => (
                    <span
                      key={keyword}
                      className="gy-up data inline-flex items-center gap-1.5 rounded-full border border-border/90 px-3 py-1.5 text-text-secondary"
                      style={{ animationDelay: `${320 + index * 70}ms`, animationDuration: "600ms" }}
                    >
                      <span className="h-[5px] w-[5px] rounded-full bg-accent" />
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
      <section className="ruled grid-cols-2 border-y border-border xl:grid-cols-[1.55fr_1fr_1fr_1fr]">
        <div className="col-span-2 bg-background px-6 py-7 xl:col-span-1">
          <span className="eyebrow">Audições</span>
          <div className="mt-3 flex items-end justify-between gap-6">
            <strong className="numeral text-[clamp(2.6rem,6vw,4.6rem)]">
              <CountUp value={summary?.totalPlays ?? 0} />
            </strong>
            {activity.length > 1 && (
              <Sparkline
                values={activity.map((point) => point.plays)}
                className="h-10 max-w-[210px] flex-1"
                filled
              />
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {typeof summary?.playsChangePercent === "number" && (
              <span
                className="data rounded-full px-2.5 py-1"
                style={{
                  color: summary.playsChangePercent >= 0 ? "var(--chroma)" : "#d1665a",
                  background:
                    summary.playsChangePercent >= 0 ? "var(--chroma-soft)" : "rgb(209 102 90 / 0.12)",
                }}
              >
                {summary.playsChangePercent > 0 ? "+" : ""}
                {summary.playsChangePercent}%
              </span>
            )}
            <span className="data text-text-muted">
              {summary?.playsChangePercent == null
                ? "sem período anterior para comparar"
                : "contra o período anterior"}
            </span>
          </div>
        </div>

        {[
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
              listeningShare == null
                ? "duração estimada"
                : `${decimal(listeningShare)}% do período com música`,
            approximate: summary?.durationSource === "ESTIMATE",
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-background px-5 py-7">
            <span className="eyebrow">{metric.label}</span>
            <strong className="numeral mt-3 block text-[clamp(1.7rem,3vw,2.5rem)]">
              {metric.approximate && <span className="mr-1 align-middle text-[0.5em] text-text-muted">≈</span>}
              <CountUp value={metric.value} format={metric.format} />
            </strong>

            <span className="mt-4 block h-[3px] w-full bg-rule">
              <motion.span
                className="block h-full bg-accent"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: Math.max(0.02, Math.min(1, metric.bar)) }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: EASE_OUT_EXPO }}
                style={{ transformOrigin: "left center" }}
              />
            </span>

            <span className="data mt-2.5 block text-text-muted">{metric.note}</span>
            {typeof metric.change === "number" && (
              <span
                className={`data mt-1 block ${
                  metric.change >= 0 ? "text-status-success" : "text-status-error"
                }`}
              >
                {metric.change > 0 ? "+" : ""}
                {metric.change}% que antes
              </span>
            )}
          </div>
        ))}
      </section>

      {/* ---------- o disco ---------- */}
      <InViewFade>
        <section className="grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
          <div>
            <SectionHead index="01" eyebrow="O disco" />
            <h2 className="headline mt-4 max-w-[16ch] text-[clamp(2rem,3.8vw,3.1rem)]">
              Cada volta é um ano da sua escuta.
            </h2>
            <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.66] text-text-secondary">
              O tempo corre do centro para fora. Cada traço é um dia e o comprimento é o quanto tocou.
              Passe o cursor para percorrer o sulco.
            </p>

            <div className="mt-7 flex flex-wrap gap-5">
              <span className="data inline-flex items-center gap-2 text-text-muted">
                <span className="h-2.5 w-0.5 bg-accent" />
                dia com escuta
              </span>
              <span className="data inline-flex items-center gap-2 text-text-muted">
                <span className="h-[3px] w-[3px] rounded-full bg-[#39424c]" />
                dia em silêncio
              </span>
            </div>

            {(insight || data) && (
              <p className="mt-7 max-w-[42ch] border-l-2 border-accent pl-4 text-sm leading-[1.66] text-text-secondary">
                {insight ??
                  `Os cinco primeiros artistas somam ${decimal(data!.concentration.top5ArtistShare)}% de tudo que você ouviu ${PERIOD_SUBJECT[period]}.`}
              </p>
            )}
          </div>

          <Groove activity={activity} totalPlays={summary?.totalPlays ?? 0} />
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
                <span className="data inline-flex items-center gap-1.5 rounded-full border border-border/90 px-2.5 py-1 text-text-secondary">
                  <span className="h-[5px] w-[5px] rounded-full bg-accent" />
                  top 5 = {decimal(data?.concentration.top5ArtistShare ?? 0)}%
                </span>
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

      {/* ---------- a pilha ---------- */}
      {albums.length > 0 && (
        <InViewFade>
          <section>
            <SectionHead
              index="04"
              eyebrow="Discos do período"
              title="A pilha do mês"
              aside={<span className="data pb-1 text-text-muted">escolha um para tingir a tela</span>}
            />
            <CoverWall albums={albums} selectedIndex={focused} onSelect={setFocused} />
          </section>
        </InViewFade>
      )}

      {/* ---------- fecho ---------- */}
      {closing && (
        <InViewFade>
          <section className="grid items-center gap-10 border-t border-border pt-11 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <span className="eyebrow">Fechando o período</span>
              <p className="display mt-5 max-w-[26ch] text-[clamp(1.7rem,3.4vw,2.7rem)] text-accent">
                {closing}
              </p>
            </div>
            <Link href="/discovery" className="pill w-fit">
              ir para descobertas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </InViewFade>
      )}
    </div>
  );
}
