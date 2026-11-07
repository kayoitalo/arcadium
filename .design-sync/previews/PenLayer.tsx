import { useRef } from "react";
import { PenLayer, usePen, band, circle, strike, textLines, boxOf } from "arcadium";
import { Papel } from "./_papel";

// A caneta é o personagem: uma camada por tela, que mede alvos reais e desenha por cima.
// O amarelo é só dela. Cada gesto tem um id; `pen.started` diz quando ele começou.
function Gesto({ kind }: { kind: "grifo" | "circulo" | "risco" }) {
  const stage = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLSpanElement>(null);
  const signal = useRef<ArrayLike<number> | null>(null);
  const pen = usePen(stage, (origin) => {
    if (!target.current) return null;
    if (kind === "circulo") {
      const box = boxOf(target.current, origin);
      return { gestures: [{ id: kind, layer: "over", strokes: [circle(box, kind, 8)], width: 1.8, cap: "round" }], wave: null, notes: [] };
    }
    const { lines, size } = textLines(target.current, origin);
    if (kind === "risco") return { gestures: [{ id: kind, layer: "over", strokes: strike(lines, size), width: Math.max(2, size * 0.055), cap: "butt" }], wave: null, notes: [] };
    const { strokes, width } = band(lines, size);
    return { gestures: [{ id: kind, layer: "under", strokes, width, cap: "butt" }], wave: null, notes: [] };
  }, kind);
  const marked = kind === "grifo" && pen.started.has(kind);
  // O texto mora entre as duas camadas da caneta: acima do grifo (z 2), abaixo do traço por cima (z 4) — como a .fala (z 3).
  const layer = { position: "relative" as const, zIndex: 3, margin: 0 };
  return <div ref={stage} style={{ position: "relative", isolation: "isolate", padding: "12px 4px" }}>
    {kind === "circulo"
      ? <p style={{ ...layer, fontSize: 15, color: "var(--tinta-2)", display: "flex", alignItems: "baseline", gap: 22 }}><span ref={target} style={{ fontSize: 64, color: "var(--tinta)", fontVariationSettings: '"wdth" 70, "wght" 760' }}>130</span> dias distintos</p>
      : <p style={{ ...layer, fontSize: 40, lineHeight: 1.05, fontVariationSettings: '"wdth" 70, "wght" 800', color: kind === "risco" ? "var(--tinta-3)" : "var(--tinta)" }}>
        {kind === "risco" ? <span ref={target}>Tu ouviu chorinho às três da manhã?</span>
          : <>O que permanece no <span ref={target} style={{ color: marked ? "var(--sobre-marca)" : undefined }}>teu fone</span>.</>}
      </p>}
    <PenLayer pen={pen} signal={signal} reduced />
  </div>;
}

export const Grifo = () => <Papel><Gesto kind="grifo" /></Papel>;
export const Circulo = () => <Papel><Gesto kind="circulo" /></Papel>;
export const Risco = () => <Papel><Gesto kind="risco" /></Papel>;
