"use client";

import { Fragment } from "react";
import styles from "./amigo.module.css";

/**
 * A janela de tempo dita como ele diria ("comparando o último mês com o
 * anterior"), com as outras janelas como palavras que se trocam no lugar.
 * Sem abas, sem controle segmentado: é a frase que muda.
 */
export function Janela<K extends string>({
  options,
  value,
  onChange,
  before,
  after,
}: {
  options: ReadonlyArray<{ key: K; label: string }>;
  value: K;
  onChange: (key: K) => void;
  before?: string;
  after?: string;
}) {
  return (
    <span className={styles.janela} role="group" aria-label="Janela de tempo">
      {before && <span>{before} </span>}
      {options.map((option, index) => (
        <Fragment key={option.key}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <button type="button" aria-pressed={option.key === value} onClick={() => onChange(option.key)}>
            {option.label}
          </button>
        </Fragment>
      ))}
      {after && <span> {after}</span>}
    </span>
  );
}
