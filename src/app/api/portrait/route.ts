import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { PortraitService } from "@/modules/conversation/application/portrait-service";
export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  try { return NextResponse.json(await new PortraitService().load(access.userId), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Não consegui reunir teu retrato." }, { status: 503 }); }
}
