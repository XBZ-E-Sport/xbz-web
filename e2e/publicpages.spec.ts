import { test, expect } from "@playwright/test";

// Pages qui ne lisent pas la BDD → testables sans projet Supabase.
test.describe("Pages publiques", () => {
  test("Le club : titre, en-tête, landmark principal et lien d'évitement", async ({ page }) => {
    await page.goto("/le-club");

    await expect(page).toHaveTitle(/Le club — XBZ Esport/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Bienvenue chez XBZ/i }),
    ).toBeVisible();

    // Accessibilité : lien d'évitement présent + landmark <main>.
    await expect(page.getByRole("link", { name: /Aller au contenu principal/i })).toBeAttached();
    await expect(page.locator("main#main")).toBeVisible();
  });

  test("Mentions légales : titre + canonical propre à la page", async ({ page }) => {
    await page.goto("/mentions-legales");

    await expect(page).toHaveTitle(/Mentions légales/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/mentions-legales$/,
    );
  });

  test("Support : la FAQ s'ouvre au clic (accordéon <details>)", async ({ page }) => {
    await page.goto("/support");

    const summary = page.locator("summary", { hasText: "Comment rejoindre XBZ ?" });
    await expect(summary).toBeVisible();

    // La réponse est repliée tant que le <details> est fermé.
    const answer = page.getByText(/Rends-toi sur la page Recrutement/i);
    await expect(answer).toBeHidden();

    await summary.click();
    await expect(answer).toBeVisible();
  });

  test("Support : le piège anti-spam (honeypot) est masqué aux lecteurs d'écran", async ({ page }) => {
    await page.goto("/support");
    // Le honeypot existe mais est enfermé dans un conteneur aria-hidden
    // (invisible pour un humain / lecteur d'écran ; seuls les bots le remplissent).
    const honeypot = page.locator('[aria-hidden="true"] input[name="website"]');
    await expect(honeypot).toBeAttached();
  });
});
