// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import { CLIENT_NAMESPACES, LAYOUT_CLIENTS, pickMessages, type ClientComponent } from "@/i18n/client-messages";

/**
 * Le navigateur ne reçoit plus que les messages des composants client : la
 * liste de src/i18n/client-messages.ts doit donc suivre le code. Un namespace
 * oublié ne casse ni le build ni les types — la page affiche la clé brute
 * (« recrutementForm.submit ») au lieu du texte. Ce test le voit avant.
 */

const SRC = join(process.cwd(), "src");
const LAYOUT = join(SRC, "app", "[locale]", "layout.tsx");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const files = walk(SRC)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
  .map((f) => ({ file: f, label: relative(SRC, f).split(sep).join("/"), code: strip(readFileSync(f, "utf8")) }));
const isClient = (code: string) => /^\s*["']use client["']/.test(code);

/** Clé du registre d'un fichier client (nom du composant). */
const keyOf = (label: string): string =>
  label === "app/[locale]/error.tsx" ? "ErrorPage" : basename(label).replace(/\.(ts|tsx)$/, "");

const clients = files.filter((f) => isClient(f.code));
const registry = CLIENT_NAMESPACES as Record<string, readonly string[]>;
const layoutSet = new Set<string>(LAYOUT_CLIENTS);

describe("messages client — le registre suit le code", () => {
  it("le recensement voit bien les composants client", () => {
    expect(clients.length).toBeGreaterThan(5);
  });

  it.each(clients.map((c) => [c.label, c]))("%s : chaque namespace lu est déclaré", (_, c) => {
    const calls = [...c.code.matchAll(/useTranslations\(\s*([^)]*?)\s*\)/g)].map((m) => m[1]);
    if (calls.length === 0) return;
    // Sans namespace, le composant lirait tout le catalogue : impossible à trier.
    expect(calls.filter((a) => !/^["'][\w.]+["']$/.test(a)), "useTranslations() sans namespace littéral").toEqual([]);
    const used = [...new Set(calls.map((a) => a.slice(1, -1).split(".")[0]))];
    const key = keyOf(c.label);
    expect(registry[key], `${key} absent de CLIENT_NAMESPACES`).toBeDefined();
    expect(used.filter((ns) => !registry[key].includes(ns))).toEqual([]);
  });

  it("chaque namespace déclaré existe dans les deux langues", () => {
    for (const ns of new Set(Object.values(registry).flat())) {
      expect(ns in fr, `fr.${ns}`).toBe(true);
      expect(ns in en, `en.${ns}`).toBe(true);
    }
  });
});

describe("messages client — chaque composant reçoit les siens", () => {
  it("le layout ne fournit que les messages de la coquille", () => {
    const layout = strip(readFileSync(LAYOUT, "utf8"));
    expect(layout).toMatch(/pickMessages\(\s*await getMessages\(\{ locale \}\),\s*LAYOUT_CLIENTS\s*\)/);
    expect(layout).toMatch(/<NextIntlClientProvider locale=\{locale\} messages=\{messages\}>/);
  });

  const renders = (Object.keys(registry) as ClientComponent[]).flatMap((name) =>
    files
      .filter((f) => keyOf(f.label) !== name && new RegExp(`<${name}\\b`).test(f.code))
      .map((f) => [name, f.label, f] as const),
  );

  it("le recensement voit bien qui rend quoi", () => {
    expect(renders.length).toBeGreaterThanOrEqual(6);
  });

  it.each(renders.map(([name, label, f]) => [name, label, f]))("<%s> rendu par %s : messages fournis", (name, label, f) => {
    const renderer = keyOf(label);
    if (f.file === LAYOUT || layoutSet.has(renderer)) {
      // Rendu dans la coquille : fourni par le layout.
      expect(layoutSet.has(name), `${name} doit figurer dans LAYOUT_CLIENTS`).toBe(true);
      return;
    }
    if (isClient(f.code)) {
      // Rendu par un autre composant client : partout où celui-ci est fourni.
      const providers = files.filter((p) => new RegExp(`clients=\\{\\[[^\\]]*"${renderer}"`).test(p.code));
      expect(providers.length, `${renderer} n'est fourni nulle part`).toBeGreaterThan(0);
      for (const p of providers) expect(p.code, p.label).toMatch(new RegExp(`clients=\\{\\[[^\\]]*"${name}"`));
      return;
    }
    // Rendu par une page (composant serveur) : <ClientMessages clients={["…"]}>.
    expect(f.code).toMatch(new RegExp(`<ClientMessages\\b[^>]*clients=\\{\\[[^\\]]*"${name}"`));
  });
});

describe("pickMessages", () => {
  it("ne garde que les namespaces des composants demandés", () => {
    const picked = pickMessages(fr, ["Header", "LanguageSwitcher"]);
    expect(Object.keys(picked).sort()).toEqual(["language", "nav"]);
    expect(picked.nav).toEqual(fr.nav);
  });

  it("reste petit : la coquille pèse une fraction du catalogue", () => {
    const full = JSON.stringify(fr).length;
    const shell = JSON.stringify(pickMessages(fr, LAYOUT_CLIENTS)).length;
    expect(shell).toBeLessThan(full / 10);
    for (const client of Object.keys(registry) as ClientComponent[]) {
      expect(JSON.stringify(pickMessages(fr, [client])).length, client).toBeLessThan(full / 5);
    }
  });
});
