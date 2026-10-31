/** These are entry points to the current discovery engine, not genre/mood
 * guarantees. Repertoire selection and curated radical journeys are separate.
 */
export const DISCOVERY_ENTRIES = [
  { id: "near", number: "01", title: "Perto do que eu gosto", label: "Ficar por perto",
    description: "Faixas e artistas novos, partindo das tuas referências.", proximity: 85, fame: 50 },
  { id: "connections", number: "02", title: "Outras conexões", label: "Seguir outras pistas",
    description: "Dar um passo para fora e encontrar relações menos óbvias.", proximity: 35, fame: 50 },
] as const;

export function discoveryEntryLabel(proximity: number): string {
  return proximity >= 70 ? "Perto do que eu gosto" : proximity <= 45 ? "Outras conexões" : "Do meu jeito";
}
