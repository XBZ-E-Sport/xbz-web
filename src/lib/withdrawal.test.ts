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
  escapeHtml,
  escapeLike,
  formatReceivedAt,
  matchOrder,
  normalizeOrderNumber,
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
    expect(matchOrder([{ id: A }, { id: B }], "xbz-ffeeddcc")).toEqual({
      orderId: B,
      match: "exact",
      orderNumber: "XBZ-FFEEDDCC",
    });
  });

  it("pas de numéro, une seule commande payée pour cet e-mail : « single »", () => {
    expect(matchOrder([{ id: A }], null)).toEqual({ orderId: A, match: "single", orderNumber: null });
  });

  it("numéro inconnu mais une seule commande : on la rattache (« single ») en gardant le numéro saisi", () => {
    expect(matchOrder([{ id: A }], "XBZ-00000000")).toEqual({
      orderId: A,
      match: "single",
      orderNumber: "XBZ-00000000",
    });
  });

  it("plusieurs commandes et aucun numéro exploitable : « ambiguous », le staff tranche, on ne devine pas", () => {
    expect(matchOrder([{ id: A }, { id: B }], null)).toEqual({ orderId: null, match: "ambiguous", orderNumber: null });
    expect(matchOrder([{ id: A }, { id: B }], "n'importe quoi")).toEqual({
      orderId: null,
      match: "ambiguous",
      orderNumber: null,
    });
  });

  it("aucune commande payée pour cet e-mail : « none »", () => {
    expect(matchOrder([], null)).toEqual({ orderId: null, match: "none", orderNumber: null });
    expect(matchOrder([], "XBZ-1A2B3C4D")).toEqual({ orderId: null, match: "none", orderNumber: "XBZ-1A2B3C4D" });
  });
});

describe("escapeLike / escapeHtml", () => {
  it("aucun joker : « a_b@x.fr » ne vise pas « aXb@x.fr », « % » ne vise pas tout le monde", () => {
    expect(escapeLike("a_b%c\\d@x.fr")).toBe("a\\_b\\%c\\\\d@x.fr");
    expect(escapeLike("simple@x.fr")).toBe("simple@x.fr");
  });

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

  it("le texte brut est lisible seul (aucune balise)", () => {
    const mail = buildAck(translator("en"), input({ locale: "en" }));
    expect(mail.text).not.toMatch(/<[a-z]/i);
    expect(mail.text).toContain("— Full name: Jeanne Martin");
  });
});
