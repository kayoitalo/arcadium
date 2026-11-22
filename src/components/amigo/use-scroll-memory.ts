"use client";

import { useEffect } from "react";

// o app troca de tela sem recarregar: o "voltar" do navegador é o único popstate
let backAt = 0;
if (typeof window !== "undefined") window.addEventListener("popstate", () => { backAt = Date.now(); });

/**
 * Uma lista longa lembra onde você estava. Voltando pelo navegador, ela
 * desce até lá assim que o conteúdo chega (antes disso a página é curta e o
 * navegador desiste). Chegando pelo menu, começa do topo, como toda tela.
 */
export function useScrollMemory(key: string, ready: boolean) {
  useEffect(() => {
    const save = () => { try { sessionStorage.setItem(`arcadium:rolagem:${key}`, String(Math.round(window.scrollY))); } catch { /* sem memória, começa do topo */ } };
    let timer = 0;
    const onScroll = () => { window.clearTimeout(timer); timer = window.setTimeout(save, 150); };
    window.addEventListener("scroll", onScroll, { passive: true });
    // sem gravar ao sair: a troca de tela leva a página pro topo antes de a lista sumir
    return () => { window.removeEventListener("scroll", onScroll); window.clearTimeout(timer); };
  }, [key]);

  useEffect(() => {
    if (!ready || Date.now() - backAt > 10_000) return;
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(`arcadium:rolagem:${key}`) ?? 0); } catch { return; }
    if (saved > 0) requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior }));
  }, [key, ready]);
}
