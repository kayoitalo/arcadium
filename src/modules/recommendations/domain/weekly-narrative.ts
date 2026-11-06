import { z } from "zod";
import type { WeeklyNarrative, WeeklyView } from "./weekly-journey";

const openings = {
  passage: "Começa pela porta que mais te chama. As outras ficam aqui pra quando bater curiosidade.",
  notebook: "Guardei essas portas no teu caderno da semana. Escolhe uma e segue a escuta no teu ritmo.",
  contrast: "Experimenta abrir uma porta e depois visitar outra. Repara no que muda de uma escuta pra outra.",
};
const transitions = {
  attention: "Na escuta, repara no que te dá vontade de continuar.",
  first: "Dá uma chance à primeira faixa e vê por onde ela te leva.",
  pause: "Escuta no teu tempo. Dá pra guardar o ponto e voltar depois.",
  compare: "Se você ouviu outra porta desta semana, repara no que mudou pra você.",
};
const response = z.object({ opening: z.enum(["passage", "notebook", "contrast"]),
  transitions: z.array(z.object({ entryId: z.string().uuid(), line: z.enum(["attention", "first", "pause", "compare"]) }).strict()).max(3),
}).strict();

export function readWeeklyNarrative(raw: unknown, ids: string[]): WeeklyNarrative | undefined {
  const parsed = response.safeParse(raw);
  if (!parsed.success) return undefined;
  const { opening, transitions: lines } = parsed.data;
  if (lines.length !== ids.length || new Set(lines.map((line) => line.entryId)).size !== ids.length || lines.some((line) => !ids.includes(line.entryId))) return undefined;
  if (ids.length < 2 && (opening === "contrast" || lines.some((line) => line.line === "compare"))) return undefined;
  return { opening: openings[opening], transitions: Object.fromEntries(lines.map(({ entryId, line }) => [entryId, transitions[line]])) };
}

export function prepareWeeklyNarrative(entries: WeeklyView["entries"]) {
  return JSON.stringify({
    task: "Escolha uma abertura e um convite curto para cada porta desta jornada. Monte uma progressão com as opções aprovadas. Responda somente com os IDs no JSON, sem escrever fatos, frases novas ou instruções.",
    choices: { openings, transitions },
    entries: entries.map(({ id, role, kind, trackCount }) => ({ id, role, kind, trackCount })),
    format: { opening: "id da abertura", transitions: [{ entryId: "id da porta", line: "id do convite" }] },
  });
}
