// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createTranslator } from "next-intl";

vi.mock("@/lib/stripe", () => ({ stripe: () => ({}) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import {
  LEGAL,
  MEDIATOR_PLACEHOLDER,
  formatLegalDate,
  legalMissing,
  legalReady,
  legalValues,
  mediatorText,
  phoneText,
} from "@/lib/legal";
import { SHIPPING_COUNTRIES } from "@/lib/shop";

const digits = (s: string) => s.replace(/\s/g, "");

/** Somme de contrôle de Luhn (SIREN et SIRET). */
function luhn(n: string): boolean {
  let sum = 0;
  [...digits(n)].reverse().forEach((c, i) => {
    let d = Number(c);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  });
  return sum % 10 === 0;
}

describe("identité de l'association", () => {
  it("SIREN, SIRET et TVA sont cohérents entre eux (une faute de frappe se verrait ici)", () => {
    expect(digits(LEGAL.siren)).toMatch(/^\d{9}$/);
    expect(luhn(LEGAL.siren)).toBe(true);
    expect(digits(LEGAL.siret)).toMatch(/^\d{14}$/);
    expect(luhn(LEGAL.siret)).toBe(true);
    // Le SIRET commence par le SIREN.
    expect(digits(LEGAL.siret).startsWith(digits(LEGAL.siren))).toBe(true);
    // N° de TVA français : « FR » + clé + SIREN, clé = (12 + 3 × (SIREN mod 97)) mod 97.
    const key = (12 + 3 * (Number(digits(LEGAL.siren)) % 97)) % 97;
    expect(digits(LEGAL.vat)).toBe(`FR${String(key).padStart(2, "0")}${digits(LEGAL.siren)}`);
  });

  it("numéro RNA au bon format, e-mail plausible, date valide", () => {
    expect(LEGAL.rna).toMatch(/^W\d{9}$/);
    expect(LEGAL.email).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i);
    expect(LEGAL.cgvEffective).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(LEGAL.cgvEffective))).toBe(false);
    expect(LEGAL.deliveryDays).toBeGreaterThan(0);
    expect(LEGAL.address).toMatch(/76140/);
    // Téléphone français affiché par paires de chiffres (« 06 12 34 56 78 »).
    expect(LEGAL.phone).toMatch(/^0[1-9]( \d{2}){4}$/);
    expect(LEGAL.returnAddress.length).toBeGreaterThan(10);
  });

  it("formate la date dans la langue, mois en lettres (jamais ambigu : 04/10 se lit 10 avril en anglais)", () => {
    expect(formatLegalDate("2026-10-04", "fr")).toBe("4 octobre 2026");
    expect(formatLegalDate("2026-10-04", "en")).toBe("4 October 2026");
    expect(formatLegalDate("2026-01-05", "fr")).toBe("5 janvier 2026");
  });

  it("l'adresse de retour est la même que le siège tant qu'on ne la sépare pas explicitement", () => {
    expect(LEGAL.returnAddress).toBe(LEGAL.address);
  });
});

