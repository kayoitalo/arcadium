import type { MetadataRoute } from "next";

/**
 * O Arcadium na tela inicial do celular: o papel escuro e a espiral do
 * traço. O sistema desenha a abertura sozinho com o fundo e o ícone daqui;
 * nenhum dado de quem ouve passa por este arquivo, que é público.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arcadium",
    short_name: "Arcadium",
    description: "Um amigo obcecado por música lendo o seu histórico.",
    lang: "pt-BR",
    start_url: "/overview",
    display: "standalone",
    background_color: "#0b0b0a",
    theme_color: "#0b0b0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
