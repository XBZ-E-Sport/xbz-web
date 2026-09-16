// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// matchs.ts (importé indirectement) tire `unstable_cache` : on le neutralise,
// le cache n'est pas l'objet de ce test.
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn }));

const {
  nowParisMs,
  matchStartMs,
  isWithinReminderWindow,
  parisDayStr,
  isSameDay,
  buildDigestPayload,
  buildReminderPayload,
} = await import("@/lib/discord-matchs");

const notif = (over: Partial<Parameters<typeof buildReminderPayload>[0]> = {}) => ({
  rosterName: "Roster SSL",
  opponent: "Rivals",
  competition: "Coupe",
  format: "BO3",
  startsAt: "2026-07-01T18:00:00",
  streamUrl: null,
  ...over,
});

describe("discord-matchs — temps (heure murale FR)", () => {
  it("convertit l'instant présent en heure de Paris (été = UTC+2)", () => {
    expect(nowParisMs(new Date("2026-07-01T12:00:00Z"))).toBe(Date.parse("2026-07-01T14:00:00Z"));
  });

  it("gère l'heure d'hiver (UTC+1)", () => {
    expect(nowParisMs(new Date("2026-01-01T12:00:00Z"))).toBe(Date.parse("2026-01-01T13:00:00Z"));
  });

  it("interprète l'heure de match sans fuseau", () => {
    expect(matchStartMs("2026-07-01T18:00:00")).toBe(Date.parse("2026-07-01T18:00:00Z"));
  });

  it("rappelle un match dans la fenêtre, pas un trop lointain ni un passé", () => {
    const now = Date.parse("2026-07-01T14:00:00Z"); // 14:00 heure de Paris
    expect(isWithinReminderWindow("2026-07-01T14:30:00", now, 90)).toBe(true); // +30 min
    expect(isWithinReminderWindow("2026-07-01T16:00:00", now, 90)).toBe(false); // +120 min
    expect(isWithinReminderWindow("2026-07-01T13:00:00", now, 90)).toBe(false); // -60 min
  });

  it("détermine le jour de Paris, y compris après minuit UTC", () => {
    expect(parisDayStr(new Date("2026-07-01T12:00:00Z"))).toBe("2026-07-01");
    // 23:30 UTC en été = 01:30 le lendemain à Paris.
    expect(parisDayStr(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
  });

  it("isSameDay compare la date du match au jour donné", () => {
    expect(isSameDay("2026-07-01T18:00:00", "2026-07-01")).toBe(true);
    expect(isSameDay("2026-07-02T09:00:00", "2026-07-01")).toBe(false);
  });
});

describe("discord-matchs — messages", () => {
  it("le rappel cite l'adversaire dans le titre", () => {
    const p = buildReminderPayload(notif());
    expect(p.embeds[0].title).toContain("Rivals");
    expect(p.embeds[0].description).toContain("Roster SSL");
  });

  it("le digest liste les matchs et affiche le nombre", () => {
    const p = buildDigestPayload([notif(), notif({ opponent: "Team B" })]);
    expect(p.embeds[0].title).toContain("(2)");
    expect(p.embeds[0].description).toContain("Rivals");
    expect(p.embeds[0].description).toContain("Team B");
  });
});
