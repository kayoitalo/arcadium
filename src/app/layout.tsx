import type { Metadata } from "next";
import { Archivo, Martian_Mono, Unbounded } from "next/font/google";
import "./globals.css";

/**
 * Archivo é variável em largura: condensa até 78 nas manchetes e nos
 * números, fica em 100 no texto corrido e abre até 112 no nome do
 * artista em foco. Uma família só para tudo que não é medida.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

/** Etiqueta, hora, percentual — e a voz do Gemini. */
const martian = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-martian",
});

/** Só o logotipo usa esta. */
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  title: "Arcadium",
  description: "Um amigo obcecado por música lendo o seu histórico.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // as variáveis das fontes ficam no <html> para os tokens do tema,
  // que vivem em :root, conseguirem resolvê-las
  return (
    <html lang="pt-BR" className={`dark ${archivo.variable} ${martian.variable} ${unbounded.variable}`}>
      <body className="font-sans min-h-screen bg-background text-text-primary antialiased">{children}</body>
    </html>
  );
}
