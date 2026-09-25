import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

/**
 * Uma família só. A Archivo é variável em largura: condensa até 70 no
 * grito dele e nas manchetes, fica em 100 na conversa e abre até 125 no
 * nome da casa.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
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
  // a variável da fonte fica no <html> para os tokens do tema, que vivem em :root, conseguirem resolvê-la
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
