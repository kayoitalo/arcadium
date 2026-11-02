// Synthetic browser checks for memory, pagination and the conversation recall.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { SelectionProvider } from "../../src/components/descobertas/selection-provider";
import { DiscoveryMemory } from "../../src/components/descobertas/discovery-memory";
import { DiscoveryRecall } from "../../src/components/descobertas/discovery-recall";
import type { MemoryPage, MemorySession } from "../../src/modules/recommendations/domain/discovery-memory";

const qa = { requests: [] as string[], fail: false };
const makeSession = (id: string, trackName: string): MemorySession => ({ id, createdAt: "2026-11-02T12:00:00Z", currentRank: 1,
  total: 1, intent: "DISCOVER", anchor: null, items: [{ id: `item-${id}`, artistName: "Artista fictício", trackName, rank: 1,
    reason: "A partir de uma referência observada.", exposedAt: "2026-11-02T12:01:00Z", moreFeedback: true,
    feedback: [{ id: "withdrawn", type: "RETRACTED", channel: "preference", note: "Mudei de ideia <script>não executa</script>", details: null, createdAt: "2026-11-02T12:03:00Z", revisesId: "like" },
      { id: "like", type: "LIKED", channel: "preference", note: "Gostei do instrumental", details: { aspects: ["INSTRUMENTAL"] }, createdAt: "2026-11-02T12:02:00Z", revisesId: null }] }] });
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin); qa.requests.push(url.pathname + url.search);
  await new Promise((resolve) => setTimeout(resolve, 35));
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  if (url.pathname === "/api/discovery-data") {
    if (init?.method === "DELETE") throw new Error("Deletion must not occur without explicit confirmation");
    return response({ section: url.searchParams.get("cursor") ? "responses" : "sessions", records: [{ id: "synthetic-export-row" }], until: "2026-11-02T12:00:00Z", nextCursor: url.searchParams.get("cursor") ? null : "next-part" });
  }
  if (url.pathname === "/api/collection") return response({ items: [{ id: "one", artistName: "Artista fictício", trackName: "Faixa atual (Ao vivo)", action: "saved" }] });
  if (url.pathname !== "/api/discovery-memory") throw new Error(`Unexpected request: ${url}`);
  if (qa.fail) return response({}, 503);
  if (url.searchParams.get("summary") === "1") return response({ latest: { id: "newest", currentRank: 1, total: 1, current: { artistName: "Artista fictício", trackName: "Faixa atual (Ao vivo)" } } });
  const empty = url.searchParams.get("q") === "sem resultado";
  const older = url.searchParams.has("cursor");
  const page: MemoryPage = { sessions: empty ? [] : [makeSession(older ? "old" : "newest", older ? "Uma faixa anterior" : "Faixa atual (Ao vivo)")],
    nextCursor: empty || older ? null : "older", limits: { sessions: 5, itemsPerSession: 20, feedbackPerItem: 10 } };
  return response(page);
};
function Fixture() {
  const [recall, setRecall] = useState(false);
  return <SelectionProvider userId="synthetic-memory"><button id="fixture-view" onClick={() => setRecall((value) => !value)}>trocar fixture</button>{recall ? <DiscoveryRecall /> : <DiscoveryMemory />}</SelectionProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
async function wait(check: () => unknown, label: string) {
  const deadline = performance.now() + 6000;
  while (!check()) { if (performance.now() > deadline) throw new Error(`Timeout: ${label}`); await new Promise(requestAnimationFrame); }
}
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
function button(text: string) {
  const node = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === text);
  if (!node) throw new Error(`Missing button: ${text}`); return node;
}
function setQuery(value: string) {
  const input = document.querySelector<HTMLInputElement>('input:not([type="checkbox"])')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
async function runChecks() {
  const passed: string[] = [];
  await wait(() => document.querySelector('a[href="/discovery?session=newest"]'), "initial memory page");
  (document.querySelector("summary") as HTMLElement).click();
  await wait(() => document.body.textContent?.includes("Gostei do instrumental"), "audit disclosure");
  assert(document.body.textContent?.includes("retirou a avaliação"), "Retraction must be distinct from a current like");
  assert(document.body.textContent?.includes("Há respostas anteriores fora deste recorte"), "Audit truncation must be visible");
  assert(!document.querySelector("blockquote script") && document.querySelector("blockquote")?.textContent?.includes("<script>"), "User notes must remain text");
  assert(document.querySelector('a[href*="download=1"]'), "Filtered-page export must remain available");
  passed.push("owned timeline, version text, withdrawal audit, explicit limits and escaped notes");
  button("mais antigas →").click();
  await wait(() => document.querySelector('a[href="/discovery?session=old"]'), "older page");
  assert(button("mais antigas →").disabled, "The last page must stop pagination");
  button("← mais recentes").click();
  await wait(() => document.querySelector('a[href="/discovery?session=newest"]'), "newer page");
  passed.push("forward/backward cursor navigation without generating sessions");
  setQuery("sem resultado"); await new Promise(requestAnimationFrame); button("procurar").click();
  await wait(() => document.body.textContent?.includes("Nenhuma busca encontrada"), "empty search");
  assert(document.querySelector('a[href*="download=1"]')?.getAttribute("href")?.includes("q=sem+resultado"), "Download must use the displayed filters");
  setQuery(""); await new Promise(requestAnimationFrame); qa.fail = true; button("procurar").click();
  await wait(() => document.querySelector('[role="alert"]'), "failed memory request");
  qa.fail = false; button("tentar novamente").click();
  await wait(() => document.querySelector('a[href="/discovery?session=newest"]'), "memory retry");
  (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
  await wait(() => qa.requests.some((url) => url.includes("responses=1")) && !document.querySelector('[role="status"]'), "response-only filter");
  assert(document.documentElement.scrollWidth <= innerWidth, "Memory must not overflow horizontally");
  passed.push("explicit search, empty state, matching export filters, error/retry and mobile width");
  button("trocar fixture").click();
  await wait(() => document.querySelector('aside[aria-label="Continuar descobertas"]'), "conversation recall");
  assert(document.body.textContent?.includes("Faixa atual (Ao vivo)"), "Recall must preserve the exact version title");
  assert(document.querySelector('a[href="/discovery?session=newest"]'), "Resume must point at the stored session");
  assert(document.querySelector('a[href="/discovery?collection=1"]'), "Collection must have a direct entry");
  assert(qa.requests.every((url) => url.startsWith("/api/collection") || url.startsWith("/api/discovery-memory")), "Recall must not call music/AI providers or generate sessions");
  passed.push("conversation recall from observed session and collection only");
  button("trocar fixture").click(); await wait(() => document.querySelector("form") && document.querySelector('a[href="/discovery?session=newest"]'), "return to memory");
  (document.querySelector("summary") as HTMLElement).click(); await wait(() => document.querySelector("blockquote"), "expanded memory screenshot");
  button("exportar toda a memória").click();
  await wait(() => document.body.textContent?.includes("Memória exportada"), "complete paged export");
  assert(qa.requests.filter((url) => url.startsWith("/api/discovery-data")).length === 2, "Export must follow all page cursors");
  const tools = [...document.querySelectorAll("summary")].find((node) => node.textContent?.includes("Apagar dados"))!; tools.click();
  assert(button("apagar o escopo escolhido").disabled, "Deletion must require explicit typed confirmation");
  assert(document.documentElement.scrollWidth <= innerWidth, "Deletion controls must fit mobile");
  tools.click(); passed.push("full paged export and deletion confirmation guard without executing deletion");
  return { passed, viewport: innerWidth, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, requests: qa.requests.length };
}
Object.assign(window, { runDiscoveryChecks: runChecks });
