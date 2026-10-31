/** These are entry points to the current discovery engine, not genre/mood
 * guarantees. Repertoire selection and curated radical journeys are separate.
 */
export const DISCOVERY_ENTRIES = [
  { id: "near", number: "01", title: "Perto do que eu gosto", label: "Ficar por perto",
    description: "Novidades com ligações mais diretas às faixas e artistas que você escuta.", proximity: 85, fame: 75 },
  { id: "connections", number: "02", title: "Outras conexões", label: "Seguir outras pistas",
    description: "Relações menos diretas, ainda partindo do teu repertório. Pode continuar no mesmo gênero.", proximity: 35, fame: 65 },
] as const;

export function discoveryEntryLabel(proximity: number): string {
  return proximity >= 70 ? "Perto do que eu gosto" : proximity <= 45 ? "Outras conexões" : "Do meu jeito";
}
