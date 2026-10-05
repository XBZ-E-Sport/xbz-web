import "server-only";

// Envoi d'e-mails transactionnels (aujourd'hui : l'accusé de réception d'une
// rétractation). Un seul fournisseur, derrière UNE fonction : en changer ne
// touche que ce fichier.
//
// Fournisseur : Brevo (société française, données hébergées dans l'Union
// européenne, offre gratuite de 300 e-mails par jour), par son API HTTPS — pas
// de SDK, un simple `fetch`.
//
// Configuration (voir .env.example) :
//   BREVO_API_KEY     clé d'API (Brevo › SMTP & API › Clés API)
//   MAIL_FROM_EMAIL   adresse d'expédition — un domaine AUTHENTIFIÉ chez Brevo
//                     (SPF/DKIM/DMARC), sinon les messages tombent en spam
//   MAIL_FROM_NAME    nom affiché (défaut : « XBZ Esport »)

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Adresse de réponse (défaut : l'adresse d'expédition). */
  replyTo?: string;
};

export type MailResult = { ok: true } | { ok: false; error: string };

/** Les deux variables indispensables sont-elles renseignées ? */
export function isMailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM_EMAIL);
}

/**
 * Envoie un e-mail. Ne lève jamais : un échec revient en `{ ok: false, error }`,
 * pour que l'appelant l'enregistre et réessaie plus tard.
 *
 * `error` ne contient JAMAIS d'adresse e-mail ni de texte du message : il part
 * dans une colonne lue par le staff et dans les journaux.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  if (!apiKey || !fromEmail) return { ok: false, error: "e-mail non configuré (BREVO_API_KEY, MAIL_FROM_EMAIL)" };

  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME || "XBZ Esport", email: fromEmail },
        to: [{ email: message.to }],
        replyTo: { email: message.replyTo ?? fromEmail },
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };

    // Brevo répond { code, message } : on garde le code (stable), pas le message
    // qui peut reprendre l'adresse du destinataire.
    const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? ` ${body.code.slice(0, 60)}` : "";
    return { ok: false, error: `Brevo HTTP ${res.status}${code}` };
  } catch (e) {
    const name = e instanceof Error ? e.name : "erreur";
    return { ok: false, error: `Brevo injoignable (${name})` };
  }
}
