// Synthetic interactions only. No credentials, provider, database or real audio.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AlbumJourneys } from "../../src/components/descobertas/album-journeys";
import { Descobertas } from "../../src/components/descobertas/descobertas";
import { DiscoveryNavigation } from "../../src/components/descobertas/discovery-navigation";
import { SelectionProvider } from "../../src/components/descobertas/selection-provider";
const qa = { requests: [] as { url: string; body: any }[], failEditions: true, failBegin: true, failContext: true, plays: 0, rank: 1 };
const album = { provider: "itunes", collectionId: "42", storefront: "BR", artistName: "Banda fictícia de nome comprido para conferir o celular", albumName: "O disco sintético (Ao vivo)", trackCount: 2,
  sourceUrl: "https://music.apple.com/br/album/42", artworkUrl: null, releaseDate: "2020-01-01T00:00:00Z", fetchedAt: "2026-11-02T12:00:00.000Z" };
const preview = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const tracks = [1, 2].map((i) => ({ id: `album-item-${i}`, artistName: album.artistName, trackName: `Faixa ${i} (Ao vivo)`, albumName: album.albumName,
  previewUrl: i === 2 ? preview : null, coverUrl: null, genre: null, reason: `Disco 1, faixa ${i} da edição escolhida.`, rank: i, position: null,
  scoreComponents: { albumEdition: { ...album, trackId: String(i), disc: 1, number: i } } }));
const payload = () => ({ sessionId: "album-session", algorithmVersion: "album-v1", currentRank: qa.rank, items: tracks,
  settings: { intent: "ALBUM" }, journey: { action: "ALBUM", rootSessionId: "album-session", album } });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
