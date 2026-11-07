# Arcadium — how to build with it

Arcadium is a personal listening companion in Brazilian Portuguese: "a friend obsessed with music reading your history". Every screen is that friend talking (`Fala`), the proof he cites (`ProvaLista`, `ProvaTransicao`, `ProvaDecadas`), and your possible replies (`Respostas` + `Resposta`). His only visual presence is the yellow pen (`PenLayer` + `usePen`); there is no mascot or face.

## Surface and setup

- The page is always dark paper: `body { background: var(--papel); color: var(--tinta) }` comes from `styles.css`. Never put components on white; if you wrap a region, use `background: var(--papel)`.
- No provider is needed. Components read only CSS tokens.
- Font: one family, Archivo (variable width 62–125), via `var(--font-archivo)`. Headlines use `font-variation-settings: "wdth" 68–76, "wght" 680–800`; body text `"wdth" 100, "wght" 420`.
- `Capa` loads images through the app's `/api/cover` proxy, which does not exist here: covers always show the honest fallback (a dark square with the album title). Don't fake album art.

## Tokens (the whole palette)

| Token | Use |
|---|---|
| `--papel` | page background |
| `--tinta`, `--tinta-2`, `--tinta-3` | text: primary, secondary, quiet labels |
| `--fio`, `--fio-2` | hairline rules and borders |
| `--marca` | the pen's yellow — **only** for pen strokes, highlights and the pen's notes |
| `--sobre-marca` | text sitting on a yellow highlight |
| `--erro` | errors |

No other colours. Covers bring the rest. Don't use `--marca` for borders, tabs, arrows, buttons or decoration.

## The pen

One `PenLayer` per screen, inside a `position: relative` stage. `usePen(stageRef, draw, poseKey)` calls `draw(stageRect)` and you return gestures measured from real elements with `textLines(el, origin)` / `boxOf(el, origin)`:

- highlight: `band(lines, size)` → `{ id, layer: "under", strokes, width, cap: "butt" }`, and pass `marked={pen.started.has(id)}` to `Fala` so the text turns `--sobre-marca`
- ruler on a bar: a straight stroke over the bar with `width: box.height + 1`
- circle a number: `circle(box, id, 8)`; strike a dismissed headline: `strike(lines, size)`; jump between two covers: `dimension(fromBox, toBox, lift)` plus a `"PAM."` note

Text the pen highlights must sit above the "under" layer: `position: relative; z-index: 3` (`Fala` already does this).

## Voice

All copy is the friend, in informal PT-BR ("tu", "mano"), short and concrete. Never show system caveats, coverage limits or provider names in the UI; say one short line in his voice or nothing. One header per screen (a `Fala` with `level={1}`), no eyebrow in caps, no side boxes repeating it, no links duplicating navigation. Reply labels are what the listener would say: "toca aí", "e o que mais?", "nada a ver".

## Example

```jsx
const { Fala, Respostas, Resposta, ProvaLista, PenLayer, usePen, band, textLines } = window.Arcadium;
function Assunto({ evidence }) {
  const stage = React.useRef(null), mark = React.useRef(null), signal = React.useRef(null);
  const pen = usePen(stage, (o) => {
    if (!mark.current) return null;
    const { lines, size } = textLines(mark.current, o); const { strokes, width } = band(lines, size);
    return { gestures: [{ id: "grifo", layer: "under", strokes, width, cap: "butt" }], wave: null, notes: [] };
  }, "assunto");
  return <div ref={stage} style={{ position: "relative" }}>
    <Fala level={1} window="essa semana" headline="38 artistas novos e tu voltou pro mesmo disco."
      mark={["mesmo disco"]} markRef={mark} marked={pen.started.has("grifo")}
      narrative="Abriu a porta pra um monte de gente nova, mas o Clube da Esquina tocou mais que todos juntos." />
    <ProvaLista evidence={evidence} expanded={false} playing={false} lit={false} register={() => () => {}} />
    <Respostas inline><Resposta primary hint="→">e o que mais?</Resposta><Resposta hint="N">nada a ver</Resposta></Respostas>
    <PenLayer pen={pen} signal={signal} reduced={false} />
  </div>;
}
```

Read `guidelines/docs/interface-voz-do-amigo.md` and each `components/*/<Name>/<Name>.prompt.md` before composing a screen.
