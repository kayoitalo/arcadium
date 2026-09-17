/**
 * O vocabulário que tira os textos do tom. Ele fica aqui, no código, e não
 * no prompt: uma lista de palavras proibidas no contexto deixa o modelo
 * contido demais — e ainda coloca essas palavras na cabeça dele. O prompt
 * ensina o que fazer; esta verificação pega o que escapar.
 *
 * Cada item nasceu de uma frase real que soou mal.
 */
const OFF_TONE: Array<[RegExp, string]> = [
  // julgar o gosto
  [/\bcrimes?\b/i, "crime"],
  [/\bproibid[oa]s?\b/i, "proibido"],
  [/\bvergonh/i, "vergonha"],
  [/\bfiasco/i, "fiasco"],
  [/\bbom senso\b/i, "bom senso"],
  // rótulo esnobe
  [/\bdrama adolescente\b/i, "drama adolescente"],
  [/\bde academia\b/i, "de academia"],
  [/\brodovi[aá]ria\b/i, "rodoviária"],
  // texto de IA
  [/\bjornada musical\b/i, "jornada musical"],
  [/\bgosto ecl[eé]tico\b/i, "gosto eclético"],
  [/\bmontanha[- ]russa\b/i, "montanha-russa"],
  [/\bcolis(ão|ao|ões)\b/i, "colisão"],
  [/\btrilha sonora da sua vida\b/i, "trilha sonora da sua vida"],
  // relatório
  [/\bexecu(ções|coes|ção|cao)\b/i, "execuções"],
  [/\breprodu(ções|coes|ção|cao)\b/i, "reproduções"],
  [/\bacumulou\b/i, "acumulou"],
  // fecho de moral
  [/\bno final das contas\b/i, "no final das contas"],
  // bastidores
  [/\bintelig[eê]ncia artificial\b/i, "inteligência artificial"],
  [/\balgoritmo/i, "algoritmo"],
];

const wordsOf = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

function ngrams(words: string[], size: number): string[] {
  const grams: string[] = [];
  for (let index = 0; index + size <= words.length; index += 1) grams.push(words.slice(index, index + size).join(" "));
  return grams;
}

/**
 * Um trecho de exemplo copiado: `size` palavras seguidas iguais às de um
 * exemplo do prompt. Devolve o trecho, ou null. Os exemplos existem para
 * ensinar o jeito — reaproveitar a piada deles é o que não pode.
 */
export function findCopiedExample(
  texts: Array<string | null | undefined>,
  examples: string[],
  // 6 e não 5: com 5, expressões que fazem parte da voz ("quantos anos tu
  // tem mesmo") seriam barradas como cópia
  size = 6,
): string | null {
  const exampleGrams = new Set(examples.flatMap((example) => ngrams(wordsOf(example), size)));
  for (const text of texts) {
    if (!text) continue;
    const copied = ngrams(wordsOf(text), size).find((gram) => exampleGrams.has(gram));
    if (copied) return copied;
  }
  return null;
}

const REPORT_WORDS: Array<[RegExp, string, string]> = [
  [/\breprodu(ções|coes)\b/gi, "audições", "AUDIÇÕES"],
  [/\breprodu(ção|cao)\b/gi, "audição", "AUDIÇÃO"],
  [/\bexecu(ções|coes)\b/gi, "audições", "AUDIÇÕES"],
  [/\bexecu(ção|cao)\b/gi, "audição", "AUDIÇÃO"],
  // "32 plays" é vocabulário de painel; o amigo diz "32 vezes"
  [/(?<=\d\s)plays\b/gi, "vezes", "VEZES"],
];

/**
 * Vocabulário de relatório que tem troca direta: "16 reproduções" vira
 * "16 audições". Jogar fora um texto bom inteiro por uma palavra dessas
 * gastaria uma chamada à toa; o que não tem troca segue para o verificador.
 */
export function replaceReportWords(text: string): string;
export function replaceReportWords(text: string | null): string | null;
export function replaceReportWords(text: string | null): string | null {
  if (!text) return text;
  return REPORT_WORDS.reduce(
    (current, [pattern, lower, upper]) =>
      current.replace(pattern, (match) => (match === match.toUpperCase() ? upper : lower)),
    text,
  );
}

/** Os termos fora do tom encontrados nos textos, sem repetir. Vazio quando está tudo certo. */
export function findOffTonePhrases(texts: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const [pattern, label] of OFF_TONE) {
      if (pattern.test(text)) found.add(label);
    }
  }
  return [...found];
}
