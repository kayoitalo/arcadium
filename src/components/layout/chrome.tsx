"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

export interface ChromePeriod {
  key: string;
  label: string;
}

interface ChromeState {
  /** Nome da tela, à esquerda da barra de contexto. */
  title: string;
  periods: ChromePeriod[];
  period: string | null;
}

interface ChromeContextValue extends ChromeState {
  selectPeriod: (key: string) => void;
  publish: (state: ChromeState, onSelect: (key: string) => void) => void;
}

const ChromeContext = createContext<ChromeContextValue | null>(null);

const EMPTY: ChromeState = { title: "", periods: [], period: null };

/**
 * O seletor de período vive na barra fixa do topo, não dentro da
 * página — assim ele continua à mão depois de rolar. Quem sabe quais
 * períodos existem é a tela; ela publica aqui e o cabeçalho desenha.
 */
export function ChromeProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ChromeState>(EMPTY);
  const handler = useRef<(key: string) => void>(() => undefined);

  const publish = useCallback((next: ChromeState, onSelect: (key: string) => void) => {
    handler.current = onSelect;
    setState((current) =>
      current.title === next.title &&
      current.period === next.period &&
      current.periods.length === next.periods.length
        ? current
        : next,
    );
  }, []);

  const selectPeriod = useCallback((key: string) => handler.current(key), []);

  const value = useMemo(() => ({ ...state, publish, selectPeriod }), [state, publish, selectPeriod]);

  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeContextValue {
  const context = useContext(ChromeContext);
  if (!context) throw new Error("useChrome precisa estar dentro de <ChromeProvider>.");
  return context;
}

/**
 * Cada tela chama isto uma vez para se anunciar na barra de contexto.
 * Sem períodos, a barra mostra só o nome da tela.
 */
export function useScreenChrome({
  title,
  periods = [],
  period = null,
  onPeriod,
}: {
  title: string;
  periods?: ChromePeriod[];
  period?: string | null;
  onPeriod?: (key: string) => void;
}) {
  const { publish } = useChrome();
  const signature = periods.map((entry) => entry.key).join(",");

  useEffect(() => {
    publish(
      { title, periods, period },
      onPeriod ?? (() => undefined),
    );
    // as opções são estáticas por tela; a assinatura cobre a troca de lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, period, signature, publish, onPeriod]);
}
