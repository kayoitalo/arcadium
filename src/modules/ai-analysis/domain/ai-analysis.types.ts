import { z } from "zod";

export interface MusicProfileInput {
  period: string;
  topArtists: Array<{
    name: string;
    plays: number;
    share: number;
    shareChange?: number | null;
  }>;
  topGenres: Array<{
    name: string;
    share: number;
  }>;
  risingArtists: Array<{
    name: string;
    plays: number;
    shareChange: number;
  }>;
  discovery: {
    newArtists: number;
    newArtistPlayShare: number;
  };
  concentration: {
    top5ArtistShare: number;
    top10TrackShare: number;
  };
  totalPlays: number;
  uniqueArtists: number;
  uniqueTracks: number;
  /** De que décadas saem os discos, como fração das audições com ano conhecido. */
  eras?: Array<{
    decade: string;
    share: number;
  }>;
  /** A faixa e o disco que mais tocaram no período. */
  mostPlayed?: {
    track: { name: string; artist: string; plays: number } | null;
    album: { name: string; artist: string; plays: number } | null;
  };
  /** Artistas de gênero bem distante do que domina o período. */
  outliers?: Array<{ name: string; plays: number; genre: string }>;
  /** Artistas que voltaram depois de muito tempo sem tocar. */
  comebacks?: Array<{ name: string; plays: number; awayFor: string }>;
  /** A mesma faixa tocando várias vezes seguidas. */
  loop?: { artist: string; track: string; times: number } | null;
  /** Duas audições seguidas de gêneros sem nada em comum: o "de repente" que aconteceu mesmo. */
  transition?: {
    from: { artist: string; track: string; genre: string };
    to: { artist: string; track: string; genre: string };
  } | null;
  /** A faixa mais tocada, no período, de cada artista citado acima. */
  topTracks?: Record<string, string>;
  /** Curiosidades vindas de fonte (wiki do Last.fm): as únicas que o texto pode contar. */
  facts?: Fact[];
  /** Como a pessoa quer ser tratada nos textos. */
  listener?: { addressAs: AddressStyle };
  /** Os discos do rack da Visão geral: cada um ganha comentários próprios no pacote. */
  rackAlbums?: Array<{ album: string; artist: string; plays: number }>;
}

/** "masculino" → mano, mermão; "feminino" → mina, amiga; "neutro" → sem marca de gênero. */
export const ADDRESS_STYLES = ["masculino", "feminino", "neutro"] as const;
export type AddressStyle = (typeof ADDRESS_STYLES)[number];

export interface Fact {
  kind: "artista" | "disco";
  /** O artista, ou "disco (artista)". */
  about: string;
  text: string;
}

export interface FactsProvider {
  collectFacts(profile: MusicProfileInput): Promise<Fact[]>;
}

/** Por onde cada leitura começa; sorteado para os textos não virarem a mesma piada. */
export const NARRATIVE_ANGLES = ["surpresa", "transicao", "mais-ouvido", "mudanca", "epoca", "volta", "loop", "numeros"] as const;
export type NarrativeAngle = (typeof NARRATIVE_ANGLES)[number];

/** Como a piada é construída; sorteada à parte do ângulo, para a estrutura não virar fórmula. */
export const NARRATIVE_FORMS = ["reacao", "pergunta", "provocacao", "cena", "comparacao", "apelido"] as const;
export type NarrativeForm = (typeof NARRATIVE_FORMS)[number];

export const EVIDENCE_KEYS = [
  "totalPlays", "uniqueArtists", "uniqueTracks", "topArtists", "topGenres",
  "risingArtists", "discovery", "concentration", "eras", "mostPlayed", "outliers", "comebacks", "loop",
  "transition", "topTracks", "facts",
] as const;

export const profileNarrativeSchema = z.object({
  eyebrow: z.string().max(50).default("ANÁLISE DO PERÍODO"),
  headline: z.string().max(100),
  narrative: z.string().max(360),
  insight: z.string().max(220),
  playfulClosing: z.string().max(160).nullable().default(null),
  tone: z.enum(["EDITORIAL", "RELAXED", "PLAYFUL", "NOSTALGIC", "ANALYTICAL"]).default("RELAXED"),
  referencedEvidence: z.array(z.enum(EVIDENCE_KEYS)).max(13).default([]),
  tasteKeywords: z.array(z.string()).max(5).optional(),
  /** Gravados pelo serviço, não pelo modelo: a próxima leitura sorteia outros. */
  angle: z.enum(NARRATIVE_ANGLES).optional(),
  form: z.enum(NARRATIVE_FORMS).optional(),
});

export type ProfileNarrative = z.infer<typeof profileNarrativeSchema>;

/** Telas que recebem uma frase curta do modelo. */
export const SCREEN_KEYS = ['evolution', 'discovery', 'history'] as const;
export type ScreenKey = (typeof SCREEN_KEYS)[number];

/** Uma leitura do pacote: o ângulo e a forma que ela recebeu no sorteio. */
export interface PackSlot {
  angle: NarrativeAngle;
  form: NarrativeForm;
}

/**
 * O pacote de textos de um período, gerado numa chamada só e sorteado pela
 * interface a cada visita: várias leituras, comentários por disco do rack e
 * frases para as outras telas. A impressão digital diz de que escuta ele
 * saiu — é ela que decide quando vale gerar outro.
 */
export const readingPackSchema = z.object({
  readings: z.array(profileNarrativeSchema).min(1),
  albumLines: z
    .array(z.object({ album: z.string(), artist: z.string(), line: z.string().min(8).max(200) }))
    .default([]),
  screenLines: z.array(z.object({ screen: z.enum(SCREEN_KEYS), line: z.string().min(8).max(200) })).default([]),
  fingerprint: z.string(),
  model: z.string().optional(),
});

export type ReadingPack = z.infer<typeof readingPackSchema>;

/** Um comentário do modelo sobre um disco do rack. */
export type AlbumLine = ReadingPack["albumLines"][number];

/**
 * O pacote guardado de um período, como a conversa o lê — ou o
 * texto de reserva. Mora no domínio porque é contrato dos dois lados — o
 * serviço monta, o componente lê.
 */
export interface PackView {
  readings: ProfileNarrative[];
  albumLines: AlbumLine[];
  builtAt: string | null;
  source: "ai" | "fallback";
}

export interface PackProvider {
  /** Devolve o JSON cru do modelo: a validação é item a item, no serviço. */
  generatePack(input: MusicProfileInput, slots: PackSlot[]): Promise<{ output: unknown; model: string }>;
}
