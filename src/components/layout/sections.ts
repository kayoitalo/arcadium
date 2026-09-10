/** As telas do app, na ordem em que aparecem na navegação. */
export interface Section {
  href: string;
  label: string;
}

export const SECTIONS: Section[] = [
  { href: "/overview", label: "Visão geral" },
  { href: "/taste-evolution", label: "Evolução" },
  { href: "/discovery", label: "Descobertas" },
  { href: "/history", label: "Histórico" },
  { href: "/settings", label: "Ajustes" },
];

export function sectionFor(pathname: string): Section {
  return (
    SECTIONS.find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`)) ??
    SECTIONS[0]
  );
}
