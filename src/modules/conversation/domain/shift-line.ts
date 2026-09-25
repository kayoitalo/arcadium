import { genreLabel } from "@/lib/format/genre";
import type { TasteShiftItem } from "@/modules/statistics/application/overview-service";
import { claimedShares, claimsAgree, normalize } from "./matching";

/*
 * "O que mudou": a frase dele sobre a tela só entra se o dado concorda.
 * O modelo escreve o gênero em português ("rock alternativo") e as tags
 * chegam em inglês ("alternative rock"); e ele diz para que lado o gênero
 * foi ("subiu", "abriu espaço"), que precisa ser o lado da lista.
 */

/** Os jeitos de o gênero aparecer numa frase. */
function namesOf(genre: string): string[] {
  const tag = genre.trim().toLowerCase();
  return [...new Set([tag, tag.replace(/-/g, " "), genreLabel(genre)].map(normalize))].sort((a, b) => b.length - a.length);
}

const UP =
  /\b(sub(iu|indo)|sobe|cresc(eu|e|endo)|ganh(ou|a|ando)|entrou|domin(ou|a|ando)|tomou|puxou|invadiu|chegou|bombou|disparou|decolou|pra cima|em alta|mais espaco)\b/;
const DOWN =
  /\b(ca(iu|i|indo)|perd(eu|e|endo)|sumiu|saiu|largou|encolheu|diminuiu|esfriou|despencou|(abr(iu|ir)|d(eu|ar)) espaco|em baixa|pra baixo|menos espaco|ficou pra tras)\b/;

/** Pedaços da frase que têm um verbo só: "o Angra subiu | o rock clássico teve que abrir espaço". */
function clausesOf(text: string): string[] {
  return normalize(text)
    .split(/[,.;:!?]+|\s(?:e|mas|enquanto)\s/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

/** Os gêneros da lista citados no pedaço — o nome mais longo primeiro, para "pop rock" não virar "pop". */
function genresIn(clause: string, items: TasteShiftItem[]): TasteShiftItem[] {
  let rest = ` ${clause} `;
  const found: TasteShiftItem[] = [];
  const candidates = items
    .flatMap((item) => namesOf(item.genre).map((name) => ({ item, name })))
    .filter(({ name }) => name.length >= 3)
    .sort((a, b) => b.name.length - a.name.length);
  for (const { item, name } of candidates) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^a-z0-9&])${escaped}(?=$|[^a-z0-9&])`);
    const match = pattern.exec(rest);
    if (!match) continue;
    if (!found.includes(item)) found.push(item);
    // o trecho achado sai da frase: um nome mais curto não pode casar dentro dele
    const start = match.index + match[1].length;
    rest = `${rest.slice(0, start)}${" ".repeat(name.length)}${rest.slice(start + name.length)}`;
  }
  return found;
}

/**
 * A frase bate com o que mudou? Devolve os gêneros que ela cita com o lado
 * certo — são eles que o traço acende —, ou null se ela não cita nenhum,
 * se põe um gênero do lado errado ou se afirma uma porcentagem que o dado
 * não tem.
 */
export function verifyShiftLine(
  line: string,
  shift: { rising: TasteShiftItem[]; declining: TasteShiftItem[] },
): string[] | null {
  const items = [...shift.rising, ...shift.declining];
  const truths = items.flatMap((item) => [item.currentShare, item.previousShare, Math.abs(item.delta)]);
  if (!claimsAgree(claimedShares(line), truths)) return null;

  const confirmed: string[] = [];
  for (const clause of clausesOf(line)) {
    const found = genresIn(clause, items);
    // dois gêneros e um verbo ("o metal abriu espaço pro rock"): não dá para saber quem foi para onde
    if (found.length !== 1) continue;
    const said = UP.test(clause) ? (DOWN.test(clause) ? null : "up") : DOWN.test(clause) ? "down" : null;
    const [item] = found;
    const side = shift.rising.includes(item) ? "up" : "down";
    if (said && said !== side) return null;
    if (said === side && !confirmed.includes(item.genre)) confirmed.push(item.genre);
  }
  return confirmed.length > 0 ? confirmed : null;
}

const decimal = (value: number) => value.toString().replace(".", ",");
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** O que ele diz quando nenhuma frase do modelo passa: o maior salto de cada lado, em palavras. */
export function shiftHeadline(shift: { rising: TasteShiftItem[]; declining: TasteShiftItem[] }): {
  headline: string;
  genres: string[];
} | null {
  const [up] = shift.rising;
  const [down] = shift.declining;
  if (up && down) return { headline: `Menos ${genreLabel(down.genre)}, mais ${genreLabel(up.genre)}.`, genres: [up.genre, down.genre] };
  if (up) return { headline: `Mais espaço pro ${genreLabel(up.genre)}.`, genres: [up.genre] };
  if (down) return { headline: `Menos espaço pro ${genreLabel(down.genre)}.`, genres: [down.genre] };
  return null;
}

/** A prova dita em voz alta: de quanto a quanto foi cada gênero aceso. */
export function shiftSentence(items: TasteShiftItem[]): string {
  return items
    .map((item, index) => {
      const name = capitalize(genreLabel(item.genre));
      const from = `${decimal(item.previousShare)}%`;
      const to = `${decimal(item.currentShare)}%`;
      if (item.delta > 0) return `${name} foi de ${from} pra ${to}${index === 0 ? " do que você ouviu" : ""}.`;
      return `${name} caiu de ${from} pra ${to}${index === 0 ? " do que você ouviu" : ""}.`;
    })
    .join(" ");
}
