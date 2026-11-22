import { Capa } from "@/components/amigo/fala";
import { cleanTitle } from "@/lib/music/track-title";
import type { GenreMover } from "@/modules/statistics/application/genre-movers";
import styles from "./mudou.module.css";

const plays = (delta: number) => `${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${Math.abs(delta) === 1 ? "audição" : "audições"}`;

/**
 * Embaixo do gênero citado, quem puxou: os discos dele que mais ganharam
 * (ou perderam) audições de uma janela pra outra. A unidade vai escrita,
 * porque em cima a conta é em porcentagem e aqui é em audições.
 */
export function QuemPuxou({ albums }: { albums: GenreMover[] }) {
  if (albums.length === 0) return null;
  return (
    <ol className={styles.puxou} aria-label="Os discos que puxaram">
      {albums.map((album) => (
        <li key={`${album.artist}|${album.album}`}>
          <Capa cover={{ url: album.coverUrl, title: album.album, artist: album.artist }} label={false} className={styles.puxouCapa} />
          <span className={styles.puxouNome}><b>{cleanTitle(album.album)}</b><span>{album.artist}</span></span>
          <strong data-down={album.delta < 0 || undefined}>{plays(album.delta)}</strong>
        </li>
      ))}
    </ol>
  );
}
