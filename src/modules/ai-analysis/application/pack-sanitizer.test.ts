import { describe, expect, it } from "vitest";
import type { PackSlot } from "../domain/ai-analysis.types";
import { sanitizePack } from "./pack-sanitizer";

const reading = (headline: string, narrative = "Mais de 3 anos sem Evanescence e do nada 12 audições. Achou o CD na caixa?") => ({
  eyebrow: "últimos 30 dias",
  headline,
  narrative,
  insight: "O Imagine Dragons voltou junto, com 32 audições.",
  playfulClosing: "Desenterrou a adolescência inteira num mês só, foi?",
});

const slots: PackSlot[] = [
  { angle: "volta", form: "pergunta" },
  { angle: "surpresa", form: "cena" },
];

describe("sanitizePack", () => {
  it("keeps good items, gives each reading its slot and drops only what is off tone", () => {
    const result = sanitizePack(
      {
        readings: [
          { slot: 2, ...reading("Chico Science no meio do teu house?", "Imagina o Chico chegando com o maracatu na pista. Foi o teu mês.") },
          { slot: 1, ...reading("WAKE ME UP INSIDE?") },
          { slot: 1, ...reading("Um crime contra o bom senso") },
        ],
        albumLines: [
          { album: "Discovery", artist: "Daft Punk", line: "ONE MORE TIME, mermão. E mais uma, e mais uma…" },
          { album: "Discovery", artist: "Daft Punk", line: "curta" },
        ],
        screenLines: [
          { screen: "history", line: "Tu ouviu Body 8 vezes. O Don Toliver já sabe teu nome." },
          { screen: "settings", line: "Tela que não existe no app." },
        ],
      },
      slots,
      [],
    );

    expect(result.readings.map((item) => [item.headline, item.angle, item.form])).toEqual([
      ["Chico Science no meio do teu house?", "surpresa", "cena"],
      ["WAKE ME UP INSIDE?", "volta", "pergunta"],
    ]);
    expect(result.albumLines).toHaveLength(1);
    expect(result.screenLines).toEqual([{ screen: "history", line: "Tu ouviu Body 8 vezes. O Don Toliver já sabe teu nome." }]);
    expect(result.dropped).toEqual({ readings: 1, albumLines: 1, screenLines: 1 });
  });

  it("polishes swear words and report vocabulary instead of dropping", () => {
    const result = sanitizePack(
      {
        readings: [{ ...reading("Ligou o foda-se com 16 reproduções?") }],
        albumLines: [{ album: "Let Go", artist: "Avril Lavigne", line: "Tu ligou o foda-se com 12 plays nesse disco" }],
      },
      slots,
      [],
    );

    expect(result.readings[0].headline).toBe("Ligou o fo***se com 16 audições?");
    expect(result.albumLines[0].line).toBe("Tu ligou o fo***se com 12 vezes nesse disco");
  });

  it("drops text copied from a prompt example and survives garbage", () => {
    const examples = ["Imagina o Zeca Pagodinho, cervejinha na mão, sendo puxado pro meio da coreografia"];
    const copied = sanitizePack(
      { readings: [reading("Olha a cena", "Imagina o Zeca Pagodinho, cervejinha na mão, sendo puxado pro meio do rock.")] },
      slots,
      examples,
    );
    expect(copied.readings).toEqual([]);

    expect(sanitizePack("nada", slots, [])).toEqual({
      readings: [],
      albumLines: [],
      screenLines: [],
      dropped: { readings: 0, albumLines: 0, screenLines: 0 },
    });
  });
});
