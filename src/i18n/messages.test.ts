// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parse,
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import { routing } from "@/i18n/routing";
import { API_ERROR_CODES } from "@/lib/apierror";
import { FIELD_MAX } from "@/lib/limits";
import { articleCategories } from "@/lib/actualite";

type Tree = { [key: string]: string | Tree };

/** Chemins de toutes les feuilles, ex. "leClub.poles.esport.title". */
function leafPaths(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : leafPaths(value, path);
  });
}

function leafAt(tree: Tree, path: string): string {
  const value = path.split(".").reduce<string | Tree>((acc, k) => (acc as Tree)[k], tree);
  return value as string;
}

/**
 * Variables et balises attendues par un message, via le VRAI parseur ICU (celui
 * qu'utilise next-intl). Une regex maison confondrait les branches de pluriel
 * (`one {place}`) avec des variables.
 *
 * Effet de bord voulu : un message ICU mal formé fait échouer le parse, donc
 * le test — c'est exactement ce qu'on veut attraper avant la mise en ligne.
 */
function placeholders(message: string): { variables: Set<string>; tags: Set<string> } {
  const variables = new Set<string>();
  const tags = new Set<string>();

  const walk = (nodes: MessageFormatElement[]) => {
    for (const node of nodes) {
      if (isTagElement(node)) {
        tags.add(node.value);
        walk(node.children);
        continue;
      }
      if (isArgumentElement(node) || isNumberElement(node) || isDateElement(node)) {
        variables.add(node.value);
        continue;
      }
      if (isPluralElement(node) || isSelectElement(node)) {
        variables.add(node.value);
        for (const option of Object.values(node.options)) walk(option.value);
      }
    }
  };

  walk(parse(message));
  return { variables, tags };
}

const sorted = (set: Set<string>) => [...set].sort().join(",");

const frTree = fr as unknown as Tree;
const enTree = en as unknown as Tree;
const frPaths = leafPaths(frTree);
const enPaths = leafPaths(enTree);

describe("messages fr/en", () => {
  it("couvre exactement les langues déclarées dans le routage", () => {
    expect([...routing.locales].sort()).toEqual(["en", "fr"]);
  });

  it("expose exactement les mêmes clés dans les deux langues", () => {
    const missingInEn = frPaths.filter((p) => !enPaths.includes(p));
    const missingInFr = enPaths.filter((p) => !frPaths.includes(p));
    expect({ missingInEn, missingInFr }).toEqual({ missingInEn: [], missingInFr: [] });
  });

  it("n'a aucune traduction vide", () => {
    const empty = [
      ...frPaths.filter((p) => !leafAt(frTree, p).trim()).map((p) => `fr:${p}`),
      ...enPaths.filter((p) => !leafAt(enTree, p).trim()).map((p) => `en:${p}`),
    ];
    expect(empty).toEqual([]);
  });

  it("utilise les mêmes variables ICU des deux côtés", () => {
    // Une variable oubliée en anglais ne throw pas : elle disparaît silencieusement
    // de la phrase affichée. D'où ce test.
    const mismatched = frPaths.filter(
      (p) =>
        sorted(placeholders(leafAt(frTree, p)).variables) !==
        sorted(placeholders(leafAt(enTree, p)).variables),
    );
    expect(mismatched).toEqual([]);
  });

  it("utilise les mêmes balises de texte riche des deux côtés", () => {
    // Une balise présente dans le JSON mais pas fournie par le composant fait
    // throw next-intl au rendu — et inversement, la balise manquante perd le lien.
    const mismatched = frPaths.filter(
      (p) =>
        sorted(placeholders(leafAt(frTree, p)).tags) !==
        sorted(placeholders(leafAt(enTree, p)).tags),
    );
    expect(mismatched).toEqual([]);
  });
});

describe("messages ↔ code", () => {
  it("traduit chaque code d'erreur d'API", () => {
    for (const locale of [frTree, enTree]) {
      const codes = Object.keys(locale.formErrors as Tree);
      for (const code of API_ERROR_CODES) expect(codes).toContain(code);
      // `generic` sert de repli quand le serveur ne renvoie pas de code.
      expect(codes).toContain("generic");
    }
  });

  it("nomme chaque champ de formulaire borné", () => {
    for (const locale of [frTree, enTree]) {
      expect(Object.keys(locale.fieldLabels as Tree).sort()).toEqual(
        Object.keys(FIELD_MAX).sort(),
      );
    }
  });

  it("couvre exactement les catégories d'article de la base", () => {
    for (const locale of [frTree, enTree]) {
      expect(Object.keys(locale.articleCategories as Tree).sort()).toEqual(
        [...articleCategories].sort(),
      );
    }
  });
});
