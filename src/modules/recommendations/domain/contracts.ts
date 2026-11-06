import { z } from "zod";
import { ASPECTS, FEEDBACK_TYPES } from "./feedback";
import { DISCOVERY_INTENTS } from "./discovery-intent";
import { territoryRequestSchema, repertoireRestrictionSchema } from "./territories";
const id = z.string().min(1).max(100);
const dial = z.number().finite().transform((value) => Math.min(100, Math.max(0, Math.round(value))));
export const sessionRequest = z.object({
  operation: z.enum(["AUTO", "RESUME", "MORE", "NEW_ENTRY", "DEEPEN"]).default("AUTO"),
  sessionId: id.optional(), requestKey: z.uuid().optional(),
  intent: z.enum(DISCOVERY_INTENTS).optional(), sourceItemId: id.optional(),
  territory: territoryRequestSchema.optional(), restrictions: repertoireRestrictionSchema.optional(),
  mode: z.enum(["SAFE", "BALANCED", "EXPERIMENTAL"]).default("BALANCED"),
  context: z.enum(["GENERAL", "WORKING", "STUDYING", "EXERCISING", "RELAXING"]).default("GENERAL"),
  period: z.enum(["7d", "30d", "1y", "all"]).default("30d"),
  proximity: dial.optional(), fame: dial.optional(),
}).superRefine((value, ctx) => {
  if (["MORE", "NEW_ENTRY", "DEEPEN"].includes(value.operation) && !value.requestKey) ctx.addIssue({ code: "custom", message: "Nova busca precisa de requestKey." });
  if (value.operation === "MORE" && !value.sessionId) ctx.addIssue({ code: "custom", message: "Buscar mais precisa da sessão original." });
  if (value.operation === "DEEPEN" && (!value.sessionId || !value.sourceItemId)) ctx.addIssue({ code: "custom", message: "Aprofundar precisa da sessão e indicação originais." });
  if (value.sourceItemId && value.operation !== "DEEPEN") ctx.addIssue({ code: "custom", message: "A referência precisa da operação de aprofundamento." });
  if (value.operation !== "MORE" && value.operation !== "RESUME" && (value.intent === "TERRITORY") !== Boolean(value.territory)) ctx.addIssue({ code: "custom", message: "Escolha um território para essa intenção." });
  if (value.restrictions && value.intent !== "REPERTOIRE") ctx.addIssue({ code: "custom", message: "Restrições precisam da intenção de repertório." });
  if (value.territory && value.operation !== "NEW_ENTRY") ctx.addIssue({ code: "custom", message: "Um destino novo precisa de outra entrada." });
});
export const feedbackRequest = z.object({
  itemId: id, type: z.enum(FEEDBACK_TYPES), note: z.string().trim().max(2000).optional(),
  requestKey: z.uuid().optional(), revisesId: id.optional(), advance: z.boolean().default(false),
  details: z.object({ aspects: z.array(z.enum(ASPECTS)).max(ASPECTS.length).transform((values) => [...new Set(values)].sort()).optional() }).optional(),
}).superRefine((value, ctx) => {
  if (value.type === "RETRACTED" && !value.revisesId) ctx.addIssue({ code: "custom", message: "Informe a avaliação a retirar." });
});
export const progressRequest = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("EXPOSE"), itemId: id }),
  z.object({ operation: z.literal("MOVE"), rank: z.number().int().positive(), expectedRank: z.number().int().positive() }),
]);
