"use client";

import { useEffect, useState } from "react";
import { pickFresh } from "@/components/ai/pick-fresh";
import { Voice } from "@/components/ui/voice";
import type { ScreenKey } from "@/modules/ai-analysis/domain/ai-analysis.types";
import type { PeriodKey } from "@/modules/statistics/application/overview-service";

interface Line {
  screen: ScreenKey;
  line: string;
}

/**
 * O comentário do Gemini sobre a tela vem dos pacotes guardados no banco;
 * a cada visita sorteamos uma frase, sem repetir a última que a pessoa viu.
 * Só vai para o bloco do Gemini o que o Gemini escreveu — sem pacote, a
 * explicação padrão da tela aparece como texto comum.
 */
export function ScreenLine({
  screen,
  label,
  fallback,
  period,
}: {
  screen: ScreenKey;
  label: string;
  fallback: string;
  /** Telas com intervalo escolhido pedem só as frases dele. */
  period?: PeriodKey;
}) {
  const [line, setLine] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLine(null);
    setSettled(false);

    const query = new URLSearchParams({ screen });
    if (period) query.set("period", period);

    fetch(`/api/ai/lines?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { lines?: Line[]; source?: string } | null) => {
        // a reserva já tem lugar próprio na tela: no bloco do Gemini, só o Gemini
        if (payload?.source !== "ai") return;
        const options = (payload.lines ?? []).filter((entry) => entry.screen === screen);
        const choice = pickFresh(options, `gy:line:${screen}:${period ?? "todos"}`, (entry) => entry.line);
        if (choice) setLine(choice.line);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setSettled(true);
      });

    return () => controller.abort();
  }, [screen, period]);

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
