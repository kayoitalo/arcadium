"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PlayerState {
  playing: boolean;
  /** 0..1 — quanto da prévia já correu. */
  progress: number;
  loading: boolean;
  failed: boolean;
}

const IDLE: PlayerState = { playing: false, progress: 0, loading: false, failed: false };

/**
 * Um único <audio> por tela: trocar de faixa reaproveita o mesmo elemento
 * em vez de empilhar players. O navegador não deixa tocar sem gesto do
 * usuário, então todo play parte de um clique ou tecla.
 */
export function usePreviewPlayer(previewUrl: string | null | undefined) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>(IDLE);

  // um elemento só, criado na primeira vez que a tela precisa dele
  useEffect(() => {
    if (audioRef.current) return;
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // troca de faixa: para o que tocava e zera o progresso
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // play(url) já trocou a faixa dentro do clique: não interromper o que começou
    if (previewUrl && audio.src === previewUrl) return;

    audio.pause();
    setState(previewUrl ? IDLE : { ...IDLE, failed: true });

    if (previewUrl) {
      audio.src = previewUrl;
      audio.load();
    }
  }, [previewUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (!audio.duration || Number.isNaN(audio.duration)) return;
      setState((current) => ({ ...current, progress: audio.currentTime / audio.duration }));
    };
    const onEnded = () => setState((current) => ({ ...current, playing: false, progress: 1 }));
    const onError = () => setState({ ...IDLE, failed: true });
    const onPlaying = () => setState((current) => ({ ...current, playing: true, loading: false }));
    const onWaiting = () => setState((current) => ({ ...current, loading: true }));
    const onPause = () => setState((current) => ({ ...current, playing: false }));

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  /**
   * Toca uma URL agora, dentro do gesto que chamou. Serve para quem troca
   * de faixa e quer som no mesmo clique — esperar o próximo render para
   * trocar a fonte faria o navegador recusar o play.
   */
  const play = useCallback((url?: string | null) => {
    const audio = audioRef.current;
    const target = url ?? previewUrl;
    if (!audio || !target) return;

    if (audio.src !== target) {
      audio.src = target;
      setState({ ...IDLE, loading: true });
    } else {
      setState((current) => ({ ...current, loading: true, failed: false }));
    }
    void audio.play().catch(() => setState({ ...IDLE, failed: true }));
  }, [previewUrl]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !previewUrl) return;

    if (audio.paused) play(previewUrl);
    else audio.pause();
  }, [previewUrl, play]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setState((current) => ({ ...current, playing: false, progress: 0 }));
  }, []);

  return { ...state, available: Boolean(previewUrl), play, toggle, stop };
}

export type PreviewPlayer = ReturnType<typeof usePreviewPlayer>;
