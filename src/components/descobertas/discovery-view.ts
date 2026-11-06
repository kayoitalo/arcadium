/** Discovery presets and a history-only repertoire, without genre/mood
 * guarantees. Curated territory and album journeys remain separate.
 */
import type { DiscoveryIntent } from "@/modules/recommendations/domain/discovery-intent";
export const DISCOVERY_ENTRIES = [
  { id: "near", intent: "DISCOVER", number: "01", title: "Perto do que eu gosto", label: "Ficar por perto",
    description: "Novidades com ligações mais diretas às faixas e artistas que você escuta.", proximity: 85, fame: 75 },
  { id: "connections", intent: "CONNECTIONS", number: "02", title: "Outras conexões", label: "Seguir outras pistas",
    description: "Relações menos diretas, ainda partindo do teu repertório. Pode continuar no mesmo gênero.", proximity: 35, fame: 65 },
  { id: "repertoire", intent: "REPERTOIRE", number: "03", title: "Do meu repertório", label: "Voltar ao repertório",
    description: "Uma seleção do que já tocou no teu histórico. Aqui, novidade não é obrigação.", proximity: 85, fame: 75 },
] as const;

export function discoveryEntryLabel(proximity: number, intent?: DiscoveryIntent | null): string {
  if (intent === "TERRITORY") return "Outro universo, com destino";
  if (intent === "ALBUM") return "Um álbum em ordem";
  if (intent === "REPERTOIRE") return "Do meu repertório";
  return proximity >= 70 ? "Perto do que eu gosto" : proximity <= 45 ? "Outras conexões" : "Do meu jeito";
}

export function intentionLabel(intent: DiscoveryIntent | null): string {
  if (intent === "TERRITORY") return "Outro universo, com destino";
  if (intent === "ALBUM") return "Um álbum em ordem";
  return DISCOVERY_ENTRIES.find((entry) => entry.intent === intent)?.title ?? "Busca anterior";
}
