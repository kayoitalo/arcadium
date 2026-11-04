import type { ReactNode } from "react";
import styles from "./listening-note.module.css";

/** A small signature of the narrator, drawn in the same ink as the page.
 * Static by default: the existing pen remains the motion signature. */
export function ListeningFigure({ pose = "note" }: { pose?: "note" | "listen" | "search" }) {
  return <svg className={styles.figure} viewBox="0 0 100 104" fill="none" aria-hidden="true" data-pose={pose}>
    <path d="M24 47C18 9 81 7 79 47M29 49C28 28 72 25 73 49L71 68C65 90 37 87 30 68Z" />
    <path className={styles.accent} d="M20 43Q14 42 15 55L16 65Q17 72 26 68L26 44ZM78 43Q87 42 86 55L85 65Q84 72 76 68L75 44" />
    {pose === "search" ? <path d="m36 53 9-2m12-1 8 3M47 69q7-4 12 0" /> : <><path d="M39 52v5m22-5v5" /><path d={pose === "listen" ? "M43 69q9 9 17-2" : "M44 69q8 4 14-1"} /></>}
    <path d="M37 85q-7 2-10 11m36-12q9 2 13 11" />
    <path className={styles.accent} d={pose === "search" ? "M89 22l4-6m-1 14 6-1" : "M6 82l6-4m-3 12 7-2"} />
  </svg>;
}
export function ListeningNote({ children, label = "do lado de cá", pose = "note", className = "" }: {
  children: ReactNode; label?: string; pose?: "note" | "listen" | "search"; className?: string;
}) {
  return <aside className={`${styles.note} ${className}`} data-amigo-note>
    <ListeningFigure pose={pose} /><div><span className={styles.label}>{label}</span><div className={styles.copy}>{children}</div></div>
  </aside>;
}
