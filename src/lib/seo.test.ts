import { describe, it, expect } from "vitest";

import { breadcrumbJsonLd, pageDescription, MAX_DESCRIPTION, MIN_DESCRIPTION } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { squash } from "@/lib/text";

const LONG =
  "XBZ Esport ouvre une nouvelle équipe académie pour accompagner les joueurs prometteurs vers le haut niveau, avec un coach dédié, des entraînements réguliers et des scrims chaque semaine.";

describe("pageDescription", () => {
  it("prend le premier texte assez riche, en sautant les trop courts", () => {
    expect(pageDescription(["el discordos", null, "Une phrase qui décrit vraiment la fiche de ce joueur et son rôle dans le club."], "repli"))
      .toBe("Une phrase qui décrit vraiment la fiche de ce joueur et son rôle dans le club.");
  });

  it("retombe sur la phrase-type quand aucun texte ne suffit", () => {
    expect(pageDescription(["Competitive team.", undefined, ""], "Découvre l'effectif de l'équipe.")).toBe(
      "Découvre l'effectif de l'équipe.",
    );
  });

  it("aplatit les retours à la ligne et espaces multiples", () => {
    const bio = "Joueur  depuis 2019.\n\nPassionné de Rocket League,\tcapitaine de l'équipe et ancien coach.";
    expect(pageDescription([bio], "repli")).toBe(squash(bio));
    expect(pageDescription([bio], "repli")).not.toMatch(/\s{2}|\n|\t/);
  });

  it("coupe proprement au-delà de la limite, sur un mot, avec une ellipse", () => {
    const d = pageDescription([LONG], "repli");
    expect(d.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(d.endsWith("…")).toBe(true);
    expect(LONG.startsWith(d.slice(0, -1))).toBe(true);
    // Pas de mot coupé en deux : le caractère suivant dans l'original est une espace ou une ponctuation.
    expect(LONG.charAt(d.length - 1)).toMatch(/[\s,;:.]/);
  });

  it("coupe aussi une phrase-type trop longue", () => {
    expect(pageDescription([], LONG).length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it("les seuils restent cohérents", () => {
    expect(MIN_DESCRIPTION).toBeLessThan(MAX_DESCRIPTION);
  });
});

describe("breadcrumbJsonLd", () => {
  it("numérote les étapes et pose des URL absolues dans la langue de la page", () => {
    const ld = breadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        { name: "Teams", path: "/equipes" },
        { name: "Academy", path: "/equipes/academy" },
      ],
      "en",
    );
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteConfig.url}/en` },
      { "@type": "ListItem", position: 2, name: "Teams", item: `${siteConfig.url}/en/equipes` },
      { "@type": "ListItem", position: 3, name: "Academy", item: `${siteConfig.url}/en/equipes/academy` },
    ]);
  });
});
