"use client";

import { privateFetch } from "@/lib/http/private-fetch";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/amigo/aviso";
import { Resposta } from "@/components/amigo/fala";
import { Conversa } from "@/components/conversa/conversa";
import { DiscoveryRecall } from "@/components/descobertas/discovery-recall";
import type { ConversationView } from "@/modules/conversation/domain/conversation.types";

/** Enquanto ele escreve a primeira leitura, a tela pergunta de novo nesse ritmo. */
const POLL_MS = 10_000;

type State = { status: "loading" } | { status: "error" } | { status: "ready"; view: ConversationView };

/**
 * A tela inicial é a conversa. Número só aparece como prova do que ele
 * diz; o resto — espera, primeira leitura, falta de histórico, erro — é
 * ele avisando, na mesma voz.
 */
function ConversationBody() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;
    const load = async () => {
      try {
        const response = await privateFetch("/api/conversation", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`conversa ${response.status}`);
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

  if (state.status === "loading") {
    return <Aviso waiting headline="Peraí, tô ouvindo aqui." />;
  }

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
      </Aviso>
    );
  }

  const { view } = state;

  if (!view.hasHistory) {
    return (
      <Aviso
        headline="Ainda não ouvi nada teu."
        narrative="Me passa teu Last.fm que eu leio tudo que você já ouviu e volto com o que reparei."
      >
        <Resposta href="/settings">conectar o Last.fm</Resposta>
      </Aviso>
    );
  }

  if (view.writing) {
    return (
      <Aviso
        waiting
        headline="Tô escrevendo o que reparei."
        narrative="Li teu histórico inteiro. Dá um minuto que eu já volto com a primeira."
      />
    );
  }

  if (view.moments.length === 0) {
    if (view.quiet) return <Aviso headline="Os assuntos ficaram silenciados." narrative="Você pode escolher quais voltam à conversa no teu retrato.">
      <Resposta href="/portrait">rever assuntos silenciados</Resposta><Resposta href="/discovery">seguir descobrindo</Resposta></Aviso>;
    return (
      <Aviso
        headline="Nada que eu consiga provar ainda."
        narrative="Eu reparei em umas coisas, mas nenhuma bateu com o teu histórico. Não vou te contar o que não consigo mostrar."
      >
        <Resposta href="/history">ver tudo que tocou</Resposta>
      </Aviso>
    );
  }

  return <Conversa moments={view.moments} epilogue={<DiscoveryRecall />} />;
}

export default function ConversaPage() { return <ConversationBody />; }
