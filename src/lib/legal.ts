// Identité juridique de l'association : UNE source pour les CGV, les mentions
// légales et la politique de confidentialité. Un changement d'adresse, de
// médiateur ou de date se fait ici, une fois — pas dans trois fichiers de
// traduction, où l'on finit par en oublier un.
//
// Module sans dépendance : importable des pages serveur comme des tests.

const ADDRESS = "74 avenue Jean Jaurès, 3e étage, appartement 33, Iléa Verdé, 76140 Petit-Quevilly";

export const LEGAL = {
  /** Dénomination déclarée (celle du RNA et de Sirene). */
  name: "XBZ E-SPORT",
  formFr: "association déclarée régie par la loi du 1er juillet 1901",
  formEn: "non-profit association governed by the French law of 1 July 1901",
  /** Répertoire national des associations. */
  rna: "W763022514",
  siren: "108 817 677",
  /** SIRET du siège. */
  siret: "108 817 677 00017",
  /** Numéro de TVA intracommunautaire. */
  vat: "FR28 108 817 677",
  address: ADDRESS,
  /** Contact des clients : droit de rétractation, garanties, droits RGPD. */
  email: "support@xbz-esport.com",
  /**
   * Téléphone de l'association, tel qu'on l'affiche (ex. « 02 35 00 00 00 »).
   * Exigé dans les informations précontractuelles (article R.111-1, 1°, du Code
   * de la consommation), les conditions générales des garanties légales
   * (article D.211-1) et les mentions légales d'un éditeur (LCEN, art. 6-III).
   * `null` tant qu'il manque : la boutique refuse alors les paiements réels.
   */
  phone: "06 72 42 19 20" as null | string,
  /** Adresse où les clients renvoient un colis (rétractation). Même lieu que le siège ; à séparer ici le jour où ça change. */
  returnAddress: ADDRESS,
  /** Délai de livraison promis, en jours ouvrés, à compter du paiement. */
  deliveryDays: 10,
  /**
   * Date d'entrée en vigueur de cette version des CGV (AAAA-MM-JJ) : le jour
   * où elle est publiée. À changer à chaque modification des CGV.
   */
  cgvEffective: "2026-10-04",
  /**
   * Médiateur de la consommation auquel l'association adhère (obligatoire pour
   * vendre à des particuliers : garantir au client un recours effectif, article
   * L.612-1 du Code de la consommation, et lui communiquer ses coordonnées,
   * article L.616-1). `null` tant qu'aucune adhésion n'est faite : la boutique
   * REFUSE alors les paiements réels (voir `legalMissing`).
   *
   * CM2C — Centre de la Médiation de la Consommation de Conciliateurs de Justice,
   * médiateur validé par la CECMC. Coordonnées recopiées de l'attestation
   * d'affiliation et de la convention signées le 5 octobre 2026 (siège : 49 rue de
   * Ponthieu, 75008 Paris ; l'ancienne adresse du 17e est fermée depuis 2023).
   * La convention (article 3-2) impose d'informer le consommateur des modalités de
   * saisine : téléphone, site ET adresse e-mail, en plus de l'adresse postale.
   *
   * Adhésion de 3 ans, jusqu'au 5 octobre 2029, reconduite tacitement par périodes
   * de 3 ans : pour y mettre fin, lettre recommandée AU PLUS TARD le 5 juillet 2029.
   */
  mediator: {
    name: "CM2C — Centre de la Médiation de la Consommation de Conciliateurs de Justice",
    address: "49 rue de Ponthieu, 75008 Paris",
    website: "https://www.cm2c.net",
    email: "contact@cm2c.net",
    phone: "01 89 47 00 14",
  } as null | { name: string; address: string; website: string; email?: string; phone?: string },
  /**
   * Le client peut-il se rétracter EN LIGNE ? Depuis le 19 juin 2026, un site
   * qui vend à des consommateurs doit offrir une fonction de rétractation
   * accessible dans son interface (bouton « Renoncer au contrat ici », avec
   * accusé de réception sur support durable) — directive (UE) 2023/2673,
   * art. 11a de la directive 2011/83. Elle existe : page
   * `/boutique/retractation` (lien dans le pied de chaque page), route
   * `api/boutique/retractation`, accusé par e-mail (`src/lib/mailer.ts`). Remettre
   * ce drapeau à `false` ferme les paiements réels, comme tout prérequis manquant.
   * L'envoi d'e-mails, lui, se vérifie à part : voir `liveBlockers` (go-live.ts).
   */
  onlineWithdrawal: true as boolean,
};

/** Marqueur visible tant que le médiateur n'est pas renseigné. */
export const MEDIATOR_PLACEHOLDER = "[MÉDIATEUR À RENSEIGNER AVANT L'OUVERTURE DE LA VENTE]";
const MEDIATOR_PLACEHOLDER_EN = "[CONSUMER MEDIATOR TO BE FILLED IN BEFORE SALES OPEN]";
const PHONE_PLACEHOLDER = "[TÉLÉPHONE À RENSEIGNER AVANT L'OUVERTURE DE LA VENTE]";
const PHONE_PLACEHOLDER_EN = "[PHONE NUMBER TO BE FILLED IN BEFORE SALES OPEN]";

/**
 * Ce qui manque encore avant de pouvoir encaisser pour de vrai. Vide = prêt.
 * La boutique en test (clé `sk_test_`) fonctionne sans ; avec une clé live, le
 * paiement est refusé tant que la liste n'est pas vide.
 */
export function legalMissing(): string[] {
  const missing: string[] = [];
  if (LEGAL.mediator === null) missing.push("médiateur de la consommation non renseigné");
  if (!LEGAL.phone) missing.push("numéro de téléphone non renseigné");
  if (!LEGAL.onlineWithdrawal) missing.push("fonction de rétractation en ligne non construite");
  return missing;
}

/** Les informations et fonctions légales indispensables à une vente réelle sont-elles là ? */
export function legalReady(): boolean {
  return legalMissing().length === 0;
}

/** « Nom, adresse, site, e-mail, téléphone » du médiateur, ou le marqueur s'il manque. */
export function mediatorText(locale = "fr"): string {
  const m = LEGAL.mediator;
  if (m) return [m.name, m.address, m.website, m.email, m.phone].filter(Boolean).join(", ");
  return locale === "en" ? MEDIATOR_PLACEHOLDER_EN : MEDIATOR_PLACEHOLDER;
}

/** Le téléphone, ou le marqueur (dans la langue de la page) s'il manque. */
export function phoneText(locale = "fr"): string {
  if (LEGAL.phone) return LEGAL.phone;
  return locale === "en" ? PHONE_PLACEHOLDER_EN : PHONE_PLACEHOLDER;
}

/** `2026-10-04` → « 4 octobre 2026 » / « 4 October 2026 » (mois en lettres : jamais ambigu). */
export function formatLegalDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Variables ICU communes aux textes légaux (`{association}`, `{siret}`…).
 * Passées à chaque `t()` des pages CGV, mentions légales et confidentialité.
 */
export function legalValues(locale: string) {
  const en = locale === "en";
  return {
    association: LEGAL.name,
    form: en ? LEGAL.formEn : LEGAL.formFr,
    rna: LEGAL.rna,
    siren: LEGAL.siren,
    siret: LEGAL.siret,
    vat: LEGAL.vat,
    address: LEGAL.address,
    email: LEGAL.email,
    phone: phoneText(locale),
    returnAddress: LEGAL.returnAddress,
    days: LEGAL.deliveryDays,
    date: formatLegalDate(LEGAL.cgvEffective, locale),
    mediator: mediatorText(locale),
  };
}
