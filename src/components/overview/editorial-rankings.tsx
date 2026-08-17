"use client";

import { TopArtistItem } from "@/modules/statistics/application/overview-service";

interface EditorialRankingsProps {
  topArtists: TopArtistItem[];
}

export function EditorialRankings({ topArtists }: EditorialRankingsProps) {
  const getAvatarGradient = (name: string) => {
    const charCode = name.charCodeAt(0) || 65;
    const hue = (charCode * 37) % 360;
    return `hsl(${hue}, 40%, 25%)`;
  };

  return (
    <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-text-muted uppercase">
          ARTISTAS MAIS OUVIDOS
        </span>
      </div>

      {/* List */}
      <div className="space-y-4">
        {topArtists.length === 0 && <p className="text-xs text-text-muted">Sem artistas no período selecionado.</p>}
        {topArtists.slice(0, 5).map((artist, idx) => {
          const rankNum = (idx + 1).toString().padStart(2, "0");

          return (
            <div
              key={artist.name}
              className="flex items-center justify-between gap-4 p-2.5 rounded-xl hover:bg-surface-elevated/60 transition-all group"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Large Rank Number */}
                <span className="font-serif text-xl sm:text-2xl font-bold text-text-muted group-hover:text-accent-gold transition-colors w-7">
                  {rankNum}
                </span>

                {/* Artist Avatar Circle */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold text-text-primary text-sm shadow-card border border-border/60 flex-shrink-0"
                  style={{ backgroundColor: getAvatarGradient(artist.name) }}
                >
                  {artist.name.charAt(0).toUpperCase()}
                </div>

                {/* Name & Metadata */}
                <div className="truncate">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm font-semibold text-text-primary block truncate group-hover:text-accent-gold transition-colors">
                      {artist.name}
                    </span>
                    {artist.country && (
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-accent-copper/20 text-accent-gold border border-accent-copper/30 uppercase flex-shrink-0">
                        {artist.country}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono truncate">
                    <span>{(artist.share * 100).toFixed(1)}% das audições</span>
                    {artist.tags && artist.tags.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-accent-gold/80 truncate capitalize">
                          {artist.tags[0]}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrobbles Count */}
              <div className="text-right flex-shrink-0">
                <span className="text-xs font-bold text-text-primary block font-mono">
                  {artist.plays.toLocaleString("pt-BR")} AUDIÇÕES
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
