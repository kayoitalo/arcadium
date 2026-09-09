import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LASTFM_API_KEY: z.string().optional().default(""),
  LASTFM_USER_AGENT: z.string().default("Grooveyard/0.1 (contato@example.com)"),
  MUSICBRAINZ_USER_AGENT: z.string().default("Grooveyard/0.1 (contato@example.com)"),
  GEMINI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().default("gemini-3.5-flash"),
  CRON_SECRET: z.string().optional().default(""),

  // Exportação para o Spotify (opcional). Sem eles, a exportação
  // continua gerando links de busca e arquivo .m3u.
  SPOTIFY_CLIENT_ID: z.string().optional().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default(""),
  SPOTIFY_REDIRECT_URI: z.string().optional().default("http://127.0.0.1:3000/api/spotify/callback"),

  // Chave de 32 bytes que cifra os tokens guardados no banco.
  TOKEN_ENCRYPTION_KEY: z.string().optional().default(""),

  // Teto de chamadas à IA por dia e por hora.
  AI_DAILY_LIMIT: z.coerce.number().int().positive().default(12),
  AI_HOURLY_LIMIT: z.coerce.number().int().positive().default(3),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return result.data;
}

export const env = parseEnv();
