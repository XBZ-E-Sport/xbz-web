// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import { buildOrderConfirmation, type ConfirmationInput } from "@/lib/order-mail";

const translator = (locale: "fr" | "en") =>
  createTranslator({
    locale,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- messages JSON
    messages: { fr, en }[locale] as any,
    namespace: "orderMail" as never,
    // Une variable manquante ou une clé absente doit FAIRE ÉCHOUER le test, pas renvoyer la clé.
    onError: (e) => {
      throw e;
    },
    getMessageFallback: ({ key }) => {
      throw new Error(`message introuvable : orderMail.${key}`);
    },
  }) as unknown as (key: string, values?: Record<string, string | number>) => string;

const input = (over: Partial<ConfirmationInput> = {}): ConfirmationInput => ({
  locale: "fr",
  name: "Jeanne Martin",
  orderNumber: "XBZ-1A2B3C4D",
  items: [
    { name: "Maillot officiel XBZ", size: "M", quantity: 1, unit_amount: 4999 },
    { name: "Pack de stickers", size: "", quantity: 2, unit_amount: 500 },
  ],
  shipping: 4.9,
  total: 64.89,
  deliveryDays: 10,
  association: "XBZ E-SPORT",
  address: "74 avenue Jean Jaurès, 76140 Petit-Quevilly",
  contactEmail: "support@xbz-esport.com",
  termsUrl: "https://www.xbz-esport.org/fr/cgv",
  withdrawalUrl: "https://www.xbz-esport.org/fr/boutique/retractation",
  ...over,
});

const printed = {
  name: "Maillot officiel XBZ",
  size: "L",
  quantity: 1,
  unit_amount: 5499,
  print: { name: "MARTIN", number: "10", extra: 500 },
};

describe("buildOrderConfirmation", () => {
  it.each(["fr", "en"] as const)("(%s) texte et HTML portent la commande, les montants, la livraison, la rétractation et les garanties", (locale) => {
    const mail = buildOrderConfirmation(translator(locale), input({ locale }));
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("XBZ-1A2B3C4D");
      expect(body).toContain("Maillot officiel XBZ");
      expect(body).toContain("Pack de stickers");
      expect(body).toContain("https://www.xbz-esport.org/fr/boutique/retractation");
      expect(body).toContain("https://www.xbz-esport.org/fr/cgv");
      expect(body).toContain("support@xbz-esport.com");
      expect(body).toMatch(locale === "fr" ? /quatorze \(14\) jours/ : /fourteen \(14\) days/);
      expect(body).toMatch(locale === "fr" ? /garantie légale de conformité/ : /statutory guarantee of conformity/);
      expect(body).toMatch(locale === "fr" ? /10 jours ouvrés/ : /10 working days/);
    }
    // 49,99 € ; 2 × 5,00 € = 10,00 € ; port 4,90 € ; total 64,89 €
    expect(mail.text).toMatch(locale === "fr" ? /49,99\s€/ : /€49\.99/);
    expect(mail.text).toMatch(locale === "fr" ? /10,00\s€/ : /€10\.00/);
    expect(mail.text).toMatch(locale === "fr" ? /Livraison : 4,90\s€/ : /Delivery: €4\.90/);
    expect(mail.text).toMatch(locale === "fr" ? /Total payé \(TTC\) : 64,89\s€/ : /Total paid \(incl\. VAT\): €64\.89/);
  });

  it("taille : « (taille M) » pour un produit à tailles, rien pour une taille unique", () => {
    const mail = buildOrderConfirmation(translator("fr"), input());
    expect(mail.text).toContain("Maillot officiel XBZ (taille M)");
    expect(mail.text).toContain("— 2 × Pack de stickers :");
  });

  it("l'objet est FIXE : numéro de commande seulement, jamais de texte du client", () => {
    const mail = buildOrderConfirmation(translator("fr"), input({ name: "Bob\r\nBcc: victime@x.fr" }));
    expect(mail.subject).toBe("Confirmation de ta commande XBZ-1A2B3C4D — XBZ Esport");
    expect(mail.subject).not.toMatch(/[\r\n]|Bob/);
  });

  it("sans article personnalisé : aucune mention de l'exclusion de la rétractation", () => {
    for (const locale of ["fr", "en"] as const) {
      const mail = buildOrderConfirmation(translator(locale), input({ locale }));
      expect(mail.text).not.toMatch(/L\.221-28/);
      expect(mail.html).not.toMatch(/L\.221-28/);
    }
  });

  it("avec un article personnalisé : le texte imprimé, le prix payé ET l'exclusion (les autres articles gardent leur rétractation)", () => {
    for (const locale of ["fr", "en"] as const) {
      const mail = buildOrderConfirmation(translator(locale), input({ locale, items: [{ ...printed }, { name: "Mug", size: "", quantity: 1, unit_amount: 1499 }] }));
      for (const body of [mail.text, mail.html]) {
        expect(body).toContain(locale === "fr" ? "Personnalisation : MARTIN · n° 10" : "Personalisation: MARTIN · No. 10");
        expect(body).toMatch(/L\.221-28, 3°/);
        expect(body).toMatch(locale === "fr" ? /Les autres articles de ta commande gardent leur droit de rétractation/ : /The other items in your order keep their right of withdrawal/);
      }
      // 54,99 € payé pour la ligne personnalisée : le supplément est dans le prix.
      expect(mail.text).toMatch(locale === "fr" ? /54,99\s€/ : /€54\.99/);
    }
  });

  it("nom absent : salutation neutre", () => {
    const mail = buildOrderConfirmation(translator("fr"), input({ name: null }));
    expect(mail.text.startsWith("Bonjour,\n\n")).toBe(true);
  });

  it("tout ce qui vient du client est échappé dans le HTML ; les liens sont cliquables", () => {
    const mail = buildOrderConfirmation(
      translator("fr"),
      input({
        name: '<img src=x onerror=alert(1)> & "Dupont"',
        items: [{ name: "<script>x</script> Maillot", size: "M", quantity: 1, unit_amount: 100, print: { name: "A<B", number: "1", extra: 0 } }],
      }),
    );
    expect(mail.html).not.toContain("<img");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Dupont&quot;");
    expect(mail.html).toContain("A&lt;B");
    expect(mail.html).toContain('<a href="https://www.xbz-esport.org/fr/boutique/retractation">https://www.xbz-esport.org/fr/boutique/retractation</a>');
    // Le texte brut garde le contenu tel quel (aucune balise n'y est interprétée).
    expect(mail.text).toContain("<script>x</script> Maillot");
  });

  it("le texte brut est lisible seul : aucune balise de mise en forme", () => {
    const mail = buildOrderConfirmation(translator("en"), input({ locale: "en", items: [{ ...printed }] }));
    expect(mail.text).not.toMatch(/<\/?(p|ul|li|a|strong|br)\b/i);
    expect(mail.text).toContain("— 1 × Maillot officiel XBZ (size L)");
  });
});
