import type { Metadata } from "next";
import { Manrope, Space_Mono, Syne } from "next/font/google";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "SpotStats — Personal Music Intelligence Journal",
  description: "Digital music magazine and deterministic listening intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${sans.variable} ${display.variable} ${mono.variable} font-sans bg-background text-text-primary antialiased min-h-screen selection:bg-accent/30 selection:text-text-primary`}>
        {children}
      </body>
    </html>
  );
}
