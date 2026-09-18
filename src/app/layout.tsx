import type { Metadata } from "next";
import { Archivo, DotGothic16, Martian_Mono, Unbounded } from "next/font/google";
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

/**
 * A letra do LCD, e só dela: construída por pontos, como display de
 * matriz. Vem de uma família japonesa, então o acento português sai
 * inteiro — a maioria das fontes de pixel quebra no "ções".
 */
const dotGothic = DotGothic16({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-lcd",
});

/** Etiqueta, hora, percentual — e a voz do Gemini fora da tela. */
const martian = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-martian",
});

/** Só o logotipo usa esta. O "oo" de Grooveyard vira dois discos. */
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  title: "Grooveyard",
  description: "O cemitério dos seus discos: tudo o que você ouviu, medido e desenhado.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // as variáveis das fontes ficam no <html> para os tokens do tema,
  // que vivem em :root, conseguirem resolvê-las
  return (
    <html lang="pt-BR" className={`dark ${archivo.variable} ${martian.variable} ${unbounded.variable} ${dotGothic.variable}`}>
      <body className="font-sans min-h-screen bg-background text-text-primary antialiased">{children}</body>
    </html>
  );
}
