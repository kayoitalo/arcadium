"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { Fala, PenLayer } from "@/components/amigo/fala";
import { band } from "@/components/amigo/gestures";
import { textLines } from "@/components/amigo/measure";
import { usePen } from "@/components/amigo/use-pen";
import { useReducedMotion } from "framer-motion";
import type { AlbumSource, EditionSummary } from "@/modules/recommendations/domain/album-journey";
import { DiscoveryDisclosure } from "./discovery-disclosure";
import styles from "./album-journeys.module.css";

type AlbumReference = { source: AlbumSource; artistName: string; albumName: string };
export function EditionCredit({ album }: { album: EditionSummary }) {
  return <p className={styles.note}>Catálogo Apple · loja {album.storefront} · {album.trackCount} faixas
    {album.releaseDate && <> · data informada: {album.releaseDate.slice(0, 10)}</>}
    {album.explicitness && <> · {album.explicitness === "explicit" ? "conteúdo explícito" : album.explicitness === "cleaned" ? "letras editadas" : "sem letras explícitas"}</>}
    {" · "}<a href={album.sourceUrl} target="_blank" rel="noreferrer">ver esta edição ↗</a></p>;
}
export function AlbumProgress({ album, tracks, index, disabled, onMove }: { album: EditionSummary;
  tracks: { id: string; trackName: string; artistName: string; scoreComponents?: { albumEdition?: { disc: number; number: number } } }[];
  index: number; disabled: boolean; onMove: (index: number) => void }) {
  return <section className={styles.progress} aria-label="Edição escolhida">
    <p className={styles.eyebrow}>um álbum, do começo ao fim</p><h2>{album.albumName}</h2><p>{album.artistName}</p>
    <EditionCredit album={album} />
    <DiscoveryDisclosure summary="ordem das faixas" className={styles.contextDisclosure}>
      <ol className={styles.tracklist}>{tracks.map((track, position) => <li key={track.id}>
        <button disabled={disabled || position === index} aria-current={position === index ? "step" : undefined} onClick={() => onMove(position)}>
          <span>{track.scoreComponents?.albumEdition ? `${track.scoreComponents.albumEdition.disc}.${String(track.scoreComponents.albumEdition.number).padStart(2, "0")}` : position + 1}</span>
          {track.trackName}<small>{track.artistName}</small>
        </button>
      </li>)}</ol>
      <p className={styles.note}>Escolher uma faixa guarda teu lugar. A prévia só começa quando você der o play.</p>
    </DiscoveryDisclosure>
  </section>;
}
export function AlbumJourneys({ initialItem = null, onBegin = (id) => window.location.assign(`/discovery?session=${encodeURIComponent(id)}`) }: {
  initialItem?: string | null; onBegin?: (id: string) => void;
}) {
  const [draft, setDraft] = useState(""); const [query, setQuery] = useState(""); const [attempt, setAttempt] = useState(0);
  const [library, setLibrary] = useState<{ albums: AlbumReference[]; more: boolean } | null>(null);
  const [loading, setLoading] = useState(true); const [libraryError, setLibraryError] = useState(false);
  const [selected, setSelected] = useState<AlbumReference | null>(null); const [editions, setEditions] = useState<EditionSummary[] | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null); const starting = useRef(false);
  const requestKey = useRef<{ signature: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null); const stage = useRef<HTMLDivElement>(null); const mark = useRef<HTMLSpanElement>(null);
  const signal = useRef(null); const reduced = Boolean(useReducedMotion());
  const pen = usePen(stage, (origin) => {
    if (!mark.current) return null; const { lines, size } = textLines(mark.current, origin); const { strokes, width } = band(lines, size);
    return { gestures: [{ id: "album-title", layer: "under", strokes, width, cap: "butt" }], notes: [], wave: null };
  }, "albums");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLibraryError(false); setLibrary(null);
    const params = new URLSearchParams(initialItem ? { item: initialItem } : { q: query });
    void privateFetch(`/api/album-journeys?${params}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(); const data = await response.json(); if (!controller.signal.aborted) setLibrary(data);
    }).catch(() => { if (!controller.signal.aborted) setLibraryError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialItem, query, attempt]);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => { if (editions) heading.current?.focus({ preventScroll: true }); }, [editions]);
  async function findEditions(album: AlbumReference) {
    if (starting.current) return; starting.current = true;
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    setSelected(album); setEditions(null); setError(null); setBusy(true);
    try {
      const response = await privateFetch("/api/album-journeys", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action: "EDITIONS", source: album.source }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Não consegui consultar o catálogo.");
      if (!controller.signal.aborted) setEditions(data.editions);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Não consegui consultar o catálogo."); }
    finally { starting.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  async function begin(album: EditionSummary) {
    if (!selected || starting.current) return; starting.current = true;
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller; setBusy(true); setError(null);
    const signature = JSON.stringify([selected.source, album.collectionId]);
    if (requestKey.current?.signature !== signature) requestKey.current = { signature, key: crypto.randomUUID() };
    try {
      const response = await privateFetch("/api/album-journeys", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action: "BEGIN", source: selected.source, collectionId: album.collectionId, requestKey: requestKey.current.key }) });
      const data = await response.json();
      if (!response.ok) { if (data.code === "GENERATION_FAILED") requestKey.current = null; throw new Error(data.error ?? "Não consegui preparar a jornada."); }
      if (!controller.signal.aborted) onBegin(data.sessionId);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Não consegui preparar a jornada."); }
    finally { starting.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className={styles.albums} ref={stage}>
    <header><p className={styles.eyebrow}>pra ouvir um disco</p>
      <Fala level={1} headline="Tem discos que pedem o caminho inteiro." mark={["caminho inteiro"]} markRef={mark} marked={pen.started.has("album-title")}
        narrative="Escolhe um álbum, confirma a edição e vamos faixa a faixa. Você dá o play e decide quando seguir. Teu lugar fica guardado." />
      <nav><Link href="/discovery">voltar à descoberta →</Link>{initialItem && <Link href="/discovery/albums">ver álbuns do meu histórico →</Link>}</nav>
    </header>
    {!initialItem && <form className={styles.search} onSubmit={(event) => { event.preventDefault(); if (!busy) { setSelected(null); setEditions(null); setError(null); setQuery(draft.trim()); setAttempt((value) => value + 1); } }}>
      <label>Álbum ou artista no teu histórico<input maxLength={120} value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} /></label><button disabled={busy || loading}>procurar</button>
    </form>}
    {loading && <p role="status">Abrindo os álbuns…</p>}
    {libraryError && <p role="alert">Não consegui abrir os álbuns desta conta. <button onClick={() => setAttempt((n) => n + 1)}>tentar novamente</button></p>}
    {library && <><p className={styles.note}>{initialItem ? "O álbum identificado nesta indicação." : "Até 20 álbuns registrados nas tuas reproduções. Use a busca para encontrar outros."} A consulta ao catálogo só começa quando você pedir.</p>
      {!library.albums.length && <p>Nenhum álbum encontrado neste recorte. Tente outro nome ou volte à descoberta.</p>}
      <ul className={styles.library}>{library.albums.map((album) => <li key={JSON.stringify(album.source)}>
        <div><h2>{album.albumName}</h2><p>{album.artistName}</p></div>
        <button disabled={busy} onClick={() => void findEditions(album)}>ver edições →</button>
      </li>)}</ul>{library.more && <p className={styles.note}>Há mais álbuns. Refine o nome na busca.</p>}</>}
    {selected && <section className={styles.editions} aria-label="Edições no catálogo">
      <h2 ref={heading} tabIndex={-1}>A edição de “{selected.albumName}”</h2>
      <p className={styles.note}>O título e o artista precisam corresponder à referência escolhida. Ao vivo, deluxe e remasterizações permanecem identificados. A disponibilidade depende da loja consultada.</p>
      {busy && <p role="status">{editions ? "Confirmando a edição e a ordem completa…" : "Consultando as edições…"}</p>}
      {error && <p role="alert">{error}{!editions && <> <button disabled={busy} onClick={() => void findEditions(selected)}>tentar novamente</button></>}</p>}
      {editions?.length === 0 && <p>Nenhuma edição compatível encontrada. Não vou trocar por outra versão. Você pode escolher outro álbum.</p>}
      <ul className={styles.editionList}>{editions?.map((album) => <li key={album.collectionId}>
        <h3>{album.albumName}</h3><p>{album.artistName}</p><EditionCredit album={album} />
        <button disabled={busy} onClick={() => void begin(album)}>começar com esta edição →</button>
      </li>)}</ul>
    </section>}
    <p className={styles.note}>As prévias são trechos. Não há reprodução automática nem confirmação de que você ouviu o disco completo.</p>
    <PenLayer pen={pen} signal={signal} reduced={reduced} />
  </div>;
}
