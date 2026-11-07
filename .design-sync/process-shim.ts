// O next/link (usado por Resposta com href) lê process.env, que só existe no
// servidor e no build do Next. No bundle do Claude Design não há `process`;
// este shim roda antes de qualquer outro módulo e só preenche o que falta.
const scope = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
scope.process ??= { env: { NODE_ENV: "production" } };
export {};
