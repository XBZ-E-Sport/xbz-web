import { describe, it, expect } from "vitest";

import { buildDiscordPayload } from "@/lib/report-error";

const ISO = "2026-07-23T10:00:00.000Z";

describe("buildDiscordPayload", () => {
  it("construit un embed avec titre, source, chemin et extras", () => {
    const embed = buildDiscordPayload(
      { source: "server", message: "Boom", path: "/boutique", extra: { method: "GET" } },
      ISO,
    ).embeds[0];

    expect(embed.title).toContain("Boom");
    expect(embed.timestamp).toBe(ISO);
    const names = embed.fields.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["Source", "Chemin", "method"]));
  });

  it("tronque un titre très long (limite Discord)", () => {
    const embed = buildDiscordPayload({ source: "client", message: "x".repeat(500) }, ISO).embeds[0];
    expect(embed.title.length).toBeLessThanOrEqual(240);
  });

  it("met la stack dans un bloc code, ou rien si absente", () => {
    const withStack = buildDiscordPayload({ source: "server", message: "e", stack: "at a\nat b" }, ISO);
    expect(withStack.embeds[0].description).toContain("```");

    const noStack = buildDiscordPayload({ source: "server", message: "e" }, ISO);
    expect(noStack.embeds[0].description).toBeUndefined();
  });

  it("ignore les extras vides/null", () => {
    const embed = buildDiscordPayload(
      { source: "server", message: "e", extra: { a: "", b: null, c: "ok" } },
      ISO,
    ).embeds[0];
    const names = embed.fields.map((f) => f.name);
    expect(names).toContain("c");
    expect(names).not.toContain("a");
    expect(names).not.toContain("b");
  });
});
