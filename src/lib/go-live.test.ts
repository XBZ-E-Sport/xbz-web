// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { liveBlockers } from "@/lib/go-live";
import { LEGAL } from "@/lib/legal";

const saved = { ...LEGAL };

afterEach(() => {
  Object.assign(LEGAL, saved);
  vi.unstubAllEnvs();
});

describe("liveBlockers", () => {
  it("rien ne manque : tout est en place (droit + e-mails)", () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("MAIL_FROM_EMAIL", "support@xbz.test");
    expect(liveBlockers()).toEqual([]);
  });

  it("l'envoi d'e-mails manquant bloque, avec les noms des variables à renseigner", () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("MAIL_FROM_EMAIL", "");
    expect(liveBlockers()).toEqual([expect.stringMatching(/BREVO_API_KEY.*MAIL_FROM_EMAIL/)]);
  });

  it("cumule les prérequis légaux ET les e-mails", () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("MAIL_FROM_EMAIL", "");
    Object.assign(LEGAL, { mediator: null, phone: null, onlineWithdrawal: false });
    const blockers = liveBlockers();
    expect(blockers).toHaveLength(4);
    expect(blockers.join(" | ")).toMatch(/médiateur.*téléphone.*rétractation.*e-mail/);
  });
});
