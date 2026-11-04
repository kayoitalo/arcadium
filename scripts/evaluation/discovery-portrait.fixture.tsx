import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Portrait } from "../../src/components/conversa/portrait";
import { Conversa } from "../../src/components/conversa/conversa";
import type { ConversationMoment } from "../../src/modules/conversation/domain/conversation.types";
const key = "a".repeat(64); const qa = { requests: [] as { url: string; body: Record<string, unknown> }[], failDismiss: false, restored: false, failPhoto: true };
window.fetch = async (input, init) => {
  const url = String(input); const body = JSON.parse(String(init?.body ?? "{}")); qa.requests.push({ url, body });
  await new Promise(requestAnimationFrame);
  const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
  if (url === "/api/portrait") return response({ asOf: "2026-11-02T12:00:00Z", timezone: "America/Sao_Paulo", total: 40, artists: [{ name: "Artista de teste", plays: 20, days: 3 }, { name: "Outro nome fictício", plays: 13, days: 8 }, { name: "Uma colaboração fictícia com um nome comprido", plays: 7, days: 4 }], changes: [{ name: "Artista de teste", current: 5, previous: 15 }, { name: "Outro nome fictício", current: 3, previous: 0 }] });
  if(url==="/api/artist-portrait"){
    if(body.artistName==="Outro nome fictício"){if(qa.failPhoto){qa.failPhoto=false;return response({},503);}return response({status:"MISSING",reason:"NO_IMAGE"});}
    return response({status:"READY",provider:"spotify",artistId:"1a2b3c4d5e6f7g8h9i0jKl",artistName:String(body.artistName),imageUrl:"https://i.scdn.co/image/Synthetic",sourceUrl:"https://open.spotify.com/artist/1a2b3c4d5e6f7g8h9i0jKl",checkedAt:"2026-11-03T12:00:00.000Z"});
  }
  if (url === "/api/editorial") {
    if (!init?.method) return response({ topics: qa.restored ? [] : [{ key, headline: "Um assunto silenciado" }] });
    if (body.action === "DISMISS" && qa.failDismiss) return response({}, 503);
    if (body.action === "RESTORE") qa.restored = true;
    return response({ success: true });
  }
  throw new Error(`Unexpected synthetic request ${url}`);
};
const moment: ConversationMoment = { key: "synthetic", editorialKey: key, editorialVersion: 0, period: "7d", window: "nesta semana", headline: "Artista de teste voltou ao fone.", narrative: "Uma observação fictícia com prova.", insight: "Sem inferir estado emocional.", closing: null,
  evidence: { kind: "ranking", unit: "artist", rows: [{ label: "Artista de teste", sub: "", plays: 20 }], focusIndex: 0, share: 50, citesShare: false, cover: { url: null, title: "Disco fictício", artist: "Artista de teste" }, previewUrl: null, previewTrack: null } };
