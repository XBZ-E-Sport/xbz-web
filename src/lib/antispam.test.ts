import { describe, it, expect } from "vitest";

import { checkSpam } from "@/lib/antispam";

describe("checkSpam", () => {
  it("laisse passer un envoi humain normal", () => {
    expect(checkSpam({ website: "", elapsed: "5000" })).toEqual({ spam: false, tooFast: false });
  });

  it("détecte le honeypot rempli (bot)", () => {
    expect(checkSpam({ website: "http://spam", elapsed: "5000" }).spam).toBe(true);
  });

  it("ignore les espaces seuls dans le honeypot", () => {
    expect(checkSpam({ website: "   ", elapsed: "5000" }).spam).toBe(false);
  });

  it("détecte un envoi trop rapide (< 2 s)", () => {
    expect(checkSpam({ elapsed: "800" }).tooFast).toBe(true);
    expect(checkSpam({ elapsed: "1999" }).tooFast).toBe(true);
  });

  it("n'est pas trop rapide au seuil (2000 ms) ni au-dessus", () => {
    expect(checkSpam({ elapsed: "2000" }).tooFast).toBe(false);
    expect(checkSpam({ elapsed: "5000" }).tooFast).toBe(false);
  });

  it("ne déclenche pas tooFast quand elapsed est absent, nul ou invalide", () => {
    expect(checkSpam({}).tooFast).toBe(false);
    expect(checkSpam({ elapsed: "0" }).tooFast).toBe(false);
    expect(checkSpam({ elapsed: "" }).tooFast).toBe(false);
    expect(checkSpam({ elapsed: "abc" }).tooFast).toBe(false);
  });
});
