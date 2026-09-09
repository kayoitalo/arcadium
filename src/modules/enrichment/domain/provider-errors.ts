export class ProviderUnavailableError extends Error {
  readonly entityName: string;

  constructor(entityName: string, cause?: unknown) {
    super(`Provedor indisponível ao consultar "${entityName}"`);
    this.name = "ProviderUnavailableError";
    this.entityName = entityName;
    this.cause = cause;
  }
}

export function isProviderUnavailable(error: unknown): error is ProviderUnavailableError {
  return error instanceof ProviderUnavailableError;
}
