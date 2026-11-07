import { useCallback, useRef } from "react";
import { ProvaDecadas, PenLayer, usePen, boxOf } from "arcadium";
import { Papel } from "./_papel";

// As décadas que a frase cita ganham a régua; a cobertura do ano de lançamento fica dita embaixo.
const decadas = {
  kind: "decades" as const, focus: [1970, 1980], focusShare: 58.4, coverage: 72,
  bars: [
    { decade: 1960, share: 8.1, plays: 61 }, { decade: 1970, share: 36.2, plays: 274 },
    { decade: 1980, share: 22.2, plays: 168 }, { decade: 1990, share: 17.5, plays: 132 },
    { decade: 2000, share: 9.3, plays: 70 }, { decade: 2010, share: 6.7, plays: 51 },
  ],
};

function ComRegua({ evidence }: { evidence: typeof decadas }) {
  const stage = useRef<HTMLDivElement>(null);
  const bars = useRef(new Map<string, HTMLElement>());
  const signal = useRef<ArrayLike<number> | null>(null);
  const register = useCallback((part: string) => (node: HTMLElement | null) => {
    if (node) bars.current.set(part, node); else bars.current.delete(part);
  }, []);
  const pen = usePen(stage, (origin) => {
    const gestures = evidence.focus.flatMap((decade) => {
      const node = bars.current.get(`bar:${decade}`);
      if (!node) return [];
      const box = boxOf(node, origin); const y = box.top + box.height / 2;
      return [{ id: `regua:${decade}`, layer: "over" as const, strokes: [[{ x: box.left, y }, { x: box.left + box.width, y }]], width: box.height + 1, cap: "butt" as const }];
    });
    return gestures.length ? { gestures, wave: null, notes: [] } : null;
  }, `decadas:${evidence.focus.join(",")}`);
  return <div ref={stage} style={{ position: "relative", isolation: "isolate" }}>
    <ProvaDecadas evidence={evidence} lit={evidence.focus.filter((decade) => pen.done.has(`regua:${decade}`))} register={register} />
    <PenLayer pen={pen} signal={signal} reduced />
  </div>;
}

export const DuasDecadas = () => <Papel><ComRegua evidence={decadas} /></Papel>;
export const UmaDecada = () => <Papel><ComRegua evidence={{ ...decadas, focus: [1990], focusShare: 17.5 }} /></Papel>;
