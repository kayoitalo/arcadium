import { createElement as h, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { DiscoveryEntry } from "./discovery-entry";
import { DiscoveryTrack } from "./discovery-track";
import { discoveryEntryLabel, DISCOVERY_ENTRIES } from "./discovery-view";
import styles from "./descobertas.module.css";
import amigo from "../amigo/amigo.module.css";
import shell from "../layout/app-shell.module.css";

const noop = () => undefined;
const entry = () => h(DiscoveryEntry, { busy: false, hasSession: true, currentRank: 3, total: 8, onChoose: noop, onResume: noop, onAdjust: noop });
const track = (canPlay = true, title = "Do outro lado") => h(DiscoveryTrack, {
  title, artist: "Maré Alta", reason: "Esta indicação parte de uma faixa que você curtiu. É uma referência fictícia para conferir o layout, sem consultar o teu histórico.",
  sectionRef: createRef<HTMLElement>(), markRef: createRef<HTMLSpanElement>(), marked: false,
  entryLabel: "Perto do que eu gosto", index: 2, total: 8, onChangeEntry: noop, onPlay: noop, canPlay, playing: false, loading: false,
  metadata: h("span", null, canPlay ? "prévia de 30s · Apple Music ↗" : "sem prévia"),
  artwork: h("div", { className: styles.cover, dangerouslySetInnerHTML: { __html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Capa fictícia para revisão visual"><rect width="400" height="400" fill="#d9d3c5"/><path d="M0 70 400 220V400H0Z" fill="#376467"/><circle cx="270" cy="125" r="60" fill="#b76143"/><path d="m50 335 105-182 95 182" stroke="#d9d3c5" stroke-width="2" fill="none"/><text x="26" y="38" font-family="Archivo, sans-serif" font-size="17" letter-spacing="3" fill="#232822">MARÉ ALTA</text><text x="26" y="375" font-family="Archivo, sans-serif" font-size="13" letter-spacing="3" fill="#ded9c9">DO OUTRO LADO</text></svg>' } }),
});

describe("discovery visual contracts", () => {
  it("offers supported discovery entries and a real continuation, with no forced map", () => {
    const html = renderToStaticMarkup(entry());
    expect(html).toContain("Perto do que eu gosto"); expect(html).toContain("Outras conexões");
    expect(html).toContain("indicação 3 de 8"); expect(html).toContain("continuar");
    expect(html).not.toContain("Mapa de descoberta");
    expect(DISCOVERY_ENTRIES.every((item) => item.proximity >= 0 && item.proximity <= 100)).toBe(true);
    expect(discoveryEntryLabel(85)).toBe("Perto do que eu gosto");
    expect(discoveryEntryLabel(35)).toBe("Outras conexões");
  });
  it("preserves long track/version labels, source context and disabled playback when unavailable", () => {
    const title = "Uma faixa com um título bastante longo (Ao vivo — edição alternativa)";
    const html = renderToStaticMarkup(track(false, title));
    expect(html.replace(/<[^>]*>/g, "")).toContain(title); expect(html).toContain("Maré Alta"); expect(html).toContain("Por que essa?");
    expect(html).toContain("Sem prévia por aqui"); expect(html).toContain('disabled=""');
    expect(html).not.toContain("autoplay");
  });
  it("can export isolated visual fixtures from the actual components and CSS", () => {
    if (process.env.ARCADIUM_VISUAL_REVIEW !== "true") return;
    const root = ".next/discovery-visual"; mkdirSync(root, { recursive: true });
    const cssModule = (path: string, names: Record<string, string>) => readFileSync(path, "utf8").replace(/\.([a-zA-Z_][a-zA-Z_0-9-]*)/g, (match, name) => names[name] ? "." + names[name] : match);
    const globals = readFileSync("src/app/globals.css", "utf8").replace('@import "tailwindcss";', "");
    const fonts = readdirSync(".next/static/chunks").filter((file) => file.endsWith(".css"))
      .flatMap((file) => [...readFileSync(".next/static/chunks/" + file, "utf8").matchAll(/@font-face\{[^}]+\}/g)].map((match) => match[0]))
      .join("\n").replaceAll("../media/", "/fonts/");
    const css = fonts + globals + cssModule("src/components/descobertas/descobertas.module.css", styles)
      + cssModule("src/components/amigo/amigo.module.css", amigo) + cssModule("src/components/layout/app-shell.module.css", shell)
      + '*{box-sizing:border-box}body{margin:0;font-family:Archivo,system-ui,sans-serif}button{font:inherit}svg{display:block;max-width:100%} .review-note{padding:10px 5vw;background:#171716;color:#aaa;font-size:11px}';
    const header = h("header", { className: shell.bar }, h("a", { className: shell.wordmark, href: "/entry.html" }, "arcadium"),
      h("nav", { className: shell.nav }, ...["Conversa", "Descoberta", "Retrato", "Histórico"].map((label) => h("a", { key: label, className: shell.link, "aria-current": label === "Descoberta" ? "page" : undefined, href: "/entry.html" }, label))));
    for (const [name, content] of [["entry", entry()], ["listening", track()], ["no-preview", track(false)],
      ["long-title", track(true, "Uma faixa com um título bastante longo (Ao vivo — edição alternativa)")]] as const) {
      const markup = renderToStaticMarkup(h("div", { className: shell.shell }, header,
        h("main", { className: shell.page }, h("div", { className: styles.pageTools }, h("span", null, "uma boa música pode abrir outro caminho."), h("span", null, "para depois · 3")), content)));
      writeFileSync(root + "/" + name + ".html", '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arcadium — revisão visual</title><style>' + css + '</style><div class="review-note">Revisão visual · dados fictícios · sem banco, APIs ou áudio real · <a href="/entry.html">entrada</a> / <a href="/listening.html">escuta</a> / <a href="/mobile.html">celular</a></div>' + markup + '</html>');
    }
    writeFileSync(root + "/mobile.html", '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Arcadium — revisão mobile</title><style>body{margin:0;background:#212120;color:#ddd;font:13px system-ui}nav{padding:16px;text-align:center}nav a{color:#ddd;margin:0 12px}iframe{display:block;width:390px;height:844px;max-width:100%;margin:auto;border:1px solid #444}</style><nav><a href="/mobile.html?view=entry">entrada</a><a href="/mobile.html?view=listening">escuta</a><a href="/mobile.html?view=long-title">título longo</a><a href="/entry.html">desktop</a></nav><iframe title="Tela de celular" id="phone" src="/entry.html"></iframe><script>const views=["entry","listening","long-title","no-preview"];const v=new URLSearchParams(location.search).get("view");document.getElementById("phone").src="/"+(views.includes(v)?v:"entry")+".html";</script></html>');
    process.stdout.write("Visual fixtures: " + root + "\n");
  });
});
