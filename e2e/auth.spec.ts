import { test, expect } from "@playwright/test";

test("le back-office redirige un visiteur non connecté vers /login", async ({ page }) => {
  await page.goto("/admin");

  // Le layout /admin exige une session : sans utilisateur → redirection /login.
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { level: 1, name: /Espace staff/i })).toBeVisible();
  await expect(page.locator("#login-email")).toBeVisible();
});
