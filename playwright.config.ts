import { defineConfig, devices } from "@playwright/test";

// Tests E2E : build + démarrage de l'app, puis pilotage d'un vrai navigateur.
//
// ⚠️ Le middleware Supabase s'exécute sur TOUTES les routes, et plusieurs pages
// lisent la BDD (accueil, équipes, boutique, recrutement…). Sans un vrai projet
// Supabase (variables d'env + données), ces pages renvoient 500. Les specs de
// `e2e/` ciblent donc volontairement les pages « sans BDD » (le-club, mentions
// légales, support, login) + le gating du back-office — elles passent sans base.
// Pour couvrir les parcours BDD, fournir un `.env` de test (Supabase de test)
// avant de lancer `npm run test:e2e`, puis ajouter les specs correspondantes.

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    // Page sans BDD : prête même sans projet Supabase (l'accueil, lui, lit la base).
    url: `${baseURL}/le-club`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
