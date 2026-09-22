import { describe, it, expect } from "vitest";

import { isThirdPartyError, isReactHydrationError } from "@/lib/client-report";

describe("isThirdPartyError", () => {
  it("écarte le plantage exact d'une extension (cas vécu M_ID)", () => {
    // L'erreur qui a inquiété le staff : une extension plante sur /fr/equipes.
    // Rien à voir avec le site — sa pile ne cite QUE l'extension.
    expect(
      isThirdPartyError({
        message: "Cannot read properties of undefined (reading 'M_ID')",
        stack:
          "TypeError: Cannot read properties of undefined (reading 'M_ID')\n" +
          "    at Z (chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon/executors/200.js:1:761)",
      }),
    ).toBe(true);
  });

  it("écarte les extensions Firefox / Safari (filename ou pile)", () => {
    expect(isThirdPartyError({ filename: "moz-extension://abc/inject.js" })).toBe(true);
    expect(
      isThirdPartyError({ stack: "at x (safari-web-extension://xyz/content.js:2:3)" }),
    ).toBe(true);
  });

  it("écarte l'erreur cross-origin opaque (« Script error. » sans pile)", () => {
    expect(isThirdPartyError({ message: "Script error.", stack: undefined })).toBe(true);
  });

  it("GARDE une vraie erreur du site (pile sur notre propre bundle)", () => {
    // Ne doit jamais filtrer nos propres bugs : c'est tout l'intérêt du monitoring.
    expect(
      isThirdPartyError({
        message: "Cannot read properties of undefined (reading 'slug')",
        stack:
          "TypeError: Cannot read properties of undefined (reading 'slug')\n" +
          "    at PlayerCard (https://xbz-web.vercel.app/_next/static/chunks/app.js:1:42)",
      }),
    ).toBe(false);
  });

  it("GARDE une erreur applicative sans pile mais avec un vrai message", () => {
    // « Script error. » est le seul message générique qu'on écarte ; un message
    // réel sans pile reste remonté.
    expect(isThirdPartyError({ message: "Échec de chargement du roster" })).toBe(false);
  });
});

describe("isReactHydrationError", () => {
  it("écarte le #418 minifié tel qu'il arrive en prod (cas vécu /fr)", () => {
    // Le message exact remonté au Discord staff : erreur d'hydratation, cause
    // n°1 = la traduction auto de la page, jamais un bug du site.
    expect(
      isReactHydrationError(
        "Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message",
      ),
    ).toBe(true);
  });

  it("écarte toute la famille d'hydratation minifiée (#421/#422/#423/#425)", () => {
    for (const code of [421, 422, 423, 425]) {
      expect(isReactHydrationError(`Minified React error #${code}; visit https://react.dev/errors/${code}`)).toBe(true);
    }
  });

  it("écarte aussi les messages en clair (dev/preview non minifié)", () => {
    expect(isReactHydrationError("Hydration failed because the server rendered HTML didn't match the client.")).toBe(true);
    expect(isReactHydrationError("Text content does not match server-rendered HTML.")).toBe(true);
    expect(isReactHydrationError("There was an error while hydrating.")).toBe(true);
  });

  it("GARDE les autres erreurs React minifiées (pas de l'hydratation)", () => {
    // #185 (boucle de setState) est un vrai bug applicatif : il doit remonter.
    expect(isReactHydrationError("Minified React error #185; visit https://react.dev/errors/185")).toBe(false);
  });

  it("GARDE une erreur applicative normale et le message vide", () => {
    expect(isReactHydrationError("Cannot read properties of undefined (reading 'slug')")).toBe(false);
    expect(isReactHydrationError(undefined)).toBe(false);
    expect(isReactHydrationError("")).toBe(false);
  });
});
