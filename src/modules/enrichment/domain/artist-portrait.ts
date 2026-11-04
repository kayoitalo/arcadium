import { z } from "zod";
export function portraitImageURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url=new URL(value); return url.protocol==="https:" && ["upload.wikimedia.org","thumb.wikimedia.org"].includes(url.hostname) && !url.port && !url.username && !url.password
    && url.pathname.startsWith("/wikipedia/commons/") ? url.href : null; } catch { return null; }
}
export function commonsPageURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url=new URL(value); return url.protocol==="https:" && url.hostname==="commons.wikimedia.org" && !url.port && !url.username && !url.password
    && url.pathname.startsWith("/wiki/File:") ? url.href : null; } catch { return null; }
}
export function portraitLicenseURL(value: unknown): string | null {
  if(typeof value!=="string") return null;
  try {const url=new URL(value);url.pathname=url.pathname.replace(/\/(?:deed|legalcode)(?:\.[a-z-]+)?\/?$/,"/").replace(/\/?$/,"/");
    if(!["http:","https:"].includes(url.protocol)||url.hostname!=="creativecommons.org"||url.port||url.username||url.password
      ||!/^\/(licenses\/by(?:-sa)?\/\d\.\d|publicdomain\/(?:zero|mark)\/1\.0)\/$/.test(url.pathname))return null;
    url.protocol="https:";return url.href;}catch{return null;}
}
export const artistPhotoSchema=z.object({
  status:z.literal("READY"), imageUrl:z.string().refine((value)=>portraitImageURL(value)===value), sourceUrl:z.string().refine((value)=>commonsPageURL(value)===value),
  entityUrl:z.string().regex(/^https:\/\/www\.wikidata\.org\/wiki\/Q[1-9]\d*$/), mbid:z.uuid(), author:z.string().min(1).max(1000),
  license:z.string().min(1).max(100), licenseUrl:z.string().refine((value)=>portraitLicenseURL(value)===value), checkedAt:z.string().datetime(),
});
export const artistPhotoResultSchema=z.discriminatedUnion("status",[artistPhotoSchema,z.object({status:z.literal("MISSING"),reason:z.enum(["NO_ID","NO_IMAGE","AMBIGUOUS","NO_CREDIT"])})]);
export type ArtistPhoto=z.infer<typeof artistPhotoSchema>;
export type ArtistPhotoResult=z.infer<typeof artistPhotoResultSchema>;
export interface ArtistPortraitProvider { lookup(mbid:string):Promise<ArtistPhotoResult> }
