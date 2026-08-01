// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Garde-fou anti-oubli : toute variable d'environnement utilisée dans le code
// doit être documentée dans .env.example — sinon un déploiement part avec une
// variable manquante que personne n'a vue passer.

// Fournies par la plateforme (Node, Vercel, GitHub Actions) : rien à documenter.
const PROVIDED_BY_PLATFORM = new Set(["NODE_ENV", "CI", "VERCEL", "VERCEL_ENV", "VERCEL_URL"]);

const SCANNED_DIRS = ["src", "e2e"];
const SCANNED_FILES = ["next.config.ts", "playwright.config.ts", "vitest.config.mts"];

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, out);
    else if (/\.(ts|tsx|mts)$/.test(entry)) out.push(full);
  }
  return out;
}

function usedVariables(): Map<string, string> {
  const found = new Map<string, string>(); // variable → premier fichier vu
  const files = [
    ...SCANNED_DIRS.flatMap((d) => collectFiles(d)),
    ...SCANNED_FILES.filter((f) => {
      try {
        return statSync(f).isFile();
      } catch {
        return false;
      }
    }),
  ];

  for (const file of files) {
    // Les tests ont le droit de simuler des variables factices.
    if (/\.test\.(ts|tsx)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (!found.has(m[1])) found.set(m[1], file);
    }
  }
  return found;
}

function documentedVariables(): Set<string> {
  const content = readFileSync(".env.example", "utf8");
  return new Set(
    content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("=")[0].trim()),
  );
}

describe(".env.example", () => {
  it("documente toutes les variables utilisées par le code", () => {
    const documented = documentedVariables();
    const manquantes = [...usedVariables()]
      .filter(([name]) => !PROVIDED_BY_PLATFORM.has(name) && !documented.has(name))
      .map(([name, file]) => `${name} (utilisée dans ${file})`);

    expect(manquantes).toEqual([]);
  });

  it("ne documente aucune variable morte", () => {
    const used = usedVariables();
    const inutiles = [...documentedVariables()].filter((name) => !used.has(name));

    expect(inutiles).toEqual([]);
  });

  it("n'expose aucun secret via un préfixe NEXT_PUBLIC_", () => {
    // Une variable NEXT_PUBLIC_* est inlinée dans le bundle navigateur.
    const suspectes = [...documentedVariables()].filter(
      (name) => name.startsWith("NEXT_PUBLIC_") && /SECRET|PASSWORD|SERVICE_ROLE|TOKEN/.test(name),
    );

    expect(suspectes).toEqual([]);
  });
});
