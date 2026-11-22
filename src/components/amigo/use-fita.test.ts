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
  it("counts only what played since yesterday and names the day without -feira", async () => {
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
    expect(dia.plays).toBe(2);
    expect(dia.capas.map((capa) => capa.key)).toEqual(["a", "b"]);
    expect(dia.last?.track).toBe("No More Tears");
  });
});
