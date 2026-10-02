// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { redirect } from "next/navigation";

import { adminAction, dbError } from "@/lib/admin-action";
import { ADMIN_GENERIC_ERROR, AdminError, adminFailure } from "@/lib/admin-result";

describe("adminAction", () => {
  it("succès : rien à afficher", async () => {
    expect(await adminAction(async () => {})).toBeUndefined();
  });

  it("AdminError : son message est renvoyé tel quel", async () => {
    expect(await adminAction(async () => {
      throw new AdminError("Taille « M » en double.");
    })).toEqual({ error: "Taille « M » en double." });
  });

  it("erreur imprévue : journalisée côté serveur, message générique pour le staff", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await adminAction(async () => {
      throw new Error("connection refused 10.0.0.3:5432");
    });
    expect(result).toEqual({ error: ADMIN_GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toContain("10.0.0.3");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("redirect() (session expirée) n'est pas avalée : Next doit rediriger", async () => {
    await expect(adminAction(async () => redirect("/fr/login"))).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});

describe("dbError", () => {
  const msg = (e: Error) => (e instanceof AdminError ? e.message : null);

  it("doublon : message précis si fourni, sinon générique", () => {
    expect(msg(dbError({ code: "23505", message: "duplicate key" }, "Un produit avec ce slug existe déjà."))).toBe(
      "Un produit avec ce slug existe déjà.",
    );
    expect(msg(dbError({ code: "23505", message: "duplicate key" }))).toMatch(/existe déjà/);
  });

  it("clé étrangère : suppression bloquée ≠ élément lié disparu", () => {
    expect(msg(dbError({ code: "23503", message: 'update or delete on table "rosters" violates foreign key' }))).toMatch(
      /Suppression impossible/,
    );
    expect(msg(dbError({ code: "23503", message: 'insert or update on table "joueurs" violates foreign key' }))).toMatch(
      /n’existe plus/,
    );
  });

  it("valeur refusée, champ vide, texte trop long, format : expliqués", () => {
    for (const code of ["23514", "23502", "22001", "22P02"]) {
      expect(msg(dbError({ code, message: "x" }))).toBeTruthy();
    }
  });

  it("colonne inconnue (migration pas encore passée) : dit quoi faire", () => {
    expect(msg(dbError({ code: "42703", message: "column products.images does not exist" }))).toMatch(/migration/);
    expect(msg(dbError({ code: "PGRST204", message: "Could not find the 'images' column" }))).toMatch(/migration/);
  });

  it("code inconnu : erreur interne (message générique à l'affichage)", () => {
    const e = dbError({ code: "XX000", message: "internal_error" });
    expect(e).not.toBeInstanceOf(AdminError);
    expect(e.message).toContain("XX000");
  });
});

describe("adminFailure", () => {
  it("lit le message d'échec, ignore le reste", () => {
    expect(adminFailure({ error: "Oups" })).toBe("Oups");
    expect(adminFailure(undefined)).toBeNull();
    expect(adminFailure({ error: "" })).toBeNull();
    expect(adminFailure({ error: 42 })).toBeNull();
    expect(adminFailure("Oups")).toBeNull();
  });
});
