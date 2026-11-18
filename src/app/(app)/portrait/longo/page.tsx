"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/amigo/aviso";
import { Resposta } from "@/components/amigo/fala";
import { Conversa } from "@/components/conversa/conversa";
import { privateFetch } from "@/lib/http/private-fetch";
import type { ConversationView } from "@/modules/conversation/domain/conversation.types";

/** Enquanto ele escreve a primeira leitura, a tela pergunta de novo nesse ritmo. */
const POLL_MS = 10_000;

type State = { status: "loading" } | { status: "error" } | { status: "ready"; view: ConversationView };

/**
 * O que ele reparou no longo prazo: as leituras de um ano pra cá e de
 * tudo. Mudam pouco, então são escritas uma vez por mês e ficam aqui, no
 * retrato, em vez de repetir o mesmo assunto na conversa da tela inicial.
 */
export default function LongoPrazoPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;
    const load = async () => {
      try {
        const response = await privateFetch("/api/conversation?scope=lasting", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`longo prazo ${response.status}`);
        const view = (await response.json()) as ConversationView;
        setState({ status: "ready", view });
        if (view.writing) timer = window.setTimeout(load, POLL_MS);
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    };
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [attempt]);

  if (state.status === "loading") return <Aviso headline="Peraí, tô puxando da memória." />;

  if (state.status === "error") {
    return (
      <Aviso headline="Me perdi no teu histórico." narrative="Deu erro do meu lado lendo o que você ouviu. Tenta de novo?">
        <Resposta
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((current) => current + 1);
          }}
        >
          tenta de novo
        </Resposta>
        <Resposta href="/portrait">voltar ao retrato</Resposta>
      </Aviso>
    );
  }

  const { view } = state;

  if (view.moments.length === 0) {
    return (
      <Aviso
        headline={view.writing ? "Tô escrevendo o que reparei." : "Do longo prazo, nada novo por enquanto."}
        narrative={
          view.writing
            ? "Essa parte eu escrevo com calma, uma vez por mês. Dá um minuto."
            : "Essa parte eu escrevo uma vez por mês, olhando o ano inteiro. Quando tiver, fica aqui."
        }
      >
        <Resposta href="/portrait">voltar ao retrato</Resposta>
        <Resposta href="/overview">a conversa de agora</Resposta>
      </Aviso>
    );
  }

  return (
    <Conversa
      moments={view.moments}
      ending={{
        headline: "Do longo prazo, é isso.",
        narrative: "Essa parte eu reescrevo uma vez por mês. O que muda de um dia pro outro tá na conversa.",
      }}
      endReplies={
        <>
          <Resposta href="/portrait">voltar ao retrato</Resposta>
          <Resposta href="/overview">a conversa de agora</Resposta>
        </>
      }
    />
  );
}
