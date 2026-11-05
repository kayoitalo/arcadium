"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { Fala, PenLayer } from "@/components/amigo/fala";
import type { PortraitService } from "@/modules/conversation/application/portrait-service";
import styles from "./portrait.module.css";
import { ListeningNote } from "@/components/amigo/listening-note";
import { DiscoveryDisclosure } from "../descobertas/discovery-disclosure";
import { useReducedMotion } from "framer-motion";
import { usePen } from "@/components/amigo/use-pen";
import { band, circle, frame } from "@/components/amigo/gestures";
import { textLines, boxOf } from "@/components/amigo/measure";
import { useArtistPhoto } from "./use-artist-photo";
import { coverProxyUrl } from "@/lib/cover";
type Data = Awaited<ReturnType<PortraitService["load"]>>;
const count = (n: number) => n.toLocaleString("pt-BR");
export function Portrait() {
  const [data, setData] = useState<Data | null>(null); const [topics, setTopics] = useState<Array<{ key: string; headline: string }>>([]);
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0); const [restoring, setRestoring] = useState(false);
  const [visit,setVisit]=useState(0); const [loadedPhoto,setLoadedPhoto]=useState<string|null>(null); const [failedPhoto,setFailedPhoto]=useState<string|null>(null);
  const artistMark=useRef<HTMLSpanElement>(null); const photoRef=useRef<HTMLDivElement>(null); const metricRef=useRef<HTMLElement>(null);
  const [view, setView] = useState<"all" | "recent">("all"); const [chosen, setChosen] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null); const mark = useRef<HTMLSpanElement>(null); const artistHeading = useRef<HTMLHeadingElement>(null); const indexRef = useRef<HTMLDivElement>(null); const signal = useRef(null);
  const reduced = Boolean(useReducedMotion());
  const rows = (view === "all" ? data?.artists : data?.changes) ?? [];
  const selected = rows.find((row) => row.name === chosen) ?? rows[0];
  const lifetime = data?.artists.find((row) => row.name === selected?.name); const recent = data?.changes.find((row) => row.name === selected?.name);
  const image=useArtistPhoto(selected?.name); const photo=image.value?.status==="READY"?image.value:null;
  const missing=image.value?.status==="MISSING"?image.value:null;
  const missingText=missing?.reason==="NOT_CONFIGURED" ? "As fontes de fotos não estão disponíveis neste ambiente." : missing?.reason==="PLACEHOLDER" ? "O Last.fm encontrou o perfil, mas devolveu uma imagem genérica." : missing?.reason==="AMBIGUOUS" ? "Encontrei uma dúvida na identificação. Prefiro deixar a foto de fora." : "A fonte não trouxe uma foto identificada deste artista.";
  const imageKey=selected?.name+":"+(photo?.imageUrl??""); const photoReady=Boolean(photo&&loadedPhoto===imageKey&&failedPhoto!==imageKey);
  const inkKey="portrait:"+view+":"+selected?.name+":"+visit;
  const pen = usePen(stage, (origin) => {
    const gestures: import("@/components/amigo/trace").TraceGesture[] = [];
    if(mark.current){const {lines,size}=textLines(mark.current,origin);const ink=band(lines,size);gestures.push({id:"portrait-title",layer:"under",strokes:ink.strokes,width:ink.width,cap:"butt"});}
    if(artistMark.current){const {lines,size}=textLines(artistMark.current,origin);const ink=band(lines,size);gestures.push({id:inkKey+":name",layer:"under",strokes:ink.strokes,width:ink.width,cap:"butt"});}
    if(photoReady&&photoRef.current)gestures.push({id:inkKey+":photo",layer:"over",strokes:[frame(boxOf(photoRef.current,origin),7)],width:1.8,cap:"round"});
    if(metricRef.current)gestures.push({id:inkKey+":count",layer:"over",strokes:[circle(boxOf(metricRef.current,origin),inkKey,9)],width:1.8,cap:"round"});
    return {gestures,notes:[],wave:null};
  }, inkKey+":"+photoReady);
  function choose(name:string){setChosen(name);setVisit(n=>n+1);if(window.matchMedia("(max-width:700px)").matches)requestAnimationFrame(()=>{artistHeading.current?.focus({preventScroll:true});artistHeading.current?.scrollIntoView({block:"start",behavior:reduced?"instant":"smooth"});});}
  useEffect(() => {
    const controller = new AbortController(); setError(false);
    void Promise.all([privateFetch("/api/portrait", { signal: controller.signal }), privateFetch("/api/editorial", { signal: controller.signal })])
      .then(async ([portrait, editorial]) => { if (!portrait.ok || !editorial.ok) throw new Error("portrait");
        const [report, memory] = await Promise.all([portrait.json(), editorial.json()]);
        if (!controller.signal.aborted) { setData(report); setTopics(memory.topics); }
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  const restore = async (key: string) => {
    if (restoring) return; setRestoring(true);
    try { const response = await privateFetch("/api/editorial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, action: "RESTORE" }) });
      if (!response.ok) throw new Error("restore"); setTopics((rows) => rows.filter((row) => row.key !== key));
    } catch { setError(true); } finally { setRestoring(false); }
  };
  return <div ref={stage} className={styles.portrait}>
    <header className={styles.intro}><div><p className={styles.eyebrow}>teu retrato / um caderno de retornos</p>
      <Fala level={1} headline="O que permanece no teu fone." mark={["teu fone"]} markRef={mark} marked={pen.started.has("portrait-title")}
        narrative="Tem nomes que atravessam o tempo. Outros estão tomando conta dos últimos dias. Dá uma olhada em quem aparece por aqui." />
      <nav><Link href="/overview">voltar à conversa →</Link><Link href="/history">abrir histórico de reprodução →</Link></nav>
    </div><ListeningNote label="fui pelas tuas escutas"><p>Eu reuni os retornos que ficaram registrados. Escolhe um nome abaixo para chegar mais perto.</p><Link href="/discovery/memory">tuas descobertas e respostas →</Link></ListeningNote></header>
    {error && <p role="alert">Não consegui atualizar o retrato ou guardar tua escolha. <button onClick={() => setAttempt((v) => v + 1)}>tentar novamente</button></p>}
    {!data && !error && <ListeningNote><p role="status">Reunindo o que ficou…</p></ListeningNote>}
    {data && <>
      {!data.total ? <p>Ainda não há reproduções importadas para formar teu retrato. <Link href="/settings">conectar teu histórico →</Link></p> : <>
        <div className={styles.caption}><span>{count(data.total)} reproduções no histórico importado</span><span>reunido em {new Date(data.asOf).toLocaleString("pt-BR", { timeZone: data.timezone })}</span></div>
        <div className={styles.viewSwitch} aria-label="Perspectiva do retrato">
          <button aria-pressed={view === "all"} onClick={() => {if(view!=="all"){setView("all");setChosen(null);setVisit(n=>n+1);}}}>01 <strong>ao longo do caminho</strong><small>os retornos no histórico</small></button>
          <button aria-pressed={view === "recent"} onClick={() => {if(view!=="recent"){setView("recent");setChosen(null);setVisit(n=>n+1);}}}>02 <strong>a fase recente</strong><small>dois recortes de 30 dias</small></button>
        </div>
        <section className={styles.spread} aria-label={view === "all" ? "Artistas do histórico" : "Artistas da fase recente"}>
          <div className={styles.index} ref={indexRef} id="portrait-artists"><p className={styles.eyebrow}>{view === "all" ? "quem aparece ao longo do caminho" : "o agora, com o antes ao lado"}</p>
            <ol>{rows.map((artist, index) => <li key={artist.name}><button aria-pressed={selected?.name === artist.name} onClick={() => choose(artist.name)}>
              <span>{String(index + 1).padStart(2,"0")}</span><strong>{artist.name}</strong><span aria-hidden="true">↗</span>
            </button></li>)}</ol>
            <p className={styles.note}>{view === "all" ? "Até vinte artistas com mais reproduções importadas. Escolha um para abrir suas anotações." : "Até doze destaques por reproduções nos últimos 30 dias, com os 30 anteriores ao lado."}</p>
          </div>
          {selected ? <article className={styles.feature} data-portrait-poster data-photo={Boolean(photo&&failedPhoto!==imageKey)} data-pen-ready={pen.done.has(inkKey+":count") && (!photoReady || pen.done.has(inkKey+":photo"))}>
            <p className={styles.eyebrow}>{view === "all" ? lifetime && lifetime.plays > 1 ? "um nome que voltou" : "um nome registrado" : "duas páginas do mesmo caderno"}</p>
            <h2 ref={artistHeading} tabIndex={-1}><span ref={artistMark} className={styles.artistMark} data-marked={pen.started.has(inkKey+":name")}>{selected.name}</span></h2>
            <figure className={styles.posterPhoto} data-empty={!photo||failedPhoto===imageKey}><div ref={photoRef} className={styles.photoSpace} data-loaded={photoReady}>
              {photo&&failedPhoto!==imageKey ? <img src={coverProxyUrl(photo.imageUrl)!+"&kind=portrait"} alt={photo.artistName+" — foto do "+(photo.provider==="spotify"?"Spotify":"Last.fm")} onLoad={()=>setLoadedPhoto(imageKey)} onError={()=>setFailedPhoto(imageKey)} />
                : <div className={styles.typePoster} aria-hidden="true"><span>um nome<br/>em cartaz.</span><small>o rastro está nas escutas.</small></div>}
            </div><figcaption>{photo&&photoReady ? <>{photo.provider==="spotify" ? <a className={styles.spotifyCredit} href={photo.sourceUrl} target="_blank" rel="noreferrer"><img src="/brands/spotify-logo-white.svg" width="84" height="26" alt="Spotify" />ver {photo.artistName} no Spotify ↗</a> : <a href={photo.sourceUrl} target="_blank" rel="noreferrer">Foto e perfil: {photo.artistName} no Last.fm ↗</a>}<span className={styles.identitySource}>{photo.provider==="spotify"?"Foto do perfil no catálogo · faixa usada só para distinguir homônimos.":"Foto informada pelo Last.fm · perfil correspondente ao nome."}</span></>
              : image.loading||photo&&failedPhoto!==imageKey ? <span role="status">Conferindo uma foto deste artista…</span> : image.error||failedPhoto===imageKey ? <>A foto não veio agora. <button onClick={()=>{setFailedPhoto(null);image.retry();}}>tentar a foto novamente</button></> : <>{missingText}{missing?.profile&&<> <a href={missing.profile.sourceUrl} target="_blank" rel="noreferrer">ver perfil no Last.fm ↗</a></>}</>}</figcaption></figure>
            <button className={styles.backToIndex} onClick={() => { indexRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({preventScroll:true}); indexRef.current?.scrollIntoView({block:"start",behavior:reduced?"instant":"smooth"}); }}>escolher outro nome ↑</button>
            {view === "all" && lifetime && <>
              <div className={styles.numbers}><div><strong>{count(lifetime.plays)}</strong><span>reproduções</span></div><div><strong ref={metricRef}>{count(lifetime.days)}</strong><span>dias distintos</span></div></div>
              <p className={styles.note}>{count(lifetime.plays)} reproduções em {count(lifetime.days)} dias distintos. Dias observados no fuso {data.timezone}.</p>
              <p className={styles.annotation}>↳ esse nome deixou um rastro por aqui.</p>
            </>}
            {view === "recent" && recent && <>
              <div className={styles.comparison} aria-label="Reproduções por período"><div><span>30 dias anteriores</span><strong>{count(recent.previous)}</strong><i style={{width:`${Math.max(recent.previous,recent.current) ? recent.previous/Math.max(recent.previous,recent.current)*100 : 0}%`}} /></div><div><span>últimos 30 dias</span><strong ref={metricRef}>{count(recent.current)}</strong><i style={{width:`${Math.max(recent.previous,recent.current) ? recent.current/Math.max(recent.previous,recent.current)*100 : 0}%`}} /></div></div>
              <p className={styles.note}>{count(recent.current)} agora · {count(recent.previous)} no período anterior. Cada barra usa a mesma escala para este artista.</p>
              <p className={styles.annotation}>↳ o agora, com o antes logo ao lado.</p>
            </>}
            <Link className={styles.follow} href={`/history?search=${encodeURIComponent(selected.name)}`}>seguir as reproduções de {selected.name} →</Link>
          </article> : <p>Nenhum artista neste recorte.</p>}
        </section>
      </>}
      <DiscoveryDisclosure className={styles.topics} summary="Assuntos que você silenciou">
        <p className={styles.note}>Isso muda a conversa, sem alterar teu gosto ou as avaliações de músicas. A escolha acompanha tua conta.</p>
        {!topics.length ? <p>Nenhum assunto silenciado.</p> : <ul>{topics.map((topic) => <li key={topic.key}><p>{topic.headline}</p><button disabled={restoring} onClick={() => void restore(topic.key)}>voltar a esse assunto</button></li>)}</ul>}
      </DiscoveryDisclosure>
    </>}
    <PenLayer pen={pen} signal={signal} reduced={reduced} />
  </div>;
}
