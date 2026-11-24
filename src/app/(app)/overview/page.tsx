"use client";

import { deadline } from "@/lib/http/deadline";
import { privateFetch } from "@/lib/http/private-fetch";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/amigo/aviso";
import { Resposta } from "@/components/amigo/fala";
import { Conversa } from "@/components/conversa/conversa";
import { useFita } from "@/components/amigo/use-fita";
import { DiaDeHoje } from "@/components/conversa/dia";
import { DiscoveryRecall, useDiscoveryRecall } from "@/components/descobertas/discovery-recall";
import type { ConversationView } from "@/modules/conversation/domain/conversation.types";

/** Enquanto ele escreve a primeira leitura, a tela pergunta de novo nesse ritmo… */
const POLL_MS = 10_000;
/** …até uns três minutos: depois disso ele admite a demora em vez de pedir mais um minuto pra sempre. */
const POLL_LIMIT = 18;
/** Uma resposta só da conversa não passa disso; depois, é a mesma demora de cima. */
const REQUEST_MS = 45_000;

type State = { status: "loading" } | { status: "error" } | { status: "slow" } | { status: "ready"; view: ConversationView };

/**
 * A tela inicial é a conversa. Número só aparece como prova do que ele
 * diz; o resto — espera, primeira leitura, falta de histórico, erro — é
 * ele avisando, na mesma voz.
 */
function ConversationBody() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // a retomada e as respostas do fim leem o mesmo estado da descoberta
  const recall = useDiscoveryRecall();
  // enquanto a conversa chega, ele folheia o que tocou por último
  // e o mesmo histórico recente vira o cabeçalho do dia, em cima do fio
  const { fita, later, dia, settled, failed, retry } = useFita();

  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;
    let polls = 0;
    const load = async () => {
      // uma resposta que nunca chega também é demora: sem prazo, a espera não acabaria
      const limit = deadline(controller.signal, REQUEST_MS);
      try {
        const response = await privateFetch("/api/conversation", { signal: limit.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`conversa ${response.status}`);
        const view = (await response.json()) as ConversationView;
        limit.done();
        if (view.writing && polls >= POLL_LIMIT) { setState({ status: "slow" }); return; }
        setState({ status: "ready", view });
        if (view.writing) { polls += 1; timer = window.setTimeout(load, POLL_MS); }
      } catch {
        limit.done();
        if (limit.expired()) setState({ status: "slow" });
        else if (!controller.signal.aborted) setState({ status: "error" });
      }
    };
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [attempt]);

  if (state.status === "loading") {
    return <Aviso waiting planta="conversa" fita={fita} later={later ?? undefined} headline="Peraí, tô ouvindo aqui." />;
  }

  if (state.status === "slow") {
    return (
      <Aviso headline="Tá demorando mais que o normal." narrative="Ainda não consegui escrever a primeira leitura. Tento de novo quando você pedir, ou na próxima vez que abrir.">
        <Resposta onClick={() => { setState({ status: "loading" }); setAttempt((current) => current + 1); }}>tenta de novo</Resposta>
        <Resposta href="/history">ver tudo que tocou</Resposta>
      </Aviso>
    );
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
        narrative="Teu histórico já tá aqui. Dá um minuto que eu já volto com a primeira."
      />
    );
  }

  if (view.moments.length === 0) {
    if (view.quiet) return <Aviso headline="Os assuntos ficaram silenciados." narrative="Você pode escolher quais voltam à conversa no teu retrato.">
      <Resposta href="/portrait">rever assuntos silenciados</Resposta><Resposta href="/discovery">seguir descobrindo</Resposta></Aviso>;
    return (
      <Aviso
        headline="Nada que eu consiga provar ainda."
        narrative="Ainda não achei nada que o teu histórico confirme. Não vou te contar o que não consigo mostrar."
      >
        <Resposta href="/history">ver tudo que tocou</Resposta>
      </Aviso>
    );
  }

  return (
    <Conversa
      moments={view.moments}
      // a data fica sempre: enquanto o histórico não vem, guarda o lugar; se ele falhar, diz e deixa tentar de novo
      masthead={<DiaDeHoje dia={dia} failed={settled && failed} onRetry={retry} />}
      epilogue={<DiscoveryRecall recall={recall} />}
      // a retomada logo acima já tem "retomar esse caminho" e "ver o que ficou pra depois":
      // no pé, só o caminho genérico quando ela não tem nada a mostrar
      endReplies={recall.status === "ready" && !recall.empty ? <></> : <Resposta href="/discovery">seguir descobrindo</Resposta>}
    />
  );
}

export default function ConversaPage() { return <ConversationBody />; }
