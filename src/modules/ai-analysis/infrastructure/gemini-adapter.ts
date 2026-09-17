import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
import {
  type MusicProfileInput,
  type NarrativeAngle,
  type NarrativeForm,
  type AddressStyle,
  type PackProvider,
  type PackSlot,
  EVIDENCE_KEYS,
} from "../domain/ai-analysis.types";
import { CONTRAST_PAIRS, LINE_EXAMPLES, NARRATIVE_EXAMPLES } from "../domain/voice-examples";
import { classifyAiError, logAi } from "../application/ai-log";

/**
 * A voz dos textos, construída com o dono do app a partir de frases que ele
 * escreveu à mão. O prompt ensina personagem, princípios e forma; o que
 * sair do tom, copiar um exemplo ou vier com palavrão sem censura é
 * tratado depois, no código (domain/text-guard, domain/profanity).
 */
const CHARACTER = `
## A regra central

Não escreva como quem analisou os dados. Escreva como quem acabou de notar algo curioso e
chamou um amigo pra olhar.

## Princípios

- Reaja primeiro, explique depois. Se a observação funciona sem explicação, melhor ainda.
- Fale COM a pessoa, não sobre ela. Ela é a protagonista; os artistas são figurantes, o
  material da brincadeira.
- Se der pra trocar os artistas sem mudar a frase, a referência é genérica demais.
- Mostre a situação acontecendo e chame a pessoa pra olhar junto, em vez de entregar uma
  conclusão pronta.
- Uma observação específica vale mais que três medianas.
- Nem toda graça vem de contraste entre artistas: hábito, volta, obsessão e sumiço rendem
  tanto quanto.
- Curiosidade só quando soma à brincadeira, nunca no lugar dela.
- Referência que qualquer fã reconhece na hora; nada que só o fã mais dedicado entenderia.
- Soe como comentário de rede social, não como texto de revista de música.
- Risada escrita ("HAHAHA", "hehe") só quando a situação pede, e no máximo uma por texto.

## Quem fala

Dois colegas jovens que manjam de música, trocando mensagem no WhatsApp. A zoeira é leve:
provoca, mas não pega pesado — e também não é careta.

- Informal de verdade, e à vontade com as gírias, variando de um texto pro outro: "rapaz",
  "ixe", "puts", "caraca", "eita", "pô", "véi", "tá ligado que…", "se liga",
  "na moral", "papo reto", "sem condições", "mó", "boaa". Pode esticar letra, usar
  reticências e exclamação. Trate por "tu" do começo ao fim, sem misturar com "você/seu".
- Tem gosto próprio e é cúmplice: "eu também amava", "eu não julgo, o Zeca é bom demais".
- Acha a escuta da pessoa curiosa, nunca inferior.
- Palavrão leve pode, dá tom de amigo — mas sempre censurado: FO***SE, PO**A.

## Referências

A graça quase sempre vem de uma referência que o fã reconhece. Varie o tipo; não fique só
no nome da música ou do álbum:

- um trecho de letra ou uma frase icônica que quem ouviu muito sabe de cor — sozinho, já
  pode ser a manchete inteira ("LANÇA, MENINA!" pra quem ouviu Rita Lee o mês todo);
- a fama, a imagem ou a estética do artista;
- um trejeito, uma dança, a voz;
- um meme ou apelido associado ao artista;
- as entrelinhas: aludir à música sem dizer o nome dela.

Quando duas músicas aparecem na mesma frase, costuma render mais dizer o nome de uma e
continuar com um trecho da letra da outra.

Parta das músicas que a pessoa ouviu ("topTracks", "mostPlayed", "transition", "loop"). Se
não der piada com elas, vale uma música famosa do artista.

(Os artistas citados nesta seção e nos exemplos estão fora da escuta da pessoa: servem pra
mostrar o jeito, nunca pra serem reaproveitados.)
`;

