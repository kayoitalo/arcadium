/**
 * Um prazo para uma requisição da tela: aborta junto com quem a pediu ou
 * quando o tempo passa, e diz qual dos dois foi. Vale até o corpo terminar
 * de chegar; quem lê a resposta chama `done()` depois do `json()`.
 */
export function deadline(parent: AbortSignal, ms: number) {
  const controller = new AbortController();
  let expired = false;
  const follow = () => controller.abort(parent.reason);
  if (parent.aborted) follow();
  else parent.addEventListener("abort", follow, { once: true });
  const timer = setTimeout(() => { expired = true; controller.abort(new DOMException("Prazo esgotado", "TimeoutError")); }, ms);
  return {
    signal: controller.signal,
    /** O tempo acabou antes da resposta (e não foi quem pediu que desistiu). */
    expired: () => expired && !parent.aborted,
    done: () => { clearTimeout(timer); parent.removeEventListener("abort", follow); },
  };
}
