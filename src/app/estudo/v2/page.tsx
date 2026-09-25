import type { Metadata } from "next";
import { loadStudyMoments } from "../moments";
import { Fio } from "./fio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Arcadium · estudo v2",
  description: "Estudo de linguagem v2: o dado fica em repouso na tela e o amigo acende o que importa.",
};

/**
 * A segunda versão do estudo, ao lado da primeira para comparar no mesmo
 * preview: a conversa vira um fio que se rola, a prova fica sempre na tela
 * e o gesto do amigo é exato em vez de tremido.
 */
export default async function EstudoV2Page() {
  const moments = await loadStudyMoments();
  return <Fio moments={moments} />;
}
