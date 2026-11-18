import { describe, expect, it } from "vitest";
import { PACK_CADENCE, REFRESH_PRIORITY, refreshDecision } from "@/modules/ai-analysis/application/pack-freshness";
import type { ConversationMoment, Evidence } from "./conversation.types";
import { editorialKey, editorialSubject } from "./editorial";
import { formatDay, loopRun, selectMoments } from "./matching";

const play = (track: string, artist = "Banda") => ({ artist, track });
const cover = { url: null, title: "Disco", artist: "Banda" };
const moment = (evidence: Evidence) => ({ period: "7d", evidence }) as ConversationMoment;

describe("loopRun", () => {
  it("acha a maior sequência da mesma faixa e onde ela começa", () => {
    const events = [play("A"), play("B"), play("B"), play("B"), play("B"), play("A"), play("C"), play("C"), play("C"), play("C"), play("C")];
    expect(loopRun(events)).toEqual({ start: 6, times: 5 });
  });

  it("abaixo de quatro seguidas não é loop, e a mesma faixa de outro artista quebra a sequência", () => {
    expect(loopRun([play("A"), play("A"), play("A")])).toBeNull();
    expect(loopRun([play("A"), play("A"), play("A", "Outra"), play("A"), play("A")])).toBeNull();
    expect(loopRun([])).toBeNull();
  });
});

describe("formatDay", () => {
  it("diz o dia com o ano, no fuso de quem ouviu", () => {
    expect(formatDay(new Date("2023-10-23T01:30:00Z"), "America/Sao_Paulo")).toBe("22 out 2023");
  });
});

describe("as provas raras na conversa", () => {
  const loop: Evidence = { kind: "loop", artist: "Banda", track: "Faixa", times: 5, plays: [], cover, previewUrl: null };
  const comeback: Evidence = {
    kind: "comeback", artist: "Banda", awayFor: "9 meses", lastBefore: "1 jan 2026", firstBack: "3 nov 2026", plays: 7, cover, previewUrl: null, previewTrack: null,
  };
  const outlier: Evidence = { kind: "outlier", artist: "Banda", genre: "Forró", plays: 3, dominant: [], cover, previewUrl: null, previewTrack: null };

  it("o mesmo artista em assuntos diferentes não é o mesmo assunto", () => {
    const keys = [loop, comeback, outlier].map((evidence) => editorialKey(moment(evidence)));
    expect(new Set(keys).size).toBe(3);
    expect(editorialKey(moment(loop))).toBe(editorialKey(moment({ ...loop, times: 9 })));
    expect(editorialKey(moment(loop))).not.toBe(editorialKey(moment({ ...loop, track: "Outra" })));
  });

  it("nomeia o assunto silenciado de um jeito que dá pra reconhecer", () => {
    expect(editorialSubject(moment(loop))).toContain("Faixa");
    expect(editorialSubject(moment(comeback))).toContain("Banda");
    expect(editorialSubject(moment(outlier))).toContain("fora da curva");
  });

  it("o que só acontece de vez em quando passa na frente do topo e das épocas", () => {
    const chosen = selectMoments(
      [
        { id: "ranking", period: "7d" as const, kind: "ranking" as const },
        { id: "decades", period: "7d" as const, kind: "decades" as const },
        { id: "loop", period: "7d" as const, kind: "loop" as const },
        { id: "comeback", period: "7d" as const, kind: "comeback" as const },
      ],
      { perPeriod: 3 },
    );
    expect(chosen.map((entry) => entry.id)).toEqual(["loop", "comeback", "ranking"]);
  });
});

describe("o durável é escrito uma vez por mês", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it("o dia e a semana vêm primeiro na fila e o ano e o tudo por último", () => {
    expect(REFRESH_PRIORITY).toEqual(["1d", "7d", "30d", "1y", "all"]);
  });

  it("o dia é refeito no máximo duas vezes por dia, para sobrar vez para a semana e o mês", () => {
    expect(refreshDecision({ builtAt: new Date(now.getTime() - 11 * 3_600_000), fingerprint: "a" }, "b", "1d", now)).toBe("too_recent");
    expect(refreshDecision({ builtAt: new Date(now.getTime() - 13 * 3_600_000), fingerprint: "a" }, "b", "1d", now)).toBe("changed");
    expect(refreshDecision({ builtAt: new Date(now.getTime() - 25 * 3_600_000), fingerprint: "a" }, "a", "1d", now)).toBe("too_old");
  });

  it("escuta mudada não refaz o ano antes de quatro semanas", () => {
    for (const period of ["1y", "all"] as const) {
      expect(PACK_CADENCE[period].minHours).toBeGreaterThanOrEqual(24 * 28);
      expect(refreshDecision({ builtAt: daysAgo(20), fingerprint: "a" }, "b", period, now)).toBe("too_recent");
      expect(refreshDecision({ builtAt: daysAgo(29), fingerprint: "a" }, "b", period, now)).toBe("changed");
      expect(refreshDecision({ builtAt: daysAgo(32), fingerprint: "a" }, "a", period, now)).toBe("too_old");
    }
  });
});
