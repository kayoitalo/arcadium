import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),load:vi.fn()}));vi.mock("@/lib/security/api-auth",()=>({authorizeApi:mocks.auth}));vi.mock("@/modules/enrichment/application/artist-portrait-service",()=>({ArtistPortraitService:class{load=mocks.load;}}));
import { POST } from "./route";
const request=(body:unknown)=>new Request("https://app.test/api/artist-portrait",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({userId:"owner"});mocks.load.mockResolvedValue({status:"MISSING",reason:"NO_ID"});});
describe("artist photo API",()=>{
  it("authenticates before payload or lookup",async()=>{mocks.auth.mockResolvedValue({response:new Response(null,{status:401})});expect((await POST(request(null))).status).toBe(401);expect(mocks.load).not.toHaveBeenCalled();});
  it("accepts only a bounded artist reference and binds it to the owner",async()=>{
    expect((await POST(request({artistName:"Artist",url:"https://evil.test"}))).status).toBe(400);
    const response=await POST(request({artistName:"Artist"}));expect(response.status).toBe(200);expect(response.headers.get("Cache-Control")).toContain("no-store");expect(mocks.load).toHaveBeenCalledExactlyOnceWith("owner","Artist");
  });
});
