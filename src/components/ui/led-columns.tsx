"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/components/ui/motion";

/** Cada segmento tem 3px acesos e 2px de vão — o mesmo passo do CSS. */
export const SEGMENT_PX = 5;

/**
 * Colunas de LED: a matriz apagada atrás e os segmentos acesos por cima,
 * proporcionais ao maior valor. A coluna "hot" acende em branco. É a peça
 * comum do espectro de dias e do mapa de horas.
 */
export function LedColumns({
  values,
  columnKeys,
  hot = null,
  segments = 24,
  onHover,
  className = "",
}: {
  values: number[];
  /** Chaves estáveis: trocar a chave refaz a subida da coluna. */
  columnKeys?: string[];
  hot?: number | null;
  segments?: number;
  onHover?: (index: number | null) => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...values);

  return (
    <div
      className={`flex items-end gap-[2px] ${className}`}
      style={{ height: segments * SEGMENT_PX }}
      onPointerLeave={() => onHover?.(null)}
    >
      {values.map((value, index) => {
        const lit = value <= 0 ? 0 : Math.max(1, Math.round((value / max) * segments));
        const key = columnKeys?.[index] ?? String(index);

        return (
          <div
            key={key}
            className="spectrum-col relative h-full min-w-0 flex-1"
            onPointerEnter={() => onHover?.(index)}
          >
            {lit > 0 && (
              <motion.div
                className="spectrum-lit absolute inset-x-0 bottom-0"
                data-hot={index === hot}
                style={{ height: lit * SEGMENT_PX }}
                initial={reduced ? false : { clipPath: "inset(100% 0 0 0)" }}
                animate={{ clipPath: "inset(0% 0 0 0)" }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: Math.min(0.5, index * 0.008) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
