import type { ReactNode } from "react";
import styles from "./listening-note.module.css";

/** Voice in the margin. The character is the shared pen, never a literal face. */
export function ListeningNote({ children, label = "do lado de cá", className = "" }: {
  children: ReactNode; label?: string; className?: string;
}) {
  return <aside className={`${styles.note} ${className}`} data-amigo-note>
    <div><span className={styles.label}>{label}</span><div className={styles.copy}>{children}</div></div>
  </aside>;
}
