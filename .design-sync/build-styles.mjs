// Gera o stylesheet de tokens do Claude Design a partir de src/app/globals.css,
// a fonte da verdade dos tokens. Tira só o que é do Tailwind (@import e
// @theme) e define --font-archivo, que no app vem de next/font; os arquivos da
// fonte ficam em .design-sync/fonts (extraFonts).
// Rodado como buildCmd antes do conversor; a saída fica em .design-sync/.cache.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const globals = readFileSync("src/app/globals.css", "utf8").replace(/\r\n/g, "\n");
const withoutTailwind = globals
  .replace(/@import\s+"tailwindcss";\n?/, "")
  .replace(/@theme\s*\{[\s\S]*?\n\}\n?/, "");
if (withoutTailwind.includes("tailwindcss") || withoutTailwind.includes("@theme")) {
  throw new Error("globals.css mudou de formato: revise build-styles.mjs");
}

const fontVar = '\n/* No app a família vem de next/font como --font-archivo. */\n:root { --font-archivo: "Archivo"; }\n';
mkdirSync(".design-sync/.cache", { recursive: true });
writeFileSync(".design-sync/.cache/arcadium.css", withoutTailwind + fontVar);
console.log("wrote .design-sync/.cache/arcadium.css");
