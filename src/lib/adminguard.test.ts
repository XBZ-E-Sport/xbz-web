// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// `redirect()` de Next interrompt l'exécution en levant : on reproduit ce
// comportement pour vérifier qu'un accès refusé ne renvoie JAMAIS de client admin.
class RedirectError extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

const { userResult, allowlistRow, maybeSingleMock } = vi.hoisted(() => ({
  userResult: { value: null as unknown },
  allowlistRow: { value: null as unknown },
  maybeSingleMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: userResult.value } }) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    __isAdminClient: true,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            maybeSingleMock();
            return { data: allowlistRow.value };
          },
        }),
      }),
    }),
  }),
}));

import { requireStaff, assertStaff } from "@/lib/adminguard";
import { STAFF_TTL_DAYS } from "@/lib/discord-guard";

const DAY = 24 * 3600 * 1000;
const freshVerdict = { xbz_staff: true, xbz_staff_at: new Date().toISOString() };
const staleVerdict = {
  xbz_staff: true,
  xbz_staff_at: new Date(Date.now() - (STAFF_TTL_DAYS * DAY + 60_000)).toISOString(),
};

const user = (app_metadata: unknown, email = "test@xbz.gg") => ({
  id: "u1",
  email,
  app_metadata,
});

async function expectRedirect(fn: () => Promise<unknown>) {
  await expect(fn()).rejects.toBeInstanceOf(RedirectError);
}

beforeEach(() => {
  userResult.value = user(freshVerdict);
  allowlistRow.value = null;
  maybeSingleMock.mockClear();
});

describe("requireStaff", () => {
  it("laisse passer sur le seul rôle Discord, sans consulter la liste email", async () => {
    const { user: u, admin } = await requireStaff();

    expect(u.id).toBe("u1");
    expect(admin).toBeTruthy();
    expect(maybeSingleMock).not.toHaveBeenCalled(); // court-circuit : pas de requête inutile
  });

  it("laisse passer via la liste email quand il n'y a pas de verdict Discord", async () => {
    userResult.value = user(undefined);
    allowlistRow.value = { email: "test@xbz.gg" };

    await expect(requireStaff()).resolves.toMatchObject({ user: { id: "u1" } });
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it("REFUSE sans verdict Discord ni email autorisé", async () => {
    userResult.value = user(undefined);
    allowlistRow.value = null;

    await expectRedirect(() => requireStaff());
  });

  it("REFUSE un verdict Discord périmé si l'email n'est pas listé", async () => {
    userResult.value = user(staleVerdict);

    await expectRedirect(() => requireStaff());
    expect(maybeSingleMock).toHaveBeenCalledTimes(1); // le repli a bien été tenté
  });

  it("accepte un verdict périmé si l'email est dans la liste", async () => {
    userResult.value = user(staleVerdict);
    allowlistRow.value = { email: "test@xbz.gg" };

    await expect(requireStaff()).resolves.toBeTruthy();
  });

  it("REFUSE un accès Discord révoqué", async () => {
    userResult.value = user({ xbz_staff: false, xbz_staff_at: new Date().toISOString() });

    await expectRedirect(() => requireStaff());
  });

  it("REFUSE un visiteur non connecté", async () => {
    userResult.value = null;

    await expectRedirect(() => requireStaff());
  });
});

describe("assertStaff", () => {
  it("renvoie le client admin quand l'accès est accordé", async () => {
    await expect(assertStaff()).resolves.toBeTruthy();
  });

  it("ne renvoie RIEN quand l'accès est refusé", async () => {
    userResult.value = user(undefined);

    await expectRedirect(() => assertStaff());
  });
});