const GROUNDING = `
## O que você sabe

- Os totais do período. Pode contar a escuta como algo acontecendo, mas sem inventar dia,
  horário ou número. Sequência real só existe em "transition" e "loop".
- Uma audição é uma vez que uma música tocou: 16 audições de um artista não são 16 músicas.
- Números e nomes vêm dos dados, com a grafia exata. Números em algarismos.
- Datas, números e história de artista ou disco só a partir de "facts". Referência famosa —
  letra, música, bordão, imagem — pode vir do que você sabe, desde que seja conhecida mesmo.

## Limites

- A graça é com a música e as escolhas de escuta; nunca com aparência, inteligência,
  dinheiro, corpo, sentimentos ou vida pessoal. "Quantos anos tu tem?" como brincadeira vale;
  supor o que a pessoa sente, não.
- Nada sobre morte, doença, abuso, dependência, crime ou tragédia. A cervejinha do Zeca como
  imagem do artista tudo bem; piada sobre vício, não.
- Letra de música: trechos curtos (até 6 palavras), no máximo dois por texto, nunca estrofe.
- Não fale de dados, algoritmo ou inteligência artificial.
`;

/** O dado de onde a leitura parte. Obrigatório: é o que garante variedade entre leituras. */
const ANGLES: Record<NarrativeAngle, string> = {
  transicao: 'a transição improvável ("transition"): a música de "from" e, logo depois, a de "to"',
  surpresa: 'o ponto fora da curva ("outliers") no meio dos gêneros que dominam o período ("topGenres")',
  "mais-ouvido": 'o que mais tocou ("mostPlayed"): a música ou o disco',
  mudanca: 'quem subiu em relação ao período anterior ("risingArtists")',
  epoca: 'de que décadas vêm os discos ("eras")',
  volta: 'quem reapareceu depois de muito tempo ("comebacks"; "awayFor" já diz quanto tempo, em palavras)',
  loop: 'a música que tocou várias vezes seguidas ("loop"; "times" é quantas)',
  numeros: 'um número que surpreende: as estreias ("discovery"), o quanto os cinco primeiros concentram, ou um artista muito à frente',
};

/** Como a piada é construída. Sorteada à parte, para a estrutura não virar fórmula. */
const FORMS: Record<NarrativeForm, string> = {
  reacao: "uma reação de surpresa ao que tu acabou de notar — pode ser só a referência gritada",
  pergunta: "uma pergunta cúmplice pra pessoa, do tipo que só um amigo faria",
  provocacao: "uma cutucada carinhosa no hábito, que comemora e zoa ao mesmo tempo",
  cena: "uma cena imaginada com os artistas, contada como se estivesse acontecendo agora",
  comparacao: "uma comparação inesperada que faz a pessoa enxergar o próprio hábito de outro jeito",
  apelido: "um apelido pra pessoa, tirado de uma referência do artista",
};

const FORM_LABEL: Record<NarrativeForm, string> = {
  reacao: "reação",
  pergunta: "pergunta",
  provocacao: "provocação",
  cena: "cena imaginada",
  comparacao: "comparação",
  apelido: "apelido",
};

/** Como tratar quem lê: escolhido pela pessoa em Ajustes. */
const ADDRESS_BRIEF: Record<AddressStyle, string> = {
  masculino:
    'Quem lê é um cara. Vocês são dois parceiros: pode chamar de "mano", "mermão", "brother", "parça", "cara", e zoar do jeito que amigo zoa amigo, implicando com a playlist dele. A zoeira é com a música: sem machismo, sem piada sexual, sem homofobia.',
  feminino:
    'Quem lê é uma mina. Vocês são duas parceiras: pode chamar de "amiga", "miga", "mana", "mulher", e zoar do jeito que amiga zoa amiga, implicando com a playlist dela. Não use "mano", "mermão" nem "parça". A zoeira é com a música: nunca com corpo, aparência ou vida amorosa.',
  neutro:
    'Trate quem lê sem marcar gênero: nada de "mano", "mermão", "mina", "amigo" ou "amiga". As gírias sem gênero ("ixe", "caraca", "véi", "tá ligado") seguem à vontade.',
};

function listenerSection(input: MusicProfileInput): string {
  return `\n## Com quem tu fala\n\n${ADDRESS_BRIEF[input.listener?.addressAs ?? "neutro"]}\n`;
}