describe("médiateur de la consommation et rétractation en ligne", () => {
  const saved = { ...LEGAL };
  const mediator = { name: "Médiateur X", address: "1 rue Y, 75000 Paris", website: "https://x.test" };
  const PHONE = "02 35 00 00 00";
  afterEach(() => {
    Object.assign(LEGAL, saved);
  });

  it("tant qu'aucun médiateur n'est renseigné : marqueur visible, vente live non prête", () => {
    Object.assign(LEGAL, { mediator: null, phone: PHONE, onlineWithdrawal: true });
    expect(legalReady()).toBe(false);
    expect(legalMissing()).toEqual([expect.stringMatching(/médiateur/)]);
    expect(mediatorText()).toBe(MEDIATOR_PLACEHOLDER);
    expect(legalValues("fr").mediator).toBe(MEDIATOR_PLACEHOLDER);
  });

  it("le marqueur du médiateur est dans la langue de la page (pas de français sur /en/cgv)", () => {
    LEGAL.mediator = null;
    expect(legalValues("en").mediator).toMatch(/MEDIATOR/);
    expect(legalValues("en").mediator).not.toMatch(/MÉDIATEUR|AVANT/);
  });

  it("une fois renseigné : ses coordonnées complètes remplacent le marqueur (e-mail et téléphone s'ils existent)", () => {
    LEGAL.mediator = mediator;
    expect(mediatorText()).toBe("Médiateur X, 1 rue Y, 75000 Paris, https://x.test");
    expect(mediatorText("en")).toBe("Médiateur X, 1 rue Y, 75000 Paris, https://x.test");
    LEGAL.mediator = { ...mediator, email: "m@x.test", phone: "01 00 00 00 00" };
    expect(mediatorText()).toBe("Médiateur X, 1 rue Y, 75000 Paris, https://x.test, m@x.test, 01 00 00 00 00");
  });

  it("sans fonction de rétractation en ligne, la vente live n'est pas prête, même avec un médiateur", () => {
    Object.assign(LEGAL, { mediator, phone: PHONE, onlineWithdrawal: false });
    expect(legalReady()).toBe(false);
    expect(legalMissing()).toEqual([expect.stringMatching(/rétractation/)]);
  });

  it("sans téléphone (exigé par R.111-1 et D.211-1), la vente live n'est pas prête non plus", () => {
    Object.assign(LEGAL, { mediator, phone: null, onlineWithdrawal: true });
    expect(legalReady()).toBe(false);
    expect(legalMissing()).toEqual([expect.stringMatching(/téléphone/)]);
  });

  it("le marqueur du téléphone est dans la langue de la page ; renseigné, il le remplace", () => {
    LEGAL.phone = null;
    expect(phoneText("fr")).toMatch(/TÉLÉPHONE/);
    expect(phoneText("en")).toMatch(/PHONE/);
    expect(legalValues("en").phone).not.toMatch(/TÉLÉPHONE/);
    LEGAL.phone = PHONE;
    expect(phoneText("fr")).toBe(PHONE);
    expect(legalValues("en").phone).toBe(PHONE);
  });

  it("médiateur ET rétractation en ligne : rien ne manque", () => {
    Object.assign(LEGAL, { mediator, phone: PHONE, onlineWithdrawal: true });
    expect(legalMissing()).toEqual([]);
    expect(legalReady()).toBe(true);
  });

  it("état livré : médiateur CM2C, téléphone et rétractation en ligne sont en place — rien ne manque côté droit", () => {
    expect(saved.mediator).toEqual({
      name: expect.stringMatching(/CM2C/),
      address: "49 rue de Ponthieu, 75008 Paris",
      website: "https://www.cm2c.net",
      email: "contact@cm2c.net",
      phone: "01 89 47 00 14",
    });
    expect(saved.phone).toBeTruthy();
    // La fonction « Renoncer au contrat ici » existe (page /boutique/retractation, route
    // api/boutique/retractation) : le drapeau est à true. Ne le repasser à false que pour
    // FERMER les paiements réels.
    expect(saved.onlineWithdrawal).toBe(true);
    expect(legalMissing()).toEqual([]);
    expect(legalReady()).toBe(true);
    // Le texte public contient bien les trois informations exigées (nom, adresse postale, site).
    expect(mediatorText()).toMatch(/CM2C.*75008 Paris.*cm2c\.net.*contact@cm2c\.net.*01 89 47 00 14/);
  });
});

const MESSAGES_BY_LOCALE = { fr, en } as const;

