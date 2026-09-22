"use client";

/**
 * Bancada do ARCADIUM.
 *
 * A direção já foi portada para a Visão Geral; o que sobra aqui são as
 * peças que ainda não têm lugar no app de verdade — a marquise e o seletor
 * de período como botão de gabinete (na tela real o seletor mora na barra
 * do topo). Serve para testar antes de mexer nas telas.
 *
 * Tudo que é compartilhado vem de @/components/arcadium: nada é duplicado.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Jukebox } from "@/components/arcadium/jukebox";
import { Pulse } from "@/components/arcadium/pulse";
import { Reveal } from "@/components/arcadium/reveal";
import { Scoreboard, type ScoreEntry } from "@/components/arcadium/scoreboard";
import { Showcase } from "@/components/arcadium/showcase";
import { AMBER, CYAN, GREEN, MAGENTA } from "@/components/arcadium/tokens";
import { useArcadeAudio } from "@/components/audio/use-arcade-audio";
import { useChroma } from "@/components/chroma/chroma-provider";
import { useScreenChrome } from "@/components/layout/chrome";
import type { OverviewData, PeriodKey } from "@/modules/statistics/application/overview-service";

const PERIODS: Array<{ key: PeriodKey; label: string; tint: string }> = [
  { key: "7d", label: "7 dias", tint: CYAN },
  { key: "30d", label: "30 dias", tint: AMBER },
  { key: "1y", label: "1 ano", tint: MAGENTA },
  { key: "all", label: "tudo", tint: GREEN },
];

export default function LabPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useScreenChrome({ title: "Bancada — Arcadium" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/overview?period=${period}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(setData)
      .catch((cause: unknown) => {
        if ((cause as Error).name !== "AbortError") setError("não consegui carregar /api/overview");
      });
    return () => controller.abort();
  }, [period]);

  if (error) return <p className="gy-page py-24 font-mono text-sm text-status-error">{error}</p>;

  return (
    <div className="flex flex-col">
      <Marquee />
      {data ? (
        <Lab data={data} period={period} onPeriod={setPeriod} />
      ) : (
        <p className="gy-page py-24 font-mono text-sm text-text-muted">carregando…</p>
      )}
    </div>
  );
}

function Lab({
  data,
  period,
  onPeriod,
}: {
  data: OverviewData;
  period: PeriodKey;
  onPeriod: (key: PeriodKey) => void;
}) {
  const albums = useMemo(() => data.topAlbums.filter((album) => album.coverUrl), [data.topAlbums]);
  const [focused, setFocused] = useState(0);
  const [onDeck, setOnDeck] = useState<number | null>(null);
  const [credits, setCredits] = useState(0);
  const { adoptCover } = useChroma();
  const audio = useArcadeAudio();

  const current = albums[focused];
  const deckAlbum = onDeck === null ? null : (albums[onDeck] ?? null);

  useEffect(() => {
    if (current) adoptCover(current.coverUrl, current.title);
  }, [current, adoptCover]);

  const putOnDeck = useCallback(
    (index: number) => {
      setFocused(index);
      setOnDeck(index);
      setCredits((value) => value + 1);
      audio.cue(albums[index]?.previewUrl);
    },
    [albums, audio],
  );

  const next = useCallback(() => {
    const playable = albums.map((album, index) => ({ album, index })).filter((entry) => entry.album.previewUrl);
    if (playable.length === 0) return;
    const at = playable.findIndex((entry) => entry.index === onDeck);
    const target = playable[(at + 1) % playable.length];
    const wasPlaying = audio.playing;
    setFocused(target.index);
    setOnDeck(target.index);
    setCredits((value) => value + 1);
    if (wasPlaying) audio.play(target.album.previewUrl);
    else audio.cue(target.album.previewUrl);
  }, [albums, onDeck, audio]);

  const scores: ScoreEntry[] = [
    { tag: "1up", label: "audições", value: data.summary.totalPlays, tint: AMBER },
    { tag: "2up", label: "artistas", value: data.summary.uniqueArtists, tint: CYAN },
    { tag: "3up", label: "faixas", value: data.summary.uniqueTracks, tint: MAGENTA },
    { tag: "hi", label: "minutos", value: data.summary.listeningMinutes, tint: GREEN },
  ];

  return (
    <>
      <Cabinet period={period} onPeriod={onPeriod} credits={credits} />

      <section className="relative overflow-hidden border-b border-rule py-14">
        <p
          aria-hidden
          className="display pointer-events-none absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 select-none text-center text-[clamp(4rem,15vw,13rem)] leading-[0.82] text-[#1d232b]"
        >
          ARCADIUM
        </p>
        <Pulse audio={audio} />

        <div className="relative">
          <div className="gy-page mb-12">
            <p className="eyebrow text-accent">mostruário — {albums.length} discos</p>
          </div>
          <Showcase
            albums={albums}
            focused={focused}
            onFocus={setFocused}
            onPick={putOnDeck}
            loadedTitle={deckAlbum?.title}
            bass={audio.bass}
          />
          <div className="gy-page mt-10 text-center">
            <p className="eyebrow text-accent">em foco</p>
            <p className="display mt-2 text-[clamp(1.5rem,3vw,2.4rem)] leading-[1.04]">{current?.title ?? "—"}</p>
            <p className="mt-1 font-mono text-xs text-text-muted">
              {current?.artistName ?? ""} · {current?.plays ?? 0} audições
            </p>
          </div>
        </div>
      </section>

      <Reveal className="gy-page py-16">
        <Scoreboard entries={scores} />
      </Reveal>

      <div className="pb-40" />

      <Jukebox album={deckAlbum} audio={audio} onNext={next} />
    </>
  );
}

/** O letreiro do gabinete: lâmpadas em volta, luz que não informa nada. */
function Marquee() {
  const bulbs = Array.from({ length: 44 });
  return (
    <div className="relative border-b border-rule bg-[#0a0c0e]">
      <div className="flex justify-between px-4 pt-2">
        {bulbs.map((_, index) => (
          <motion.span
            key={index}
            aria-hidden
            className="h-1 w-1 rounded-full"
            style={{ background: AMBER }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: (index % 8) * 0.22, ease: "easeInOut" }}
          />
        ))}
      </div>
      <p
        className="display py-3 text-center text-[clamp(1.1rem,2.4vw,1.8rem)] tracking-[0.5em] text-accent"
        style={{ textShadow: `0 0 22px ${AMBER}55` }}
      >
        ARCADIUM
      </p>
    </div>
  );
}

