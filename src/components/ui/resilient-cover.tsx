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
  /** Em miniatura (abaixo de ~64px) o título não cabe: só a bolacha fica. */
  compact?: boolean;
}

function hueFor(value: string): number {
  let hash = 0;
  for (const char of value) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

/**
 * A maioria dos álbuns não tem capa armazenada, então o estado sem
 * imagem não pode ser um buraco: é uma bolacha prensada em branco, com
 * os sulcos desenhados, o rótulo no centro e o título gravado no pé.
 * A cor vem do nome, então o mesmo álbum tem sempre a mesma bolacha.
 */
export function ResilientCover({
  src,
  alt,
  label = alt,
  className = "",
  imageClassName = "",
  priority = false,
  compact = false,
}: ResilientCoverProps) {
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
            radial-gradient(circle at 50% 50%,
              hsl(${hue} 12% 20%) 0 21%,
              transparent 21.5%),
            radial-gradient(circle at 50% 50%,
              hsl(${hue} 6% 6%) 0 2.5%,
              transparent 3%),
            repeating-radial-gradient(circle at 50% 50%,
              hsl(${hue} 10% 13%) 0 3px,
              hsl(${hue} 12% 9%) 3px 6px),
            hsl(${hue} 14% 10%)`,
        }}
      >
        {!compact && <span className="data line-clamp-3 leading-relaxed text-white/45">{label}</span>}
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
