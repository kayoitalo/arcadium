"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Disc3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ResilientCoverProps {
  src?: string | null;
  alt: string;
  label?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}

function colorPair(value: string) {
  let hash = 0;
  for (const char of value) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return [`hsl(${hue} 32% 24%)`, `hsl(${(hue + 38) % 360} 26% 10%)`];
}

export function ResilientCover({ src, alt, label = alt, className = "", imageClassName = "", priority = false }: ResilientCoverProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(src ? "loading" : "failed");
  const colors = useMemo(() => colorPair(label), [label]);
  useEffect(() => setStatus(src ? "loading" : "failed"), [src]);

  return <div className={`relative overflow-hidden bg-surface-soft ${className}`}>
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center" style={{ background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})` }}>
      <Disc3 className="h-7 w-7 text-white/35" />
      <span className="line-clamp-2 font-serif text-xs leading-tight text-white/70">{label}</span>
    </div>
    <AnimatePresence>{src && status !== "failed" && <motion.img key={src} src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onLoad={() => setStatus("loaded")} onError={() => setStatus("failed")} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: status === "loaded" ? 1 : 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`} />}</AnimatePresence>
    {status === "loading" && <div className="absolute inset-0 animate-pulse bg-white/[0.035]" />}
  </div>;
}
