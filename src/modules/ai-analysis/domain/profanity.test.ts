import { describe, expect, it } from "vitest";
import { censorProfanity } from "./profanity";

describe("censorProfanity", () => {
  it("masks the middle of a swear word and keeps its case", () => {
    expect(censorProfanity("Tu ligou o foda-se com What the Hell?")).toBe("Tu ligou o fo***se com What the Hell?");
    expect(censorProfanity("LIGOU O FODA-SE")).toBe("LIGOU O FO***SE");
    expect(censorProfanity("que porra é essa")).toBe("que p**** é essa");
  });

  it("leaves words that were already censored or are not swearing", () => {
    expect(censorProfanity("Ligou o FO***SE mesmo")).toBe("Ligou o FO***SE mesmo");
    expect(censorProfanity("Que merda de fone, caralho")).toBe("Que m**** de fone, ca***ho");
    expect(censorProfanity("Pediu mais retorno no fone")).toBe("Pediu mais retorno no fone");
  });

  it("handles empty text", () => {
    expect(censorProfanity(null)).toBeNull();
    expect(censorProfanity("")).toBe("");
  });
});
