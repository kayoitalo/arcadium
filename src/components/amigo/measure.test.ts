import { describe, expect, it } from "vitest";
import { findMark, markPieces, splitTail } from "./measure";

describe("onde ele grifa", () => {
  it("no nome que a prova sustenta, do jeito que a frase escreve", () => {
    expect(markPieces("BABY, I COMPARE YOU TO A KISS FROM A ROSE ON THE GREY!", ["Tiramisu", "Kiss from a Rose"])).toEqual({
      before: "BABY, I COMPARE YOU TO A ",
      marked: "KISS FROM A ROSE",
      after: " ON THE GREY!",
    });
    expect(markPieces("O rock alternativo subiu no pódio", ["rock alternativo"]).marked).toBe("rock alternativo");
  });

  it("sem acento de diferença e sem o \"(feat. …)\" do catálogo", () => {
    const headline = "Debí Tirar Más Fotos no repeat";
    const found = findMark(headline, ["DeBÍ TiRAR MáS FOToS (Deluxe)"]);
    expect(found && headline.slice(found.start, found.end)).toBe("Debí Tirar Más Fotos");
  });

  it("não grifa pedaço de palavra", () => {
    expect(findMark("um elemento estranho", ["Element"])).toBeNull();
  });

  it("sem nome da prova na frase, grifa o fim", () => {
    expect(markPieces("Máquina do tempo ligada", ["anos 2000"])).toEqual({
      before: "Máquina do ",
      marked: "tempo ligada",
      after: "",
    });
    expect(splitTail("NATURAL NA VEIA")).toEqual({ plain: "NATURAL NA", tail: "VEIA" });
  });
});
