import { test, expect } from "@playwright/test";

// Pages qui ne lisent pas la BDD → testables sans projet Supabase.
test.describe("Pages publiques", () => {
  test("Le club : titre, en-tête, landmark principal et lien d'évitement", async ({ page }) => {
    await page.goto("/fr/le-club");

    await expect(page).toHaveTitle(/Le club — XBZ Esport/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Bienvenue chez XBZ/i }),
    ).toBeVisible();

    // Accessibilité : lien d'évitement présent + landmark <main>.
    await expect(page.getByRole("link", { name: /Aller au contenu principal/i })).toBeAttached();
    await expect(page.locator("main#main")).toBeVisible();
  });

  test("Mentions légales : titre + canonical propre à la page", async ({ page }) => {
    await page.goto("/fr/mentions-legales");

    await expect(page).toHaveTitle(/Mentions légales/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/fr\/mentions-legales$/,
    );
  });

  test("Support : la FAQ s'ouvre au clic (accordéon <details>)", async ({ page }) => {
    await page.goto("/fr/support");

    const summary = page.locator("summary", { hasText: "Comment rejoindre XBZ ?" });
    await expect(summary).toBeVisible();

    // La réponse est repliée tant que le <details> est fermé.
    const answer = page.getByText(/Rends-toi sur la page Recrutement/i);
    await expect(answer).toBeHidden();

    await summary.click();
    await expect(answer).toBeVisible();
  });

  test("Support : le piège anti-spam (honeypot) est masqué aux lecteurs d'écran", async ({ page }) => {
    await page.goto("/fr/support");
    // Le honeypot existe mais est enfermé dans un conteneur aria-hidden
    // (invisible pour un humain / lecteur d'écran ; seuls les bots le remplissent).
    const honeypot = page.locator('[aria-hidden="true"] input[name="website"]');
    await expect(honeypot).toBeAttached();
  });

  test("404 : une URL inconnue rend NOTRE page, dans les deux langues", async ({ page }) => {
    // Depuis le passage sous `[locale]`, Next n'a plus de `not-found` racine :
    // sans la route attrape-tout, il servait sa 404 générique, en anglais et
    // sans la charte. Rien ne le signalait — ni le build, ni les tests.
    await page.goto("/fr/cette-page-nexiste-pas");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Page introuvable/i);
    await expect(page.getByRole("link", { name: /Retour à l’accueil/i })).toBeVisible();
    // La coquille du site est bien là (c'est tout l'intérêt d'une 404 maison).
    await expect(page.locator("main#main")).toBeVisible();

    await page.goto("/en/this-page-does-not-exist");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Page not found/i);

    // Google ne doit pas indexer ces URL. Next répond 200 sur une 404 diffusée
    // en flux (statut figé dès le premier octet) et compense par ce `noindex` :
    // c'est LUI qui protège le référencement, pas le code de statut.
    // Plusieurs balises : la nôtre, plus celles que Next ajoute de lui-même.
    // Toutes doivent dire noindex — une seule qui autoriserait l'indexation
    // suffirait à faire remonter l'URL dans les résultats.
    const robots = page.locator('meta[name="robots"]');
    expect(await robots.count()).toBeGreaterThan(0);
    for (const content of await robots.evaluateAll((tags) =>
      tags.map((t) => t.getAttribute("content") ?? ""),
    )) {
      expect(content).toMatch(/noindex/);
    }
  });

  test("404 : une URL profonde inconnue tombe aussi sur notre page", async ({ page }) => {
    await page.goto("/fr/le-club/section-imaginaire");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Page introuvable/i);
  });
});
