import { describe, it, expect } from "vitest";

import { getClientIp } from "@/lib/ratelimit";

function req(headers: Record<string, string>): Request {
  return new Request("https://xbz-esport.fr/api/x", { headers });
}

describe("getClientIp", () => {
  it("préfère x-real-ip, que le client ne peut pas imposer", () => {
    expect(getClientIp(req({ "x-real-ip": "10.0.0.1" }))).toBe("10.0.0.1");
    // Même quand une liste falsifiée l'accompagne.
    expect(
      getClientIp(req({ "x-real-ip": "10.0.0.1", "x-forwarded-for": "6.6.6.6" })),
    ).toBe("10.0.0.1");
  });

  it("prend la DERNIÈRE entrée de x-forwarded-for", () => {
    // C'est le nerf de la protection : la première entrée est celle qu'un
    // client a pu écrire lui-même, la dernière est ajoutée par le relais.
    // En prendre la première, c'est offrir une identité neuve à chaque envoi
    // — l'anti-flood ne compte alors plus rien.
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7, 5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("trim les espaces autour de l'IP", () => {
    expect(getClientIp(req({ "x-forwarded-for": "  9.9.9.9  " }))).toBe("9.9.9.9");
  });

  it("retourne 'unknown' sans aucun en-tête d'IP", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });

  it("retourne 'unknown' plutôt qu'une chaîne vide sur un en-tête vide", () => {
    // Sinon deux visiteurs distincts partageraient le compteur de la clé "".
    expect(getClientIp(req({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
