import { describe, expect, it } from "vitest";
import { filterGenreTags, looksLikeGenre } from "./genre-tags";

describe("looksLikeGenre", () => {
  it("aceita gêneros de verdade", () => {
    for (const genre of ["punk rock", "hip hop", "power metal", "city pop", "trap latino", "mpb"]) {
      expect(looksLikeGenre(genre)).toBe(true);
    }
  });

  it("rejeita as tags que apareceram como gênero na tela", () => {
    // exatamente o que a página de evolução estava exibindo
    for (const junk of ["Singer", "Japan", "Likedis Auto", "Death By Heart Attack"]) {
      expect(looksLikeGenre(junk)).toBe(false);
    }
  });

  it("rejeita nacionalidade e idioma", () => {
    for (const junk of ["american", "english", "brazilian", "usa", "estados unidos"]) {
      expect(looksLikeGenre(junk)).toBe(false);
    }
  });

  it("rejeita recorte de década", () => {
    for (const junk of ["80s", "90s", "2000s", "00s"]) {
      expect(looksLikeGenre(junk)).toBe(false);
    }
  });

  it("rejeita função, atributo de voz e ruído de aplicativo", () => {
    for (const junk of ["songwriter", "female vocals", "seen live", "favorites", "spotify"]) {
      expect(looksLikeGenre(junk)).toBe(false);
    }
  });

  it("rejeita frase longa, que é comentário e não gênero", () => {
    expect(looksLikeGenre("melhor banda que eu já ouvi na vida")).toBe(false);
  });
});

describe("filterGenreTags", () => {
  it("preserva a ordem, normaliza a caixa e remove repetidos", () => {
    const input = ["Punk Rock", "Japan", "punk rock", "Singer", "Pop Punk", "90s"];
    expect(filterGenreTags(input)).toEqual(["punk rock", "pop punk"]);
  });

  it("devolve lista vazia quando nada sobrevive, em vez de mostrar lixo", () => {
    expect(filterGenreTags(["Likedis Auto", "seen live", "USA"])).toEqual([]);
  });

  it("ignora entradas vazias vindas de split de string", () => {
    expect(filterGenreTags(["rock", "", "  ", "jazz"])).toEqual(["rock", "jazz"]);
  });
});
