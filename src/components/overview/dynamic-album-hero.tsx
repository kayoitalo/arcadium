"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { AlbumItem } from "@/modules/statistics/application/overview-service";

interface DynamicAlbumHeroProps {
  albums: AlbumItem[];
}

export function DynamicAlbumHero({ albums }: DynamicAlbumHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleChange = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  const primaryAlbum = albums[0] || {
    title: "Koi No Yokan",
    artistName: "Deftones",
    coverUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop",
  };

  const secondaryAlbums = albums.slice(1, 5);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-[320px] sm:h-[380px] md:h-[420px] flex items-center justify-center overflow-hidden rounded-2xl bg-surface/40 border border-border/60 p-4 group select-none"
      style={{ perspective: "1000px" }}
    >
      {/* Ambient Blurred Glow Background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-accent-copper/20 via-accent/10 to-transparent blur-3xl pointer-events-none transition-all duration-700 opacity-70 group-hover:opacity-100" />
      
      {/* Editorial Grid Backing Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#332c25_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* 2.5D Collage Wrapper */}
      <div
        className="relative w-full h-full max-w-xl flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transform: reducedMotion
            ? "none"
            : `rotateY(${mousePos.x * 12}deg) rotateX(${-mousePos.y * 12}deg)`,
        }}
      >
        {/* Layer 5: Background Album 4 (Small, Back Left) */}
        {secondaryAlbums[3] && (
          <div
            className="absolute left-4 top-10 w-28 h-28 sm:w-36 sm:h-36 rounded-lg overflow-hidden border border-border/80 shadow-magazine transition-transform duration-500 opacity-60 hover:opacity-100 group-hover:scale-105"
            style={{
              transform: `translate3d(${mousePos.x * -15}px, ${mousePos.y * -15}px, -120px) rotate(-12deg)`,
            }}
          >
            <img
              src={secondaryAlbums[3].coverUrl}
              alt={secondaryAlbums[3].title}
              className="w-full h-full object-cover filter brightness-75 hover:brightness-100 transition-all"
            />
          </div>
        )}

        {/* Layer 4: Background Album 3 (Small, Back Right) */}
        {secondaryAlbums[2] && (
          <div
            className="absolute right-6 bottom-10 w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden border border-border/80 shadow-magazine transition-transform duration-500 opacity-70 hover:opacity-100 group-hover:scale-105"
            style={{
              transform: `translate3d(${mousePos.x * -25}px, ${mousePos.y * -25}px, -80px) rotate(8deg)`,
            }}
          >
            <img
              src={secondaryAlbums[2].coverUrl}
              alt={secondaryAlbums[2].title}
              className="w-full h-full object-cover filter brightness-85 hover:brightness-100 transition-all"
            />
          </div>
        )}

        {/* Layer 3: Secondary Album 2 (Medium, Top Right) */}
        {secondaryAlbums[1] && (
          <div
            className="absolute right-12 sm:right-20 top-6 w-36 h-36 sm:w-48 sm:h-48 rounded-xl overflow-hidden border border-border/90 shadow-magazine transition-transform duration-500 opacity-85 hover:opacity-100 z-10"
            style={{
              transform: `translate3d(${mousePos.x * -35}px, ${mousePos.y * -35}px, -30px) rotate(-5deg)`,
            }}
          >
            <img
              src={secondaryAlbums[1].coverUrl}
              alt={secondaryAlbums[1].title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
              <span className="text-[11px] font-bold text-text-primary truncate">{secondaryAlbums[1].title}</span>
              <span className="text-[9px] text-text-secondary truncate">{secondaryAlbums[1].artistName}</span>
            </div>
          </div>
        )}

        {/* Layer 2: Secondary Album 1 (Medium, Mid Left) */}
        {secondaryAlbums[0] && (
          <div
            className="absolute left-10 sm:left-16 bottom-8 w-40 h-40 sm:w-52 sm:h-52 rounded-xl overflow-hidden border border-border/90 shadow-magazine transition-transform duration-500 opacity-90 hover:opacity-100 z-10"
            style={{
              transform: `translate3d(${mousePos.x * -45}px, ${mousePos.y * -45}px, 0px) rotate(6deg)`,
            }}
          >
            <img
              src={secondaryAlbums[0].coverUrl}
              alt={secondaryAlbums[0].title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Layer 1: Primary Album (Large Center Front Element) */}
        <div
          className="relative z-20 w-48 h-48 sm:w-60 sm:h-60 rounded-2xl overflow-hidden border border-accent/40 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(180,122,70,0.25)] transition-transform duration-300"
          style={{
            transform: `translate3d(${mousePos.x * 35}px, ${mousePos.y * 35}px, 50px) rotate(-2deg)`,
          }}
        >
          <img
            src={primaryAlbum.coverUrl}
            alt={primaryAlbum.title}
            className="w-full h-full object-cover"
          />

          {/* Interactive Badge / Red Dot Callout */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md border border-accent/40 shadow-glow">
            <span className="w-2 h-2 rounded-full bg-status-error animate-ping" />
            <span className="w-2 h-2 rounded-full bg-status-error absolute top-1.5 right-2.5" />
            <span className="text-[10px] font-mono font-bold tracking-wider text-text-primary uppercase ml-1.5">
              #1 ALBUM
            </span>
          </div>

          {/* Album Title Banner at Bottom */}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-background via-background/80 to-transparent">
            <span className="text-xs font-bold text-text-primary block truncate font-serif">
              {primaryAlbum.title}
            </span>
            <span className="text-[10px] text-accent-gold block truncate font-mono">
              {primaryAlbum.artistName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
