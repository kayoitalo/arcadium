import type { Metadata, Viewport } from "next";
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

/** A origem pública do app, para os links da prévia saírem absolutos; sem ela, o Next usa a da própria requisição. */
function publicOrigin(): URL | undefined {
  const origin = process.env.APP_ORIGIN ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  try { return origin ? new URL(origin) : undefined; } catch { return undefined; }
}

/*
 * A prévia de link (a imagem de opengraph-image.png) é a da casa, igual
 * pra todo mundo: quem abre o link de fora não está logado, e nada do que
 * você ouviu sai daqui. Uma leitura só vira imagem quando você pede o cartão.
 */
export const metadata: Metadata = {
  metadataBase: publicOrigin(),
  title: "Arcadium",
  description: "Um amigo obcecado por música lendo o seu histórico.",
  applicationName: "Arcadium",
  openGraph: { type: "website", siteName: "Arcadium", locale: "pt_BR", title: "Arcadium", description: "Um amigo obcecado por música lendo o seu histórico." },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Arcadium", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b0b0a", colorScheme: "dark" };

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
