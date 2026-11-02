"use client";
import { useRef, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import styles from "./discovery-memory.module.css";
export function MemoryTools() {
  const [busy, setBusy] = useState(false); const running = useRef(false);
  const [message, setMessage] = useState(""); const [checkpoint, setCheckpoint] = useState<{ cursor: string; until: string } | null>(null);
  const [scope, setScope] = useState("COLLECTION"); const [confirmation, setConfirmation] = useState("");
  const exportMemory = async () => {
    if (running.current) return; running.current = true; setBusy(true);
    const records: Array<{ section: string; value: unknown }> = []; let cursor = checkpoint?.cursor ?? ""; let until = checkpoint?.until ?? ""; let complete = false;
    let failure = false;
    try {
      do {
        const params = new URLSearchParams({ ...(cursor ? { cursor } : {}), ...(until ? { until } : {}) });
        const response = await privateFetch(`/api/discovery-data?${params}`); if (!response.ok) throw new Error();
        const page = await response.json(); until = page.until;
        records.push(...page.records.map((value: unknown) => ({ section: page.section, value })));
        cursor = page.nextCursor ?? ""; complete = !cursor; setMessage(`Reunindo a memória: ${records.length} registros nesta parte…`);
      } while (!complete && records.length < 5000);
    } catch { failure = true; }
    const next = cursor && until ? { cursor, until } : null; setCheckpoint(complete ? null : next);
    if (records.length || complete) {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), scope: "discovery-memory-part", startsAt: checkpoint, reachedEnd: complete, checkpoint: complete ? null : next, records }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `arcadium-memoria-${Date.now()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    setMessage(complete ? "Memória exportada. Guarde todas as partes baixadas. Reproduções e textos internos da IA ficam fora desta cópia." : failure ? "A exportação foi interrompida. Se houve registros reunidos, eles foram baixados; tente continuar para obter o restante." : "Esta parte foi baixada. Continue para exportar o restante em outro arquivo.");
    running.current = false; setBusy(false);
  };
  const erase = async () => {
    if (running.current || confirmation !== "APAGAR") return;
    running.current = true; setBusy(true);
    try { const response = await privateFetch("/api/discovery-data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, confirmation }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setConfirmation(""); setCheckpoint(null); window.location.assign("/discovery/memory");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não consegui apagar a memória."); }
    finally { running.current = false; setBusy(false); }
  };
  return <section className={styles.tools}><h2>Levar ou apagar a memória</h2>
    <p>A cópia percorre todas as buscas, indicações, respostas e revisões, coleção, exportações e escolhas editoriais da conta. Acima de 5.000 registros, continua em partes. Evite editar a memória durante a exportação: os valores são lidos ao longo dela.</p>
    <button disabled={busy} onClick={() => void exportMemory()}>{checkpoint ? "continuar exportação" : "exportar toda a memória"}</button>
    {message && <p role="status">{message}</p>}
    <details><summary>Apagar dados da memória</summary><p>A exclusão é definitiva. Não apaga reproduções importadas nem leituras salvas da IA. Excluir respostas não esvazia a coleção; a opção de memória inteira remove ambos e as sessões. Outras abas podem criar novos registros depois.</p>
      <label>O que apagar <select disabled={busy} value={scope} onChange={(event) => { setScope(event.target.value); setConfirmation(""); }}>
        <option value="COLLECTION">somente coleção</option><option value="RESPONSES">somente respostas das descobertas</option><option value="EDITORIAL">escolhas editoriais (vistos e silenciados)</option><option value="DISCOVERY">toda a memória de descobertas e escolhas editoriais</option>
      </select></label><label>Digite APAGAR para confirmar <input disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <button disabled={busy || confirmation !== "APAGAR"} onClick={() => void erase()}>apagar o escopo escolhido</button>
    </details>
  </section>;
}
