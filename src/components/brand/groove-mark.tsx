/**
 * A marca do Grooveyard: um sulco de disco desenhado como espiral única,
 * cortada por um vão onde entra o braço da vitrola.
 *
 * São duas versões do mesmo desenho, não dois logos. Espiral com muitas
 * voltas some abaixo de 24px; espiral com poucas fica pobre em tamanho
 * grande. A cheia vive de 32px para cima, a compacta cobre 16 e 24 —
 * é assim que se resolve favicon sem estragar a marca de apresentação.
 *
 * O traço é sempre `currentColor`: no app o acento vem da capa em foco,
 * então a marca se tinge junto com o disco que você está ouvindo.
 */

interface SpiralOptions {
  r0: number;
  r1: number;
  turns: number;
  from: number;
}

/** Espiral de Arquimedes amostrada em polilinha, calculada uma vez no módulo. */
function spiralPath({ r0, r1, turns, from }: SpiralOptions): string {
  const steps = Math.ceil(turns * 96);
  const points: string[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = from + t * turns * Math.PI * 2;
    const radius = r0 + t * (r1 - r0);
    points.push(`${(50 + Math.cos(angle) * radius).toFixed(1)},${(50 + Math.sin(angle) * radius).toFixed(1)}`);
  }

  return `M${points.join("L")}`;
}

const FULL_GROOVE = spiralPath({ r0: 11, r1: 41, turns: 2.6, from: -Math.PI / 2 });
const COMPACT_GROOVE = spiralPath({ r0: 15, r1: 39, turns: 1.55, from: -Math.PI / 2 });

interface MarkProps {
  className?: string;
  title?: string;
}

/** Versão cheia — de 32px para cima. */
export function GrooveMark({ className = "", title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d={FULL_GROOVE} />
      <path d="M82,50L64,50" />
    </svg>
  );
}

/** Versão compacta — 16 e 24px, onde a cheia empasta. */
export function GrooveMarkCompact({ className = "", title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={9.5}
      strokeLinecap="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d={COMPACT_GROOVE} />
    </svg>
  );
}
