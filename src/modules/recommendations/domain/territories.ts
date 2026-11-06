import { z } from "zod";
import { filterGenreTags } from "@/modules/enrichment/domain/genre-tags";

export const TERRITORY_VERSION = "catalog-territories-1" as const;
export const territoryRequestSchema = z.object({ version: z.literal(TERRITORY_VERSION), genre: z.string().trim().min(2).max(40) }).strict();
export type TerritoryRequest = z.infer<typeof territoryRequestSchema>;
export const territorySnapshotSchema = territoryRequestSchema.extend({
  scope: z.literal("artist-tag"), capturedAt: z.string().datetime(),
  artists: z.array(z.object({ id: z.string(), name: z.string(), mbid: z.string().nullable(), enrichedAt: z.string().datetime(),
    tracks: z.array(z.object({ id: z.string(), name: z.string() })).max(3) })).max(6),
});
export type TerritorySnapshot = z.infer<typeof territorySnapshotSchema>;
export const repertoireRestrictionSchema = z.object({
  albumGenre: z.string().trim().min(2).max(80).optional(),
  maxDurationMs: z.number().int().min(1000).max(3_600_000).optional(),
  // Unsupported requests stay explicit; the service rejects them before generation.
  moment: z.enum(["WORKING", "STUDYING", "EXERCISING", "RELAXING"]).optional(),
  vocals: z.enum(["INSTRUMENTAL", "VOCAL"]).optional(),
}).strict();
export type RepertoireRestriction = z.infer<typeof repertoireRestrictionSchema>;

export function exactGenre(tags: string | null, genre: string) {
  return filterGenreTags((tags ?? "").split(",")).includes(genre.toLowerCase());
}

/** Review material, never a published or automatically approved curation. These
 * proposals define a checkable catalog cut, not invented sonic properties. */
export const CURATION_PROPOSALS = [
  { id: "dub-doors", version: 1, status: "PROPOSED", title: "Dub: portas pelo catálogo", genre: "dub",
    anchor: { artistName: "Augustus Pablo", albumName: "King Tubbys Meets Rockers Uptown", sourceUrl: "https://music.apple.com/us/album/king-tubbys-meets-rockers-uptown/1533707240", scope: "album", checkedOn: "2026-11-04", rationale: "A fonte classifica este álbum como dub. Candidato a entrada por álbum; escolher a edição antes de ouvir." },
    selection: "Até seis artistas sem reprodução na conta, tag dub exata, identidade sem colisão; até três títulos por artista.",
    review: "Revisar artistas/títulos, versões, representatividade e sequência; tag de artista não certifica gravação dub." },
  { id: "jazz-doors", version: 1, status: "PROPOSED", title: "Jazz: outra entrada", genre: "jazz",
    anchor: { artistName: "Alice Coltrane", albumName: "Journey in Satchidananda", sourceUrl: "https://www.alicecoltrane.com/journey-in-satchidananda", scope: "album", checkedOn: "2026-11-04", rationale: "O site da artista documenta cinco faixas e créditos com escopo por número de faixa. Candidato a jornada em ordem; não transportar créditos para outra edição sem conferir." },
    selection: "Recorte pela tag jazz exata; manter diversidade de artistas e não preencher com vizinhos do perfil.",
    review: "Escolher gravações e uma ordem editorial com fontes; não presumir uma progressão fixa de gêneros." },
  { id: "samba-doors", version: 1, status: "PROPOSED", title: "Samba: além dos nomes conhecidos", genre: "samba",
    anchor: { artistName: "Cartola", albumName: "Cartola (1976)", sourceUrl: "https://www.universalmusic.com.br/2026/03/04/a-janela-de-cartola/", scope: "album", checkedOn: "2026-11-04", rationale: "A gravadora distingue o disco de 1976 do homônimo de 1974 e documenta a sequência. Essa distinção precisa sobreviver à escolha de edição." },
    selection: "Artistas catalogados com samba, fora do histórico da conta; lacuna permanece lacuna.",
    review: "Revisar cobertura brasileira, homônimos e edições; associação de artista não prova ritmo de cada faixa." },
] as const;

export const coverageSchema = z.object({ version: z.literal(1), requested: z.number().int(), selected: z.number().int(),
  candidates: z.number().int(), eligible: z.number().int(), status: z.enum(["SUFFICIENT", "INSUFFICIENT"]),
  scope: z.enum(["territory-artists", "repertoire-metadata", "reference", "profile"]),
  elapsedMs: z.number().nonnegative(),
  timingScope: z.literal("generation-before-commit").optional(),
  provider: z.object({ configured: z.boolean(), attempts: z.number().int().nonnegative().nullable(), failures: z.number().int().nonnegative().nullable(),
    cacheHits: z.number().int().nonnegative().nullable(), deadlineStops: z.number().int().nonnegative().nullable() }).optional(),
});
export type DiscoveryCoverage = z.infer<typeof coverageSchema>;
