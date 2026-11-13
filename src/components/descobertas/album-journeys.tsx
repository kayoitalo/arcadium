"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { Fala, PenLayer, Capa } from "@/components/amigo/fala";
import { band } from "@/components/amigo/gestures";
import { textLines } from "@/components/amigo/measure";
import { usePen } from "@/components/amigo/use-pen";
import { seeded } from "@/components/amigo/gestures";
import { useCoverTint } from "@/components/amigo/use-cover-tint";
import { inkOn } from "@/lib/cover-tint";
import { useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import type { AlbumSource, EditionSummary } from "@/modules/recommendations/domain/album-journey";
import { CARTOLA_JOURNEY_HREF, findCuratedAlbum, type CurationCredit } from "@/modules/recommendations/domain/curated-albums";
import { DiscoveryDisclosure } from "./discovery-disclosure";
import styles from "./album-journeys.module.css";

type AlbumReference = { source: AlbumSource; artistName: string; albumName: string; coverUrl?: string | null; plays?: number };

/** A partir de quantos discos a estante vira estante: com dois ou três, lombada sozinha não se sustenta. */
const SHELF_FROM = 4;

/**
 * A grossura e a altura de uma lombada. A grossura diz quanto o disco
 * tocou, em relação ao mais ouvido da estante; a altura varia um pouco de
 * disco pra disco, sempre igual para o mesmo disco. Função pura.
 */
export function spineShape(album: { albumName: string; artistName: string; plays?: number }, max: number): { width: number; height: number } {
  const share = max > 0 ? Math.min(1, Math.max(0, (album.plays ?? 0) / max)) : 0;
  return { width: Math.round(28 + share * 26), height: Number((0.78 + seeded(`${album.artistName}|${album.albumName}`)() * 0.22).toFixed(3)) };
}

/**
 * Um disco na estante, de lado: o título em pé, na cor que a capa
 * empresta. Sem capa, a lombada é papel com borda — etiqueta honesta, sem
 * fingir arte. Abrir a lombada é o mesmo "ouvir este disco" de antes.
 */
function Lombada({ album, max, disabled, onOpen }: { album: AlbumReference; max: number; disabled: boolean; onOpen: () => void }) {
  const tint = useCoverTint(album.coverUrl);
  const shape = spineShape(album, max);
  return <button type="button" className={styles.spine} disabled={disabled} aria-expanded={false} onClick={onOpen}
    aria-label={`ouvir este disco: ${album.albumName}, de ${album.artistName}`} title={`${album.albumName} · ${album.artistName}`}
    data-bare={!tint || undefined} data-ink={tint ? inkOn(tint) : undefined}
    style={{ "--lombada": tint ?? undefined, "--grossura": `${shape.width}px`, "--altura": shape.height } as CSSProperties}>
    <span>{album.albumName}</span>
  </button>;
}
export function EditionCredit({ album }: { album: EditionSummary }) {
  return <p className={styles.note}>Catálogo Apple · loja {album.storefront} · {album.trackCount} faixas
    {album.releaseDate && <> · {album.releaseDate.slice(0, 4)}</>}
    {album.explicitness && <> · {album.explicitness === "explicit" ? "conteúdo explícito" : album.explicitness === "cleaned" ? "letras editadas" : "sem letras explícitas"}</>}
    {" · "}<a href={album.sourceUrl} target="_blank" rel="noreferrer">conferir esta versão ↗</a></p>;
}
export function EditorialCredit({ curation }: { curation: CurationCredit }) {
  return <p className={styles.note}>{curation.title} · curadoria v{curation.version}{" · "}
    <a href={curation.sourceUrl} target="_blank" rel="noreferrer">fonte editorial ↗</a></p>;
}
export function AlbumProgress({ album, curation, tracks, index, disabled, onMove }: { album: EditionSummary; curation?: CurationCredit;
  tracks: { id: string; trackName: string; artistName: string; scoreComponents?: { albumEdition?: { disc: number; number: number } } }[];
  index: number; disabled: boolean; onMove: (index: number) => void }) {
  return <section className={styles.progress} aria-label="Edição escolhida">
    <p className={styles.eyebrow}>um disco, do começo ao fim</p><h2>{album.albumName}</h2><p>{album.artistName}</p>
    <EditionCredit album={album} />
    {curation && <EditorialCredit curation={curation} />}
    <DiscoveryDisclosure summary="ordem das faixas" className={styles.contextDisclosure}>
      <ol className={styles.tracklist}>{tracks.map((track, position) => <li key={track.id}>
        <button disabled={disabled || position === index} aria-current={position === index ? "step" : undefined} onClick={() => onMove(position)}>
          <span>{track.scoreComponents?.albumEdition ? `${track.scoreComponents.albumEdition.disc}.${String(track.scoreComponents.albumEdition.number).padStart(2, "0")}` : position + 1}</span>
          {track.trackName}<small>{track.artistName}</small>
        </button>
      </li>)}</ol>
    </DiscoveryDisclosure>
  </section>;
}
export function AlbumJourneys({ initialItem = null, initialCuration = null, onBegin = (id) => window.location.assign(`/discovery?session=${encodeURIComponent(id)}`) }: {
  initialItem?: string | null; initialCuration?: string | null; onBegin?: (id: string) => void;
}) {
  const curation = initialCuration && !initialItem ? findCuratedAlbum(initialCuration) : null;
  const [draft, setDraft] = useState(""); const [query, setQuery] = useState(""); const [attempt, setAttempt] = useState(0);
  const [library, setLibrary] = useState<{ albums: AlbumReference[]; more: boolean } | null>(null);
  const [loading, setLoading] = useState(true); const [libraryError, setLibraryError] = useState(false);
  const [selected, setSelected] = useState<AlbumReference | null>(null); const [editions, setEditions] = useState<EditionSummary[] | null>(null);
  const [versionVisit, setVersionVisit] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null); const starting = useRef(false);
  const requestKey = useRef<{ signature: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null); const stage = useRef<HTMLDivElement>(null); const mark = useRef<HTMLSpanElement>(null);
  const signal = useRef(null); const reduced = Boolean(useReducedMotion());
  const queryInk = `album-query:${selected?.source.kind}:${selected?.source.id}:${versionVisit}`;
  const pen = usePen(stage, (origin) => {
    if (!mark.current) return null; const { lines, size } = textLines(mark.current, origin); const { strokes, width } = band(lines, size);
    const gestures: import("@/components/amigo/trace").TraceGesture[] = [{ id: "album-title", layer: "under", strokes, width, cap: "butt" }];
    if(selected && heading.current){const text=textLines(heading.current,origin);const ink=band(text.lines,text.size);gestures.push({id:queryInk,layer:"under",strokes:ink.strokes,width:ink.width,cap:"butt"});}
    return { gestures, notes: [], wave: null };
  }, queryInk, {settle:220});
  useEffect(() => {
    if (curation) {
      setLibrary({ albums: [{ source: { kind: "curated", id: curation.credit.id }, artistName: curation.artistName, albumName: curation.albumName }], more: false });
      setLibraryError(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController(); setLoading(true); setLibraryError(false); setLibrary(null);
    const params = new URLSearchParams(initialItem ? { item: initialItem } : { q: query });
    void privateFetch(`/api/album-journeys?${params}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(); const data = await response.json(); if (!controller.signal.aborted) setLibrary(data);
    }).catch(() => { if (!controller.signal.aborted) setLibraryError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialItem, curation, query, attempt]);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (!selected) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  }, [selected, reduced]);
  async function findEditions(album: AlbumReference) {
    if (starting.current) return; starting.current = true;
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    setVersionVisit(value => value + 1); setSelected(album); setEditions(null); setError(null); setBusy(true);
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
    <header>
      <Fala level={1} headline="Tem discos que pedem o caminho inteiro." mark={["caminho inteiro"]} markRef={mark} marked={pen.started.has("album-title")}
        narrative={curation ? "Cartola, 1976. O samba na ordem do disco, uma faixa de cada vez." : "Escolhe um disco. Eu confiro a versão e a gente segue na ordem, uma faixa de cada vez."} />
      {(initialItem || curation) && <nav><Link href="/discovery/albums">ver os discos do meu histórico →</Link></nav>}
    </header>
    {curation && <EditorialCredit curation={curation.credit} />}
    {!initialItem && !curation && <form className={styles.search} onSubmit={(event) => { event.preventDefault(); if (!busy) { setSelected(null); setEditions(null); setError(null); setQuery(draft.trim()); setAttempt((value) => value + 1); } }}>
      <label>procurar um disco ou artista que você já ouviu<input maxLength={120} value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} /></label><button disabled={busy || loading}>procurar</button>
      <Link className={styles.curated} href={CARTOLA_JOURNEY_HREF}>ou o samba de Cartola, em ordem →</Link>
    </form>}
    {loading && <p role="status">Abrindo a estante…</p>}
    {libraryError && <p role="alert">Não consegui abrir tua estante agora. <button onClick={() => setAttempt((n) => n + 1)}>tenta de novo</button></p>}
    {library && <>{!curation && <p className={styles.note}>{initialItem ? "O disco dessa indicação." : query ? `O que achei pra “${query}”.` : library.albums.length >= SHELF_FROM ? "Os discos que você mais ouviu. Os mais grossos são os que mais tocaram: puxa um." : "Os discos que você mais ouviu."}</p>}
      {!library.albums.length && <p>Não achei esse disco no que você ouviu. Tenta outro nome.</p>}
      {/* de quatro discos em diante, a estante é de lombadas: a grossura diz quanto tocou. O disco aberto sai da fileira e deita. */}
      <ul className={styles.library} data-shelf={library.albums.length >= SHELF_FROM || undefined}>{library.albums.map((album) => {
        const active = selected?.source.id === album.source.id && selected.source.kind === album.source.kind;
        if (library.albums.length >= SHELF_FROM && !active) return <li key={JSON.stringify(album.source)} data-open={false}>
          <Lombada album={album} max={Math.max(1, ...library.albums.map((row) => row.plays ?? 0))} disabled={busy} onOpen={() => void findEditions(album)} />
        </li>;
        return <li key={JSON.stringify(album.source)} data-open={active}>
          <div className={styles.libraryRow}>
            {album.coverUrl
              ? <Capa cover={{ url: album.coverUrl, title: album.albumName, artist: album.artistName }} className={styles.shelfCover} />
              : <div className={styles.jacket} aria-hidden="true"><i /><b>{album.albumName}</b></div>}
            {/* com ou sem capa, o mesmo desenho: o quadrado e, embaixo, disco e artista */}
            <div className={styles.albumTitle}><h2>{album.albumName}</h2><p>{album.artistName}</p></div>
            <button disabled={busy} aria-expanded={active} aria-controls={active ? "album-versions" : undefined} onClick={() => void findEditions(album)}>ouvir este disco →</button>
          </div>
          {active && <section id="album-versions" className={styles.editions} aria-label="Versões deste álbum" aria-busy={busy}>
            <div className={styles.versionHeading}><h2 ref={heading} data-marked={pen.started.has(queryInk)} tabIndex={-1}>{curation ? "Confere a edição da jornada." : "Qual versão vai pro play?"}</h2><button disabled={busy} onClick={(event) => { const trigger = event.currentTarget.closest("li")?.querySelector<HTMLButtonElement>("[aria-expanded]"); setSelected(null); requestAnimationFrame(() => trigger?.focus()); }}>fechar ↑</button></div>
            <p className={styles.note}>Estúdio, ao vivo, com faixas extras: escolhe a que você quer percorrer.</p>
            {busy && <p className={styles.note} role="status">{editions ? "Conferindo a ordem das faixas…" : "Procurando as versões desse disco…"}</p>}
            {error && <p role="alert">{error}{!editions && <> <button disabled={busy} onClick={() => void findEditions(album)}>tenta de novo</button></>}</p>}
            {editions?.length === 0 && <p className={styles.note}>{curation ? "Essa edição saiu do catálogo por enquanto." : "Não achei uma versão desse disco no catálogo. Tenta outro."}
              {curation && <> <button disabled={busy} onClick={() => void findEditions(album)}>conferir de novo</button></>}</p>}
            <ul className={styles.editionList}>{editions?.map((version) => <li key={version.collectionId}>
              {version.artworkUrl && <Capa cover={{ url: version.artworkUrl, title: version.albumName, artist: version.artistName }} className={styles.editionCover} />}
              <div><h3>{version.albumName}</h3><p>{version.artistName}</p><EditionCredit album={version} />
                <button disabled={busy} onClick={() => void begin(version)}>começar com esta versão →</button></div>
            </li>)}</ul>
          </section>}
        </li>;
      })}</ul>
      {library.more && <p className={styles.note}>Tem mais na estante. Procura pelo nome.</p>}</>}
    <PenLayer pen={pen} signal={signal} reduced={reduced} />
  </div>;
}
