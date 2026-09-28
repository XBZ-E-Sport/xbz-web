import { describe, it, expect } from "vitest";

import {
  FIELD_MAX,
  FIELD_LABEL,
  UPLOAD_MAX_BYTES,
  findTooLong,
  formatMegabytes,
  oversizedUpload,
  textField,
  tooLongMessage,
} from "@/lib/limits";

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

describe("textField", () => {
  it("nettoie une chaîne, rend \"\" pour un champ absent", () => {
    expect(textField("  Jean  ")).toBe("Jean");
    expect(textField(undefined)).toBe("");
    expect(textField(null)).toBe("");
  });

  it("refuse tout ce qui n'est pas une chaîne (sinon String() contourne les plafonds)", () => {
    const huge = ["A".repeat(200_000)];
    expect(String(huge).length).toBe(200_000); // le contournement d'origine
    expect(textField(huge)).toBeNull();
    expect(textField({ a: 1 })).toBeNull();
    expect(textField(42)).toBeNull();
    expect(textField(true)).toBeNull();
  });
});

describe("oversizedUpload", () => {
  const file = (bytes: number, name = "photo.jpg") => new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });

  it("laisse passer un formulaire sans fichier, un champ fichier vide ou une image pile à la limite", () => {
    const fd = new FormData();
    fd.set("name", "Jean");
    fd.set("photo_file", new File([], ""));
    fd.set("logo_file", file(UPLOAD_MAX_BYTES));
    expect(oversizedUpload(fd.values())).toBeNull();
  });

  it("annonce l'image trop lourde, avec son nom, sa taille et le maximum", () => {
    const fd = new FormData();
    fd.set("name", "Jean");
    fd.set("photo_file", file(6.3 * 1024 * 1024, "IMG_2034.HEIC"));
    const message = oversizedUpload(fd.values());
    expect(message).toContain("IMG_2034.HEIC");
    expect(message).toContain("6,3\u00a0Mo");
    expect(message).toContain("4\u00a0Mo maximum");
  });

  it("formatMegabytes", () => {
    expect(formatMegabytes(4 * 1024 * 1024)).toBe("4\u00a0Mo");
    expect(formatMegabytes(1.25 * 1024 * 1024)).toBe("1,3\u00a0Mo");
  });
});
