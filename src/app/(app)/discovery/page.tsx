import { Descobertas } from "@/components/descobertas/descobertas";
import { redirect } from "next/navigation";
import { weeklyEnabled, weeklyNarrativeEnabled } from "@/modules/recommendations/domain/weekly-journey";

export default async function DiscoveryPage({ searchParams }: { searchParams: Promise<{ session?: string; collection?: string; semana?: string }> }) {
  const params = await searchParams;
  if (params.collection === "1") redirect("/discovery/collection");
  const session = typeof params.session === "string" && params.session.length <= 200 ? params.session : null;
  const week = typeof params.semana === "string" && /^[0-9a-f-]{36}$/i.test(params.semana) ? params.semana : null;
  return <Descobertas key={session ?? week} initialSessionId={session} initialWeekId={week}
    showWeekly={weeklyEnabled() || Boolean(week)} allowWeeklyNarrative={weeklyNarrativeEnabled() && Boolean(process.env.GEMINI_API_KEY)} />;
}
