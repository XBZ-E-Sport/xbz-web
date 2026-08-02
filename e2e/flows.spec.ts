import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Parcours de bout en bout qui LISENT/ÉCRIVENT en base (recrutement, support,
 * boutique, back-office). Ils nécessitent un vrai projet Supabase DE TEST + des
 * données seedées (un poste ouvert « XBZ Staff » nommé « Manager », un produit
 * `available` avec `url`, un utilisateur staff dans `allow_staff_list`, et les
 * tables `candidatures` / `support_messages`).
 *
 * Ils ne s'exécutent QUE si TOUT est réuni : identifiants staff, clé service,
 * URL Supabase réelle, ET projet effectivement joignable (voir le préambule
 * ci-dessous). Sinon → skip explicite.
 *
 * Pourquoi ce niveau de prudence : ne tester que la présence de
 * `E2E_STAFF_EMAIL` suffisait à activer ces parcours alors que la base
 * pointait sur un placeholder ou un projet en pause — la CI passait alors 3
 * minutes à échouer sur des `TypeError: fetch failed` illisibles.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

const HAS_CREDENTIALS =
  Boolean(process.env.E2E_STAFF_EMAIL) &&
  Boolean(process.env.E2E_STAFF_PASSWORD) &&
  Boolean(SERVICE_KEY) &&
  /^https:\/\/.+\.supabase\.co/i.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes("placeholder");

// Renseigné par le préambule : la base répond-elle vraiment ?
let dbReachable = false;
let unreachableReason = "";

// Marqueurs des données créées par les tests → purgés en fin de suite.
const CANDIDATURE_NOM = "Test Candidat E2E";
const SUPPORT_NOM = "Test Support E2E";

test.describe("Parcours BDD", () => {
  // Préambule : un aller-retour réel vers Supabase. Un projet supprimé ou mis
  // en pause (le plan gratuit met en veille après quelques jours d'inactivité)
  // est ainsi diagnostiqué en une seconde, au lieu de faire tomber chaque test
  // en timeout.
  test.beforeAll(async () => {
    if (!HAS_CREDENTIALS) return;
    try {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      const { error } = await admin.from("rosters").select("slug").limit(1);
      dbReachable = !error;
      unreachableReason = error?.message ?? "";
    } catch (e) {
      unreachableReason = e instanceof Error ? e.message : String(e);
    }
    if (!dbReachable) {
      console.warn(`[e2e] Supabase de test injoignable (${unreachableReason}) — parcours BDD ignorés.`);
    }
  });

  test.beforeEach(() => {
    test.skip(
      !HAS_CREDENTIALS,
      "Supabase de test non configuré (E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD / SUPABASE_SECRET_KEY / URL réelle).",
    );
    test.skip(!dbReachable, `Supabase de test injoignable : ${unreachableReason}`);
  });

  // Nettoyage : supprime les lignes de test via la clé service_role (contourne
  // la RLS). Idempotent, ciblé par marqueur → n'efface jamais de vraie donnée.
  test.afterAll(async () => {
    if (!dbReachable) return; // rien n'a été créé, rien à nettoyer
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
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
    await page.locator("#rec-consent").check(); // consentement RGPD obligatoire

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
    await page.locator("#support-consent").check(); // consentement RGPD obligatoire

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
