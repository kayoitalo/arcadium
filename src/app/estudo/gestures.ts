/*
 * A geometria do traço do amigo. Tudo aqui é função pura: recebe caixas
 * medidas na tela e devolve polilinhas. Polilinha, e não curva de SVG,
 * porque o motor do traço precisa saber o comprimento exato de cada
 * pedaço para desenhar, viajar e apagar na velocidade de uma mão.
 *
 * O tremido é de mão, não de ruído: poucas ondas largas, e sempre o
 * mesmo para o mesmo alvo — redesenhar não pode mudar o gesto.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Gerador determinístico a partir de um texto: o mesmo alvo, o mesmo tremido. */
export function seeded(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function polyLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

export function toPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M${first.x.toFixed(1)} ${first.y.toFixed(1)}${rest.map((point) => `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join("")}`;
}

function quadratic(a: Point, control: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
  };
}

/**
 * O grifo de marca-texto: uma faixa grossa atravessando cada linha do
 * trecho, subindo de leve no fim, como faz a mão.
 */
export function highlight(lines: Box[], seed: string): Point[][] {
  const random = seeded(seed);
  return lines.map((line) => {
    const x0 = line.left - line.height * 0.1;
    const x1 = line.left + line.width + line.height * 0.12;
    const mid = line.top + line.height * 0.56;
    const rise = line.height * (0.05 + random() * 0.04);
    const phase = random() * Math.PI * 2;
    const steps = Math.max(6, Math.ceil((x1 - x0) / 10));
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      return {
        x: x0 + (x1 - x0) * t,
        y: mid + rise * (0.5 - t) + Math.sin(t * Math.PI * 2 + phase) * line.height * 0.018,
      };
    });
  });
}

/**
 * O círculo de caneta: passa do ponto de partida e abre um pouco, porque
 * ninguém fecha um círculo. Em volta de algo largo e baixo — uma linha de
 * lista — a mão não faz elipse, que cortaria os cantos por cima do texto:
 * faz um oval de cantos cheios. O expoente da superelipse sai da proporção
 * do alvo: 2 é elipse, 4 já abraça um retângulo comprido.
 *
 * `shape` serve às capas: um quadrado inclinado pede expoente alto (senão
 * os cantos da capa furam o círculo) e a mesma inclinação da capa.
 */
export function circle(
  box: Box,
  seed: string,
  pad = 14,
  shape: { exponent?: number; rotation?: number } = {},
): Point[] {
  const random = seeded(seed);
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const rx = box.width / 2 + pad;
  const ry = box.height / 2 + pad * 0.8;
  const aspect = Math.max(box.width, box.height) / Math.max(1, Math.min(box.width, box.height));
  const exponent = shape.exponent ?? clamp(2 + (aspect - 1.5) * 0.5, 2, 4);
  const hug = (value: number) => Math.sign(value) * Math.pow(Math.abs(value), 2 / exponent);
  const start = ((196 + random() * 30) * Math.PI) / 180;
  const sweep = Math.PI * 2 * (1.08 + random() * 0.06);
  // alvo comprido inclinado encostaria as pontas no texto: quanto mais largo, mais reto
  const tilt = (shape.rotation ?? 0) + (random() - 0.5) * 0.12 * Math.min(1, 3 / aspect);
  const [p1, p2] = [random() * Math.PI * 2, random() * Math.PI * 2];
  const steps = Math.ceil(((rx + ry) * sweep) / 6);

  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const angle = start + sweep * t;
    // o tremido só empurra para fora: para dentro ele passaria por cima do alvo
    const wobble = 1.02 + 0.02 * Math.sin(2 * angle + p1) + 0.01 * Math.sin(5 * angle + p2);
    const open = 1 + 0.07 * t;
    const x = hug(Math.cos(angle)) * rx * wobble * open;
    const y = hug(Math.sin(angle)) * ry * wobble * open;
    return {
      x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: cy + x * Math.sin(tilt) + y * Math.cos(tilt),
    };
  });
}

/** O risco de "esquece": um zigue-zague largo por cima do texto. */
export function scribble(box: Box, seed: string): Point[] {
  const random = seeded(seed);
  const peaks = clamp(Math.round(box.width / 70), 4, 12);
  const points: Point[] = [];
  for (let index = 0; index <= peaks; index += 1) {
    const t = index / peaks;
    const high = index % 2 === 0;
    points.push({
      x: box.left - 10 + (box.width + 20) * t + (random() - 0.5) * 14,
      y: box.top + box.height * (high ? 0.22 : 0.78) + (random() - 0.5) * box.height * 0.1 + t * box.height * 0.06,
    });
  }
  // cantos de zigue-zague ficam duros demais com linha grossa: amacia um pouco
  return points.flatMap((point, index) => {
    const next = points[index + 1];
    if (!next) return [point];
    return [point, { x: point.x + (next.x - point.x) * 0.5, y: point.y + (next.y - point.y) * 0.5 }];
  });
}

/**
 * O salto de uma coisa a outra: um arco por cima das duas, que termina em
 * ponta de seta desenhada sem tirar a caneta do papel.
 */
