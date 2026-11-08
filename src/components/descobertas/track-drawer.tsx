"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { ListeningCues } from "./listening-cues";
import { TrackContext } from "./track-context";
import styles from "./descobertas.module.css";

type Tab = "contexto" | "reparar" | "disco";

/**
 * "Sobre essa faixa": o que antes eram três blocos empilhados embaixo da
 * escuta. Cada aba só consulta a fonte quando é aberta.
 */
export function TrackDrawer({ itemId, albumName, mediaReady, albumHref }: {
  itemId: string; albumName: string | null; mediaReady: boolean;
  /** O disco desta indicação, quando faz sentido seguir por ele. */
  albumHref?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("contexto");
  const base = useId();
  const tabs: Array<[Tab, string]> = [["contexto", "um pouco de contexto"], ["reparar", "o que reparar"]];
  if (albumHref) tabs.push(["disco", "o disco"]);
  return <div className={styles.drawer}>
    <div role="tablist" aria-label="Sobre essa faixa" className={styles.drawerTabs}>
      {tabs.map(([id, label]) => <button key={id} type="button" role="tab" id={`${base}-${id}`} aria-selected={tab === id}
        aria-controls={`${base}-painel`} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <div role="tabpanel" id={`${base}-painel`} aria-labelledby={`${base}-${tab}`} className={styles.drawerBody}>
      {tab === "contexto" && <TrackContext key={`context:${itemId}`} itemId={itemId} albumName={albumName} />}
      {tab === "reparar" && <ListeningCues key={`cues:${itemId}`} itemId={itemId} mediaReady={mediaReady} />}
      {tab === "disco" && albumHref && <div>
        <p className={styles.drawerLead}>{albumName ? `${albumName}, inteiro e em ordem.` : "O disco inteiro, em ordem."}</p>
        <p className={styles.drawerNote}>Eu confiro a versão antes de começar.</p>
        <Link className={styles.textButton} href={albumHref}>ouvir o álbum desta indicação →</Link>
      </div>}
    </div>
  </div>;
}
