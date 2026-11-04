import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mbid="f59c5520-5f46-4d2c-b2c4-822eabf53419";
const claim=(value:string)=>({rank:"normal",mainsnak:{datavalue:{value}}});
const search=()=>({query:{search:[{title:"Q261"}]}});
const entity=()=>({entities:{Q261:{claims:{P434:[claim(mbid)],P18:[claim("Synthetic.jpg")]}}}});
const file=(fields={})=>({query:{pages:[{imageinfo:[{mime:"image/jpeg",thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Synthetic.jpg/720px-Synthetic.jpg",
  descriptionurl:"https://commons.wikimedia.org/wiki/File:Synthetic.jpg",extmetadata:{Artist:{value:'<a href="https://example.test">Synthetic author</a>'},LicenseShortName:{value:"CC BY-SA 4.0"},LicenseUrl:{value:"http://creativecommons.org/licenses/by-sa/4.0/"}},...fields}]}]}});
const ok=(data:unknown)=>new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}});
beforeEach(()=>{vi.resetModules();vi.stubGlobal("fetch",vi.fn());});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
async function adapter(){return new (await import("../wikimedia-portrait-adapter")).WikimediaPortraitAdapter(0);}
function responses(last=file()){vi.mocked(fetch).mockResolvedValueOnce(ok(search())).mockResolvedValueOnce(ok(entity())).mockResolvedValueOnce(ok(last));}
describe("bounded artist photographs",()=>{
  it("checks exact external identity, keeps credit, caps lookups and shares/cache results",async()=>{
    responses();const api=await adapter();const [photo,again]=await Promise.all([api.lookup(mbid),api.lookup(mbid)]);
    expect(photo).toMatchObject({status:"READY",mbid,author:"Synthetic author",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",entityUrl:"https://www.wikidata.org/wiki/Q261"});
    expect(again).toEqual(photo);await api.lookup(mbid);expect(fetch).toHaveBeenCalledTimes(3);
    const url=new URL(String(vi.mocked(fetch).mock.calls[0][0]));expect(url.searchParams.get("srsearch")).toBe("haswbstatement:P434="+mbid);expect(url.searchParams.get("srlimit")).toBe("2");
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toContain("iiurlwidth=720");
  });
  it("does no name search when the external identifier is absent or invalid",async()=>{
    expect(await (await adapter()).lookup('" UNION anything')).toMatchObject({status:"MISSING",reason:"NO_ID"});expect(fetch).not.toHaveBeenCalled();
  });
  it("accepts the current thumbnail CDN and normalizes a license URL without a final slash",async()=>{
    const data=file({thumburl:"https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Synthetic.jpg/960px-Synthetic.jpg"});
    data.query.pages[0].imageinfo[0].extmetadata.LicenseUrl.value="https://creativecommons.org/licenses/by-sa/4.0";
    responses(data);expect(await (await adapter()).lookup(mbid)).toMatchObject({status:"READY",imageUrl:expect.stringContaining("thumb.wikimedia.org"),licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/"});
  });
  it("refuses a returned entity with a different MBID instead of taking the first photo",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(ok(search())).mockResolvedValueOnce(ok({entities:{Q261:{claims:{P434:[claim(crypto.randomUUID())],P18:[claim("Wrong.jpg")]}}}}));
    expect(await (await adapter()).lookup(mbid)).toEqual({status:"MISSING",reason:"AMBIGUOUS"});expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("refuses ambiguity between two entities sharing an external ID",async()=>{
    const data=entity();vi.mocked(fetch).mockResolvedValueOnce(ok({query:{search:[{title:"Q261"},{title:"Q262"}]}})).mockResolvedValueOnce(ok({entities:{...data.entities,Q262:data.entities.Q261}}));
    expect(await (await adapter()).lookup(mbid)).toMatchObject({reason:"AMBIGUOUS"});expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["credit","license","host","svg"])("leaves a gap for unsupported %s",async problem=>{
    const fields=problem==="credit"?{extmetadata:{}}:problem==="license"?{extmetadata:{Artist:{value:"Author"},LicenseShortName:{value:"unknown"},LicenseUrl:{value:"https://evil.test/license"}}}:problem==="host"?{thumburl:"https://upload.wikimedia.org.evil.test/a.jpg"}:{mime:"image/svg+xml"};
    responses(file(fields));expect(await (await adapter()).lookup(mbid)).toMatchObject({status:"MISSING"});expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("keeps absence separate from failures and does not retry or start concurrent artists",async()=>{
    let finish!:(value:Response)=>void;vi.mocked(fetch).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const api=await adapter();const running=api.lookup(mbid);
    await expect(api.lookup(crypto.randomUUID())).rejects.toThrow();finish(new Response("",{status:503}));await expect(running).rejects.toThrow();await expect(api.lookup(mbid)).rejects.toThrow();expect(fetch).toHaveBeenCalledOnce();
  });
  it("honors a provider-wide 429 cooldown for other artists too",async()=>{
    vi.useFakeTimers();vi.mocked(fetch).mockResolvedValue(new Response("",{status:429,headers:{"Retry-After":"7200"}}));const api=await adapter();
    await expect(api.lookup(mbid)).rejects.toThrow();vi.advanceTimersByTime(3600000);await expect(api.lookup(crypto.randomUUID())).rejects.toThrow();expect(fetch).toHaveBeenCalledOnce();
  });
});
