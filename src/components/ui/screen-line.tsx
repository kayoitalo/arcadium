"use client";

import { useEffect, useState } from "react";
import { Voice } from "@/components/ui/voice";
import type { ScreenKey } from "@/modules/ai-analysis/domain/ai-analysis.types";

interface Line {
  screen: ScreenKey;
  line: string;
}

/**
 * O comentário do Gemini sobre a tela vem de um lote guardado no banco,
 * gerado no máximo uma vez por dia; a cada visita sorteamos uma frase.
 * Só vai para o bloco do Gemini o que o Gemini escreveu — sem lote, a
 * explicação padrão da tela aparece como texto comum.
 */
export function ScreenLine({
  screen,
  label,
  fallback,
}: {
  screen: ScreenKey;
  label: string;
  fallback: string;
}) {
  const [line, setLine] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/ai/lines", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { lines?: Line[] } | null) => {
        const options = (payload?.lines ?? []).filter((entry) => entry.screen === screen);
        if (options.length > 0) setLine(options[Math.floor(Math.random() * options.length)].line);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setSettled(true);
      });

    return () => controller.abort();
  }, [screen]);

  if (line) {
    return (
      <Voice label={label} className="mt-6">
        {line}
      </Voice>
    );
  }

  if (!settled) return null;

  return <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.66] text-text-secondary">{fallback}</p>;
}
