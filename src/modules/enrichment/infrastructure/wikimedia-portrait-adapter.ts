import { z } from "zod";
import { artistPhotoSchema, commonsPageURL, portraitImageURL, portraitLicenseURL, type ArtistPhotoResult, type ArtistPortraitProvider } from "../domain/artist-portrait";
const cache=new Map<string,{value?:ArtistPhotoResult;expires:number}>();
const pending=new Map<string,Promise<ArtistPhotoResult>>();
let active=false; let lastRequest=0; let blockedUntil=0;
const userAgent="Arcadium/0.1 (+https://github.com/kayoitalo/arcadium)";
function remember(key:string,value:{value?:ArtistPhotoResult;expires:number}) {cache.delete(key);cache.set(key,value);while(cache.size>64)cache.delete(cache.keys().next().value!);}
export class PortraitSourceUnavailable extends Error {}
function plain(value:unknown):string {
  if(typeof value!=="string")return "";
  return value.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
}
export class WikimediaPortraitAdapter implements ArtistPortraitProvider {
  constructor(private interval=1100) {}
  private async request(url:string) {
    const delay=lastRequest+this.interval-Date.now();if(delay>0)await new Promise(r=>setTimeout(r,delay));lastRequest=Date.now();
    const response=await fetch(url,{headers:{"User-Agent":userAgent,Accept:"application/json"},signal:AbortSignal.timeout(6000),redirect:"error"});
    if(!response.ok){if(response.status===429){const seconds=Number(response.headers.get("retry-after"));blockedUntil=Date.now()+Math.max(30000,Number.isFinite(seconds)&&seconds>=0?seconds*1000:60000);}throw new PortraitSourceUnavailable("Photo source unavailable");}
    const data=await response.json();if(data?.error)throw new PortraitSourceUnavailable("Photo source unavailable");return data;
  }
  async lookup(mbid:string):Promise<ArtistPhotoResult> {
    const id=z.uuid().safeParse(mbid);if(!id.success)return {status:"MISSING",reason:"NO_ID"};mbid=id.data.toLowerCase();
    const saved=cache.get(mbid);if(saved&&saved.expires>Date.now()){if(saved.value)return saved.value;throw new PortraitSourceUnavailable("Photo source cooling down");}
    const running=pending.get(mbid);if(running)return running;
    if(active||blockedUntil>Date.now())throw new PortraitSourceUnavailable("Photo source busy");
    active=true;
    const task=this.load(mbid).then(value=>{remember(mbid,{value,expires:Date.now()+(value.status==="READY"?86400000:3600000)});return value;}).catch(error=>{remember(mbid,{expires:Date.now()+30000});throw error;});
    pending.set(mbid,task);try{return await task;}finally{active=false;pending.delete(mbid);}
  }
  private async load(mbid:string):Promise<ArtistPhotoResult> {
    // Exact external-ID search, not a text/name search or a new MusicBrainz call.
    const search=new URLSearchParams({action:"query",list:"search",srsearch:`haswbstatement:P434=${mbid}`,srnamespace:"0",srlimit:"2",format:"json",maxlag:"5"});
    const candidates=await this.request(`https://www.wikidata.org/w/api.php?${search}`);
    const ids=z.array(z.object({title:z.string().regex(/^Q[1-9]\d*$/)})).max(2).safeParse(candidates?.query?.search);
    if(!ids.success)throw new PortraitSourceUnavailable("Invalid identity response");
    if(!ids.data.length)return {status:"MISSING",reason:"NO_IMAGE"};
    const params=new URLSearchParams({action:"wbgetentities",ids:ids.data.map(row=>row.title).join("|"),props:"claims",format:"json",maxlag:"5"});
    const entities=await this.request(`https://www.wikidata.org/w/api.php?${params}`);
    if(!entities?.entities||typeof entities.entities!=="object")throw new PortraitSourceUnavailable("Invalid entity response");
    const matches=ids.data.flatMap(({title})=>{
      const entity=entities.entities[title];const claims=entity?.claims;
      const verified=Array.isArray(claims?.P434)&&claims.P434.some((claim:any)=>claim.rank!=="deprecated"&&claim.mainsnak?.datavalue?.value?.toLowerCase?.()===mbid);
      return verified?[{id:title,claims}]:[];
    });
    if(matches.length!==1)return {status:"MISSING",reason:"AMBIGUOUS"};
    const subject=matches[0];const images=Array.isArray(subject.claims.P18)?subject.claims.P18.filter((row:any)=>row.rank!=="deprecated"&&typeof row.mainsnak?.datavalue?.value==="string"):[];
    const filename=(images.find((row:any)=>row.rank==="preferred")??images[0])?.mainsnak.datavalue.value;
    if(typeof filename!=="string"||filename.length>300||/[\n\r|/#]/.test(filename))return {status:"MISSING",reason:"NO_IMAGE"};
    const imageParams=new URLSearchParams({action:"query",titles:`File:${filename}`,prop:"imageinfo",iiprop:"url|mime|extmetadata",iiurlwidth:"720",format:"json",formatversion:"2",maxlag:"5"});
    const info=await this.request(`https://commons.wikimedia.org/w/api.php?${imageParams}`);
    const pages=info?.query?.pages;if(!Array.isArray(pages)||pages.length!==1)throw new PortraitSourceUnavailable("Invalid image response");
    const image=pages[0]?.imageinfo?.[0];if(!image)return {status:"MISSING",reason:"NO_IMAGE"};
    if(!["image/jpeg","image/png","image/webp"].includes(image.mime))return {status:"MISSING",reason:"NO_IMAGE"};
    const meta=image.extmetadata??{};const licenseUrl=portraitLicenseURL(meta.LicenseUrl?.value);
    const parsed=artistPhotoSchema.safeParse({status:"READY",mbid,imageUrl:portraitImageURL(image.thumburl),sourceUrl:commonsPageURL(image.descriptionurl),
      entityUrl:`https://www.wikidata.org/wiki/${subject.id}`,author:plain(meta.Artist?.value),license:plain(meta.LicenseShortName?.value),licenseUrl,checkedAt:new Date().toISOString()});
    return parsed.success?parsed.data:{status:"MISSING",reason:"NO_CREDIT"};
  }
}
