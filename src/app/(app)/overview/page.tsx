"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { findAlbumLine } from "@/components/ai/album-line";
import { pickFresh } from "@/components/ai/pick-fresh";
import { Jukebox } from "@/components/arcadium/jukebox";
import { Pulse } from "@/components/arcadium/pulse";
import { Reveal } from "@/components/arcadium/reveal";
import { Scoreboard, type ScoreEntry } from "@/components/arcadium/scoreboard";
import { ScreenPanel } from "@/components/arcadium/screen-panel";
import { Showcase } from "@/components/arcadium/showcase";
import { AMBER, CYAN, GREEN, MAGENTA } from "@/components/arcadium/tokens";
import { useArcadeAudio } from "@/components/audio/use-arcade-audio";
import { useChroma } from "@/components/chroma/chroma-provider";
import { useScreenChrome } from "@/components/layout/chrome";
import { Decades } from "@/components/overview/decades";
import { Movement } from "@/components/overview/movement";
import { RankList } from "@/components/overview/rank-list";
import { Spectrum } from "@/components/overview/spectrum";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { Delta } from "@/components/ui/console";
import { SectionHead } from "@/components/ui/section-head";
import type { OverviewData, PeriodKey } from "@/modules/statistics/application/overview-service";
import type { PackView, ProfileNarrative } from "@/modules/ai-analysis/domain/ai-analysis.types";

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

/**
 * Só depois disso a leitura se anuncia como "sendo escrita". Pacote pronto
 * volta em milissegundos; avisar antes faria o quadro piscar à toa em toda
 * troca de período.
 */
const PENDING_AFTER_MS = 600;

/** Dias do intervalo — usado para medir quanto dele virou escuta. */
const PERIOD_DAYS: Record<PeriodKey, number | null> = { "7d": 7, "30d": 30, "1y": 365, all: null };

function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return hours >= 1 ? `${hours.toLocaleString("pt-BR")}h` : `${Math.round(minutes)}min`;
}

const decimal = (value: number) => value.toString().replace(".", ",");

