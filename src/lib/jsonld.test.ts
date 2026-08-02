import { describe, expect, it } from "vitest";

import { jsonLdString } from "@/lib/jsonld";

describe("jsonLdString", () => {
  it("produit un JSON valide et équivalent après parse", () => {
    const data = { "@type": "Organization", name: "XBZ", n: 42, ok: true };
    expect(JSON.parse(jsonLdString(data))).toEqual(data);
  });

  it("neutralise une tentative de fermeture </script> dans une valeur", () => {
    const data = { headline: "Titre </script><script>alert(1)</script>" };
    const out = jsonLdString(data);

    // Plus aucune balise <script> littérale ne subsiste dans la sortie.
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).not.toMatch(/<\/?script/i);

    // …mais la donnée reste intacte une fois le JSON parsé.
    expect(JSON.parse(out).headline).toBe(
      "Titre </script><script>alert(1)</script>",
    );
  });

  it("échappe <, > et & en séquences unicode", () => {
    expect(jsonLdString({ x: "<>&" })).toContain("\\u003c\\u003e\\u0026");
  });
});
