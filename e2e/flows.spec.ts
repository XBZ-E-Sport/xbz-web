import { test, expect } from "@playwright/test";

/**
 * Parcours de bout en bout qui LISENT/ÉCRIVENT en base (recrutement, boutique,
 * back-office). Ils nécessitent un vrai projet Supabase DE TEST + des données
 * seedées (un poste ouvert « XBZ Staff » nommé « Manager », un produit
 * `available` avec `url`, un utilisateur staff dans `allow_staff_list`).
 *
 * Ils ne s'exécutent QUE si `E2E_STAFF_EMAIL` est présent (injecté par les
 * secrets CI). Sinon → skip : la CI et les runs locaux « sans BDD » restent
 * verts sans projet de test.
 */
const HAS_TEST_DB = Boolean(process.env.E2E_STAFF_EMAIL);

test.describe("Parcours BDD", () => {
  test.beforeEach(() => {
    test.skip(!HAS_TEST_DB, "Supabase de test non configuré (E2E_STAFF_EMAIL absent).");
  });

  test("Recrutement : une candidature Staff valide affiche le succès", async ({ page }) => {
    await page.goto("/recrutement");

    await page.locator("#rec-categorie").selectOption("XBZ Staff");
    await page.locator("#rec-role").selectOption("Manager"); // poste seedé
    await page.locator("#rec-nom").fill("Test Candidat E2E");
    await page.locator("#rec-age").fill("20");
    await page.locator("#rec-pays1").fill("France");
    await page.locator("#rec-discord").fill("test_discord");
    await page.locator("#rec-pseudo").fill("test_pseudo");

    // Anti-spam serveur : un envoi de moins de 2 s est rejeté (bot).
    await page.waitForTimeout(2100);
    await page.getByRole("button", { name: /Envoyer ma candidature/i }).click();

    await expect(page.getByText(/Candidature envoyée avec succès/i)).toBeVisible();
  });

  test("Boutique : un produit achetable avec lien affiche « Acheter »", async ({ page }) => {
    await page.goto("/boutique");

    const acheter = page.getByRole("link", { name: /^Acheter/ }).first();
    await expect(acheter).toBeVisible();
    await expect(acheter).toHaveAttribute("href", /^https?:\/\//);
  });

  test("Back-office : connexion staff puis accès aux candidatures", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#login-email").fill(process.env.E2E_STAFF_EMAIL ?? "");
    await page.locator("#login-password").fill(process.env.E2E_STAFF_PASSWORD ?? "");
    await page.getByRole("button", { name: /Se connecter$/ }).click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /Back-office XBZ/i })).toBeVisible();
  });
});
