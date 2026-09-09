"use client";

import { Suspense, useCallback, useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Download, Link2, RefreshCw, Trash2, Unlink } from "lucide-react";
import { EASE_OUT_EXPO, Reveal } from "@/components/ui/motion";

interface SyncForm {
  username: string;
}

interface SyncStatus {
  connection: { username: string; status: string; lastSyncedAt: string | null } | null;
  latestRun: {
    status: string;
    fetchedCount: number;
    insertedCount: number;
    duplicateCount: number;
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
  } | null;
}

interface SpotifyStatus {
  configured: boolean;
  connected: boolean;
  displayName?: string;
  reason?: string;
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

function Section({ title, hint, aside, children }: PropsWithChildren<{ title: string; hint: string; aside?: ReactNode }>) {
  return (
    <motion.section
      className="border-t border-border pt-8"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
    >
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">{title}</h2>
          <p className="mt-1.5 max-w-[52ch] text-sm text-text-secondary">{hint}</p>
        </div>
        {aside}
      </div>
      {children}
    </motion.section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="eyebrow block">{label}</span>
      <strong className="mt-1.5 block font-mono text-sm tabular-nums text-text-primary">{value}</strong>
    </div>
  );
}

function SettingsContent() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [coverage, setCoverage] = useState<EnrichmentCoverage | null>(null);
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const searchParams = useSearchParams();

