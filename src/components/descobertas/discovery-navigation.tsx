"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import styles from "./discovery-navigation.module.css";
export const DISCOVERY_PAGES = [
  { href: "/discovery", title: "Descobrir", hint: "a próxima faixa" },
  { href: "/discovery/albums", title: "Álbuns", hint: "do começo ao fim" },
  { href: "/discovery/collection", title: "Para depois", hint: "o que você separou" },
  { href: "/discovery/memory", title: "Caminhos", hint: "teu diário de escuta" },
] as const;
export function DiscoveryNavigation({ pathname }: { pathname: string }) {
  const reduced = Boolean(useReducedMotion());
  return <LayoutGroup><nav id="discovery-navigation" className={styles.nav} aria-label="Áreas da descoberta">{DISCOVERY_PAGES.map((page, index) => {
    const active = pathname === page.href;
    return <Link key={page.href} href={page.href} className={styles.tab} aria-current={active ? "page" : undefined}>
      <span className={styles.number} aria-hidden="true">0{index + 1}</span><span><strong>{page.title}</strong><small>{page.hint}</small></span>
      {active && <motion.span className={styles.line} layoutId="discovery-tab-line" transition={{ duration: reduced ? 0 : .24, ease: "easeOut" }} />}
    </Link>;
  })}</nav></LayoutGroup>;
}
export function DiscoveryNavigationCurrent() { return <DiscoveryNavigation pathname={usePathname()} />; }
export function DiscoveryPageTransition({ children }: { children: ReactNode }) {
  const reduced = Boolean(useReducedMotion());
  return <motion.div data-discovery-page initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2, ease: "easeOut" }}>{children}</motion.div>;
}
