import type { ReactNode } from "react";

// O cartão de prévia força fundo branco; no app, o <body> é sempre o papel
// escuro (styles.css). Este invólucro só devolve à prévia a superfície que
// toda tela do Arcadium tem — não é um componente do sistema.
//
// As prévias são retratos parados: a caneta roda em modo reduzido e as
// transições de cor e de revelação (a letra que escurece sob o grifo, a
// anotação que aparece ao lado da régua) vão direto ao estado final, sem os
// 140–380 ms que no app acompanham o traço.
export function Papel({ children }: { children: ReactNode }) {
  return <div data-preview-pen style={{ background: "var(--papel)", color: "var(--tinta)", fontFamily: "var(--font-archivo), system-ui, sans-serif",
    fontVariationSettings: '"wdth" 100, "wght" 420', letterSpacing: "-0.01em", padding: "28px 24px", position: "relative", isolation: "isolate" }}>
    <style>{"[data-preview-pen] *{transition:none !important}"}</style>
    {children}
  </div>;
}
