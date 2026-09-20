"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Cada segmento tem 3px acesos e 2px de vão — o mesmo passo do CSS. */
export const SEGMENT_PX = 5;

/**
 * Quanto a coluna passa do valor antes de assentar. Medidor de ponteiro
 * tem inércia: o sinal chega, a agulha vai além e volta. Em segmentos,
 * para o excesso cair na grade do LED e não entre dois.
 */
const OVERSHOOT = 0.14;

/** Altura do ponto de pico, em px. Um segmento aceso, sem o vão. */
const DOT_PX = 3;

/**
 * Onde a coluna para, e até onde ela passa antes de parar. O excesso é de
 * pelo menos um segmento: sem isso, coluna baixa não teria para onde ir.
 */
export function columnReach(value: number, max: number, segments: number) {
  const lit = value <= 0 ? 0 : Math.max(1, Math.round((value / max) * segments));
  if (lit === 0) return { lit: 0, settled: 0, peak: 0 };
  const extra = Math.max(1, Math.round(lit * OVERSHOOT));
  const peak = Math.min(segments, lit + extra);
  return { lit, settled: lit * SEGMENT_PX, peak: peak * SEGMENT_PX };
}

/**
 * Colunas de LED: a matriz apagada atrás e os segmentos acesos por cima,
 * proporcionais ao maior valor. A coluna "hot" acende em branco. É a peça
 * comum do espectro de dias e do mapa de horas.
 *
 * A subida é de medidor, não de barra de progresso: a coluna passa do
 * valor e assenta, e um ponto marca o pico, segura no alto e desce devagar
 * até pousar. O ponto some ao encostar — branco permanente já quer dizer
 * outra coisa aqui, que é a coluna do pico do período.
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
        const { lit, settled, peak } = columnReach(value, max, segments);
        const key = columnKeys?.[index] ?? String(index);
        const delay = Math.min(0.5, index * 0.008);
        // a coluna tem a altura do pico e é recortada por cima: assim ela
        // passa do valor sem animar altura, que custaria layout em 40 colunas
        const clipToSettled = `inset(${((peak - settled) / peak) * 100}% 0 0 0)`;

        return (
          <div
            key={key}
            className="spectrum-col relative h-full min-w-0 flex-1"
            onPointerEnter={() => onHover?.(index)}
          >
            {lit > 0 && (
              <>
                <motion.div
                  className="spectrum-lit absolute inset-x-0 bottom-0"
                  data-hot={index === hot}
                  style={{ height: peak }}
                  initial={reduced ? false : { clipPath: "inset(100% 0 0 0)" }}
                  animate={{ clipPath: ["inset(100% 0 0 0)", "inset(0% 0 0 0)", clipToSettled] }}
                  transition={{
                    duration: 0.9,
                    times: [0, 0.45, 1],
                    ease: ["easeOut", "easeInOut"],
                    delay,
                  }}
                />

                {!reduced && (
                  <motion.div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 bg-text-primary"
                    style={{ height: DOT_PX }}
                    initial={{ y: 0, opacity: 0 }}
                    animate={{
                      y: [0, -(peak - DOT_PX), -(peak - DOT_PX), -(settled - DOT_PX)],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 1.7,
                      times: [0, 0.26, 0.5, 1],
                      ease: ["easeOut", "linear", "easeIn"],
                      delay,
                    }}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
