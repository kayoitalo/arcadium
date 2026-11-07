import { Resposta, Respostas } from "arcadium";
import { Papel } from "./_papel";

// As respostas são o único jeito de falar com ele: rótulo curto, na tua voz, e a tecla ao lado.
export const Principal = () => <Papel><Respostas inline><Resposta primary hint="→">e o que mais?</Resposta></Respostas></Papel>;

export const ComTecla = () => <Papel><Respostas inline><Resposta hint="T">toca aí</Resposta><Resposta hint="N">nada a ver</Resposta></Respostas></Papel>;

export const Estados = () => <Papel><Respostas inline>
  <Resposta pressed hint="M">menos</Resposta>
  <Resposta disabled hint="T">toca aí</Resposta>
  <Resposta>carregando prévia…</Resposta>
</Respostas></Papel>;

export const LinkExterno = () => <Papel><Respostas inline><Resposta href="https://music.apple.com/br/album/cartola-1976/1444042772">abrir no Apple Music</Resposta></Respostas></Papel>;
