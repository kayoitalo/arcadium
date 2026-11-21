"use client";

import { useEffect, useState } from "react";
import { Visto } from "@/components/amigo/visto";
import { privateFetch } from "@/lib/http/private-fetch";
import styles from "./ajustes.module.css";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIA = 86_400_000;

export interface FichaSync {
  username: string | null;
  lastSyncedAt: string | null;
  failed: boolean;
}

/** Em dia é ter buscado nos últimos dois dias sem erro na última busca. */
export function emDia(sync: FichaSync, now = Date.now()): boolean {
  if (!sync.lastSyncedAt || sync.failed) return false;
  return now - new Date(sync.lastSyncedAt).getTime() < 2 * DIA;
}

/**
 * A ficha do caderno: desde quando ele anota, quantas audições já são e
 * como está a busca no Last.fm. O visto da caneta marca o que está em dia;
 * o risco, o que falhou.
 */
export function FichaDoCaderno({ sync }: { sync: FichaSync | null }) {
  const [desde, setDesde] = useState<{ since: string | null; total: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    privateFetch("/api/history?limit=10", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ since: string | null; totalItems: number }>) : null))
      .then((page) => { if (page && !controller.signal.aborted) setDesde({ since: page.since, total: page.totalItems }); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const since = desde?.since ? new Date(desde.since) : null;
  const ok = sync ? emDia(sync) : false;
  return (
    <dl className={styles.ficha}>
      <div>
        <dt>anotando desde</dt>
        <dd>{since ? `${since.getDate()} de ${MESES[since.getMonth()]} de ${since.getFullYear()}` : "—"}</dd>
      </div>
      <div>
        <dt>audições anotadas</dt>
        <dd>{desde ? desde.total.toLocaleString("pt-BR") : "—"}</dd>
      </div>
      <div>
        <dt>Last.fm</dt>
        <dd data-failed={sync?.failed || undefined}>
          {ok && <Visto />}
          {!sync?.username ? "não conectado" : sync.lastSyncedAt
            ? `${sync.username} · buscou ${new Date(sync.lastSyncedAt).toLocaleString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
            : `${sync.username} · ainda não buscou`}
        </dd>
      </div>
    </dl>
  );
}
