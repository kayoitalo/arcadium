import type { Box, TextLine } from "./gestures";
import type { TracePlan } from "./trace";

/*
 * Medir a tela para o traço. Tudo relativo a uma origem (o palco da tela),
 * que rola junto com o conteúdo: as coordenadas não mudam com a rolagem.
 */

export function boxOf(element: Element, origin: DOMRect): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height };
}

/**
 * Onde ficam as maiúsculas e a linha de base de cada linha de um trecho.
 * A caixa que o navegador devolve é a da linha inteira; a faixa exata
 * precisa da métrica da fonte, que o canvas mede com a própria fonte.
 */
export function textLines(element: HTMLElement, origin: DOMRect): { lines: TextLine[]; size: number } {
  const style = getComputedStyle(element);
  const size = Number.parseFloat(style.fontSize);
  let ascent = size * 0.88;
  let cap = size * 0.7;
  const context = document.createElement("canvas").getContext("2d");
  if (context) {
    context.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    const probe = context.measureText("H");
    if (probe.fontBoundingBoxAscent) ascent = probe.fontBoundingBoxAscent;
    if (probe.actualBoundingBoxAscent) cap = probe.actualBoundingBoxAscent;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  // um retângulo por pedaço de texto: os da mesma linha viram uma linha só
  const rows: Array<{ left: number; right: number; top: number }> = [];
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < 1) continue;
    const row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 3);
    if (row) {
      row.left = Math.min(row.left, rect.left);
      row.right = Math.max(row.right, rect.right);
    } else {
      rows.push({ left: rect.left, right: rect.right, top: rect.top });
    }
  }

  const lines = rows
    .sort((a, b) => a.top - b.top)
    .map((row) => {
      const baseline = row.top - origin.top + ascent;
      return { left: row.left - origin.left, right: row.right - origin.left, capTop: baseline - cap, baseline };
    });
  return { lines, size };
}

/** Duas medidas da mesma pose que caem no mesmo lugar, a um pixel e pouco. */
export function sameGeometry(a: TracePlan, b: TracePlan): boolean {
  const ends = (plan: TracePlan) => [
    ...plan.gestures.flatMap((gesture) => gesture.strokes.flatMap((stroke) => [stroke[0], stroke[stroke.length - 1]])),
    ...(plan.wave ? [plan.wave.base[0], plan.wave.base[plan.wave.base.length - 1]] : []),
  ];
  const [left, right] = [ends(a), ends(b)];
  return (
    left.length === right.length &&
    left.every((point, index) => Math.abs(point.x - right[index].x) < 1.5 && Math.abs(point.y - right[index].y) < 1.5)
  );
}

/** A frase e o trecho que ele grifa: o fim dela, sem palavra de uma ou duas letras sozinha. */
export function splitTail(text: string): { plain: string; tail: string } {
  const words = text.split(/\s+/).filter(Boolean);
  const marks = words.length >= 3 && words[words.length - 2].replace(/[^\p{L}\p{N}]/gu, "").length > 2 ? 2 : 1;
  return { plain: words.slice(0, words.length - marks).join(" "), tail: words.slice(words.length - marks).join(" ") };
}

/** Nome curto para caber numa anotação: sem "(The Remaster)", sem "(feat. …)". */
export function shorten(text: string, max = 18): string {
  const bare = text.replace(/\s*[([].*?[)\]]/g, "").trim() || text;
  return bare.length > max ? `${bare.slice(0, max - 1).trimEnd()}…` : bare;
}
