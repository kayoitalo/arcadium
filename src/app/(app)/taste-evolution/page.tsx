"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  Clock,
  Compass,
  Layers,
  BarChart2,
  Info,
} from "lucide-react";

export default function TasteEvolutionPage() {
  const [timeframe, setTimeframe] = useState<"30d" | "90d" | "1y">("30d");

  const risingGenres = [
    { name: "Sludge Metal", change: 128, share: "18.4%", artists: "Chat Pile, Thou, Acid Bath" },
    { name: "Drone Metal", change: 96, share: "12.1%", artists: "Sunn O))), Earth" },
    { name: "Industrial", change: 72, share: "9.8%", artists: "Nine Inch Nails, Health" },
    { name: "Post Metal", change: 45, share: "8.2%", artists: "Cult of Luna, Isis" },
    { name: "Math Rock", change: 31, share: "6.5%", artists: "Slint, Don Caballero" },
  ];

  const decliningGenres = [
    { name: "Pop", change: -61, share: "3.2%", artists: "Dua Lipa, Chappell Roan" },
    { name: "Dance Pop", change: -58, share: "2.1%", artists: "Charli xcx" },
    { name: "Hip Hop", change: -44, share: "5.4%", artists: "Kendrick Lamar, Travis Scott" },
    { name: "Indie Pop", change: -35, share: "4.0%", artists: "Phoenix, Clairo" },
    { name: "R&B", change: -29, share: "2.8%", artists: "Frank Ocean, SZA" },
  ];

  const risingArtists = [
    { name: "Chat Pile", plays: 142, growth: "+310%", cover: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400&auto=format&fit=crop" },
    { name: "Deftones", plays: 288, growth: "+180%", cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop" },
    { name: "Cult of Luna", plays: 98, growth: "+140%", cover: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop" },
    { name: "Julie Christmas", plays: 76, growth: "+115%", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop" },
  ];

  return (
    <div className="space-y-10 pb-16">
      {/* Article Header */}
      <header className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-accent-gold uppercase">
              EDITORIAL FEATURE
            </span>
            <span className="text-text-muted text-xs">•</span>
            <span className="text-[10px] font-mono text-text-muted uppercase">TASTE SHIFT REPORT</span>
          </div>

          {/* Timeframe selector */}
          <div className="flex p-1 rounded-xl bg-surface border border-border/60 text-xs font-mono">
            <button
              onClick={() => setTimeframe("30d")}
              className={`px-3 py-1 rounded-lg transition-all ${
                timeframe === "30d" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40" : "text-text-secondary"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeframe("90d")}
              className={`px-3 py-1 rounded-lg transition-all ${
                timeframe === "90d" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40" : "text-text-secondary"
              }`}
            >
              90 Days
            </button>
            <button
              onClick={() => setTimeframe("1y")}
              className={`px-3 py-1 rounded-lg transition-all ${
                timeframe === "1y" ? "bg-accent/20 text-accent-gold font-bold border border-accent/40" : "text-text-secondary"
              }`}
            >
              1 Year
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.08] text-text-primary">
            A sua metamorfose sonora: como o seu gosto migrou para timbres mais densos.
          </h1>
          <p className="text-text-secondary text-base sm:text-lg leading-relaxed font-sans font-normal max-w-2xl">
            Uma análise matemática e narrativa comparando suas últimas audições com o período anterior. O som limpo do pop cedeu espaço para distorções orgânicas, affinidades mais graves e exploração de bandas obscuras.
          </p>
        </div>
      </header>

      {/* Primary Narrative Spotlight */}
      <section className="p-8 rounded-2xl bg-surface/50 border border-border/60 space-y-6 relative overflow-hidden">
        <div className="absolute -right-16 -bottom-16 w-72 h-72 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 text-accent-gold text-xs font-mono font-bold tracking-wider uppercase">
          <Sparkles className="w-4 h-4" />
          <span>AI & DETERMINISTIC ANALYSIS</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4 font-serif text-lg text-text-primary leading-relaxed">
            <p className="first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:text-accent-gold first-letter:font-serif">
              Nos últimos 30 dias, 68% do seu tempo de reprodução esteve concentrado em produções com arranjos pesados e timbres distorcidos. A sua densidade sonora média aumentou em +42% comparada ao mês passado.
            </p>
            <p className="text-base font-sans text-text-secondary leading-relaxed">
              Enquanto gêneros comerciais como Pop e Dance Pop registraram uma queda acentuada (acima de -55%), vertentes como <strong className="text-text-primary">Sludge Metal</strong>, <strong className="text-text-primary">Drone Metal</strong> e <strong className="text-text-primary">Industrial</strong> ganharam força de catálogo. Essa alteração indica um ciclo de audição focado em catarse, texturas de guitarra e estruturas de música não convencionais.
            </p>
          </div>

          <div className="lg:col-span-4 p-5 rounded-xl bg-surface border border-border/70 space-y-4 text-xs font-mono">
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-text-muted">Catalog Concentration</span>
              <span className="text-accent-gold font-bold">Medium High (47%)</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-text-muted">Exploration Index</span>
              <span className="text-status-success font-bold">+28% New Artists</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Dominant Texture</span>
              <span className="text-text-primary font-bold">Heavy Distortion</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rising vs Declining Genres Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rising Panel */}
        <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-status-success" />
              <span className="text-xs font-mono font-bold tracking-wider text-text-primary uppercase">
                GÊNEROS EM ASCENSÃO
              </span>
            </div>
            <span className="text-[10px] font-mono text-text-muted">vs Período Anterior</span>
          </div>

          <div className="space-y-4">
            {risingGenres.map((g) => (
              <div key={g.name} className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border/40 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-text-primary">{g.name}</span>
                  <span className="text-status-success font-bold">+{g.change}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-accent-gold rounded-full"
                    style={{ width: `${Math.min(100, g.change)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-text-muted font-mono">
                  <span>Principais: {g.artists}</span>
                  <span>{g.share} do total</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Declining Panel */}
        <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-status-error" />
              <span className="text-xs font-mono font-bold tracking-wider text-text-primary uppercase">
                GÊNEROS EM QUEDA
              </span>
            </div>
            <span className="text-[10px] font-mono text-text-muted">vs Período Anterior</span>
          </div>

          <div className="space-y-4">
            {decliningGenres.map((g) => (
              <div key={g.name} className="p-3.5 rounded-xl bg-surface-elevated/40 border border-border/40 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-medium text-text-secondary">{g.name}</span>
                  <span className="text-status-error font-bold">{g.change}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-status-error/40 rounded-full"
                    style={{ width: `${Math.abs(g.change)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-text-muted font-mono">
                  <span>Reduzidos: {g.artists}</span>
                  <span>{g.share} do total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Breakout Artists Spotlight */}
      <section className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <span className="text-xs font-mono font-bold tracking-wider text-text-primary uppercase">
            ARTISTAS COM MAIOR CRESCIMENTO NO PERÍODO
          </span>
          <span className="text-[10px] font-mono text-accent-gold uppercase">BREAKOUT CATALOG</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {risingArtists.map((artist) => (
            <div
              key={artist.name}
              className="p-4 rounded-xl bg-surface border border-border/60 space-y-3 group hover:border-accent/40 transition-all"
            >
              <div className="w-full aspect-square rounded-lg overflow-hidden border border-border/60 shadow-card">
                <img
                  src={artist.cover}
                  alt={artist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div>
                <span className="font-serif text-lg font-bold text-text-primary block group-hover:text-accent-gold transition-colors">
                  {artist.name}
                </span>
                <div className="flex justify-between items-center text-xs font-mono mt-1">
                  <span className="text-text-muted">{artist.plays} scrobbles</span>
                  <span className="text-status-success font-bold">{artist.growth}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
