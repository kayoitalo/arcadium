import type { ReactNode } from "react";
import styles from "./amigo.module.css";

/**
 * A espera curta, na linha: o texto dele e, embaixo, a caneta escrevendo um
 * risco que vai e volta enquanto a coisa não chega. É a versão pequena da
 * planta do aviso, para "abrindo a estante…", "procurando a história…".
 * Com movimento reduzido, o risco fica parado e inteiro.
 */
export function Esperando({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p role="status" className={`${styles.esperando} ${className}`}>
      <span>{children}</span>
      <svg className={styles.esperandoRisco} viewBox="0 0 120 6" preserveAspectRatio="none" aria-hidden="true">
        <path d="M1 4 L60 3.4 L119 2.2" pathLength={1} />
      </svg>
    </p>
  );
}
