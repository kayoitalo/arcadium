import { describe, expect, it } from "vitest";
import type { Evidence } from "./conversation.types";
import { factsAgree, namesAgree, quotedNames, unitsAgree } from "./fact-check";

const tracks: Evidence = {
  kind: "ranking", unit: "track", focusIndex: 0, share: 4, citesShare: false, previewUrl: null, previewTrack: "Out of Time",
  cover: { url: null, title: "Dawn FM", artist: "The Weeknd" },
  rows: [{ label: "Out of Time", sub: "The Weeknd", plays: 2 }, { label: "With You", sub: "Chris Brown", plays: 1 }],
};

describe("a frase só afirma o que a prova mostra", () => {
  it("reads the names quoted in the sentence", () => {
    expect(quotedNames("colocar 'Out of Time' e o disco “Dawn FM” no repeat, \"100%\"")).toEqual(["Out of Time", "Dawn FM"]);
  });

  it("accepts names that are in the proof, ignoring editions and accents", () => {
    expect(namesAgree("tu colocou 'Out of Time - 2022 Remaster' de novo", tracks)).toBe(true);
    expect(namesAgree("e 'With You' veio junto", tracks)).toBe(true);
    expect(namesAgree("e 'Blinding Lights' dominou", tracks)).toBe(false);
  });

  it("rejects a ranking claim in a unit the proof does not rank", () => {
    expect(unitsAgree("O disco 'Dawn FM' acabou sendo o mais rodado das tuas 24 horas.", tracks)).toBe(false);
    expect(unitsAgree("A faixa 'Out of Time' foi a mais tocada do dia.", tracks)).toBe(true);
    expect(unitsAgree("Foram 294 artistas novos no teu fone.", tracks)).toBe(false);
    expect(factsAgree("A faixa 'Out of Time' dominou o topo.", tracks)).toBe(true);
  });
});
