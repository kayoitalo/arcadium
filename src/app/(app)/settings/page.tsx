"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Settings, RefreshCw, Radio, CheckCircle, AlertCircle, Database, Share2, Shield, Download, Trash2 } from "lucide-react";

interface SyncForm {
  username: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SyncForm>({ mode: "onChange" });

  const onSubmit = async (data: SyncForm) => {
    if (!data.username.trim()) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username.trim() }),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || "Failed to trigger sync");
      }

      setMessage(
        `Sync completed successfully! Fetched: ${resData.sync.fetched}, Inserted: ${resData.sync.inserted}, Duplicates skipped: ${resData.sync.duplicates}`
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
              Last.fm Username
            </label>
            <input
              type="text"
              {...register("username", { required: "Username is required" })}
              placeholder="Enter your Last.fm username..."
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border/80 text-xs focus:outline-none focus:border-accent-gold text-text-primary placeholder:text-text-muted transition-colors font-sans"
            />
            {errors.username && (
              <span className="text-status-error text-[10px] font-mono">{errors.username.message}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isValid}
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

      {/* Integration Card: MusicBrainz Metadata Enrichment */}
      <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-copper/20 border border-accent-copper/40 flex items-center justify-center text-accent-gold font-bold text-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-serif">MusicBrainz Metadata Enrichment</h2>
              <p className="text-xs text-text-secondary font-mono">Enrich top artists and releases with MBID, country, and tags (1 req/sec throttled)</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-copper/15 border border-accent-copper/30 text-accent-gold text-xs font-mono font-medium">
            Throttled API
          </span>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            Query MusicBrainz to resolve artist country of origin, disambiguation, release years, and canonical tags.
          </p>

          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              setMessage(null);
              setError(null);
              try {
                const res = await fetch("/api/enrichment", { method: "POST" });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Enrichment failed");
                setMessage(
                  `MusicBrainz enrichment complete! Processed: ${data.data.summary.totalProcessed}, Resolved: ${data.data.summary.resolved}, Failed: ${data.data.summary.failed}. Total coverage: ${data.data.coverage.percentage}% (${data.data.coverage.resolvedCount}/${data.data.coverage.totalArtists})`
                );
              } catch (err: any) {
                setError(err?.message || "Failed to trigger enrichment");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-copper/30 text-accent-gold border border-accent-copper/50 text-xs font-mono font-bold hover:bg-accent-copper/50 transition-all shadow-glow disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Enriching Metadata..." : "Enrich Top Artists & Releases"}
          </button>
        </div>
      </div>

      {/* Integration Card: Spotify Playlist Export */}
      <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-status-success/20 border border-status-success/40 flex items-center justify-center text-status-success font-bold text-lg">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-serif">Spotify Playlist Export Engine</h2>
              <p className="text-xs text-text-secondary font-mono">Export discovery selections directly to private Spotify playlists or fallback .m3u files</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success/15 border border-status-success/30 text-status-success text-xs font-mono font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            Export Destination Active
          </span>
        </div>

        <div className="space-y-4 text-xs font-mono text-text-secondary">
          <p className="font-sans leading-relaxed text-text-secondary">
            Resolves curated discovery recommendations into Spotify track URIs and constructs private playlists automatically.
          </p>

          <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border/40 space-y-2">
            <div className="flex justify-between">
              <span>Spotify OAuth Scope:</span>
              <strong className="text-text-primary">playlist-modify-private (Optional)</strong>
            </div>
            <div className="flex justify-between">
              <span>Policy Isolation:</span>
              <strong className="text-status-success">Strict (Export destination only)</strong>
            </div>
            <div className="flex justify-between">
              <span>Fallback Export:</span>
              <strong className="text-text-primary">Web Search Links + Downloadable .m3u / .csv</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Card: Privacy & Data Management */}
      <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-gold font-bold text-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-serif">Privacy & Data Management</h2>
              <p className="text-xs text-text-secondary font-mono">Export your listening history or purge local database state (GDPR Compliant)</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success/15 border border-status-success/30 text-status-success text-xs font-mono font-medium">
            GDPR Ready
          </span>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed font-sans">
            You own your listening data. Export a canonical JSON copy of all stored scrobbles and connections, or reset local database state.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/user/data"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-border/80 text-text-primary text-xs font-mono font-bold hover:bg-surface-elevated transition-colors shadow-card"
            >
              <Download className="w-4 h-4 text-accent-gold" />
              <span>EXPORT DATA (JSON)</span>
            </a>

            <button
              type="button"
              onClick={async () => {
                if (!confirm("Are you sure you want to purge all stored listening events and provider connections? This action cannot be undone.")) {
                  return;
                }
                setLoading(true);
                setMessage(null);
                setError(null);
                try {
                  const res = await fetch("/api/user/data", { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to purge data");
                  setMessage(data.message);
                } catch (err: any) {
                  setError(err?.message || "Failed to purge data");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-status-error/15 text-status-error border border-status-error/30 text-xs font-mono font-bold hover:bg-status-error/30 transition-all disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              <span>PURGE ALL LISTENING HISTORY</span>
            </button>
          </div>
        </div>
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
          <div className="flex justify-between">
            <span>Metadata Resolver:</span>
            <strong className="text-text-primary">MusicBrainz API (Rate-Limited 1 req/sec)</strong>
          </div>
          <div className="flex justify-between">
            <span>Export Destination:</span>
            <strong className="text-text-primary">Spotify Web API / Fallback M3U Engine</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
