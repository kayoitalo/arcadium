/**
 * Sorteia um item sem repetir o último que a pessoa viu. O último fica
 * guardado no navegador pela chave informada — cada tela e cada período têm
 * a sua. Sem acesso ao armazenamento (aba anônima, preview), só sorteia.
 */
export function pickFresh<T>(
  items: T[],
  key: string,
  identify: (item: T) => string,
  {
    random = Math.random,
    storage = typeof window === "undefined" ? undefined : safeStorage(),
  }: { random?: () => number; storage?: Pick<Storage, "getItem" | "setItem"> } = {},
): T | null {
  if (items.length === 0) return null;

  let last: string | null = null;
  try {
    last = storage?.getItem(key) ?? null;
  } catch {
    last = null;
  }

  const pool = items.length > 1 ? items.filter((item) => identify(item) !== last) : items;
  const choices = pool.length > 0 ? pool : items;
  const choice = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];

  try {
    storage?.setItem(key, identify(choice));
  } catch {
    // sem armazenamento, o sorteio continua valendo
  }
  return choice;
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
