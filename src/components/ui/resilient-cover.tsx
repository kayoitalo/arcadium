"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { coverProxyUrl } from "@/lib/chroma/chroma";

interface ResilientCoverProps {
  src?: string | null;
  alt: string;
  label?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** Em miniatura (abaixo de ~64px) o título não cabe: só o slot fica. */
  compact?: boolean;
  /** Desligue quando a legenda ao lado já traz o título. */
  caption?: boolean;
}

/**
 * A maioria dos álbuns não tem capa armazenada. Sem imagem, o lugar
 * dela é um slot vazio e honesto — plano, com o título impresso — e
 * não um disco inventado: só tem volume o que existe de verdade.
 */
export function ResilientCover({
  src,
  alt,
  label = alt,
  className = "",
  imageClassName = "",
  priority = false,
  compact = false,
  caption = true,
}: ResilientCoverProps) {
  const proxied = useMemo(() => coverProxyUrl(src), [src]);
  const node = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(proxied ? "loading" : "failed");

  /**
   * Capa que já está no cache termina de carregar antes do React anexar o
   * onLoad, e aí o evento nunca chega: a imagem ficaria invisível para
   * sempre, com o slot "sem capa" aparecendo no lugar de uma capa que
   * existe. Por isso a montagem também pergunta ao elemento se ele já
   * terminou.
   */
  useEffect(() => {
    if (!proxied) {
      setStatus("failed");
      return;
    }
    setStatus(node.current?.complete && node.current.naturalWidth > 0 ? "loaded" : "loading");
  }, [proxied]);

  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      <div className="absolute inset-0 flex flex-col justify-between border border-rule bg-[#0b0d10] p-3">
        {!compact && (
          <>
            <span className="micro text-text-muted">sem capa</span>
            {caption && <span className="data line-clamp-3 leading-relaxed text-text-muted">{label}</span>}
          </>
        )}
      </div>

      <AnimatePresence>
        {proxied && status !== "failed" && (
          <motion.img
            key={proxied}
            ref={node}
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
