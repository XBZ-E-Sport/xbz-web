import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Parcours de bout en bout qui LISENT/ÉCRIVENT en base (recrutement, support,
 * boutique, back-office). Ils nécessitent un vrai projet Supabase DE TEST + des
 * données seedées (un poste ouvert « XBZ Staff » nommé « Manager », un produit
 * `available` avec `url`, un utilisateur staff dans `allow_staff_list`, et les
 * tables `candidatures` / `support_messages`).
 *
 * Ils ne s'exécutent QUE si `E2E_STAFF_EMAIL` est présent (injecté par les
 * secrets CI). Sinon → skip : la CI et les runs « sans BDD » restent verts.
 */
const HAS_TEST_DB = Boolean(process.env.E2E_STAFF_EMAIL);

// Marqueurs des données créées par les tests → purgés en fin de suite.
const CANDIDATURE_NOM = "Test Candidat E2E";
const SUPPORT_NOM = "Test Support E2E";

test.describe("Parcours BDD", () => {
  test.beforeEach(() => {
    test.skip(!HAS_TEST_DB, "Supabase de test non configuré (E2E_STAFF_EMAIL absent).");
  });

  // Nettoyage : supprime les lignes de test via la clé service_role (contourne
  // la RLS). Idempotent, ciblé par marqueur → n'efface jamais de vraie donnée.
  test.afterAll(async () => {
    if (!HAS_TEST_DB) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return;
    const admin = createClient(url, key, { auth: { persistSession: false } });
    await admin.from("candidatures").delete().eq("nom", CANDIDATURE_NOM);
    await admin.from("support_messages").delete().eq("nom", SUPPORT_NOM);
  });

  test("Recrutement : une candidature Staff valide affiche le succès", async ({ page }) => {
    await page.goto("/recrutement");

    await page.locator("#rec-categorie").selectOption("XBZ Staff");
    await page.locator("#rec-role").selectOption("Manager"); // poste seedé
    await page.locator("#rec-nom").fill(CANDIDATURE_NOM);
    await page.locator("#rec-age").fill("20");
    await page.locator("#rec-pays1").fill("France");
    await page.locator("#rec-discord").fill("test_discord");
    await page.locator("#rec-pseudo").fill("test_pseudo");

    // Anti-spam serveur : un envoi de moins de 2 s est rejeté (bot).
    await page.waitForTimeout(2100);
    await page.getByRole("button", { name: /Envoyer ma candidature/i }).click();

    await expect(page.getByText(/Candidature envoyée avec succès/i)).toBeVisible();
  });

  test("Support : un message de contact valide affiche le succès", async ({ page }) => {
    await page.goto("/support");

    await page.locator("#support-nom").fill(SUPPORT_NOM);
    await page.locator("#support-email").fill("e2e-support@xbz.test");
    await page.locator("#support-sujet").selectOption("Général");
    await page
      .locator("#support-message")
      .fill("Message de test E2E pour vérifier l'envoi du formulaire de contact.");

    // Anti-spam serveur : un envoi de moins de 2 s est rejeté (bot).
    await page.waitForTimeout(2100);
    await page.getByRole("button", { name: /Envoyer le message/i }).click();

    await expect(page.getByText(/Message envoyé/i)).toBeVisible();
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
