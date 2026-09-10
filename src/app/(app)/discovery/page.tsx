"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListPlus, RotateCcw, X } from "lucide-react";
import { useChroma } from "@/components/chroma/chroma-provider";
import { useScreenChrome } from "@/components/layout/chrome";
import { DiscoveryStage, type StageAction, type StageCandidate } from "@/components/discovery/discovery-stage";
import { ScreenLine } from "@/components/ui/screen-line";
import { EASE_OUT_EXPO } from "@/components/ui/motion";

interface ExportedTrack {
  artistName: string;
  trackName: string;
  webUrl: string;
}

interface ExportResult {
  playlistTitle?: string;
  playlistUrl?: string;
  mode?: string;
  resolvedCount?: number;
  totalItems?: number;
  items?: ExportedTrack[];
  m3uPayload?: string;
  error?: string;
}

const FEEDBACK_API: Record<StageAction, string> = {
  liked: "LIKED",
  saved: "SAVE_FOR_LATER",
  known: "ALREADY_KNOW",
  skipped: "NOT_INTERESTED",
};

/** Atalhos para os cantos do mapa que valem a pena visitar. */
const PRESETS = [
  { label: "Quase em casa", proximity: 88, fame: 70 },
  { label: "Um passo ao lado", proximity: 55, fame: 50 },
  { label: "Fora da bolha", proximity: 18, fame: 30 },
  { label: "Como nunca ouvi isso", proximity: 62, fame: 92 },
];

