// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde-fou d'architecture.
 *
 * Dans le App Router, le **layout et la page sont rendus en parallèle**. Une
 * vérification d'accès placée uniquement dans `admin/layout.tsx` ne suffit donc
 * pas : la page interroge la base et son rendu part dans la réponse, même quand
 * la redirection est émise. C'est exactement ce qui a exposé les candidatures
 * (nom, âge, Discord, email, motivation) à `curl https://…/admin` sans session.
 *
 * Ce test échoue si une page du back-office oublie `requireStaff()` ou
 * réintroduit un accès direct à la clé service_role.
 */
const ADMIN_DIR = "src/app/[locale]/admin";

function adminActionFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) adminActionFiles(full, out);
    else if (entry === "actions.ts") out.push(full);
  }
  return out;
}

function adminPages(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) adminPages(full, out);
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

describe("contrôle d'accès du back-office", () => {
  const pages = adminPages(ADMIN_DIR);

  it("trouve bien les pages du back-office", () => {
    expect(pages.length).toBeGreaterThanOrEqual(5);
  });

  it("chaque page appelle requireStaff() — pas seulement le layout", () => {
    const sansGarde = pages.filter((f) => !readFileSync(f, "utf8").includes("requireStaff("));
    expect(sansGarde).toEqual([]);
  });

  it("aucune page n'utilise la clé service_role sans passer par la garde", () => {
    // requireStaff() renvoie le client admin : plus aucune raison d'appeler
    // createAdminClient() directement depuis une page.
    const brut = pages.filter((f) => readFileSync(f, "utf8").includes("createAdminClient("));
    expect(brut).toEqual([]);
  });

  it("le layout garde aussi la coquille (navigation, email du staff)", () => {
    expect(readFileSync(join(ADMIN_DIR, "layout.tsx"), "utf8")).toContain("requireStaff(");
  });

  it("chaque server action du back-office passe par la garde", () => {
    // Une server action est un endpoint POST joignable directement : la garde
    // du layout ne la protège pas. Chaque fonction exportée doit appeler
    // requireStaff() ou assertStaff() elle-même.
    const actionFiles = adminActionFiles(ADMIN_DIR);
    const nonGardees: string[] = [];

    for (const file of actionFiles) {
      const src = readFileSync(file, "utf8");
      // Corps de chaque `export async function nom(...) { … }` jusqu'à la
      // prochaine déclaration exportée (suffisant : ces fichiers sont plats).
      const blocs = src.split(/\nexport async function /).slice(1);
      for (const bloc of blocs) {
        const nom = bloc.slice(0, bloc.indexOf("("));
        if (!/requireStaff\(|assertStaff\(/.test(bloc)) nonGardees.push(`${file} → ${nom}`);
      }
    }

    expect(nonGardees).toEqual([]);
  });
});
