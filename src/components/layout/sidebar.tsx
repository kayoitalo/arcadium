"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  Settings,
  Disc3,
  TrendingUp,
  Compass,
  Play,
} from "lucide-react";

const navItems = [
  { href: "/overview", label: "OVERVIEW", icon: LayoutDashboard },
  { href: "/taste-evolution", label: "TASTE EVOLUTION", icon: TrendingUp },
  { href: "/discovery", label: "DISCOVERY", icon: Compass },
  { href: "/history", label: "HISTORY", icon: History },
  { href: "/settings", label: "SETTINGS", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-background-secondary border-r border-border/80 flex flex-col min-h-screen p-5 sticky top-0 h-screen z-30 justify-between select-none">
      <div className="space-y-7">
        {/* Brand Header / Magazine Masthead */}
        <div className="px-2 pt-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent shadow-glow flex-shrink-0">
            <span className="font-serif font-black text-xl tracking-tighter text-accent-gold">MI</span>
          </div>
          <div>
            <h1 className="font-serif text-lg leading-none font-bold tracking-wider text-text-primary">
              MUSIC
            </h1>
            <p className="text-[10px] tracking-[0.2em] text-text-muted uppercase font-mono mt-0.5">
              INTELLIGENCE
            </p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-2 font-mono">
            JOURNAL EDITIONS
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-all group ${
                    isActive
                      ? "bg-accent/15 text-text-primary border border-accent/40 shadow-glow"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-accent-gold" : "text-text-muted group-hover:text-text-secondary"}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-gold shadow-[0_0_8px_#c59a60]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Beethoven Editorial Quote */}
        <div className="p-4 rounded-xl bg-surface border border-border/60 space-y-2">
          <p className="font-serif italic text-xs text-text-secondary leading-relaxed">
            "Music is a higher revelation than all wisdom & philosophy."
          </p>
          <span className="block text-[10px] text-text-muted font-mono text-right">
            — Ludwig van Beethoven
          </span>
        </div>
      </div>

      {/* Footer / User Profile & Mini Player */}
      <div className="space-y-3 pt-4 border-t border-border/60">
        {/* User Card */}
        <div className="flex items-center gap-3 p-2 rounded-xl bg-surface-elevated/40 border border-border/40">
          <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-bold text-accent-gold text-xs shadow-card">
            AM
          </div>
          <div className="flex-1 overflow-hidden">
            <span className="text-xs font-bold text-text-primary block truncate">
              Alex Morgan
            </span>
            <span className="text-[10px] text-accent-gold block font-mono">
              Premium Member
            </span>
          </div>
        </div>

        {/* Mini Now-Playing Widget */}
        <div className="p-3 rounded-xl bg-surface border border-border/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-surface-soft border border-border/60 flex items-center justify-center text-accent flex-shrink-0 relative overflow-hidden">
              <Disc3 className="w-4 h-4 text-accent-gold animate-spin-slow" />
            </div>
            <div className="truncate">
              <span className="text-xs font-semibold text-text-primary block truncate">
                Deftones
              </span>
              <span className="text-[10px] text-text-muted block truncate font-mono">
                Genesis
              </span>
            </div>
          </div>
          <button className="p-1.5 rounded-full bg-accent/20 hover:bg-accent/30 text-accent-gold transition-colors flex-shrink-0">
            <Play className="w-3.5 h-3.5 fill-accent-gold" />
          </button>
        </div>
      </div>
    </aside>
  );
}
