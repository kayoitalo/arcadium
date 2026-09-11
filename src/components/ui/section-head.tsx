import type { ReactNode } from "react";

/**
 * O cabeçalho das seções: número em âmbar, etiqueta em mono e, quando a
 * seção tem manchete própria, o título com o fio embaixo.
 */
export function SectionHead({
  index,
  eyebrow,
  title,
  aside,
}: {
  index?: string;
  eyebrow: string;
  title?: string;
  aside?: ReactNode;
}) {
  const label = (
    <div className="flex items-center gap-2.5">
      {index && (
        <>
          <span className="eyebrow text-accent">{index}</span>
          <span className="h-px w-3 bg-border-strong" />
        </>
      )}
      <span className="eyebrow">{eyebrow}</span>
    </div>
  );

  if (!title) return label;

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border pb-4">
      <div>
        {label}
        <h2 className="headline mt-3 text-[clamp(1.5rem,2.8vw,2.1rem)]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}
