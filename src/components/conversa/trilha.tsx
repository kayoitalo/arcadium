"use client";

import { useEffect, useState } from "react";
import { Capa } from "@/components/amigo/fala";
import { Esperando } from "@/components/amigo/esperando";
import { privateFetch } from "@/lib/http/private-fetch";
import { cleanTitle } from "@/lib/music/track-title";
import type { ArtistTrail } from "@/modules/conversation/application/artist-trail";
import styles from "./portrait.module.css";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const label = (month: string) => `${MESES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/**
 * Embaixo do cartaz, a trilha do nome: as audições dele mês a mês, desde a
 * primeira, com a caneta circulando o pico, e as três faixas que mais
 * tocaram. Meses vazios ficam na curva: o tempo em que ele sumiu também conta.
 */
export function TrilhaDoArtista({ name }: { name: string }) {
  const [trail, setTrail] = useState<{ name: string; value: ArtistTrail } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    privateFetch(`/api/portrait/trilha?artista=${encodeURIComponent(name)}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<ArtistTrail>) : Promise.reject(new Error("trilha"))))
      .then((value) => { if (!controller.signal.aborted) setTrail({ name, value }); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [name]);

  if (failed) return null;
  if (!trail || trail.name !== name) return <div className={styles.trilha}><Esperando>Seguindo a trilha de {name}…</Esperando></div>;
  const { months, tracks } = trail.value;
  if (months.length < 2) return null;
  const max = Math.max(1, ...months.map((month) => month.plays));
  const peak = months.findIndex((month) => month.plays === max);
  const width = 600;
  const height = 120;
  const step = width / months.length;
  const bar = Math.max(1.5, Math.min(10, step * 0.66));
  const x = (index: number) => index * step + (step - bar) / 2;
  const y = (plays: number) => height - 4 - (plays / max) * (height - 22);
  const ticks = [0, Math.floor(months.length / 2), months.length - 1];
  return (
    <section className={styles.trilha} aria-label={`A trilha de ${name}`}>
      <p className={styles.trilhaTitulo}>a trilha de {name}, mês a mês</p>
      <svg className={styles.trilhaCurva} viewBox={`0 0 ${width} ${height + 18}`} role="img"
        aria-label={`Audições de ${name} por mês, de ${label(months[0].month)} a ${label(months[months.length - 1].month)}; o pico foi ${label(months[peak].month)}, com ${max}`}>
        <line x1={0} y1={height - 3.5} x2={width} y2={height - 3.5} stroke="var(--fio-2)" />
        {months.map((month, index) => month.plays > 0 && (
          <rect key={month.month} x={x(index)} y={y(month.plays)} width={bar} height={height - 4 - y(month.plays)} fill={index === peak ? "var(--tinta)" : "var(--fio-2)"} />
        ))}
        {/* o pico, circulado pela caneta, com a conta escrita do lado */}
        <ellipse className={styles.trilhaPico} cx={x(peak) + bar / 2} cy={y(max) - 2} rx={bar / 2 + 9} ry={11} pathLength={1} />
        <text x={Math.min(width - 4, x(peak) + bar / 2 + 16)} y={y(max) + 2} textAnchor={x(peak) > width - 140 ? "end" : "start"} className={styles.trilhaNota}>
          {`${max} em ${label(months[peak].month)}`}
        </text>
        {ticks.map((index) => (
          <text key={index} x={x(index) + bar / 2} y={height + 14} textAnchor={index === 0 ? "start" : index === months.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--tinta-3)">
            {label(months[index].month)}
          </text>
        ))}
      </svg>
      {tracks.length > 0 && (
        <ol className={styles.trilhaFaixas}>
          {tracks.map((track) => (
            <li key={track.track}>
              <Capa cover={{ url: track.coverUrl, title: track.album ?? track.track, artist: name }} label={false} className={styles.trilhaCapa} />
              <span><b>{cleanTitle(track.track)}</b>{track.album && <span>{cleanTitle(track.album)}</span>}<small>{track.plays} audições</small></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
