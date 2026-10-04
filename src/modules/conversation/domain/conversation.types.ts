import type { PeriodKey } from "@/modules/statistics/application/overview-service";

/*
 * A conversa: o que o amigo tem para contar, cada frase com a prova que
 * ela cita. Frase sem prova no banco não entra — a conversa é também a
 * checagem de fato das leituras da IA.
 */

export interface ConversationCover {
  url: string | null;
  title: string;
  artist: string;
}

/** Um lado de uma transição: a audição de verdade, com hora, capa e prévia. */
export interface TransitionSide {
  artist: string;
  track: string;
  genre: string | null;
  cover: ConversationCover;
  previewUrl: string | null;
  /** "31 ago · 21:19", no fuso de quem ouviu. */
  when: string;
}

/** Uma audição vizinha da transição: o que tocou antes e depois do salto. */
export interface ListeningStep {
  artist: string;
  track: string;
  when: string;
}

export interface RankRow {
  label: string;
  /** Artista da faixa ou do disco; vazio quando a linha já é o artista. */
  sub: string;
  plays: number;
}

export interface DecadeBar {
  /** Primeiro ano da década: 1990, 2000… */
  decade: number;
  /** Fatia das audições com ano conhecido, em %. */
  share: number;
  plays: number;
}

export type Evidence =
  | {
      kind: "transition";
      from: TransitionSide;
      to: TransitionSide;
      /** Minutos entre o início de uma e o da outra. */
      gapMinutes: number;
      /** Duas audições antes e duas depois: o salto dentro da sequência de verdade. */
      context: { before: ListeningStep[]; after: ListeningStep[] };
    }
  | {
      kind: "ranking";
      unit: "track" | "album" | "artist";
      rows: RankRow[];
      /** A linha que a frase cita — é nela que o amigo passa a régua. */
      focusIndex: number;
      /** Quanto a linha citada é de tudo que tocou na janela, em %. */
      share: number;
      /** A frase fala em porcentagem: a anotação dele mostra a fatia, não a distância para a segunda. */
      citesShare: boolean;
      cover: ConversationCover;
      previewUrl: string | null;
      previewTrack: string | null;
    }
  | {
      kind: "decades";
      bars: DecadeBar[];
      /** As décadas de que a frase fala. */
      focus: number[];
      /** Quanto elas somam, em %. */
      focusShare: number;
      /** Quanto das audições tem ano conhecido, em %: sem isso o retrato mente. */
      coverage: number;
    };

export type EvidenceKind = Evidence["kind"];

export interface ConversationMoment {
  /** Estável entre visitas: é por ele que o "nada a ver" lembra do assunto. */
  key: string;
  period: PeriodKey;
  /** A janela, dita pelo amigo: "nesse último mês", "desde que eu te conheço". */
  window: string;
  headline: string;
  narrative: string;
  insight: string;
  closing: string | null;
  evidence: Evidence;
}

export interface ConversationView {
  moments: ConversationMoment[];
  /** Há leitura sendo escrita agora: a tela avisa em vez de parecer vazia. */
  writing: boolean;
  /** Existe histórico? Sem ele a conversa nem começa. */
  hasHistory: boolean;
}
