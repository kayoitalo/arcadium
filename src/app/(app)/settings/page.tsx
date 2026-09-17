"use client";

import { Suspense, useCallback, useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Download, Link2, RefreshCw, Trash2, Unlink } from "lucide-react";
import { useScreenChrome } from "@/components/layout/chrome";
import { Readout } from "@/components/ui/console";

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
  albumsInCatalog: number;
  pendingCatalogLookup: number;
  totalTracks: number;
  tracksWithDuration: number;
  durationPercentage: number;
}

type Signal = "on" | "off" | "error";

type AddressAs = "masculino" | "feminino" | "neutro";

const ADDRESS_OPTIONS: Array<{ value: AddressAs; label: string; sample: string }> = [
  { value: "masculino", label: "mano", sample: "\"Caraca, mermão, 22 vezes o mesmo disco?\"" },
  { value: "feminino", label: "mina", sample: "\"Caraca, amiga, 22 vezes o mesmo disco?\"" },
  { value: "neutro", label: "neutro", sample: "\"Caraca, 22 vezes o mesmo disco?\"" },
];

/** Estado de uma conexão: LED âmbar ligado, apagado desligado, vermelho com falha. */
function Status({ signal, children }: PropsWithChildren<{ signal: Signal }>) {
  return (
    <span className="data flex items-center gap-2 text-text-secondary">
      <span
        className="led"
        data-on={signal === "on"}
        style={
          signal === "error"
            ? { background: "var(--color-status-error)", boxShadow: "0 0 6px rgb(224 96 79 / 0.7)" }
            : undefined
        }
        aria-hidden
      />
      {children}
    </span>
  );
}

/** Um módulo do rack: faixa de título com o estado à direita, corpo embaixo. */
function Module({
  code,
  title,
  hint,
  status,
  children,
}: PropsWithChildren<{ code: string; title: string; hint: string; status?: ReactNode }>) {
  return (
    <motion.section
      className="border border-border bg-background-secondary"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="eyebrow text-accent">{code}</span>
          <span className="h-px w-3 bg-border-strong" />
          <h2 className="eyebrow text-text-primary">{title}</h2>
        </div>
        {status}
      </div>
      <div className="p-5 sm:p-6">
        <p className="mb-6 max-w-[58ch] text-[15px] leading-[1.66] text-text-secondary">{hint}</p>
        {children}
      </div>
    </motion.section>
  );
}

