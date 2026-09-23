import { describe, expect, it } from "vitest";
import { circle, highlight, jump, polyLength, seeded, wave } from "./gestures";

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

  it("vibra presa nas pontas e, sem som, fica sobre a linha", () => {
    const base = [
      { x: 0, y: 100 },
      { x: 600, y: 100 },
    ];
    const silent = wave(base, 40, null);
    expect(silent.every((point) => Math.abs(point.y - 100) < 1e-9)).toBe(true);

    const loud = wave(base, 40, Uint8Array.from({ length: 64 }, (_, index) => (index % 2 ? 255 : 0)));
    expect(loud[0].y).toBeCloseTo(100);
    expect(loud[loud.length - 1].y).toBeCloseTo(100);
    expect(polyLength(loud)).toBeGreaterThan(polyLength(silent));
  });
});
