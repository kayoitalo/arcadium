import { tally, toPath } from "./gestures";
import styles from "./amigo.module.css";

/**
 * Uma contagem na letra dele: risquinhos de caderno, quatro em pé e o
 * quinto atravessado. Como toda anotação dele, mora na grade e só aparece
 * depois que o traço chegou ali (`lit`): ele conta, não decora.
 */
export function Risquinhos({ count, lit, height = 26, label }: {
  count: number;
  /** O traço já passou pelo dado que esta contagem acompanha. */
  lit: boolean;
  height?: number;
  /** O que está sendo contado, para quem não vê os riscos. */
  label: string;
}) {
  const { strokes, width } = tally(count, height);
  if (strokes.length === 0) return null;
  const pad = 3;
  return (
    <svg className={styles.tally} data-lit={lit} role="img" aria-label={label}
      width={width + pad * 2} height={height + pad * 2} viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}>
      {strokes.map((stroke, index) => <path key={index} d={toPath(stroke)} />)}
    </svg>
  );
}
