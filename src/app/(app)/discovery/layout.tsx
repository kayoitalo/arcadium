import { DiscoveryNavigationCurrent } from "@/components/descobertas/discovery-navigation";
import { weeklyEnabled } from "@/modules/recommendations/domain/weekly-journey";
export default function DiscoveryLayout({ children }: { children: React.ReactNode }) { return <><DiscoveryNavigationCurrent showWeekly={weeklyEnabled()} />{children}</>; }
