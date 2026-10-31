import { NextResponse } from "next/server";
import { DiscoveryConflict } from "../domain/feedback";
export function discoveryError(error: unknown) {
  if (error instanceof DiscoveryConflict) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  if (["P2021", "P2022"].includes((error as { code?: string })?.code ?? "")) return NextResponse.json({
    error: "A atualização de sessões ainda precisa ser aplicada ao banco deste ambiente.", code: "DISCOVERY_MIGRATION_REQUIRED",
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ error: "Não consegui concluir essa operação. Tenta de novo." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
