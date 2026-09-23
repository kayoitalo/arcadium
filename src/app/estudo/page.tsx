import type { Metadata } from "next";
import { Estudo } from "./estudo";
import { loadStudyMoments } from "./moments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Arcadium · estudo",
  description: "Estudo de linguagem: o amigo fala primeiro, o traço aponta a prova.",
};

/**
 * Estudo de linguagem, fora das telas do app: sem cabeçalho, sem abas,
 * sem seletor de período. Serve para julgar a identidade nova contra os
 * sete critérios, com leituras e dados de verdade.
 */
export default async function EstudoPage() {
  const moments = await loadStudyMoments();
  return <Estudo moments={moments} />;
}