function Fixture() { const [conversation, setConversation] = useState(false); return <><button id="fixture" onClick={() => setConversation((value) => !value)}>trocar fixture</button>{conversation ? <Conversa moments={[moment]} /> : <Portrait />}</>; }
createRoot(document.getElementById("root")!).render(<Fixture />);
async function wait(check: () => unknown, label: string) { const deadline = performance.now() + 6000; while (!check()) { if (performance.now() > deadline) throw new Error(`Timeout ${label}`); await new Promise(requestAnimationFrame); } }
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
function button(label: string) { const node = [...document.querySelectorAll("button")].find((node) => node.textContent?.replace(/\s/g, "") === label.replace(/\s/g, "")); if (!node) throw new Error(`Missing button ${label}`); return node; }
async function runChecks() {
  const passed: string[] = [];
  await wait(() => document.body.textContent?.includes("20 reproduções em 3 dias distintos"), "observed portrait");
  await wait(()=>document.querySelector('[data-portrait-poster] [data-loaded="true"]'),"loaded credited portrait");
  await wait(()=>document.querySelector('[data-portrait-poster][data-pen-ready="true"]'),"name, image and observed metric pen gestures");
  assert(!document.querySelector("svg[data-pose]"),"The narrator must have no literal face");
  assert(document.querySelector('[data-portrait-poster] h2 [data-marked="true"]'),"Selected artist must be marked by the real pen");
  assert(document.querySelector('a[href="https://open.spotify.com/artist/1a2b3c4d5e6f7g8h9i0jKl"] img[alt="Spotify"]'),"Image attribution must stay visible");
  const callsBeforeSelection=qa.requests.filter(row=>row.url==="/api/portrait").length;
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((node)=>node.textContent?.includes("Outro nome fictício"))!.click();
  await wait(()=>document.body.textContent?.includes("13 reproduções em 8 dias distintos"),"selected artist");
  assert(qa.requests.filter(row=>row.url==="/api/portrait").length===callsBeforeSelection,"Selecting an artist must reuse the fetched portrait");
  await wait(()=>document.body.textContent?.includes("A foto não veio agora"),"temporary photo failure");
  button("tentar a foto novamente").click();
  await wait(()=>document.body.textContent?.includes("Ainda sem foto identificada"),"missing photo typography");
  assert(document.querySelector('[data-portrait-poster] h2')?.textContent==="Outro nome fictício","A missing image must retain artist identity");
  await wait(()=>document.querySelector('[data-portrait-poster][data-pen-ready="true"] h2 [data-marked="true"]'),"pen reacting to a different artist even without a photograph");
  button("02 a fase recente dois recortes de 30 dias").click();
  await wait(()=>document.body.textContent?.includes("5 agora · 15 no período anterior"),"recent perspective");
  assert(document.body.textContent?.includes("5 agora · 15 no período anterior"), "Recent and previous windows must remain separate");
  assert(document.querySelector('a[href="/history?search=Artista%20de%20teste"]'), "Portrait must link to the filtered history");
  button("01 ao longo do caminho os retornos no histórico").click();
  [...document.querySelectorAll("summary")].find((node)=>node.textContent?.includes("Assuntos que você silenciou"))!.click();
  await wait(()=>[...document.querySelectorAll("button")].some((node)=>node.textContent==="voltar a esse assunto"),"topic drawer");
  button("voltar a esse assunto").click(); await wait(() => document.body.textContent?.includes("Nenhum assunto silenciado"), "restore editorial topic");
  passed.push("portrait from observed days/counts, recent windows and restore account topic");
  button("trocar fixture").click(); window.scrollTo({ top: 0, behavior: "instant" });
  await wait(() => qa.requests.some((row) => row.body.action === "SEEN"), "visible conversation receipt");
  assert(qa.requests.find((row) => row.body.action === "SEEN")?.body.version === 0, "Receipt must use the presented editorial version");
  qa.failDismiss = true; button("nada a ver N").click();
  await wait(() => document.querySelector('[role="alert"]'), "dismiss failure");
  assert(!document.querySelector('[data-dismissed="true"]'), "Failure must not pretend topic is silenced");
  qa.failDismiss = false; button("nada a ver N").click(); await wait(() => document.querySelector('[data-dismissed="true"]'), "dismiss success");
  button("volta atrás N").click(); await wait(() => !document.querySelector('[data-dismissed="true"]'), "undo silence");
  assert(qa.requests.every((row) => ["/api/portrait", "/api/editorial", "/api/artist-portrait"].includes(row.url)), "Portrait/editorial must not generate AI or musical-provider requests");
  passed.push("visibility/version, persisted dismiss, failure and undo without preference feedback");
  button("trocar fixture").click(); await wait(() => document.body.textContent?.includes("20 reproduções em 3 dias distintos"), "portrait return");
  await wait(()=>document.querySelector('[data-portrait-poster][data-pen-ready="true"]'),"settled poster after return");
  assert(document.documentElement.scrollWidth <= innerWidth, "Portrait must fit the viewport");
  passed.push("identity-bound photo, credit, missing/temporary states and real pen reacting without a literal avatar");
  return { passed, viewport: innerWidth, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, requests: qa.requests.length };
}
async function prepareConversationCapture(){ button("trocar fixture").click(); await wait(()=>document.querySelector("#assunto-0"),"conversation capture"); window.scrollTo({top:0,behavior:"instant"}); await new Promise(r=>setTimeout(r,1000)); }
Object.assign(window, { runDiscoveryChecks: runChecks, prepareConversationCapture });
