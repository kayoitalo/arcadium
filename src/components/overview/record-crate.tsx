"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Disc3 } from "lucide-react";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { SPRING_SOFT } from "@/components/ui/motion";
import { cratePose, CRATE_WINDOW, stepFocus } from "./crate-pose";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";

interface RecordCrateProps {
  albums: AlbumItem[];
  /** Qual disco está na agulha agora — marcado no caixote com o LED aceso. */
  onDeckIndex: number;
  playing: boolean;
  /** Pôr o disco na agulha. */
  onSelect: (index: number) => void;
}

/** Medidas em que o caixote foi desenhado; abaixo disso ele encolhe inteiro. */
const STAGE_WIDTH = 560;
const STAGE_HEIGHT = 260;
const SLEEVE = 172;

/** Arrasto menor que isto não vira virada de disco: é tremida de dedo. */
const FLIP_THRESHOLD = 46;

/**
 * O caixote da loja. Os discos ficam encostados uns nos outros, deitados;
 * o que você está olhando sai da fila e vira de frente. Andar pelo caixote
 * não troca o que toca — só depois de puxar o disco é que se decide pôr na
 * agulha, como quem folheia antes de escolher.
 */
export function RecordCrate({ albums, onDeckIndex, playing, onSelect }: RecordCrateProps) {
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(onDeckIndex);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const frontRef = useRef<HTMLButtonElement>(null);
  const keyboard = useRef(false);

  // a cena tem geometria fixa em px: em vez de refazer tudo em porcentagem,
  // o caixote inteiro encolhe junto com a coluna
  useEffect(() => {
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / STAGE_WIDTH));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  // trocar de período refaz o rack: o caixote volta para o disco da agulha
  useEffect(() => {
    setFocused(onDeckIndex);
  }, [onDeckIndex, albums.length]);

  // o foco do teclado acompanha o disco puxado, mas só quando foi o teclado
  // que moveu — senão clicar no caixote arrastaria a rolagem da página
  useEffect(() => {
    if (!keyboard.current) return;
    keyboard.current = false;
    frontRef.current?.focus({ preventScroll: true });
  }, [focused]);

  if (albums.length === 0) return null;

  const walk = (step: number, fromKeyboard = false) => {
    keyboard.current = fromKeyboard;
    setFocused((current) => stepFocus(current, step, albums.length));
  };

  const onDragEnd = (_event: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < FLIP_THRESHOLD) return;
    // arrastar para a esquerda avança no caixote, como empurrar os discos
    walk(info.offset.x < 0 ? 1 : -1);
  };

  const front = albums[focused];
  const visible = albums
    .map((album, index) => ({ album, index, distance: index - focused }))
    .filter(({ distance }) => Math.abs(distance) <= CRATE_WINDOW);

  return (
    <div className="mt-6">
      <div
        ref={setStage}
        className="relative w-full overflow-hidden"
        style={{ perspective: 1100, height: STAGE_HEIGHT * scale }}
        role="group"
        aria-label="Caixote de discos do período"
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          walk(event.key === "ArrowRight" ? 1 : -1, true);
        }}
      >
        {/* centralizar e encolher ficam neste invólucro: o framer reescreve o
            transform do elemento que ele arrasta, e levaria o -50% junto */}
        <div
          className="absolute left-1/2 top-0 h-full"
          style={{
            width: STAGE_WIDTH,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
            transformStyle: "preserve-3d",
          }}
        >
          <motion.div
            className="relative h-full w-full"
            style={{ transformStyle: "preserve-3d" }}
            drag={reduced ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={onDragEnd}
          >
            {visible.map(({ album, index, distance }) => {
              const pose = cratePose(distance);
              const isFront = distance === 0;
              const onDeck = index === onDeckIndex;

              return (
                <motion.button
                  key={`${album.id ?? album.title}-${index}`}
                  ref={isFront ? frontRef : undefined}
                  type="button"
                  tabIndex={isFront ? 0 : -1}
                  aria-label={
                    isFront
                      ? `Pôr na agulha: ${album.title}, de ${album.artistName}`
                      : `Ver ${album.title}, de ${album.artistName}`
                  }
                  onClick={() => (isFront ? onSelect(index) : setFocused(index))}
                  className="absolute left-1/2 top-1/2 cursor-pointer border-0 bg-transparent p-0"
                  style={{
                    width: SLEEVE,
                    height: SLEEVE,
                    marginLeft: -SLEEVE / 2,
                    marginTop: -SLEEVE / 2,
                    // empilhamento é instantâneo: animar z-index daria fração e piscada
                    zIndex: pose.zIndex,
                  }}
                  animate={{ x: pose.x, rotateY: pose.rotateY, scale: pose.scale, opacity: pose.opacity }}
                  transition={reduced ? { duration: 0 } : SPRING_SOFT}
                >
                  <span
                    className="relative block h-full w-full rounded-sm"
                    style={{
                      boxShadow: isFront
                        ? "0 26px 50px -18px rgb(0 0 0 / 0.85)"
                        : "0 10px 22px -12px rgb(0 0 0 / 0.7)",
                    }}
                  >
                    <ResilientCover
                      src={album.coverUrl}
                      alt={`Capa de ${album.title}`}
                      label={album.title}
                      priority={isFront}
                      className="h-full w-full rounded-sm ring-1 ring-white/[0.07]"
                      imageClassName={
                        isFront ? "" : "saturate-[.78] brightness-[.7] transition-[filter] duration-300"
                      }
                    />

                    {onDeck && (
                      <span className="absolute left-2 top-2 flex items-center gap-1.5 bg-black/70 px-1.5 py-1">
                        <span
                          className="led"
                          data-on="true"
                          style={playing && !reduced ? { animation: "gy-blink 0.7s steps(1) infinite" } : undefined}
                          aria-hidden
                        />
                        <span className="data text-[7.5px] text-white/85">na agulha</span>
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* o disco puxado, lido de perto */}
      <div className="mt-4 flex items-end justify-between gap-4 border-y border-rule py-3">
        <div className="min-w-0">
          <span className="eyebrow">disco {focused + 1} de {albums.length}</span>
          <p className="mt-1.5 truncate text-sm font-semibold text-text-primary">{front.title}</p>
          <p className="truncate text-xs text-text-muted">{front.artistName}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="data text-text-label">
            <b className="text-[13px] font-semibold text-text-primary">
              {front.plays.toLocaleString("pt-BR")}
            </b>{" "}
            audições
          </span>

          <button type="button" onClick={() => onSelect(focused)} className="key key-sm">
            <Disc3 className="h-3 w-3" />
            pôr na agulha
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="data text-text-muted">arraste, use as setas, ou clique num disco do caixote</p>

        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => walk(-1)}
            disabled={focused === 0}
            aria-label="Disco anterior"
            className="key key-sm"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => walk(1)}
            disabled={focused === albums.length - 1}
            aria-label="Próximo disco"
            className="key key-sm"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
