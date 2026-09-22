"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnimationFrame, useMotionValue } from "framer-motion";
import {
  BAND_EDGES,
  BAND_FLOORS,
  BANDS,
  FFT_SIZE,
  LEVEL_BINS,
  clamp01,
} from "@/components/arcadium/tokens";

/**
 * Player com analisador.
 *
 * O usePreviewPlayer não serve aqui porque não marca crossOrigin — e sem
 * isso o AnalyserNode lê silêncio. A prévia do iTunes responde
 * access-control-allow-origin: *, então com crossOrigin="anonymous" dá
 * para ler o espectro de verdade sem quebrar a reprodução.
 *
 * Nível, grave e as barras saem como MotionValue e ref de propósito: são
 * atualizados a cada quadro e não podem passar por estado do React.
 */
export function useArcadeAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const level = useMotionValue(0);
  const bass = useMotionValue(0);
  /** Altura de cada barra do espectro, 0..1. */
  const bands = useRef<number[]>(new Array(BANDS).fill(0));

  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState<string | null>(null);

  /**
   * Tudo aqui precisa acontecer dentro do gesto que pediu o som:
   * createMediaElementSource só pode ser chamado uma vez por elemento, e o
   * AudioContext nasce suspenso até um clique. Scroll não conta como gesto.
   */
  const ensure = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "none";
      audio.addEventListener("playing", () => setPlaying(true));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("ended", () => setPlaying(false));
      audio.addEventListener("error", () => {
        setFailed(true);
        setPlaying(false);
      });
      audio.addEventListener("timeupdate", () => {
        if (audio.duration && !Number.isNaN(audio.duration)) setProgress(audio.currentTime / audio.duration);
      });
      audioRef.current = audio;
    }

    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const node = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.72;
      node.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    }

    void ctxRef.current.resume();
    return audioRef.current;
  }, []);

  /**
   * Põe o disco no deck sem tocar. Som só sai quando alguém aperta play —
   * ninguém quer levar susto de áudio ao clicar numa capa.
   */
  const cue = useCallback(
    (url?: string | null) => {
      if (!url) return;
      const audio = ensure();
      setFailed(false);
      if (audio.src !== url) {
        audio.pause();
        audio.src = url;
        setSource(url);
        setProgress(0);
      }
    },
    [ensure],
  );

  const play = useCallback(
    (url?: string | null) => {
      const audio = ensure();
      if (url && audio.src !== url) {
        audio.src = url;
        setSource(url);
        setProgress(0);
      }
      if (!audio.src) return;
      setFailed(false);
      void audio.play().catch(() => setFailed(true));
    },
    [ensure],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setProgress(0);
  }, []);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      void ctxRef.current?.close();
    },
    [],
  );

  useAnimationFrame(() => {
    const analyser = analyserRef.current;
    const data = dataRef.current;
    if (!analyser || !data || !playing) {
      level.set(level.get() * 0.88);
      bass.set(bass.get() * 0.88);
      for (let i = 0; i < BANDS; i += 1) bands.current[i] *= 0.86;
      return;
    }

    analyser.getByteFrequencyData(data);

    const span = Math.min(LEVEL_BINS, data.length);
    let total = 0;
    for (let i = 0; i < span; i += 1) total += data[i];
    let low = 0;
    for (let i = 0; i < 12; i += 1) low += data[i];

    /**
     * Música masterizada vive perto do topo da escala: normalizar por 255
     * deixa tudo grudado em 1 e o pulso para de pulsar. Estes pisos vieram
     * de medir a prévia real — abaixo deles é ruído de fundo.
     */
    level.set(clamp01((total / span - 70) / 95));
    bass.set(clamp01((low / 12 - 140) / 105));

    /** A barra cai devagar em vez de piscar: pico que desce, como medidor. */
    for (let i = 0; i < BANDS; i += 1) {
      const from = BAND_EDGES[i];
      const to = Math.max(from + 1, Math.min(BAND_EDGES[i + 1], data.length));
      let sum = 0;
      for (let bin = from; bin < to; bin += 1) sum += data[bin];
      const value = clamp01((sum / (to - from) - BAND_FLOORS[i]) / 78);
      bands.current[i] = Math.max(value, bands.current[i] * 0.88);
    }
  });

  return { playing, failed, progress, source, level, bass, bands, cue, play, toggle, stop };
}

export type ArcadeAudio = ReturnType<typeof useArcadeAudio>;
