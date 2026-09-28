import { describe, it, expect, vi, beforeEach } from "vitest";

// Fausse table `rate_limit_hits` en mémoire. Chaque opération rend la main
// (await) comme un vrai aller-retour réseau : des appels lancés en parallèle
// s'entrelacent donc réellement, ce qui permet de tester une rafale.
type Hit = { id: number; ip: string; route: string; created_at: string };
const { db } = vi.hoisted(() => ({
  db: {
    rows: [] as Hit[],
    nextId: 1,
    fail: null as null | "insert" | "count",
  },
}));
const tick = () => new Promise((r) => setTimeout(r, 0));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: { ip: string; route: string }) => ({
        select: () => ({
          single: async () => {
            await tick();
            if (db.fail === "insert") return { data: null, error: { message: "supabase down" } };
            const hit = { id: db.nextId++, ...row, created_at: new Date().toISOString() };
            db.rows.push(hit);
            return { data: { id: hit.id }, error: null };
          },
        }),
      }),
      select: () => ({
        eq: (_c1: string, ip: string) => ({
          eq: (_c2: string, route: string) => ({
            gte: async (_c3: string, since: string) => {
              await tick();
              if (db.fail === "count") return { count: null, error: { message: "supabase down" } };
              const count = db.rows.filter((h) => h.ip === ip && h.route === route && h.created_at >= since).length;
              return { count, error: null };
            },
          }),
        }),
      }),
      delete: () => ({
        eq: async (_c: string, id: number) => {
          await tick();
          db.rows = db.rows.filter((h) => h.id !== id);
          return { error: null };
        },
        lt: async (_c: string, since: string) => {
          await tick();
          db.rows = db.rows.filter((h) => h.created_at >= since);
          return { error: null };
        },
      }),
    }),
  }),
}));

import { getClientIp, checkFormRateLimit, checkRateLimit, rateLimitKey } from "@/lib/ratelimit";

function req(headers: Record<string, string>): Request {
  return new Request("https://xbz-esport.fr/api/x", { headers });
}

