import { Descobertas } from "@/components/descobertas/descobertas";

export default async function DiscoveryPage({ searchParams }: { searchParams: Promise<{ session?: string; collection?: string }> }) {
  const params = await searchParams;
  const session = typeof params.session === "string" && params.session.length <= 200 ? params.session : null;
  return <Descobertas key={`${session}:${params.collection === "1"}`} initialSessionId={session} initialCollectionOpen={params.collection === "1"} />;
}
