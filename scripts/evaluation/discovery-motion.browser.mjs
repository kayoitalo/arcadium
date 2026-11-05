// Run: node scripts/evaluation/discovery-motion.browser.mjs
// Uses installed Vitest/Vite + a disposable headless Chrome profile. No app env/auth.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const portrait = process.argv.includes("--portrait");
const albums = process.argv.includes("--albums");
const memory = process.argv.includes("--memory") || portrait || albums;
if (process.argv.slice(2).some((argument) => !["--memory", "--portrait", "--albums"].includes(argument)) || process.argv.length > 3) throw new Error("Unknown browser-check option");
const feature = albums ? "albums" : portrait ? "portrait" : memory ? "memory" : "motion";
const output = path.join(root, `.local/evaluation/discovery-${feature}`);
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(path.join(output, "run-"));
const chromePath = process.env.CHROME_BIN ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(existsSync);
if (!chromePath) throw new Error("Chrome not found. Set CHROME_BIN to its executable.");
const require = createRequire(import.meta.url);
const { createServer } = await import(pathToFileURL(createRequire(require.resolve("vitest/package.json")).resolve("vite")).href);
const chunks = path.join(root, ".next/static/chunks");
const fontFaces = existsSync(chunks) ? readdirSync(chunks).filter((name) => name.endsWith(".css"))
  .flatMap((name) => [...readFileSync(path.join(chunks, name), "utf8").matchAll(/@font-face\{[^}]+\}/g)].map((match) => match[0])).join("\n")
  .replaceAll("../media/", encodeURI(`/@fs/${root.replaceAll("\\", "/")}.next/static/media/`)) : "";
const fontFamily = fontFaces.match(/font-family:([^;]+)/)?.[1] ?? "Arial";
writeFileSync(path.join(scratch, "globals.css"), fontFaces + readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace('@import "tailwindcss";', "")
  + `\n:root{--font-archivo:${fontFamily}}body{margin:0;font-family:${fontFamily},sans-serif}main{width:calc(100% - 2 * clamp(20px,5vw,88px));margin:auto}*{box-sizing:border-box}`);
writeFileSync(path.join(scratch, "link.tsx"), 'export default function Link({children,prefetch,replace,scroll,...props}){return <a {...props}>{children}</a>}');
writeFileSync(path.join(scratch, "navigation.ts"), 'export function usePathname(){return window.location.pathname}');
writeFileSync(path.join(scratch, "index.html"), '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arcadium — synthetic motion checks</title><link rel="stylesheet" href="/globals.css"><main id="root"></main><script type="module" src="/@fs/'
  + path.join(root, `scripts/evaluation/discovery-${feature}.fixture.tsx`).replaceAll("\\", "/") + '"></script></html>');
