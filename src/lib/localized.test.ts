// @vitest-environment node
import { describe, it, expect } from "vitest";

import { localizedText, localizedList, countryName } from "@/lib/localized";

describe("localizedText", () => {
  it("rend l'anglais quand il est saisi", () => {
    expect(localizedText("Bonjour", "Hello", "en")).toBe("Hello");
  });

  it("retombe sur le français quand l'anglais est absent", () => {
    // Cas majoritaire au démarrage : la colonne _en est vide partout.
    expect(localizedText("Bonjour", null, "en")).toBe("Bonjour");
    expect(localizedText("Bonjour", undefined, "en")).toBe("Bonjour");
  });

  it("traite une chaîne d'espaces comme absente", () => {
    // Un champ « vidé » dans le back-office arrive en base comme "" ou "   ".
    expect(localizedText("Bonjour", "   ", "en")).toBe("Bonjour");
    expect(localizedText("Bonjour", "", "en")).toBe("Bonjour");
  });

  it("ignore l'anglais quand la page est en français", () => {
    expect(localizedText("Bonjour", "Hello", "fr")).toBe("Bonjour");
  });

  it("renvoie null quand les deux variantes sont vides", () => {
    // L'appelant masque alors le bloc au lieu d'afficher du vide.
    expect(localizedText(null, null, "en")).toBeNull();
    expect(localizedText("", "  ", "fr")).toBeNull();
  });

  it("rend l'anglais même si le français manque", () => {
    expect(localizedText(null, "Hello", "en")).toBe("Hello");
  });
});

describe("localizedList", () => {
  it("rend la liste anglaise quand elle existe", () => {
    expect(localizedList(["a", "b"], ["x"], "en")).toEqual(["x"]);
  });

  it("bascule la liste ENTIÈRE, jamais ligne à ligne", () => {
    // Sinon un palmarès à moitié traduit mélangerait les deux langues.
    expect(localizedList(["un", "deux", "trois"], ["one"], "en")).toEqual(["one"]);
  });

  it("retombe sur le français si la liste anglaise est vide", () => {
    expect(localizedList(["un"], [], "en")).toEqual(["un"]);
    expect(localizedList(["un"], null, "en")).toEqual(["un"]);
  });

  it("écarte les entrées vides", () => {
    expect(localizedList(["un", "", "  ", "deux"], null, "fr")).toEqual(["un", "deux"]);
  });

  it("renvoie un tableau vide plutôt que null", () => {
    expect(localizedList(null, null, "en")).toEqual([]);
  });
});

describe("countryName", () => {
  it("dérive le nom du code ISO, dans la langue demandée", () => {
    // Zéro saisie : `pays_code` est déjà en base pour le drapeau.
    expect(countryName("DE", null, "fr")).toBe("Allemagne");
    expect(countryName("DE", null, "en")).toBe("Germany");
  });

  it("accepte un code en minuscules", () => {
    expect(countryName("gb", null, "en")).toBe("United Kingdom");
  });

  it("préfère le code au champ libre, même si les deux sont là", () => {
    // Le champ libre est saisi à la main : le code ISO fait autorité.
    expect(countryName("ES", "Espagne", "en")).toBe("Spain");
  });

  it("retombe sur le champ libre quand le code manque ou est invalide", () => {
    expect(countryName(null, "Kosovo", "en")).toBe("Kosovo");
    expect(countryName("XYZ", "Kosovo", "en")).toBe("Kosovo"); // pas 2 lettres
    expect(countryName("QQ", "Kosovo", "en")).toBe("Kosovo"); // code non attribué
    // `ZZ` est un code CLDR valide qui vaut « région inconnue » : Intl lui donne
    // un nom, qu'on refuse d'afficher.
    expect(countryName("ZZ", "Kosovo", "en")).toBe("Kosovo");
  });

  it("renvoie null quand il n'y a ni code ni champ libre", () => {
    expect(countryName(null, null, "fr")).toBeNull();
    expect(countryName("", "  ", "fr")).toBeNull();
  });
});
