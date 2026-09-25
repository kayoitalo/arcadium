/** As telas do app, na ordem em que aparecem na navegação, com o nome que o amigo daria. */
export interface Section {
  href: string;
  label: string;
}

export const SECTIONS: Section[] = [
  { href: "/overview", label: "conversa" },
  { href: "/taste-evolution", label: "o que mudou" },
  { href: "/discovery", label: "pra ouvir depois" },
  { href: "/history", label: "tudo que tocou" },
  { href: "/settings", label: "ajustes" },
];

export function sectionFor(pathname: string): Section {
  return (
    SECTIONS.find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`)) ??
    SECTIONS[0]
  );
}
