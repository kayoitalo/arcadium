"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { privateFetch } from "@/lib/http/private-fetch";
import { useReducedMotion } from "framer-motion";
import { Fala, PenLayer, Resposta, Respostas } from "@/components/amigo/fala";
import { band } from "@/components/amigo/gestures";
import { textLines } from "@/components/amigo/measure";
import { usePen } from "@/components/amigo/use-pen";
import { useSelection } from "./selection-provider";
import styles from "./descobertas.module.css";
import paper from "./collection-desk.module.css";
interface ExportResult {
  playlistTitle?: string;
  playlistUrl?: string;
  mode?: string;
  resolvedCount?: number;
  addedCount?: number;
  partial?: boolean;
  totalItems?: number;
  m3uPayload?: string;
  error?: string;
}


const HOW: Record<string,string> = { liked: "curtiu", saved: "guardou" };
export function CollectionDesk() {
  const selection = useSelection(); const kept = selection.items;
  const [exported, setExported] = useState<"running" | ExportResult | null>(null);
  const [exportHidden, setExportHidden] = useState(false);
  const modalOpen = Boolean(exported) && !exportHidden;
  const exportRef = useRef(false); const dialogRef = useRef<HTMLDivElement>(null);
  // a manchete ganha o grifo da caneta, como em toda tela
  const stageRef = useRef<HTMLElement>(null); const markRef = useRef<HTMLSpanElement>(null); const silence = useRef<ArrayLike<number> | null>(null);
  const reduced = Boolean(useReducedMotion());
  const pen = usePen(stageRef, (origin) => {
    if (!markRef.current) return null;
    const { lines, size } = textLines(markRef.current, origin);
    if (lines.length === 0) return null;
    const { strokes, width } = band(lines, size);
    return { gestures: [{ id: "depois", layer: "under", strokes, width, cap: "butt" }], wave: null, notes: [] };
  }, "pra-depois");
  const exportKept = async () => {
    if (exportRef.current || kept.length === 0) return;
    exportRef.current = true;
    setExportHidden(false);
    setExported("running");
    try {
      const response = await privateFetch("/api/spotify/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: kept.map((item) => ({ trackName: item.trackName, artistName: item.artistName })) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "A exportação falhou.");
      setExported(payload.data as ExportResult);
    } catch (cause) {
      setExported({ error: cause instanceof Error ? cause.message : "A exportação falhou." });
    } finally {
      exportRef.current = false;
    }
  };

  const downloadM3u = (result: ExportResult) => {
    const blob = new Blob([result.m3uPayload ?? ""], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.playlistTitle ?? "arcadium"}.m3u`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const header = document.getElementById("arcadium-header");
    const headerWasInert = header?.inert;
    const navigation = document.getElementById("discovery-navigation"); const navigationWasInert = navigation?.inert;
    if (navigation) navigation.inert = true;
    if (header) header.inert = true;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setExportHidden(true); }
      if (event.key !== "Tab") return;
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]');
      if (!elements?.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (header) header.inert = headerWasInert ?? false;
      if (navigation) navigation.inert = navigationWasInert ?? false;
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [modalOpen]);


  const result = exported && exported !== "running" ? exported : null;
  return <section ref={stageRef} className={paper.desk}><div inert={modalOpen}>
    <header className={paper.header}><div><Fala level={1} headline="Isso aqui ficou pra depois." mark={["pra depois"]} markRef={markRef} marked={pen.started.has("depois")}
      narrative="O que você curtiu ou quis guardar. Tirar daqui não apaga o que você me contou." /></div></header>
    {/* o número e o que dá pra fazer com ele na mesma linha: levar pro Spotify é a ação da tela */}
    <div className={paper.counter}><strong>{kept.length.toString().padStart(2,"0")}</strong><span>{kept.length === 1 ? "faixa separada" : "faixas separadas"}</span>
      {kept.length > 0 && <Respostas inline label="Levar"><Resposta primary onClick={() => void exportKept()}>levar {kept.length} pro Spotify</Resposta></Respostas>}</div>
    {selection.error && <p role="alert">{selection.error} <button className={styles.textButton} onClick={() => void selection.refresh()}>atualizar coleção</button></p>}
          {!selection.ready && !selection.error && <p role="status">Abrindo tua coleção…</p>}
          {selection.localItems.length > 0 && <p className={styles.mapNote}>Há {selection.localItems.length} faixas na lista antiga deste navegador. <button className={styles.textButton} disabled={selection.syncing || !selection.ready} onClick={() => void selection.importLocal()}>trazer para a conta</button></p>}
          {exported && exportHidden && <p className={styles.quiet} role="status">
            {exported === "running" ? "Levando tua lista pro Spotify… " : "A última exportação terminou. "}
            <button type="button" className={styles.remove} onClick={() => setExportHidden(false)}>ver {exported === "running" ? "andamento" : "resultado"}</button>
          </p>}
          {kept.length === 0 ? (
            <p className={styles.quiet}>O que você curtir ou guardar fica aqui, pra levar pro Spotify.</p>
          ) : (
            <>
              <ol className={styles.kept}>
                {kept.map((item) => (
                  <li key={item.id}>
                    <span className={styles.keptTrack}>
                      {item.trackName} <span className={styles.keptHow}>{item.artistName}</span>
                    </span>
                    <span className={styles.keptHow}>{HOW[item.action]}</span>
                    <button type="button" className={styles.remove} disabled={selection.syncing} onClick={() => void selection.remove(item)} aria-label={`Remover ${item.trackName} da lista`}>remover</button>
                  </li>
                ))}
              </ol>
              <a className={styles.textButton} href="/api/collection?download=1">baixar a lista em JSON</a>
            </>
          )}

  </div>
      <PenLayer pen={pen} signal={silence} reduced={reduced} />
      {modalOpen && createPortal(
        <div className={styles.overlay}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="levar-titulo" className={styles.dialog}>
            <h2 id="levar-titulo">
              {exported === "running"
                ? "Levando pro Spotify…"
                : result?.error
                  ? "Não deu pra levar."
                  : `Achei ${result?.resolvedCount ?? 0} de ${result?.totalItems ?? kept.length}.`}
            </h2>
            {exported === "running" && <p>Tô procurando cada uma no catálogo do Spotify.</p>}
            {result?.error && <p data-kind="erro">{result.error}</p>}
            {result && !result.error && (
              <p>
                {result.mode === "SPOTIFY_API"
                  ? result.partial
                    ? `A playlist foi criada, mas só ${result.addedCount ?? 0} faixas foram adicionadas. Parte do envio falhou.`
                    : "A playlist já tá na tua conta."
                  : "Baixa a lista e abre no teu player, ou conecta o Spotify em ajustes pra eu criar a playlist direto."}
              </p>
            )}
            <Respostas inline label="Depois de levar">
              {result?.playlistUrl && <Resposta href={result.playlistUrl}>abrir no Spotify</Resposta>}
              {result?.m3uPayload && <Resposta onClick={() => downloadM3u(result)}>baixar .m3u</Resposta>}
              <Resposta onClick={() => setExportHidden(true)}>fechar</Resposta>
            </Respostas>
          </div>
        </div>, document.body
      )}
  </section>;
}
