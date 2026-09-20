/**
 * De que lado da linha um gênero está. Polaridade pede dois polos e um
 * neutro no meio: sem o neutro, "não mudou" teria que se passar por
 * "subiu" ou por "caiu", e a cor mentiria sobre o dado.
 */
export type ShiftTone = "up" | "flat" | "down";

/**
 * A tela imprime a variação com uma casa decimal. Abaixo de meio décimo
 * ela sai como 0,0pp — e aí a cor não pode dizer que cresceu. O limiar é
 * o do número mostrado, não um valor escolhido à parte: assim cor e
 * número nunca discordam.
 */
const PRINTED_ZERO = 0.05;

export function shiftTone(delta: number): ShiftTone {
  if (!Number.isFinite(delta) || Math.abs(delta) < PRINTED_ZERO) return "flat";
  return delta > 0 ? "up" : "down";
}

/** A cor do polo. Os três tokens vivem no globals.css, com o porquê. */
export const shiftColor = (tone: ShiftTone) => `var(--shift-${tone})`;

/**
 * O sinal que não depende de cor. Sob protanopia o magenta encosta no
 * cinza, então a seta não é enfeite: é ela que separa "caiu" de "não
 * mudou" para quem não distingue os dois.
 */
export const shiftMark = (tone: ShiftTone) => (tone === "up" ? "▲" : tone === "down" ? "▼" : "—");
