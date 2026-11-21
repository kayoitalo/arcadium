import { useId } from "react";

/** A cor do selo sai do nome: sempre a mesma pro mesmo disco, e sóbria no papel escuro. */
export function seloHue(name: string): number {
  let hue = 0;
  for (const char of name) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}

/**
 * Quando não há capa, o disco mostra o selo: sulcos, o nome em volta do
 * centro, o artista embaixo, o furo. Fica no lugar de toda caixa cinza com
 * nome escrito dentro. Em miniatura (`small`), sem texto em volta: só a
 * inicial no centro, que é o que cabe.
 */
export function Selo({ title, artist, small = false, className }: { title: string; artist?: string | null; small?: boolean; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hue = seloHue(`${artist ?? ""}|${title}`);
  const top = title.length > 26 ? `${title.slice(0, 25)}…` : title;
  const bottom = artist && artist.length > 30 ? `${artist.slice(0, 29)}…` : artist ?? "";
  return (
    <svg className={className} viewBox="0 0 200 200" role="img" aria-label={artist ? `${title}, de ${artist}, sem capa` : `${title}, sem capa`}
      style={{ display: "block", width: "100%", height: "100%" }}>
      <defs>
        <path id={`${id}t`} d="M100 100 m-49 0 a49 49 0 1 1 98 0" />
        <path id={`${id}b`} d="M100 100 m-57 0 a57 57 0 0 0 114 0" />
      </defs>
      <rect width="200" height="200" fill="#121210" />
      <circle cx="100" cy="100" r="96" fill="#0d0d0c" />
      {[90, 84, 79, 75, 71].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#1f1f1d" strokeWidth="1" />)}
      <path d="M100 8 a92 92 0 0 1 68 30" fill="none" stroke="rgba(242,239,231,.06)" strokeWidth="10" strokeLinecap="round" />
      <circle cx="100" cy="100" r="64" fill={`hsl(${hue} 30% 32%)`} />
      <circle cx="100" cy="100" r="64" fill="none" stroke={`hsl(${hue} 28% 44%)`} strokeWidth="1" />
      {small ? (
        <text x="100" y="114" textAnchor="middle" fontSize="44" fill="#f2efe7" style={{ fontVariationSettings: '"wdth" 70, "wght" 800' }}>
          {(title.trim()[0] ?? "·").toUpperCase()}
        </text>
      ) : (
        <>
          <text fontSize="12.5" fill="#f2efe7" style={{ fontVariationSettings: '"wdth" 72, "wght" 800', letterSpacing: ".05em" }}>
            <textPath href={`#${id}t`} startOffset="50%" textAnchor="middle">{top.toUpperCase()}</textPath>
          </text>
          {bottom && (
            <text fontSize="9.5" fill="rgba(242,239,231,.78)" style={{ fontVariationSettings: '"wdth" 90, "wght" 600' }}>
              <textPath href={`#${id}b`} startOffset="50%" textAnchor="middle">{bottom}</textPath>
            </text>
          )}
          <text x="100" y="121" textAnchor="middle" fontSize="7.5" fill="rgba(242,239,231,.55)" style={{ fontVariationSettings: '"wdth" 82, "wght" 700', letterSpacing: ".12em" }}>
            33⅓ · LADO A
          </text>
        </>
      )}
      <circle cx="100" cy="100" r="4.5" fill="#0b0b0a" />
    </svg>
  );
}
