"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SECTIONS, sectionFor } from "@/components/layout/sections";
import styles from "./app-shell.module.css";
import { LogoutButton } from "./logout-button";
import { motion, useReducedMotion } from "framer-motion";

/**
 * O cabeçalho do app: o nome e as telas, em texto. A tela atual é a que
 * está sublinhada — sem cor, porque cor aqui é só do amigo. No celular a
 * fileira de telas vira um botão com o nome da tela atual, e as telas
 * abrem num caderno por cima: a conversa fica com a tela.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = Boolean(useReducedMotion());
  const current = sectionFor(pathname);
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => shellRef.current?.style.setProperty("--bar-h", `${bar.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    measure();
    return () => observer.disconnect();
  }, []);

  // trocou de tela, o caderno fecha
  useEffect(() => { setOpen(false); }, [pathname]);

  // aberto: a página atrás não rola, Esc fecha e o foco volta pro botão
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => { root.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={shellRef} className={styles.shell}>
      <header id="arcadium-header" ref={barRef} className={styles.bar}>
        <Link href="/overview" className={styles.wordmark} aria-label="Arcadium, voltar para a conversa">
          arcadium
        </Link>
        <nav className={styles.nav} aria-label="Telas">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={styles.link}
              aria-current={section.href === current.href ? "page" : undefined}
            >
              {section.label}
              {section.href === current.href && <motion.span className={styles.activeLine} layoutId="main-navigation-line" transition={{ duration: reduced ? 0 : .24, ease: "easeOut" }} />}
            </Link>
          ))}
        </nav>
        <div className={styles.logout}><LogoutButton /></div>
        <button ref={toggleRef} type="button" className={styles.menuToggle} aria-expanded={open} aria-controls="arcadium-caderno"
          onClick={() => setOpen((value) => !value)}>
          {open ? "fechar" : current.label} <span aria-hidden="true">{open ? "↑" : "↓"}</span>
        </button>
      </header>
      {open && (
        <nav ref={menuRef} id="arcadium-caderno" className={styles.caderno} aria-label="Telas">
          <ul>
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <Link href={section.href} aria-current={section.href === current.href ? "page" : undefined} onClick={() => setOpen(false)}>
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.cadernoFoot}><LogoutButton /></div>
        </nav>
      )}
      <main className={styles.page}>{children}</main>
    </div>
  );
}
