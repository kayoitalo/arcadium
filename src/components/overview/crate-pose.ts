/**
 * A posição de um disco no caixote, em função da distância dele até o que
 * está sendo olhado. Tudo sai daqui: sem estado, sem medir DOM, sem
 * animação encadeada — mudar o foco recalcula a cena inteira de uma vez.
 */

export interface CratePose {
  /** Deslocamento horizontal em px, a partir do centro do palco. */
  x: number;
  /** Inclinação: encostado no caixote, ou virado de frente para quem olha. */
  rotateY: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/** Quanto os discos guardados ficam deitados. O de frente quase não inclina. */
const LEAN_DEG = 62;
const FRONT_LEAN_DEG = -5;

/** Distância entre dois discos encostados, e o vão que o disco puxado abre. */
const STEP = 30;
const GAP = 104;

/** Depois disso a pilha para de encolher: o fundo do caixote não some. */
const MAX_DEPTH = 8;

/** Quantos discos de cada lado do foco são desenhados. */
export const CRATE_WINDOW = 7;

export function cratePose(distance: number): CratePose {
  if (distance === 0) {
    return { x: 0, rotateY: FRONT_LEAN_DEG, scale: 1, opacity: 1, zIndex: 100 };
  }

  const depth = Math.min(Math.abs(distance), MAX_DEPTH);
  const scale = 1 - depth * 0.018;
  const opacity = Math.max(0.18, 1 - depth * 0.13);
  const zIndex = 100 - depth;

  // à direita ficam os que ainda não foram vistos; à esquerda, os que já passaram
  return distance > 0
    ? { x: GAP + (distance - 1) * STEP, rotateY: -LEAN_DEG, scale, opacity, zIndex }
    : { x: -GAP + (distance + 1) * STEP, rotateY: LEAN_DEG, scale, opacity, zIndex };
}

/** O índice depois de andar `step` no caixote, sem sair das pontas. */
export function stepFocus(current: number, step: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(total - 1, Math.max(0, current + step));
}
