// Barril curado para o Claude Design: só as primitivas do amigo, sem telas,
// rotas ou chamadas às APIs do app. Cada export vem direto do código real.
// O shim precisa ser o primeiro import: os módulos rodam na ordem de import.
import "./process-shim";
export { Fala, Respostas, Resposta, Capa, PenLayer, type CoverData } from "../src/components/amigo/fala";
export { Aviso } from "../src/components/amigo/aviso";
export { Janela } from "../src/components/amigo/janela";
export { Trace, type TraceGesture, type WaveSpec } from "../src/components/amigo/trace";
export { usePen, type Pen, type PenDrawing, type PenNote } from "../src/components/amigo/use-pen";
export { band, circle, dimension, frame, highlight, strike, wave, type Point, type Box } from "../src/components/amigo/gestures";
export { boxOf, textLines } from "../src/components/amigo/measure";
export { ProvaTransicao, ProvaLista, ProvaDecadas } from "../src/components/conversa/provas";
