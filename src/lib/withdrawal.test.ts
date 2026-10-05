// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";

vi.mock("@/lib/stripe", () => ({ stripe: () => ({}) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import { orderNumber } from "@/lib/shop";
import {
  buildAck,
  emailLikePattern,
  escapeHtml,
  formatReceivedAt,
  mailboxKey,
  matchOrder,
  normalizeOrderNumber,
  sameEmail,
  type AckInput,
} from "@/lib/withdrawal";

const A = "1a2b3c4d-0000-4000-8000-000000000001";
const B = "ffeeddcc-0000-4000-8000-000000000002";

describe("normalizeOrderNumber", () => {
  it.each([
    ["XBZ-1A2B3C4D", "XBZ-1A2B3C4D"],
    ["xbz-1a2b3c4d", "XBZ-1A2B3C4D"],
    ["  XBZ 1A2B 3C4D  ", "XBZ-1A2B3C4D"],
    ["xbz1a2b3c4d", "XBZ-1A2B3C4D"],
    ["1a2b3c4d", "XBZ-1A2B3C4D"],
  ])("%j → %s", (raw, expected) => {
    expect(normalizeOrderNumber(raw)).toBe(expected);
  });

  it.each(["", "XBZ-", "XBZ-1A2B3C4", "XBZ-1A2B3C4DE", "XBZ-1A2B3C4G", "commande 42", "XBZ-1A2B3C4D; drop table"])(
    "%j n'est pas un numéro de commande",
    (raw) => {
      expect(normalizeOrderNumber(raw)).toBeNull();
    },
  );

  it("reconnaît le format réellement produit par orderNumber()", () => {
    expect(normalizeOrderNumber(orderNumber(A))).toBe(orderNumber(A));
    expect(orderNumber(A)).toBe("XBZ-1A2B3C4D");
  });
});

describe("matchOrder — la déclaration est TOUJOURS acceptée, seul le rapprochement varie", () => {
  it("numéro reconnu : « exact », même s'il y a plusieurs commandes", () => {
    expect(matchOrder([{ id: A }, { id: B }], "xbz-ffeeddcc")).toEqual({ orderId: B, match: "exact" });
  });

  it("pas de numéro, une seule commande payée pour cet e-mail : « single »", () => {
    expect(matchOrder([{ id: A }], null)).toEqual({ orderId: A, match: "single" });
    expect(matchOrder([{ id: A }], "")).toEqual({ orderId: A, match: "single" });
  });

  it("numéro valide mais inconnu de cet e-mail : « mismatch », JAMAIS rattaché à « la seule commande » (le client en désigne une autre)", () => {
    expect(matchOrder([{ id: A }], "XBZ-00000000")).toEqual({ orderId: null, match: "mismatch" });
    expect(matchOrder([{ id: A }, { id: B }], "xbz-00000000")).toEqual({ orderId: null, match: "mismatch" });
    expect(matchOrder([], "XBZ-1A2B3C4D")).toEqual({ orderId: null, match: "mismatch" });
  });

  it("texte libre qui n'est pas un numéro (« ma commande de mai ») : on retombe sur l'e-mail", () => {
    expect(matchOrder([{ id: A }], "ma commande de mai")).toEqual({ orderId: A, match: "single" });
    expect(matchOrder([{ id: A }, { id: B }], "ma commande de mai")).toEqual({ orderId: null, match: "ambiguous" });
    expect(matchOrder([], "ma commande de mai")).toEqual({ orderId: null, match: "none" });
  });

  it("plusieurs commandes et aucun numéro : « ambiguous », le staff tranche, on ne devine pas", () => {
    expect(matchOrder([{ id: A }, { id: B }], null)).toEqual({ orderId: null, match: "ambiguous" });
  });

  it("aucune commande payée pour cet e-mail et aucun numéro : « none »", () => {
    expect(matchOrder([], null)).toEqual({ orderId: null, match: "none" });
  });
});

describe("recherche par adresse : aucun joker, adresse EXACTE", () => {
  it("emailLikePattern neutralise % _ \\ et le « * » que PostgREST lit comme %", () => {
    expect(emailLikePattern("a_b%c\\d@x.fr")).toBe("a\\_b\\%c\\\\d@x.fr");
    expect(emailLikePattern("a*b@x.fr")).toBe("a_b@x.fr"); // un seul caractère, jamais « tout »
    expect(emailLikePattern("*@*.*")).toBe("_@_._");
    expect(emailLikePattern("simple@x.fr")).toBe("simple@x.fr");
  });

  it("sameEmail : casse et espaces ignorés, mais l'adresse doit être la MÊME", () => {
    expect(sameEmail("Jeanne@Exemple.fr", " jeanne@exemple.fr ")).toBe(true);
    // Ce que le motif approché (« * » → « _ ») ramènerait en trop est écarté ici.
    expect(sameEmail("aXb@x.fr", "a*b@x.fr")).toBe(false);
    expect(sameEmail("autre@x.fr", "jeanne@x.fr")).toBe(false);
    expect(sameEmail(null, "jeanne@x.fr")).toBe(false);
  });

  it("mailboxKey : « +tag », casse et points de Gmail ramenés à une seule boîte (plafond d'accusés)", () => {
    expect(mailboxKey("Victim+7@Example.COM")).toBe("victim@example.com");
    expect(mailboxKey("v.i.c.t.i.m+x@gmail.com")).toBe("victim@gmail.com");
    expect(mailboxKey("victim@googlemail.com")).toBe("victim@gmail.com");
    // Hors Gmail, les points comptent (ce sont des boîtes différentes).
    expect(mailboxKey("a.b@example.com")).toBe("a.b@example.com");
    expect(mailboxKey("+tag@example.com")).toBe("+tag@example.com"); // pas de partie locale avant le +
    expect(mailboxKey("pas-une-adresse")).toBe("pas-une-adresse");
  });
});

describe("escapeHtml", () => {
  it("neutralise le HTML saisi par le client", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')"> & co`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt; &amp; co",
    );
  });
});

describe("formatReceivedAt", () => {
  it("date ET heure, à l'heure de Paris, dans la langue du client", () => {
    // 4 octobre 2026, 23:11:23 UTC = 5 octobre, 01:11:23 à Paris (UTC+2).
    const at = new Date("2026-10-04T23:11:23Z");
    expect(formatReceivedAt(at, "fr")).toMatch(/5 octobre 2026.*01:11:23/);
    expect(formatReceivedAt(at, "en")).toMatch(/5 October 2026.*01:11:23/);
  });
});

describe("buildAck — accusé de réception (contenu de la déclaration + date et heure)", () => {
  const translator = (locale: "fr" | "en") =>
    createTranslator({
      locale,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- messages JSON
      messages: { fr, en }[locale] as any,
      namespace: "withdrawalMail" as never,
      // Une variable manquante ou une clé absente doit FAIRE ÉCHOUER le test, pas renvoyer la clé.
      onError: (e) => {
        throw e;
      },
      getMessageFallback: ({ key }) => {
        throw new Error(`message introuvable : withdrawalMail.${key}`);
      },
    }) as unknown as (key: string, values?: Record<string, string | number>) => string;

  const input = (over: Partial<AckInput> = {}): AckInput => ({
    locale: "fr",
    name: "Jeanne Martin",
    email: "jeanne@exemple.fr",
    orderNumber: "XBZ-1A2B3C4D",
    details: "Le maillot taille M seulement",
    receivedAt: new Date("2026-10-04T23:11:23Z"),
    returnAddress: "1 rue du Retour, 76140 Petit-Quevilly",
    association: "XBZ E-SPORT",
    address: "74 avenue Jean Jaurès, 76140 Petit-Quevilly",
    contactEmail: "support@xbz-esport.com",
    termsUrl: "https://www.xbz-esport.org/fr/cgv#retractation",
    ...over,
  });

  it.each(["fr", "en"] as const)("(%s) texte et HTML portent la déclaration, la date, l'heure et l'adresse de retour", (locale) => {
    const mail = buildAck(translator(locale), input({ locale }));
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("Jeanne Martin");
      expect(body).toContain("jeanne@exemple.fr");
      expect(body).toContain("XBZ-1A2B3C4D");
      expect(body).toContain("Le maillot taille M seulement");
      expect(body).toContain("01:11:23"); // l'HEURE, pas seulement la date
      expect(body).toContain(locale === "fr" ? "5 octobre 2026" : "5 October 2026");
      expect(body).toContain("1 rue du Retour, 76140 Petit-Quevilly");
      expect(body).toContain("https://www.xbz-esport.org/fr/cgv#retractation");
      expect(body).toMatch(/quatorze \(14\) jours|fourteen \(14\) days/);
    }
    expect(mail.subject).toBe(locale === "fr" ? "Accusé de réception de ta rétractation — XBZ Esport" : "Acknowledgement of receipt of your withdrawal — XBZ Esport");
  });

  it("l'objet est FIXE : rien de ce que le client a saisi ne peut s'y glisser (injection d'en-tête)", () => {
    const mail = buildAck(translator("fr"), input({ name: "Bob\r\nBcc: victime@x.fr", orderNumber: "XBZ-1" }));
    expect(mail.subject).not.toMatch(/Bob|Bcc|victime/);
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it("le HTML échappe tout ce que le client a saisi (nom, précisions)", () => {
    const mail = buildAck(
      translator("fr"),
      input({ name: `<script>alert(1)</script>`, details: `<a href="https://evil.test">cliquez</a>` }),
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain(`<a href="https://evil.test">`);
    expect(mail.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    // Le lien des conditions, lui, est bien cliquable (c'est le NÔTRE).
    expect(mail.html).toContain(`<a href="https://www.xbz-esport.org/fr/cgv#retractation">`);
  });

  it("commande non précisée : le dit clairement ; précisions absentes : pas de ligne vide", () => {
    const mail = buildAck(translator("fr"), input({ orderNumber: null, details: null }));
    expect(mail.text).toContain("Commande : non précisée");
    expect(mail.text).not.toContain("Précisions");
    expect(mail.html).not.toContain("Précisions");
  });

  it("l'accusé ne PROMET pas : il confirme la réception, rappelle les conditions « si ton droit s'applique », et propose d'ignorer si ce n'est pas le client", () => {
    for (const locale of ["fr", "en"] as const) {
      const mail = buildAck(translator(locale), input({ locale }));
      expect(mail.text).toMatch(locale === "fr" ? /confirme uniquement la réception/ : /only confirms receipt/);
      expect(mail.text).toMatch(locale === "fr" ? /Si ton droit de rétractation s’applique, nous te remboursons/ : /If your right of withdrawal applies, we refund/);
      expect(mail.text).toMatch(locale === "fr" ? /Tu n’es pas à l’origine de cette déclaration/ : /Did not make this statement/);
      expect(mail.text).toContain("support@xbz-esport.com");
      expect(mail.html).toContain("support@xbz-esport.com");
    }
  });

  it("le texte brut est lisible seul (aucune balise)", () => {
    const mail = buildAck(translator("en"), input({ locale: "en" }));
    expect(mail.text).not.toMatch(/<[a-z]/i);
    expect(mail.text).toContain("— Full name: Jeanne Martin");
  });
});
