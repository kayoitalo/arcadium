import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth=vi.hoisted(()=>vi.fn());vi.mock("@/lib/security/api-auth",()=>({authorizeApi:auth}));
import { GET } from "./route";
beforeEach(()=>{vi.resetAllMocks();auth.mockResolvedValue({userId:"owner"});vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("synthetic image",{headers:{"Content-Type":"image/jpeg"}})));});
afterEach(()=>vi.unstubAllGlobals());
const request=(source:string)=>new Request("https://app.test/api/cover?u="+encodeURIComponent(source));
describe("Wikimedia portrait image proxy",()=>{
  it("requires authentication before upstream work",async()=>{auth.mockResolvedValue({response:new Response(null,{status:401})});expect((await GET(request("https://thumb.wikimedia.org/wikipedia/commons/a.jpg"))).status).toBe(401);expect(fetch).not.toHaveBeenCalled();});
  it.each(["upload.wikimedia.org","thumb.wikimedia.org"])("allows only the Commons path on the exact %s host without redirects",async host=>{
    expect((await GET(request(`https://${host}/wikipedia/commons/thumb/a/a.jpg`))).status).toBe(200);expect(fetch).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({redirect:"error"}));
  });
  it.each(["https://thumb.wikimedia.org.evil.test/wikipedia/commons/a.jpg","https://thumb.wikimedia.org/other/a.jpg","https://thumb.wikimedia.org:444/wikipedia/commons/a.jpg","https://user@thumb.wikimedia.org/wikipedia/commons/a.jpg"])("refuses an unsafe source %s",async url=>{expect((await GET(request(url))).status).toBe(403);expect(fetch).not.toHaveBeenCalled();});
  it.each(["image/svg+xml", "text/html", ""])("refuses an unverified portrait MIME %s",async mime=>{const headers = new Headers(); if(mime)headers.set("Content-Type",mime);vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([0]),{headers}));expect((await GET(request("https://thumb.wikimedia.org/wikipedia/commons/a.svg"))).status).toBe(415);});
});
