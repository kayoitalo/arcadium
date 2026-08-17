import { GoogleGenerativeAI } from "@google/generative-ai";
import {
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
      generationConfig: { responseMimeType: "application/json", temperature: 0.65 },
    });

    const prompt = `
Você é o narrador editorial de um diário musical pessoal. Escreva em português do Brasil com tom relaxado, adulto e ocasionalmente divertido.
Os dados abaixo já foram calculados pelo backend. Você apenas os interpreta.

Regras estritas:
1. Responda APENAS com um objeto JSON válido, sem markdown ou texto fora do JSON.
2. Use somente fatos, números e nomes explicitamente fornecidos. Não faça cálculos novos.
3. Não infira emoções, saúde mental, relacionamentos, rotina privada ou causas pessoais.
4. Não cite letras de músicas. Não insulte e não faça piadas sobre morte, doença, abuso, vício, crime ou tragédia.
5. Preserve exatamente os nomes de artistas e gêneros fornecidos.
6. Use no máximo uma provocação leve em playfulClosing. Ela é opcional; use null se não surgir naturalmente.
7. A afirmação factual deve continuar compreensível sem playfulClosing.
8. Não mencione Spotify, banco de dados, algoritmo, prompt ou inteligência artificial.
9. referencedEvidence deve conter somente chaves desta lista: totalPlays, uniqueArtists, uniqueTracks, topArtists, topGenres, risingArtists, discovery, concentration.
10. Não use emojis e não use tom sarcástico.
11. Pode fazer piadas, claro, desde que sejam inteligentes e considerando os pontos anteriores.

Dados do perfil:
${JSON.stringify(input, null, 2)}

O JSON deve seguir exatamente a seguinte estrutura:
{
  "eyebrow": "Rótulo editorial com até 50 caracteres",
  "headline": "Frase curta e específica sobre o período",
  "narrative": "Até 3 frases descrevendo padrões sustentados pelos dados",
  "insight": "Um detalhe analítico sustentado pelos valores fornecidos",
  "playfulClosing": "Uma provocação leve opcional ou null",
  "tone": "EDITORIAL | RELAXED | PLAYFUL | NOSTALGIC | ANALYTICAL",
  "referencedEvidence": ["topArtists", "concentration"],
  "tasteKeywords": ["3 a 5 palavras-chave presentes ou diretamente sustentadas pelos dados"]
}
    `;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Defensive cleanup for providers that ignore responseMimeType.
      const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const parsed = JSON.parse(jsonString);
      
      // Validate against our Zod schema
      const validated = profileNarrativeSchema.parse(parsed);
      
      return validated;
    } catch (error) {
      console.error("[GeminiAdapter] Failed to analyze profile:", error);
      const providerMessage = error instanceof Error ? error.message.replaceAll(process.env.GEMINI_API_KEY || "__missing_key__", "[redacted]").slice(0, 400) : "Unknown provider error";
      throw new Error(`Failed to generate AI narrative: ${providerMessage}`);
    }
  }
}
