import { createHash } from "node:crypto";
import type { ConversationMoment } from "./conversation.types";
export function editorialKey(moment: ConversationMoment) {
  const e = moment.evidence;
  const subject = e.kind === "ranking" ? [e.kind, e.unit, e.rows[e.focusIndex]?.label, e.rows[e.focusIndex]?.sub]
    : e.kind === "transition" ? [e.kind, e.from.artist, e.from.track, e.to.artist, e.to.track]
    : e.kind === "loop" ? [e.kind, e.artist, e.track]
    : e.kind === "night" ? [e.kind, e.steps[0]?.when ?? e.from]
    : e.kind === "binge" ? [e.kind, e.artist, e.day]
    : e.kind === "comeback" || e.kind === "outlier" || e.kind === "debut" ? [e.kind, e.artist] : [e.kind, ...e.focus.slice().sort()];
  return createHash("sha256").update(JSON.stringify(subject).toLowerCase()).digest("hex");
}
export function editorialSubject(moment: ConversationMoment) {
  const e = moment.evidence;
  if (e.kind === "ranking") { const row = e.rows[e.focusIndex]; return `${row?.label ?? "Escuta"}${row?.sub ? ` · ${row.sub}` : ""} · destaques de reprodução`; }
  if (e.kind === "transition") return `${e.from.track} → ${e.to.track} · passagens entre músicas`;
  if (e.kind === "loop") return `${e.track} · ${e.artist} · faixa em repetição`;
  if (e.kind === "comeback") return `${e.artist} · voltas depois de um sumiço`;
  if (e.kind === "debut") return `${e.artist} · estreias`;
  if (e.kind === "night") return `Madrugada de ${e.steps[0]?.when ?? e.from} · sessões de madrugada`;
  if (e.kind === "binge") return `${e.artist} · ${e.day} · dias de um artista só`;
  if (e.kind === "outlier") return `${e.artist} · ponto fora da curva`;
  return `Épocas na escuta: ${e.focus.slice().sort().join(", ")}`;
}
/** Priority eligibility; a recently seen reading remains visible in the conversation. */
export function editorialAvailable(memory: { dismissed: boolean; seenAt: Date | null } | undefined, revisit: boolean, now = Date.now()) {
  return !memory?.dismissed && (revisit || !memory?.seenAt || now - memory.seenAt.getTime() >= 72 * 60 * 60 * 1000);
}
