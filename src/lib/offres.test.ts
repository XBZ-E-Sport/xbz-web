// @vitest-environment node
import { describe, it, expect } from "vitest";

import { formatOfferLocation, isOfferOpen, jobPostingJsonLd, todayInParis, type Offer } from "@/lib/offres";
import { withOfferRoles } from "@/lib/equipes";

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
    const ld = jobPostingJsonLd(base, "fr");

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
    const ld = jobPostingJsonLd({ ...base, remote: true, city: null, region: null, postalCode: null }, "fr");

    expect(ld.jobLocationType).toBe("TELECOMMUTE");
    // Google exige applicantLocationRequirements pour une offre à distance.
    expect((ld.applicantLocationRequirements as Record<string, unknown>).name).toBe("FR");
    // Indeed exige un lieu par offre, même en télétravail : au moins le pays.
    const address = (ld.jobLocation as Record<string, Record<string, unknown>>).address;
    expect(address.addressCountry).toBe("FR");
    expect(address.addressLocality).toBeUndefined();
    expect(address.postalCode).toBeUndefined();
  });

  it("donne l'URL RÉELLE de la page, langue comprise (sans redirection)", () => {
    expect(String(jobPostingJsonLd(base, "fr").url)).toMatch(/\/fr\/carrieres\/developpeur-web$/);
    expect(String(jobPostingJsonLd(base, "en").url)).toMatch(/\/en\/carrieres\/developpeur-web$/);
  });

  it("ajoute baseSalary quand une borne est renseignée", () => {
    const ld = jobPostingJsonLd({ ...base, salaryMin: 2000, salaryMax: 2500, salaryPeriod: "MONTH" }, "fr");
    const salary = ld.baseSalary as Record<string, Record<string, unknown>>;
    expect(salary.currency).toBe("EUR");
    expect(salary.value.minValue).toBe(2000);
    expect(salary.value.maxValue).toBe(2500);
    expect(salary.value.unitText).toBe("MONTH");
  });

  it("échappe le HTML du texte utilisateur dans la description", () => {
    // Un paragraphe contenant des chevrons ne doit pas injecter de balise.
    const ld = jobPostingJsonLd({ ...base, description: ["<script>alert(1)</script>"] }, "fr");
    expect(ld.description).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });
});

describe("formatOfferLocation", () => {
  it("donne toujours un lieu, pays compris", () => {
    const remote = { ...base, remote: true, city: null, region: null, postalCode: null };
    expect(formatOfferLocation(remote, "fr", "Télétravail")).toBe("Télétravail (France)");
    expect(formatOfferLocation({ ...remote, region: "Bretagne" }, "fr", "Télétravail")).toBe("Télétravail (Bretagne, France)");
    expect(formatOfferLocation(remote, "en", "Remote")).toBe("Remote (France)");
    expect(formatOfferLocation(base, "fr", "Télétravail")).toBe("Lyon, Auvergne-Rhône-Alpes, France");
  });
});

describe("offres ouvertes", () => {
  it("une offre reste ouverte jusqu'à sa date de fin incluse, ou sans date de fin", () => {
    expect(isOfferOpen("2026-11-06", "2026-11-06")).toBe(true);
    expect(isOfferOpen("2026-11-06", "2026-11-07")).toBe(false);
    expect(isOfferOpen(null, "2030-01-01")).toBe(true);
  });

  it("la date du jour est celle de Paris (pas UTC)", () => {
    // 23 h 30 UTC le 6 novembre = 0 h 30 le 7 à Paris.
    expect(todayInParis(new Date("2026-11-06T23:30:00Z"))).toBe("2026-11-07");
  });

  it("les offres deviennent des rôles staff du formulaire de recrutement, sans doublon", () => {
    const roles = withOfferRoles(
      { "XBZ Staff": [{ name: "Modérateur", free: 2 }], "XBZ Esport": [{ name: "Joueur", free: 1 }] },
      [{ name: "Développeur web (H/F)" }, { name: "Modérateur" }],
    );
    expect(roles["XBZ Staff"]).toEqual([
      { name: "Modérateur", free: 2 },
      { name: "Développeur web (H/F)", free: 1 },
    ]);
    expect(roles["XBZ Esport"]).toEqual([{ name: "Joueur", free: 1 }]);
  });
});
