import { Descobertas } from "@/components/descobertas/descobertas";
import { redirect } from "next/navigation";

export default async function DiscoveryPage({ searchParams }: { searchParams: Promise<{ session?: string; collection?: string; semana?: string }> }) {
  const params = await searchParams;
  if (params.collection === "1") redirect("/discovery/collection");
  // a semana mudou para a aba própria: links antigos continuam chegando lá
  if (typeof params.semana === "string" && /^[0-9a-f-]{36}$/i.test(params.semana)) redirect(`/discovery/week?semana=${params.semana}`);
  const session = typeof params.session === "string" && params.session.length <= 200 ? params.session : null;
  return <Descobertas key={session ?? "entrada"} initialSessionId={session} />;
}
