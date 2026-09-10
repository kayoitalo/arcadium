import type { ReactNode } from "react";

/**
 * As peças fixas do arquivo. São o que dá a mesma cara a todas as telas:
 * grão de papelão, lombada, cabeçalho de seção numerado e o colofão com
 * a procedência de cada número.
 *
 * Nenhuma delas usa hook — o casco (server component) e as telas
 * (client components) importam do mesmo lugar.
 */

/** Grão de papelão sem revestimento, por cima de tudo, inerte. */
export function PressGrain() {
  return <div className="press-grain" aria-hidden />;
}

/**
 * A lombada. Num disco é onde está o nome do selo e o número de
 * catálogo; aqui é onde está o nome da seção que você está lendo.
 * Só aparece quando existe margem sobrando para ela.
 */
export function Spine({ label }: { label: string }) {
  return (
    <div className="hidden border-r border-border xl:block" aria-hidden>
      <div className="sticky top-[8.5rem] flex h-[calc(100vh-12rem)] flex-col items-center justify-between py-2">
        <span className="spine-text catalog whitespace-nowrap">GROOVEYARD · ARQUIVO DE ESCUTA</span>
        <span className="spine-text catalog whitespace-nowrap text-accent">{label}</span>
        <span className="catalog">33⅓</span>
      </div>
    </div>
  );
}

/**
 * Cabeçalho de seção: número de catálogo, título carimbado e uma nota
 * curta à direita. O fio embaixo é o que costura a página inteira.
 */
export function SectionHead({
  code,
  title,
  note,
}: {
  code: string;
  title: string;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border pb-3">
      <div className="flex items-baseline gap-3">
        <span className="catalog text-accent">{code}</span>
        <h2 className="section-title text-[clamp(0.95rem,1.6vw,1.15rem)]">{title}</h2>
      </div>
      {note && <span className="label">{note}</span>}
    </div>
  );
}

/** Número de catálogo: GY·LP-004, GY·A-012. */
export function catalogNo(prefix: string, index: number): string {
  return `GY·${prefix}-${String(index + 1).padStart(3, "0")}`;
}

/**
 * Colofão. Numa contracapa é a letra miúda que diz quem prensou, quem
 * fotografou e onde foi gravado — aqui é a procedência de cada número
 * que a tela mostra, que é exatamente o que este projeto tem de mais
 * incomum: nada é inventado pela IA.
 */
export function Colophon() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto grid max-w-[1360px] gap-8 px-4 py-10 sm:px-7 md:grid-cols-[minmax(0,1fr)_auto]">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="label">Audições</dt>
            <dd className="mt-1 data text-text-secondary">Last.fm · user.getRecentTracks</dd>
          </div>
          <div>
            <dt className="label">Metadados e capas</dt>
            <dd className="mt-1 data text-text-secondary">MusicBrainz · Cover Art Archive</dd>
          </div>
          <div>
            <dt className="label">Prévias de 30s</dt>
            <dd className="mt-1 data text-text-secondary">iTunes Search</dd>
          </div>
          <div>
            <dt className="label">Leitura em texto</dt>
            <dd className="mt-1 data text-text-secondary">Gemini · sobre números já contados</dd>
          </div>
        </dl>

        <div className="max-w-[34ch] md:text-right">
          <p className="liner text-[0.9375rem] leading-relaxed">
            Todo número desta ficha é <em>contado no banco</em>, nunca estimado por IA. A IA só
            escreve sobre o que a contagem já provou.
          </p>
          <p className="catalog mt-4 block">℗ {new Date().getFullYear()} Grooveyard · GY–ARQ · 33⅓ RPM</p>
        </div>
      </div>
    </footer>
  );
}
