"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { EASE_OUT_EXPO, SPRING_SOFT } from "@/components/ui/motion";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";

interface TurntableProps {
  albums: AlbumItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/** Medidas em que a vitrola foi desenhada; abaixo disso ela encolhe inteira. */
const STAGE_WIDTH = 470;
const STAGE_HEIGHT = 400;

/**
 * A vitrola. O disco em foco está no prato, com a capa servindo de
 * bolacha central e a mesma capa embaixo, como encarte. Os próximos
 * ficam na pilha "a seguir": passar o cursor puxa o disco de dentro da
 * capa, e clicar troca o que está tocando — e a cor de toda a tela.
 */
export function Turntable({ albums, selectedIndex, onSelect }: TurntableProps) {
  const reduced = useReducedMotion();
  // ref de estado, não useRef: o palco só existe depois que os discos
  // chegam, e um useRef não avisaria o observer de que ele nasceu
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // o prato tem geometria fixa (braço, fuso, sulcos): em vez de recalcular
  // tudo em porcentagem, a cena inteira encolhe junto com a coluna
  useEffect(() => {
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / STAGE_WIDTH));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  const pointerX = useSpring(useMotionValue(0), SPRING_SOFT);
  const pointerY = useSpring(useMotionValue(0), SPRING_SOFT);
  const rotateY = useTransform(pointerX, (value) => value * 9);
  const rotateX = useTransform(pointerY, (value) => -value * 9);

  if (albums.length === 0) return null;

  const current = albums[selectedIndex] ?? albums[0];
  const upNext = albums.map((album, index) => ({ album, index })).filter(({ index }) => index !== selectedIndex).slice(0, 4);

  return (
    <div className="relative mx-auto w-full max-w-[470px]">
      <div
        ref={setStage}
        className="relative w-full"
        style={{ perspective: 1200, height: STAGE_HEIGHT * scale }}
        onPointerMove={(event) => {
          if (reduced) return;
          const bounds = stage?.getBoundingClientRect();
          if (!bounds) return;
          pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
          pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
        }}
        onPointerLeave={() => {
          pointerX.set(0);
          pointerY.set(0);
        }}
      >
        <motion.div
          className="absolute left-1/2 top-0 h-[400px] w-[470px]"
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
            x: "-50%",
            scale,
            originY: 0,
          }}
        >
          {/* encarte: a capa inteira, atrás e fora de foco, saindo pela
              esquerda do prato. O transform fica no invólucro porque o
              framer reescreve o transform do elemento que ele anima. */}
          <div
            className="absolute left-1/2 top-[66px] h-[236px] w-[236px]"
            style={{ transform: "translateX(-50%) translate(-96px, 0) rotate(-6deg)" }}
          >
            <motion.div
              key={`sleeve-${current.id ?? current.title}`}
              className="h-full w-full overflow-hidden rounded-sm"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
            >
              <ResilientCover
                src={current.coverUrl}
                alt=""
                label={current.title}
                compact
                className="h-full w-full"
                imageClassName="blur-[1.5px] brightness-[0.62]"
              />
            </motion.div>
          </div>

          {/* prato */}
          <div
            className="absolute left-1/2 top-[39px] h-[322px] w-[322px] -translate-x-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 50%, #14181d 0 44%, #0f1216 44% 100%)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.05), 0 30px 56px -26px rgb(0 0 0 / 0.92)",
            }}
          >
            <div
              className="absolute inset-2 rounded-full"
              style={{
                background:
                  "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.022) 0 1px, transparent 1px 5px)",
              }}
            />
            <div
              className="pointer-events-none absolute -inset-7 -z-10 rounded-full"
              style={{
                background: "radial-gradient(closest-side, var(--chroma-glow), transparent 72%)",
                animation: "gy-pulse 5.5s ease-in-out infinite",
              }}
            />
          </div>

          {/* bolacha */}
          <div
            className="absolute left-1/2 top-[50px] h-[300px] w-[300px] -translate-x-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 50%, #101317 0 17%, #08090b 17% 100%)",
              boxShadow: "0 14px 34px -16px rgb(0 0 0 / 0.9), inset 0 0 0 1px rgb(255 255 255 / 0.04)",
              animation: reduced ? undefined : "gy-spin 26s linear infinite",
            }}
          >
            <div
              className="absolute inset-[7px] rounded-full"
              style={{
                background:
                  "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)",
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, rgb(255 255 255 / 0.07) 28deg, transparent 62deg, transparent 180deg, rgb(255 255 255 / 0.05) 212deg, transparent 250deg)",
              }}
            />

            {/* o rótulo é a própria capa, recortada em círculo */}
            <div className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-[0_2px_12px_rgb(0_0_0/0.55)]">
              <ResilientCover
                src={current.coverUrl}
                alt={`Capa de ${current.title}`}
                label={current.title}
                priority
                className="h-full w-full"
              />
              <span className="absolute inset-[14%] rounded-full border border-black/20" />
            </div>
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
          </div>

          {/* braço */}
          <div
            className="absolute right-1.5 top-[197px] h-1.5 w-[274px] origin-right"
            style={{ transform: "rotate(24deg)" }}
          >
            <span
              className="absolute -right-[11px] -top-[11px] h-7 w-7 rounded-full"
              style={{
                background: "linear-gradient(150deg, #3b444e, #1d2329)",
                boxShadow: "0 3px 10px rgb(0 0 0 / 0.65)",
              }}
            />
            <span
              className="absolute left-[18px] right-3 top-0.5 h-[2.5px] rounded-sm"
              style={{ background: "linear-gradient(90deg, #6f7b86, #39424c)" }}
            />
            <span
              className="absolute left-0 -top-[3px] h-3 w-[22px] rounded-sm"
              style={{ background: "linear-gradient(150deg, #545f6a, #262d35)" }}
            >
              <span className="absolute bottom-[-5px] left-0.5 h-1.5 w-0.5 bg-accent" />
            </span>
          </div>
        </motion.div>
      </div>

      {upNext.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="eyebrow">na agulha</span>
            <span className="data text-text-label">a seguir</span>
          </div>

          <div className="flex gap-2">
            {upNext.map(({ album, index }) => (
              <button
                key={`${album.id ?? album.title}-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`Tocar ${album.title}, de ${album.artistName}`}
                className="group relative h-[74px] flex-1 cursor-pointer border-0 bg-transparent p-0 transition-transform duration-[460ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2.5"
              >
                {/* a bolacha sai de dentro da capa no hover */}
                <span
                  className="absolute left-[26%] top-[4%] aspect-square h-[92%] rounded-full transition-transform duration-[460ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-6"
                  style={{
                    background: "radial-gradient(circle at 50% 50%, #101317 0 18%, #0b0d10 18% 100%)",
                    boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.05)",
                  }}
                >
                  <span
                    className="absolute inset-[12%] rounded-full"
                    style={{
                      background:
                        "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.055) 0 1px, transparent 1px 3px)",
                    }}
                  />
                </span>

                <span className="relative block aspect-square h-full">
                  <ResilientCover
                    src={album.coverUrl}
                    alt={`Capa de ${album.title}`}
                    label={album.title}
                    className="h-full w-full rounded-sm ring-1 ring-white/[0.06] transition-[filter,box-shadow] duration-300 group-hover:ring-white/20"
                    imageClassName="saturate-[.82] brightness-[.84] transition-[filter] duration-300 group-hover:saturate-100 group-hover:brightness-100"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-left">
                    <span className="data block truncate text-[7.5px] text-white/80">{album.title}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
