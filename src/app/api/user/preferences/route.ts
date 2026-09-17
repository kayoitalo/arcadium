import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ADDRESS_STYLES } from "@/modules/ai-analysis/domain/ai-analysis.types";

export const dynamic = "force-dynamic";

const updateSchema = z.object({ addressAs: z.enum(ADDRESS_STYLES) });

/** As preferências de conversa: por enquanto, como os textos tratam a pessoa. */
export async function GET() {
  const user = await prisma.user.findFirst({ select: { addressAs: true } });
  return NextResponse.json({ addressAs: user?.addressAs ?? "neutro" });
}

export async function PUT(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tratamento inválido." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) return NextResponse.json({ error: "Nenhum usuário encontrado." }, { status: 404 });

  await prisma.user.update({ where: { id: user.id }, data: { addressAs: parsed.data.addressAs } });
  return NextResponse.json({ addressAs: parsed.data.addressAs });
}
