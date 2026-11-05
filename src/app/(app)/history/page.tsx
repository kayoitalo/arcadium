import { Historico } from "@/components/historico/historico";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.slice(0, 120) : "";
  return <Historico key={search} initialSearch={search} />;
}
