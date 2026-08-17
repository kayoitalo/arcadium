"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Settings, RefreshCw, Radio, CheckCircle, AlertCircle, Database, Share2, Shield, Download, Trash2 } from "lucide-react";
import { MotionDiv, MotionPage } from "@/components/ui/motion";

interface SyncForm {
  username: string;
}

interface SyncStatus {
  connection: { username: string; status: string; lastSyncedAt: string | null } | null;
  latestRun: { status: string; fetchedCount: number; insertedCount: number; duplicateCount: number; errorMessage: string | null; startedAt: string; finishedAt: string | null } | null;
}

interface EnrichmentCoverage {
  totalArtists: number;
  resolvedCount: number;
  percentage: number;
  totalCanonicalAlbums: number;
  albumsWithCover: number;
  albumsWithoutCover: number;
  pendingCoverLookup: number;
  coverPercentage: number;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [enrichmentCoverage, setEnrichmentCoverage] = useState<EnrichmentCoverage | null>(null);

  const loadSyncStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sync", { cache: "no-store" });
      if (response.ok) setSyncStatus(await response.json());
    } catch (statusError) {
      console.error("Failed to load synchronization status", statusError);
    }
  }, []);

  const loadEnrichmentCoverage = useCallback(async () => {
    try {
      const response = await fetch("/api/enrichment", { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        setEnrichmentCoverage(payload.data);
      }
    } catch (coverageError) {
      console.error("Failed to load enrichment coverage", coverageError);
    }
  }, []);

  useEffect(() => {
    void loadSyncStatus();
    void loadEnrichmentCoverage();
  }, [loadSyncStatus, loadEnrichmentCoverage]);

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
        throw new Error(resData.error || "Não foi possível iniciar a sincronização");
      }

      setMessage(
        `Sincronização concluída. Recebidos: ${resData.sync.fetched}; inseridos: ${resData.sync.inserted}; duplicados ignorados: ${resData.sync.duplicates}.`
      );
      await loadSyncStatus();
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MotionPage className="space-y-8 max-w-4xl pb-12">

      <header className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-1">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent-gold" />
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
            Configurações e integrações
          </h1>
        </div>
        <p className="text-text-secondary text-xs font-sans">
          Acompanhe a saúde dos dados, provedores externos e operações do banco local.
        </p>
      </header>

      <MotionDiv className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-copper/20 border border-accent-copper/40 flex items-center justify-center text-accent-gold font-bold text-lg">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-serif">Sincronização com Last.fm</h2>
              <p className="text-xs text-text-secondary font-mono">Fonte do histórico por user.getRecentTracks</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface border border-border text-text-secondary text-xs font-mono font-medium">
            {syncStatus?.connection ? syncStatus.connection.status : "Não configurado"}
          </span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
              Usuário do Last.fm
            </label>
            <input
              type="text"
              {...register("username", { required: "Informe o usuário" })}
              placeholder="Digite seu usuário do Last.fm..."
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
            {loading ? "Sincronizando histórico…" : "CONECTAR E SINCRONIZAR"}
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

        {syncStatus?.connection && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-elevated/40 border border-border/40 text-xs font-mono">
            <div><span className="block text-text-muted">STATUS</span><strong className="text-text-primary">{syncStatus.connection.status}</strong></div>
            <div><span className="block text-text-muted">RECEBIDOS</span><strong className="text-text-primary">{syncStatus.latestRun?.fetchedCount ?? 0}</strong></div>
            <div><span className="block text-text-muted">INSERIDOS</span><strong className="text-text-primary">{syncStatus.latestRun?.insertedCount ?? 0}</strong></div>
            <div><span className="block text-text-muted">DUPLICADOS</span><strong className="text-text-primary">{syncStatus.latestRun?.duplicateCount ?? 0}</strong></div>
            {syncStatus.latestRun?.errorMessage && <p className="col-span-full text-status-error">{syncStatus.latestRun.errorMessage}</p>}
          </div>
        )}
      </MotionDiv>

      <MotionDiv className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-copper/20 border border-accent-copper/40 flex items-center justify-center text-accent-gold font-bold text-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-serif">Metadados e capas</h2>
              <p className="text-xs text-text-secondary font-mono">MusicBrainz e Cover Art Archive</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-copper/15 border border-accent-copper/30 text-accent-gold text-xs font-mono font-medium">
            Limite de 1 requisição/s
          </span>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            Resolve país, desambiguação, ano de lançamento, gêneros e capas para entidades prioritárias.
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
                if (!res.ok) throw new Error(data.error || "O enriquecimento falhou");
                setEnrichmentCoverage(data.data.coverage);
                setMessage(
                  `Enriquecimento concluído. Artistas resolvidos: ${data.data.summary.resolved}; falhas: ${data.data.summary.failed}; capas encontradas: ${data.data.summary.coversResolved}; indisponíveis: ${data.data.summary.coversMissing}.`
                );
              } catch (err: any) {
                setError(err?.message || "Não foi possível iniciar o enriquecimento");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-copper/30 text-accent-gold border border-accent-copper/50 text-xs font-mono font-bold hover:bg-accent-copper/50 transition-all shadow-glow disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Enriquecendo metadados…" : "CONTINUAR ENRIQUECIMENTO"}
          </button>

          <button
            type="button"
            onClick={async () => {
              setLoading(true); setMessage(null); setError(null);
              try {
                const response = await fetch("/api/enrichment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "covers", batchSize: 20 }) });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Não foi possível reparar as capas");
                setEnrichmentCoverage(payload.data.coverage);
                setMessage(`Capas processadas: ${payload.data.covers.processed}; recuperadas: ${payload.data.covers.resolved}; indisponíveis: ${payload.data.covers.missing}.`);
              } catch (repairError) {
                setError(repairError instanceof Error ? repairError.message : "Não foi possível reparar as capas");
              } finally { setLoading(false); }
            }}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-surface px-5 py-2.5 font-mono text-xs font-bold text-text-primary transition-colors hover:border-accent/50 hover:bg-surface-elevated disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 text-accent-gold ${loading ? "animate-spin" : ""}`} />
            REPARAR CAPAS
          </button>

          {enrichmentCoverage && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-elevated/40 border border-border/40 text-xs font-mono">
              <div><span className="block text-text-muted">ARTISTAS</span><strong className="text-text-primary">{enrichmentCoverage.percentage}%</strong></div>
              <div><span className="block text-text-muted">ÁLBUNS CANÔNICOS</span><strong className="text-text-primary">{enrichmentCoverage.totalCanonicalAlbums}</strong></div>
              <div><span className="block text-text-muted">COM CAPA</span><strong className="text-text-primary">{enrichmentCoverage.albumsWithCover} ({enrichmentCoverage.coverPercentage}%)</strong></div>
              <div><span className="block text-text-muted">PENDENTES</span><strong className="text-text-primary">{enrichmentCoverage.pendingCoverLookup}</strong></div>
            </div>
          )}
        </div>
      </MotionDiv>

      <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-status-success/20 border border-status-success/40 flex items-center justify-center text-status-success font-bold text-lg">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-serif">Exportação de playlists</h2>
              <p className="text-xs text-text-secondary font-mono">Spotify opcional, links de busca e arquivos .m3u</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface border border-border text-text-secondary text-xs font-mono font-medium">
            OAuth não configurado
          </span>
        </div>

        <div className="space-y-4 text-xs font-mono text-text-secondary">
          <p className="font-sans leading-relaxed text-text-secondary">
            Sem OAuth, a exportação gera links de busca e arquivos locais. A criação de playlist privada exige token e usuário Spotify válidos.
          </p>

          <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border/40 space-y-2">
            <div className="flex justify-between">
              <span>Permissão OAuth:</span>
              <strong className="text-text-primary">playlist-modify-private (opcional)</strong>
            </div>
            <div className="flex justify-between">
              <span>Isolamento de dados:</span>
              <strong className="text-status-success">Somente destino de exportação</strong>
            </div>
            <div className="flex justify-between">
              <span>Exportação local:</span>
              <strong className="text-text-primary">Links de busca e arquivos .m3u/.csv</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-gold font-bold text-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-serif">Privacidade e dados</h2>
              <p className="text-xs text-text-secondary font-mono">Exporte ou exclua o histórico armazenado</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface border border-border text-text-secondary text-xs font-mono font-medium">
            Controles de exportação e exclusão
          </span>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed font-sans">
            Exporte uma cópia JSON dos eventos e conexões armazenados ou apague os dados locais desta conta.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/user/data"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-border/80 text-text-primary text-xs font-mono font-bold hover:bg-surface-elevated transition-colors shadow-card"
            >
              <Download className="w-4 h-4 text-accent-gold" />
              <span>EXPORTAR DADOS (JSON)</span>
            </a>

            <button
              type="button"
              onClick={async () => {
                if (!confirm("Deseja apagar todos os eventos e conexões armazenados? Esta ação não pode ser desfeita.")) {
                  return;
                }
                setLoading(true);
                setMessage(null);
                setError(null);
                try {
                  const res = await fetch("/api/user/data", { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Não foi possível apagar os dados");
                  setMessage(data.message);
                } catch (err: any) {
                  setError(err?.message || "Não foi possível apagar os dados");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-status-error/15 text-status-error border border-status-error/30 text-xs font-mono font-bold hover:bg-status-error/30 transition-all disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              <span>APAGAR TODO O HISTÓRICO</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-accent-gold" />
          <h2 className="text-base font-bold text-text-primary font-serif">Infraestrutura de dados</h2>
        </div>
        <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border/40 space-y-2 text-xs text-text-secondary font-mono">
          <div className="flex justify-between">
            <span>Banco principal:</span>
            <strong className="text-text-primary">Neon PostgreSQL</strong>
          </div>
          <div className="flex justify-between">
            <span>Deduplicação:</span>
            <strong className="text-text-primary">Chave única SHA-256</strong>
          </div>
          <div className="flex justify-between">
            <span>Metadados:</span>
            <strong className="text-text-primary">MusicBrainz (1 requisição/s)</strong>
          </div>
          <div className="flex justify-between">
            <span>Destino de exportação:</span>
            <strong className="text-text-primary">Spotify ou arquivo M3U</strong>
          </div>
        </div>
      </div>
    </MotionPage>
  );
}
