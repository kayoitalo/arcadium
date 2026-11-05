"use client";
import { useEffect, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { TERRITORY_VERSION, type TerritoryRequest, type RepertoireRestriction } from "@/modules/recommendations/domain/territories";
import { DiscoveryDisclosure } from "./discovery-disclosure";
import styles from "./exploration-doors.module.css";

type Doors = { limited: boolean; doors: Array<{ genre: string; artists: number; examples: string[] }>;
  proposals: Array<{ id: string; version: number; title: string; selection: string; review: string; anchor?: { artistName: string; albumName: string; sourceUrl: string; rationale: string } }> };
export function ExplorationDoors({ busy, onTerritory, onRepertoire }: { busy: boolean;
  onTerritory: (request: TerritoryRequest) => void; onRepertoire: (restriction: RepertoireRestriction) => void }) {
  const [open, setOpen] = useState(false); const [data, setData] = useState<Doors | null>(null);
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0); const [more, setMore] = useState(false);
  const [genre, setGenre] = useState(""); const [minutes, setMinutes] = useState("");
  useEffect(() => {
    if (!open || data) return;
    const controller = new AbortController(); setError(false);
    void privateFetch("/api/discovery-territories", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(); const value = await response.json(); if (!controller.signal.aborted) setData(value);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open, data, attempt]);
  return <div className={styles.doors}>
    <DiscoveryDisclosure id="territory-doors" summary="explorar outro universo →" open={open} onOpenChange={setOpen}>
      <h2>Escolhe o destino. Eu fico por lá.</h2>
      <p>Aqui a porta vem de uma associação do catálogo, em vez da distância das tuas referências. Busco artistas sem reprodução no teu histórico importado. Tags de artista não certificam o gênero de cada gravação.</p>
      {!data && !error && <p role="status">Conferindo as portas disponíveis…</p>}
      {error && <p role="alert">Não consegui conferir o catálogo. <button onClick={() => setAttempt((n) => n + 1)}>tentar novamente</button></p>}
      {data && <>
        {data.doors.length === 0 && <p>O catálogo ainda não sustenta uma porta por gênero. As buscas próximas e o repertório continuam disponíveis.</p>}
        <div className={styles.choices}>{data.doors.slice(0, more ? 24 : 6).map((door) => <button disabled={busy} key={door.genre} onClick={() => onTerritory({ version: TERRITORY_VERSION, genre: door.genre })}>
          <strong>{door.genre} ↗</strong><span>{door.examples.join(" · ")}</span><small>{door.artists} artistas no recorte do catálogo; disponibilidade final pode ser menor.</small>
        </button>)}</div>
        {data.doors.length > 6 && <button onClick={() => setMore((value) => !value)}>{more ? "menos portas" : "ver outras portas"}</button>}
        <p>Fonte: tags de artista do catálogo local, enriquecidas pelo MusicBrainz. Até 200 artistas e 24 tags nesta consulta{data.limited ? "; há catálogo fora deste recorte" : ""}. Sem completar com outro gênero quando faltar cobertura.</p>
        <details><summary>propostas de curadoria, ainda em revisão</summary>
          <p>Estas propostas não são seleções aprovadas nem alteram as portas acima.</p>
          {data.proposals.map((proposal) => <article key={proposal.id}><h3>{proposal.title} · v{proposal.version}</h3>
            {proposal.anchor && <p><a href={proposal.anchor.sourceUrl} target="_blank" rel="noreferrer">{proposal.anchor.artistName} — {proposal.anchor.albumName} ↗</a><br />{proposal.anchor.rationale}</p>}
            <p>{proposal.selection}</p><p>Para revisão: {proposal.review}</p></article>)}
        </details>
      </>}
    </DiscoveryDisclosure>
    <DiscoveryDisclosure id="repertoire-restrictions" summary="selecionar meu repertório com evidência →">
      <h2>Um recorte do que já tocou.</h2>
      <p>Posso usar a classificação do álbum e a duração catalogada. Metadados ausentes ficam de fora; um resultado curto não muda teu pedido.</p>
      <form onSubmit={(event) => { event.preventDefault(); onRepertoire({ ...(genre.trim() ? { albumGenre: genre.trim() } : {}), ...(minutes ? { maxDurationMs: Math.round(Number(minutes) * 60000) } : {}) }); }}>
        <fieldset disabled={busy}><legend>Restrições opcionais</legend>
          <label>Gênero do álbum no catálogo<input value={genre} onChange={(event) => setGenre(event.target.value)} maxLength={80} placeholder="ex.: jazz" /></label>
          <label>Duração máxima da faixa, em minutos<input type="number" min="1" max="60" step="0.5" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>
          <p>Momento, humor, voz e instrumentação: cobertura insuficiente. Esses filtros ainda não estão disponíveis.</p>
          <button type="submit">selecionar com este pedido →</button>
        </fieldset>
      </form>
    </DiscoveryDisclosure>
  </div>;
}
