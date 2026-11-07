"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { TERRITORY_VERSION, type TerritoryRequest, type RepertoireRestriction } from "@/modules/recommendations/domain/territories";
import { CARTOLA_JOURNEY_HREF } from "@/modules/recommendations/domain/curated-albums";
import styles from "./exploration-doors.module.css";

type Doors = { limited: boolean; doors: Array<{ genre: string; artists: number; examples: string[] }> };

/**
 * Outro universo: ele mostra os destinos que o catálogo sustenta e você
 * escolhe um. Só consulta quando a porta é aberta.
 */
export function TerritoryDoors({ busy, onTerritory }: { busy: boolean; onTerritory: (request: TerritoryRequest) => void }) {
  const [data, setData] = useState<Doors | null>(null);
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0); const [more, setMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setError(false);
    void privateFetch("/api/discovery-territories", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(); const value = await response.json(); if (!controller.signal.aborted) setData(value);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  return <section id="territory-doors" className={styles.panel} aria-label="Escolher outro universo">
    <h2>Escolhe o destino. Eu fico por lá.</h2>
    <p>Artistas desse estilo que ainda não passaram pelo teu fone.</p>
    {!data && !error && <p role="status">Abrindo as portas…</p>}
    {error && <p role="alert">Não consegui abrir as portas agora. <button onClick={() => setAttempt((n) => n + 1)}>tenta de novo</button></p>}
    {data && <>
      {data.doors.length === 0 && <p>Ainda não conheço estilos suficientes no teu catálogo para abrir uma porta. Os outros caminhos continuam aqui.</p>}
      <div className={styles.choices}>{data.doors.slice(0, more ? 24 : 6).map((door) => <button disabled={busy} key={door.genre} onClick={() => onTerritory({ version: TERRITORY_VERSION, genre: door.genre })}>
        <strong>{door.genre}</strong><span>{door.examples.join(" · ")}</span>
      </button>)}</div>
      {data.doors.length > 6 && <button className={styles.more} onClick={() => setMore((value) => !value)}>{more ? "menos destinos" : "mais destinos"}</button>}
    </>}
    <p className={styles.curated}><Link href={CARTOLA_JOURNEY_HREF}>ou um disco inteiro: o samba de Cartola, em ordem →</Link></p>
  </section>;
}

/** O recorte do repertório: gênero do álbum e duração, os dois filtros que o catálogo sustenta. */
export function RepertoireFilter({ busy, onRepertoire }: { busy: boolean; onRepertoire: (restriction: RepertoireRestriction) => void }) {
  const [genre, setGenre] = useState(""); const [minutes, setMinutes] = useState("");
  return <form className={styles.filter} aria-label="Recortar o repertório" onSubmit={(event) => { event.preventDefault(); onRepertoire({ ...(genre.trim() ? { albumGenre: genre.trim() } : {}), ...(minutes ? { maxDurationMs: Math.round(Number(minutes) * 60000) } : {}) }); }}>
    <h3>Ou recorta o que já tocou</h3>
    <fieldset disabled={busy}>
      <label>gênero do disco<input value={genre} onChange={(event) => setGenre(event.target.value)} maxLength={80} placeholder="jazz, samba…" /></label>
      <label>faixas de até<span><input type="number" min="1" max="60" step="0.5" value={minutes} onChange={(event) => setMinutes(event.target.value)} /> min</span></label>
      <button type="submit">voltar ao repertório com esse recorte →</button>
    </fieldset>
  </form>;
}
