import { Resposta, Respostas } from "arcadium";
import { Papel } from "./_papel";

// O pé da conversa: as respostas possíveis para o assunto da vez, cada uma com sua tecla.
export const PeDaConversa = () => <Papel><Respostas inline label="Responder">
  <Resposta hint="T">toca aí</Resposta>
  <Resposta primary hint="→">e o que mais?</Resposta>
  <Resposta hint="M">me mostra mais</Resposta>
  <Resposta hint="N">nada a ver</Resposta>
</Respostas></Papel>;

export const FimDaConversa = () => <Papel><Respostas inline label="Depois da conversa">
  <Resposta hint="↵">de novo</Resposta>
  <Resposta href="/taste-evolution">o que mudou</Resposta>
  <Resposta href="/discovery">seguir descobrindo</Resposta>
</Respostas></Papel>;

export const NaDescoberta = () => <Papel><Respostas inline label="Responder à indicação">
  <Resposta primary hint="↑">curti</Resposta>
  <Resposta hint="↓">guardo pra depois</Resposta>
  <Resposta hint="→">pula</Resposta>
</Respostas></Papel>;
