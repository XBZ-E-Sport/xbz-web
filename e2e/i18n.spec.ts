import { test, expect } from "@playwright/test";

// Pages sans lecture BDD → testables sans projet Supabase.
test.describe("Langues", () => {
  test("les anciennes URL sans préfixe redirigent en permanent vers /fr", async ({ request }) => {
    // 308 et pas 307 : l'ajout du préfixe est définitif, Google doit transférer
    // le référencement acquis au lieu de garder l'ancienne URL indexée.
    const res = await request.get("/le-club", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toMatch(/\/fr\/le-club$/);
  });

  test("la même page existe dans les deux langues", async ({ page }) => {
    await page.goto("/fr/le-club");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Bienvenue chez XBZ/i);

    await page.goto("/en/le-club");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Welcome to XBZ/i);
  });

  test("le sélecteur bascule la langue en gardant la page", async ({ page }) => {
    await page.goto("/fr/mentions-legales");

    await page.getByRole("button", { name: /English/i }).click();

    await expect(page).toHaveURL(/\/en\/mentions-legales$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Legal notice/i);

    // Et retour : la bascule doit marcher dans les deux sens.
    await page.getByRole("button", { name: /Français/i }).click();
    await expect(page).toHaveURL(/\/fr\/mentions-legales$/);
  });

  test("chaque langue déclare l'autre en hreflang", async ({ page }) => {
    await page.goto("/fr/mentions-legales");

    await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute(
      "href",
      /\/fr\/mentions-legales$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      "href",
      /\/en\/mentions-legales$/,
    );
    // Le canonical d'une page anglaise pointe sur elle-même, pas sur le français.
    await page.goto("/en/mentions-legales");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/en\/mentions-legales$/,
    );
  });

  test("une page anglaise ne contient aucun lien vers le français", async ({ page }) => {
    // Filet le plus large : il couvre la page ET la coquille (en-tête, pied de
    // page). Un composant serveur qui oublie la langue produit exactement ça —
    // des liens `/fr/…` sur une page anglaise, sans aucune erreur visible.
    // Toutes ces pages sont prérendues au build, là où le piège se referme.
    for (const path of [
      "/en/le-club",
      "/en/support",
      "/en/mentions-legales",
      "/en/confidentialite",
      // Passées en ISR : elles sont désormais générées au build, elles aussi.
      "/en",
      "/en/equipes",
      "/en/actualite",
      "/en/boutique",
      "/en/presentation",
      "/en/recrutement",
    ]) {
      await page.goto(path);
      const hrefs = await page.locator('a[href^="/fr/"]').evaluateAll((links) =>
        links.map((l) => l.getAttribute("href")),
      );
      expect(hrefs, `liens français trouvés sur ${path}`).toEqual([]);
    }
  });

  test("les formulaires eux-mêmes sont traduits, pas seulement la page", async ({ page }) => {
    // La page de support est prérendue au build, mais son formulaire est un
    // composant client : il est traduit par le fournisseur, pas par la page.
    // Une coquille anglaise autour d'un formulaire français ne casse rien —
    // aucune erreur au build, aucune au runtime — et se voit seulement à l'œil.
    await page.goto("/en/support");
    await expect(page.getByRole("button", { name: "Send the message" })).toBeVisible();
    await expect(page.getByLabel("Name / Username")).toBeVisible();

    await page.goto("/fr/support");
    await expect(page.getByRole("button", { name: "Envoyer le message" })).toBeVisible();
  });

  test("la redirection des URL nues ne dépend pas du visiteur", async ({ page }) => {
    // Après une bascule en anglais, `/support` mène quand même à `/fr/support`.
    // C'est voulu : une redirection permanente qui varierait selon le cookie
    // serait incachable par le CDN, et Google recevrait tantôt le français
    // tantôt l'anglais sur la même URL. La langue se choisit par l'URL ou par
    // le sélecteur — jamais par une devinette sur une redirection 308.
    await page.goto("/fr/le-club");
    await page.getByRole("button", { name: /English/i }).click();
    await expect(page).toHaveURL(/\/en\/le-club$/);

    await page.goto("/support");
    await expect(page).toHaveURL(/\/fr\/support$/);
  });
});
