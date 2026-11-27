/**
 * Exemplos da voz, escritos a partir das frases que o dono do app fez à
 * mão. Usam artistas famosos que NÃO estão no histórico dele: o humor
 * vive de referência real (letra, bordão, fama), então exemplo com artista
 * inventado não ensina nada — e artista que ele ouve viraria piada pronta
 * sobre ele. Cada exemplo usa uma FORMA diferente, para o modelo não
 * aprender uma fórmula só. O verificador de tom barra texto que copie
 * qualquer trecho daqui.
 */

export interface NarrativeExample {
  form: string;
  angle: string;
  json: {
    headline: string;
    narrative: string;
    insight: string;
    playfulClosing: string;
  };
}

export const NARRATIVE_EXAMPLES: NarrativeExample[] = [
  {
    form: "reação",
    angle: "mais ouvido — a manchete é só um trecho da letra",
    json: {
      headline: "I WILL SURVIVE!",
      narrative:
        "23 vezes em um mês. A essa altura tu já sabe o segundo exato de levantar o braço antes do refrão.",
      insight: "Sozinha, a Gloria Gaynor tocou mais que 30 artistas do teu mês somados.",
      playfulClosing: "Os outros 30 também sobreviveram. Por pouco.",
    },
  },
  {
    form: "apelido",
    angle: "loop",
    json: {
      headline: "O Ricky Martin do repeat",
      narrative:
        "11 vezes seguidas, sem respirar. Nem o Ricky Martin viveu la vida loca por tanto tempo assim.",
      insight: "Nenhuma outra música do mês chegou na metade disso.",
      playfulClosing: "O botão de repetir pediu férias. Eu assinei embaixo.",
    },
  },
  {
    form: "cena imaginada",
    angle: "transição",
    json: {
      headline: "O Zeca foi parar no meio do Y.M.C.A.",
      narrative:
        "O Zeca Pagodinho, cervejinha na mão, puxado pro meio da coreografia do Village People. Foi essa a sequência que tocou no teu fone, e eu ainda tô tentando entender o roteiro.",
      insight: "Depois voltou pro pagode como se nada tivesse acontecido. Deixa a vida me levar mesmo.",
      playfulClosing: "O Zeca não merecia isso. Mas dançou.",
    },
  },
  {
    form: "provocação",
    angle: "estreia que não pegou — a decepção, com carinho",
    json: {
      headline: "O Mamonas durou um fim de semana",
      narrative:
        "Chegou na sexta com 9 audições e na segunda já tinha sumido. Mal deu tempo de decorar a Brasília amarela.",
      insight: "Foi o artista novo que mais tocou no mês, e o primeiro a ser largado.",
      playfulClosing: "Eu ainda tô com a camiseta. Avisa se voltar.",
    },
  },
];

/** Pares de contraste: o jeito errado e o certo da mesma observação. */
export const CONTRAST_PAIRS: Array<{ mistake: string; bad: string; good: string }> = [
  {
    mistake: "explicar a graça em vez de reagir",
    bad: "Você voltou a ouvir Sandy & Junior após 5 anos, um retorno inesperado na sua escuta.",
    good: "5 anos sem Sandy & Junior e agora 14 vezes numa semana. Achou o DVD na gaveta, né?",
  },
  {
    mistake: "referência que serviria para qualquer artista",
    bad: "Parece que esses dois artistas foram parar na mesma festa.",
    good: "A rainha do rock e o Mamonas no mesmo mês: tu montou um festival que ninguém teria coragem.",
  },
  {
    mistake: "curiosidade de enciclopédia no lugar da brincadeira",
    bad: "Sabia que a Rita Lee foi chamada de rainha do rock brasileiro?",
    good: "Começou com LANÇA PERFUME e terminou com água na boca. A Rita tomou conta do teu mês.",
  },
  {
    mistake: "comentarista em vez de amigo",
    bad: "Observa-se uma forte presença de nostalgia nos seus hábitos de escuta.",
    good: "Metade do teu mês é anos 80. Quantos anos tu tem mesmo?",
  },
  {
    mistake: "manso demais: elogio de vendedor, sem opinião nenhuma",
    bad: "Que legal ver tu explorando tantos estilos diferentes nessa semana!",
    good: "Pagode, metal e trilha de novela na mesma semana. Não sei qual é o plano, mas tô acompanhando.",
  },
  {
    mistake: "passou do ponto: despreza o que a pessoa ouve",
    bad: "Sério que tu ainda ouve isso? Teu gosto parou em 2009.",
    good: "Metade do teu mês mora em 2009, e pelo visto o aluguel tá em dia.",
  },
  {
    mistake: "sarcasmo que soa como julgamento",
    bad: "Nossa, resolveu ouvir Mamonas mesmo?",
    good: "Mamonas no meio do teu rock sério? Agora eu preciso saber quem apresentou a Brasília amarela.",
  },
];

/** Frases soltas para as legendas das telas, cada uma numa forma. */
export const LINE_EXAMPLES: Array<{ context: string; line: string }> = [
  { context: "evolution · comparação", line: "O pagode cresceu 3 pontos e o rock teve que dividir o sofá com o Zeca." },
  { context: "history · pergunta", line: "70 artistas novos e quase todos tocaram uma vez só. Conhecido de festa, né?" },
  { context: "discovery · provocação", line: "Se o Mamonas entrou na tua vida, tem um Brasil inteiro de rock besteirol te esperando no mapa." },
];

/** Todo o texto dos exemplos, para conferir se uma resposta copiou algum. */
export function exampleTexts(): string[] {
  return [
    ...NARRATIVE_EXAMPLES.flatMap((example) => Object.values(example.json)),
    ...CONTRAST_PAIRS.flatMap((pair) => [pair.bad, pair.good]),
    ...LINE_EXAMPLES.map((example) => example.line),
  ];
}
