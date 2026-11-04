import { beforeEach, describe, expect, it, vi } from "vitest";
const db=vi.hoisted(()=>({find:vi.fn()}));vi.mock("@/lib/db/prisma",()=>({prisma:{listeningEvent:{findFirst:db.find}}}));
import { ArtistPortraitService } from "./artist-portrait-service";
const artist=()=>({name:"Artist",mbid:crypto.randomUUID(),metadataStatus:"RESOLVED"});
beforeEach(()=>vi.resetAllMocks());
describe("private artist photograph references",()=>{
  it("verifies an observed owned artist before provider work",async()=>{
    db.find.mockResolvedValue(null);const lookup=vi.fn();await expect(new ArtistPortraitService({lookup}).load("owner","Other")).rejects.toMatchObject({status:404});expect(lookup).not.toHaveBeenCalled();
    expect(db.find.mock.calls[0][0].where).toEqual({userId:"owner",rawArtistName:"Other"});
  });
  it.each([null,{...artist(),metadataStatus:"IDENTITY_REVIEW"},{...artist(),name:"Homonym feat Guest"}])("does not guess an image from a missing or uncertain identity",async value=>{
    db.find.mockResolvedValue({artist:value});const lookup=vi.fn();expect(await new ArtistPortraitService({lookup}).load("owner","Artist")).toEqual({status:"MISSING",reason:"NO_ID"});expect(lookup).not.toHaveBeenCalled();
  });
  it("uses the persisted verified MBID and reports temporary provider failure distinctly",async()=>{
    const value=artist();db.find.mockResolvedValue({artist:value});const lookup=vi.fn().mockResolvedValue({status:"MISSING",reason:"NO_IMAGE"});
    expect(await new ArtistPortraitService({lookup}).load("owner","Artist")).toMatchObject({reason:"NO_IMAGE"});expect(lookup).toHaveBeenCalledExactlyOnceWith(value.mbid);
    lookup.mockRejectedValue(new Error());await expect(new ArtistPortraitService({lookup}).load("owner","Artist")).rejects.toMatchObject({status:503,code:"PHOTO_TEMPORARY"});
  });
});
