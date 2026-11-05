import { prisma } from "@/lib/db/prisma";

/**
 * Teto local por conta: cada tentativa SDK, inclusive retry e fallback,
 * reserva uma linha sob bloqueio do usuário antes da chamada. Falhas
 * continuam contadas; registros legados permanecem conservadoramente
 * na janela, sem reconstruir tentativas que não foram medidas.
 *
 * O TTL de cada texto controla o frescor; este teto controla o custo.
 * São coisas diferentes: sem o teto, um laço ou um bug esvazia a cota do
 * dia e o app fica sem narrativa até a virada.
 *
 * Padrão conservador de 12 por 24h e 3 por hora. Não representa a cota
 * global nem preços do provedor, que dependem da configuração externa.
 */
export const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 12);
export const HOURLY_LIMIT = Number(process.env.AI_HOURLY_LIMIT ?? 3);

export interface BudgetState {
  usedToday: number;
  usedThisHour: number;
  dailyLimit: number;
  hourlyLimit: number;
  allowed: boolean;
  blockedBy?: "hour" | "day";
}

function since(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export async function readBudget(userId: string): Promise<BudgetState> {
  const [usedToday, usedThisHour] = await Promise.all([
    prisma.aIAnalysisRun.count({ where: { userId, provider: { not: "gemini-pack" }, createdAt: { gte: since(24) } } }),
    prisma.aIAnalysisRun.count({ where: { userId, provider: { not: "gemini-pack" }, createdAt: { gte: since(1) } } }),
  ]);

  const blockedBy = !Number.isInteger(DAILY_LIMIT) || !Number.isInteger(HOURLY_LIMIT) || DAILY_LIMIT < 0 || HOURLY_LIMIT < 0 ? "day"
    : usedThisHour >= HOURLY_LIMIT ? "hour" : usedToday >= DAILY_LIMIT ? "day" : undefined;

  return {
    usedToday,
    usedThisHour,
    dailyLimit: DAILY_LIMIT,
    hourlyLimit: HOURLY_LIMIT,
    allowed: !blockedBy,
    blockedBy,
  };
}

export class AiBudgetError extends Error { readonly reason = "quota"; constructor() { super("A cota de tentativas de IA foi atingida."); } }
export function budgetRefused(error: unknown) {
  let cause = error;
  for (let depth = 0; depth < 4 && cause && typeof cause === "object"; depth++) {
    if (cause instanceof AiBudgetError) return true;
    cause = (cause as { cause?: unknown }).cause;
  }
  return false;
}
/** Every physical SDK call, including retry/fallback, reserves under the same user lock. */
export async function reserveAttempt(userId: string, model: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const where = { userId, provider: { not: "gemini-pack" } };
    const [day, hour] = await Promise.all([
      tx.aIAnalysisRun.count({ where: { ...where, createdAt: { gte: since(24) } } }),
      tx.aIAnalysisRun.count({ where: { ...where, createdAt: { gte: since(1) } } }),
    ]);
    if (!Number.isInteger(DAILY_LIMIT) || !Number.isInteger(HOURLY_LIMIT) || DAILY_LIMIT <= day || HOURLY_LIMIT <= hour) throw new AiBudgetError();
    return tx.aIAnalysisRun.create({ data: { userId, kind: "ATTEMPT", provider: "gemini", model, status: "PENDING" }, select: { id: true } });
  });
}
