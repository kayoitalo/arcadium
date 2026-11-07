// Browser interactions with the real weekly component and synthetic API responses.
import { createRoot } from "react-dom/client";
import { WeeklyDiscovery, WeeklyHistory } from "../../src/components/descobertas/weekly-discovery";
import type { WeeklyView } from "../../src/modules/recommendations/domain/weekly-journey";

const week: WeeklyView = {
  id: "911bbac8-b3c3-4127-8254-a610031b3175", timezone: "America/Sao_Paulo", weekKey: "2026-11-02",
  startsAt: "2026-11-02T03:00:00Z", endsAt: "2026-11-09T03:00:00Z", status: "READY", personalized: true, limited: true,
  entries: [
    { id: "913c225a-b8bc-4520-8c8e-8b3f726b532f", position: 1, role: "NEAR", kind: "ALBUM", artistName: "Artista fictício",
      style: "Samba", reason: "Parte de uma referência das tuas escutas.", reference: { provider: "history", url: null }, sessionId: null,
      exposedAt: null, trackCount: 2, album: { collectionId: "42", storefront: "BR", artistName: "Artista fictício", albumName: "Um disco em duas partes",
        trackCount: 2, provider: "itunes", sourceUrl: "https://music.apple.com/br/album/42", artworkUrl: null,
        releaseDate: null, fetchedAt: "2026-11-05T10:00:00Z" } },
    { id: "99ad1b04-923b-45e5-9e23-6d45384d9d01", position: 2, role: "TERRITORY", kind: "ARTIST", artistName: "Um artista de outro canto",
      style: "Dub", reason: "Uma porta em um estilo pouco representado.", reference: { provider: "lastfm", url: "https://www.last.fm/music/Synthetic" },
      sessionId: null, exposedAt: null, trackCount: 1, trackSource: "lastfm", tracks: ["Uma faixa do catálogo"] },
  ],
};
const oldWeek = { ...week, id: "120ff4cf-6536-4489-8d2b-b23776ec4eae", weekKey: "2026-10-26",
  startsAt: "2026-10-26T03:00:00Z", endsAt: "2026-11-02T03:00:00Z" };
const requests: { url: string; body: any }[] = [];
const starts: string[] = [];
let ready = false;
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
window.fetch = async (url, init) => {
  const body = JSON.parse(String(init?.body ?? "{}")); requests.push({ url: String(url), body });
  await new Promise(requestAnimationFrame);
  if (String(url).includes("history=1")) return response({ weeks: [oldWeek], nextCursor: null });
  if (body.action === "PREPARE") { ready = true; return response({ current: week, previous: null, canPrepare: false }); }
  if (body.action === "EXPOSE") return response({ success: true });
  if (body.action === "START") {
    const entry = week.entries.find((entry) => entry.id === body.entryId)!; entry.sessionId = `session-${entry.kind}`;
    return response({ sessionId: entry.sessionId });
  }
  if (body.action === "NARRATE") return response({ ...week, narrativeStatus: "READY", narrative: { opening: "Uma apresentação experimental.",
    transitions: { [week.entries[0].id]: "Dá uma chance à primeira faixa." } } });
  return response({ current: ready ? week : null, previous: ready ? null : oldWeek, canPrepare: !ready });
};

const root = createRoot(document.getElementById("root")!);
const render = (key: string) => root.render(<><WeeklyDiscovery key={key} allowNarrative onStart={(id) => starts.push(id)} /><WeeklyHistory /></>);
render("first");
function assert(value: unknown, label: string) { if (!value) throw new Error(label); }
async function wait(check: () => unknown, label: string) {
  const deadline = performance.now() + 6000;
  while (!check()) { if (performance.now() > deadline) throw new Error(`Timeout: ${label}`); await new Promise(requestAnimationFrame); }
}
const text = () => document.body.textContent ?? "";
function control<E extends HTMLElement>(selector: string, name: string) {
  const found = [...document.querySelectorAll<E>(selector)].find((row) => row.textContent?.trim() === name);
  if (!found) throw new Error(`Missing control: ${name}`);
  return found;
}
async function runDiscoveryChecks() {
  await wait(() => text().includes("2 portas neste recorte"), "saved weekly coverage");
  assert(requests.filter((request) => request.body.action === "PREPARE").length === 1, "weekly preparation must happen once");
  assert(!requests.some((request) => request.body.action === "START" || request.body.action === "NARRATE"), "loading must not start sessions or call AI");
  control("summary", "conferir a edição").click();
  await wait(() => text().includes("loja BR"), "album edition");
  control("summary", "ver as faixas da entrada").click();
  await wait(() => text().includes("Uma faixa do catálogo"), "artist tracks");
  assert(text().includes("Faixas populares no Last.fm"), "artist chart provenance");
  control("button", "experimentar outra apresentação").click();
  await wait(() => text().includes("Uma apresentação experimental."), "opt-in narrative");
  assert(requests.filter((request) => request.body.action === "NARRATE").length === 1, "one explicit narrative request");
  control("button", "voltar ao texto simples").click();
  await wait(() => !text().includes("Uma apresentação experimental."), "deterministic presentation");
  const doors = [...document.querySelectorAll("article")];
  doors[0].querySelector<HTMLButtonElement>("button")!.click();
  await wait(() => starts.includes("session-ALBUM"), "start album");
  await wait(() => !doors[1].querySelector<HTMLButtonElement>("button")?.disabled, "start released");
  doors[1].querySelector<HTMLButtonElement>("button")!.click();
  await wait(() => starts.includes("session-ARTIST"), "start artist");
  render("reopen");
  await wait(() => document.querySelectorAll('a[href*="session="]').length === 2, "resume both sessions");
  assert(requests.filter((request) => request.body.action === "PREPARE").length === 1, "reopening must not prepare again");
  control("summary", "jornadas da semana").click();
  await wait(() => document.querySelector(`a[href="/discovery?semana=${oldWeek.id}"]`), "older weeks");
  assert(document.documentElement.scrollWidth <= innerWidth, "weekly journey must fit without horizontal overflow");
  return { passed: ["automatic preparation and partial coverage", "album edition and artist chart", "opt-in narrative", "both starts, resume and weekly memory"],
    viewport: innerWidth, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, requests: requests.length };
}
Object.assign(window, { runDiscoveryChecks });