  const loadSyncStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sync", { cache: "no-store" });
      if (response.ok) setSyncStatus(await response.json());
    } catch (cause) {
      console.error("Failed to load synchronization status", cause);
    }
  }, []);

  const loadCoverage = useCallback(async () => {
    try {
      const response = await fetch("/api/enrichment", { cache: "no-store" });
      if (response.ok) setCoverage((await response.json()).data);
    } catch (cause) {
      console.error("Failed to load enrichment coverage", cause);
    }
  }, []);

  const loadSpotify = useCallback(async () => {
    try {
      const response = await fetch("/api/spotify/connect", { cache: "no-store" });
      if (response.ok) setSpotify(await response.json());
    } catch (cause) {
      console.error("Failed to load Spotify status", cause);
    }
  }, []);

  useEffect(() => {
    void loadSyncStatus();
    void loadCoverage();
    void loadSpotify();
  }, [loadSyncStatus, loadCoverage, loadSpotify]);

  // o callback devolve o resultado na barra de endereço
  useEffect(() => {
    const outcome = searchParams.get("spotify");
    if (!outcome) return;
    if (outcome === "conectado") {
      setMessage(`Spotify conectado como ${searchParams.get("conta") ?? "sua conta"}.`);
    } else if (outcome === "cancelado") {
      setError("Você cancelou a autorização no Spotify.");
    } else if (outcome === "estado-invalido") {
      setError("A autorização não confere com este navegador. Tente conectar de novo.");
    } else {
      setError("Não foi possível concluir a conexão com o Spotify.");
    }
    void loadSpotify();
    window.history.replaceState(null, "", "/settings");
  }, [searchParams, loadSpotify]);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SyncForm>({ mode: "onChange" });

  const run = async (task: () => Promise<string>) => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      setMessage(await task());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Algo deu errado.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (data: SyncForm) =>
    run(async () => {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível buscar seu histórico.");
      await loadSyncStatus();
      return `Pronto — ${payload.sync.inserted.toLocaleString("pt-BR")} audições novas.`;
    });

  const enrichArtists = () =>
    run(async () => {
      const response = await fetch("/api/enrichment", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "A busca de informações falhou.");
      setCoverage(payload.data.coverage);
      return `Pronto — ${payload.data.summary.resolved} artistas e ${payload.data.summary.coversResolved} capas a mais.`;
    });

  const repairCovers = () =>
    run(async () => {
      const response = await fetch("/api/enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "covers", batchSize: 20 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível buscar as capas.");
      setCoverage(payload.data.coverage);
      return `${payload.data.covers.resolved} capas novas encontradas.`;
    });

  const eraseEverything = () => {
    if (!confirm("Apagar todo o seu histórico? Isso não pode ser desfeito.")) return;
    void run(async () => {
      const response = await fetch("/api/user/data", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível apagar os dados.");
      return payload.message;
    });
  };

  const connected = syncStatus?.connection;

  return (
    <div className="max-w-3xl space-y-14 pb-10">
      <header>
        <span className="eyebrow">Sua conta</span>
        <h1 className="display-xl mt-4 text-[clamp(2.2rem,5vw,4rem)]">
          <Reveal>Ajustes</Reveal>
        </h1>
      </header>

      {message && (
        <motion.p
          className="flex items-start gap-2.5 rounded-lg border border-status-success/30 bg-status-success/10 p-4 text-sm text-status-success"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </motion.p>
      )}

      {error && (
        <motion.p
          className="flex items-start gap-2.5 rounded-lg border border-status-error/30 bg-status-error/10 p-4 text-sm text-status-error"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </motion.p>
      )}

      <Section
        title="Last.fm"
        hint="De onde vem o seu histórico. A busca roda sozinha de hora em hora, mas você pode forçar agora."
        aside={
          <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] text-text-muted">
            {connected ? connected.username : "não conectado"}
          </span>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="lastfm-user" className="eyebrow mb-2 block">
              Seu usuário
            </label>
            <input
              id="lastfm-user"
              type="text"
              {...register("username", { required: "Informe o usuário" })}
              placeholder="usuario"
              className="w-full max-w-sm border-b border-border bg-transparent py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            {errors.username && <span className="mt-2 block font-mono text-[10px] text-status-error">{errors.username.message}</span>}
          </div>

          <button
            type="submit"
            disabled={loading || !isValid}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold text-background transition-transform hover:scale-[1.02] disabled:opacity-30 disabled:hover:scale-100"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "buscando…" : "buscar agora"}
          </button>
        </form>

        {connected && (
          <div className="mt-7 grid grid-cols-2 gap-6 border-t border-border/60 pt-6 sm:grid-cols-3">
            <Stat label="Última busca" value={connected.lastSyncedAt ? new Date(connected.lastSyncedAt).toLocaleDateString("pt-BR") : "nunca"} />
            <Stat label="Novas audições" value={(syncStatus?.latestRun?.insertedCount ?? 0).toLocaleString("pt-BR")} />
            {syncStatus?.latestRun?.errorMessage && (
              <p className="col-span-full font-mono text-[11px] text-status-error">{syncStatus.latestRun.errorMessage}</p>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Informações dos artistas"
        hint="País, gênero, ano de lançamento e capa dos artistas e álbuns que você mais ouve. Roda aos poucos para não sobrecarregar as fontes."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={enrichArtists}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-[11px] text-text-primary transition-colors hover:border-accent disabled:opacity-30"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-accent ${loading ? "animate-spin" : ""}`} />
            buscar artistas
          </button>
          <button
            type="button"
            onClick={repairCovers}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-[11px] text-text-primary transition-colors hover:border-accent disabled:opacity-30"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-accent ${loading ? "animate-spin" : ""}`} />
            procurar capas
          </button>
        </div>

        {coverage && (
          <div className="mt-7 grid grid-cols-2 gap-6 border-t border-border/60 pt-6 sm:grid-cols-4">
            <Stat label="Artistas" value={`${coverage.percentage}%`} />
            <Stat label="Álbuns" value={coverage.totalCanonicalAlbums.toLocaleString("pt-BR")} />
            <Stat label="Com capa" value={`${coverage.coverPercentage}%`} />
            <Stat label="Na fila" value={coverage.pendingCoverLookup.toLocaleString("pt-BR")} />
          </div>
        )}
      </Section>

      <Section
        title="Playlists"
        hint="As sugestões de Descobertas podem virar uma playlist. Conectado, ela nasce direto na sua conta; sem conectar, você recebe links de busca e um arquivo .m3u."
        aside={
          <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] text-text-muted">
            {spotify?.connected ? `conectado como ${spotify.displayName}` : "não conectado"}
          </span>
        }
      >
        <p className="mb-5 max-w-[56ch] text-sm text-text-secondary">
          O Spotify é usado só como destino: nada do que está lá volta para as suas estatísticas nem
          para os textos. A permissão pedida cria playlists e nada mais.
        </p>

        {spotify && !spotify.configured && (
          <p className="max-w-[56ch] rounded-lg border border-border bg-surface p-4 text-xs text-text-muted">
            {spotify.reason}
          </p>
        )}

        {spotify?.configured && !spotify.connected && (
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              run(async () => {
                const response = await fetch("/api/spotify/connect", { method: "POST" });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error ?? "Não foi possível iniciar a conexão.");
                window.location.href = payload.authorizeUrl;
                return "Abrindo o Spotify…";
              })
            }
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold text-background transition-transform hover:scale-[1.02] disabled:opacity-30"
          >
            <Link2 className="h-3.5 w-3.5" />
            conectar spotify
          </button>
        )}

        {spotify?.connected && (
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              run(async () => {
                const response = await fetch("/api/spotify/connect", { method: "DELETE" });
                if (!response.ok) throw new Error("Não foi possível desconectar.");
                await loadSpotify();
                return "Spotify desconectado.";
              })
            }
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-[11px] text-text-secondary transition-colors hover:border-status-error hover:text-status-error disabled:opacity-30"
          >
            <Unlink className="h-3.5 w-3.5" />
            desconectar
          </button>
        )}
      </Section>

      <Section title="Seus dados" hint="Tudo o que está guardado aqui é seu, e sai daqui quando você quiser.">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/user/data"
            download
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-[11px] text-text-primary transition-colors hover:border-accent"
          >
            <Download className="h-3.5 w-3.5 text-accent" />
            baixar cópia
          </a>

          <button
            type="button"
            onClick={eraseEverything}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-status-error/40 px-5 py-2.5 font-mono text-[11px] text-status-error transition-colors hover:bg-status-error/10 disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            apagar tudo
          </button>
        </div>
      </Section>
    </div>
  );
}

/**
 * O Next exige um limite de Suspense em volta de useSearchParams — é por
 * ele que chega o resultado do callback do Spotify.
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="font-mono text-xs text-text-muted">Carregando…</p>}>
      <SettingsContent />
    </Suspense>
  );
}
