"use client";

import { useState, useEffect } from "react";
import {
  Compass,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Bookmark,
  RotateCcw,
  Play,
  Sparkles,
  Share2,
  ListPlus,
  Sliders,
} from "lucide-react";

interface Candidate {
  id: string;
  artistName: string;
  trackName: string;
  albumName: string;
  coverUrl: string;
  genre: string;
  confidenceScore: number;
  reason: string;
  feedback?: "liked" | "disliked" | "known" | "saved";
}

export default function DiscoveryPage() {
  const [mode, setMode] = useState<"SAFE" | "BALANCED" | "EXPERIMENTAL">("BALANCED");
  const [context, setContext] = useState<string>("GENERAL");
  const [items, setItems] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{ id: string; prevFeedback?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [mode, context]);

  const fetchSession = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, context }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSessionId(data.sessionId || null);
      }
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (id: string, action: string) => {
    if (!sessionId) return;
    
    // Convert lower-case action to upper-case API enum
    const typeMap: Record<string, string> = {
      liked: "LIKED",
      disliked: "DISLIKED",
      known: "ALREADY_KNOW",
      saved: "SAVE_FOR_LATER"
    };
    
    const apiType = typeMap[action];
    
    // Optimistic UI update
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          setLastAction({ id, prevFeedback: item.feedback });
          return { ...item, feedback: item.feedback === action ? undefined : action };
        }
        return item;
      })
    );
    
    // Call API
    try {
      await fetch(`/api/recommendations/${sessionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: id, type: apiType }),
      });
    } catch (err) {
      console.error("Feedback failed:", err);
      // Could revert optimistic update here
    }
  };

  const handleUndo = () => {
    // Basic optimistic undo (MVP) - real undo would need an API endpoint
    if (!lastAction) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === lastAction.id ? { ...item, feedback: lastAction.prevFeedback } : item
      )
    );
    setLastAction(null);
  };

  const handleExportSpotify = async () => {
    setExporting(true);
    setShowExportModal(true);
    setExportResult(null);

    // Filter tracks to export: liked or saved items, or all items if none specifically reacted
    const selection = items.filter((i) => i.feedback === "liked" || i.feedback === "saved");
    const tracksToExport = (selection.length > 0 ? selection : items).map((i) => ({
      trackName: i.trackName,
      artistName: i.artistName,
    }));

    try {
      const res = await fetch("/api/spotify/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: tracksToExport }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      setExportResult(data.data);
    } catch (err: any) {
      setExportResult({ error: err?.message || "Export failed" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <header className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-accent-gold" />
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-text-muted uppercase">
              MUSIC DISCOVERY ENGINE
            </span>
          </div>

          {/* Mode Selector */}
          <div className="flex p-1 rounded-xl bg-surface border border-border/60 text-xs font-mono">
            <button
              onClick={() => setMode("SAFE")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                mode === "SAFE" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40 shadow-glow" : "text-text-secondary"
              }`}
            >
              Safe
            </button>
            <button
              onClick={() => setMode("BALANCED")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                mode === "BALANCED" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40 shadow-glow" : "text-text-secondary"
              }`}
            >
              Balanced
            </button>
            <button
              onClick={() => setMode("EXPERIMENTAL")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                mode === "EXPERIMENTAL" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40 shadow-glow" : "text-text-secondary"
              }`}
            >
              Experimental
            </button>
          </div>
        </div>

        {/* Narrative Headline */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight text-text-primary">
              Descoberta Guiada: recomendações baseadas na sua metamorfose.
            </h1>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed font-sans">
              Cada candidato é selecionado por regras determinísticas combinando seu histórico recente, diversidade de catálogo e matrizes de afinidade. Reaja a cada recomendação para ajustar os próximos ciclos.
            </p>
          </div>

          {/* Context Selector */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-surface border border-border/60 text-xs font-mono text-text-secondary">
            <Sliders className="w-3.5 h-3.5 text-accent-gold" />
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="bg-transparent focus:outline-none text-text-primary cursor-pointer pr-2"
            >
              <option value="GENERAL" className="bg-surface text-text-primary">Context: General</option>
              <option value="WORKING" className="bg-surface text-text-primary">Context: Working</option>
              <option value="RELAXING" className="bg-surface text-text-primary">Context: Relaxing</option>
              <option value="NIGHT" className="bg-surface text-text-primary">Context: Late Night</option>
            </select>
          </div>
        </div>
      </header>

      {/* Undo Notification Bar */}
      {lastAction && (
        <div className="p-3 rounded-xl bg-surface border border-accent/40 flex items-center justify-between text-xs font-mono text-text-primary shadow-glow">
          <span>Reação atualizada para a recomendação.</span>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 text-accent-gold hover:underline font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>DESFAZER (UNDO)</span>
          </button>
        </div>
      )}

      {/* Recommendation Grid */}
      {loading ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 rounded-2xl bg-surface/20 border border-border/40 animate-pulse h-64"></div>
          ))}
        </section>
      ) : (
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {items.map((candidate) => {
          const isLiked = candidate.feedback === "liked";
          const isDisliked = candidate.feedback === "disliked";
          const isKnown = candidate.feedback === "known";
          const isSaved = candidate.feedback === "saved";

          return (
            <div
              key={candidate.id}
              className={`p-6 rounded-2xl bg-surface/40 border transition-all duration-300 space-y-5 flex flex-col justify-between group ${
                isDisliked
                  ? "opacity-40 border-border/40 grayscale"
                  : isLiked
                  ? "border-accent-gold/60 shadow-glow bg-surface/60"
                  : "border-border/60 hover:border-accent/40"
              }`}
            >
              <div className="space-y-4">
                {/* Header info */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-border/60 shadow-magazine flex-shrink-0">
                      <img
                        src={candidate.coverUrl}
                        alt={candidate.artistName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-accent-gold uppercase tracking-wider block">
                        {candidate.genre}
                      </span>
                      <h3 className="font-serif text-xl font-bold text-text-primary leading-tight group-hover:text-accent-gold transition-colors">
                        {candidate.artistName}
                      </h3>
                      <p className="text-xs text-text-secondary font-mono mt-0.5">
                        {candidate.trackName} — <span className="italic">{candidate.albumName}</span>
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent-gold text-[10px] font-mono font-bold flex-shrink-0">
                    {candidate.confidenceScore}% MATCH
                  </span>
                </div>

                {/* Evidence narrative */}
                <div className="p-3.5 rounded-xl bg-surface-soft border border-border/60 text-xs text-text-secondary leading-relaxed font-sans">
                  {candidate.reason}
                </div>
              </div>

              {/* Feedback Actions Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs font-mono">
                <div className="flex items-center gap-2">
                  {/* Liked */}
                  <button
                    onClick={() => handleFeedback(candidate.id, "liked")}
                    className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                      isLiked
                        ? "bg-status-success/20 text-status-success border-status-success/50 font-bold"
                        : "bg-surface border-border/60 text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Curtir</span>
                  </button>

                  {/* Disliked */}
                  <button
                    onClick={() => handleFeedback(candidate.id, "disliked")}
                    className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                      isDisliked
                        ? "bg-status-error/20 text-status-error border-status-error/50 font-bold"
                        : "bg-surface border-border/60 text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Não Curtir</span>
                  </button>

                  {/* Already Know */}
                  <button
                    onClick={() => handleFeedback(candidate.id, "known")}
                    className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                      isKnown
                        ? "bg-accent/20 text-accent-gold border-accent/50 font-bold"
                        : "bg-surface border-border/60 text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Já Conheço</span>
                  </button>
                </div>

                {/* Save for later */}
                <button
                  onClick={() => handleFeedback(candidate.id, "saved")}
                  className={`p-2 rounded-lg border transition-all ${
                    isSaved
                      ? "bg-accent-gold text-background border-accent-gold"
                      : "bg-surface border-border/60 text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </section>
      )}

      {/* Session Export & Persistence Bar */}
      <footer className="p-6 rounded-2xl bg-surface/50 border border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="font-serif text-lg font-bold text-text-primary block">
            Sessão de Descoberta Ativa
          </span>
          <p className="text-xs text-text-secondary font-sans">
            Você deu feedback em {items.filter((i) => i.feedback).length} de {items.length} candidatos nesta sessão.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2.5 rounded-xl bg-surface border border-border/80 text-text-primary text-xs font-mono font-bold hover:bg-surface-elevated transition-colors">
            SALVAR SESSÃO
          </button>
          <button
            onClick={handleExportSpotify}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-mono font-bold hover:bg-accent-hover transition-all shadow-glow"
          >
            <ListPlus className="w-4 h-4" />
            <span>EXPORTAR PLAYLIST SPOTIFY</span>
          </button>
        </div>
      </footer>

      {/* Spotify Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-surface border border-border space-y-5 shadow-magazine">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-accent-gold" />
                <h3 className="font-serif text-xl font-bold text-text-primary">
                  Exportar para o Spotify
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-xs font-mono text-text-muted hover:text-text-primary"
              >
                FECHAR
              </button>
            </div>

            {exporting ? (
              <div className="py-8 text-center space-y-3 font-mono text-xs text-text-secondary">
                <div className="w-8 h-8 mx-auto border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
                <p>Buscando faixas no catálogo do Spotify...</p>
              </div>
            ) : exportResult?.error ? (
              <div className="p-4 rounded-xl bg-status-error/15 border border-status-error/30 text-status-error text-xs font-mono">
                {exportResult.error}
              </div>
            ) : exportResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-elevated border border-border/60 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Playlist:</span>
                    <strong className="text-text-primary">{exportResult.playlistTitle}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Status:</span>
                    <span className="text-status-success font-bold">
                      {exportResult.mode === "SPOTIFY_API" ? "Playlist Criada no Spotify" : "Exportação Pronta"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Faixas Resolvidas:</span>
                    <strong className="text-text-primary">
                      {exportResult.resolvedCount} de {exportResult.totalItems}
                    </strong>
                  </div>
                </div>

                {/* Resolved list */}
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs font-mono">
                  {exportResult.items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface/60 border border-border/40"
                    >
                      <span className="truncate text-text-primary">
                        {item.artistName} — {item.trackName}
                      </span>
                      <a
                        href={item.webUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-gold hover:underline flex-shrink-0 ml-2 text-[10px]"
                      >
                        ABRIR NO SPOTIFY
                      </a>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  {exportResult.m3uPayload && (
                    <button
                      onClick={() => {
                        const blob = new Blob([exportResult.m3uPayload], { type: "audio/x-mpegurl" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${exportResult.playlistTitle}.m3u`;
                        a.click();
                      }}
                      className="px-4 py-2 rounded-xl bg-surface-elevated border border-border text-xs font-mono text-text-secondary hover:text-text-primary"
                    >
                      DOWNLOAD .M3U
                    </button>
                  )}
                  <a
                    href={exportResult.playlistUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-mono font-bold hover:bg-accent-hover shadow-glow"
                  >
                    ABRIR PLAYLIST NO SPOTIFY ↗
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

