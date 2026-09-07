// @vitest-environment node
import { describe, it, expect } from "vitest";

import { jobPostingJsonLd, type Offer } from "@/lib/offres";

// Le JSON-LD JobPosting est le contrat qu'Indeed et Google for Jobs lisent.
// Un champ requis manquant = offre ignorée, en silence. Ces tests figent les
// champs obligatoires et les deux formes de localisation.

const base: Offer = {
  slug: "developpeur-web",
  title: "Développeur web (H/F)",
  excerpt: "Rejoins XBZ.",
  description: ["Missions variées.", "Profil autonome."],
  department: "Développement",
  employmentType: "FULL_TIME",
  remote: false,
  city: "Lyon",
  region: "Auvergne-Rhône-Alpes",
  postalCode: "69000",
  country: "FR",
  salaryMin: null,
  salaryMax: null,
  salaryPeriod: "MONTH",
  datePosted: "2026-08-01",
  validThrough: "2026-10-01",
  applyUrl: null,
};

describe("jobPostingJsonLd", () => {
  it("expose tous les champs REQUIS par Indeed pour une offre localisée", () => {
    const ld = jobPostingJsonLd(base);

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.title).toBe("Développeur web (H/F)");
    expect(ld.datePosted).toBe("2026-08-01");
    expect(ld.validThrough).toBe("2026-10-01");
    expect(ld.employmentType).toBe("FULL_TIME");

    // description : HTML, un <p> par paragraphe.
    expect(ld.description).toBe("<p>Missions variées.</p><p>Profil autonome.</p>");

    // hiringOrganization nommée (requis).
    expect((ld.hiringOrganization as Record<string, unknown>).name).toBeTruthy();

    // Localisation physique → adresse avec ville et pays.
    const address = (ld.jobLocation as Record<string, Record<string, unknown>>).address;
    expect(address.addressLocality).toBe("Lyon");
    expect(address.addressCountry).toBe("FR");
    expect(address.postalCode).toBe("69000");

    // Pas de salaire renseigné → pas de baseSalary.
    expect(ld.baseSalary).toBeUndefined();
  });

  it("marque une offre en télétravail en TELECOMMUTE + pays d'éligibilité", () => {
    const ld = jobPostingJsonLd({ ...base, remote: true, city: null, region: null, postalCode: null });

    expect(ld.jobLocationType).toBe("TELECOMMUTE");
    // Google exige applicantLocationRequirements pour une offre à distance.
    expect((ld.applicantLocationRequirements as Record<string, unknown>).name).toBe("FR");
    // Pas de ville → pas de jobLocation physique.
    expect(ld.jobLocation).toBeUndefined();
  });

  it("ajoute baseSalary quand une borne est renseignée", () => {
    const ld = jobPostingJsonLd({ ...base, salaryMin: 2000, salaryMax: 2500, salaryPeriod: "MONTH" });
    const salary = ld.baseSalary as Record<string, Record<string, unknown>>;
    expect(salary.currency).toBe("EUR");
    expect(salary.value.minValue).toBe(2000);
    expect(salary.value.maxValue).toBe(2500);
    expect(salary.value.unitText).toBe("MONTH");
  });

  it("échappe le HTML du texte utilisateur dans la description", () => {
    // Un paragraphe contenant des chevrons ne doit pas injecter de balise.
    const ld = jobPostingJsonLd({ ...base, description: ["<script>alert(1)</script>"] });
    expect(ld.description).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });
});
