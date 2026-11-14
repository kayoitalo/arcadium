"use client";

import { Capa } from "@/components/amigo/fala";
import { fullestDay, monthGrid, type MonthCovers } from "@/modules/statistics/domain/month-calendar";
import styles from "./historico.module.css";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const count = (value: number) => value.toLocaleString("pt-BR");
const plays = (value: number) => `${count(value)} ${value === 1 ? "audição" : "audições"}`;

/** "sábado, 7 de novembro", a partir do dia de calendário: sem fuso, o dia já é local. */
export function dayWords(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(new Date(Date.UTC(year, month - 1, date)));
}

/**
 * O mês em capas: um calendário em que cada dia é o disco que mais tocou.
 * É prova em repouso, como as horas do dia: a cor vem só das capas, e o
 * traço dele circula o dia mais cheio. Tocar num dia recorta o registro.
 */
export function MesEmCapas({ data, selected, onSelect, registerPeak, lit }: {
  data: MonthCovers;
  /** O dia que recorta o registro agora, se houver. */
  selected: string | null;
  onSelect: (day: string | null) => void;
  /** O quadrado do dia mais cheio: é ele que o traço circula. */
  registerPeak: (node: HTMLElement | null) => void;
  /** O traço já fechou o círculo: a anotação dele aparece. */
  lit: boolean;
}) {
  const all = monthGrid(data.month, data.today, data.days);
  // o calendário vai até a semana de hoje: o resto do mês ainda não aconteceu e só ocuparia tela
  const todayAt = all.findIndex((cell) => cell.day === data.today);
  const cells = todayAt < 0 ? all : all.slice(0, Math.ceil((todayAt + 1) / 7) * 7);
  const peak = fullestDay(data.days);
  const [year, month] = data.month.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return (
    <figure className={styles.month} aria-label={`${monthName}, dia a dia`}>
      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((name) => <span key={name}>{name}</span>)}
      </div>
      <ol className={styles.days}>
        {cells.map((cell, index) => {
          if (!cell.day) return <li key={`vão-${index}`} aria-hidden="true" />;
          const { entry } = cell;
          if (!entry) {
            return <li key={cell.day} className={styles.day} data-empty="true" data-future={cell.future || undefined}>
              <span className={styles.dayNumber}>{cell.number}</span>
            </li>;
          }
          const isPeak = peak?.day === entry.day;
          const on = selected === entry.day;
          return (
            <li key={cell.day} className={styles.day} data-on={on || undefined}>
              <button type="button" ref={isPeak ? registerPeak : undefined} aria-pressed={on}
                aria-label={`${dayWords(entry.day)}: ${plays(entry.plays)}${entry.album ? `, mais ${entry.album}` : ""}`}
                title={`${dayWords(entry.day)} · ${plays(entry.plays)}${entry.album ? ` · ${entry.album}` : ""}`}
                onClick={() => onSelect(on ? null : entry.day)}>
                <Capa cover={{ url: entry.coverUrl, title: entry.album ?? "·", artist: entry.artist ?? undefined }} label={false} glow={isPeak} />
                <span className={styles.dayNumber}>{cell.number}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <figcaption className={styles.monthCaption}>
        <span>{monthName}, até hoje · cada quadrado é o disco que mais tocou no dia</span>
        {peak && <span className={styles.monthNote} data-lit={lit}>{dayWords(peak.day).split(",")[0]}, {Number(peak.day.slice(8))} · {count(peak.plays)}</span>}
      </figcaption>
    </figure>
  );
}
