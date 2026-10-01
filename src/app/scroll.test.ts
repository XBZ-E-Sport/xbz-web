// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { GLOBALS_CSS, cssRules, declarations } from "../../test/css";

/**
 * Défilement après navigation.
 *
 * globals.css met `scroll-behavior: smooth` sur <html>. Depuis Next 16, Next ne
 * le suspend pendant une navigation que si <html> porte
 * `data-scroll-behavior="smooth"`. Sans l'attribut, revenir sur l'accueil
 * (logo, menu) laissait la page défilée jusqu'aux chiffres : rien ne casse au
 * build, seul l'œil le voit.
 */

const css = readFileSync(GLOBALS_CSS, "utf8");
const layout = readFileSync(join(process.cwd(), "src", "app", "[locale]", "layout.tsx"), "utf8");

describe("défilement doux et navigation", () => {
  it("<html> déclare le défilement doux à Next dès que le CSS l'active", () => {
    const smooth = cssRules(css).some(
      (r) => r.at.length === 0 && r.prelude === "html" && declarations(r.body).some((d) => d.prop === "scroll-behavior" && d.value === "smooth"),
    );
    if (!smooth) return;
    expect(layout).toMatch(/<html\b[^>]*\sdata-scroll-behavior="smooth"/);
  });
});
