// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Chaque table lue ou écrite par le site doit avoir sa RLS activée dans une
 * migration versionnée (supabase/*.sql). Sinon, une base recréée à partir du
 * repo (projet de test, nouveau projet) laisserait la table ouverte à la clé
 * publique — c'était le cas des candidatures, des messages de support et de
 * la liste du staff, protégés en prod uniquement par un réglage manuel.
 */

const ROOT = process.cwd();

function codeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return codeFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const tables = new Set(
  codeFiles(join(ROOT, "src")).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/(?<!storage)\.from\("([a-z_]+)"\)/g)].map((m) => m[1]),
  ),
);

const migrations = readdirSync(join(ROOT, "supabase"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(ROOT, "supabase", f), "utf8"))
  .join("\n");

describe("RLS versionnée", () => {
  it("le code utilise bien des tables Supabase (sinon ce test ne protège rien)", () => {
    expect(tables.size).toBeGreaterThanOrEqual(10);
    for (const t of ["candidatures", "support_messages", "allow_staff_list"]) expect(tables).toContain(t);
  });

  it.each([...tables].sort())("%s : RLS activée dans une migration", (table) => {
    const re = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
    expect(migrations).toMatch(re);
  });

  it("aucune policy n'ouvre les tables de données personnelles ou d'accès staff", () => {
    for (const table of [
      "candidatures",
      "support_messages",
      "allow_staff_list",
      "rate_limit_hits",
      "orders",
      "order_withdrawals",
    ]) {
      const re = new RegExp(`create\\s+policy[^;]*\\bon\\s+(?:public\\.)?${table}\\b`, "i");
      expect(migrations, table).not.toMatch(re);
    }
  });
});
