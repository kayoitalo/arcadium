"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListPlus, RotateCcw, X } from "lucide-react";
import { useChroma } from "@/components/chroma/chroma-provider";
import { useScreenChrome } from "@/components/layout/chrome";
import { DiscoveryStage, type StageAction, type StageCandidate } from "@/components/discovery/discovery-stage";
import { XYPad, type PadDot } from "@/components/discovery/xy-pad";
import { Key } from "@/components/ui/console";
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

  const move = useCallback((nextProximity: number, nextFame: number) => {
    setProximity(nextProximity);
    setFame(nextFame);
  }, []);

  const commit = useCallback(
    (nextProximity: number, nextFame: number) => {
      move(nextProximity, nextFame);
      void load(nextProximity, nextFame);
    },
    [load, move],
  );

  const current = queue[index];

  // o disco em foco dá a cor do rótulo e do ponto no mapa
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
  const dots = useMemo<PadDot[]>(
    () =>
      queue
        .filter((item) => item.position)
        .map((item) => ({
          id: item.id,
          proximity: item.position!.proximity,
          fame: item.position!.fame,
          done: Boolean(decided[item.id]),
          current: item.id === current?.id,
        })),
    [queue, decided, current?.id],
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
    <div className="gy-page">
      <div className="grid items-start gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--chrome-h)+24px)]">
          <div>
            <span className="eyebrow">Descobertas</span>
            <h1 className="display mt-4 text-[clamp(2rem,3.6vw,2.9rem)]">
              <span className="block overflow-hidden">
                <span className="gy-rise">Para ouvir depois</span>
              </span>
            </h1>
            <ScreenLine
              screen="discovery"
              label="descobertas"
              fallback="Arraste a mira pelo mapa. Ouça trinta segundos e decida — o que você marcar muda as próximas."
            />
          </div>

          <XYPad
            proximity={proximity}
            fame={fame}
            dots={dots}
            busy={loading}
            onChange={move}
            onCommit={commit}
          />

          <div role="group" aria-label="Cantos do mapa" className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => {
              const active = preset.proximity === proximity && preset.fame === fame;
              return (
                <Key
                  key={preset.label}
                  active={active}
                  aria-pressed={active}
                  onClick={() => commit(preset.proximity, preset.fame)}
                  className="h-auto min-h-8 whitespace-normal py-2 text-left leading-snug"
                >
                  {preset.label}
                </Key>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="data text-text-muted">
              {queue.length > 0 && !finished
                ? `${index + 1} de ${queue.length} · ${kept.length} separadas`
                : `${kept.length} separadas`}
            </span>
            <Key ink={kept.length > 0} onClick={handleExport} disabled={kept.length === 0}>
              <ListPlus className="h-3.5 w-3.5" />
              levar {kept.length}
            </Key>
          </div>
        </aside>

        <div className="flex flex-col items-center">
          {error && (
            <div className="w-full max-w-[440px] border border-status-error/50 bg-well p-4">
              <span className="eyebrow text-status-error">Falha na busca</span>
              <p className="mt-2 text-sm text-status-error">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex aspect-square w-full max-w-[440px] items-center justify-center border border-border bg-well">
              <span className="data flex items-center gap-2 text-text-muted">
                <span className="led" data-on="true" style={{ animation: "gy-blink 0.7s steps(1) infinite" }} />
                buscando nesse canto do mapa
              </span>
            </div>
          )}

          {!loading && !error && queue.length === 0 && (
            <section className="w-full max-w-[440px] border border-border bg-well p-6">
              <span className="eyebrow">Canto vazio</span>
              <h2 className="headline mt-3 text-[clamp(1.5rem,3vw,2.1rem)]">Nada novo com esses ajustes.</h2>
              <p className="mt-4 text-[15px] leading-[1.66] text-text-secondary">
                Puxe a mira para longe ou para baixo — é onde mora o que você ainda não ouviu.
              </p>
            </section>
          )}

          {!loading && !error && !finished && queue.length > 0 && (
            <DiscoveryStage queue={queue} index={index} onAction={handleAction} />
          )}

          {finished && (
            <section className="w-full max-w-[440px] border border-border bg-well p-6">
              <span className="eyebrow">Fim da pilha</span>
              <h2 className="headline mt-3 text-[clamp(1.5rem,3vw,2.1rem)]">
                {kept.length > 0 ? `Você separou ${kept.length}.` : "Nenhuma passou no teste."}
              </h2>
              <p className="mt-4 text-[15px] leading-[1.66] text-text-secondary">
                {kept.length > 0
                  ? "Dá para levar para o Spotify agora, ou mover a mira e buscar mais."
                  : "Mova a mira e tente outro canto."}
              </p>

              <div className="mt-6 flex flex-wrap gap-1.5">
                {kept.length > 0 && (
                  <Key ink onClick={handleExport}>
                    <ListPlus className="h-3.5 w-3.5" />
                    levar {kept.length} para o Spotify
                  </Key>
                )}
                <Key onClick={() => void load(proximity, fame)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  buscar mais
                </Key>
              </div>
            </section>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showExport && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-title"
              className="w-full max-w-lg border border-border bg-background-secondary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h3 id="export-title" className="eyebrow text-text-primary">
                  Levar para o Spotify
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExport(false)}
                  aria-label="Fechar"
                  className="key key-sm px-2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-5">
                {exporting && (
                  <p className="data flex items-center gap-2 py-6 text-text-muted">
                    <span className="led" data-on="true" style={{ animation: "gy-blink 0.7s steps(1) infinite" }} />
                    procurando as faixas no Spotify
                  </p>
                )}

                {!exporting && exportResult?.error && (
                  <p className="border border-status-error/50 bg-well p-4 text-sm text-status-error">
                    {exportResult.error}
                  </p>
                )}

                {!exporting && exportResult && !exportResult.error && (
                  <div className="space-y-5">
                    <p className="text-sm text-text-secondary">
                      <b className="text-text-primary">{exportResult.resolvedCount}</b> de{" "}
                      {exportResult.totalItems} faixas encontradas
                      {exportResult.mode === "SPOTIFY_API" ? " e a playlist já está na sua conta." : "."}
                    </p>

                    <div className="flex items-center gap-1.5">
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
                          className="key"
                        >
                          baixar .m3u
                        </button>
                      )}
                      {exportResult.playlistUrl && (
                        <a
                          href={exportResult.playlistUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="key key-ink flex-1 justify-center"
                        >
                          abrir no Spotify
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
