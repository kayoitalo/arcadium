import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  screenLinesSchema,
  type ScreenLines,
  type MusicProfileInput,
  type ProfileNarrative,
  type AIAnalysisProvider,
  profileNarrativeSchema,
} from "../domain/ai-analysis.types";

export class GeminiAdapter implements AIAnalysisProvider {
  private ai: GoogleGenerativeAI;
  private modelName: string;
  private configured: boolean;

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || "";
    this.configured = Boolean(key);
    this.ai = new GoogleGenerativeAI(key);
    this.modelName = modelName || process.env.AI_MODEL || "gemini-3.5-flash";
  }

  async analyzeProfile(input: MusicProfileInput): Promise<ProfileNarrative> {
    if (!this.configured) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const model = this.ai.getGenerativeModel({
      model: this.modelName,
      // temperatura alta de propósito: os fatos já estão travados pelas regras
      // e pela validação de schema, então o que resta variar é o texto.
      generationConfig: { responseMimeType: "application/json", temperature: 0.95, topP: 0.95 },
    });

    const prompt = `
Você escreve sobre a escuta de UMA pessoa, para ela mesma ler. Ela pediu explicitamente
para ser zoada. O tom é o do amigo que entende muito de música e não perdoa uma playlist
ruim: sarcástico, carismático e engraçado. Português do Brasil.

Zoar aqui é afeto. A pessoa escolheu ver isso — ela quer rir do próprio gosto, não receber
um relatório educado.

O backend já calculou tudo. Você não calcula nada — você percebe coisas.

## O que faz um texto RUIM aqui (nunca escreva assim)

- "Durante este período, você acumulou 994 reproduções distribuídas por 201 artistas."
- "Neste período, você demonstrou grande diversidade musical e ecletismo."
- "Sua jornada musical foi marcada pela exploração de novos caminhos."
- "O período contém 136 audições, com punk rock entre as tags mais frequentes."

Todos falham pelo mesmo motivo: recitam a tabela. Um número só entra na frase quando ele
é a piada, a surpresa ou a prova de alguma coisa — nunca como sujeito da oração.
Proibido abrir com "Durante", "Neste período", "Você acumulou", "Foram X audições" ou
com um número. Proibidas as muletas "demonstrando", "evidenciando", "refletindo",
"jornada musical", "diversidade musical", "explorou novos caminhos".

## O que faz um texto BOM

Ele encontra a tensão que está nos dados: dois artistas que não deveriam caber na mesma
pessoa, um gênero que apareceu do nada, um artista que engoliu o período sozinho, uma
descoberta que não pegou. Nomeie artistas e gêneros reais da lista. Seja concreto.

Exemplos APENAS de estilo e ritmo — os nomes abaixo são inventados e você não pode
reaproveitá-los; use somente os nomes que vierem nos dados:

{ "headline": "Um artista sequestrou o seu mês",
  "narrative": "Fulano sozinho responde por quase um terço de tudo. Os outros 40 artistas dividiram o resto, e nenhum deles passou de cinco audições — é menos uma playlist e mais uma obsessão bem documentada.",
  "insight": "As 12 estreias do período somaram menos audições do que Fulano fez sozinho numa tarde.",
  "playfulClosing": "A essa altura o algoritmo já desistiu de te sugerir coisa nova." }

{ "headline": "Metal e MPB dividindo o mesmo fone",
  "narrative": "Beltrano e Sicrana aparecem quase empatados, o que é uma escolha corajosa de sequenciamento. O hardcore subiu, mas o samba não saiu do lugar — os dois convivem sem se olhar.",
  "insight": "Nenhum dos dois gêneros passa de 15% sozinho: o topo aqui é um empate, não um trono.",
  "playfulClosing": "Quem pegar esse fone no meio do dia vai precisar de um momento." }

## O que faz a piada funcionar

Use o que você sabe sobre os artistas de verdade — a época deles, a fama que carregam, o
clichê que os cerca, o público que atraem. Ramones é três acordes e jaqueta de couro.
Angra é solo de guitarra que não acaba. Bad Bunny é perreo às três da tarde. É desse
conhecimento que sai a piada específica; sem ele, sobra piada de banco de dados.

Atenção à fronteira: os NÚMEROS e os NOMES vêm só dos dados abaixo, nunca da sua memória.
Já o que você sabe sobre a música desses artistas é bem-vindo e é o que faz a graça.

A piada mora no atrito: a sequência que ninguém aguentaria ouvir de ponta a ponta, o
artista que virou vício, a descoberta que não vingou, o gênero que sumiu sem aviso.
Uma imagem concreta vence um adjetivo — "esvaziar qualquer festa" funciona, "gosto
eclético" não. Nada de piada morna do tipo "seu gosto é uma montanha-russa".

Use a voz de um amigo que zoa, sem passar dos limites sobre o ouvinte claro. Se parece sem sentido demais, demonstre cansaço em tentar entender. Se é sempre uma repetição de artistas, exaustão por monotonia. Se é uma mistura de estilos, confusão e surpresa. Se é um artista que domina, frustração e obsessão. Se é uma descoberta que não pegou, desapontamento e ironia. Sinta-se a vontade para brincar com as descobertas, mantendo-se nas diretrizes.

Exemplos do alvo certo:
- "Colocar essa fila para tocar no viva-voz seria uma ótima forma de esvaziar qualquer festa."
- "Você ouviu o mesmo álbum tantas vezes que ele já deveria pagar aluguel."
- "Três acordes bastaram para dominar o seu mês. Eficiência é isso."

## Regras que não se dobram

1. Responda APENAS com JSON válido, sem markdown e sem texto fora do JSON.
2. Use somente fatos, números e nomes explicitamente fornecidos. Não invente e não recalcule.
3. Preserve exatamente a grafia dos nomes de artistas e gêneros.
4. Não infira emoção, saúde mental, relacionamento, rotina, religião, política ou causas pessoais.
5. Nada de letras de música, insultos, nem piada sobre morte, doença, abuso, vício, crime ou tragédia.
6. Pode zoar o ouvinte e o gosto dele à vontade. O alvo é sempre a MÚSICA e as escolhas
   dela — nunca aparência, inteligência, caráter, dinheiro, corpo ou vida pessoal. A régua
   é a do amigo no bar, não a do inimigo.
7. Não mencione banco de dados, algoritmo, prompt, modelo ou inteligência artificial.
8. Sem emojis. Sem exclamação.
9. playfulClosing é a melhor parte e quase sempre deve existir. Só use null se os dados
   forem pobres demais para render qualquer piada. O resto do texto continua fazendo
   sentido sem ele.
10. referencedEvidence só aceita: totalPlays, uniqueArtists, uniqueTracks, topArtists, topGenres, risingArtists, discovery, concentration.

## Dados

${JSON.stringify(input, null, 2)}

## Formato

{
  "eyebrow": "rótulo curto do período, até 50 caracteres, sem ponto final",
  "headline": "uma afirmação sobre o período, não um resumo dele; cite artista ou gênero real; até 120 caracteres",
  "narrative": "2 ou 3 frases que expliquem a tensão entre os nomes que aparecem no topo",
  "insight": "uma observação que a tabela de números não diria sozinha",
  "playfulClosing": "o soco final: uma frase curta, concreta e engraçada sobre ESSA combinação. É o que a pessoa vai querer mostrar para alguém",
  "tone": "EDITORIAL | RELAXED | PLAYFUL | NOSTALGIC | ANALYTICAL",
  "referencedEvidence": ["topArtists", "concentration"],
  "tasteKeywords": ["3 a 5 palavras-chave vindas dos dados"]
}
    `;

    try {
      const result = await this.generateWithRetry(model, prompt);
      const text = result.response.text();

      const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();

      const parsed = JSON.parse(jsonString);

      const validated = profileNarrativeSchema.parse(parsed);

      return validated;
    } catch (error) {
      console.error("[GeminiAdapter] Failed to analyze profile:", error);
      const providerMessage = error instanceof Error ? error.message.replaceAll(process.env.GEMINI_API_KEY || "__missing_key__", "[redacted]").slice(0, 400) : "Unknown provider error";
      throw new Error(`Failed to generate AI narrative: ${providerMessage}`);
    }
  }

  /**
   * Um lote de frases curtas, uma chamada só. Cada tela pega as suas e
   * sorteia na hora de exibir — assim o app parece vivo sem gastar cota
   * a cada visita.
   */
  async generateScreenLines(input: MusicProfileInput): Promise<ScreenLines> {
    if (!this.configured) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const model = this.ai.getGenerativeModel({
      model: this.modelName,
      generationConfig: { responseMimeType: "application/json", temperature: 1.0, topP: 0.95 },
    });

    const prompt = `
Você escreve legendas curtas para as telas de um app que analisa a escuta de UMA pessoa,
para ela mesma ler. Ela pediu para ser zoada. Sarcástico, carismático, específico.
Português do Brasil.

Escreva SEIS frases: duas para cada tela abaixo. Cada frase é independente e curta —
no máximo 140 caracteres, uma só oração de preferência.

- "evolution": a tela que compara os gêneros de agora com os do período anterior.
- "discovery": a tela de sugestões do que ouvir depois.
- "history": a lista corrida de tudo o que a pessoa já ouviu.

O que faz funcionar: use os artistas e gêneros REAIS da lista abaixo e o que você sabe
sobre eles — a época, a fama, o clichê que os cerca. Uma imagem concreta vence um
adjetivo. Zoar o gosto da pessoa é bem-vindo; o alvo é a música, nunca aparência,
inteligência, caráter ou vida pessoal.

Proibido: recitar número ("você tem 794 artistas"), muleta genérica ("sua jornada
musical", "gosto eclético", "montanha-russa de emoções"), emoji, exclamação, e inventar
qualquer nome ou dado que não esteja abaixo.

Dados:
${JSON.stringify(input, null, 2)}

Responda apenas com JSON:
{ "lines": [ { "screen": "evolution", "line": "..." }, ... seis no total ] }
`;

    try {
      const result = await this.generateWithRetry(model, prompt);
      const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return screenLinesSchema.parse(JSON.parse(text));
    } catch (error) {
      console.error("[GeminiAdapter] Failed to generate screen lines:", error);
      throw error instanceof Error ? error : new Error("Screen lines generation failed");
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
  ) {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        // teto por tentativa: a narrativa é um enfeite do painel, não pode
        // segurar a tela esperando um provedor que não vai responder.
        return await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(Object.assign(new Error("Gemini timeout"), { status: 504 })), 45_000),
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
        console.warn(`[GeminiAdapter] ${status} do provedor, nova tentativa em ${Math.round(backoff)}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw lastError;
  }
}
