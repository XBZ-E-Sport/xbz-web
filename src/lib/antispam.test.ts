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

  it("refuse un envoi SANS délai valide (absent, nul, invalide) : on n'est pas passé par le formulaire", () => {
    // Le formulaire envoie toujours `elapsed` une fois interactif. Avant, un
    // script n'avait qu'à omettre le champ pour sauter le délai minimum.
    expect(checkSpam({}).tooFast).toBe(true);
    expect(checkSpam({ elapsed: "0" }).tooFast).toBe(true);
    expect(checkSpam({ elapsed: "" }).tooFast).toBe(true);
    expect(checkSpam({ elapsed: "abc" }).tooFast).toBe(true);
    expect(checkSpam({ elapsed: ["5000", "1"] }).tooFast).toBe(true);
    expect(checkSpam({ elapsed: ["5000"] }).tooFast).toBe(true); // Number(["5000"]) vaudrait 5000
    expect(checkSpam({ elapsed: 5000 }).tooFast).toBe(false); // nombre accepté
  });
});
