import { useRef } from "react";
import { Fala, PenLayer, usePen, band, textLines } from "arcadium";
import { Papel } from "./_papel";

// A caneta de verdade: mede o trecho marcado e passa a faixa amarela por baixo.
function ComGrifo(props: React.ComponentProps<typeof Fala>) {
  const stage = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const signal = useRef<ArrayLike<number> | null>(null);
  const pen = usePen(stage, (origin) => {
    if (!mark.current) return null;
    const { lines, size } = textLines(mark.current, origin);
    const { strokes, width } = band(lines, size);
    return { gestures: [{ id: "grifo", layer: "under", strokes, width, cap: "butt" }], wave: null, notes: [] };
  }, String(props.headline));
  return <div ref={stage} style={{ position: "relative", isolation: "isolate", padding: "8px 0" }}>
    <Fala {...props} markRef={mark} marked={pen.started.has("grifo")} />
    <PenLayer pen={pen} signal={signal} reduced />
  </div>;
}

export const ManchetePrincipal = () => <Papel><ComGrifo level={1} window="essa semana"
  headline="Do bolero pro thrash em quatro minutos?!" mark={["thrash"]}
  narrative="Tu tava de boa com Lucho Gatica e do nada entrou Sepultura no talo. Quem foi que mexeu no teu fone?"
  insight="Saiu do romântico direto pro metal pesado, sem escala."
  closing="O Max Cavalera e o Lucho se cumprimentaram aí dentro, certeza." /></Papel>;

export const AssuntoSecundario = () => <Papel><ComGrifo level={2} window="nesse último mês"
  headline="38 artistas novos e tu voltou pro mesmo disco." mark={["mesmo disco"]}
  narrative="Abriu a porta pra um monte de gente nova, mas o Clube da Esquina tocou mais que todos juntos." /></Papel>;

export const JaPassou = () => <Papel><Fala level={2} active={false} window="desde que eu te conheço"
  headline="Tem disco que tu nunca larga." narrative="Esse aqui atravessou três anos de histórico sem sair da fila." /></Papel>;

export const Riscado = () => <Papel><Fala level={2} dismissed reply="Justo. Finge que eu não falei nada."
  window="essa semana" headline="Tu ouviu chorinho às três da manhã?" narrative="Foi a semana inteira assim." /></Papel>;
