import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

export async function promptPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Use --custom-password em um terminal interativo.");
  }
  const hiddenOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const terminal = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true, historySize: 0 });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  terminal.on("SIGINT", cancel);
  terminal.on("close", cancel);
  async function ask(label) {
    process.stdout.write(label);
    try { return await terminal.question("", { signal: controller.signal }); }
    finally { process.stdout.write("\n"); }
  }
  try {
    const password = await ask("Sua senha (12 a 256 caracteres; digitação oculta): ");
    if (password.length < 12 || password.length > 256) {
      throw new Error("A senha precisa ter entre 12 e 256 caracteres. Nada foi alterado.");
    }
    const confirmation = await ask("Confirme sua senha: ");
    if (password !== confirmation) throw new Error("As senhas não conferem. Nada foi alterado.");
    return password;
  } finally {
    terminal.off("SIGINT", cancel);
    terminal.off("close", cancel);
    terminal.close();
    hiddenOutput.end();
  }
}
