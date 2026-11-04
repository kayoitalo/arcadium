import { Descobertas } from "@/components/descobertas/descobertas";
import { redirect } from "next/navigation";

export default async function DiscoveryPage({ searchParams }: { searchParams: Promise<{ session?: string; collection?: string }> }) {
  const params = await searchParams;
  if (params.collection === "1") redirect("/discovery/collection");
  const session = typeof params.session === "string" && params.session.length <= 200 ? params.session : null;
  return <Descobertas key={session} initialSessionId={session} />;
}
