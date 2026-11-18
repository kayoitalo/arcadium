import { check, toPath } from "./gestures";
import styles from "./amigo.module.css";

/**
 * O visto dele quando você guarda alguma coisa: desce curto e sobe longo,
 * na cor do traço, uma vez. É o único sinal de que guardou — sem aviso
 * flutuante. Quem usa troca a `key` a cada coisa guardada, pra ele
 * desenhar de novo. Com movimento reduzido, o visto já aparece pronto.
 */
export function Visto() {
  const size = 16;
  const points = check({ left: size + 4, top: 2, width: 0, height: size }, 2);
  return (
    <svg className={styles.visto} width={size + 6} height={size + 6} viewBox={`0 0 ${size + 6} ${size + 6}`} aria-hidden="true">
      <path d={toPath(points)} pathLength={1} />
    </svg>
  );
}