export default function OverviewPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [story, setStory] = useState<ProfileNarrative | null>(null);
  const [albumLines, setAlbumLines] = useState<PackView["albumLines"]>([]);
  /** "escrevendo" só aparece depois de PENDING_AFTER_MS. */
  const [writing, setWriting] = useState(false);
  /** Quem escreveu o que está na tela: só o modelo usa a tela dele. */
  const [packSource, setPackSource] = useState<PackView["source"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(0);
  /** O disco que está no deck — pode não ser o que está em foco no mostruário. */
  const [onDeck, setOnDeck] = useState<number | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const { adoptCover } = useChroma();
  const audio = useArcadeAudio();

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
    // cada período tem o seu pacote: manter o texto do anterior sobre os
    // números novos seria dar leitura de mês para a semana
    setStory(null);
    setAlbumLines([]);
    setWriting(false);
    setPackSource(null);

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

    // o pacote do período traz várias leituras e os comentários dos discos;
    // o sorteio é aqui, pra que dois reloads não mostrem o mesmo texto
    const writingTimer = setTimeout(() => setWriting(true), PENDING_AFTER_MS);
    fetch(`/api/ai/pack?period=${period}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: PackView | null) => {
        if (!payload) return;
        setStory(pickFresh(payload.readings, `gy:reading:${period}`, (reading) => reading.headline));
        setAlbumLines(payload.albumLines);
        setPackSource(payload.source);
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(writingTimer);
        if (!controller.signal.aborted) setWriting(false);
      });

    return () => {
      controller.abort();
      clearTimeout(writingTimer);
    };
  }, [period]);

  // quem decide o tamanho do mostruário é o RACK_SIZE da consulta
  const albums = useMemo(() => data?.topAlbums ?? [], [data]);
  const focusedAlbum = albums[focused];
  const deckAlbum = onDeck === null ? null : (albums[onDeck] ?? null);

  // o mostruário abre no disco que mais mostra o que a máquina faz: com
  // capa e com prévia, senão só com capa
  const autoPick = useRef(true);
  useEffect(() => {
    autoPick.current = true;
    setOnDeck(null);
    audio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  useEffect(() => {
    if (!autoPick.current || albums.length === 0) return;
    autoPick.current = false;
    const complete = albums.findIndex((album) => album.coverUrl && album.previewUrl);
    const withCover = albums.findIndex((album) => album.coverUrl);
    const pick = complete >= 0 ? complete : withCover;
    if (pick >= 0) setFocused(pick);
  }, [albums]);

  /** A cor da tela é sempre a da capa em foco: o disco tinge a sala. */
  useEffect(() => {
    adoptCover(focusedAlbum?.coverUrl, focusedAlbum?.title ?? null);
  }, [focusedAlbum?.coverUrl, focusedAlbum?.title, adoptCover]);

  /**
   * Pôr na agulha carrega o disco e para por aí — som só sai no play. O
   * clique já serve de gesto pro navegador liberar o áudio, então o play
   * seguinte sai na hora.
   */
  const putOnDeck = useCallback(
    (index: number) => {
      setFocused(index);
      setOnDeck(index);
      audio.cue(albums[index]?.previewUrl);
    },
    [albums, audio],
  );

  /** O "próximo" respeita o que estava acontecendo: tocando segue tocando. */
  const nextOnDeck = useCallback(() => {
    const playable = albums.map((album, index) => ({ album, index })).filter((entry) => entry.album.previewUrl);
    if (playable.length === 0) return;
    const at = playable.findIndex((entry) => entry.index === onDeck);
    const target = playable[(at + 1) % playable.length];
    const wasPlaying = audio.playing;
    setFocused(target.index);
    setOnDeck(target.index);
    if (wasPlaying) audio.play(target.album.previewUrl);
    else audio.cue(target.album.previewUrl);
  }, [albums, onDeck, audio]);

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

  const scores: ScoreEntry[] = [
    {
      tag: "1up",
      label: "Audições",
      value: summary?.totalPlays ?? 0,
      tint: AMBER,
      footer: <Delta value={summary?.playsChangePercent} />,
    },
    {
      tag: "2up",
      label: "Artistas",
      value: summary?.uniqueArtists ?? 0,
      tint: CYAN,
      ratio: (data?.concentration.top5ArtistShare ?? 0) / 100,
      note: `top 5 = ${decimal(data?.concentration.top5ArtistShare ?? 0)}% da escuta`,
      footer: <Delta value={summary?.artistsChangePercent} suffix="que antes" />,
    },
    {
      tag: "3up",
      label: "Faixas",
      value: summary?.uniqueTracks ?? 0,
      tint: MAGENTA,
      ratio: (data?.concentration.top10TrackShare ?? 0) / 100,
      note: `top 10 = ${decimal(data?.concentration.top10TrackShare ?? 0)}% da escuta`,
      footer: <Delta value={summary?.tracksChangePercent} suffix="que antes" />,
    },
    {
      tag: "hi",
      label: "Tempo",
      value: summary?.listeningMinutes ?? 0,
      tint: GREEN,
      format: formatHours,
      ratio: (listeningShare ?? 0) / 100,
      note:
        listeningShare == null ? "duração estimada" : `${decimal(listeningShare)}% do período com música`,
      // o "≈" sozinho não diz quanto é medido: a cobertura fica escrita
      detail:
        summary && summary.durationSource === "ESTIMATE"
          ? summary.durationCoverage > 0
            ? `duração real em ${summary.durationCoverage}% das audições · resto estimado`
            : "duração estimada: o catálogo ainda não mediu estas faixas"
          : summary
            ? "duração real de todas as audições"
            : undefined,
      approximate: summary?.durationSource === "ESTIMATE",
    },
  ];

  const deckLine = deckAlbum ? findAlbumLine(albumLines, deckAlbum)?.line : undefined;

  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      {/* ---------- abertura: a manchete do modelo e o disco em foco ---------- */}
      <section
        ref={heroRef}
        className="gy-page relative"
        style={{ scrollMarginTop: "calc(var(--chrome-h) + 24px)" }}
      >
        <div className="relative grid items-center gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.8fr)]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${period}-${headline ?? "loading"}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* o âmbar no rótulo continua marcando que o texto é opinião, não dado */}
                <span className="eyebrow block text-accent">{story?.eyebrow ?? PERIOD_SUBJECT[period]}</span>

                <h1 className="display mt-5 max-w-[17ch] text-[clamp(2.4rem,6vw,5.2rem)]">
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

          {/* o disco em foco, do tamanho que ele merece, com o pulso atrás */}
          <div className="relative mx-auto w-full max-w-[420px]">
            <Pulse audio={audio} size={620} />

            {/* o letreiro fica atrás da capa, que passa na frente e tapa o
                meio dele. Sai do eixo do texto de propósito: sobre a
                manchete ele virava ruído em vez de fundo */}
            <p
              aria-hidden
              className="display pointer-events-none absolute left-1/2 top-[42%] w-[190%] -translate-x-1/2 -translate-y-1/2 select-none text-center text-[clamp(3rem,11vw,9rem)] leading-[0.82] text-[#1a2029]"
            >
              ARCADIUM
            </p>

            <div className="relative aspect-square w-full shadow-lift">
              <ResilientCover
                src={focusedAlbum?.coverUrl}
                alt={focusedAlbum?.title ?? "capa"}
                label={focusedAlbum?.title ?? ""}
                className="h-full w-full"
                caption={false}
                priority
              />
            </div>
            <div className="relative mt-5 text-center">
              <p className="eyebrow text-accent">em foco</p>
              <p className="display mt-2 text-[clamp(1.2rem,2vw,1.7rem)] leading-[1.06]">
                {focusedAlbum?.title ?? "—"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-text-muted">
                {focusedAlbum?.artistName ?? ""}
                {focusedAlbum ? ` · ${focusedAlbum.plays} audições` : ""}
              </p>
              {focusedAlbum && (
                <button
                  type="button"
                  onClick={() => putOnDeck(focused)}
                  disabled={!focusedAlbum.previewUrl}
                  className="key key-sm mt-4 disabled:opacity-40"
                >
                  {focusedAlbum.previewUrl ? "pôr na agulha" : "sem prévia no catálogo"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- placar ---------- */}
      <Reveal className="gy-page">
        <Scoreboard
          entries={scores}
          aside={
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-muted">
              {(data?.syncStatus.totalStoredEvents ?? 0).toLocaleString("pt-BR")} registros na máquina
            </span>
          }
        />
      </Reveal>

      {/* ---------- mostruário ---------- */}
      {albums.length > 0 && (
        <Reveal>
          <section>
            <div className="gy-page">
              <SectionHead index="01" eyebrow="Discos do período" title="O mostruário" />
            </div>
            <div className="mt-10 overflow-hidden">
              <Showcase
                albums={albums}
                focused={focused}
                onFocus={setFocused}
                onPick={putOnDeck}
                loadedTitle={deckAlbum?.title}
                bass={audio.bass}
              />
            </div>
          </section>
        </Reveal>
      )}

      {/* ---------- espectro do período ---------- */}
      <Reveal className="gy-page">
        <section>
          <SectionHead index="02" eyebrow="Espectro" title="Onde o volume subiu" />
          {/* items-start: a tela tem a altura do texto dela */}
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Spectrum activity={activity} days={PERIOD_DAYS[period]} />
            {writing ? (
              <ScreenPanel label="leitura" state="writing">
                escrevendo a leitura deste período — a primeira de cada intervalo leva alguns segundos.
                trocar de período agora cancela o pedido.
              </ScreenPanel>
            ) : packSource === "ai" && insight ? (
              <ScreenPanel label="leitura">{insight}</ScreenPanel>
            ) : (
              data && (
                /* texto de reserva sai como texto comum: a tela é só do que o modelo escreveu */
                <p className="data border border-border bg-well p-4 leading-relaxed text-text-secondary">
                  {insight ??
                    `Os cinco primeiros artistas somam ${decimal(data.concentration.top5ArtistShare)}% de tudo que você ouviu ${PERIOD_SUBJECT[period]}.`}
                </p>
              )
            )}
          </div>
        </section>
      </Reveal>

      {/* ---------- ranking ---------- */}
      <Reveal className="gy-page">
        <section>
          <SectionHead
            index="03"
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
      </Reveal>

      {/* ---------- movimento e estreias ---------- */}
      {data && (data.tasteShift.rising.length > 0 || data.discoveries.length > 0) && (
        <Reveal className="gy-page">
          <Movement
            rising={data.tasteShift.rising}
            declining={data.tasteShift.declining}
            discoveries={data.discoveries}
          />
        </Reveal>
      )}

      {/* ---------- décadas ---------- */}
      {data && data.decades.items.length > 0 && (
        <Reveal className="gy-page">
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
        </Reveal>
      )}

      {/* ---------- fecho ---------- */}
      {closing && (
        <Reveal className="gy-page">
          <section className="flex flex-col gap-4 pb-32">
            <ScreenPanel label="fechando o período" size="lg">
              {closing}
            </ScreenPanel>
            <Link href="/discovery" className="key self-end">
              ir para descobertas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </Reveal>
      )}

      {/* ---------- a jukebox, sempre no canto ---------- */}
      <Jukebox album={deckAlbum} audio={audio} onNext={nextOnDeck} line={deckLine} />
    </div>
  );
}