export default function DiscoveryPage() {
  const [proximity, setProximity] = useState(55);
  const [fame, setFame] = useState(50);
  const [queue, setQueue] = useState<StageCandidate[]>([]);
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, StageAction>>({});
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [showExport, setShowExport] = useState(false);
  const { adoptCover } = useChroma();
  const requestRef = useRef(0);
  const mapRef = useRef<HTMLDivElement>(null);

  useScreenChrome({ title: "Descobertas" });

  const load = useCallback(async (nextProximity: number, nextFame: number) => {
    const token = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "BALANCED",
          context: "GENERAL",
          proximity: nextProximity,
          fame: nextFame,
        }),
      });
      if (!response.ok) throw new Error("Não foi possível montar as sugestões.");
      const payload = await response.json();
      // uma resposta antiga não pode sobrescrever a busca atual
      if (token !== requestRef.current) return;

      setQueue(payload.items ?? []);
      setSessionId(payload.sessionId ?? null);
      setIndex(0);
      setDecided({});
    } catch (cause) {
      if (token === requestRef.current) {
        setError(cause instanceof Error ? cause.message : "Algo deu errado.");
      }
    } finally {
      if (token === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(55, 50);
  }, [load]);

  const current = queue[index];

  // a tela assume a cor da capa em foco
  useEffect(() => {
    adoptCover(current?.coverUrl, current?.albumName ?? current?.artistName ?? null);
  }, [current?.coverUrl, current?.albumName, current?.artistName, adoptCover]);

  const handleAction = useCallback(
    (candidate: StageCandidate, action: StageAction) => {
      setDecided((previous) => ({ ...previous, [candidate.id]: action }));
      setIndex((value) => value + 1);

      if (sessionId) {
        void fetch(`/api/recommendations/${sessionId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: candidate.id, type: FEEDBACK_API[action] }),
        }).catch(() => undefined);
      }
    },
    [sessionId],
  );

  const kept = useMemo(
    () => queue.filter((item) => decided[item.id] === "liked" || decided[item.id] === "saved"),
    [queue, decided],
  );

  /** As sugestões desta busca, plotadas nos mesmos eixos que você regulou. */
  const mapDots = useMemo(
    () =>
      queue
        .filter((item) => item.position)
        .map((item) => ({
          id: item.id,
          x: item.position!.proximity,
          y: 100 - item.position!.fame,
          done: Boolean(decided[item.id]),
        })),
    [queue, decided],
  );

  const handleExport = async () => {
    setExporting(true);
    setShowExport(true);
    setExportResult(null);

    try {
      const response = await fetch("/api/spotify/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: kept.map((item) => ({ trackName: item.trackName, artistName: item.artistName })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "A exportação falhou.");
      setExportResult(payload.data);
    } catch (cause) {
      setExportResult({ error: cause instanceof Error ? cause.message : "A exportação falhou." });
    } finally {
      setExporting(false);
    }
  };

  const finished = !loading && !error && queue.length > 0 && index >= queue.length;

  return (
    <div className="gy-page relative overflow-x-clip">
      <div className="chroma-aura pointer-events-none absolute -inset-x-40 -top-40 -z-10 h-[640px]" />

      <div className="grid items-start gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--chrome-h)+26px)]">
          <div>
            <span className="eyebrow text-accent">O mapa</span>
            <h1 className="display mt-4 text-[clamp(2rem,3.6vw,2.9rem)]">
              <span className="block overflow-hidden">
                <span className="gy-rise">Para ouvir depois</span>
              </span>
            </h1>
            <ScreenLine
              screen="discovery"
              fallback="Aponte um canto do mapa. Ouça trinta segundos e decida — o que você marcar muda as próximas."
            />
          </div>

          <div className="rounded-[3px] border border-border bg-surface/60 p-5">
            {/* clicar no mapa é a forma direta de dizer o que você quer */}
            <div
              ref={mapRef}
              role="presentation"
              onClick={(event) => {
                const bounds = mapRef.current?.getBoundingClientRect();
                if (!bounds) return;
                const x = Math.round(((event.clientX - bounds.left) / bounds.width) * 100);
                const y = Math.round(((event.clientY - bounds.top) / bounds.height) * 100);
                const nextProximity = Math.min(100, Math.max(0, x));
                const nextFame = Math.min(100, Math.max(0, 100 - y));
                setProximity(nextProximity);
                setFame(nextFame);
                void load(nextProximity, nextFame);
              }}
              className="relative aspect-square w-full cursor-crosshair border border-border"
              style={{
                background:
                  "linear-gradient(0deg, rgb(16 19 23 / 0.5), rgb(16 19 23 / 0.5)), repeating-linear-gradient(90deg, #12161a 0 1px, transparent 1px 25%), repeating-linear-gradient(0deg, #12161a 0 1px, transparent 1px 25%)",
              }}
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <span className="absolute inset-y-0 left-1/2 w-px bg-border" />

              {mapDots.map((dot) => (
                <span
                  key={dot.id}
                  className="absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors"
                  style={{
                    left: `${dot.x}%`,
                    top: `${dot.y}%`,
                    background: dot.done ? "#39424c" : "#8b959e",
                  }}
                />
              ))}

              <motion.span
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent"
                style={{ background: "var(--chroma-soft)" }}
                animate={{ left: `${proximity}%`, top: `${100 - fame}%` }}
                transition={{ duration: 0.52, ease: EASE_OUT_EXPO }}
              >
                <span className="absolute inset-1 rounded-full bg-accent" />
                <span
                  className="absolute -inset-2.5 rounded-full border border-border-glow"
                  style={{ animation: "gy-pulse 3s ease-in-out infinite" }}
                />
              </motion.span>

              <span className="micro absolute bottom-1.5 left-2">longe</span>
              <span className="micro absolute bottom-1.5 right-2">perto</span>
              <span className="micro absolute left-2 top-1.5">famoso</span>
              <span className="micro absolute bottom-6 left-2">obscuro</span>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <label className="grid grid-cols-[5.4rem_1fr_3.2rem] items-center gap-2.5">
                <span className="eyebrow">Proximidade</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={proximity}
                  onChange={(event) => setProximity(Number(event.target.value))}
                  className="w-full accent-[var(--chroma)]"
                  aria-label="Proximidade do seu gosto atual"
                />
                <span className="data text-right text-text-secondary">
                  {proximity < 35 ? "longe" : proximity > 70 ? "perto" : "meio"}
                </span>
              </label>

              <label className="grid grid-cols-[5.4rem_1fr_3.2rem] items-center gap-2.5">
                <span className="eyebrow">Fama</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={fame}
                  onChange={(event) => setFame(Number(event.target.value))}
                  className="w-full accent-[var(--chroma)]"
                  aria-label="Tamanho da plateia do artista"
                />
                <span className="data text-right text-text-secondary">
                  {fame < 35 ? "obscuro" : fame > 70 ? "famoso" : "meio"}
                </span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => {
                const active = preset.proximity === proximity && preset.fame === fame;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setProximity(preset.proximity);
                      setFame(preset.fame);
                      void load(preset.proximity, preset.fame);
                    }}
                    aria-pressed={active}
                    className="data cursor-pointer rounded-full border px-3 py-1.5 transition-colors"
                    style={{
                      borderColor: active ? "var(--chroma-line)" : "#232a32",
                      color: active ? "var(--chroma)" : "#79838c",
                      background: active ? "var(--chroma-soft)" : "transparent",
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void load(proximity, fame)}
              disabled={loading}
              className="pill pill-ink mt-4 w-full justify-center"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "procurando…" : "buscar com esses ajustes"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="data text-text-muted">
              {queue.length > 0 && !finished
                ? `${index + 1} de ${queue.length} · ${kept.length} separadas`
                : `${kept.length} separadas`}
            </span>
            <button type="button" onClick={handleExport} disabled={kept.length === 0} className="pill">
              <ListPlus className="h-3.5 w-3.5" />
              levar {kept.length}
            </button>
          </div>
        </aside>

        <div className="flex flex-col items-center">
          {error && (
            <p className="panel mx-auto max-w-[46ch] p-4 text-center text-sm text-status-error">{error}</p>
          )}

          {loading && (
            <div className="aspect-square w-full max-w-[460px] animate-pulse rounded-[3px] bg-surface-elevated" />
          )}

          {!loading && !error && queue.length === 0 && (
            <section className="py-14 text-center">
              <h2 className="headline mx-auto max-w-[22ch] text-[clamp(1.5rem,3vw,2.2rem)]">
                Nada novo com esses ajustes.
              </h2>
              <p className="mx-auto mt-4 max-w-[42ch] text-[15px] leading-[1.66] text-text-secondary">
                Puxe a proximidade para longe ou a fama para baixo — é onde mora o que você ainda não
                ouviu.
              </p>
            </section>
          )}

          {!loading && !error && !finished && queue.length > 0 && (
            <DiscoveryStage queue={queue} index={index} onAction={handleAction} />
          )}

          {finished && (
            <section className="py-14 text-center">
              <span className="eyebrow">Fim da pilha</span>
              <h2 className="headline mx-auto mt-4 max-w-[20ch] text-[clamp(1.5rem,3vw,2.2rem)]">
                {kept.length > 0 ? `Você separou ${kept.length}.` : "Nenhuma passou no teste."}
              </h2>
              <p className="mx-auto mt-4 max-w-[42ch] text-[15px] leading-[1.66] text-text-secondary">
                {kept.length > 0
                  ? "Dá para levar para o Spotify agora, ou mexer no mapa e buscar mais."
                  : "Mexa no mapa e tente outro canto."}
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {kept.length > 0 && (
                  <button type="button" onClick={handleExport} className="pill pill-ink">
                    <ListPlus className="h-4 w-4" />
                    levar {kept.length} para o Spotify
                  </button>
                )}
                <button type="button" onClick={() => void load(proximity, fame)} className="pill">
                  <RotateCcw className="h-3.5 w-3.5" />
                  buscar mais
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showExport && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg space-y-5 rounded-lg border border-border bg-surface p-6 shadow-lift"
              initial={{ opacity: 0, scale: 0.97, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="headline text-lg">Levar para o Spotify</h3>
                <button
                  type="button"
                  onClick={() => setShowExport(false)}
                  aria-label="Fechar"
                  className="rounded-full p-1.5 text-text-muted transition-colors hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {exporting && (
                <div className="space-y-3 py-8 text-center">
                  <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <p className="data text-text-muted">Procurando as faixas…</p>
                </div>
              )}

              {!exporting && exportResult?.error && (
                <p className="rounded-lg border border-status-error/30 bg-status-error/10 p-4 text-xs text-status-error">
                  {exportResult.error}
                </p>
              )}

              {!exporting && exportResult && !exportResult.error && (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    <b className="text-text-primary">{exportResult.resolvedCount}</b> de{" "}
                    {exportResult.totalItems} faixas encontradas
                    {exportResult.mode === "SPOTIFY_API" ? " e a playlist já está na sua conta." : "."}
                  </p>

                  <div className="flex items-center gap-3">
                    {exportResult.m3uPayload && (
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([exportResult.m3uPayload as string], {
                            type: "audio/x-mpegurl",
                          });
                          const url = URL.createObjectURL(blob);
                          const anchor = document.createElement("a");
                          anchor.href = url;
                          anchor.download = `${exportResult.playlistTitle ?? "grooveyard"}.m3u`;
                          anchor.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="pill"
                      >
                        baixar .m3u
                      </button>
                    )}
                    {exportResult.playlistUrl && (
                      <a
                        href={exportResult.playlistUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="pill pill-ink flex-1 justify-center"
                      >
                        abrir no Spotify
                      </a>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
