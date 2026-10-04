import { describe, expect, it } from "vitest";
import { genreLabel } from "@/lib/format/genre";
import { shiftHeadline, shiftSentence, verifyShiftLine } from "./shift-line";

const shift = {
  rising: [
    { genre: "alternative rock", delta: 5.5, currentShare: 9.8, previousShare: 4.3 },
    { genre: "pop", delta: 4.7, currentShare: 7.3, previousShare: 2.6 },
    { genre: "pop rock", delta: 1.5, currentShare: 3.3, previousShare: 1.8 },
  ],
  declining: [
    { genre: "power metal", delta: -1.9, currentShare: 0.2, previousShare: 2 },
    { genre: "hip hop", delta: -1.8, currentShare: 6.2, previousShare: 7.9 },
  ],
};

describe("genreLabel", () => {
  it("fala o gênero em português quando é assim que se diz", () => {
    expect(genreLabel("alternative rock")).toBe("rock alternativo");
    expect(genreLabel("Brazilian Metal")).toBe("metal brasileiro");
    expect(genreLabel("alternative hip-hop")).toBe("hip hop alternativo");
    expect(genreLabel("electronic")).toBe("eletrônica");
  });

  it("deixa como veio o que não tem tradução de costume", () => {
    expect(genreLabel("power metal")).toBe("power metal");
    expect(genreLabel("post-grunge")).toBe("post-grunge");
  });
});

describe("verifyShiftLine", () => {
  it("aceita o gênero citado do lado certo, e devolve quem acender", () => {
    expect(verifyShiftLine("O rock alternativo subiu no pódio e mandou o resto abrir espaço no sofá.", shift)).toEqual([
      "alternative rock",
    ]);
    expect(verifyShiftLine("Michael Jackson entrou chutando a porta e puxou o pop pra cima.", shift)).toEqual(["pop"]);
  });

  it("barra o gênero do lado errado", () => {
    expect(verifyShiftLine("O hip hop ganhou mais moral e ocupou o sofá da sala.", shift)).toBeNull();
  });

  it("não confunde pop rock com pop", () => {
    expect(verifyShiftLine("O pop rock cresceu de mansinho.", shift)).toEqual(["pop rock"]);
  });

  it("frase sem gênero da lista, ou com porcentagem que o dado não tem, não entra", () => {
    expect(verifyShiftLine("Entrou tanta coisa nova que teu fone deve estar tonto, mano.", shift)).toBeNull();
    expect(verifyShiftLine("O rock alternativo subiu pra 30% do teu mês.", shift)).toBeNull();
    expect(verifyShiftLine("O rock alternativo subiu pra quase 10% do teu mês.", shift)).toEqual(["alternative rock"]);
  });

  it("dois gêneros com um verbo só não decidem nada", () => {
    expect(verifyShiftLine("O power metal abriu espaço pro rock alternativo.", shift)).toBeNull();
  });
});

describe("o que ele diz sem frase do modelo", () => {
  it("o maior salto de cada lado", () => {
    expect(shiftHeadline(shift)).toEqual({
      headline: "Menos power metal, mais rock alternativo.",
      genres: ["alternative rock", "power metal"],
    });
    expect(shiftHeadline({ rising: [], declining: [] })).toBeNull();
  });

  it("a prova em voz alta", () => {
    expect(shiftSentence([shift.rising[0], shift.declining[0]])).toBe(
      "Rock alternativo foi de 4,3% pra 9,8% do que você ouviu. Power metal caiu de 2% pra 0,2%.",
    );
  });
});
