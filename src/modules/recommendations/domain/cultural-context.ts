import { z } from "zod";
export const contextKind = z.enum(["album", "track"]);
export type ContextKind = z.infer<typeof contextKind>;
export function lastFmSourceURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || !["www.last.fm", "last.fm"].includes(url.hostname)
      || url.username || url.password || url.port || !url.pathname.startsWith("/music/")) return null;
    url.protocol = "https:"; return url.href;
  } catch { return null; }
}
const common = { provider: z.literal("lastfm"), kind: contextKind, artistName: z.string().min(1).max(1000), title: z.string().min(1).max(1000),
  fetchedAt: z.string().datetime(), requestedLanguage: z.literal("pt"), recordingVerified: z.literal(false) };
export const culturalContextSchema = z.discriminatedUnion("status", [
  z.object({ ...common, status: z.literal("AVAILABLE"), text: z.string().min(40).max(421), sourceUrl: z.string().refine((value) => lastFmSourceURL(value) === value) }),
  z.object({ ...common, status: z.literal("MISSING"), reason: z.enum(["NO_TEXT", "IDENTITY_MISMATCH", "NOT_CONFIGURED"]) }),
]);
export type CulturalContext = z.infer<typeof culturalContextSchema>;
export interface CulturalContextProvider { lookup(kind: ContextKind, artistName: string, title: string): Promise<CulturalContext> }
export function readCulturalContexts(value: unknown): Partial<Record<ContextKind, CulturalContext>> {
  if (!value || typeof value !== "object") return {};
  const result: Partial<Record<ContextKind, CulturalContext>> = {};
  for (const kind of contextKind.options) {
    const parsed = culturalContextSchema.safeParse((value as Record<string, unknown>)[kind]);
    if (parsed.success && parsed.data.kind === kind) result[kind] = parsed.data;
  }
  return result;
}
