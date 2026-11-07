import { useCallback, useRef } from "react";
import { ProvaTransicao, PenLayer, usePen, boxOf, dimension } from "arcadium";
import { Papel } from "./_papel";

// A prova do "de repente": duas audições reais, lado a lado, com a hora de cada uma.
// Sem capa (o proxy de imagens é do app), o lugar dela é o vão com o título.
const evidence = {
  kind: "transition" as const,
  gapMinutes: 4,
  from: { artist: "Lucho Gatica", track: "Contigo en la distancia", genre: "Bolero", previewUrl: null, when: "4 nov · 23:12",
    cover: { url: null, title: "Inolvidables", artist: "Lucho Gatica" } },
  to: { artist: "Sepultura", track: "Refuse/Resist", genre: "Thrash Metal", previewUrl: null, when: "4 nov · 23:16",
    cover: { url: null, title: "Chaos A.D.", artist: "Sepultura" } },
  context: {
    before: [{ artist: "Lucho Gatica", track: "Sabor a mí", when: "4 nov · 23:05" }],
    after: [{ artist: "Sepultura", track: "Territory", when: "4 nov · 23:20" }],
  },
};
const register = () => () => undefined;

// Como a Conversa usa: a prova registra as capas e a caneta mede a cota entre elas,
// com o "PAM." no alto e o intervalo embaixo da travessa.
function ComCaneta({ expanded = false }: { expanded?: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const parts = useRef(new Map<string, HTMLElement>());
  const signal = useRef<ArrayLike<number> | null>(null);
  const reg = useCallback((part: string) => (node: HTMLElement | null) => {
    if (node) parts.current.set(part, node); else parts.current.delete(part);
  }, []);
  const pen = usePen(stage, (origin) => {
    const from = parts.current.get("from"); const to = parts.current.get("to");
    if (!from || !to) return null;
    const fromBox = boxOf(from, origin);
    const lift = Math.min(96, Math.max(52, fromBox.height * 0.42));
    const { posts, span, mid } = dimension(fromBox, boxOf(to, origin), lift);
    return {
      gestures: [{ id: "cota", layer: "over", strokes: [posts[0], span, posts[1]], width: 2, cap: "square", join: "miter" }],
      wave: null,
      notes: [
        { id: "pam", gesture: "cota", text: "PAM.", x: mid.x, y: mid.y - 12, kind: "grito" },
        { id: "intervalo", gesture: "cota", text: `${evidence.gapMinutes} min depois`, x: posts[1][0].x - 12, y: mid.y + 10, kind: "dado", align: "end" },
      ],
    };
  }, `cota:${expanded}`);
  return <div ref={stage} style={{ position: "relative", isolation: "isolate" }}>
    <ProvaTransicao evidence={evidence} expanded={expanded} playingSide={null} register={reg} />
    <PenLayer pen={pen} signal={signal} reduced />
  </div>;
}

export const ComCota = () => <Papel><ComCaneta /></Papel>;

export const Salto = () => <Papel><ProvaTransicao evidence={evidence} expanded={false} playingSide={null} register={register} /></Papel>;

export const ComSequencia = () => <Papel><ComCaneta expanded /></Papel>;
