"use client";

import { useEffect } from "react";

/** O título da aba com o que está tocando: "▶ Faixa · Artista · Arcadium". Função pura, pra testar. */
export function tabTitle(base: string, playing: string | null | undefined): string {
  const label = playing?.replace(/\s+/g, " ").trim();
  return label ? `▶ ${label} · ${base}` : base;
}

/**
 * Enquanto uma prévia toca, a aba do navegador diz qual é. Parou, o
 * título volta a ser o da casa. Nada além do nome da faixa sai daqui.
 */
export function useTabTitle(playing: string | null | undefined) {
  useEffect(() => {
    if (!playing) return;
    const base = document.title;
    document.title = tabTitle(base, playing);
    return () => {
      document.title = base;
    };
  }, [playing]);
}
