import { describe, expect, it } from "vitest";

import { PRINT_NAME_MAX, normalizePrintName, normalizePrintNumber, parsePrint, printKey, printText } from "@/lib/personalization";

describe("normalizePrintName", () => {
  it("met en majuscules et nettoie les espaces", () => {
    expect(normalizePrintName("  martin ")).toBe("MARTIN");
    expect(normalizePrintName("jean   luc")).toBe("JEAN LUC");
    expect(normalizePrintName("o’neil")).toBe("O'NEIL");
    expect(normalizePrintName("Saint-Pierre")).toBe("SAINT-PIERRE");
  });

  it("garde les accents, en forme composée", () => {
    expect(normalizePrintName("rené")).toBe("RENÉ");
    expect(normalizePrintName("émilie")).toBe("ÉMILIE");
  });

  it("refuse le vide, les chiffres, les symboles et les autres alphabets", () => {
    for (const bad of ["", "   ", "M4RTIN", "MARTIN!", "<b>", "=SOMME(A1)", "名前", "ИВАН", "-MARTIN", " . ", "😀"]) {
      expect(normalizePrintName(bad), bad).toBeNull();
    }
    expect(normalizePrintName(12)).toBeNull();
    expect(normalizePrintName(null)).toBeNull();
  });

  it(`refuse plus de ${PRINT_NAME_MAX} caractères`, () => {
    expect(normalizePrintName("a".repeat(PRINT_NAME_MAX))).toBe("A".repeat(PRINT_NAME_MAX));
    expect(normalizePrintName("a".repeat(PRINT_NAME_MAX + 1))).toBeNull();
    // « ß » devient « SS » en majuscules : la borne se vérifie APRÈS.
    expect(normalizePrintName("ß".repeat(7))).toBeNull();
  });
});

describe("normalizePrintNumber", () => {
  it("accepte 0 à 99 et retire le zéro de tête", () => {
    expect(normalizePrintNumber("0")).toBe("0");
    expect(normalizePrintNumber("7")).toBe("7");
    expect(normalizePrintNumber("07")).toBe("7");
    expect(normalizePrintNumber(" 99 ")).toBe("99");
    expect(normalizePrintNumber(10)).toBe("10");
  });

  it("refuse le reste", () => {
    for (const bad of ["", "100", "-1", "1.5", "1e1", "dix", "٣", "1 0"]) expect(normalizePrintNumber(bad), bad).toBeNull();
    expect(normalizePrintNumber(1.5)).toBeNull();
    expect(normalizePrintNumber(undefined)).toBeNull();
  });
});

describe("parsePrint", () => {
  it("rien demandé : undefined", () => {
    expect(parsePrint(undefined)).toBeUndefined();
    expect(parsePrint(null)).toBeUndefined();
    expect(parsePrint({})).toBeUndefined();
    expect(parsePrint({ name: "", number: "  " })).toBeUndefined();
  });

  it("nom seul, numéro seul, ou les deux", () => {
    expect(parsePrint({ name: "martin" })).toEqual({ name: "MARTIN" });
    expect(parsePrint({ number: "07" })).toEqual({ number: "7" });
    expect(parsePrint({ name: "martin", number: "10" })).toEqual({ name: "MARTIN", number: "10" });
  });

  it("demandée mais invalide : null (refus, jamais de correction silencieuse)", () => {
    expect(parsePrint({ name: "M4" })).toBeNull();
    expect(parsePrint({ name: "MARTIN", number: "100" })).toBeNull();
    expect(parsePrint("MARTIN")).toBeNull();
    expect(parsePrint([])).toBeNull();
    expect(parsePrint(42)).toBeNull();
  });
});

describe("printKey / printText", () => {
  it("deux textes différents ne se confondent pas", () => {
    expect(printKey(undefined)).toBe("");
    expect(printKey({ name: "A", number: "1" })).not.toBe(printKey({ name: "A" }));
    expect(printKey({ name: "A|1" })).not.toBe(printKey({ name: "A", number: "1" }));
  });

  it("se lit « NOM · n° 10 »", () => {
    expect(printText({ name: "MARTIN", number: "10" }, "n°")).toBe("MARTIN · n° 10");
    expect(printText({ name: "MARTIN" }, "n°")).toBe("MARTIN");
    expect(printText({ number: "0" }, "No.")).toBe("No. 0");
  });
});
