import { describe, expect, it } from "vitest";
import { band, circle, dimension, highlight, jump, polyLength, seeded, strike, wave } from "./gestures";

const box = { left: 100, top: 200, width: 300, height: 40 };

describe("o traço do amigo", () => {
  it("redesenha o mesmo gesto para o mesmo alvo", () => {
    expect(circle(box, "roda")).toEqual(circle(box, "roda"));
    expect(seeded("a")()).not.toBe(seeded("b")());
  });

  it("não fecha o círculo: a caneta passa do começo e abre para fora", () => {
    const points = circle(box, "roda");
    const [first, last] = [points[0], points[points.length - 1]];
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeGreaterThan(4);
    // o traço contorna o alvo, não passa por cima dele
    const inside = points.filter(
      (point) => point.x > box.left && point.x < box.left + box.width && point.y > box.top && point.y < box.top + box.height,
    );
    expect(inside).toHaveLength(0);
  });

  it("grifa cada linha do trecho com uma faixa própria", () => {
    const lines = [box, { ...box, top: 260 }];
    const strokes = highlight(lines, "grifo");
    expect(strokes).toHaveLength(2);
    expect(strokes[1][0].y).toBeGreaterThan(strokes[0][0].y + 40);
  });

  it("salta por cima das duas capas e termina na ponta da seta", () => {
    const from = { left: 0, top: 300, width: 200, height: 200 };
    const to = { left: 800, top: 300, width: 200, height: 200 };
    const { points, arc, apex } = jump(from, to, "salto");
    expect(apex.y).toBeLessThan(from.top - 56);
    // arco, farpa, ponta, farpa: a seta sai sem tirar a caneta do papel
    expect(points.length).toBe(arc.length + 3);
    expect(points[points.length - 2]).toEqual(arc[arc.length - 1]);
  });

  describe("os gestos exatos", () => {
    const line = { left: 100, right: 400, capTop: 200, baseline: 270 };

    it("a faixa cobre das maiúsculas à base, reta, com a mesma folga dos dois lados", () => {
      const { strokes, width } = band([line], 100);
      const [start, end] = strokes[0];
      expect(start.y).toBe(end.y);
      expect(start.x).toBeCloseTo(100 - 8);
      expect(end.x).toBeCloseTo(400 + 8);
      // do topo das maiúsculas (com folga) à base (com folga), e não a caixa inteira da linha
      expect(width).toBeCloseTo(70 + 7 + 6);
      expect(start.y - width / 2).toBeCloseTo(200 - 7);
    });

    it("o risco passa reto pelo meio das maiúsculas", () => {
      const [[start, end]] = strike([line], 100);
      expect(start.y).toBe(end.y);
      expect(start.y).toBeGreaterThan(line.capTop);
      expect(start.y).toBeLessThan(line.baseline);
    });

    it("a cota sobe, atravessa e desce em retas, acima das duas capas", () => {
      const from = { left: 0, top: 300, width: 200, height: 200 };
      const to = { left: 600, top: 320, width: 200, height: 200 };
      const { posts, span, mid } = dimension(from, to, 80);
      expect(span[0].y).toBe(220);
      expect(span[1].y).toBe(220);
      expect(posts[0][0].x).toBe(posts[0][1].x);
      expect(posts[1][1].y).toBe(to.top - 14);
      expect(mid).toEqual({ x: 400, y: 220 });
    });
  });

  describe("a corda", () => {
    const base = [
      { x: 0, y: 100 },
      { x: 600, y: 100 },
    ];
    // um grave: meio ciclo cabe na janela que a corda percorre
    const bass = Uint8Array.from({ length: 1024 }, (_, index) => 128 + Math.round(90 * Math.sin((index / 512) * Math.PI)));
    // chiado puro: amostra sim, amostra não
    const hiss = Uint8Array.from({ length: 1024 }, (_, index) => (index % 2 ? 255 : 0));

    it("fica sobre a linha sem som e vibra presa nas pontas com som", () => {
      const silent = wave(base, 40, null);
      expect(silent.every((point) => Math.abs(point.y - 100) < 1e-9)).toBe(true);

      const loud = wave(base, 40, bass);
      expect(loud[0].y).toBeCloseTo(100);
      expect(loud[loud.length - 1].y).toBeCloseTo(100);
      expect(Math.max(...loud.map((point) => Math.abs(point.y - 100)))).toBeGreaterThan(20);
    });

    it("ondula com o grave e ignora o chiado, que viraria risco em cima do texto", () => {
      expect(polyLength(wave(base, 40, hiss))).toBeLessThan(polyLength(base) * 1.02);
    });

    it("em volta da capa só incha para fora, nunca para dentro dela", () => {
      const center = { x: 300, y: 400 };
      const outward = wave(base, 40, bass, 1, center);
      // a linha está acima do centro: para fora é para cima
      expect(outward.every((point) => point.y <= 100 + 1e-9)).toBe(true);
    });
  });
});
