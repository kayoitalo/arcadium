import { describe, expect, it } from "vitest";
import { findCopiedExample, findOffTonePhrases, replaceReportWords } from "./text-guard";

describe("replaceReportWords", () => {
  it("swaps report vocabulary for the word a friend would use, keeping the case", () => {
    expect(replaceReportWords("Angra teve 16 reproduções e 1 execução.")).toBe("Angra teve 16 audições e 1 audição.");
    expect(replaceReportWords("WHAT THE HELL?! 12 REPRODUÇÕES")).toBe("WHAT THE HELL?! 12 AUDIÇÕES");
    expect(replaceReportWords("voltou logo com 32 plays.")).toBe("voltou logo com 32 vezes.");
    expect(replaceReportWords("Plays de novo")).toBe("Plays de novo");
    expect(replaceReportWords(null)).toBeNull();
  });
});

describe("findCopiedExample", () => {
  const examples = ["Os braços subiram sozinhos pra fazer as letrinhas, né? Eu vi HAHAHA"];

  it("catches six words in a row taken from an example, ignoring accents and punctuation", () => {
    expect(
      findCopiedExample(["Tu ouviu Alice in Chains e os bracos subiram sozinhos pra fazer barulho."], examples),
    ).toBe("os bracos subiram sozinhos pra fazer");
  });

  it("does not flag a common five-word expression that belongs to the voice", () => {
    expect(findCopiedExample(["Quantos anos tu tem mesmo?"], ["Metade do mês é anos 80. Quantos anos tu tem mesmo?"])).toBeNull();
  });

  it("lets a text that only shares loose words through", () => {
    expect(findCopiedExample(["Os braços do Daft Punk subiram? Eu vi, hein HAHAHA"], examples)).toBeNull();
  });
});

describe("findOffTonePhrases", () => {
  it("catches the phrases that made the old texts sound judgmental or robotic", () => {
    expect(
      findOffTonePhrases([
        "Daft Punk e Imagine Dragons disputando o topo é um crime contra o bom senso",
        "Parece uma rádio de rodoviária.",
        "O grupo acumulou dezesseis execuções.",
        null,
      ]),
    ).toEqual(["crime", "bom senso", "rodoviária", "execuções", "acumulou"]);
  });

  it("lets a text in the right tone through", () => {
    expect(
      findOffTonePhrases([
        "Angra, Daft Punk, Bad Bunny… e Chico Science",
        "Não vou nem perguntar — mas agora eu quero saber a história.",
        "Se os robôs do Daft Punk resolverem tocar guitarra com o Angra, me avisa.",
      ]),
    ).toEqual([]);
  });

  it("does not trip on words that only contain a banned one", () => {
    expect(findOffTonePhrases(["Crimeia é longe demais para esse forró.", "reproduzir"])).toEqual([]);
  });
});
