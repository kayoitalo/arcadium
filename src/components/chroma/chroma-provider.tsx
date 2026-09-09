"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { chromaFromPixels, coverProxyUrl, NEUTRAL_CHROMA, type Chroma } from "@/lib/chroma/chroma";

interface ChromaContextValue {
  chroma: Chroma;
  /** Extrai o croma da capa e tinge a interface inteira. */
  adoptCover: (coverUrl?: string | null) => void;
  reset: () => void;
}

const ChromaContext = createContext<ChromaContextValue | null>(null);

const SAMPLE_SIZE = 48;

function applyToDocument(chroma: Chroma) {
  const root = document.documentElement;
  root.style.setProperty("--chroma-h", String(chroma.h));
  root.style.setProperty("--chroma-s", `${chroma.s}%`);
  root.style.setProperty("--chroma-l", `${chroma.l}%`);
}

/**
 * Decodifica a capa fora do pipeline de pintura. createImageBitmap não
 * depende da aba estar visível — HTMLImageElement.decode() pode nunca
 * resolver numa aba em segundo plano, e aí a cor nunca chegaria.
 */
async function decodeCover(proxiedUrl: string): Promise<CanvasImageSource | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const response = await fetch(proxiedUrl);
      if (!response.ok) return null;
      return await createImageBitmap(await response.blob());
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = proxiedUrl;
  });
}

async function readChroma(proxiedUrl: string): Promise<Chroma | null> {
  const source = await decodeCover(proxiedUrl);
  if (!source) return null;

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  try {
    context.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return chromaFromPixels(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
  } catch {
    return null;
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
  }
}

export function ChromaProvider({ children }: PropsWithChildren) {
  const [chroma, setChroma] = useState<Chroma>(NEUTRAL_CHROMA);
  const cache = useRef(new Map<string, Chroma>());
  const pending = useRef<string | null>(null);

  useEffect(() => {
    applyToDocument(chroma);
  }, [chroma]);

  const adoptCover = useCallback((coverUrl?: string | null) => {
    const proxied = coverProxyUrl(coverUrl);
    if (!proxied) {
      setChroma(NEUTRAL_CHROMA);
      return;
    }

    const cached = cache.current.get(proxied);
    if (cached) {
      setChroma(cached);
      return;
    }

    pending.current = proxied;
    void readChroma(proxied).then((extracted) => {
      const resolved = extracted ?? NEUTRAL_CHROMA;
      cache.current.set(proxied, resolved);
      if (pending.current === proxied) setChroma(resolved);
    });
  }, []);

  const reset = useCallback(() => {
    pending.current = null;
    setChroma(NEUTRAL_CHROMA);
  }, []);

  const value = useMemo(() => ({ chroma, adoptCover, reset }), [chroma, adoptCover, reset]);

  return <ChromaContext.Provider value={value}>{children}</ChromaContext.Provider>;
}

export function useChroma(): ChromaContextValue {
  const context = useContext(ChromaContext);
  if (!context) throw new Error("useChroma precisa estar dentro de <ChromaProvider>.");
  return context;
}
