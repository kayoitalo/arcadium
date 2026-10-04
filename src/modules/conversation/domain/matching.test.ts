import { describe, expect, it } from "vitest";
import {
  claimedCounts,
  claimedShares,
  claimsAgree,
  decadesIn,
  focusIn,
  mentions,
  observedGap,
  pickTransition,
  selectMoments,
  windowLabel,
} from "./matching";

describe("mentions", () => {
  it("acha o nome inteiro, sem acento e sem participação especial", () => {
    expect(mentions("DEBÍ TIRAR MÁS FOTOS", "DeBÍ TiRAR MáS FOToS")).toBe(true);
    expect(mentions("entra Can't Hold Us botando pra pular", "Can't Hold Us (feat. Ray Dalton)")).toBe(true);
  });

  it("não casa pedaço de palavra nem nome curto demais", () => {
    expect(mentions("um elemento estranho", "Element")).toBe(false);
    expect(mentions("tu e eu", "Tu")).toBe(false);
  });
});

describe("pickTransition", () => {
  const events = [
    { artist: "The Cranberries", track: "Zombie" },
    { artist: "Don Toliver", track: "Tiramisu" },
    { artist: "Seal", track: "Kiss from a Rose" },
    { artist: "Fleetwood Mac", track: "Go Your Own Way" },
  ];

  it("acha o par que a frase cita, pela faixa ou pelo artista", () => {
    expect(pickTransition(events, "Rapaz, tu tava no Don Toliver e de repente entrou Seal")).toBe(1);
    expect(pickTransition(events, "De Tiramisu direto pra Kiss from a Rose")).toBe(1);
  });

  it("não inventa par com um lado só na frase, nem com o mesmo artista", () => {
    expect(pickTransition(events, "O Seal tomou conta")).toBe(-1);
    expect(pickTransition([events[1], { artist: "Don Toliver", track: "After Party" }], "Don Toliver e Don Toliver")).toBe(-1);
  });
});

describe("focusIn", () => {
  const lists = [
    { unit: "album" as const, labels: ["Shoot for the Stars Aim for the Moon"] },
    { unit: "track" as const, labels: ["Dior", "Element"] },
  ];

  it("a manchete manda sobre a narrativa", () => {
    expect(focusIn(["Tu já aprendeu a risadinha?", "68 vezes ouvindo Element!"], lists)).toEqual({ unit: "track", index: 1 });
  });

  it("no mesmo trecho, a ordem das listas decide", () => {
    expect(focusIn(["Element e Shoot for the Stars Aim for the Moon"], lists)).toEqual({ unit: "album", index: 0 });
  });

  it("sem citação, sem foco", () => {
    expect(focusIn(["nada a ver"], lists)).toBeNull();
  });
});

describe("a frase bate com o dado", () => {
  it("lê os números em algarismo", () => {
    expect(claimedCounts("Pô, 68 vezes ouvindo Element! Foram 1.758 audições")).toEqual([68, 1758]);
    expect(claimedCounts("Trinta e duas vezes o álbum")).toEqual([]);
  });

  it("lê as porcentagens, e deixa de fora o jeito de falar", () => {
    expect(claimedShares("Os anos 2000 dominam 41% de tudo; o resto, 12,5 por cento")).toEqual([41, 12.5]);
    expect(claimedShares("Isso é 100% vibe")).toEqual([]);
  });

  it("aceita o jeito de falar, e barra o número de outra coisa", () => {
    expect(claimsAgree([32], [33])).toBe(true);
    // "quase 40%" para 39,4
    expect(claimsAgree(claimedShares("Quase 40% de tudo"), [39.4])).toBe(true);
    // "Bleeding Heart com 53 vezes": 53 é o total do Angra, a faixa tem 11
    expect(claimsAgree([53], [11])).toBe(false);
    expect(claimsAgree([], [11])).toBe(true);
  });
});

describe("decadesIn", () => {
  const now = new Date("2026-09-24T12:00:00Z");

  it("lê os jeitos de falar de uma década", () => {
    expect(decadesIn("Metade do teu mês é anos 80", now)).toEqual([1980]);
    expect(decadesIn("as eras de 2000s e 2010s mandam", now)).toEqual([2000, 2010]);
    expect(decadesIn("entre a década passada e a retrasada", now)).toEqual([2000, 2010]);
    expect(decadesIn("Tu vive preso nos anos 2010, mano?", now)).toEqual([2010]);
  });

  it("não confunde segundo de prévia com década", () => {
    expect(decadesIn("uma prévia de 30s", now)).toEqual([]);
  });
});

describe("observedGap", () => {
  const monthly = new Map([
    ["2023-05", 886],
    ["2023-06", 728],
    ["2026-07", 25],
    ["2026-08", 1057],
  ]);

  it("recusa a volta que atravessa um buraco no histórico", () => {
    expect(observedGap(monthly, new Date("2023-06-23"), new Date("2026-08-24"))).toBe(false);
  });

  it("aceita a volta de quem estava ouvindo música no meio-tempo", () => {
    const busy = new Map([
      ["2026-03", 400],
      ["2026-04", 380],
      ["2026-05", 510],
      ["2026-06", 470],
    ]);
    expect(observedGap(busy, new Date("2026-02-10"), new Date("2026-07-01"))).toBe(true);
  });
});

describe("selectMoments", () => {
  it("vai do mais recente ao mais antigo, sem repetir o tipo de prova na mesma janela", () => {
    const chosen = selectMoments([
      { id: "a", period: "all" as const, kind: "ranking" as const },
      { id: "b", period: "30d" as const, kind: "ranking" as const },
      { id: "c", period: "30d" as const, kind: "ranking" as const },
      { id: "d", period: "30d" as const, kind: "transition" as const },
      { id: "e", period: "7d" as const, kind: "decades" as const },
    ]);
    expect(chosen.map((entry) => entry.id)).toEqual(["e", "d", "b", "a"]);
  });

  it("não deixa um tipo de prova tomar a conversa", () => {
    const chosen = selectMoments([
      { id: "a", period: "7d" as const, kind: "decades" as const },
      { id: "b", period: "30d" as const, kind: "decades" as const },
      { id: "c", period: "1y" as const, kind: "decades" as const },
      { id: "d", period: "all" as const, kind: "ranking" as const },
    ]);
    expect(chosen.map((entry) => entry.id)).toEqual(["a", "b", "d"]);
  });

  it("para no limite", () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      period: (["7d", "30d", "1y", "all"] as const)[index % 4],
      kind: (["transition", "ranking", "decades"] as const)[index % 3],
    }));
    expect(selectMoments(many, { limit: 3 })).toHaveLength(3);
  });
});

describe("windowLabel", () => {
  it("fala a janela do jeito do amigo", () => {
    expect(windowLabel("30d", null)).toBe("nesse último mês");
    expect(windowLabel("all", new Date("2022-04-12T12:00:00Z"))).toBe("desde que eu te conheço, lá em abril de 2022");
  });
});
