"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import type { ScreenKey } from "@/modules/ai-analysis/domain/ai-analysis.types";

interface Line {
  screen: ScreenKey;
  line: string;
}

/**
 * A legenda da tela vem de um lote guardado no banco, gerado no máximo
 * uma vez por dia. A cada visita sorteamos uma das frases daquela tela —
 * o app muda de conversa sem gastar uma chamada nova.
 */
export function ScreenLine({ screen, fallback }: { screen: ScreenKey; fallback: string }) {
  const [line, setLine] = useState(fallback);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/ai/lines", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { lines?: Line[] } | null) => {
        const options = (payload?.lines ?? []).filter((entry) => entry.screen === screen);
        if (options.length === 0) return;
        setLine(options[Math.floor(Math.random() * options.length)].line);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [screen]);

  return (
    <motion.p
      key={line}
      className="liner mt-5 max-w-[52ch]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.15 }}
    >
      {line}
    </motion.p>
  );
}
