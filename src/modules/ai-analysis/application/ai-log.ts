/**
 * Log das chamadas de IA numa linha JSON com prefixo "[ai]": na Vercel (ou
 * em qualquer log de servidor) dá pra filtrar por ele e saber, sem abrir o
 * banco, se o modelo respondeu, trocou pro reserva, esgotou a cota ou foi
 * barrado pelo nosso teto.
 */

export type AiFailureReason =
  | "quota"
  | "overload"
  | "timeout"
  | "invalid_output"
  | "off_tone"
  | "copied_example"
  | "not_configured"
  | "unknown";

type Level = "info" | "warn" | "error";

export function logAi(event: string, fields: Record<string, unknown>, level: Level = "info"): void {
  const line = `[ai] ${JSON.stringify({ event, at: new Date().toISOString(), ...fields })}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

interface ErrorLike {
  status?: number;
  reason?: AiFailureReason;
  name?: string;
  message?: string;
  cause?: unknown;
}

/**
 * Por que uma chamada falhou, olhando também a causa original — o adaptador
 * embrulha o erro do provedor, mas preserva o status e a causa.
 */
export function classifyAiError(error: unknown): AiFailureReason {
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as ErrorLike;
    if (candidate.reason) return candidate.reason;
    if (candidate.status === 429) return "quota";
    if (candidate.status === 504 || /timeout/i.test(candidate.message ?? "")) return "timeout";
    if (candidate.status === 500 || candidate.status === 502 || candidate.status === 503) return "overload";
    if (candidate.name === "ZodError" || candidate.name === "SyntaxError") return "invalid_output";
    if (/not configured/i.test(candidate.message ?? "")) return "not_configured";
    current = candidate.cause;
  }

  return "unknown";
}

/** Status HTTP do provedor, se houver, em qualquer nível da causa. */
export function errorStatus(error: unknown): number | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as ErrorLike;
    if (typeof candidate.status === "number") return candidate.status;
    current = candidate.cause;
  }
  return undefined;
}

/** Erro de texto recusado pelo nosso próprio controle de tom, já com o motivo. */
export function rejectedText(reason: Extract<AiFailureReason, "off_tone" | "copied_example" | "invalid_output">, message: string) {
  return Object.assign(new Error(message), { reason });
}
