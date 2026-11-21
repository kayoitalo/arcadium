"use client";

import { useState, type Ref } from "react";
import { Capa } from "@/components/amigo/fala";
import { useArtistPhoto } from "@/components/conversa/use-artist-photo";
import { coverProxyUrl } from "@/lib/cover";
import type { YearMonth } from "@/modules/statistics/application/year-review";
import styles from "./teu-ano.module.css";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const count = (value: number) => value.toLocaleString("pt-BR");

/**
 * A fita do ano, no lugar das barrinhas de progresso: o disco que mais tocou
 * em cada mês, de janeiro até agora. O mês de que o capítulo fala acende;
 * os que ainda não chegaram ficam tracejados.
 */
export function FitaDoAno({ months, lit }: { months: YearMonth[]; lit?: number }) {
  return (
    <ol className={styles.fita} aria-label="O disco de cada mês">
      {MESES.map((label, index) => {
        const entry = months.find((item) => item.month === index + 1);
        return (
          <li key={label} data-lit={lit === index + 1 || undefined} data-future={!entry || undefined}
            title={entry?.album ? `${label}: ${entry.album.name}, ${entry.album.artist} · ${count(entry.plays)} audições` : label}>
            {entry?.album
              ? <Capa cover={{ url: entry.album.coverUrl, title: entry.album.name, artist: entry.album.artist }} label={false} className={styles.fitaCapa} />
              : <span className={styles.fitaVazio} />}
            <span className={styles.fitaMes}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** O relógio de 24 horas: uma barra por hora, a mais tocada em tinta, o número dela no centro. */
export function Relogio({ hours, peak, proofRef }: { hours: number[]; peak: number; proofRef: Ref<HTMLElement> }) {
  const max = Math.max(1, ...hours);
  const [cx, cy, inner, outer] = [150, 150, 58, 140];
  return (
    <figure className={styles.relogio}>
      <div className={styles.relogioDial}>
      <svg viewBox="0 0 300 300" role="img" aria-label={`Audições por hora do dia; a mais tocada é ${peak}h`}>
        <circle cx={cx} cy={cy} r={inner - 8} fill="none" stroke="var(--fio-2)" />
        {hours.map((plays, hour) => {
          const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
          const reach = inner + (outer - inner) * (plays / max);
          return (
            <line key={hour} x1={cx + Math.cos(angle) * inner} y1={cy + Math.sin(angle) * inner} x2={cx + Math.cos(angle) * reach} y2={cy + Math.sin(angle) * reach}
              stroke={hour === peak ? "var(--tinta)" : "var(--fio-2)"} strokeWidth={hour === peak ? 8 : 6.5} />
          );
        })}
        {[0, 6, 12, 18].map((hour) => {
          const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
          return <text key={hour} x={cx + Math.cos(angle) * (inner - 22)} y={cy + Math.sin(angle) * (inner - 22) + 4} textAnchor="middle" fontSize="11" fill="var(--tinta-3)">{hour}h</text>;
        })}
      </svg>
      <strong ref={proofRef as Ref<HTMLElement>} className={styles.relogioHora}>{String(peak).padStart(2, "0")}h</strong>
      </div>
      <figcaption>a hora que mais toca</figcaption>
    </figure>
  );
}

/** A régua dos meses: uma barra por mês, a do mês mais cheio em tinta, com o número dele em cima. */
export function ReguaMeses({ plays, month, value, through, proofRef }: { plays: number[]; month: number; value: number; through: number; proofRef: Ref<HTMLElement> }) {
  const max = Math.max(1, ...plays);
  return (
    <figure className={styles.regua}>
      <strong ref={proofRef as Ref<HTMLElement>} className={styles.reguaNumero}>{count(value)}</strong>
      <svg viewBox="0 0 330 170" role="img" aria-label={`Audições por mês; ${MESES[month - 1]} foi o mais cheio`}>
        {plays.map((amount, index) => {
          const x = 6 + index * 27;
          const height = index < through ? Math.max(2, 140 * (amount / max)) : 0;
          return index < through ? (
            <g key={index}>
              <rect x={x} y={150 - height} width={19} height={height} fill={index + 1 === month ? "var(--tinta)" : "var(--fio-2)"} />
              <text x={x + 9.5} y={166} textAnchor="middle" fontSize="10" fill={index + 1 === month ? "var(--tinta)" : "var(--tinta-3)"}>{MESES[index]}</text>
            </g>
          ) : (
            <g key={index}>
              <rect x={x + 0.5} y={122.5} width={18} height={27} fill="none" stroke="var(--fio-2)" strokeDasharray="3 3" />
              <text x={x + 9.5} y={166} textAnchor="middle" fontSize="10" fill="var(--tinta-3)">{MESES[index]}</text>
            </g>
          );
        })}
        <line x1={0} y1={150.5} x2={330} y2={150.5} stroke="var(--fio-2)" />
      </svg>
      <figcaption>audições em {MESES[month - 1]}</figcaption>
    </figure>
  );
}

/** A foto de quem o capítulo conta, do Spotify, quando ela existe; sem foto, nada ocupa o lugar. */
export function FotoDoArtista({ name }: { name: string }) {
  const image = useArtistPhoto(name);
  const photo = image.value?.status === "READY" ? image.value : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  if (!photo) return null;
  return (
    <span className={styles.foto} data-loaded={loaded === photo.imageUrl || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${coverProxyUrl(photo.imageUrl)}&kind=portrait`} alt={`${photo.artistName} — foto do Spotify`} onLoad={() => setLoaded(photo.imageUrl)} />
    </span>
  );
}
