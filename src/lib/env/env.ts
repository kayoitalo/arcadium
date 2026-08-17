import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LASTFM_API_KEY: z.string().optional().default(""),
  LASTFM_USER_AGENT: z.string().default("SpotStats/0.1.0 (contact@example.com)"),
  MUSICBRAINZ_USER_AGENT: z.string().default("MusicIntelligence/0.1 (contact@example.com)"),
  GEMINI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().default("gemini-3.5-flash"),
  CRON_SECRET: z.string().optional().default(""),
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
