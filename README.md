# XBZ Esport — site web

Site officiel de la structure esport **XBZ Esport** (Rocket League) : pages publiques
(présentation, équipes, recrutement, actualité, boutique, support) + un back-office
staff pour gérer les rosters, les joueurs, les pôles, l'actualité et la boutique.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4**
- **Supabase** (Postgres + Auth + Storage) — données dynamiques et espace staff
- **Vitest** + **Testing Library** (tests unitaires) · **Playwright** (E2E)
- Déploiement **Vercel**

## Prérequis

- Node.js **22.x**
- Un projet **Supabase**

## Installation

```bash
npm install
cp .env.example .env.local   # puis renseigne les valeurs
npm run dev                  # http://localhost:3000
```

## Variables d'environnement

Voir `.env.example`. Résumé :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL publique du site (OG, sitemap, JSON-LD) |
| `NEXT_PUBLIC_DISCORD_URL` | Lien d'invitation Discord |
| `NEXT_PUBLIC_MAIL` | Adresse de contact |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé anon/publishable (client, RLS) |
| `SUPABASE_SECRET_KEY` | Clé service_role — **serveur uniquement** |
| `BOT_RECRUTEMENT_URL` / `BOT_SUPPORT_URL` | Endpoints du bot Discord (notifs, optionnel) |
| `BOT_SHARED_SECRET` | Secret partagé envoyé au bot (en-tête `x-xbz-secret`) |

> ⚠️ `SUPABASE_SECRET_KEY` et `BOT_SHARED_SECRET` ne doivent jamais être exposés côté client
> ni committés. Sur Vercel, définis-les dans **Project Settings → Environment Variables**.

## Base de données (Supabase)

Exécute les migrations dans **Supabase → SQL Editor**, **dans cet ordre** :

1. `supabase/migration_rosters_joueurs_20072026.sql` — tables `rosters` + `joueurs`, RLS.
2. `supabase/migration_equipes_20072026.sql` — table `poles`, colonnes `capacity`/`recrute`,
   `joueurs.pole_id`, seed des pôles, et le **bucket Storage public `joueurs`** (photos).
3. `supabase/migration_equipes_review_20072026.sql` — colonne `poles.badge` + contrainte
   « roster XOR pôle » + `ON DELETE CASCADE`.
4. `supabase/migration_articles_bdd.sql` — table `articles` (actualité) + RLS + seed.
5. `supabase/migration_products_21072026.sql` — table `products` (boutique) + RLS + seed,
   et le **bucket Storage public `products`** (visuels).
6. `supabase/migration_ratelimit_21072026.sql` — table technique `rate_limit_hits`
   (anti-flood des formulaires, écrite/lue via service_role uniquement).

Toutes ces tables sont en **lecture publique via RLS** (produits/articles/rosters… actifs)
et en **écriture réservée au back-office** (service_role, aucune policy d'écriture).

### Tables gérées hors migrations (côté Supabase)

- `allow_staff_list(email)` — liste blanche des e-mails autorisés au back-office.
- `candidatures` / `support_messages` — réceptacles des formulaires (écriture via service_role).

Une fois la table `candidatures` en place, applique le correctif :

- `supabase/migration_candidatures_nullable_21072026.sql` — rend nullables les colonnes
  facultatives de `candidatures` (`jeu`, `pays_residence`, `rltracker`, `rang`, `experience`,
  `motivation`), pour qu'une candidature « XBZ Staff » (sans jeu) puisse s'enregistrer.

L'accès à `/admin` exige d'être connecté **et** présent dans `allow_staff_list`.
Sections du back-office : **Candidatures**, **Rosters & Joueurs**, **Pôles & Staff**,
**Actualité**, **Boutique**.

## Scripts

```bash
npm run dev       # développement
npm run build     # build de production
npm run start     # serveur de production
npm run lint      # ESLint
npx tsc --noEmit  # vérification de types
npm test          # tests unitaires (Vitest)
npm run test:e2e  # tests end-to-end (Playwright)
```

## Tests

### Unitaires — Vitest + Testing Library

Logique pure (anti-spam, rate-limit, métadonnées SEO, formatage) + composants client
synchrones. Les Server Components `async` ne sont pas couverts par Vitest (limite connue) —
c'est le rôle de l'E2E.

```bash
npm test          # une passe
npm run test:watch
```

### End-to-end — Playwright

Le harnais build + démarre l'app et pilote un vrai navigateur.

```bash
npx playwright install chromium   # une seule fois (récupère le navigateur)
npm run test:e2e
```

> ⚠️ Le middleware Supabase s'exécute sur **toutes** les routes, et plusieurs pages
> lisent la base (accueil, équipes, boutique, recrutement…). Les specs de `e2e/` ciblent
> donc les **pages sans BDD** + le gating du back-office — elles passent avec de simples
> variables Supabase **factices** (aucun projet requis). Les parcours BDD (recrutement,
> boutique, connexion staff) sont scaffoldés dans `e2e/flows.spec.ts` en `test.fixme`
> (ignorés) : pour les activer, branche un **Supabase de test** (env réel + données
> seedées) et retire les `.fixme`.

## Intégration continue

`.github/workflows/xbz-web-ci.yml` rejoue sur chaque push/PR (toutes branches) :

- **job `build`** : `lint` + `tsc --noEmit` + `build` + tests unitaires ;
- **job `e2e`** : installe Chromium et lance Playwright avec des variables Supabase
  factices (les specs « sans BDD »).

Lance donc `npm run build` et `npm test` en local avant de pousser.

## Sécurité des dépendances

Deux CVE traînent dans les dépendances **internes** de Next (`postcss`, `sharp` bundlés).
Elles sont neutralisées via un bloc `overrides` dans `package.json` qui force des versions
patchées dans tout l'arbre (`npm audit` → 0 vulnérabilité), **sans downgrader Next**.

> ❌ Ne lance **jamais** `npm audit fix --force` : il tenterait d'installer `next@9.3.3`
> (retour à Next 9), ce qui casserait toute l'app.

## Déploiement

Le site se déploie sur **Vercel**. Pense à y renseigner toutes les variables d'environnement
ci-dessus. `next.config.ts` autorise déjà les images Supabase Storage (`*.supabase.co`).