describe("getClientIp", () => {
  it("préfère x-real-ip, que le client ne peut pas imposer", () => {
    expect(getClientIp(req({ "x-real-ip": "10.0.0.1" }))).toBe("10.0.0.1");
    // Même quand une liste falsifiée l'accompagne.
    expect(
      getClientIp(req({ "x-real-ip": "10.0.0.1", "x-forwarded-for": "6.6.6.6" })),
    ).toBe("10.0.0.1");
  });

  it("prend la DERNIÈRE entrée de x-forwarded-for", () => {
    // C'est le nerf de la protection : la première entrée est celle qu'un
    // client a pu écrire lui-même, la dernière est ajoutée par le relais.
    // En prendre la première, c'est offrir une identité neuve à chaque envoi
    // — l'anti-flood ne compte alors plus rien.
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7, 5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("trim les espaces autour de l'IP", () => {
    expect(getClientIp(req({ "x-forwarded-for": "  9.9.9.9  " }))).toBe("9.9.9.9");
  });

  it("retourne 'unknown' sans aucun en-tête d'IP", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });

  it("retourne 'unknown' plutôt qu'une chaîne vide sur un en-tête vide", () => {
    // Sinon deux visiteurs distincts partageraient le compteur de la clé "".
    expect(getClientIp(req({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});

describe("rateLimitKey", () => {
  it("garde une IPv4 telle quelle", () => {
    expect(rateLimitKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("ramène une IPv6 à son /64 (un abonné), quelle que soit l'écriture", () => {
    const key = "2001:db8:1:2::/64";
    expect(rateLimitKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(key);
    expect(rateLimitKey("2001:0db8:0001:0002:0000:0000:0000:0001")).toBe(key);
    expect(rateLimitKey("2001:DB8:1:2::99")).toBe(key);
    expect(rateLimitKey("[2001:db8:1:2::1]")).toBe(key);
    expect(rateLimitKey("2001:db8:1:2::1%eth0")).toBe(key);
  });

  it("distingue deux abonnés IPv6 (/64 différents)", () => {
    expect(rateLimitKey("2001:db8:1:2::1")).not.toBe(rateLimitKey("2001:db8:1:3::1"));
  });

  it("ramène une IPv4 encapsulée en IPv6 à l'IPv4", () => {
    expect(rateLimitKey("::ffff:198.51.100.4")).toBe("198.51.100.4");
  });

  it("normalise les autres écritures d'une même adresse", () => {
    expect(rateLimitKey("2001:db8:1:2::1.2.3.4")).toBe("2001:db8:1:2::/64"); // IPv4 finale
    expect(rateLimitKey("::ffff:102:304")).toBe("1.2.3.4"); // IPv4 encapsulée, en hexadécimal
    expect(rateLimitKey("::ffff:102:304")).not.toBe(rateLimitKey("::1"));
    expect(rateLimitKey("[2001:db8:1:2::1]:443")).toBe("2001:db8:1:2::/64"); // crochets + port
    expect(rateLimitKey("001.002.003.004")).toBe("1.2.3.4"); // zéros de tête
    expect(rateLimitKey("1.2.3.4:5678")).toBe("1.2.3.4"); // port
  });

  it("préfixe /48 (second seuil des formulaires)", () => {
    expect(rateLimitKey("2001:db8:1:2::1", 48)).toBe("2001:db8:1::/48");
    expect(rateLimitKey("2001:db8:1:ffff::1", 48)).toBe("2001:db8:1::/48");
    expect(rateLimitKey("1.2.3.4", 48)).toBe("1.2.3.4");
  });

  it("laisse intacte une valeur illisible", () => {
    expect(rateLimitKey("unknown")).toBe("unknown");
    expect(rateLimitKey("1:2:3")).toBe("1:2:3");
    expect(rateLimitKey("zz::1")).toBe("zz::1");
    expect(rateLimitKey("999.1.1.1")).toBe("999.1.1.1");
    expect(rateLimitKey("1::2::3")).toBe("1::2::3");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    db.rows = [];
    db.nextId = 1;
    db.fail = null;
  });

  it("accepte jusqu'au seuil, refuse au-delà, et n'enregistre que les passages acceptés", async () => {
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await checkRateLimit("1.1.1.1", "support", { limit: 5 })).allowed);
    expect(results).toEqual([true, true, true, true, true, false, false]);
    expect(db.rows).toHaveLength(5);
  });

  it("une rafale PARALLÈLE ne dépasse jamais le seuil", async () => {
    // Avant : chaque requête comptait AVANT d'écrire. Lancées ensemble, toutes
    // voyaient un compteur à 0 et passaient — 20 sur 20.
    const burst = await Promise.all(
      Array.from({ length: 20 }, () => checkRateLimit("6.6.6.6", "recrutement", { limit: 5 })),
    );
    expect(burst.filter((r) => r.allowed).length).toBeLessThanOrEqual(5);
  });

  it("compromis assumé : une rafale simultanée peut être refusée en entier, mais l'envoi suivant passe", async () => {
    // Requêtes strictement simultanées d'une même IP : elles se voient toutes,
    // d'où un refus possible de l'ensemble (conservateur). Les passages
    // refusés sont retirés, donc aucun blocage durable.
    const burst = await Promise.all(
      Array.from({ length: 20 }, () => checkRateLimit("7.7.7.7", "support", { limit: 5 })),
    );
    expect(burst.every((r) => !r.allowed)).toBe(true);
    expect(db.rows.filter((h) => h.ip === "7.7.7.7")).toHaveLength(0);
    expect((await checkRateLimit("7.7.7.7", "support", { limit: 5 })).allowed).toBe(true);
  });

  it("compte ensemble toutes les adresses d'un même /64 IPv6", async () => {
    const allowed = [];
    for (let i = 1; i <= 6; i++) {
      allowed.push((await checkRateLimit(`2001:db8:1:2::${i.toString(16)}`, "support", { limit: 5 })).allowed);
    }
    expect(allowed).toEqual([true, true, true, true, true, false]);
  });

  it("sépare les routes et les IP", async () => {
    for (let i = 0; i < 5; i++) await checkRateLimit("1.1.1.1", "support", { limit: 5 });
    expect((await checkRateLimit("1.1.1.1", "recrutement", { limit: 5 })).allowed).toBe(true);
    expect((await checkRateLimit("2.2.2.2", "support", { limit: 5 })).allowed).toBe(true);
  });

  it("REFUSE par défaut quand le compteur lui-même est en panne", async () => {
    // Sur un formulaire public, l'étape suivante écrit dans cette même base :
    // si le compteur échoue, l'enregistrement échouera aussi. Laisser passer
    // n'aiderait personne et ouvrirait la porte au spam au pire moment.
    for (const fail of ["insert", "count"] as const) {
      db.fail = fail;
      expect(await checkRateLimit("1.1.1.1", "support", { windowSeconds: 60 })).toEqual({
        allowed: false,
        retryAfter: 60,
      });
    }
  });

  it("laisse passer en panne quand l'appelant le demande explicitement", async () => {
    // Cas de la remontée d'erreurs : elle part vers Discord, pas vers Supabase.
    db.fail = "insert";
    expect(await checkRateLimit("1.1.1.1", "report-error", { failOpen: true })).toEqual({
      allowed: true,
      retryAfter: 0,
    });
  });
});

describe("checkFormRateLimit", () => {
  beforeEach(() => {
    db.rows = [];
    db.nextId = 1;
    db.fail = null;
  });

  it("IPv6 : au plus 15 envois/min par /48, même en changeant de /64", async () => {
    let accepted = 0;
    for (let sub = 0; sub < 30; sub++) {
      // Chaque /64 reste sous son propre seuil (1 envoi chacun).
      if ((await checkFormRateLimit(`2001:db8:1:${sub.toString(16)}::1`, "recrutement")).allowed) accepted++;
    }
    expect(accepted).toBe(15);
  });

  it("IPv4 : un seul seuil (5/min), jamais compté deux fois", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await checkFormRateLimit("198.51.100.9", "support")).allowed);
    expect(results).toEqual([true, true, true, true, true, false]);
    expect(db.rows.every((h) => h.route === "support")).toBe(true);
  });
});
