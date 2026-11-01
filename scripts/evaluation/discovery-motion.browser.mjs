// Run: node scripts/evaluation/discovery-motion.browser.mjs
// Uses installed Vitest/Vite + a disposable headless Chrome profile. No app env/auth.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.join(root, ".local/evaluation/discovery-motion");
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
writeFileSync(path.join(scratch, "globals.css"), readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace('@import "tailwindcss";', "")
  + '\nbody{margin:0;font-family:Arial,sans-serif}main{width:min(1180px,calc(100% - 40px));margin:auto}*{box-sizing:border-box}');
writeFileSync(path.join(scratch, "link.tsx"), 'export default function Link({children,prefetch,replace,scroll,...props}){return <a {...props}>{children}</a>}');
writeFileSync(path.join(scratch, "index.html"), '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arcadium — synthetic motion checks</title><link rel="stylesheet" href="/globals.css"><main id="root"></main><script type="module" src="/@fs/'
  + path.join(root, "scripts/evaluation/discovery-motion.fixture.tsx").replaceAll("\\", "/") + '"></script></html>');
const server = await createServer({ configFile: false, root: scratch, envDir: scratch,
  cacheDir: path.join(scratch, "vite-cache"), publicDir: false, css: { postcss: { plugins: [] } },
  resolve: { alias: { "@": path.join(root, "src"), "next/link": path.join(scratch, "link.tsx") } },
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
  for (const [name, width, reduced] of [["desktop", 1280, false], ["mobile", 390, false], ["mobile-reduced", 390, true]]) {
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
    const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(path.join(output, `${name}.png`), Buffer.from(screenshot.data, "base64"));
    await command("Target.closeTarget", { targetId });
    process.stdout.write(`${name}: ${result.result.value.passed.length} interaction groups + native summary keyboard passed\n`);
  }
  if (errors.length) throw new Error(`Browser exceptions: ${JSON.stringify(errors)}`);
  writeFileSync(path.join(output, "report.json"), JSON.stringify({ synthetic: true, realAudio: false, reports }, null, 2) + "\n");
  process.stdout.write(`Synthetic browser checks passed; artifacts: ${output}\n`);
} finally {
  socket?.close(); chrome?.kill(); await server.close();
}
