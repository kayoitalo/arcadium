"use client";
import { useEffect, useState } from "react";
import { Capa } from "@/components/amigo/fala";
import type { FreshRelease } from "@/modules/listening/domain/fresh-releases";
import styles from "./descobertas.module.css";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dia = (date: string) => `${Number(date.slice(8, 10))} ${MES[Number(date.slice(5, 7)) - 1] ?? ""}`;

/**
 * O que saiu nas últimas duas semanas de quem você ouve, na porta do
 * Descobrir: antes de procurar gente nova, o que a gente que você já gosta
 * acabou de lançar. Cada capa abre a busca no Spotify. Sem nada, não aparece.
 */
export function SaiuAgora() {
  const [releases, setReleases] = useState<FreshRelease[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/fresh-releases", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { releases: [] }))
      .then((payload: { releases?: FreshRelease[] }) => setReleases(payload.releases ?? []))
      .catch(() => { if (!controller.signal.aborted) setReleases([]); });
    return () => controller.abort();
  }, []);
  if (!releases?.length) return null;
  return (
    <section className={styles.saiu} aria-label="Lançamentos de quem você ouve">
      <p className={styles.saiuRotulo}>saiu agora, de quem você ouve</p>
      <ol className={styles.saiuLista}>
        {releases.slice(0, 6).map((release) => (
          <li key={`${release.artist}|${release.title}`}>
            <a href={`https://open.spotify.com/search/${encodeURIComponent(`${release.artist} ${release.title}`)}`} target="_blank" rel="noopener noreferrer"
              title={`${release.title}, de ${release.artist} · ${release.plays} audições de ${release.matchedArtist} no último ano`}>
              <Capa cover={{ url: release.coverUrl, title: release.title, artist: release.artist }} label={false} className={styles.saiuCapa} />
              <strong>{release.title}</strong>
              <span className={styles.saiuQuem}>{release.artist}</span>
              <span className={styles.saiuQuando}>{release.kind === "outro" ? "" : `${release.kind} · `}{dia(release.date)}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
