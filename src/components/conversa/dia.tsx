import type { Dia } from "@/components/amigo/use-fita";
import styles from "./conversa.module.css";

/**
 * O cabeçalho do dia, em cima do fio: a data, quanto tocou de ontem pra cá,
 * a última audição e a fita das capas desse tempo. Só o que foi observado;
 * sem nada tocado, fica só a data.
 */
export function DiaDeHoje({ dia }: { dia: Dia }) {
  const plays = dia.plays === 0 ? null : `${dia.atLeast ? "mais de " : ""}${dia.plays.toLocaleString("pt-BR")} ${dia.plays === 1 ? "audição" : "audições"}`;
  return (
    <header className={styles.dia}>
      <div className={styles.diaTopo}>
        <p className={styles.diaData}><span data-dia>{dia.date}</span></p>
        {plays && dia.last && (
          <p className={styles.diaConta}>
            de ontem pra cá · <b>{plays}</b> · a última às <b>{dia.last.time}</b>, {dia.last.track}
          </p>
        )}
        {!plays && dia.last && (
          <p className={styles.diaConta}>
            nada tocou de ontem pra cá · a última foi <b>{dia.last.day}, {dia.last.time}</b>, {dia.last.track}
          </p>
        )}
      </div>
      {dia.capas.length > 0 && (
        <ol className={styles.diaFita} aria-label="O que tocou de ontem pra cá">
          {dia.capas.map((capa) => (
            <li key={capa.key} title={capa.caption}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capa.coverUrl} alt={capa.caption} loading="lazy" />
            </li>
          ))}
        </ol>
      )}
    </header>
  );
}