function SettingsContent() {
  useScreenChrome({ title: "Ajustes" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [coverage, setCoverage] = useState<EnrichmentCoverage | null>(null);
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const [addressAs, setAddressAs] = useState<AddressAs | null>(null);
  const searchParams = useSearchParams();

  const loadPreferences = useCallback(async () => {
    try {
      const response = await fetch("/api/user/preferences", { cache: "no-store" });
      if (response.ok) setAddressAs((await response.json()).addressAs);
    } catch (cause) {
      console.error("Failed to load preferences", cause);
    }
  }, []);

  /** A troca vale para os próximos textos gerados; os já guardados continuam como estão. */
  const chooseAddress = (next: AddressAs) => {
    const previous = addressAs;
    setAddressAs(next);
    void fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressAs: next }),
    }).then((response) => {
      if (!response.ok) {
        setAddressAs(previous);
        setError("Não foi possível salvar o jeito de conversar.");
      }
    });
  };

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
    void loadPreferences();
  }, [loadSyncStatus, loadCoverage, loadSpotify, loadPreferences]);

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

  /**
   * Duas chamadas por disco no ritmo da Apple: o lote é pequeno de
   * propósito e a fila drena aos poucos, um clique de cada vez.
   */
  const fetchCatalog = () =>
    run(async () => {
      const response = await fetch("/api/enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "catalog", batchSize: 8 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível consultar o catálogo.");
      setCoverage(payload.data.coverage);
      const { matched, missing, tracksUpdated } = payload.data.catalog;
      return `${matched} discos encontrados, ${missing} sem correspondência e ${tracksUpdated} faixas com duração e prévia.`;
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
  const syncFailed = Boolean(syncStatus?.latestRun?.errorMessage);

  return (
    <div className="gy-page max-w-3xl space-y-8">
      <header className="mb-4">
        <span className="eyebrow">Sua conta</span>
        <h1 className="display mt-4 text-[clamp(2.6rem,5.6vw,4.2rem)]">
          <span className="block overflow-hidden">
            <span className="gy-rise">Ajustes</span>
          </span>
        </h1>
        <p className="mt-5 max-w-[54ch] text-[15px] leading-[1.66] text-text-secondary">
          De onde vem cada número, o que fica guardado aqui e para onde as descobertas podem ir.
        </p>
      </header>

      {message && (
        <p role="status" className="data flex items-center gap-2.5 border border-accent/40 bg-well p-4 text-[12px] text-text-primary">
          <span className="led" data-on="true" aria-hidden />
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="data flex items-center gap-2.5 border border-status-error/50 bg-well p-4 text-[12px] text-status-error">
          <span className="led" style={{ background: "var(--color-status-error)" }} aria-hidden />
          {error}
        </p>
      )}

      <Module
        code="01"
        title="Last.fm"
        hint="De onde vem o seu histórico. A busca roda sozinha de hora em hora, mas você pode forçar agora."
        status={
          <Status signal={syncFailed ? "error" : connected ? "on" : "off"}>
            {connected ? connected.username : "não conectado"}
          </Status>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="lastfm-user" className="eyebrow mb-2 block">
              Seu usuário
            </label>
            <input
              id="lastfm-user"
              type="text"
              {...register("username", { required: "Informe o usuário" })}
              placeholder={connected?.username ?? "usuario"}
              className="field-line"
            />
            {errors.username && <span className="data mt-2 block text-status-error">{errors.username.message}</span>}
          </div>

          <button type="submit" disabled={loading || !isValid} className="key key-ink">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "buscando…" : "buscar agora"}
          </button>
        </form>

        {connected && (
          <div className="ruled mt-6 grid-cols-2 border border-border">
            <Readout label="Última busca" className="px-4 py-4">
              <strong className="numeral block text-2xl">
                {connected.lastSyncedAt ? new Date(connected.lastSyncedAt).toLocaleDateString("pt-BR") : "nunca"}
              </strong>
            </Readout>
            <Readout label="Novas audições" className="px-4 py-4">
              <strong className="numeral block text-2xl">
                {(syncStatus?.latestRun?.insertedCount ?? 0).toLocaleString("pt-BR")}
              </strong>
            </Readout>
          </div>
        )}

        {syncStatus?.latestRun?.errorMessage && (
          <p className="data mt-3 text-status-error">{syncStatus.latestRun.errorMessage}</p>
        )}
      </Module>

      <Module
        code="02"
        title="Informações dos artistas"
        hint="País, gênero, ano de lançamento e capa dos artistas e álbuns que você mais ouve. Roda aos poucos, em respeito ao limite de 1 requisição por segundo do MusicBrainz."
      >
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={enrichArtists} disabled={loading} className="key">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            buscar artistas
          </button>
          <button type="button" onClick={repairCovers} disabled={loading} className="key">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            procurar capas
          </button>
        </div>

        {coverage && (
          <div className="ruled mt-6 grid-cols-2 border border-border sm:grid-cols-4">
            <Readout label="Artistas" className="px-4 py-4">
              <strong className="numeral block text-2xl">{coverage.percentage}%</strong>
            </Readout>
            <Readout label="Álbuns" className="px-4 py-4">
              <strong className="numeral block text-2xl">{coverage.totalCanonicalAlbums.toLocaleString("pt-BR")}</strong>
            </Readout>
            <Readout label="Com capa" className="px-4 py-4">
              <strong className="numeral block text-2xl">{coverage.coverPercentage}%</strong>
            </Readout>
            <Readout label="Na fila" className="px-4 py-4">
              <strong className="numeral block text-2xl">{coverage.pendingCoverLookup.toLocaleString("pt-BR")}</strong>
            </Readout>
          </div>
        )}
      </Module>

      <Module
        code="03"
        title="Catálogo da Apple"
        hint="De onde vêm capa, gênero, ano, duração exata e a prévia de 30s — inclusive dos discos que o MusicBrainz não conhece, que são a maioria. Cada clique consulta oito discos, começando pelos que você mais ouviu no último mês."
        status={
          <Status signal={coverage && coverage.albumsInCatalog > 0 ? "on" : "off"}>
            {coverage
              ? `${coverage.albumsInCatalog.toLocaleString("pt-BR")} de ${coverage.totalCanonicalAlbums.toLocaleString("pt-BR")} discos`
              : "—"}
          </Status>
        }
      >
        <button type="button" onClick={fetchCatalog} disabled={loading} className="key">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          consultar catálogo
        </button>

        {coverage && (
          <div className="ruled mt-6 grid-cols-2 border border-border sm:grid-cols-3">
            <Readout label="No catálogo" className="px-4 py-4">
              <strong className="numeral block text-2xl">
                {coverage.albumsInCatalog.toLocaleString("pt-BR")}
              </strong>
            </Readout>
            <Readout label="Na fila" className="px-4 py-4">
              <strong className="numeral block text-2xl">
                {coverage.pendingCatalogLookup.toLocaleString("pt-BR")}
              </strong>
            </Readout>
            <Readout label="Faixas com duração" className="px-4 py-4">
              <strong className="numeral block text-2xl">{coverage.durationPercentage}%</strong>
            </Readout>
          </div>
        )}
      </Module>

      <Module
        code="04"
        title="Playlists"
        hint="As descobertas que você separar podem virar uma playlist. Conectado, ela nasce direto na sua conta; sem conectar, você recebe links de busca e um arquivo .m3u."
        status={
          <Status signal={spotify?.connected ? "on" : "off"}>
            {spotify?.connected ? `spotify · ${spotify.displayName}` : "não conectado"}
          </Status>
        }
      >
        <p className="mb-6 max-w-[58ch] text-[13px] leading-[1.66] text-text-muted">
          O Spotify é usado só como destino: nada do que está lá volta para as suas estatísticas nem para os
          textos. A permissão pedida cria playlists e nada mais.
        </p>

        {spotify && !spotify.configured && (
          <p className="data max-w-[58ch] border border-border bg-well p-4 leading-relaxed text-text-muted">
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
            className="key key-ink"
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
            className="key key-danger"
          >
            <Unlink className="h-3.5 w-3.5" />
            desconectar
          </button>
        )}
      </Module>

      <Module
        code="05"
        title="Conversa"
        hint="Os comentários falam contigo como um parceiro de rolê. Escolhe como eles te tratam — vale a partir da próxima leitura gerada."
      >
        <div role="group" aria-label="Como os textos te tratam" className="keys">
          {ADDRESS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              data-active={addressAs === option.value}
              aria-pressed={addressAs === option.value}
              onClick={() => chooseAddress(option.value)}
              className="key"
            >
              <span className="led" aria-hidden />
              {option.label}
            </button>
          ))}
        </div>
        <p className="data mt-3 text-text-muted">
          {ADDRESS_OPTIONS.find((option) => option.value === addressAs)?.sample ?? ""}
        </p>
      </Module>

      <Module
        code="06"
        title="Seus dados"
        hint="Tudo o que está guardado aqui é seu, e sai daqui quando você quiser — em JSON, de uma vez."
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <a href="/api/user/data" download className="key">
            <Download className="h-3.5 w-3.5" />
            baixar cópia
          </a>

          <button
            type="button"
            onClick={eraseEverything}
            disabled={loading}
            className="key key-danger border-status-error/50 text-status-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
            apagar tudo
          </button>
        </div>
      </Module>
    </div>
  );
}

/**
 * O Next exige um limite de Suspense em volta de useSearchParams — é por
 * ele que chega o resultado do callback do Spotify.
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="eyebrow">Carregando…</p>}>
      <SettingsContent />
    </Suspense>
  );
}
