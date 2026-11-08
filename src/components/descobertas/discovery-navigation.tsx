"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useSelection } from "./selection-provider";
import styles from "./discovery-navigation.module.css";
export const DISCOVERY_PAGES = [
  { href: "/discovery", title: "Descobrir", hint: "a próxima faixa" },
  { href: "/discovery/week", title: "Semana", hint: "as portas da semana" },
  { href: "/discovery/albums", title: "Álbuns", hint: "do começo ao fim" },
  { href: "/discovery/collection", title: "Para depois", hint: "o que você separou" },
  { href: "/discovery/memory", title: "Caminhos", hint: "teu diário de escuta" },
] as const;

/** Quantas faixas estão em "Para depois": o número pulsa quando chega mais uma, e é ali que a faixa guardada foi parar. */
function KeptCount() {
  const { items, ready } = useSelection();
  if (!ready || items.length === 0) return null;
  return <span key={items.length} className={styles.count} aria-label={`${items.length} ${items.length === 1 ? "faixa" : "faixas"}`}>{items.length}</span>;
}

export function DiscoveryNavigation({ pathname, showWeekly = true, kept }: { pathname: string; showWeekly?: boolean; kept?: ReactNode }) {
  const reduced = Boolean(useReducedMotion());
  const pages = DISCOVERY_PAGES.filter((page) => showWeekly || page.href !== "/discovery/week");
  return <LayoutGroup><nav id="discovery-navigation" className={styles.nav} aria-label="Áreas da descoberta">{pages.map((page) => {
    const active = pathname === page.href;
    return <Link key={page.href} href={page.href} className={styles.tab} aria-current={active ? "page" : undefined}>
      <strong>{page.title}{page.href === "/discovery/collection" && kept}</strong><small>{page.hint}</small>
      {active && <motion.span className={styles.line} layoutId="discovery-tab-line" transition={{ duration: reduced ? 0 : .24, ease: "easeOut" }} />}
    </Link>;
  })}</nav></LayoutGroup>;
}
export function DiscoveryNavigationCurrent({ showWeekly = true }: { showWeekly?: boolean }) {
  return <DiscoveryNavigation pathname={usePathname()} showWeekly={showWeekly} kept={<KeptCount />} />;
}
export function DiscoveryPageTransition({ children }: { children: ReactNode }) {
  const reduced = Boolean(useReducedMotion());
  return <motion.div data-discovery-page initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2, ease: "easeOut" }}>{children}</motion.div>;
}
