import { test, expect } from "@playwright/test";

test("navigation : Le club → Support via la carte « Explorer »", async ({ page }) => {
  await page.goto("/le-club");

  // La carte Support du contenu principal (on évite les liens BDD qui, sans
  // Supabase, renverraient 500).
  await page.locator("main").getByRole("link", { name: /Support/i }).first().click();

  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole("heading", { level: 1, name: /Besoin d.aide/i })).toBeVisible();
});
