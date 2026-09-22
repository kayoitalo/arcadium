"use client";

import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";
import { CYAN, SCANLINES } from "@/components/arcadium/tokens";

/**
 * A tela onde a opinião mora.
 *
 * O LCD verde-oliva anterior era a única superfície do produto com
 * material próprio, e por isso parecia adesivo colado. Aqui a voz passa a
 * morar numa tela do próprio gabinete: mesma moldura dupla da jukebox e do
 * placar, vidro de tubo, e a etiqueta em ciano marcando que é controle, não
 * dado. O texto continua sendo a única coisa que o modelo escreveu.
 */
export function ScreenPanel({
  label,
  children,
  size = "md",
  state = "on",
}: PropsWithChildren<{
  label: string;
  size?: "md" | "lg";
  /** "writing" acende o cursor: o pacote ainda está sendo escrito. */
  state?: "on" | "writing";
}>) {
  return (
    <div className="border border-border-strong p-[3px]">
      <div className="relative border border-rule bg-[#080a0c] px-4 py-4" style={{ backgroundImage: SCANLINES }}>
        <div className="flex items-center gap-2">
          <motion.span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: CYAN }}
            animate={state === "writing" ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
            transition={{ duration: 1.2, repeat: state === "writing" ? Infinity : 0 }}
          />
          <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: CYAN }}>
            {label}
          </p>
        </div>

        <p
          className={`mt-3 leading-relaxed text-text-secondary ${
            size === "lg" ? "text-[15px]" : "font-mono text-[12px]"
          }`}
        >
          {children}
          {state === "writing" && (
            <motion.span
              aria-hidden
              className="ml-1 inline-block h-[1em] w-[0.5em] align-[-0.1em]"
              style={{ background: CYAN }}
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </p>
      </div>
    </div>
  );
}
