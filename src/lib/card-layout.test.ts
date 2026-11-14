import { describe, expect, it } from "vitest";
import { fitHeadline, layoutMarked, layoutPlain } from "./card-layout";

// cada letra mede 10: a largura vira contagem de caracteres
const measure = (text: string) => text.length * 10;
const flat = (lines: Array<Array<{ text: string }>>) => lines.map((line) => line.map((segment) => segment.text).join(""));

describe("a diagramação do cartão", () => {
  it("breaks the sentence into lines that fit and keeps every word", () => {
    const lines = layoutMarked({ before: "38 artistas novos e tu voltou pro ", marked: "mesmo disco", after: "." }, 200, measure);
    expect(flat(lines).every((line) => measure(line) <= 200)).toBe(true);
    expect(flat(lines).join(" ")).toBe("38 artistas novos e tu voltou pro mesmo disco.");
  });

  it("keeps the highlighted piece as its own segment, without the space before it or the full stop after it", () => {
    const [line] = layoutMarked({ before: "Voltou pro ", marked: "mesmo disco", after: "." }, 1000, measure);
    expect(line).toEqual([{ text: "Voltou pro ", marked: false }, { text: "mesmo disco", marked: true }, { text: ".", marked: false }]);
  });

  it("splits a highlight across lines and never starts a line with the closing punctuation", () => {
    const lines = layoutMarked({ before: "Tu trocou o ", marked: "dub de Londres", after: ". Sério." }, 130, measure);
    const marked = lines.flatMap((line) => line.filter((segment) => segment.marked).map((segment) => segment.text));
    expect(marked.join(" ")).toBe("dub de Londres");
    expect(marked.length).toBeGreaterThan(1);
    expect(flat(lines).some((line) => line.startsWith("."))).toBe(false);
  });

  it("gives a word longer than the line a line of its own instead of dropping it", () => {
    expect(flat(layoutMarked({ before: "a Supercalifragilístico b", marked: "", after: "" }, 50, measure))).toEqual(["a", "Supercalifragilístico", "b"]);
  });

  it("clamps the narrative with an ellipsis that still fits", () => {
    const lines = layoutPlain("um dois três quatro cinco seis sete oito nove dez", 100, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(100);
    expect(layoutPlain("curta", 100, measure, 2)).toEqual(["curta"]);
  });

  it("picks the largest size whose layout respects the line limit", () => {
    const layoutAt = (size: number) => Array.from({ length: Math.ceil(size / 20) }, () => "linha");
    expect(fitHeadline([120, 100, 80, 60], 4, layoutAt).size).toBe(80);
    expect(fitHeadline([120, 100], 2, layoutAt)).toMatchObject({ size: 100, lines: expect.any(Array) });
  });
});
