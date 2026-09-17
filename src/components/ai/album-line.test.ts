import { describe, expect, it } from "vitest";
import { findAlbumLine } from "./album-line";
import type { AlbumLine } from "@/modules/ai-analysis/domain/ai-analysis.types";

const line = (album: string, artist: string, text: string): AlbumLine => ({ album, artist, line: text });

describe("findAlbumLine", () => {
  const lines = [
    line("Racional", "Tim Maia", "O disco que o Tim gravou achando que ia salvar o mundo."),
    line("Acabou Chorare", "Novos Baianos", "Seis meses de sítio viraram trinta e cinco minutos."),
  ];

  it("ignores accents, case and punctuation on both sides", () => {
    expect(findAlbumLine(lines, { title: "RACIONAL", artistName: "Tim Maia" })?.line).toContain("salvar o mundo");
    expect(findAlbumLine(lines, { title: "Acabou Chorare", artistName: "novos baianos" })?.line).toContain("sítio");
  });

  it("falls back to the title when the artist is written differently", () => {
    const written = [line("África Brasil", "Jorge Ben", "Puxou o samba pra dentro da guitarra.")];
    expect(findAlbumLine(written, { title: "Africa Brasil", artistName: "Jorge Ben Jor" })?.line).toContain("guitarra");
  });

  it("does not hand a namesake album the wrong comment", () => {
    const namesakes = [
      line("Clube da Esquina", "Milton Nascimento", "A capa com os dois meninos na estrada."),
      line("Clube da Esquina", "Lô Borges", "O outro lado da mesma esquina."),
    ];
    expect(findAlbumLine(namesakes, { title: "Clube da Esquina", artistName: "Lô Borges" })?.line).toBe(
      "O outro lado da mesma esquina.",
    );
  });

  it("returns null when nothing matches", () => {
    expect(findAlbumLine(lines, { title: "Transa", artistName: "Caetano Veloso" })).toBeNull();
    expect(findAlbumLine([], { title: "Racional", artistName: "Tim Maia" })).toBeNull();
    expect(findAlbumLine(lines, null)).toBeNull();
  });
});
