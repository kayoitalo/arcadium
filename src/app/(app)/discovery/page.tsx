"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListPlus, RotateCcw, X } from "lucide-react";
import { useChroma } from "@/components/chroma/chroma-provider";
import { DiscoveryStage, type StageAction, type StageCandidate } from "@/components/discovery/discovery-stage";
import { ScreenLine } from "@/components/ui/screen-line";
import { EASE_OUT_EXPO, Reveal } from "@/components/ui/motion";

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
    adoptCover(current?.coverUrl);
  }, [current?.coverUrl, adoptCover]);

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
    <div className="relative space-y-10 pb-10">
      <div className="chroma-aura pointer-events-none absolute -inset-x-40 -top-32 -z-10 h-[620px]" />

      <header className="text-center">
        <span className="eyebrow">A partir de tudo o que você já ouviu</span>
        <h1 className="display-xl mt-4 text-[clamp(2rem,4.6vw,3.4rem)]">
          <Reveal>Para ouvir depois</Reveal>
        </h1>
        <div className="mx-auto max-w-[52ch]">
          <ScreenLine
            screen="discovery"
            fallback="Ouça trinta segundos e decida. O que você marcar muda as próximas."
          />
        </div>
      </header>

      {/* os dois controles: a pessoa aponta o alvo, o motor procura perto dele */}
      <section className="mx-auto grid max-w-[560px] gap-5 border-y border-border py-6">
        <div className="flex flex-wrap justify-center gap-2">
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
                className={`relative isolate rounded-full px-3.5 py-1.5 font-mono text-[10px] transition-colors ${
                  active ? "text-background" : "text-text-muted hover:text-text-primary"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="discovery-preset"
                    className="absolute inset-0 z-0 rounded-full bg-text-primary"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{preset.label}</span>
              </button>
            );
          })}
        </div>

        <label className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3">
          <span className="eyebrow">Proximidade</span>
          <input
            type="range"
            min={0}
            max={100}
            value={proximity}
            onChange={(event) => setProximity(Number(event.target.value))}
            className="accent-[var(--chroma)]"
            aria-label="Proximidade do seu gosto atual"
          />
          <span className="text-right font-mono text-[10px] text-text-muted">
            {proximity < 35 ? "longe" : proximity > 70 ? "perto" : "meio"}
          </span>
        </label>

        <label className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3">
          <span className="eyebrow">Fama</span>
          <input
            type="range"
            min={0}
            max={100}
            value={fame}
            onChange={(event) => setFame(Number(event.target.value))}
            className="accent-[var(--chroma)]"
            aria-label="Tamanho da plateia do artista"
          />
          <span className="text-right font-mono text-[10px] text-text-muted">
            {fame < 35 ? "obscuro" : fame > 70 ? "famoso" : "meio"}
          </span>
        </label>

        <button
          type="button"
          onClick={() => void load(proximity, fame)}
          disabled={loading}
          className="mx-auto inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold text-background transition-transform hover:scale-[1.02] disabled:opacity-30"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "procurando…" : "buscar com esses ajustes"}
        </button>
      </section>

      {error && (
        <p className="mx-auto max-w-[46ch] rounded-lg border border-status-error/30 bg-status-error/10 p-4 text-center text-sm text-status-error">
          {error}
        </p>
      )}

      {loading && <div className="mx-auto aspect-square w-full max-w-[420px] animate-pulse rounded-sm bg-surface-elevated" />}

      {!loading && !error && queue.length === 0 && (
        <section className="py-14 text-center">
          <h2 className="display-lg mx-auto max-w-[22ch] text-[clamp(1.5rem,3vw,2.2rem)]">
            Nada novo com esses ajustes.
          </h2>
          <p className="mx-auto mt-4 max-w-[42ch] text-sm text-text-secondary">
            Puxe a proximidade para longe ou a fama para baixo — é onde mora o que você ainda não ouviu.
          </p>
        </section>
      )}

      {!loading && !error && !finished && queue.length > 0 && (
        <DiscoveryStage queue={queue} index={index} onAction={handleAction} />
      )}

      {finished && (
        <section className="py-12 text-center">
          <h2 className="display-lg mx-auto max-w-[20ch] text-[clamp(1.5rem,3vw,2.2rem)]">
            {kept.length > 0 ? `Você separou ${kept.length}.` : "Nenhuma passou no teste."}
          </h2>
          <p className="mx-auto mt-4 max-w-[42ch] text-sm text-text-secondary">
            {kept.length > 0
              ? "Dá para levar para o Spotify agora, ou mexer nos controles e buscar mais."
              : "Mexa nos controles e tente outro canto do mapa."}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {kept.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold text-background"
              >
                <ListPlus className="h-4 w-4" />
                levar {kept.length} para o Spotify
              </button>
            )}
            <button
              type="button"
              onClick={() => void load(proximity, fame)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              buscar mais
            </button>
          </div>
        </section>
      )}

      {!loading && queue.length > 0 && !finished && (
        <p className="text-center font-mono text-[10px] text-text-muted">
          {index + 1} de {queue.length} · {kept.length} separadas
        </p>
      )}

      <AnimatePresence>
        {showExport && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg space-y-5 rounded-xl border border-border bg-surface p-6 shadow-lift"
              initial={{ opacity: 0, scale: 0.97, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg tracking-tight">Levar para o Spotify</h3>
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
                  <p className="font-mono text-[11px] text-text-muted">Procurando as faixas…</p>
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
                    <b className="text-text-primary">{exportResult.resolvedCount}</b> de {exportResult.totalItems}{" "}
                    faixas encontradas
                    {exportResult.mode === "SPOTIFY_API" ? " e a playlist já está na sua conta." : "."}
                  </p>

                  <div className="flex items-center gap-3">
                    {exportResult.m3uPayload && (
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([exportResult.m3uPayload as string], { type: "audio/x-mpegurl" });
                          const url = URL.createObjectURL(blob);
                          const anchor = document.createElement("a");
                          anchor.href = url;
                          anchor.download = `${exportResult.playlistTitle ?? "grooveyard"}.m3u`;
                          anchor.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="rounded-full border border-border px-4 py-2 font-mono text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
                      >
                        baixar .m3u
                      </button>
                    )}
                    {exportResult.playlistUrl && (
                      <a
                        href={exportResult.playlistUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-full bg-accent px-5 py-2.5 text-center font-mono text-[11px] font-semibold text-background"
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
