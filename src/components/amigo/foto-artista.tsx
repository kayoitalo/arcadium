"use client";

import { useState, type ReactNode } from "react";
import { useArtistPhoto } from "@/components/conversa/use-artist-photo";
import { coverProxyUrl } from "@/lib/cover";
import styles from "./amigo.module.css";

/**
 * A foto de um artista, do Spotify, no lugar de uma capa que não existe.
 * Enquanto não chega, ou se não existir, fica o que vier em `fallback`
 * (o selo do disco, normalmente).
 */
export function FotoArtista({ name, className = "", fallback }: { name: string; className?: string; fallback: ReactNode }) {
  const image = useArtistPhoto(name);
  const photo = image.value?.status === "READY" ? image.value : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = Boolean(photo && loaded === photo.imageUrl);
  return (
    <div className={`${styles.fotoArtista} ${className}`}>
      {!ready && fallback}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${coverProxyUrl(photo.imageUrl)}&kind=portrait`} alt={`${photo.artistName} — foto do Spotify`} data-loaded={ready || undefined}
          onLoad={() => setLoaded(photo.imageUrl)} />
      )}
    </div>
  );
}
