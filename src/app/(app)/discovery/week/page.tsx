import { redirect } from "next/navigation";
import { WeeklyDiscovery, WeeklyHistory } from "@/components/descobertas/weekly-discovery";
import { weeklyEnabled, weeklyNarrativeEnabled } from "@/modules/recommendations/domain/weekly-journey";

/** A jornada da semana tem lugar próprio: uma manchete só, as portas e as semanas anteriores. */
export default async function WeekPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const params = await searchParams;
  const week = typeof params.semana === "string" && /^[0-9a-f-]{36}$/i.test(params.semana) ? params.semana : null;
  if (!weeklyEnabled() && !week) redirect("/discovery");
  return <>
    <WeeklyDiscovery key={week ?? "atual"} journeyId={week} allowNarrative={weeklyNarrativeEnabled() && Boolean(process.env.GEMINI_API_KEY)} />
    <WeeklyHistory />
  </>;
}
