import type { Metadata } from "next";
import { Archivo, Instrument_Sans, Martian_Mono, Unbounded } from "next/font/google";
import "./globals.css";

/**
 * Archivo é variável em largura: a mesma fonte condensa até 78 nas
 * manchetes e nos números e abre até 112 no nome do artista em foco.
 * É de onde vem o desenho da tela.
 */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-display",
});

/** A voz que conversa: narrativa, descrições, nomes de faixa. */
const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-body",
});

/** Só o logotipo usa esta. O "oo" de Grooveyard vira dois discos. */
const brand = Unbounded({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-brand",
});

/** Etiqueta, hora, percentual — tudo que é medido. */
const mono = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-data",
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
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} ${brand.variable} font-sans min-h-screen bg-background text-text-primary antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
