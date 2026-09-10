/**
 * As seções do arquivo, na ordem em que estão no fichário. O código é
 * usado tanto na aba quanto na lombada e no cabeçalho de cada tela —
 * é o que faz a navegação parecer um sumário de catálogo, e não um menu.
 */
export interface Section {
  href: string;
  code: string;
  label: string;
  spine: string;
}

export const SECTIONS: Section[] = [
  { href: "/overview", code: "01", label: "Visão geral", spine: "GY/01 · VISÃO GERAL" },
  { href: "/taste-evolution", code: "02", label: "Evolução", spine: "GY/02 · EVOLUÇÃO DE GOSTO" },
  { href: "/discovery", code: "03", label: "Descobertas", spine: "GY/03 · PRENSAGENS DE TESTE" },
  { href: "/history", code: "04", label: "Histórico", spine: "GY/04 · LIVRO DE AUDIÇÕES" },
  { href: "/settings", code: "05", label: "Ficha técnica", spine: "GY/05 · FICHA TÉCNICA" },
];

export function sectionFor(pathname: string): Section {
  return (
    SECTIONS.find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`)) ??
    SECTIONS[0]
  );
}
