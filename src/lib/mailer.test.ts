// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isMailConfigured, sendMail } from "@/lib/mailer";

const MAIL = {
  to: "client@exemple.fr",
  subject: "Accusé de réception",
  text: "texte brut",
  html: "<p>html</p>",
};

beforeEach(() => {
  vi.stubEnv("BREVO_API_KEY", "xkeysib-secret");
  vi.stubEnv("MAIL_FROM_EMAIL", "support@xbz.test");
  vi.stubEnv("MAIL_FROM_NAME", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isMailConfigured", () => {
  it("vrai seulement avec la clé ET l'adresse d'expédition", () => {
    expect(isMailConfigured()).toBe(true);
    vi.stubEnv("BREVO_API_KEY", "");
    expect(isMailConfigured()).toBe(false);
    vi.stubEnv("BREVO_API_KEY", "xkeysib-secret");
    vi.stubEnv("MAIL_FROM_EMAIL", "");
    expect(isMailConfigured()).toBe(false);
  });
});

describe("sendMail", () => {
  it("appelle l'API Brevo avec la clé en en-tête et le message complet (texte + HTML)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 201 }));
    await expect(sendMail({ ...MAIL, replyTo: "reponse@xbz.test" })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init?.headers as Record<string, string>)["api-key"]).toBe("xkeysib-secret");
    expect(JSON.parse(String(init?.body))).toEqual({
      sender: { name: "XBZ Esport", email: "support@xbz.test" },
      to: [{ email: "client@exemple.fr" }],
      replyTo: { email: "reponse@xbz.test" },
      subject: "Accusé de réception",
      textContent: "texte brut",
      htmlContent: "<p>html</p>",
    });
  });

  it("répond par défaut à l'adresse d'expédition, sous le nom configuré", async () => {
    vi.stubEnv("MAIL_FROM_NAME", "Boutique XBZ");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 201 }));
    await sendMail(MAIL);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.sender.name).toBe("Boutique XBZ");
    expect(body.replyTo).toEqual({ email: "support@xbz.test" });
  });

  it("non configuré : échec explicite, sans appel réseau", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await sendMail(MAIL);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/non configuré/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refus du fournisseur : le code HTTP et le code Brevo, JAMAIS l'adresse du client", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "invalid_parameter", message: "client@exemple.fr is not valid" }), {
        status: 400,
      }),
    );
    const result = await sendMail(MAIL);
    expect(result).toEqual({ ok: false, error: "Brevo HTTP 400 invalid_parameter" });
    expect(JSON.stringify(result)).not.toContain("client@exemple.fr");
  });

  it("réponse d'erreur illisible : le code HTTP seul", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>boom</html>", { status: 503 }));
    expect(await sendMail(MAIL)).toEqual({ ok: false, error: "Brevo HTTP 503" });
  });

  it("réseau coupé ou délai dépassé : ne lève jamais, renvoie un échec", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect(await sendMail(MAIL)).toEqual({ ok: false, error: "Brevo injoignable (TimeoutError)" });
  });
});