function Cabinet({
  period,
  onPeriod,
  credits,
}: {
  period: PeriodKey;
  onPeriod: (key: PeriodKey) => void;
  credits: number;
}) {
  return (
    <div className="sticky top-[var(--chrome-h)] z-30 border-b border-rule bg-[rgb(8_9_11/0.92)] backdrop-blur">
      <div className="gy-page flex items-center justify-between gap-6 py-3">
        <div className="flex items-center gap-3">
          {PERIODS.map((entry) => (
            <PushButton
              key={entry.key}
              tint={entry.tint}
              active={period === entry.key}
              onClick={() => onPeriod(entry.key)}
            >
              {entry.label}
            </PushButton>
          ))}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-muted">
          fichas <span className="tabular-nums text-accent">{String(credits).padStart(2, "0")}</span>
        </p>
      </div>
    </div>
  );
}

/** Botão convexo: cor no topo, afunda 2px no clique. */
function PushButton({
  children,
  tint,
  active,
  onClick,
}: {
  children: React.ReactNode;
  tint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative font-mono text-[10px] uppercase tracking-[0.18em] transition-transform active:translate-y-[2px]"
      style={{
        color: active ? "#08090b" : "#aab2b9",
        background: active ? tint : "transparent",
        border: `1px solid ${active ? tint : "#232a32"}`,
        padding: "7px 14px",
        boxShadow: active ? `0 0 18px ${tint}55, inset 0 -2px 0 rgb(0 0 0 / 0.35)` : "inset 0 -2px 0 rgb(0 0 0 / 0.5)",
      }}
    >
      {children}
    </button>
  );
}
