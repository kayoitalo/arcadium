/**
 * Toda capa externa passa pelo proxy do app: o mesmo endereço para
 * qualquer fonte (Last.fm, Cover Art Archive, Apple), cache nosso e sem
 * depender de a CDN de fora aceitar ser embutida.
 */
export function coverProxyUrl(source?: string | null): string | null {
  if (!source) return null;
  return `/api/cover?u=${encodeURIComponent(source)}`;
}
