"use client";

import { motion, useIsPresent, useReducedMotion } from "framer-motion";
import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";

/** A visit matters too: resuming the same item must wait for its new DOM. */
export function useDiscoveryScene(identity: string | null) {
  const [scene, setScene] = useState({ identity, visit: 0, ready: false });
  if (scene.identity !== identity) setScene({ identity, visit: scene.visit + 1, ready: false });
  const onReady = useCallback((visit: number) => {
    setScene((current) => current.visit === visit && current.identity !== null && !current.ready
      ? { ...current, ready: true } : current);
  }, []);
  return { ...scene, key: `${scene.visit}:${scene.identity}`, onReady };
}

/** Outgoing content stays visible briefly, but cannot receive another action. */
export function DiscoveryTransition({ visit, onReady, children }: {
  visit: number; onReady: (visit: number) => void; children: ReactNode;
}) {
  const reduced = Boolean(useReducedMotion());
  const present = useIsPresent();
  const [entered, setEntered] = useState(reduced);
  useLayoutEffect(() => {
    if (reduced && present) { setEntered(true); onReady(visit); }
  }, [reduced, present, onReady, visit]);
  return <motion.div
    data-discovery-scene={present && entered ? "ready" : "changing"}
    inert={!present || !entered} aria-hidden={!present || !entered}
    onClickCapture={(event) => {
      if (!present || !entered) { event.preventDefault(); event.stopPropagation(); }
    }}
    initial={reduced ? false : "enter"} animate="visible" exit="leave"
    variants={{ enter: { opacity: 0, x: 6 }, visible: { opacity: 1, x: 0 }, leave: { opacity: 0, x: reduced ? 0 : -6 } }}
    transition={{ duration: reduced ? 0 : 0.12, ease: "easeOut" }}
    onAnimationComplete={(phase) => {
      if (phase === "visible" && present) { setEntered(true); onReady(visit); }
    }}
  >{children}</motion.div>;
}
