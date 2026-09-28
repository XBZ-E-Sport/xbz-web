import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CLIENT_REPORTS_PER_MINUTE,
  buildDiscordPayload,
  escapeMarkdown,
  inlineCode,
  isIgnorableServerError,
  reportError,
} from "@/lib/report-error";

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

describe("buildDiscordPayload — texte venu de l'extérieur", () => {
  const PHISH = "[Connexion staff](https://phishing.example/login)";

  it("un lien masqué dans le chemin ou un extra reste inerte (code en ligne)", () => {
    const embed = buildDiscordPayload(
      { source: "client", message: "e", path: PHISH, extra: { digest: PHISH } },
      ISO,
    ).embeds[0];
    for (const name of ["Chemin", "digest"]) {
      const value = embed.fields.find((f) => f.name === name)!.value;
      expect(value.startsWith("`") && value.endsWith("`"), name).toBe(true);
      expect(value.slice(1, -1), name).not.toContain("`");
    }
  });

  it("un chemin ne peut pas fermer son code en ligne avec un backtick", () => {
    const value = buildDiscordPayload({ source: "client", message: "e", path: "/a` [x](https://p) `" }, ISO)
      .embeds[0].fields.find((f) => f.name === "Chemin")!.value;
    expect(value.match(/`/g)).toHaveLength(2);
  });

  it("échappe le Markdown du titre (plus de lien masqué ni de mise en forme)", () => {
    const title = buildDiscordPayload({ source: "client", message: `**Alerte** ${PHISH}` }, ISO).embeds[0].title;
    expect(title).not.toMatch(/(?<!\\)\[/);
    expect(title).not.toMatch(/(?<!\\)\*/);
    expect(title).toContain("\\[Connexion staff\\]\\(https");
  });

  it("une stack ne peut pas sortir de son bloc de code", () => {
    const description = buildDiscordPayload(
      { source: "client", message: "e", stack: "at a\n```\n@everyone " + PHISH + "\n```" },
      ISO,
    ).embeds[0].description!;
    expect(description.match(/```/g)).toHaveLength(2); // ouverture + fermeture, rien d'autre
    expect(description.startsWith("```\n") && description.endsWith("\n```")).toBe(true);
  });

  it("ne notifie personne (aucune mention autorisée)", () => {
    expect(buildDiscordPayload({ source: "client", message: "@everyone" }, ISO).allowed_mentions).toEqual({
      parse: [],
    });
  });

  it("signale qu'un rapport client n'est pas vérifié", () => {
    const source = (r: "client" | "server") =>
      buildDiscordPayload({ source: r, message: "e" }, ISO).embeds[0].fields.find((f) => f.name === "Source")!.value;
    expect(source("client")).toBe("client (non vérifié)");
    expect(source("server")).toBe("server");
  });

  it("escapeMarkdown / inlineCode", () => {
    expect(escapeMarkdown("a_b*c")).toBe("a\\_b\\*c");
    expect(inlineCode("x`y")).toBe("`xˋy`");
  });
});

describe("isIgnorableServerError", () => {
  it("écarte « Failed to find Server Action » (skew de déploiement / robots)", () => {
    // Le message exact remonté à 3h : ID de Server Action d'un autre déploiement.
    expect(
      isIgnorableServerError({
        source: "server",
        message:
          "Failed to find Server Action. This request might be from an older or newer deployment.",
        path: "/fr",
      }),
    ).toBe(true);
    // Même bruit via un scanner qui POST une URL bidon.
    expect(
      isIgnorableServerError({
        source: "server",
        message: "Failed to find Server Action \"abc123\".",
        path: "/fr/index.php",
      }),
    ).toBe(true);
  });

  it("GARDE une vraie erreur serveur (bug applicatif)", () => {
    expect(
      isIgnorableServerError({
        source: "server",
        message: "Cannot read properties of undefined (reading 'rows')",
        path: "/fr/boutique",
      }),
    ).toBe(false);
  });

  it("ne s'applique qu'aux erreurs SERVEUR", () => {
    // Par prudence : ce filtre est réservé à la source serveur.
    expect(
      isIgnorableServerError({ source: "client", message: "Failed to find Server Action" }),
    ).toBe(false);
  });
});

describe("reportError — plafond global des rapports client", () => {
  const fetchMock = vi.fn(async () => new Response("ok"));
  let t = Date.parse("2026-09-28T10:00:00Z");

  beforeEach(() => {
    // Chaque test avance de 2 minutes : les fenêtres (dédup, plafond) repartent à zéro.
    t += 120_000;
    vi.useFakeTimers({ now: t });
    vi.stubEnv("DISCORD_ERROR_WEBHOOK_URL", "https://discord.example/webhook");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("n'use pas le quota avec une même erreur répétée (dédupliquée avant le plafond)", async () => {
    for (let i = 0; i < 50; i++) await reportError({ source: "client", message: "même erreur" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Le quota est intact : une autre erreur passe encore.
    await reportError({ source: "client", message: "autre erreur" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("relaie au plus CLIENT_REPORTS_PER_MINUTE erreurs client distinctes par minute", async () => {
    for (let i = 0; i < CLIENT_REPORTS_PER_MINUTE + 15; i++) {
      await reportError({ source: "client", message: `erreur ${i}` });
    }
    expect(fetchMock).toHaveBeenCalledTimes(CLIENT_REPORTS_PER_MINUTE);
    vi.setSystemTime(t + 61_000);
    await reportError({ source: "client", message: "après la fenêtre" });
    expect(fetchMock).toHaveBeenCalledTimes(CLIENT_REPORTS_PER_MINUTE + 1);
  });

  it("un flood client ne masque JAMAIS une erreur serveur", async () => {
    for (let i = 0; i < CLIENT_REPORTS_PER_MINUTE + 5; i++) {
      await reportError({ source: "client", message: `flood ${i}` });
    }
    fetchMock.mockClear();
    await reportError({ source: "server", message: "vraie panne serveur" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
