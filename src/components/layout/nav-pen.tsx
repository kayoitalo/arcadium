"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { polyLength, resample, toPath, type Point } from "@/components/amigo/gestures";

/**
 * O sublinhado da tela atual, feito pela caneta em tinta clara (o amarelo é
 * do amigo). Quando a tela muda, a tinta do sublinhado anterior recolhe, a
 * ponta viaja em arco até a palavra nova e sublinha ela, subindo de leve no
 * fim como faz a mão. Com movimento reduzido, o sublinhado só aparece.
 */
export function NavPen({ nav, current, reduced }: { nav: RefObject<HTMLElement | null>; current: string; reduced: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const ink = useRef<SVGPathElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const nib = useRef<SVGCircleElement>(null);
  const last = useRef<Point | null>(null);
  /** Enquanto a caneta anda, a medida de tamanho não redesenha por cima dela. */
  const moving = useRef(false);

  /**
   * O menu onde a caneta mora. Na primeira montagem o efeito daqui roda antes
   * de o React ligar a ref do <nav> (o pai): sem isso, a caneta não achava a
   * palavra, o sublinhado não aparecia ao abrir o app e a primeira troca de
   * tela não viajava. O próprio <svg> já está ligado e mora dentro do <nav>.
   */
  const hostOf = () => nav.current ?? (svg.current?.parentElement as HTMLElement | null) ?? null;

  const lineFor = (): Point[] | null => {
    const host = hostOf();
    const link = host?.querySelector<HTMLElement>(`[data-href="${current}"]`);
    if (!host || !link) return null;
    const a = link.getBoundingClientRect();
    const b = host.getBoundingClientRect();
    const x = a.left - b.left + host.scrollLeft;
    const y = a.bottom - b.top - 4;
    return [{ x: x + 1, y }, { x: x + a.width * 0.55, y: y - 0.6 }, { x: x + a.width - 1, y: y - 1.8 }];
  };

  useLayoutEffect(() => {
    const host = hostOf();
    const path = ink.current;
    const travelPath = trail.current;
    const dot = nib.current;
    const line = lineFor();
    if (!host || !path || !travelPath || !dot || !line) return;
    const from = last.current;
    last.current = line[line.length - 1];
    const draw = toPath(line);
    const length = polyLength(line);
    if (reduced || !from) {
      path.setAttribute("d", draw);
      path.style.strokeDasharray = "none";
      travelPath.setAttribute("d", "");
      dot.style.opacity = "0";
      return;
    }
    // a viagem: um arco raso por cima, da palavra de antes até a nova
    const start = line[0];
    const arc: Point[] = Array.from({ length: 25 }, (_, index) => {
      const t = index / 24;
      return { x: from.x + (start.x - from.x) * t, y: from.y + (start.y - from.y) * t - 14 * 4 * t * (1 - t) };
    });
    const { points: travelPoints, length: travelLength } = resample(arc, 2);
    const { points: inkPoints, length: inkLength } = resample(line, 1.5);
    travelPath.setAttribute("d", toPath(arc));
    path.setAttribute("d", draw);
    const t0 = performance.now();
    const RECOLHE = 160;
    const VIAJA = Math.min(420, Math.max(220, travelLength * 0.9));
    const ESCREVE = Math.min(420, Math.max(220, length * 3));
    let frame = 0;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now: number) => {
      const elapsed = now - t0;
      const back = Math.min(1, elapsed / RECOLHE);
      const go = Math.min(1, Math.max(0, (elapsed - RECOLHE * 0.6) / VIAJA));
      const write = Math.min(1, Math.max(0, (elapsed - RECOLHE * 0.6 - VIAJA * 0.9) / ESCREVE));
      // rastro da viagem: só a cabeça dele aparece, a cauda vai sumindo
      const head = ease(go) * travelLength;
      travelPath.style.strokeDasharray = `${Math.min(head, 46)} ${travelLength + 60}`;
      travelPath.style.strokeDashoffset = `${-Math.max(0, head - 46)}`;
      travelPath.style.opacity = go > 0 && go < 1 ? "0.5" : "0";
      path.style.strokeDasharray = `${ease(write) * inkLength} ${inkLength + 4}`;
      const at = write > 0 ? inkPoints[Math.min(inkPoints.length - 1, Math.round(ease(write) * (inkPoints.length - 1)))]
        : travelPoints[Math.min(travelPoints.length - 1, Math.round(ease(go) * (travelPoints.length - 1)))];
      dot.setAttribute("cx", String(at.x));
      dot.setAttribute("cy", String(at.y));
      dot.style.opacity = back < 1 && go === 0 ? "0" : write >= 1 ? "0" : "1";
      if (write < 1) frame = requestAnimationFrame(tick);
      else moving.current = false;
    };
    path.style.strokeDasharray = `0 ${inkLength + 4}`;
    moving.current = true;
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); moving.current = false; };
    // a palavra atual é a dependência de verdade; a medida é lida na hora
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, reduced]);

  // tela redimensionada: o sublinhado vai junto, sem animar
  useEffect(() => {
    const host = hostOf();
    if (!host) return;
    // o observador avisa uma vez assim que liga: essa primeira medida é a mesma que a caneta acabou de usar
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) { first = false; return; }
      if (moving.current) return;
      const line = lineFor();
      if (!line || !ink.current) return;
      ink.current.setAttribute("d", toPath(line));
      ink.current.style.strokeDasharray = "none";
      last.current = line[line.length - 1];
    });
    observer.observe(host);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    // do tamanho do menu, nunca zero: SVG com largura ou altura 0 não é pintado (o traço existia, medido, e ninguém via)
    <svg ref={svg} className="navPen" aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      <path ref={trail} fill="none" stroke="var(--tinta-3)" strokeWidth={1} strokeLinecap="round" style={{ opacity: 0 }} />
      <path ref={ink} fill="none" stroke="var(--tinta)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle ref={nib} r={2.1} fill="var(--tinta)" style={{ opacity: 0, transition: "opacity 160ms" }} />
    </svg>
  );
}
