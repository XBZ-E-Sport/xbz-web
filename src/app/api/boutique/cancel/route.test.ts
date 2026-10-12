// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  cancel: vi.fn(),
  jar: new Map<string, string>(),
  deleted: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (m.jar.has(name) ? { value: m.jar.get(name) } : undefined),
    delete: (name: string) => {
      m.deleted.push(name);
      m.jar.delete(name);
    },
  }),
}));
vi.mock("@/lib/shop", () => ({ CHECKOUT_COOKIE: "xbz_checkout", cancelReservation: m.cancel }));
vi.mock("@/lib/stripe", () => ({ isStripeConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { POST } from "./route";

const ORDER = "0b6f1d3e-8f1a-4a7e-9c2d-5e4f3a2b1c0d";
const call = (site = "same-origin") =>
  POST(new Request("https://www.xbz-esport.org/api/boutique/cancel", { method: "POST", headers: { "sec-fetch-site": site } }));

beforeEach(() => {
  m.cancel.mockReset();
  m.jar = new Map([
    ["xbz_checkout", ORDER],
    ["xbz_checkout_open", "tok-1"],
  ]);
  m.deleted = [];
});

describe("POST /api/boutique/cancel", () => {
  it("stock rendu : ok, released, témoins effacés", async () => {
    m.cancel.mockResolvedValue("released");
    const res = await call();
    expect(await res.json()).toEqual({ ok: true, released: true });
    expect(m.cancel).toHaveBeenCalledWith({}, ORDER);
    expect(m.deleted.sort()).toEqual(["xbz_checkout", "xbz_checkout_open"]);
  });

  it("rien à rendre (déjà payée, déjà rendue) : ok, témoins effacés", async () => {
    m.cancel.mockResolvedValue("done");
    expect(await (await call()).json()).toEqual({ ok: true, released: false });
    expect(m.deleted).toHaveLength(2);
  });

  it("issue incertaine (Stripe injoignable) ou exception : 503, témoins GARDÉS pour réessayer", async () => {
    m.cancel.mockResolvedValue("unknown");
    let res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, released: false });
    expect(m.deleted).toHaveLength(0);
    m.cancel.mockRejectedValue(new Error("boom"));
    res = await call();
    expect(res.status).toBe(503);
    expect(m.deleted).toHaveLength(0);
  });

  it("aucun paiement ouvert (pas de cookie) : ok sans rien appeler", async () => {
    m.jar = new Map([["xbz_checkout_open", "tok-1"]]);
    expect(await (await call()).json()).toEqual({ ok: true, released: false });
    expect(m.cancel).not.toHaveBeenCalled();
  });

  it("appel venu d'un autre site : 403", async () => {
    expect((await call("cross-site")).status).toBe(403);
    expect(m.cancel).not.toHaveBeenCalled();
  });
});
