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
    <div className="relative space-y-12">
      <div className="chroma-aura pointer-events-none absolute -inset-x-40 -top-32 -z-10 h-[620px]" />

      <header className="border-b border-border pb-9 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="catalog text-accent">GY/03</span>
          <span className="label">Prensagens de teste</span>
        </div>
        <h1 className="headline mt-4 text-[clamp(2rem,4.8vw,3.4rem)]">
          <Reveal>Para ouvir depois</Reveal>
        </h1>
        <div className="mx-auto max-w-[52ch]">
          <ScreenLine
            screen="discovery"
            fallback="Ouça trinta segundos e decida. O que você marcar muda as próximas."
          />
        </div>
      </header>

      {/* a mesa de corte: a pessoa aponta o alvo, o motor procura perto dele */}
      <section className="mx-auto max-w-[600px] border border-border">
        <div className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-2.5">
          <span className="label">Mesa de corte</span>
          <span className="catalog">
            proximidade {String(proximity).padStart(3, "0")} · fama {String(fame).padStart(3, "0")}
          </span>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
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
                data-active={active}
                aria-pressed={active}
                className="tab whitespace-nowrap"
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 p-5 sm:p-6">
          <label className="grid grid-cols-[6.5rem_1fr_4rem] items-center gap-4">
            <span className="label">Proximidade</span>
            <input
              type="range"
              min={0}
              max={100}
              value={proximity}
              onChange={(event) => setProximity(Number(event.target.value))}
              className="pot"
              aria-label="Proximidade do seu gosto atual"
            />
            <span className="catalog text-right">
              {proximity < 35 ? "longe" : proximity > 70 ? "perto" : "meio"}
            </span>
          </label>

          <label className="grid grid-cols-[6.5rem_1fr_4rem] items-center gap-4">
            <span className="label">Fama</span>
            <input
              type="range"
              min={0}
              max={100}
              value={fame}
              onChange={(event) => setFame(Number(event.target.value))}
              className="pot"
              aria-label="Tamanho da plateia do artista"
            />
            <span className="catalog text-right">
              {fame < 35 ? "obscuro" : fame > 70 ? "famoso" : "meio"}
            </span>
          </label>

          <button
            type="button"
            onClick={() => void load(proximity, fame)}
            disabled={loading}
            className="stamp stamp-ink mx-auto"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "prensando…" : "prensar com esses ajustes"}
          </button>
        </div>
      </section>

      {error && (
        <p className="mx-auto max-w-[46ch] border border-status-error/40 bg-status-error/[0.07] p-4 text-center text-sm text-status-error">
          {error}
        </p>
      )}

      {loading && (
        <div className="mx-auto aspect-square w-full max-w-[420px] animate-pulse border border-border bg-surface-elevated" />
      )}

      {!loading && !error && queue.length === 0 && (
        <section className="py-14 text-center">
          <h2 className="headline mx-auto max-w-[22ch] text-[clamp(1.5rem,3vw,2.2rem)]">
            Nada novo com esses ajustes.
          </h2>
          <p className="liner mx-auto mt-4 max-w-[42ch]">
            Puxe a proximidade para longe ou a fama para baixo — é onde mora o que você ainda não ouviu.
          </p>
        </section>
      )}

      {!loading && !error && !finished && queue.length > 0 && (
        <DiscoveryStage queue={queue} index={index} onAction={handleAction} />
      )}

      {finished && (
        <section className="border-y border-border py-12 text-center">
          <span className="label">Fim da pilha</span>
          <h2 className="headline mx-auto mt-3 max-w-[20ch] text-[clamp(1.5rem,3vw,2.2rem)]">
            {kept.length > 0 ? `Você separou ${kept.length}.` : "Nenhuma passou no teste."}
          </h2>
          <p className="liner mx-auto mt-4 max-w-[42ch]">
            {kept.length > 0
              ? "Dá para levar para o Spotify agora, ou mexer na mesa de corte e prensar outra pilha."
              : "Mexa na mesa de corte e tente outro canto do mapa."}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {kept.length > 0 && (
              <button type="button" onClick={handleExport} className="stamp stamp-ink">
                <ListPlus className="h-3.5 w-3.5" />
                levar {kept.length} para o spotify
              </button>
            )}
            <button type="button" onClick={() => void load(proximity, fame)} className="stamp">
              <RotateCcw className="h-3.5 w-3.5" />
              prensar mais
            </button>
          </div>
        </section>
      )}

      {!loading && queue.length > 0 && !finished && (
        <p className="catalog block text-center">
          prensagem {String(index + 1).padStart(2, "0")} de {String(queue.length).padStart(2, "0")} ·{" "}
          {kept.length} separadas
        </p>
      )}

      <AnimatePresence>
        {showExport && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg space-y-5 border border-border bg-surface p-6 shadow-lift"
              initial={{ opacity: 0, scale: 0.97, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-baseline gap-3">
                  <span className="catalog text-accent">GY/03·X</span>
                  <h3 className="section-title text-[0.9375rem]">Levar para o Spotify</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExport(false)}
                  aria-label="Fechar"
                  className="p-1.5 text-text-muted transition-colors hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {exporting && (
                <div className="space-y-3 py-8 text-center">
                  <span className="mx-auto block h-7 w-7 animate-spin rounded-full border border-accent border-t-transparent" />
                  <p className="label">Procurando as faixas…</p>
                </div>
              )}

              {!exporting && exportResult?.error && (
                <p className="border border-status-error/40 bg-status-error/[0.07] p-4 text-xs text-status-error">
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
                        className="stamp"
                      >
                        baixar .m3u
                      </button>
                    )}
                    {exportResult.playlistUrl && (
                      <a
                        href={exportResult.playlistUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="stamp stamp-ink flex-1 justify-center"
                      >
                        abrir no spotify
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
