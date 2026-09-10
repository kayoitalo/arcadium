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

function Section({
  code,
  title,
  hint,
  aside,
  children,
}: PropsWithChildren<{ code: string; title: string; hint: string; aside?: ReactNode }>) {
  return (
    <motion.section
      className="border-t border-border pt-8"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
    >
      <div className="mb-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="catalog text-accent">{code}</span>
            <h2 className="section-title text-[1.05rem]">{title}</h2>
          </div>
          <p className="liner mt-2.5 max-w-[54ch] text-[0.9375rem]">{hint}</p>
        </div>
        {aside}
      </div>
      {children}
    </motion.section>
  );
}

/** Carimbo de estado: quadrado, mono, sem cor de aviso. */
function Chip({ children }: PropsWithChildren) {
  return <span className="catalog border border-border px-2.5 py-1.5">{children}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label block">{label}</span>
      <strong className="numeral mt-2 block text-xl text-text-primary">{value}</strong>
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
    <div className="max-w-3xl space-y-14">
      <header>
        <div className="flex items-center gap-3">
          <span className="catalog text-accent">GY/05</span>
          <span className="label">Ficha técnica do arquivo</span>
        </div>
        <h1 className="headline mt-4 text-[clamp(2.2rem,5.4vw,3.9rem)]">
          <Reveal>Ficha técnica</Reveal>
        </h1>
        <p className="liner mt-5 max-w-[52ch]">
          De onde vem cada número, o que fica guardado e para onde as prensagens podem ir.
        </p>
      </header>

      {message && (
        <motion.p
          className="flex items-start gap-2.5 border border-status-success/40 bg-status-success/[0.07] p-4 text-sm text-status-success"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </motion.p>
      )}

      {error && (
        <motion.p
          className="flex items-start gap-2.5 border border-status-error/40 bg-status-error/[0.07] p-4 text-sm text-status-error"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </motion.p>
      )}

      <Section
        code="01"
        title="Last.fm — a fonte"
        hint="De onde vem o seu histórico. A busca roda sozinha de hora em hora, mas você pode forçar agora."
        aside={<Chip>{connected ? connected.username : "não conectado"}</Chip>}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="lastfm-user" className="label mb-2 block">
              Seu usuário
            </label>
            <input
              id="lastfm-user"
              type="text"
              {...register("username", { required: "Informe o usuário" })}
              placeholder="usuario"
              className="field max-w-sm"
            />
            {errors.username && <span className="catalog mt-2 block text-status-error">{errors.username.message}</span>}
          </div>

          <button
            type="submit"
            disabled={loading || !isValid}
            className="stamp stamp-ink"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "buscando…" : "buscar agora"}
          </button>
        </form>

        {connected && (
          <div className="mt-8 grid grid-cols-2 gap-6 border-t border-border-subtle pt-6 sm:grid-cols-3">
            <Stat label="Última busca" value={connected.lastSyncedAt ? new Date(connected.lastSyncedAt).toLocaleDateString("pt-BR") : "nunca"} />
            <Stat label="Novas audições" value={(syncStatus?.latestRun?.insertedCount ?? 0).toLocaleString("pt-BR")} />
            {syncStatus?.latestRun?.errorMessage && (
              <p className="data col-span-full text-status-error">{syncStatus.latestRun.errorMessage}</p>
            )}
          </div>
        )}
      </Section>

      <Section
        code="02"
        title="Catalogação"
        hint="País, gênero, ano de lançamento e capa dos artistas e álbuns que você mais ouve. Roda aos poucos, em respeito ao limite de 1 requisição por segundo do MusicBrainz."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={enrichArtists}
            disabled={loading}
            className="stamp"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            catalogar artistas
          </button>
          <button
            type="button"
            onClick={repairCovers}
            disabled={loading}
            className="stamp"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            procurar capas
          </button>
        </div>

        {coverage && (
          <div className="mt-8 grid grid-cols-2 gap-6 border-t border-border-subtle pt-6 sm:grid-cols-4">
            <Stat label="Artistas" value={`${coverage.percentage}%`} />
            <Stat label="Álbuns" value={coverage.totalCanonicalAlbums.toLocaleString("pt-BR")} />
            <Stat label="Com capa" value={`${coverage.coverPercentage}%`} />
            <Stat label="Na fila" value={coverage.pendingCoverLookup.toLocaleString("pt-BR")} />
          </div>
        )}
      </Section>

      <Section
        code="03"
        title="Spotify — só destino"
        hint="As prensagens de teste podem virar uma playlist. Conectado, ela nasce direto na sua conta; sem conectar, você recebe links de busca e um arquivo .m3u."
        aside={<Chip>{spotify?.connected ? `conectado · ${spotify.displayName}` : "não conectado"}</Chip>}
      >
        <p className="liner mb-6 max-w-[56ch] text-[0.9375rem]">
          O Spotify é usado só como destino: nada do que está lá volta para as suas estatísticas nem
          para os textos. A permissão pedida cria playlists e nada mais.
        </p>

        {spotify && !spotify.configured && (
          <p className="max-w-[56ch] border border-border bg-surface p-4 text-xs text-text-muted">
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
            className="stamp stamp-ink"
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
            className="stamp stamp-danger"
          >
            <Unlink className="h-3.5 w-3.5" />
            desconectar
          </button>
        )}
      </Section>

      <Section
        code="04"
        title="Seus dados"
        hint="Tudo o que está guardado aqui é seu, e sai daqui quando você quiser — em JSON, de uma vez."
      >
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/user/data"
            download
            className="stamp"
          >
            <Download className="h-3.5 w-3.5" />
            baixar cópia
          </a>

          <button
            type="button"
            onClick={eraseEverything}
            disabled={loading}
            className="stamp stamp-danger border-status-error/50 text-status-error"
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
    <Suspense fallback={<p className="label">Abrindo a ficha…</p>}>
      <SettingsContent />
    </Suspense>
  );
}
