// Browser-only synthetic fixture. No credentials, database, provider or real audio.
import { createRoot } from "react-dom/client";
import { Descobertas } from "../../src/components/descobertas/descobertas";
import { SelectionProvider } from "../../src/components/descobertas/selection-provider";

const requests: { url: string; body: Record<string, unknown>; title: string; ready: boolean }[] = [];
const qa = { requests, failFeedback: false, failHistory: false, plays: 0, pauses: 0 };
const tracks = [1, 2, 3].map((n) => ({ id: `item-${n}`, artistName: "Artista fictício", trackName: `Faixa ${n} (Ao vivo)`,
  albumName: null, genre: null, reason: "Uma referência fictícia para testar a interface.", position: null, rank: n }));
let rank = 1;
const payload = () => ({ sessionId: "synthetic", currentRank: rank, items: tracks, settings: { intent: "DISCOVER" } });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
window.fetch = async (input, init) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}"));
  requests.push({ url, body, title: document.querySelector("h1")?.textContent ?? "",
    ready: Boolean(document.querySelector('[data-discovery-scene="ready"]')) });
  // Force a frame between request and response, as on a real connection.
  await new Promise(requestAnimationFrame);
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (url.endsWith("?history=1")) return qa.failHistory ? response({}, 503) : response({ sessions: [{ sessionId: "synthetic",
    createdAt: "2026-11-01T12:00:00Z", currentRank: rank, total: tracks.length, intent: "DISCOVER", journey: null,
    firstTrack: { artistName: "Artista fictício", trackName: tracks[0].trackName } }] });
  if (url.endsWith("/media")) return response({ status: "ready", coverUrl: null, previewUrl: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", appleMusicUrl: null });
  if (url.endsWith("/feedback")) {
    if (qa.failFeedback) { qa.failFeedback = false; return response({ error: "Falha simulada; a faixa continua aqui." }, 503); }
    if (body.type !== "RETRACTED") rank += 1;
    return response({ currentRank: rank, states: {} });
  }
  if (body.operation === "MOVE") { rank = body.rank; return response({ currentRank: rank }); }
  if (body.operation === "EXPOSE") return response({ ok: true });
  if (url === "/api/recommendations") return response(payload());
  throw new Error(`Unexpected fixture request: ${url}`);
};
Object.defineProperty(window, "Audio", { value: class {
  play() { qa.plays += 1; return Promise.resolve(); }
  pause() { qa.pauses += 1; }
} });
Object.defineProperty(window, "AudioContext", { value: class {
  state = "running"; destination = {};
  createAnalyser() { return { connect() {}, getByteTimeDomainData(buffer: Uint8Array) { buffer.fill(128); } }; }
  createMediaElementSource() { return { connect() {} }; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
} });

createRoot(document.getElementById("root")!).render(<SelectionProvider userId="synthetic-motion"><Descobertas /></SelectionProvider>);

const frame = () => new Promise(requestAnimationFrame);
async function wait(check: () => unknown, label: string) {
  const deadline = performance.now() + 6000;
  while (!check()) { if (performance.now() > deadline) throw new Error(`Timeout: ${label}`); await frame(); }
}
function assert(condition: unknown, label: string) { if (!condition) throw new Error(label); }
function button(label: string, root: ParentNode = document) {
  const result = [...root.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.replace(/\s/g, "") === label.replace(/\s/g, ""));
  if (!result) throw new Error(`Button missing: ${label}`);
  return result;
}
function disclosure(label: string) {
  const summary = [...document.querySelectorAll("summary")].find((node) => node.textContent?.includes(label));
  if (!summary) throw new Error(`Summary missing: ${label}`);
  return { summary, details: summary.parentElement as HTMLDetailsElement };
}
function ready(n: number) { return document.querySelector('[data-discovery-scene="ready"] h1')?.textContent?.includes(`Faixa ${n}`); }
const feedbackCount = () => requests.filter((r) => r.url.endsWith("/feedback")).length;
const expose = (n: number) => requests.some((r) => r.body.operation === "EXPOSE" && r.body.itemId === `item-${n}`);
const hotkey = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

async function runChecks() {
  const passed: string[] = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  await wait(() => [...document.querySelectorAll("button")].some((node) => node.textContent?.includes("continuar") && !node.disabled), "bootstrap");
  assert(qa.plays === 0 && !requests.some((r) => r.body.operation === "EXPOSE" || r.url.endsWith("/media")), "Entry must not expose, load media or autoplay");
  button("continuar →").click();
  await wait(() => ready(1) && expose(1), "first mounted/visible item");
  assert(document.activeElement === document.querySelector("h1"), "Focus must reach the incoming title");
  await wait(() => Boolean(document.querySelector('button[aria-label="Ouvir prévia"]:not(:disabled)')), "synthetic media");
  (document.querySelector('button[aria-label="Ouvir prévia"]') as HTMLButtonElement).click();
  await wait(() => qa.plays === 1 && document.querySelector('button[aria-label="Parar prévia"]'), "explicit preview");
  qa.failFeedback = true; button("pula →").click();
  await wait(() => document.querySelector('[role="alert"]')?.textContent?.includes("Falha simulada"), "feedback failure");
  assert(ready(1) && !expose(2) && qa.pauses > 0, "Failure must keep the same track and stop sound");
  passed.push("entry, explicit playback and failed feedback preserve the current track");

  const before = feedbackCount();
  button("pula →").click(); button("pula →").click(); hotkey();
  if (!reduced) {
    await wait(() => document.querySelector('[data-discovery-scene="changing"]'), "outgoing scene");
    assert(!expose(2) && !requests.some((r) => r.url.endsWith("/media") && r.body.itemId === "item-2"), "Outgoing DOM must not count as the next track");
    assert(!document.querySelector('svg[data-layer="under"]'), "Old pen must not mark an incoming track");
    hotkey(); button("pula →").click();
  }
  await wait(() => ready(2) && expose(2), "second incoming scene");
  assert(feedbackCount() === before + 1 && qa.plays === 1, "Rapid actions must not skip another track or autoplay");
  assert(document.activeElement === document.querySelector("h1"), "Focus must move after the new title mounts");
  assert(requests.filter((r) => r.body.operation === "EXPOSE").every((r) => r.ready && r.title.includes(r.body.itemId === "item-1" ? "Faixa 1" : "Faixa 2")), "Exposure must refer to the mounted visible track");
  passed.push("rapid votes, exit/entry, focus, pen and exposure stay synchronized");

  const review = disclosure("outras respostas"); review.summary.click();
  await wait(() => Boolean(review.details.querySelector("textarea")), "review body");
  const textarea = review.details.querySelector("textarea")!; textarea.focus(); review.summary.click();
  await frame();
  assert(document.activeElement === review.summary && review.details.querySelector('[inert]'), "Closing must hide controls and restore summary focus immediately");
  // Reopening during the exit must not be closed by a stale completion callback.
  review.summary.click(); await wait(() => review.summary.getAttribute("aria-expanded") === "true", "rapid reopen");
  await new Promise((resolve) => setTimeout(resolve, 240));
  assert(review.details.open && review.details.querySelector("textarea"), "Rapid reopen must retain content");
  review.summary.click(); await wait(() => !review.details.open && !review.details.querySelector("textarea"), "review closed");
  passed.push("disclosure closing, focus recovery and interrupted reopening");

  const history = disclosure("Caminhos anteriores"); history.summary.click();
  await wait(() => history.details.querySelector('[aria-current="step"]'), "history");
  assert(history.details.textContent?.includes("posição 2") && history.details.textContent.includes("você está aqui"), "History must show the live cursor");
  history.summary.click(); await wait(() => !history.details.open, "close history");
  qa.failHistory = true; history.summary.click();
  await wait(() => history.details.querySelector('[role="alert"]'), "history error");
  assert(history.details.querySelector('[aria-current="step"]'), "Refresh errors must retain the previous list");
  qa.failHistory = false; button("tentar novamente", history.details).click();
  await wait(() => !history.details.querySelector('[role="alert"]'), "history retry");
  await wait(() => !button("continuar →", history.details).disabled, "history retry completion");
  button("continuar →", history.details).click();
  await wait(() => ready(2) && document.activeElement === document.querySelector("h1"), "resume the same item in a fresh scene");
  await wait(() => document.querySelector("h1")!.getBoundingClientRect().top >= 0, "resume scroll into view");
  passed.push("history cursor, retained list on error, retry and same-item resume");

  button("← anterior").click(); await wait(() => ready(1), "backward transition");
  button("trocar caminho ↗").click(); await wait(() => !document.querySelector('[data-discovery-scene]'), "entry return");
  button("continuar →").click(); await wait(() => ready(1), "same item after entry");
  await wait(() => document.querySelector('svg[data-layer="under"] path[data-kind="ink"]'), "pen after remount");
  assert(qa.plays === 1, "Navigating must not restart audio");
  assert(document.documentElement.scrollWidth <= innerWidth, "Mobile/desktop must not overflow horizontally");
  if (reduced) assert(getComputedStyle(document.querySelector('[data-discovery-scene]')!).transform === "none", "Reduced motion must not translate the scene");
  passed.push("backward/entry return, pen redraw, reduced motion and viewport width");
  // Playing and stopping must update the wave without unmounting the pen.
  const pen = document.querySelector('svg[data-layer="under"]');
  (document.querySelector('button[aria-label="Ouvir prévia"]') as HTMLButtonElement).click();
  await wait(() => qa.plays === 2 && document.querySelector('button[aria-label="Parar prévia"]'), "second explicit preview");
  assert(document.querySelector('svg[data-layer="under"]') === pen, "Playback must preserve the mounted pen");
  (document.querySelector('button[aria-label="Parar prévia"]') as HTMLButtonElement).click(); await frame();
  assert(document.querySelector('svg[data-layer="under"]') === pen, "Stopping must preserve the mounted pen");
  passed.push("play/pause preserve the pen lifecycle");
  return { passed, reduced, viewport: innerWidth, requests: requests.length };
}

Object.assign(window, { arcadiumQA: qa, runDiscoveryChecks: runChecks });
