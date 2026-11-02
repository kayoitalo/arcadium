import { z } from "zod";
export const memoryQuery = z.object({ q: z.string().trim().max(120).default(""), responses: z.enum(["0", "1"]).default("0"), cursor: z.string().max(1000).optional() });
export interface MemoryFeedback { id: string; type: string; channel: string | null; note: string | null; details: unknown; createdAt: string; revisesId: string | null }
export interface MemorySession {
  id: string; createdAt: string; currentRank: number | null; intent: string | null; total: number;
  anchor: { artistName: string; trackName: string } | null;
  items: { id: string; artistName: string; trackName: string; reason: string | null; rank: number; exposedAt: string | null;
    feedback: MemoryFeedback[]; moreFeedback: boolean }[];
}
export interface MemoryPage { sessions: MemorySession[]; nextCursor: string | null; limits: { sessions: number; itemsPerSession: number; feedbackPerItem: number } }
export const MEMORY_LABEL: Record<string, string> = { LIKED: "curtiu", SAVE_FOR_LATER: "guardou para depois", DISLIKED: "não curtiu",
  ALREADY_KNOW: "já conhecia", SKIPPED: "pulou", NOT_LISTENED: "ainda não ouviu", REQUEST_MISMATCH: "não era o pedido",
  CURIOUS: "ficou curioso", RETRACTED: "retirou a avaliação", NOT_INTERESTED: "sem interesse (registro antigo)" };
