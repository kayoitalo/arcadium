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

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || "";
    this.ai = new GoogleGenerativeAI(key);
    this.modelName = modelName || process.env.AI_MODEL || "gemini-2.0-flash";
  }

  async analyzeProfile(input: MusicProfileInput): Promise<ProfileNarrative> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const model = this.ai.getGenerativeModel({ model: this.modelName });

    const prompt = `
Você é um curador musical analítico e editorial.
Sua tarefa é analisar o perfil de escuta musical abaixo e gerar uma narrativa estruturada.

Regras estritas:
1. Responda APENAS com um objeto JSON válido, sem markdown ou texto fora do JSON.
2. Não invente dados. Use apenas os números e nomes fornecidos.
3. Não use a palavra "Spotify". Fale sobre "seu histórico" ou "suas escutas".
4. Seja direto, adulto e editorial. Sem excesso de emojis.

Dados do perfil:
${JSON.stringify(input, null, 2)}

O JSON deve seguir exatamente a seguinte estrutura:
{
  "headline": "Uma frase curta de impacto sobre o período (ex: Seu mês soou mais pesado.)",
  "narrative": "Um parágrafo de até 3 frases descrevendo as principais mudanças e consolidações no gosto musical.",
  "insight": "Um detalhe analítico isolado (ex: Deftones representou 15% de toda a sua audição.)",
  "tasteKeywords": ["3 a 5 palavras-chave descritivas (ex: Sombrio, Metal, Exploração)"]
}
    `;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Clean up potential markdown formatting from the response
      const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const parsed = JSON.parse(jsonString);
      
      // Validate against our Zod schema
      const validated = profileNarrativeSchema.parse(parsed);
      
      return validated;
    } catch (error) {
      console.error("[GeminiAdapter] Failed to analyze profile:", error);
      throw new Error("Failed to generate AI narrative.");
    }
  }
}
