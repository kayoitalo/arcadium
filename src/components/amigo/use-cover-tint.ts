"use client";

import { useEffect, useState } from "react";
import { coverProxyUrl } from "@/lib/cover";
import { readTint, type Tint } from "@/lib/cover-tint";

/** A cor de cada capa já medida nesta visita: a mesma capa não é lida duas vezes. */
const known = new Map<string, Tint | null>();
const MAX_KNOWN = 400;

export function rememberTint(source: string, tint: Tint | null) {
  known.set(source, tint);
  while (known.size > MAX_KNOWN) known.delete(known.keys().next().value!);
}

export function knownTint(source?: string | null): Tint | null | undefined {
  return source ? known.get(source) : undefined;
}

/**
 * A cor de uma capa que não está na tela como imagem (a lombada do disco).
 * Carrega a miniatura pelo proxy, mede e guarda; sem capa, sem cor.
 */
export function useCoverTint(source?: string | null): Tint | null {
  const [tint, setTint] = useState<Tint | null>(() => knownTint(source) ?? null);
  useEffect(() => {
    const src = coverProxyUrl(source);
    if (!source || !src) {
      setTint(null);
      return;
    }
    const saved = known.get(source);
    if (saved !== undefined) {
      setTint(saved);
      return;
    }
    setTint(null);
    let alive = true;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const value = readTint(image);
      rememberTint(source, value);
      if (alive) setTint(value);
    };
    image.onerror = () => rememberTint(source, null);
    image.src = src;
    return () => {
      alive = false;
    };
  }, [source]);
  return tint;
}
