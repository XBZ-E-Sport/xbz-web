import { describe, it, expect } from "vitest";

import { getClientIp } from "@/lib/ratelimit";

function req(headers: Record<string, string>): Request {
  return new Request("https://xbz-esport.fr/api/x", { headers });
}

describe("getClientIp", () => {
  it("prend la première IP de x-forwarded-for", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("trim les espaces autour de l'IP", () => {
    expect(getClientIp(req({ "x-forwarded-for": "  9.9.9.9  " }))).toBe("9.9.9.9");
  });

  it("retombe sur x-real-ip si pas de x-forwarded-for", () => {
    expect(getClientIp(req({ "x-real-ip": "10.0.0.1" }))).toBe("10.0.0.1");
  });

  it("retourne 'unknown' sans aucun en-tête d'IP", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });
});
