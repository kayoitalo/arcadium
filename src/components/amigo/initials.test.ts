import { describe, expect, it } from "vitest";
import { initials } from "./fala";

describe("initials", () => {
  it("names a cover-less record by the first letters of its title", () => {
    expect(initials("Blood Sugar Sex Magik (Deluxe Edition)")).toBe("BS");
    expect(initials("The Getaway")).toBe("G");
    expect(initials("Clube da Esquina")).toBe("CE");
    expect(initials("Ramones (40th Anniversary Deluxe Edition; 2016 Remaster)")).toBe("R");
    expect(initials("…")).toBe("·");
  });
});
