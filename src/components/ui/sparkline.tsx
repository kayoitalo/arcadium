/**
 * Linha fina de tendência. Não tem eixo nem número: serve para dar
 * forma ao total que está do lado, não para ser lida ponto a ponto.
 * O traço não engorda quando a caixa estica (vector-effect), então a
 * mesma curva serve em qualquer largura.
 */
export function Sparkline({
  values,
  className = "",
  filled = false,
  stroke = "var(--chroma)",
}: {
  values: number[];
  className?: string;
  filled?: boolean;
  stroke?: string;
}) {
  if (values.length < 2) return null;

  // muitos dias em poucos pixels viram ruído: reduz para ~60 colunas
  const step = Math.max(1, Math.ceil(values.length / 60));
  const sampled = values.filter((_, index) => index % step === 0);
  const max = Math.max(...sampled, 1);

  const points = sampled.map((value, index) => {
    const x = (index / (sampled.length - 1)) * 120;
    const y = 32 - (value / max) * 30;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox="0 0 120 34" preserveAspectRatio="none" className={className} aria-hidden>
      {filled && (
        <polyline points={`0,34 ${points.join(" ")} 120,34`} fill="var(--chroma-soft)" stroke="none" />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
