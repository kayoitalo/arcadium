/**
 * O relatório que /api/ai/refresh devolve, em uma frase para quem clicou o
 * botão. Cada execução gera no máximo um pacote, então o texto também diz
 * quando ainda falta período — senão o botão parece não ter feito nada.
 */

export interface RefreshEntry {
  period: string;
  outcome: string;
  detail?: string;
}

const PERIOD_LABEL: Record<string, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "1y": "1 ano",
  all: "tudo",
};

/** Todos os períodos que o cron percorre; serve para saber se a rodada acabou. */
const TOTAL_PERIODS = 4;

const label = (period: string) => PERIOD_LABEL[period] ?? period;

export function describeRefresh(report: RefreshEntry[] | undefined): string {
  if (!report?.length) return "Nada a fazer: não há escuta guardada para gerar texto.";

  const generated = report.find((entry) => entry.outcome === "generated");
  if (generated) {
    const rest = report.length < TOTAL_PERIODS ? " Clique de novo para o próximo período." : "";
    return `Textos de ${label(generated.period)} escritos agora.${rest}`;
  }

  const blocked = report.find((entry) => entry.outcome === "blocked");
  if (blocked?.detail === "no_key") return "Sem chave do Gemini configurada: os textos seguem no modo reserva.";
  if (blocked) return "O teto de chamadas do dia foi atingido. A geração volta sozinha quando a janela abrir.";

  const failed = report.filter((entry) => entry.outcome === "failed");
  if (failed.length) {
    return `A geração falhou em ${failed.map((entry) => label(entry.period)).join(", ")}. O motivo está no log, com prefixo [ai].`;
  }

  return "Todos os períodos já estão em dia — nenhum texto precisava ser refeito.";
}
