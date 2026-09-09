import { prisma } from "@/lib/db/prisma";

/**
 * Teto de chamadas à IA, contado a partir dos próprios registros de
 * execução — cada tentativa vira uma linha em AIAnalysisRun antes da
 * chamada sair, então a contagem inclui o que falhou. Falha também gasta
 * cota, e ignorar isso seria contar errado justamente no dia ruim.
 *
 * O TTL de cada texto controla o frescor; este teto controla o custo.
 * São coisas diferentes: sem o teto, um laço ou um bug esvazia a cota do
 * dia e o app fica sem narrativa até a virada.
 *
 * Padrão de 12/dia e 3/hora contra as 20/dia do free tier — 60% do
 * orçamento, com 8 chamadas de reserva para teste manual e imprevisto.
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
    prisma.aIAnalysisRun.count({ where: { userId, createdAt: { gte: since(24) } } }),
    prisma.aIAnalysisRun.count({ where: { userId, createdAt: { gte: since(1) } } }),
  ]);

  const blockedBy =
    usedThisHour >= HOURLY_LIMIT ? "hour" : usedToday >= DAILY_LIMIT ? "day" : undefined;

  return {
    usedToday,
    usedThisHour,
    dailyLimit: DAILY_LIMIT,
    hourlyLimit: HOURLY_LIMIT,
    allowed: !blockedBy,
    blockedBy,
  };
}
