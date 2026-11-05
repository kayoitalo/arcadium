// Real components, synthetic responses; no database, provider, SDK or audio.
import { createRoot } from "react-dom/client";
import { Descobertas } from "../../src/components/descobertas/descobertas";
import { SelectionProvider } from "../../src/components/descobertas/selection-provider";
import { DiscoveryNavigation } from "../../src/components/descobertas/discovery-navigation";
import { buildListeningCues } from "../../src/modules/recommendations/domain/listening-cues";
import { CURATION_PROPOSALS } from "../../src/modules/recommendations/domain/territories";
const qa = { plays: 0, requests: [] as Array<{ url: string; body: any }>, failDoors: true, failCues: true, empty: false };
let currentIntent = "DISCOVER"; let destination: { genre: string } | undefined; let session = 0;
const tracks = [1, 2].map((n) => ({ id: `item-${n}`, rank: n, artistName: `Artista sintético ${n}`, trackName: `Porta ${n} (Live)`, albumName: null, genre: "dub", position: null,
  reason: "O catálogo associa este artista a dub; a tag não certifica esta gravação." }));
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
window.fetch = async (input, init) => {
  const url = String(input); const body = JSON.parse(String(init?.body ?? "{}")); qa.requests.push({ url, body });
  await new Promise(requestAnimationFrame); if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (url === "/api/collection") return reply({ items: [] });
  if (url === "/api/discovery-territories") {
    if (qa.failDoors) { qa.failDoors = false; return reply({}, 503); }
    return reply({ limited: true, doors: [{ genre: "dub", artists: 4, examples: ["Artista sintético 1", "Artista sintético 2"] }], proposals: CURATION_PROPOSALS });
  }
  if (url === "/api/listening-cues") {
    if (qa.failCues) { qa.failCues = false; return reply({}, 503); }
    const track = tracks.find((row) => row.id === body.itemId)!;
    return reply(buildListeningCues({ ...track, appleMusicUrl: "https://music.apple.com/br/album/synthetic/42?i=43", scoreComponents: {
      previewIdentity: { source: "itunes", sourceId: "43", artistName: track.artistName, trackName: track.trackName, match: "compatible-text-v1" },
      catalogFacts: { durationMs: 185000, fetchedAt: "2026-11-04T12:00:00Z" },
    } }));
  }
  if (url.endsWith("/media")) return reply({ status: "ready", coverUrl: null, previewUrl: "synthetic-audio", appleMusicUrl: null });
  if (url === "/api/recommendations") {
    if (!init?.method) return reply({ items: [] });
    if (body.operation === "NEW_ENTRY" || body.operation === "DEEPEN") { currentIntent = body.intent; destination = body.territory; session++; }
    const rows = qa.empty ? [] : tracks;
    return reply({ sessionId: `synthetic-${session}`, currentRank: 1, items: rows, settings: { intent: currentIntent, destination, dials: { proximity: 55, fame: 50 } },
      coverage: { version: 1, requested: 8, selected: rows.length, candidates: rows.length, eligible: rows.length, status: "INSUFFICIENT", scope: currentIntent === "TERRITORY" ? "territory-artists" : "repertoire-metadata", elapsedMs: 10 } });
  }
  if (body.operation === "EXPOSE") return reply({ ok: true });
  throw new Error(`Unexpected synthetic request: ${url}`);
};
Object.defineProperty(window, "Audio", { value: class { play() { qa.plays++; return Promise.resolve(); } pause() {} } });
createRoot(document.getElementById("root")!).render(<SelectionProvider userId="synthetic-territories"><DiscoveryNavigation pathname="/discovery" /><Descobertas /></SelectionProvider>);
const pause = () => new Promise(requestAnimationFrame);
async function wait(check: () => unknown, label: string) { const until = performance.now() + 7000; while (!check()) { if (performance.now() > until) throw new Error(label); await pause(); } }
function assert(value: unknown, label: string) { if (!value) throw new Error(label); }
const summary = (label: string) => [...document.querySelectorAll<HTMLElement>("summary")].find((row) => row.textContent?.includes(label))!;
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent?.trim() === label)!;
const ready = () => document.querySelector('[data-discovery-scene="ready"] h1');
async function runChecks() {
  const passed: string[] = [];
  await wait(() => summary("explorar outro universo"), "entry");
  assert(!qa.requests.some((row) => row.url === "/api/discovery-territories"), "closed doors must not query catalog");
  summary("explorar outro universo").click(); await wait(() => document.querySelector('[role="alert"]'), "door failure");
  button("tentar novamente").click(); await wait(() => document.querySelector('strong')?.textContent || document.body.textContent?.includes("Artista sintético 2"), "door retry");
  await wait(() => [...document.querySelectorAll("button strong")].some((row) => row.textContent === "dub ↗"), "door loaded");
  summary("propostas de curadoria").click(); assert(document.body.textContent?.includes("não são seleções aprovadas"), "draft curation must stay labeled");
  passed.push("lazy catalog, retry and visibly unapproved sourced curation");
  [...document.querySelectorAll<HTMLElement>("button strong")].find((row) => row.textContent === "dub ↗")!.click();
  await wait(ready, "territory session");
  assert(document.body.textContent?.includes("Cobertura insuficiente: 2 de 8"), "short result must explain coverage");
  assert(document.body.textContent?.includes("Destino escolhido: artistas associados a dub"), "destination label");
  assert(!document.querySelector("#mapa-descoberta"), "territory must not inherit proximity controls");
  assert(qa.plays === 0, "territory must not autoplay");
  passed.push("explicit destination, no proximity map, undercoverage and no autoplay");
  await wait(() => document.querySelector('button[aria-label="Ouvir prévia"]:not(:disabled)'), "media settled before cue retry scenario");
  summary("pistas para esta versão").click(); await wait(() => document.querySelector('[role="alert"]')?.textContent?.includes("pistas"), "cue failure");
  button("tentar novamente").click(); await wait(() => document.body.textContent?.includes("3:05"), "cue retry");
  assert(document.querySelector('a[href*="i=43"]') && document.body.textContent?.includes("Não são análise sonora"), "recording source/scope");
  button("buscar mais nesse caminho ↗").click(); await pause(); await pause(); await wait(ready, "more");
  const more = qa.requests.find((row) => row.body.operation === "MORE")!;
  assert(more.body.intent === "TERRITORY" && !more.body.territory, "MORE must reuse server destination");
  assert(qa.plays === 0, "more must not autoplay");
  passed.push("sourced catalog cue, retry and destination-preserving continuation");
  button("trocar caminho ↗").click(); await wait(() => summary("selecionar meu repertório"), "new entry");
  summary("selecionar meu repertório").click();
  await wait(() => document.querySelectorAll("input").length === 2, "repertoire form mounted");
  const inputs = [...document.querySelectorAll<HTMLInputElement>("input")];
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  set.call(inputs[0], "jazz"); inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
  set.call(inputs[1], "4"); inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
  await pause(); qa.empty = true; button("selecionar com este pedido →").click();
  await wait(() => document.body.textContent?.includes("Cobertura insuficiente: 0 de 8"), "empty restricted repertoire");
  const last = qa.requests.filter((row) => row.body.operation === "NEW_ENTRY").at(-1)!;
  assert(last.body.intent === "REPERTOIRE" && last.body.restrictions.albumGenre === "jazz" && last.body.restrictions.maxDurationMs === 240000, "restriction contract");
  assert(!document.querySelector("#mapa-descoberta") && qa.plays === 0, "empty repertoire must not broaden or autoplay");
  assert(document.documentElement.scrollWidth <= innerWidth, "viewport overflow");
  passed.push("album genre/duration request, empty result without widening, keyboard and viewport");
  return { passed, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, viewport: innerWidth, requests: qa.requests.length };
}
async function prepareTerritoryCapture(kind: string) {
  if (kind === "entry") {
    button("escolher outro caminho").click(); await wait(() => summary("explorar outro universo"), "entry capture");
    summary("explorar outro universo").click(); await wait(() => document.querySelector("button strong"), "doors capture");
  } else {
    qa.empty = false; [...document.querySelectorAll<HTMLElement>("button strong")].find((row) => row.textContent === "dub ↗")!.click();
    await pause(); await wait(ready, "cue capture session");
    await wait(() => document.querySelector('button[aria-label="Ouvir prévia"]:not(:disabled)'), "capture media");
    summary("pistas para esta versão").click(); await wait(() => document.body.textContent?.includes("3:05"), "cue capture");
  }
  window.scrollTo({ top: 0, behavior: "instant" }); await new Promise((resolve) => setTimeout(resolve, 250));
}
Object.assign(window, { runDiscoveryChecks: runChecks, arcadiumQA: qa, prepareTerritoryCapture });