describe("textes légaux rendus (vrais messages, vraies valeurs)", () => {
  const MESSAGES = { fr, en } as const;
  const translator = (locale: "fr" | "en", namespace: string) =>
    createTranslator({
      locale,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- messages JSON, espace de noms dynamique
      messages: MESSAGES[locale] as any,
      namespace: namespace as never,
      // next-intl AVALE les erreurs de format (variable manquante, balise inconnue…) et renvoie la
      // clé : sans ces deux garde-fous, un `{adress}` mal orthographié passerait ce test.
      onError: (error) => {
        throw error;
      },
      getMessageFallback: ({ namespace: ns, key }) => {
        throw new Error(`message introuvable ou invalide : ${ns}.${key}`);
      },
    }) as unknown as (
      key: string,
      values?: Record<string, unknown>,
    ) => string;

  const CGV_KEYS = Object.keys(fr.cgv) as (keyof typeof fr.cgv)[];

  it.each(["fr", "en"] as const)("CGV (%s) : chaque article se rend sans variable manquante ni accolade résiduelle", (locale) => {
    const t = translator(locale, "cgv");
    const values = legalValues(locale);
    for (const key of CGV_KEYS) {
      const out = t(key, values);
      expect(out, key).not.toMatch(/[{}]/);
    }
  });

  it("le détecteur d'erreurs ICU du test fonctionne (variable manquante = échec, pas une clé renvoyée)", () => {
    expect(() => translator("fr", "cgv")("vendeurBody", {})).toThrow();
    const withoutRna: Record<string, unknown> = { ...legalValues("en") };
    delete withoutRna.rna;
    expect(() => translator("en", "cgv")("vendeurBody", withoutRna)).toThrow();
  });

  it.each(["fr", "en"] as const)("CGV (%s) : l'identité du vendeur et les coordonnées sont celles de legal.ts", (locale) => {
    const t = translator(locale, "cgv");
    const v = legalValues(locale);
    const seller = t("vendeurBody", v);
    for (const fact of [LEGAL.name, LEGAL.rna, LEGAL.siren, LEGAL.siret, LEGAL.vat, LEGAL.address, LEGAL.email]) {
      expect(seller).toContain(fact);
    }
    expect(t("effective", v)).toContain(locale === "fr" ? "5 octobre 2026" : "5 October 2026");
    expect(t("retractationBody", v)).toContain(LEGAL.returnAddress);
    expect(t("retractationForm", v)).toContain(LEGAL.email);
    expect(t("garantiesBody", v)).toContain(LEGAL.email);
  });

  it("CGV : plus aucun champ « à compléter » (hors marqueur du médiateur, géré par le code)", () => {
    // Majuscule initiale = champ à remplir par l'éditeur ([RAISON SOCIALE]…).
    // Les [date], [numéro]… du formulaire type sont, eux, à remplir par le CLIENT.
    const placeholder = /\[[A-ZÉÈÀ][^\]]*\]/;
    for (const [locale, msgs] of Object.entries(MESSAGES)) {
      for (const ns of ["cgv", "legal", "privacy"] as const) {
        for (const [key, value] of Object.entries(msgs[ns])) {
          expect(JSON.stringify(value), `${locale}.${ns}.${key}`).not.toMatch(placeholder);
        }
      }
    }
  });

  it.each(["fr", "en"] as const)("CGV (%s) : TVA incluse, plus de mention « TVA non applicable » ni de capital", (locale) => {
    const t = translator(locale, "cgv");
    const v = legalValues(locale);
    const all = CGV_KEYS.map((k) => t(k, v)).join("\n");
    expect(all).not.toMatch(/293 B/);
    expect(all).not.toMatch(/capital/i);
    expect(t("prixBody", v)).toMatch(locale === "fr" ? /TVA .*incluse/ : /VAT .*included/);
  });

  it("CGV : la plateforme européenne de règlement des litiges (fermée en 2025) n'est plus citée", () => {
    for (const msgs of Object.values(MESSAGES)) {
      expect(JSON.stringify(msgs)).not.toContain("ec.europa.eu/consumers/odr");
    }
  });

  it.each([
    ["fr", "10 jours ouvrés", /Suisse[^.]*douane|douane[^.]*Suisse/],
    ["en", "10 working days", /Switzerland[^.]*customs|customs[^.]*Switzerland/],
  ] as const)("CGV (%s) : délai ferme de livraison et mention des droits de douane hors UE", (locale, delay, customs) => {
    const delivery = translator(locale, "cgv")("livraisonBody", legalValues(locale));
    expect(delivery).toContain(delay);
    expect(delivery).not.toMatch(/indicatif|indicative/);
    expect(delivery).toMatch(customs);
  });

  it("CGV : la zone de livraison annoncée est EXACTEMENT celle que Stripe accepte", () => {
    const NAMES: Record<string, { fr: string; en: string }> = {
      FR: { fr: "France", en: "France" },
      BE: { fr: "Belgique", en: "Belgium" },
      LU: { fr: "Luxembourg", en: "Luxembourg" },
      CH: { fr: "Suisse", en: "Switzerland" },
      MC: { fr: "Monaco", en: "Monaco" },
      DE: { fr: "Allemagne", en: "Germany" },
      ES: { fr: "Espagne", en: "Spain" },
      IT: { fr: "Italie", en: "Italy" },
      NL: { fr: "Pays-Bas", en: "the Netherlands" },
      PT: { fr: "Portugal", en: "Portugal" },
    };
    // Un pays ajouté côté Stripe sans être annoncé dans les CGV (ou l'inverse) fait échouer ce test.
    expect(Object.keys(NAMES).sort()).toEqual([...SHIPPING_COUNTRIES].sort());
    for (const locale of ["fr", "en"] as const) {
      const delivery = translator(locale, "cgv")("livraisonBody", legalValues(locale));
      for (const code of SHIPPING_COUNTRIES) expect(delivery, `${locale} ${code}`).toContain(NAMES[code][locale]);
      // Le panier et la fiche produit citent les mêmes pays et préviennent des droits de douane.
      for (const [ns, key] of [["cart", "shippingNote"], ["product", "deliveryText"]] as const) {
        const note = MESSAGES[locale][ns][key as never] as string;
        for (const code of SHIPPING_COUNTRIES.filter((c) => c !== "FR")) expect(note, `${locale} ${ns} ${code}`).toContain(NAMES[code][locale]);
        expect(note, `${locale} ${ns}`).toMatch(/Suisse|Switzerland/);
        expect(note, `${locale} ${ns}`).toMatch(/douane|customs/);
      }
    }
  });

  it.each(["fr", "en"] as const)("CGV (%s) : le remboursement à la rétractation inclut la livraison initiale et respecte les délais légaux", (locale) => {
    const body = translator(locale, "cgv")("retractationBody", legalValues(locale));
    expect(body).toMatch(locale === "fr" ? /frais de livraison initiaux/ : /initial delivery costs/);
    // Trois délais de 14 jours : se rétracter, renvoyer les produits, rembourser.
    expect((body.match(/\(14\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(body).toMatch(locale === "fr" ? /même moyen de paiement/ : /same means of payment/);
  });

  it.each(["fr", "en"] as const)("CGV (%s) : le litige passe d'abord par l'association, puis le médiateur", (locale) => {
    const t = translator(locale, "cgv");
    const v = legalValues(locale);
    const body = t("litigesBody", v);
    expect(body).toContain(LEGAL.email);
    expect(body).toContain(v.mediator);
  });

  it.each(["fr", "en"] as const)("mentions légales (%s) : éditeur identifié (dénomination, RNA, SIREN, siège) et hébergeur à jour", (locale) => {
    const t = translator(locale, "legal");
    const v = legalValues(locale);
    const publisher = t("publisherText", { name: "XBZ Esport", ...v });
    for (const fact of [LEGAL.name, LEGAL.rna, LEGAL.siren, LEGAL.siret, LEGAL.vat]) expect(publisher).toContain(fact);
    expect(t("registeredOffice", v)).toContain(LEGAL.address);
    // Adresse actuelle de Vercel Inc. (ses conditions d'utilisation et sa notice de confidentialité).
    const hosting = JSON.stringify(MESSAGES[locale].legal.hostingText);
    expect(hosting).toContain("440 N Barranca Ave #4133");
    expect(hosting).toContain("Covina");
    expect(hosting).not.toContain("Walnut");
  });

  it.each(["fr", "en"] as const)("confidentialité (%s) : responsable identifié, transferts hors UE et délai d'un mois", (locale) => {
    const t = translator(locale, "privacy");
    const v = legalValues(locale);
    const controller = JSON.stringify(MESSAGES[locale].privacy.controllerText);
    for (const fact of ["{association}", "{rna}", "{siren}", "{address}"]) expect(controller).toContain(fact);
    expect(t("transfersText1")).toMatch(/Vercel/);
    expect(t("transfersText1")).toMatch(locale === "fr" ? /États-Unis/ : /United States/);
    expect(JSON.stringify(MESSAGES[locale].privacy.rightsContact)).toMatch(locale === "fr" ? /un mois/ : /one month/);
    expect(v.association).toBe(LEGAL.name);
  });
});

describe("CGV : points de droit de la consommation", () => {
  const cgv = (locale: "fr" | "en", key: string) =>
    createTranslator({
      locale,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- messages JSON, espace de noms dynamique
      messages: ({ fr, en } as any)[locale],
      namespace: "cgv" as never,
      onError: (e) => {
        throw e;
      },
    })(key as never, legalValues(locale) as never) as string;

  it.each(["fr", "en"] as const)("(%s) la rétractation ne dépend ni du « parfait état » ni de l'emballage d'origine", (locale) => {
    const body = cgv(locale, "retractationBody");
    expect(body).not.toMatch(/parfait état|perfect condition/i);
    // Le client est seulement INVITÉ à protéger le colis ; la loi (L.221-23) limite sa responsabilité.
    expect(body).toMatch(locale === "fr" ? /est invité à renvoyer/ : /invited to return/);
    expect(body).toMatch(locale === "fr" ? /dépréciation/ : /loss in value/);
  });

  it.each(["fr", "en"] as const)("(%s) le droit français ne prive pas le client des règles impératives de son pays", (locale) => {
    const body = cgv(locale, "litigesBody");
    expect(body).toMatch(locale === "fr" ? /droit français/ : /French law/);
    expect(body).toMatch(locale === "fr" ? /dispositions impératives de protection du consommateur/ : /mandatory consumer-protection provisions/);
  });

  it.each(["fr", "en"] as const)("(%s) retard de livraison : résolution après injonction OU immédiate, remboursement sous 14 jours", (locale) => {
    const body = cgv(locale, "livraisonBody");
    expect(body).toContain("L.216-2");
    expect(body).toContain("L.216-3");
    expect(body).toContain("L.216-4");
    expect(body).toMatch(locale === "fr" ? /immédiatement/ : /immediately/);
    expect(body).toMatch(/quatorze \(14\) jours suivant la résolution|fourteen \(14\) days after termination/);
  });

  it.each(["fr", "en"] as const)("(%s) force majeure bornée (art. 1218) : plus de grève des transporteurs ni d'événement « indépendant de sa volonté »", (locale) => {
    const body = cgv(locale, "responsabiliteBody");
    expect(body).toContain("1218");
    expect(body).not.toMatch(/grève|strike|indépendant de sa volonté|beyond its control/i);
    expect(body).toMatch(locale === "fr" ? /ne limitent pas les droits/ : /do not limit the customer's statutory rights/);
  });

  it.each(["fr", "en"] as const)("(%s) commande : pas de motif d'annulation vague, remboursement sous 14 jours, archivage 10 ans et copie sur demande", (locale) => {
    const body = cgv(locale, "commandeBody");
    expect(body).not.toMatch(/litige existant|existing dispute/i);
    expect(body).toMatch(/\(14\)/);
    expect(body).toMatch(locale === "fr" ? /archivée.*dix \(10\) ans/ : /archived.*ten \(10\) years/);
    expect(body.split(LEGAL.email).length - 1).toBeGreaterThanOrEqual(2); // facture + copie de commande
  });

  it.each(["fr", "en"] as const)("(%s) ne promet qu'un reçu de Stripe : aucun e-mail de confirmation propre au site n'existe", (locale) => {
    expect(cgv(locale, "commandeBody")).toMatch(locale === "fr" ? /reçu de paiement est envoyé par Stripe/ : /payment receipt is sent by Stripe/);
    const confirm = MESSAGES_BY_LOCALE[locale].orderConfirm.email;
    expect(confirm).toMatch(/Stripe/);
  });

  it.each(["fr", "en"] as const)("(%s) garanties légales : sources, indépendance des garanties commerciales, contact complet et renvoi postal gratuit", (locale) => {
    const body = cgv(locale, "garantiesBody");
    expect(body).toMatch(/L\.217-3/);
    expect(body).toMatch(/1641/);
    // Art. D.211-1 : coordonnées postales ET téléphoniques, adresse électronique.
    expect(body).toContain(LEGAL.email);
    expect(body).toContain(LEGAL.address);
    expect(body).toContain(phoneText(locale));
    // Art. D.217-1 : renvoi par voie postale, jamais un autre transport à la charge du client.
    expect(body).toContain(LEGAL.returnAddress);
    expect(body).toMatch(locale === "fr" ? /voie postale/ : /by post/);
    expect(body).toMatch(locale === "fr" ? /ni de prendre en charge un transport autre qu'un envoi postal/ : /arrange or pay for any transport other than a postal shipment/);
  });

  it("l'encadré des garanties légales FR est le modèle officiel (annexe de l'article D. 211-2), mot pour mot", () => {
    // Décret n° 2022-946 du 29 juin 2022, annexe I-A. Le texte ne doit JAMAIS être reformulé :
    // si ce test échoue après une retouche, c'est que l'encadré n'est plus conforme au modèle.
    // Pour une mise à jour VOULUE (nouveau décret), recopier le modèle puis recalculer l'empreinte.
    const text = fr.cgv.garantiesEncadre.normalize("NFC").replace(/\u2019/g, "'");
    const OFFICIAL_SHA256 = "ba1cd3ff057845c001c8d8ca7ba18d5a4fdaa1abab65727dc5c9db0da5ffa04e";
    expect(createHash("sha256").update(text, "utf8").digest("hex")).toBe(OFFICIAL_SHA256);
    // Repères lisibles en cas d'échec.
    for (const phrase of [
      "délai de deux ans à compter de la délivrance du bien",
      "dans un délai de trente jours suivant sa demande, sans frais et sans inconvénient majeur pour lui",
      "extension de six mois de la garantie initiale",
      "renouvelée pour une période de deux ans à compter de la date de remplacement du bien",
      "Le consommateur n'a pas droit à la résolution de la vente si le défaut de conformité est mineur.",
      "articles L. 217-1 à L. 217-32 du code de la consommation",
      "amende civile d'un montant maximal de 300 000 euros",
      "articles 1641 à 1649 du code civil",
    ]) {
      expect(text).toContain(phrase);
    }
  });

  it("l'encadré EN a la même structure que le modèle FR (mêmes paragraphes, mêmes quatre cas numérotés, mêmes chiffres)", () => {
    const frBox = fr.cgv.garantiesEncadre;
    const enBox = en.cgv.garantiesEncadre;
    expect(enBox.split("\n\n").length).toBe(frBox.split("\n\n").length);
    expect((enBox.match(/^[1-4]° /gm) ?? []).length).toBe(4);
    const nums = (t: string) => (t.match(/\d[\d ,.]*\d|\d/g) ?? []).map((n) => n.replace(/[ ,.]/g, ""));
    // « 300 000 euros » / « EUR 300,000 », « 10 % » / « 10% », numéros d'articles : mêmes nombres, même ordre.
    expect(nums(enBox)).toEqual(nums(frBox));
    // Les durées écrites en toutes lettres (deux ans, trente jours, six mois) ne passent pas par `nums` :
    for (const phrase of [
      "a period of two years from delivery of the goods",
      "for a period of more than two years",
      "within thirty days of their request",
      "a six-month extension of the original guarantee",
      "renewed for a period of two years from the date of replacement of the goods",
      "after a period of thirty days",
      "up to EUR 300,000",
      "raised up to 10% of average annual turnover",
      "for two years from discovery of the defect",
    ]) {
      expect(enBox).toContain(phrase);
    }
    expect(en.cgv.garantiesEncadreNote).toMatch(/French text prevails/);
  });

  it.each(["fr", "en"] as const)("(%s) rétractation en ligne : la fonction est annoncée dans les CGV, avec l'accusé daté et horodaté", (locale) => {
    const body = cgv(locale, "retractationBody");
    expect(body).toContain(locale === "fr" ? "« Renoncer au contrat ici »" : "“Withdraw from contract here”");
    expect(body).toMatch(locale === "fr" ? /accusé de réception.*date et l'heure/ : /acknowledgement of receipt.*date and time/);
    // Les autres voies (courrier, e-mail, formulaire type) restent ouvertes.
    expect(body).toContain(LEGAL.email);
    expect(body).toMatch(locale === "fr" ? /formulaire type/ : /model form/);
  });

  it.each(["fr", "en"] as const)("(%s) libellés de la fonction de rétractation : « Renoncer au contrat ici » puis « Confirmer la rétractation », partout les mêmes", (locale) => {
    const start = locale === "fr" ? "Renoncer au contrat ici" : "Withdraw from contract here";
    const msgs = MESSAGES_BY_LOCALE[locale];
    expect(msgs.withdrawal.start).toBe(start);
    expect(msgs.footer.withdraw).toBe(start);
    expect(msgs.orderConfirm.withdraw).toBe(start);
    // Second bouton : le libellé reste NU (aucun autre texte dedans, exigence de la directive).
    expect(msgs.withdrawal.confirm).toBe(locale === "fr" ? "Confirmer la rétractation" : "Confirm withdrawal");
  });

  it("le pied de page (donc CHAQUE page) porte le lien vers la fonction de rétractation", () => {
    const footer = readFileSync("src/components/Footer.tsx", "utf8");
    expect(footer).toMatch(/href: "\/boutique\/retractation", key: "withdraw"/);
  });

  it.each(["fr", "en"] as const)("(%s) panier et fiche produit annoncent le délai de livraison (avant la commande)", (locale) => {
    for (const [ns, key] of [["cart", "shippingNote"], ["product", "deliveryText"]] as const) {
      const note = MESSAGES_BY_LOCALE[locale][ns][key as never] as string;
      expect(note, `${locale} ${ns}`).toContain("{days}");
    }
  });
});

describe("politique de confidentialité : couverture des traitements", () => {
  it.each(["fr", "en"] as const)("(%s) fiches publiques, comptes staff, journaux : chacun a une donnée, une finalité et une conservation", (locale) => {
    const p = MESSAGES_BY_LOCALE[locale].privacy;
    for (const key of ["members", "staff", "logs", "orders", "antispam"] as const) {
      expect(p.collected[key], `${locale} collected.${key}`).toBeTruthy();
    }
    for (const key of ["purposeText5", "purposeText6", "purposeText7", "retentionStaffText"] as const) {
      expect(p[key], `${locale} ${key}`).toBeTruthy();
    }
    // La copie Discord est annoncée comme une copie COMPLÈTE, pas comme une simple notification.
    expect(p.processors.discord).toMatch(locale === "fr" ? /copie complète/ : /full copy/);
    // Le bot Discord est hébergé chez Render, à Francfort : il figure parmi les prestataires et les transferts.
    expect(p.processors.render).toMatch(locale === "fr" ? /Render.*Francfort/ : /Render.*Frankfurt/);
    expect(p.transfersText1).toMatch(/Render/);
    // Rétractation en ligne : données collectées, prestataire d'e-mails (Brevo), conservation avec les commandes.
    expect(p.collected.withdrawals).toBeTruthy();
    expect(p.processors.brevo).toMatch(/Brevo/);
    expect(p.retentionWithdrawalsText).toMatch(locale === "fr" ? /5 ans/ : /5 years/);
    expect(p.purposeText4).toMatch(locale === "fr" ? /accusé de réception/ : /acknowledgement of receipt/);
    // L'adresse IP anti-spam n'est plus décrite comme supprimée « quelques instants » après.
    expect(p.collected.antispam).not.toMatch(/quelques instants|few moments/);
  });
});

