import { Capa } from "@/components/amigo/fala";
import { genreLabel } from "@/lib/format/genre";
import { cleanTitle } from "@/lib/music/track-title";
import type { GenreMover, GenreMovers } from "@/modules/statistics/application/genre-movers";
import styles from "./mudou.module.css";

function Lado({ title, albums }: { title: string; albums: GenreMover[] }) {
  return (
    <div className={styles.puxouLado}>
      <p className={styles.puxouTitulo}>{title}</p>
      <ol>
        {albums.map((album) => (
          <li key={`${album.artist}|${album.album}`}>
            <Capa cover={{ url: album.coverUrl, title: album.album, artist: album.artist }} label={false} className={styles.puxouCapa} />
            <span className={styles.puxouNome}><b>{cleanTitle(album.album)}</b><span>{album.artist}</span></span>
            <strong data-down={album.delta < 0 || undefined}>{album.delta > 0 ? `+${album.delta}` : `−${Math.abs(album.delta)}`}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Embaixo da pista, quem puxou a mudança: os discos do gênero que subiu e
 * do que caiu, com a diferença em audições entre as duas janelas.
 */
export function QuemPuxou({ movers }: { movers: GenreMovers }) {
  if (!movers.rising && !movers.falling) return null;
  return (
    <section className={styles.puxou} aria-label="Quem puxou a mudança">
      {movers.rising && <Lado title={`subiu · ${genreLabel(movers.rising.genre)}`} albums={movers.rising.albums} />}
      {movers.falling && <Lado title={`caiu · ${genreLabel(movers.falling.genre)}`} albums={movers.falling.albums} />}
    </section>
  );
}
