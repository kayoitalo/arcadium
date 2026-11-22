import { describe, expect, it } from "vitest";
import { readNowPlaying } from "./now-playing";

const track = (attr?: object, image = "https://lastfm.freetls.fastly.net/i/u/300x300/abc.jpg") => ({
  name: "Can't Stop", artist: { "#text": "Red Hot Chili Peppers" }, album: { "#text": "By the Way" },
  image: [{ size: "small", "#text": "" }, { size: "extralarge", "#text": image }], ...(attr ? { "@attr": attr } : {}),
});

describe("tocando agora", () => {
  it("reads the first track only when Last.fm marks it as now playing", () => {
    expect(readNowPlaying({ recenttracks: { track: [track({ nowplaying: "true" }), track()] } })).toEqual({
      track: "Can't Stop", artist: "Red Hot Chili Peppers", album: "By the Way", coverUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/abc.jpg",
    });
    expect(readNowPlaying({ recenttracks: { track: [track()] } })).toBeNull();
    expect(readNowPlaying({})).toBeNull();
  });

  it("does not treat Last.fm's grey star as a cover", () => {
    const star = "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png";
    expect(readNowPlaying({ recenttracks: { track: track({ nowplaying: "true" }, star) } })?.coverUrl).toBeNull();
  });
});
