// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde-fou : chaque colonne `_en` créée en base doit être LUE par le site et
 * ÉCRITE par le back-office.
 *
 * L'oubli typique ne casse rien de visible : la colonne existe, le formulaire
 * ne l'envoie pas (ou la requête ne la sélectionne pas), et la page anglaise
 * affiche du français pour toujours — sans erreur nulle part. Ce test relie les
 * trois bouts : migration → lecture → écriture.
 */

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

const MIGRATION = read("supabase", "migration_i18n_contenu_03082026.sql");

/** Colonnes `_en` déclarées par la migration, groupées par table. */
function declaredColumns(): Map<string, string[]> {
  const byTable = new Map<string, string[]>();
  // `alter table public.X ... add column if not exists Y_en type`
  for (const block of MIGRATION.split(/alter\s+table\s+/i).slice(1)) {
    const table = block.match(/^public\.(\w+)/i)?.[1];
    if (!table) continue;
    const cols = [...block.matchAll(/add column if not exists\s+(\w+_en)\b/gi)].map((m) => m[1]);
    if (cols.length) byTable.set(table, cols);
  }
  return byTable;
}

const declared = declaredColumns();

/** Où chaque table est lue côté site public, et écrite côté back-office. */
const WIRING: Record<string, { reads: string[]; writes: string[] }> = {
  articles: {
    reads: ["src/lib/actualite.ts"],
    writes: ["src/app/[locale]/admin/articles/actions.ts"],
  },
  products: {
    reads: ["src/lib/boutique.ts"],
    writes: ["src/app/[locale]/admin/boutique/actions.ts"],
  },
  rosters: {
    reads: ["src/lib/roster.ts", "src/lib/equipes.ts"],
    writes: ["src/app/[locale]/admin/rosters/actions.ts"],
  },
  poles: {
    reads: ["src/lib/equipes.ts"],
    writes: ["src/app/[locale]/admin/rosters/actions.ts"],
  },
  joueurs: {
    // Lues via `select("*")` sur la relation, puis résolues par `localizePlayer`.
    reads: ["src/lib/roster.ts"],
    writes: ["src/app/[locale]/admin/rosters/actions.ts"],
  },
};

describe("colonnes de traduction", () => {
  it("la migration déclare les 5 tables attendues", () => {
    expect([...declared.keys()].sort()).toEqual(
      ["articles", "joueurs", "poles", "products", "rosters"].sort(),
    );
  });

  it("déclare exactement 11 colonnes", () => {
    expect([...declared.values()].flat()).toHaveLength(11);
  });

  it("chaque colonne est lue par la couche data", () => {
    const missing: string[] = [];
    for (const [table, cols] of declared) {
      const sources = WIRING[table].reads.map((f) => read(f)).join("\n");
      for (const col of cols) {
        if (!sources.includes(col)) missing.push(`${table}.${col}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("chaque colonne est écrite par le back-office", () => {
    const missing: string[] = [];
    for (const [table, cols] of declared) {
      const sources = WIRING[table].writes.map((f) => read(f)).join("\n");
      for (const col of cols) {
        if (!sources.includes(col)) missing.push(`${table}.${col}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("chaque colonne a son champ dans un formulaire du back-office", () => {
    // Sans champ de saisie, la colonne resterait vide à jamais.
    const forms = [
      "src/app/[locale]/admin/articles/ArticleForm.tsx",
      "src/app/[locale]/admin/boutique/ProductForm.tsx",
      "src/app/[locale]/admin/rosters/RosterForm.tsx",
      "src/app/[locale]/admin/rosters/PlayerForm.tsx",
      "src/app/[locale]/admin/poles/PoleForm.tsx",
    ]
      .map((f) => read(f))
      .join("\n");

    const missing = [...declared.values()]
      .flat()
      .filter((col) => !forms.includes(`name="${col}"`));
    expect(missing).toEqual([]);
  });
});
