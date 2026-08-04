"use client";

import { useState } from "react";
import { Settings, RefreshCw, Radio, CheckCircle, AlertCircle, Database } from "lucide-react";

export default function SettingsPage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger sync");
      }

      setMessage(
        `Sync completed successfully! Fetched: ${data.sync.fetched}, Inserted: ${data.sync.inserted}, Duplicates skipped: ${data.sync.duplicates}`
      );
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      {/* Editorial Header */}
      <header className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-1">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent-gold" />
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
            Settings & Integrations
          </h1>
        </div>
        <p className="text-text-secondary text-xs font-sans">
          Manage external providers, sync execution parameters, and local database settings.
        </p>
      </header>

      {/* Integration Card: Last.fm */}
      <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-copper/20 border border-accent-copper/40 flex items-center justify-center text-accent-gold font-bold text-lg">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-serif">Last.fm Ingestion Foundation</h2>
              <p className="text-xs text-text-secondary font-mono">Core listening history provider (`user.getRecentTracks`)</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success/15 border border-status-success/30 text-status-success text-xs font-mono font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            Active
          </span>
        </div>

        <form onSubmit={handleSync} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
              Last.fm Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your Last.fm username..."
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border/80 text-xs focus:outline-none focus:border-accent-gold text-text-primary placeholder:text-text-muted transition-colors font-sans"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-mono font-bold hover:bg-accent-hover transition-all shadow-glow disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Synchronizing History..." : "Connect & Synchronize"}
          </button>
        </form>

        {message && (
          <div className="p-4 rounded-xl bg-status-success/10 border border-status-success/30 text-status-success text-xs font-mono flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-status-error/10 border border-status-error/30 text-status-error text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* System Status Panel */}
      <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-accent-gold" />
          <h2 className="text-base font-bold text-text-primary font-serif">Database Infrastructure</h2>
        </div>
        <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border/40 space-y-2 text-xs text-text-secondary font-mono">
          <div className="flex justify-between">
            <span>Provider Source:</span>
            <strong className="text-text-primary">Neon PostgreSQL</strong>
          </div>
          <div className="flex justify-between">
            <span>Deduplication Mechanism:</span>
            <strong className="text-text-primary">SHA-256 Unique Key Constraint</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
