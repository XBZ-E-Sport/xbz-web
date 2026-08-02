import { describe, it, expect } from "vitest";

import { FIELD_MAX, FIELD_LABEL, findTooLong, tooLongMessage } from "@/lib/limits";

describe("limits", () => {
  it("accepte une valeur pile à la limite", () => {
    expect(findTooLong({ nom: "a".repeat(FIELD_MAX.nom) })).toBeNull();
  });

  it("détecte le dépassement d'un caractère", () => {
    expect(findTooLong({ nom: "a".repeat(FIELD_MAX.nom + 1) })).toBe("nom");
  });

  it("ignore les champs absents ou non textuels", () => {
    expect(findTooLong({ nom: undefined, exp: null, motiv: 42 })).toBeNull();
  });

  it("renvoie le premier champ fautif parmi plusieurs", () => {
    const field = findTooLong({
      nom: "ok",
      message: "m".repeat(FIELD_MAX.message + 1),
      motiv: "x".repeat(FIELD_MAX.motiv + 1),
    });
    expect(["message", "motiv"]).toContain(field);
  });

  it("produit un message d'erreur lisible", () => {
    expect(tooLongMessage("motiv")).toBe(
      `Le champ « Motivation » est trop long (${FIELD_MAX.motiv} caractères maximum).`,
    );
  });

  it("libelle chaque champ borné (aucun oubli)", () => {
    for (const key of Object.keys(FIELD_MAX)) {
      expect(FIELD_LABEL[key as keyof typeof FIELD_MAX]).toBeTruthy();
    }
  });
});
