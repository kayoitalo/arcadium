import { useCallback, useRef } from "react";
import { ProvaLista, PenLayer, usePen, boxOf } from "arcadium";
import { Papel } from "./_papel";

// O ranking que a frase cita: a linha citada ganha a régua da caneta, as outras ficam em repouso.
const artistas = {
  kind: "ranking" as const, unit: "artist" as const, focusIndex: 0, share: 9.2, citesShare: false,
  cover: { url: null, title: "Clube da Esquina", artist: "Milton Nascimento" }, previewUrl: null, previewTrack: null,
  rows: [
    { label: "Milton Nascimento", sub: "", plays: 48 }, { label: "Sepultura", sub: "", plays: 31 },
    { label: "Cartola", sub: "", plays: 27 }, { label: "Lucho Gatica", sub: "", plays: 19 },
    { label: "Gal Costa", sub: "", plays: 14 }, { label: "Alice Coltrane", sub: "", plays: 11 },
    { label: "Tim Maia", sub: "", plays: 9 }, { label: "Os Mutantes", sub: "", plays: 7 },
  ],
};
const faixas = {
  ...artistas, unit: "track" as const, focusIndex: 1, share: 4.1, citesShare: true,
  cover: { url: null, title: "Cartola", artist: "Cartola" },
  rows: [
    { label: "Cais", sub: "Milton Nascimento", plays: 22 }, { label: "O Mundo É um Moinho", sub: "Cartola", plays: 18 },
    { label: "Refuse/Resist", sub: "Sepultura", plays: 15 }, { label: "Sabor a mí", sub: "Lucho Gatica", plays: 12 },
    { label: "Vapor Barato", sub: "Gal Costa", plays: 9 },
  ],
};

function ComRegua({ evidence, expanded = false }: { evidence: typeof artistas; expanded?: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement | null>(null);
  const signal = useRef<ArrayLike<number> | null>(null);
  const register = useCallback((part: string) => (node: HTMLElement | null) => { if (part === "bar") bar.current = node; }, []);
  const pen = usePen(stage, (origin) => {
    if (!bar.current) return null;
    const box = boxOf(bar.current, origin);
    const y = box.top + box.height / 2;
    return { gestures: [{ id: "regua", layer: "over", strokes: [[{ x: box.left, y }, { x: box.left + box.width, y }]], width: box.height + 1, cap: "butt" }], wave: null, notes: [] };
  }, `regua:${evidence.unit}:${expanded}`);
  return <div ref={stage} style={{ position: "relative", isolation: "isolate" }}>
    <ProvaLista evidence={evidence} expanded={expanded} playing={false} lit={pen.done.has("regua")} register={register} />
    <PenLayer pen={pen} signal={signal} reduced />
  </div>;
}

export const Artistas = () => <Papel><ComRegua evidence={artistas} /></Papel>;
export const FaixasComFatia = () => <Papel><ComRegua evidence={faixas} /></Papel>;
export const MeMostraMais = () => <Papel><ComRegua evidence={artistas} expanded /></Papel>;
