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

  test("CGV : l'encadré officiel des garanties légales est affiché, dans les deux langues", async ({ page }) => {
    // Modèle annexé à l'article D. 211-2 du Code de la consommation (décret 2022-946) :
    // une CGV de vente de biens qui ne l'affiche pas est non conforme.
    await page.goto("/fr/cgv");
    const fr = page.locator('section[aria-labelledby="garanties"]');
    await expect(fr.getByText("Rappel des garanties légales")).toBeVisible();
    await expect(fr).toContainText("Le consommateur dispose d'un délai de deux ans à compter de la délivrance du bien");
    await expect(fr).toContainText("articles 1641 à 1649 du code civil");

    await page.goto("/en/cgv");
    const en = page.locator('section[aria-labelledby="garanties"]');
    await expect(en.getByText("Reminder of the legal guarantees")).toBeVisible();
    await expect(en).toContainText("The consumer has a period of two years from delivery of the goods");
    await expect(en).toContainText("The French text prevails");
  });

  test("Rétractation : lien dans le pied de page, deux étapes, rien n'est envoyé avant « Confirmer la rétractation »", async ({ page }) => {
    // Fonction « Renoncer au contrat ici » (obligatoire depuis le 19 juin 2026) : visible en
    // permanence — ici depuis une page sans lien avec la boutique.
    await page.goto("/fr/le-club");
    await page.getByRole("contentinfo").getByRole("link", { name: "Renoncer au contrat ici" }).click();
    await expect(page).toHaveURL(/\/fr\/boutique\/retractation$/);
    await expect(page.getByRole("heading", { level: 1, name: /Droit de rétractation/i })).toBeVisible();

    // Aucun appel au serveur tant que le client n'a pas confirmé.
    const posts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/boutique/retractation")) posts.push(req.url());
    });

    await page.getByLabel("Nom et prénom").fill("Jeanne Martin");
    await page.getByLabel(/E-mail utilisé pour la commande/).fill("jeanne@exemple.fr");
    await page.getByRole("button", { name: "Renoncer au contrat ici" }).click();

    await expect(page.getByRole("heading", { name: "Vérifie ta déclaration" })).toBeVisible();
    await expect(page.getByText("Jeanne Martin")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmer la rétractation" })).toBeVisible();
    expect(posts).toHaveLength(0);

    // « Modifier » ramène au formulaire, valeurs conservées.
    await page.getByRole("button", { name: "Modifier" }).click();
    await expect(page.getByLabel("Nom et prénom")).toHaveValue("Jeanne Martin");

    await page.goto("/en/boutique/retractation");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Withdraw from contract here" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw from contract here" })).toBeVisible();
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
