import { describe, expect, it } from "vitest";
import { getPeriodRanges } from "@/modules/statistics/application/overview-service";
import { editorialKey } from "@/modules/conversation/domain/editorial";
import { selectMoments, windowLabel } from "@/modules/conversation/domain/matching";
import type { ConversationMoment, Evidence } from "@/modules/conversation/domain/conversation.types";
import type { MusicProfileInput } from "../domain/ai-analysis.types";
import { availableAngles, findBinge, findDebuts, findLateNight, localClock } from "./listening-signals";
import { packFingerprint } from "./pack-freshness";

const ZONE = "America/Sao_Paulo";
/** Hora de Brasília (UTC-3) → instante. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00-03:00`);
const play = (day: string, time: string, artist = "Banda", track = "Faixa") => ({ artist, track, playedAt: at(day, time) });

describe("localClock", () => {
  it("lê o dia e a hora no fuso de quem ouviu, não em UTC", () => {
    // 01:30 UTC do dia 9 ainda é 22:30 do dia 8 em Brasília
    expect(localClock(new Date("2026-11-09T01:30:00Z"), ZONE)).toEqual({ day: "2026-11-08", hour: 22, time: "22:30" });
  });
});

describe("findLateNight", () => {
  it("acha as audições seguidas entre 0h e 5h da mesma noite", () => {
    const events = [
      play("2026-11-07", "23:50"),
      play("2026-11-08", "01:12"),
      play("2026-11-08", "01:16"),
      play("2026-11-08", "02:40"),
      play("2026-11-08", "03:40"),
      play("2026-11-08", "09:00"),
    ];
    expect(findLateNight(events, ZONE)).toEqual({ start: 1, plays: 4, from: "01:12", to: "03:40" });
  });

  it("poucas audições não são sessão, e duas noites não se somam", () => {
    expect(findLateNight([play("2026-11-08", "01:00"), play("2026-11-08", "01:05"), play("2026-11-08", "01:10")], ZONE)).toBeNull();
    const twoNights = [
      play("2026-11-08", "03:00"),
      play("2026-11-08", "03:05"),
      play("2026-11-09", "00:30"),
      play("2026-11-09", "00:35"),
    ];
    expect(findLateNight(twoNights, ZONE)).toBeNull();
    expect(findLateNight([], ZONE)).toBeNull();
  });
});

describe("findBinge", () => {
  const day = (date: string, own: number, others: number) => [
    ...Array.from({ length: own }, (_, index) => play(date, `1${index % 10}:00`, "Banda")),
    ...Array.from({ length: others }, (_, index) => play(date, `2${index % 4}:00`, `Outro ${index}`)),
  ];

  it("acha o dia em que um artista foi a maior parte de tudo que tocou", () => {
    expect(findBinge([...day("2026-11-07", 3, 9), ...day("2026-11-08", 9, 3)], ZONE)).toEqual({
      artist: "Banda",
      plays: 9,
      dayTotal: 12,
      day: "2026-11-08",
    });
  });

  it("muitas audições diluídas num dia cheio, ou poucas num dia vazio, não são maratona", () => {
    expect(findBinge(day("2026-11-08", 9, 12), ZONE)).toBeNull();
    expect(findBinge(day("2026-11-08", 5, 0), ZONE)).toBeNull();
  });
});

describe("findDebuts", () => {
  const start = new Date("2026-11-04T00:00:00Z");
  it("só conta quem nunca tinha tocado antes do período e tocou mais de uma vez", () => {
    const debuts = findDebuts(
      [
        { name: "Nova", plays: 6 },
        { name: "Antiga", plays: 9 },
        { name: "Esbarrão", plays: 1 },
        { name: "Sem registro", plays: 4 },
      ],
      new Map([
        ["Nova", new Date("2026-11-06T10:00:00Z")],
        ["Antiga", new Date("2024-01-01T10:00:00Z")],
        ["Esbarrão", new Date("2026-11-07T10:00:00Z")],
      ]),
      start,
    );
    expect(debuts).toEqual([{ name: "Nova", plays: 6 }]);
  });
});

describe("os ângulos e a janela do dia", () => {
  const base: MusicProfileInput = {
    period: "1d",
    topArtists: [],
    topGenres: [],
    risingArtists: [],
    discovery: { newArtists: 0, newArtistPlayShare: 0 },
    concentration: { top5ArtistShare: 0, top10TrackShare: 0 },
    totalPlays: 20,
    uniqueArtists: 5,
    uniqueTracks: 12,
  };
  const night = { plays: 4, from: "01:12", to: "03:40", tracks: [] };

  it("só oferece estreia, madrugada e maratona quando o dado existe", () => {
    expect(availableAngles(base)).toEqual(["numeros"]);
    expect(
      availableAngles({ ...base, debuts: [{ name: "Nova", plays: 6 }], lateNight: night, binge: { artist: "Banda", plays: 9, dayTotal: 12, day: "8 nov" } }),
    ).toEqual(["numeros", "estreia", "madrugada", "maratona"]);
  });

  it("uma madrugada nova muda a história e pede outro pacote", () => {
    expect(packFingerprint({ ...base, lateNight: night })).not.toBe(packFingerprint(base));
    expect(packFingerprint({ ...base, lateNight: night })).toBe(packFingerprint({ ...base, lateNight: { ...night, plays: 5 }, totalPlays: 21 }));
  });

  it("a janela do dia são as últimas 24 horas, comparadas com as 24 anteriores", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    const { current, previous } = getPeriodRanges("1d", now);
    expect(current.start.toISOString()).toBe("2026-11-10T12:00:00.000Z");
    expect(previous?.start.toISOString()).toBe("2026-11-09T12:00:00.000Z");
    expect(windowLabel("1d", null)).toBe("de ontem pra cá");
  });

  it("o dia abre a conversa e o que é raro passa na frente do topo", () => {
    const chosen = selectMoments([
      { id: "semana", period: "7d" as const, kind: "ranking" as const },
      { id: "topo do dia", period: "1d" as const, kind: "ranking" as const },
      { id: "madrugada", period: "1d" as const, kind: "night" as const },
      { id: "estreia", period: "1d" as const, kind: "debut" as const },
    ]);
    expect(chosen.map((entry) => entry.id)).toEqual(["madrugada", "estreia", "semana"]);
  });

  it("cada madrugada e cada maratona é um assunto próprio", () => {
    const cover = { url: null, title: "Disco", artist: "Banda" };
    const moment = (evidence: Evidence) => ({ period: "1d", evidence }) as ConversationMoment;
    const nightOf = (when: string): Evidence => ({
      kind: "night", from: "01:12", to: "03:40", plays: 4, steps: [{ artist: "Banda", track: "Faixa", when }], cover, previewUrl: null,
    });
    const bingeOf = (day: string): Evidence => ({
      kind: "binge", artist: "Banda", plays: 9, dayTotal: 12, day, tracks: [], cover, previewUrl: null, previewTrack: null,
    });
    expect(editorialKey(moment(nightOf("8 nov · 01:12")))).not.toBe(editorialKey(moment(nightOf("9 nov · 01:12"))));
    expect(editorialKey(moment(bingeOf("8 nov")))).not.toBe(editorialKey(moment(bingeOf("9 nov"))));
  });
});