const EXAMPLES = `
## Exemplos da voz

Estes artistas NÃO estão na escuta da pessoa e servem só pra mostrar o jeito. Nunca
reaproveite estas piadas, frases ou referências — crie as suas com os artistas dos dados.

${NARRATIVE_EXAMPLES.map((example) => `Forma ${example.form} · ângulo ${example.angle}:\n${JSON.stringify(example.json, null, 2)}`).join("\n\n")}

## O mesmo assunto, do jeito errado e do jeito certo

${CONTRAST_PAIRS.map((pair) => `${pair.mistake}\n  ruim: ${pair.bad}\n  bom:  ${pair.good}`).join("\n\n")}

## Frases curtas no mesmo jeito

${LINE_EXAMPLES.map((example) => `- (${example.context}) ${example.line}`).join("\n")}
`;

/** Uma resposta com várias leituras e dezenas de frases é longa: ninguém espera por ela na tela. */
const PACK_TIMEOUT_MS = 120_000;

export class GeminiAdapter implements PackProvider {
  private ai: GoogleGenerativeAI;
  private modelName: string;
  private configured: boolean;

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || "";
    this.configured = Boolean(key);
    this.ai = new GoogleGenerativeAI(key);
    this.modelName = modelName || process.env.AI_MODEL || "gemini-3.5-flash";
  }

  /**
   * O pacote de um período, numa chamada só: várias leituras, comentários
   * por disco do rack e frases pras outras telas. O app guarda e sorteia —
   * cada visita mostra outro texto sem gastar cota. Devolve o JSON cru: a
   * validação é item a item, no serviço, pra um item ruim não derrubar o resto.
   */
  async generatePack(input: MusicProfileInput, slots: PackSlot[]): Promise<{ output: unknown; model: string }> {
    if (!this.configured) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const model = this.ai.getGenerativeModel({
      model: this.modelName,
      // os fatos estão travados pela base factual e pela validação; o que varia é o texto
      generationConfig: { responseMimeType: "application/json", temperature: 1.0, topP: 0.95 },
    });

    const slotList = slots
      .map((slot, index) => `- Leitura ${index + 1}: ângulo — ${ANGLES[slot.angle]}; forma — ${FORM_LABEL[slot.form]}: ${FORMS[slot.form]}.`)
      .join("\n");
    const albums = input.rackAlbums ?? [];
    const albumTask = albums.length
      ? `Pra cada disco abaixo, escreva 2 comentários curtos (até 140 caracteres), falando com a pessoa que acabou de pôr esse disco pra tocar. Os dois usam referências diferentes do disco ou do artista (trecho de letra, fama, trejeito, entrelinhas).\n${albums
          .map((album) => `- "${album.album}", de ${album.artist} (${album.plays} audições)`)
          .join("\n")}`
      : "Não há discos no rack neste período: devolva a lista vazia.";

    const prompt = `
Você escreve os textos de um app de música sobre a escuta de UMA pessoa. O app guarda tudo o
que você escrever agora e sorteia um texto diferente a cada visita — então os textos precisam
ser diferentes ENTRE SI: outro assunto, outra estrutura, outra referência. Repetir uma piada
entre dois itens é o pior erro deste pacote.
${CHARACTER}${listenerSection(input)}
## O pacote

### 1. "readings" — ${slots.length} leituras completas, pra tela inicial

Cada uma parte do ângulo e usa a forma indicada:
${slotList}

O ângulo é obrigatório: a manchete e a primeira frase partem dele. Não caia em "tu tava
ouvindo X e de repente Y" se a forma não pedir.

### 2. "albumLines" — comentários sobre os discos do rack

${albumTask}

### 3. "screenLines" — frases curtas pras outras telas

4 frases pra cada tela, até 160 caracteres, em formas variadas (${Object.values(FORM_LABEL).join(", ")}),
cada uma partindo de um dado diferente:
- "evolution": compara o período com o anterior — quem entrou, quem saiu.
- "history": um hábito da escuta — o que mais tocou, a música em loop, quem voltou, a
  transição improvável, a época.
- "discovery": chama pra explorar, de preferência usando um ponto fora da curva como gancho.
  Nunca zoa a pessoa por querer coisa nova.
${EXAMPLES}
${GROUNDING}
## Dados

${JSON.stringify(input, null, 2)}

## Formato

Responda APENAS com JSON válido, sem markdown:

{
  "readings": [
    {
      "slot": 1,
      "eyebrow": "o nome do período, curto e sem ponto final, como \"últimos 30 dias\"; até 50 caracteres",
      "headline": "na forma do slot: a referência, uma reação, uma pergunta ou um apelido — um trecho de letra sozinho vale; até 90 caracteres",
      "narrative": "2 ou 3 frases de conversa, partindo do ângulo do slot",
      "insight": "outra observação curta, com outro dado, também com graça; até 160 caracteres",
      "playfulClosing": "a tirada final, cúmplice, do tipo que dá vontade de mostrar pra alguém; até 120 caracteres",
      "tone": "EDITORIAL | RELAXED | PLAYFUL | NOSTALGIC | ANALYTICAL",
      "referencedEvidence": ["só destes: ${EVIDENCE_KEYS.join(", ")}"],
      "tasteKeywords": ["3 a 5 palavras-chave vindas dos dados"]
    }
  ],
  "albumLines": [ { "album": "nome exato do disco", "artist": "nome exato do artista", "line": "..." } ],
  "screenLines": [ { "screen": "evolution", "line": "..." } ]
}
`;

    try {
      const { result, model: answeredBy } = await this.generateWithRetry(model, prompt, 2, PACK_TIMEOUT_MS);
      const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return { output: JSON.parse(text), model: answeredBy };
    } catch (error) {
      const providerMessage = error instanceof Error ? error.message.replaceAll(process.env.GEMINI_API_KEY || "__missing_key__", "[redacted]").slice(0, 400) : "Unknown provider error";
      // a causa fica anexada: é dela que o log tira o motivo (cota, sobrecarga, JSON quebrado)
      throw new Error(`Failed to generate AI pack: ${providerMessage}`, { cause: error });
    }
  }

  /**
   * O provedor devolve 503 em picos de demanda e diz que são temporários.
   * Sem repetir a chamada, um pico único joga a narrativa direto no texto
   * determinístico — que é correto, mas bem menos interessante de ler.
   */
  private async generateWithRetry(
    model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
    prompt: string,
    attempts = 2,
    timeoutMs = 45_000,
  ) {
    try {
      return { result: await this.attemptModel(model, prompt, attempts, timeoutMs), model: this.modelName };
    } catch (error) {
      // pico de demanda ou cota diária do modelo principal esgotada: o modelo
      // reserva tem cota própria e costuma responder nos dois casos
      const status = (error as { status?: number }).status;
      const overloaded = status === 503 || status === 504 || status === 500 || status === 502 || status === 429;
      const fallbackName = process.env.AI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite";
      if (!overloaded || !fallbackName || fallbackName === this.modelName) throw error;

      logAi("ai.fallback", { from: this.modelName, to: fallbackName, status, reason: classifyAiError(error) }, "warn");
      const fallback = this.ai.getGenerativeModel({
        model: fallbackName,
        generationConfig: (model as { generationConfig?: GenerationConfig }).generationConfig,
      });
      return { result: await this.attemptModel(fallback, prompt, 1, timeoutMs), model: fallbackName };
    }
  }

  private async attemptModel(
    model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
    prompt: string,
    attempts: number,
    timeoutMs: number,
  ) {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        // teto por tentativa: a narrativa é um enfeite do painel, não pode
        // segurar a tela esperando um provedor que não vai responder.
        return await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(Object.assign(new Error("Gemini timeout"), { status: 504 })), timeoutMs),
          ),
        ]);
      } catch (error) {
        lastError = error;
        const status = (error as { status?: number }).status;
        // 429 aqui é cota diária estourada, não pico: repetir só queima o que resta.
        // O timeout local (504) também não se repete — esperar de novo dá o mesmo nada.
        const retryable = status === 503 || status === 500 || status === 502;
        if (!retryable || attempt === attempts - 1) break;
        const backoff = 700 * 2 ** attempt + Math.random() * 300;
        logAi("ai.retry", { model: (model as { model?: string }).model, status, backoffMs: Math.round(backoff) }, "warn");
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw lastError;
  }
}
