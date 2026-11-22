/**
 * A distância entre duas audições, do jeito que se mede numa planta: curta
 * e exata. "logo em seguida", "8 min", "2h30", "3 dias".
 */
export function gapLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return "logo em seguida";
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  if (total < 24 * 60) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
  }
  const days = Math.round(total / (24 * 60));
  return days === 1 ? "1 dia" : `${days} dias`;
}
