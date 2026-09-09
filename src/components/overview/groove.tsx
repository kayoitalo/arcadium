"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useChroma } from "@/components/chroma/chroma-provider";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import type { ActivityPoint } from "@/modules/statistics/application/overview-service";

interface GrooveProps {
  activity: ActivityPoint[];
  totalPlays: number;
}

interface GroovePoint {
  date: string;
  plays: number;
  t: number;
  angle: number;
  radius: number;
  x: number;
  y: number;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

/**
 * O disco: o tempo corre do centro para fora, uma volta por ano.
 * Cada traço é um dia e o comprimento é o volume de audições —
 * os vazios entre traços são os dias em silêncio.
 */
export function Groove({ activity, totalPlays }: GrooveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<GroovePoint[]>([]);
  const sizeRef = useRef(0);
  const hoverRef = useRef(-1);
  const progressRef = useRef(0);
  const reduced = useReducedMotion();
  const { chroma } = useChroma();
  const [hovered, setHovered] = useState<GroovePoint | null>(null);

  const model = useMemo(() => {
    const usable = activity.filter((point) => point.plays > 0);
    if (usable.length < 2) return null;

    const start = Date.parse(usable[0].label);
    const end = Date.parse(usable[usable.length - 1].label);
    const span = Math.max(1, end - start);
    const days = span / 86_400_000;
    const turns = Math.max(1.15, days / 365);
    const maxPlays = usable.reduce((max, point) => Math.max(max, point.plays), 1);

    const points: GroovePoint[] = usable.map((point) => {
      const t = (Date.parse(point.label) - start) / span;
      return {
        date: point.label,
        plays: point.plays,
        t,
        angle: -Math.PI / 2 + t * turns * Math.PI * 2,
        radius: 0,
        x: 0,
        y: 0,
      };
    });

    const years: number[] = [];
    const firstYear = new Date(start).getUTCFullYear();
    const lastYear = new Date(end).getUTCFullYear();
    for (let year = firstYear + 1; year <= lastYear; year += 1) years.push(year);

    return { points, turns, maxPlays, start, span, years };
  }, [activity]);

  const draw = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      const size = sizeRef.current;
      if (!canvas || !context || !model || !size) return;

      progressRef.current = progress;
      const { points, turns, maxPlays, start, span, years } = model;
      const inner = size * 0.13;
      const outer = size * 0.47;
      const band = size * 0.05;
      const center = size / 2;
      const hue = chroma.h;
      const saturation = `${chroma.s}%`;

      context.clearRect(0, 0, size, size);

      context.beginPath();
      for (let a = 0; a <= progress * turns * Math.PI * 2; a += 0.03) {
        const t = a / (turns * Math.PI * 2);
        const radius = inner + t * (outer - inner);
        const angle = -Math.PI / 2 + a;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;
        if (a === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = "#1b2027";
      context.lineWidth = 1;
      context.stroke();

      context.lineCap = "round";
      points.forEach((point, index) => {
        if (point.t > progress) return;
        const ratio = point.plays / maxPlays;
        const amplitude = Math.pow(ratio, 0.62) * band;
        const ux = Math.cos(point.angle);
        const uy = Math.sin(point.angle);
        const from = point.radius - amplitude * 0.34;
        const to = point.radius + amplitude;
        const active = index === hoverRef.current;

        context.beginPath();
        context.moveTo(center + ux * from, center + uy * from);
        context.lineTo(center + ux * to, center + uy * to);
        context.strokeStyle = active
          ? "#ffffff"
          : `hsl(${hue} ${saturation} ${37 + ratio * 30}% / ${0.5 + ratio * 0.5})`;
        context.lineWidth = active ? 3 : 1.5;
        context.stroke();
      });

      if (years.length) {
        const axisT = (Date.parse(`${years[0]}-01-01`) - start) / span;
        const axisAngle = -Math.PI / 2 + axisT * turns * Math.PI * 2;
        context.beginPath();
        context.moveTo(center + Math.cos(axisAngle) * inner * 0.55, center + Math.sin(axisAngle) * inner * 0.55);
        context.lineTo(center + Math.cos(axisAngle) * (outer + band * 3), center + Math.sin(axisAngle) * (outer + band * 3));
        context.strokeStyle = "#161b21";
        context.lineWidth = 1;
        context.stroke();

        context.font = '9px "Martian Mono", ui-monospace, monospace';
        context.fillStyle = "#5b656e";
        context.textAlign = "center";
        years.forEach((year) => {
          const t = (Date.parse(`${year}-01-01`) - start) / span;
          if (t < 0 || t > progress) return;
          const angle = -Math.PI / 2 + t * turns * Math.PI * 2;
          const radius = inner + t * (outer - inner) + band * 2.4;
          context.fillText(String(year), center + Math.cos(angle) * radius, center + Math.sin(angle) * radius + 3);
        });
      }
    },
    [chroma.h, chroma.s, model],
  );

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    const bounds = canvas.getBoundingClientRect();
    const size = Math.max(220, bounds.width);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    const context = canvas.getContext("2d");
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    sizeRef.current = size;

    const inner = size * 0.13;
    const outer = size * 0.47;
    model.points.forEach((point) => {
      point.radius = inner + point.t * (outer - inner);
      point.x = size / 2 + Math.cos(point.angle) * point.radius;
      point.y = size / 2 + Math.sin(point.angle) * point.radius;
    });
    pointsRef.current = model.points;
  }, [model]);

  useEffect(() => {
    if (!model) return;
    measure();
    if (reduced) {
      draw(1);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const duration = 2000;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      draw(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [model, measure, draw, reduced]);

  useEffect(() => {
    draw(progressRef.current || 1);
  }, [draw]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        measure();
        draw(1);
      }, 140);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [measure, draw]);

  if (!model) {
    return (
      <div className="flex aspect-square w-full max-w-[520px] items-center justify-center rounded-full border border-border/60 text-center">
        <p className="max-w-[22ch] text-sm text-text-muted">
          O disco aparece quando houver ao menos dois dias de escuta no período.
        </p>
      </div>
    );
  }

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const size = sizeRef.current;
    if (!canvas || !size) return;
    const bounds = canvas.getBoundingClientRect();
    const scale = size / bounds.width;
    const mx = (event.clientX - bounds.left) * scale;
    const my = (event.clientY - bounds.top) * scale;

    let best = -1;
    let bestDistance = 24 * 24;
    pointsRef.current.forEach((point, index) => {
      const dx = point.x - mx;
      const dy = point.y - my;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });

    if (best === hoverRef.current) return;
    hoverRef.current = best;
    setHovered(best < 0 ? null : pointsRef.current[best]);
    draw(1);
  };

  const clearHover = () => {
    hoverRef.current = -1;
    setHovered(null);
    draw(1);
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <canvas
        ref={canvasRef}
        onPointerMove={handleMove}
        onPointerLeave={clearHover}
        className="h-full w-full cursor-crosshair"
        aria-label={`Disco com as audições diárias, de ${formatDay(model.points[0].date)} a ${formatDay(model.points[model.points.length - 1].date)}`}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={hovered ? hovered.date : "total"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
          >
            <strong className={`numeral block text-4xl sm:text-5xl ${hovered ? "text-accent" : "text-text-primary"}`}>
              {(hovered ? hovered.plays : totalPlays).toLocaleString("pt-BR")}
            </strong>
            <span className="eyebrow mt-2 block">
              {hovered ? formatDay(hovered.date) : "audições no período"}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
