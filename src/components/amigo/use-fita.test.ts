import { describe, expect, it } from "vitest";
import { fitaFrom } from "./use-fita";

const event = (id: string, album: string | null, cover: string | null, track = "Faixa - 2011 Remaster") => ({
  id, playedAt: "2026-11-19T22:33:36.000Z", rawArtistName: "Ozzy Osbourne", rawTrackName: track, rawAlbumName: album, coverUrl: cover,
});

describe("a fita da espera", () => {
  it("keeps one cover per album, skips plays without cover and cleans the track name", () => {
    const { fita } = fitaFrom({ events: [event("a", "No More Tears", "https://x/a.jpg"), event("b", "No More Tears", "https://x/a.jpg"), event("c", "Ozzmosis", null), event("d", "Blizzard", "https://x/b.jpg")], totalItems: 0, since: null });
    expect(fita.map((folha) => folha.key)).toEqual(["a", "d"]);
    expect(fita[0].coverUrl).toBe("/api/cover?u=https%3A%2F%2Fx%2Fa.jpg");
    expect(fita[0].caption.startsWith("Faixa · Ozzy Osbourne · ")).toBe(true);
  });

  it("says how many plays he is reading, and since when, only with real numbers", () => {
    expect(fitaFrom({ events: [], totalItems: 13631, since: "2022-04-12T15:58:05.000Z" }).later).toBe("São 13.631 audições desde abril de 2022. Tô no meio.");
    expect(fitaFrom({ events: [], totalItems: 0, since: null }).later).toBeNull();
  });
});

describe("o dia de hoje", () => {
  it("counts only the last 24 hours, the same window as the reading, and names the day without -feira", async () => {
    const { diaFrom } = await import("./use-fita");
    const now = new Date(2026, 10, 20, 10, 0);
    const page = {
      events: [
        { ...event("a", "No More Tears", "https://x/a.jpg", "No More Tears"), playedAt: new Date(2026, 10, 19, 19, 33).toISOString() },
        { ...event("b", "Blizzard", "https://x/b.jpg"), playedAt: new Date(2026, 10, 19, 8, 0).toISOString() },
        { ...event("c", "Old", "https://x/c.jpg"), playedAt: new Date(2026, 10, 17, 8, 0).toISOString() },
      ],
      totalItems: 3, since: null,
    };
    const dia = diaFrom(page, now);
    expect(dia.date).toBe("sexta, 20 de novembro");
    expect(dia.plays).toBe(1);
    expect(dia.capas.map((capa) => capa.key)).toEqual(["a"]);
    expect(dia.last?.track).toBe("No More Tears");
  });

  const at = (days: number, now: Date) => ({ events: [{ ...event("a", "X", "https://x/a.jpg"), playedAt: new Date(now.getTime() - days * 86_400_000).toISOString() }], totalItems: 1, since: null });

  it("names the weekday only while it cannot be mistaken for this week", async () => {
    const { diaFrom } = await import("./use-fita");
    const now = new Date(2026, 10, 22, 16, 0);
    expect(diaFrom(at(3, now), now).last?.day).toBe("quinta");
    expect(diaFrom(at(7, now), now).last?.day).toBe("15 de novembro");
    expect(diaFrom(at(24, now), now).last?.day).toBe("29 de outubro");
    expect(diaFrom(at(330, now), now).last?.day).toBe("27 de dezembro de 2025");
  });

  it("says 'pelo menos' only when the page was full", async () => {
    const { diaFrom } = await import("./use-fita");
    const now = new Date(2026, 10, 22, 16, 0);
    const many = (n: number) => ({ events: Array.from({ length: n }, (_, i) => ({ ...event(String(i), "X", null), playedAt: new Date(now.getTime() - (i + 1) * 60_000).toISOString() })), totalItems: n, since: null });
    expect(diaFrom(many(100), now).atLeast).toBe(true);
    expect(diaFrom(many(99), now).atLeast).toBe(false);
  });
});
