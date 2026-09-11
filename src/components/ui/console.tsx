import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * As peças do console. Todas planas: o estado aparece pela luz do LED,
 * não por relevo, e o clique afunda 1px em 50ms (o CSS cuida disso).
 */

type KeyProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  size?: "sm" | "md";
  /** Tecla de ação: a luz acesa por inteiro, sem LED separado. */
  ink?: boolean;
  led?: boolean;
};

export function Key({
  active = false,
  size = "md",
  ink = false,
  led = !ink,
  className = "",
  children,
  ...rest
}: KeyProps) {
  return (
    <button
      type="button"
      data-active={active}
      className={`key ${size === "sm" ? "key-sm" : ""} ${ink ? "key-ink" : ""} ${className}`}
      {...rest}
    >
      {led && <span className="led" aria-hidden />}
      {children}
    </button>
  );
}

/** Fileira de teclas encostadas, como os botões de um painel. */
export function Keys({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={`keys ${className}`}>
      {children}
    </div>
  );
}

/** Janela de display: rótulo em cima, o número dentro, a leitura embaixo. */
export function Readout({
  label,
  footer,
  className = "",
  children,
}: {
  label: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col bg-well px-5 py-6 ${className}`}>
      <span className="eyebrow">{label}</span>
      <div className="mt-3">{children}</div>
      {footer && <div className="mt-auto pt-5">{footer}</div>}
    </div>
  );
}

/** Variação contra o período anterior. Âmbar sobe, vermelho desce. */
export function Delta({ value, suffix = "contra o período anterior" }: { value?: number | null; suffix?: string }) {
  if (typeof value !== "number") {
    return <span className="data text-text-muted">sem período anterior para comparar</span>;
  }

  const up = value >= 0;
  return (
    <span className="data inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span style={{ color: up ? "var(--machine)" : "var(--color-status-error)" }}>
        {up ? "▲" : "▼"} {Math.abs(value).toLocaleString("pt-BR")}%
      </span>
      <span className="text-text-muted">{suffix}</span>
    </span>
  );
}

/**
 * Medidor segmentado. Os segmentos acendem em sequência quando o
 * medidor aparece — cada um liga de uma vez, sem rampa, como LED.
 */
export function Meter({
  ratio,
  label,
  segments = 20,
  className = "",
}: {
  ratio: number;
  label: string;
  segments?: number;
  className?: string;
}) {
  const safe = Math.max(0, Math.min(1, ratio));
  const lit = safe > 0 ? Math.max(1, Math.round(safe * segments)) : 0;

  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safe * 100)}
      className={`meter ${className}`}
    >
      {Array.from({ length: segments }, (_, index) => (
        <span key={index} data-lit={index < lit} style={{ animationDelay: `${index * 22}ms` }} />
      ))}
    </span>
  );
}
