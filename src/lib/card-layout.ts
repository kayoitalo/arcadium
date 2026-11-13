/*
 * A diagramação do cartão da leitura: quebrar a frase em linhas sabendo
 * qual pedaço é o grifado. Função pura — quem mede o texto (o canvas) vem
 * de fora, então dá pra testar sem navegador.
 */

export interface CardSegment {
  text: string;
  marked: boolean;
}

export type CardLine = CardSegment[];

type Measure = (text: string) => number;

interface Word {
  text: string;
  marked: boolean;
  /** Vem colada na anterior (o ponto final depois do trecho grifado). */
  glued: boolean;
}

function wordsOf(pieces: { before: string; marked: string; after: string }): Word[] {
  const words: Word[] = [];
  const push = (text: string, marked: boolean) => {
    let glued = !/^\s/.test(text) && words.length > 0 && !/\s$/.test(previous);
    for (const word of text.split(/\s+/).filter(Boolean)) {
      words.push({ text: word, marked, glued });
      glued = false;
    }
    if (text) previous = text;
  };
  let previous = " ";
  push(pieces.before, false);
  push(pieces.marked, true);
  push(pieces.after, false);
  return words;
}

/**
 * Quebra a frase em linhas que cabem em `maxWidth`. Cada linha é uma
 * sequência de pedaços, grifados ou não; palavras vizinhas do mesmo tipo
 * viram um pedaço só, pra faixa do grifo sair inteira.
 */
export function layoutMarked(
  pieces: { before: string; marked: string; after: string },
  maxWidth: number,
  measure: Measure,
): CardLine[] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  const text = (words: Word[]) => words.map((word, index) => (index > 0 && !word.glued ? " " : "") + word.text).join("");
  for (const word of wordsOf(pieces)) {
    // pontuação colada não começa linha: desce junto com a palavra que ela fecha
    if (line.length > 0 && !word.glued && measure(text([...line, word])) > maxWidth) {
      lines.push(line);
      line = [];
    }
    line.push(line.length === 0 ? { ...word, glued: word.glued && lines.length === 0 } : word);
  }
  if (line.length > 0) lines.push(line);

  return lines.map((words) => {
    const segments: CardSegment[] = [];
    words.forEach((word, index) => {
      const space = index > 0 && !word.glued ? " " : "";
      const last = segments[segments.length - 1];
      if (last && last.marked === word.marked) last.text += space + word.text;
      // o espaço entre um pedaço e outro fica do lado sem grifo: a faixa não avança no vão
      else if (last && space) {
        if (word.marked) { last.text += space; segments.push({ text: word.text, marked: true }); }
        else segments.push({ text: space + word.text, marked: false });
      } else segments.push({ text: word.text, marked: word.marked });
    });
    return segments;
  });
}

/** Texto corrido em linhas, sem grifo: a narrativa do cartão. */
export function layoutPlain(text: string, maxWidth: number, measure: Measure, maxLines = Infinity): string[] {
  const lines = layoutMarked({ before: text, marked: "", after: "" }, maxWidth, measure).map((line) => line.map((segment) => segment.text).join(""));
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
  kept[maxLines - 1] = `${last.replace(/[\s.,;:]+$/, "")}…`;
  return kept;
}

/**
 * O maior corpo de letra em que a frase cabe no cartão: tenta do maior
 * para o menor e fica com o primeiro que respeita o número de linhas.
 */
export function fitHeadline<T>(sizes: number[], maxLines: number, layoutAt: (size: number) => T[]): { size: number; lines: T[] } {
  for (const size of sizes) {
    const lines = layoutAt(size);
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: layoutAt(size) };
}
