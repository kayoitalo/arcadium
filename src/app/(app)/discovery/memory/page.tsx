import { DiscoveryMemory } from "@/components/descobertas/discovery-memory";
import { weeklyEnabled } from "@/modules/recommendations/domain/weekly-journey";
export default function MemoryPage() { return <DiscoveryMemory showWeekly={weeklyEnabled()} />; }
