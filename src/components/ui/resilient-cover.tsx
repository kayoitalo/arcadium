"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { coverProxyUrl } from "@/lib/chroma/chroma";

interface ResilientCoverProps {
  src?: string | null;
  alt: string;
  label?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}

function hueFor(value: string): number {
  let hash = 0;
  for (const char of value) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

/**
 * A maioria dos álbuns não tem capa armazenada, então o estado sem
 * imagem não pode ser um buraco: é uma bolacha prensada em branco,
 * com os sulcos desenhados e o título gravado.
 */
export function ResilientCover({ src, alt, label = alt, className = "", imageClassName = "", priority = false }: ResilientCoverProps) {
  const proxied = useMemo(() => coverProxyUrl(src), [src]);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(proxied ? "loading" : "failed");
  const hue = useMemo(() => hueFor(label), [label]);

  useEffect(() => setStatus(proxied ? "loading" : "failed"), [proxied]);

  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      <div
        className="absolute inset-0 flex items-end p-3"
        style={{
          background: `
            repeating-radial-gradient(circle at 50% 50%,
              hsl(${hue} 14% 13%) 0 3px,
              hsl(${hue} 16% 9%) 3px 6px),
            hsl(${hue} 18% 10%)`,
        }}
      >
        <span className="font-display line-clamp-3 text-[11px] leading-tight text-white/55">{label}</span>
      </div>

      <AnimatePresence>
        {proxied && status !== "failed" && (
          <motion.img
            key={proxied}
            src={proxied}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("failed")}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: status === "loaded" ? 1 : 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
