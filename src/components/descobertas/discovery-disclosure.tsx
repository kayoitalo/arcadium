"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Native summary activation/keyboard semantics; retain the body only for closing. */
export function DiscoveryDisclosure({ id, className, bodyClassName, summary, children, open: controlledOpen, onOpenChange }: {
  id?: string; className?: string; bodyClassName?: string; summary: ReactNode; children: ReactNode;
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const generatedId = useId();
  const bodyId = `${id ?? generatedId}-body`;
  const reduced = Boolean(useReducedMotion());
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const [retained, setRetained] = useState(open);
  const body = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  useLayoutEffect(() => {
    if (open) setRetained(true);
    else {
      if (body.current?.contains(document.activeElement)) summaryRef.current?.focus();
      if (reduced) setRetained(false);
    }
  }, [open, reduced]);
  return <details id={id} className={className} open={open || retained} data-expanded={open}>
    <summary ref={summaryRef} aria-expanded={open} aria-controls={bodyId} onClick={(event) => {
      event.preventDefault();
      setLocalOpen(!open); onOpenChange?.(!open);
    }}>{summary}</summary>
    <motion.div id={bodyId} ref={body} inert={!open} aria-hidden={!open} style={{ overflow: "hidden" }}
      initial={false} animate={open ? "open" : "closed"}
      variants={{ open: { height: "auto", opacity: 1 }, closed: { height: 0, opacity: 0 } }}
      transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
      onAnimationComplete={(phase) => { if (phase === "closed" && !openRef.current) setRetained(false); }}>
      {(open || retained) && <div className={bodyClassName}>{children}</div>}
    </motion.div>
  </details>;
}
