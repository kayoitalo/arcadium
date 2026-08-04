"use client";

import { useState } from "react";
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

const INITIAL_RECOMMENDATIONS: Candidate[] = [
  {
    id: "rec-1",
    artistName: "Cult of Luna",
    trackName: "The Long Road North",
    albumName: "The Long Road North",
    coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop",
    genre: "Post Metal / Atmospheric Sludge",
    confidenceScore: 94,
    reason: "Match determinístico de 94%. Recomendado porque você aumentou em 128% o consumo de Sludge Metal e ouviu Deftones frequentemente.",
  },
  {
    id: "rec-2",
    artistName: "Chat Pile",
    trackName: "Slaughterhouse",
    albumName: "God's Country",
    coverUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
    genre: "Noise Rock / Sludge Metal",
    confidenceScore: 89,
    reason: "Match de 89%. Banda em ascensão rápida no seu perfil com sonoridade crua baseada em linhas afiadas de baixo e vocais viscerais.",
  },
  {
    id: "rec-3",
    artistName: "Julie Christmas",
    trackName: "Supernatural",
    albumName: "Ridiculous And Full Of Blood",
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
    genre: "Post Metal / Experimental",
    confidenceScore: 85,
    reason: "Match de 85%. Apresenta dinâmicas vocais dramáticas e arranjos pesados em colaboração com músicos de Cult of Luna.",
  },
  {
    id: "rec-4",
    artistName: "Chelsea Wolfe",
    trackName: "Dusk",
    albumName: "She Reaches Out To She Reaches Out To She",
    coverUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=600&auto=format&fit=crop",
    genre: "Gothic Rock / Industrial",
    confidenceScore: 82,
    reason: "Match de 82%. Combina elementos eletrônicos escuros e guitarras graves, alinhado à sua recente queda em gêneros pop.",
  },
];

export default function DiscoveryPage() {
  const [mode, setMode] = useState<"safe" | "balanced" | "experimental">("balanced");
  const [context, setContext] = useState<string>("general");
  const [items, setItems] = useState<Candidate[]>(INITIAL_RECOMMENDATIONS);
  const [lastAction, setLastAction] = useState<{ id: string; prevFeedback?: Candidate["feedback"] } | null>(null);

  const handleFeedback = (id: string, action: Candidate["feedback"]) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          setLastAction({ id, prevFeedback: item.feedback });
          return { ...item, feedback: item.feedback === action ? undefined : action };
        }
        return item;
      })
    );
  };

  const handleUndo = () => {
    if (!lastAction) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === lastAction.id ? { ...item, feedback: lastAction.prevFeedback } : item
      )
    );
    setLastAction(null);
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
              onClick={() => setMode("safe")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                mode === "safe" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40 shadow-glow" : "text-text-secondary"
              }`}
            >
              Safe
            </button>
            <button
              onClick={() => setMode("balanced")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                mode === "balanced" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40 shadow-glow" : "text-text-secondary"
              }`}
            >
              Balanced
            </button>
            <button
              onClick={() => setMode("experimental")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                mode === "experimental" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40 shadow-glow" : "text-text-secondary"
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
              <option value="general" className="bg-surface text-text-primary">Context: General</option>
              <option value="working" className="bg-surface text-text-primary">Context: Working</option>
              <option value="relaxing" className="bg-surface text-text-primary">Context: Relaxing</option>
              <option value="night" className="bg-surface text-text-primary">Context: Late Night</option>
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
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-mono font-bold hover:bg-accent-hover transition-all shadow-glow">
            <ListPlus className="w-4 h-4" />
            <span>EXPORTAR PLAYLIST SPOTIFY</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
