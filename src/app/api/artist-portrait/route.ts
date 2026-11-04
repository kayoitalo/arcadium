import { z } from "zod";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { ArtistPortraitService } from "@/modules/enrichment/application/artist-portrait-service";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
export const dynamic="force-dynamic";
export const maxDuration=30;
export async function POST(request:Request) {
  const access=await authorizeApi(request);if(access.response)return access.response;
  const input=z.object({artistName:z.string().trim().min(1).max(500)}).strict().safeParse(await request.json().catch(()=>null));
  if(!input.success)return NextResponse.json({error:"Escolha um artista do teu histórico."},{status:400,headers:{"Cache-Control":"private, no-store"}});
  try{return NextResponse.json(await new ArtistPortraitService().load(access.userId,input.data.artistName),{headers:{"Cache-Control":"private, no-store"}});}catch(error){return discoveryError(error);}
}