window.fetch = async (input, init) => {
  const url = String(input); const body = JSON.parse(String(init?.body ?? "{}")); qa.requests.push({ url, body });
  await new Promise(requestAnimationFrame); if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (url.startsWith("/api/album-journeys?")) return response({ albums: Array.from({length:20},(_,i)=>({ source: { kind: "library", id: i ? "owned-"+i : "owned" }, albumName: i ? "Outro disco sintético "+i : album.albumName, artistName: album.artistName })), more: false });
  if (url === "/api/album-journeys" && body.action === "EDITIONS") {
    if (qa.failEditions) { qa.failEditions = false; return response({ error: "Catálogo indisponível (simulação)." }, 503); }
    return response({ editions: [album] });
  }
  if (url === "/api/album-journeys" && body.action === "BEGIN") {
    if (qa.failBegin) { qa.failBegin = false; return response({ error: "A jornada ainda está sendo preparada (simulação).", code: "GENERATION_PENDING" }, 409); }
    return response(payload());
  }
  if (url === "/api/collection") return response({ items: [] });
  if (url.endsWith("?history=1")) return response({ sessions: [] });
  if (url === "/api/recommendations") return response(payload());
  if (body.operation === "EXPOSE") return response({ success: true });
  if (body.operation === "MOVE") { qa.rank = body.rank; return response({ currentRank: qa.rank }); }
  if (url.endsWith("/media")) return response({ coverUrl: null, previewUrl: body.itemId === "album-item-2" ? preview : null, appleMusicUrl: album.sourceUrl, status: body.itemId === "album-item-2" ? "ready" : "unavailable" });
  if (url === "/api/discovery-context") {
    if (qa.failContext) { qa.failContext = false; return response({ error: "Fonte indisponível (simulação)." }, 503); }
    const base = { provider: "lastfm", kind: body.kind, artistName: album.artistName, title: body.kind === "album" ? album.albumName : tracks[1].trackName,
      fetchedAt: album.fetchedAt, requestedLanguage: "pt", recordingVerified: false };
    return response(body.kind === "album" ? { ...base, status: "AVAILABLE", sourceUrl: "https://www.last.fm/music/Synthetic/Album",
      text: "Texto sintético com fonte. <img src=x onerror=alert(1)> permanece texto: esta fixture não descreve um disco real." } : { ...base, status: "MISSING", reason: "IDENTITY_MISMATCH" });
  }
  if (url === "/api/discovery-events") return response({ success: true });
  throw new Error(`Unexpected synthetic request: ${url}`);
};
Object.defineProperty(window, "Audio", { value: class { play() { qa.plays++; return Promise.resolve(); } pause() {} } });
Object.defineProperty(window, "AudioContext", { value: class { state = "running"; destination = {}; createAnalyser() { return { connect() {}, getByteTimeDomainData(buffer: Uint8Array) { buffer.fill(128); } }; } createMediaElementSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } } });
function Fixture() {
  const [session, setSession] = useState<string | null>(null); const [visit, setVisit] = useState(0);
  return session ? <><DiscoveryNavigation pathname="/discovery"/><button onClick={() => setVisit((value) => value + 1)}>remontar a sessão de teste</button><SelectionProvider userId="synthetic-album"><Descobertas key={visit} initialSessionId={session} /></SelectionProvider></>
    : <><DiscoveryNavigation pathname="/discovery/albums"/><AlbumJourneys onBegin={setSession} /></>;
}
const root = createRoot(document.getElementById("root")!); root.render(<Fixture />);
const frame = () => new Promise(requestAnimationFrame);
async function wait(check: () => unknown, label: string) { const limit = performance.now() + 7000; while (!check()) { if (performance.now() > limit) throw new Error(`Timeout: ${label}`); await frame(); } }
function assert(value: unknown, label: string) { if (!value) throw new Error(label); }
function button(label: string) { const node = [...document.querySelectorAll<HTMLButtonElement>("button")].find((el) => el.textContent?.trim() === label); if (!node) throw new Error(`Button missing: ${label}`); return node; }
function summary(label: string) { const node = [...document.querySelectorAll("summary")].find((el) => el.textContent?.includes(label)); if (!node) throw new Error(`Summary missing: ${label}`); return node; }
const ready = (n: number) => document.querySelector('[data-discovery-scene="ready"] h1')?.textContent?.includes(`Faixa ${n}`);
const bodyText = () => document.body.textContent ?? "";
async function runChecks() {
  const passed: string[] = [];
  await wait(() => [...document.querySelectorAll("button")].some((node) => node.textContent === "ouvir este álbum →"), "library");
  assert(!qa.requests.some((r) => r.body.action), "Local library must not query the music provider");
  assert(document.documentElement.scrollWidth <= innerWidth, "Album library must fit mobile");
  const libraryCalls=qa.requests.length;
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((node)=>node.textContent?.includes("mais discos desta estante"))!.click();
  await wait(()=>document.querySelectorAll("button[aria-expanded]").length===12,"more local albums");
  assert(qa.requests.length===libraryCalls,"Showing more albums must not query any provider");
  button("ouvir este álbum →").click(); await wait(() => document.querySelector('[role="alert"]'), "catalog error");
  button("tentar novamente").click(); await wait(() => [...document.querySelectorAll("button")].some((node) => node.textContent === "começar com esta versão →"), "editions retry");
  assert(bodyText().includes("Ao vivo") && bodyText().includes("loja BR"), "Edition version/storefront must be visible");
  assert(document.querySelector("#album-versions")!.closest("li")?.querySelector("button[aria-expanded]"),"Versions must open inside the chosen album, not after all 20 results");
  await wait(()=>{const box=document.querySelector("#album-versions h2")!.getBoundingClientRect();return box.top>=0&&box.top<innerHeight;},"inline version heading in viewport");
  passed.push("local owned references and explicit catalog lookup with recoverable error");
  button("começar com esta versão →").click(); button("começar com esta versão →").click();
  await wait(() => document.querySelector('[role="alert"]'), "pending begin");
  assert(qa.requests.filter((r) => r.body.action === "BEGIN").length === 1, "Double activation must reserve only once");
  button("começar com esta versão →").click(); await wait(() => ready(1), "first ordered track");
  const starts = qa.requests.filter((r) => r.body.action === "BEGIN"); assert(starts[0].body.requestKey === starts[1].body.requestKey, "Retry must reuse the operation key");
  assert(!document.querySelector("#mapa-descoberta"), "An ordered album must not offer a ranking map");
  assert(!bodyText().includes("buscar mais nesse caminho"), "Album must not offer a generic MORE operation");
  assert(qa.plays === 0, "Beginning an album must not autoplay");
  passed.push("explicit edition start, duplicate guard, idempotent retry and no autoplay");
  summary("ordem das faixas").click(); await wait(() => [...document.querySelectorAll("button")].some((node) => node.textContent?.includes("1.02")), "tracklist");
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.includes("1.02"))!.click();
  await wait(() => ready(2), "move to second track");
  assert(qa.requests.some((r) => r.body.operation === "MOVE" && r.body.rank === 2 && r.body.expectedRank === 1), "Moving must preserve the optimistic cursor contract");
  assert(!qa.requests.some((r) => r.url.endsWith("/feedback")), "Navigating an album must not fabricate a vote");
  const resumes = qa.requests.filter((r) => r.body.operation === "RESUME").length;
  button("remontar a sessão de teste").click(); await wait(() => qa.requests.filter((r) => r.body.operation === "RESUME").length > resumes && ready(2), "resume current rank");
  assert(qa.plays === 0, "Moving/resuming must not autoplay");
  passed.push("disc/track navigation, cursor resume and feedback kept separate");
  assert(!qa.requests.some((r) => r.url === "/api/discovery-context"), "Context must not fetch before explicitly opened");
  summary("um pouco de contexto").click(); await wait(() => bodyText().includes("Fonte indisponível"), "context failure");
  button("tentar novamente").click(); await wait(() => document.querySelector("blockquote"), "sourced excerpt");
  assert(document.querySelector('a[href="https://www.last.fm/music/Synthetic/Album"]'), "Context needs a direct source");
  assert(bodyText().includes("consultado em") && bodyText().includes("gravações são identificadas separadamente"), "Context date and scope must be explicit");
  assert(!document.querySelector("blockquote img"), "Source content must remain escaped text");
  button("sobre a música").click(); await wait(() => bodyText().includes("nome devolvido pela fonte"), "identity gap");
  assert(!document.querySelector("blockquote"), "A mismatched track must not borrow the album's context");
  button("sobre o álbum").click(); await wait(() => document.querySelector("blockquote"), "restore album excerpt");
  assert(qa.plays === 0, "Reading source text must not start audio");
  document.querySelector<HTMLButtonElement>('button[aria-label="Ouvir prévia"]')!.click();
  await wait(() => qa.requests.some((r) => r.url === "/api/discovery-events"), "manual preview log");
  assert(qa.plays === 1 && qa.requests.some((r) => r.url === "/api/discovery-events" && r.body.itemId === "album-item-2"), "Only explicit play starts the selected track preview");
  document.querySelector<HTMLButtonElement>('button[aria-label="Parar prévia"]')!.click();
  assert(qa.requests.every((r) => r.url.startsWith("/api/")), "Fixture must never access a real provider");
  assert(document.documentElement.scrollWidth <= innerWidth, "Edition and source controls must fit mobile");
  passed.push("lazy context, failure/retry, source/date/scope, escaped excerpt and version mismatch gap");
  return { passed, viewport: innerWidth, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, requests: qa.requests.length };
}
async function prepareAlbumEntryCapture() {
  root.render(<><DiscoveryNavigation pathname="/discovery/albums"/><AlbumJourneys onBegin={() => undefined} /></>);
  await wait(() => [...document.querySelectorAll("button")].some((node) => node.textContent === "ouvir este álbum →"), "capture library");
  button("ouvir este álbum →").click();
  await wait(() => [...document.querySelectorAll("button")].some((node) => node.textContent === "começar com esta versão →"), "capture editions");
  await new Promise((resolve) => setTimeout(resolve, 600));
}
Object.assign(window, { runDiscoveryChecks: runChecks, prepareAlbumEntryCapture });
