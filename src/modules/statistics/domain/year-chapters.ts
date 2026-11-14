/*
 * Teu ano, em capítulos: o amigo contando o ano com o que o banco mediu.
 * Cada capítulo é uma frase curta com a prova dela — o mesmo contrato da
 * conversa. Sem dado que sustente, o capítulo não existe. Sem IA: as frases
 * saem dos números, na voz dele.
 */

export interface YearFacts {
  year: number;
  /** O ano ainda está correndo: "até aqui", não "o ano inteiro". */
  ongoing: boolean;
  /** Até que mês o ano foi contado: 12 num ano fechado, o mês corrente num ano em curso. */
  throughMonth: number;
  plays: number;
  artists: number;
  topArtist: { name: string; plays: number } | null;
  /** O nome que apareceu pela primeira vez neste ano e mais tocou. */
  newcomer: { name: string; plays: number; firstMonth: number } | null;
  topAlbum: { name: string; artist: string; plays: number; months: number; coverUrl: string | null } | null;
  peakHour: { hour: number; plays: number } | null;
  fullestMonth: { month: number; plays: number } | null;
}

export type ChapterProof =
  | { kind: "number"; value: number; label: string }
  | { kind: "cover"; title: string; artist: string; coverUrl: string | null; tally: number; tallyLabel: string }
  | { kind: "hour"; hour: number };

export interface YearChapter {
  id: string;
  /** O nome do capítulo, em minúscula: "o ano numa frase". */
  title: string;
  headline: string;
  /** O pedaço da frase que a prova sustenta: é ali que ele grifa. */
  mark: string;
  narrative: string;
  proof: ChapterProof;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const count = (value: number) => value.toLocaleString("pt-BR");
const hourWords = (hour: number) => (hour === 0 ? "meia-noite" : hour === 12 ? "meio-dia" : `${hour}h`);

/** Os capítulos que o ano sustenta, na ordem em que ele conta. */
export function yearChapters(facts: YearFacts): YearChapter[] {
  if (facts.plays === 0) return [];
  const chapters: YearChapter[] = [];
  const span = facts.ongoing ? `${facts.year}, até aqui` : `${facts.year}`;

  if (facts.topArtist) {
    chapters.push({
      id: "frase", title: "o ano numa frase",
      headline: `${span} teve ${count(facts.plays)} audições, e quem mais voltou foi ${facts.topArtist.name}.`,
      mark: facts.topArtist.name,
      narrative: `Foram ${count(facts.artists)} nomes diferentes passando pelo fone. ${facts.topArtist.name} apareceu ${count(facts.topArtist.plays)} vezes.`,
      proof: { kind: "number", value: facts.plays, label: "audições" },
    });
  }
  if (facts.newcomer && facts.newcomer.name !== facts.topArtist?.name) {
    chapters.push({
      id: "chegou", title: "quem chegou",
      headline: `${facts.newcomer.name} nem existia pra ti antes de ${MONTHS[facts.newcomer.firstMonth - 1]}.`,
      mark: facts.newcomer.name,
      narrative: `Chegou esse ano e já são ${count(facts.newcomer.plays)} audições. De todo mundo que apareceu pela primeira vez, ninguém ficou tanto.`,
      proof: { kind: "number", value: facts.newcomer.plays, label: "audições desde que chegou" },
    });
  }
  if (facts.peakHour) {
    chapters.push({
      id: "hora", title: "a tua hora",
      headline: `O teu ano tocou mais às ${hourWords(facts.peakHour.hour)}.`,
      mark: hourWords(facts.peakHour.hour),
      narrative: `${count(facts.peakHour.plays)} audições começaram nessa hora. É quando tu mais aperta o play.`,
      proof: { kind: "hour", hour: facts.peakHour.hour },
    });
  }
  if (facts.fullestMonth) {
    chapters.push({
      id: "mes", title: "o mês mais cheio",
      headline: `${MONTHS[facts.fullestMonth.month - 1].replace(/^./, (letter) => letter.toUpperCase())} foi o mês que mais tocou.`,
      mark: MONTHS[facts.fullestMonth.month - 1],
      narrative: `${count(facts.fullestMonth.plays)} audições num mês só.`,
      proof: { kind: "number", value: facts.fullestMonth.plays, label: `audições em ${MONTHS[facts.fullestMonth.month - 1]}` },
    });
  }
  if (facts.topAlbum) {
    const every = facts.throughMonth > 1 && facts.topAlbum.months >= facts.throughMonth;
    chapters.push({
      id: "disco", title: "o disco do ano",
      headline: `O disco do ano foi ${facts.topAlbum.name}.`,
      mark: facts.topAlbum.name,
      narrative: every
        ? `Apareceu em todos os meses. ${count(facts.topAlbum.plays)} faixas dele tocaram.`
        : `Apareceu em ${facts.topAlbum.months} ${facts.topAlbum.months === 1 ? "mês" : "meses"} diferentes e somou ${count(facts.topAlbum.plays)} faixas.`,
      proof: { kind: "cover", title: facts.topAlbum.name, artist: facts.topAlbum.artist, coverUrl: facts.topAlbum.coverUrl,
        tally: facts.topAlbum.months, tallyLabel: facts.topAlbum.months === 1 ? "1 mês" : `${facts.topAlbum.months} meses` },
    });
  }
  return chapters;
}