const server = await createServer({ configFile: false, root: scratch, envDir: scratch,
  plugins: portrait ? [{name:"synthetic-portrait-image",configureServer(server){server.middlewares.use((req,res,next)=>{
    if(!req.url?.startsWith("/api/cover?"))return next();
    res.setHeader("Content-Type","image/svg+xml");res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="600" height="750" fill="#282922"/><path d="M0 580 600 170V750H0Z" fill="#545b50"/><text x="40" y="75" fill="#e3e4d8" font-family="sans-serif" font-size="22">IMAGEM SINTÉTICA DE TESTE</text><text x="40" y="710" fill="#e3e4d8" font-family="sans-serif" font-size="18">não representa um artista real</text></svg>');
  });}}] : [],
  cacheDir: path.join(scratch, "vite-cache"), publicDir: path.join(root, "public"), css: { postcss: { plugins: [] } },
  resolve: { alias: { "@": path.join(root, "src"), "next/link": path.join(scratch, "link.tsx"), "next/navigation": path.join(scratch, "navigation.ts") } },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] }, watch: null },
});
let chrome;
let socket;
const pending = new Map();
let serial = 0;
const errors = [];
try {
  await server.listen();
  const port = server.httpServer.address().port;
  chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-background-networking",
    "--disable-extensions", "--remote-debugging-port=0", `--user-data-dir=${path.join(scratch, "chrome-profile")}`, "about:blank"],
  { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Chrome startup timed out")), 15000);
    chrome.once("error", (error) => { clearTimeout(timer); reject(error); });
    chrome.stderr.on("data", (chunk) => {
      const match = String(chunk).match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.error) request?.reject(new Error(JSON.stringify(message.error))); else request?.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
  };
  const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const reports = [];
  await command("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: output });
  for (const [name, width, reduced] of [["desktop", 1280, false], ["mobile", 390, false], ["mobile-reduced", 390, true], ["wide", 1920, false]]) {
    const { targetId } = await command("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
    const cdp = (method, params) => command(method, params, sessionId);
    await cdp("Runtime.enable"); await cdp("Page.enable");
    await cdp("Page.bringToFront");
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
    await cdp("Page.navigate", { url: `http://127.0.0.1:${port}/` });
    const result = await cdp("Runtime.evaluate", { expression: `(async () => {
      const limit = Date.now() + 20000;
      while (!window.runDiscoveryChecks) { if (Date.now() > limit) throw new Error('Fixture startup timeout'); await new Promise(r=>setTimeout(r,50)); }
      return window.runDiscoveryChecks();
    })()`, awaitPromise: true, returnByValue: true, timeout: 35000 });
    if (result.exceptionDetails) {
      const diagnostic = await cdp("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true });
      writeFileSync(path.join(output, `${name}-failure.html`), diagnostic.result.value);
      throw new Error(`${name}: ${JSON.stringify(result.exceptionDetails)}; browser errors: ${JSON.stringify(errors)}`);
    }
    reports.push({ name, ...result.result.value });
    if (!memory) {
    // Real browser keyboard activation of native summary, in addition to clicks.
    await cdp("Runtime.evaluate", { expression: `window.scrollTo(0, document.body.scrollHeight); document.querySelector('#mapa-descoberta > summary').focus();` });
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    const keyboard = await cdp("Runtime.evaluate", { expression: `(async()=>{await new Promise(r=>setTimeout(r,260));return document.querySelector('#mapa-descoberta > summary').getAttribute('aria-expanded')})()`, awaitPromise: true, returnByValue: true });
    if (keyboard.result.value !== "true") {
      const state = await cdp("Runtime.evaluate", { expression: "({active:document.activeElement.outerHTML,map:document.querySelector('#mapa-descoberta').outerHTML})", returnByValue: true });
      throw new Error(`${name}: Enter did not open the map: ${JSON.stringify(state.result.value)}`);
    }
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    const closed = await cdp("Runtime.evaluate", { expression: `(async()=>{await new Promise(r=>setTimeout(r,260));return document.querySelector('#mapa-descoberta').open})()`, awaitPromise: true, returnByValue: true });
    if (closed.result.value !== false) throw new Error(`${name}: Space did not close the map`);
    await cdp("Runtime.evaluate", { expression: "document.querySelector('#mapa-descoberta > summary').click(); document.querySelector('#mapa-descoberta').scrollIntoView({block:'start'});" });
    await cdp("Runtime.evaluate", { expression: "new Promise(r=>setTimeout(r,260))", awaitPromise: true });
    }
    await cdp("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
    await cdp("Runtime.evaluate", { expression: "new Promise(resolve=>setTimeout(resolve,900))", awaitPromise: true });
    const layout = await cdp("Page.getLayoutMetrics");
    const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.min(layout.cssContentSize.height, 6000), scale: 1 } });
    writeFileSync(path.join(output, `${name}.png`), Buffer.from(screenshot.data, "base64"));
    if (!memory) {
      const prepared = await cdp("Runtime.evaluate", { expression: "window.prepareCollectionCapture()", awaitPromise: true });
      if (prepared.exceptionDetails) throw new Error(JSON.stringify(prepared.exceptionDetails));
      const collectionLayout = await cdp("Page.getLayoutMetrics");
      const collectionScreenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height: Math.min(collectionLayout.cssContentSize.height, 6000), scale: 1 } });
      writeFileSync(path.join(output, `${name}-collection.png`), Buffer.from(collectionScreenshot.data, "base64"));
    }
    if (albums) {
      const entry = await cdp("Runtime.evaluate", { expression: "window.prepareAlbumEntryCapture()", awaitPromise: true });
      if (entry.exceptionDetails) throw new Error(JSON.stringify(entry.exceptionDetails));
      const entryLayout = await cdp("Page.getLayoutMetrics");
      const entryScreenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height: Math.min(entryLayout.cssContentSize.height, 6000), scale: 1 } });
      writeFileSync(path.join(output, `${name}-editions.png`), Buffer.from(entryScreenshot.data, "base64"));
    }
    if (portrait) {
      const missing = await cdp("Runtime.evaluate", { expression: "window.prepareMissingPortraitCapture()", awaitPromise: true });
      if (missing.exceptionDetails) throw new Error(JSON.stringify(missing.exceptionDetails));
      const missingLayout = await cdp("Page.getLayoutMetrics");
      const missingScreenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x:0, y:0, width, height:Math.min(missingLayout.cssContentSize.height,6000), scale:1 } });
      writeFileSync(path.join(output, name+"-no-photo.png"), Buffer.from(missingScreenshot.data,"base64"));
      const prepared = await cdp("Runtime.evaluate", { expression: "window.prepareConversationCapture()", awaitPromise: true });
      if (prepared.exceptionDetails) throw new Error(JSON.stringify(prepared.exceptionDetails));
      const conversationScreenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(path.join(output, `${name}-conversation.png`), Buffer.from(conversationScreenshot.data, "base64"));
    }
    await command("Target.closeTarget", { targetId });
    process.stdout.write(`${name}: ${result.result.value.passed.length} interaction groups${memory ? "" : " + native summary keyboard"} passed\n`);
  }
  if (errors.length) throw new Error(`Browser exceptions: ${JSON.stringify(errors)}`);
  writeFileSync(path.join(output, "report.json"), JSON.stringify({ synthetic: true, realAudio: false, reports }, null, 2) + "\n");
  process.stdout.write(`Synthetic browser checks passed; artifacts: ${output}\n`);
} finally {
  socket?.close(); chrome?.kill(); await server.close();
}