export function jump(from: Box, to: Box, seed: string): { points: Point[]; arc: Point[]; apex: Point } {
  const random = seeded(seed);
  const a = { x: from.left + from.width * 0.62, y: from.top - 16 };
  const b = { x: to.left + to.width * 0.38, y: to.top - 16 };
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = clamp(distance * 0.24, 56, 160) * (0.94 + random() * 0.12);
  const control = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - lift * 2 };
  const steps = Math.max(24, Math.ceil(distance / 7));
  const phase = random() * Math.PI * 2;

  const arc = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const point = quadratic(a, control, b, t);
    return { x: point.x, y: point.y + Math.sin(t * Math.PI * 3 + phase) * 1.6 * Math.sin(t * Math.PI) };
  });

  const tip = arc[arc.length - 1];
  const before = arc[arc.length - 4] ?? arc[0];
  const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
  const barb = clamp(distance * 0.05, 14, 22);
  const barbAt = (turn: number) => ({
    x: tip.x - Math.cos(angle + turn) * barb,
    y: tip.y - Math.sin(angle + turn) * barb,
  });

  return {
    points: [...arc, barbAt(0.5), tip, barbAt(-0.5)],
    arc,
    apex: quadratic(a, control, b, 0.5),
  };
}

/** A viagem entre um gesto e outro: um arco raso, para o traço não andar em linha de régua. */
export function travel(from: Point, to: Point, seed: string): Point[] {
  const random = seeded(seed);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance < 1) return [from, to];
  const side = random() > 0.5 ? 1 : -1;
  const bend = clamp(distance * 0.22, 12, 160) * side;
  const normal = { x: -(to.y - from.y) / distance, y: (to.x - from.x) / distance };
  const control = {
    x: (from.x + to.x) / 2 + normal.x * bend,
    y: (from.y + to.y) / 2 + normal.y * bend,
  };
  const steps = Math.max(8, Math.ceil(distance / 10));
  return Array.from({ length: steps + 1 }, (_, index) => quadratic(from, control, to, index / steps));
}

/** Quantas amostras do quadro a corda percorre: só o começo, onde cabe meio ciclo de grave. */
const WAVE_WINDOW = 0.5;
/** Raio da média móvel: o que sobra depois dela é ondulação, não chiado. */
const WAVE_SMOOTH = 10;
/** Música amaciada perde amplitude; isto devolve o corpo da onda. */
const WAVE_BOOST = 2.6;

/**
 * A corda que vibra com a música: presa nas duas pontas, livre no meio,
 * seguindo a linha que já estava ali — o arco do salto, ou a moldura em
 * volta da capa que está tocando. `samples` é o sinal no tempo (0–255,
 * 128 é silêncio); sem sinal, a corda fica parada sobre a linha.
 *
 * O sinal cru, esticado na corda, vira chiado e parece risco. Amaciado,
 * sobra o grave: a corda ondula largo, como corda de verdade.
 *
 * Com `outwardFrom`, a corda só vibra para longe daquele ponto — em volta
 * da capa ela incha para fora e nunca invade a imagem.
 */
export function wave(
  base: Point[],
  amp: number,
  samples: ArrayLike<number> | null,
  gain = 1,
  outwardFrom?: Point,
): Point[] {
  const total = polyLength(base);
  if (base.length < 2 || total === 0) return base;
  const reach = [0];
  for (let index = 1; index < base.length; index += 1) {
    reach.push(reach[index - 1] + Math.hypot(base[index].x - base[index - 1].x, base[index].y - base[index - 1].y));
  }

  const span = samples ? Math.max(1, Math.floor(samples.length * WAVE_WINDOW)) : 0;
  const signalAt = (t: number) => {
    if (!samples || span === 0) return 0;
    const center = Math.floor(t * (span - 1));
    let sum = 0;
    let count = 0;
    // janela de tamanho par: amostra sim, amostra não se anula por inteiro
    for (let index = Math.max(0, center - WAVE_SMOOTH); index < Math.min(span, center + WAVE_SMOOTH); index += 1) {
      sum += (samples[index] - 128) / 128;
      count += 1;
    }
    return clamp((sum / count) * WAVE_BOOST, -1, 1);
  };

  const columns = clamp(Math.round(total / 6), 16, 220);
  let segment = 1;
  return Array.from({ length: columns + 1 }, (_, index) => {
    const t = index / columns;
    const at = total * t;
    while (segment < base.length - 1 && reach[segment] < at) segment += 1;
    const [a, b] = [base[segment - 1], base[segment]];
    const length = reach[segment] - reach[segment - 1] || 1;
    const local = clamp((at - reach[segment - 1]) / length, 0, 1);
    const point = { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
    let normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    let value = signalAt(t);
    if (outwardFrom) {
      // a normal que aponta para o centro vira; o sinal vira só intensidade
      if (normal.x * (point.x - outwardFrom.x) + normal.y * (point.y - outwardFrom.y) < 0) {
        normal = { x: -normal.x, y: -normal.y };
      }
      value = Math.abs(value);
    }
    const offset = value * amp * gain * Math.sin(t * Math.PI);
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
  });
}
