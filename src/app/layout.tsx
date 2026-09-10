import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Serif, Martian_Mono } from "next/font/google";
import "./globals.css";

/**
 * Três vozes, três trabalhos.
 *
 * Bricolage Grotesque é variável em largura: a mesma fonte condensa até
 * 76 na marca e nas manchetes (letra de caixote de disco) e abre até 100
 * no texto de interface. É de onde vem a identidade — não é Inter.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
  variable: "--font-display",
});

/** A voz de contracapa: o que comenta o que os números medem. */
const liner = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-liner",
});

/** Rótulo de arquivo, número de matriz, hora, percentual. */
const data = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-data",
});

export const metadata: Metadata = {
  title: "Grooveyard — arquivo de escuta",
  description:
    "O cemitério dos seus discos: cada audição catalogada, medida e prensada em ficha de arquivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${display.variable} ${liner.variable} ${data.variable} font-sans min-h-screen bg-background text-text-primary antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
