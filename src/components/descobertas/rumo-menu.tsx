"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./descobertas.module.css";

export interface RumoItem {
  label: string;
  /** → vai pra outro lugar, ← volta, ↓ abre aqui embaixo. */
  arrow: "→" | "←" | "↓";
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Sair do caminho atual: fica depois de um fio, mais apagado. */
  away?: boolean;
}

/**
 * Tudo que muda o caminho num lugar só. Antes eram quatro ações espalhadas
 * pela tela (trocar, ajustar, buscar mais, a partir desta); a faixa fica
 * com a frente livre e o rumo continua a um toque.
 */
export function RumoMenu({ items, note }: { items: RumoItem[]; note?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const stay = items.filter((item) => !item.away);
  const away = items.filter((item) => item.away);
  const row = (item: RumoItem) => {
    const body = <>{item.label}<span aria-hidden="true">{item.arrow}</span></>;
    return item.href
      ? <Link key={item.label} href={item.href} className={styles.rumoItem} data-away={item.away || undefined} onClick={() => setOpen(false)}>{body}</Link>
      : <button key={item.label} type="button" className={styles.rumoItem} data-away={item.away || undefined} disabled={item.disabled}
        onClick={() => { setOpen(false); item.onSelect?.(); }}>{body}</button>;
  };

  return <div className={styles.rumo}>
    <button ref={button} type="button" className={styles.rumoButton} aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
      mudar o rumo <span aria-hidden="true">{open ? "↑" : "↓"}</span>
    </button>
    {open && <div ref={panel} id={id} className={styles.rumoPanel} role="group" aria-label="Mudar o rumo">
      {note && <p className={styles.rumoNote}>{note}</p>}
      {stay.map(row)}
      {stay.length > 0 && away.length > 0 && <hr className={styles.rumoRule} />}
      {away.map(row)}
    </div>}
  </div>;
}
