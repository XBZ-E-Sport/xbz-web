# XBZ Esport — site web

Site officiel de la structure esport **XBZ Esport** (Rocket League) : pages publiques
(présentation, équipes, recrutement, actualité, boutique, support) + un back-office
staff pour gérer les candidatures, les rosters, les joueurs, les pôles, l'actualité
et la boutique.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4**
- **Supabase** (Postgres + Auth + Storage) — données dynamiques et espace staff
- **Vitest** + **Testing Library** (unitaires) · **Playwright** (E2E)
- **Vercel** (hébergement, cron, Web Analytics) · **Discord** (connexion staff, notifications)

## Sommaire

- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Base de données](#base-de-données-supabase)
- [Accès au back-office](#accès-au-back-office)
- [RGPD](#rgpd)
- [Monitoring](#monitoring)
- [Bot Discord](#bot-discord)
- [Scripts](#scripts)
- [Tests](#tests)
- [Intégration continue](#intégration-continue)
- [Sécurité](#sécurité)
- [Déploiement](#déploiement)
- [Pièges connus](#pièges-connus)

## Installation

Prérequis : **Node.js 22.x** et un projet **Supabase**.

```bash
npm install
cp .env.example .env.local   # puis renseigne les valeurs
npm run dev                  # http://localhost:3000
```

## Variables d'environnement

`.env.example` documente chaque variable : à quoi elle sert, si elle est obligatoire,
et **ce qui se passe quand elle est absente** (plusieurs ont un repli silencieux).

| Variable | Rôle | Absente → |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Domaine public (sitemap, canonicals, OG, JSON-LD) | repli sur le domaine par défaut |
| `NEXT_PUBLIC_DISCORD_URL` | Invitation Discord publique | les liens deviennent du texte |
| `NEXT_PUBLIC_MAIL` | Adresse de contact affichée | masquée |
| `NEXT_PUBLIC_SUPABASE_URL` | Projet Supabase | **le site ne démarre pas** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (lecture soumise à la RLS) | **idem** |
| `SUPABASE_SECRET_KEY` | Clé service_role — **serveur uniquement** | **idem** |
| `DISCORD_GUILD_ID` | Serveur Discord autorisé à la connexion staff | bouton Discord refusé (fail-safe) |
| `DISCORD_STAFF_ROLE_IDS` | Rôles autorisés, séparés par des virgules | idem |
| `BOT_RECRUTEMENT_URL` / `BOT_SUPPORT_URL` | Endpoints du bot Discord | formulaires OK, pas de notification |
| `BOT_SHARED_SECRET` | En-tête `x-xbz-secret` envoyé au bot | le bot n'exige rien |
| `CRON_SECRET` | Protège `/api/cron/purge` | **la purge refuse tout appel** |
| `DISCORD_ERROR_WEBHOOK_URL` | Salon d'alertes (erreurs serveur + navigateur) | erreurs seulement dans les logs |
| `E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD` | Compte staff pour les E2E | parcours BDD ignorés |

> ⚠️ Toute variable `NEXT_PUBLIC_*` part dans le **bundle navigateur** : jamais de secret.
> `SUPABASE_SECRET_KEY`, `BOT_SHARED_SECRET`, `CRON_SECRET` restent côté serveur.

Le test `src/lib/env.test.ts` échoue si une variable utilisée dans le code n'est pas
documentée dans `.env.example` (et inversement, pour les variables mortes).

## Base de données (Supabase)

Exécute les migrations dans **Supabase → SQL Editor**, **dans cet ordre** :

1. `migration_rosters_joueurs_20072026.sql` — tables `rosters` + `joueurs`, RLS.
2. `migration_equipes_20072026.sql` — table `poles`, `capacity`/`recrute`, `joueurs.pole_id`,
   seed des pôles, **bucket Storage public `joueurs`** (photos).
3. `migration_equipes_review_20072026.sql` — `poles.badge`, contrainte « roster XOR pôle »,
   `ON DELETE CASCADE`.
4. `migration_articles_21072026.sql` — table `articles` (actualité) + RLS + seed.
5. `migration_products_21072026.sql` — table `products` (boutique) + RLS + seed,
   **bucket Storage public `products`**.
6. `migration_ratelimit_21072026.sql` — table technique `rate_limit_hits` (anti-flood).
7. `migration_candidatures_nullable_21072026.sql` — rend nullables les colonnes facultatives
   de `candidatures`, pour qu'une candidature « XBZ Staff » (sans jeu) s'enregistre.
8. `migration_rgpd_retention_22072026.sql` — `consent_at` + `created_at` + index sur
   `candidatures` et `support_messages` (socle de la purge).
9. `migration_candidatures_roster_24072026.sql` — renomme `candidatures.rang` → `roster`
   (à ne pas confondre avec `joueurs.rang`, le vrai rang d'un joueur, inchangé).

**Rattrapage** : `migrations_a_passer_02082026.sql` regroupe les points 6, 8 et 9 plus un
`notify pgrst, 'reload schema'` et une requête de vérification. Idempotent — c'est le
fichier à passer sur un projet Supabase qui aurait pris du retard (dev, test ou prod).

Lecture publique via RLS (contenus actifs), écriture réservée au back-office
(service_role, aucune policy d'écriture).

### Tables gérées hors migrations

- `allow_staff_list(email)` — liste blanche d'accès au back-office.
- `candidatures` / `support_messages` — réceptacles des formulaires.

## Accès au back-office

Deux chemins mènent à `/admin`, **le premier suffit** :

1. **Rôle Discord.** À la connexion Discord, le site interroge l'API Discord avec le jeton
   OAuth de la personne (scope `guilds.members.read`) : elle doit être **membre du serveur
   XBZ** et porter l'un des rôles de `DISCORD_STAFF_ROLE_IDS` (Administrateur, Fondateur).
   Sinon la session est **révoquée immédiatement**. Le verdict est mémorisé dans
   `app_metadata` (champ que seule la clé service_role peut écrire) et vaut **7 jours**
   (`STAFF_TTL_DAYS`), après quoi une reconnexion revérifie le rôle.
2. **Allowlist email** — `allow_staff_list`, pour les comptes mot de passe.

Retirer un accès : enlever le rôle Discord (effectif à la prochaine connexion, au plus
tard sous 7 jours) et/ou supprimer la ligne dans `allow_staff_list`.

La garde vit dans `src/lib/adminguard.ts` (`requireStaff`) et sert **à la fois** au layout
`/admin` et à **chaque server action** — une server action est un endpoint POST joignable
directement, on ne se repose jamais sur le layout seul.

Sections du back-office : **Candidatures**, **Rosters & Joueurs**, **Pôles & Staff**,
**Actualité**, **Boutique**.

## RGPD

- **Consentement** obligatoire et horodaté (`consent_at`) sur les deux formulaires,
  revalidé côté serveur (422 sinon).
- **Conservation 24 mois** : `/api/cron/purge` supprime candidatures et messages plus
  anciens, plus les IP anti-flood de plus d'une heure. Déclenché par le cron Vercel
  (`vercel.json`, 3 h du matin) et protégé par `CRON_SECRET` — **sans ce secret, la route
  refuse tout appel** plutôt que d'exposer un endpoint de suppression ouvert.
- **Page `/confidentialite`** : données collectées (formulaires + IP anti-flood), finalités,
  bases légales (consentement / intérêt légitime), durées, destinataires, droits.

## Monitoring

Les erreurs **serveur** (`instrumentation.ts` → `onRequestError`) et **navigateur**
(`instrumentation-client.ts`, `global-error.tsx` → `/api/report-error`) partent vers
`DISCORD_ERROR_WEBHOOK_URL`. Anti-flood : une même signature d'erreur n'est envoyée
qu'une fois par minute. Le sink est isolé dans `src/lib/report-error.ts` — pour passer
à Sentry, seul le corps de `deliver()` change.

Le bot Discord utilise **le même webhook** : toutes les alertes, site et bot, arrivent
dans le même salon.

## Bot Discord

Dépôt séparé : **`XBZ-E-Sport/xbz-bot`**. Le site le notifie en arrière-plan (`after()`),
sans jamais bloquer la réponse à l'internaute ; si le bot est éteint, le formulaire
fonctionne quand même — la donnée est déjà en base.

| Site → bot | Contenu |
|---|---|
| `POST {BOT_RECRUTEMENT_URL}` | candidature complète + `id` BDD |
| `POST {BOT_SUPPORT_URL}` | message de support + `id` BDD |

Les deux requêtes portent l'en-tête `x-xbz-secret` (`BOT_SHARED_SECRET`), que le bot
vérifie. Côté Discord, les boutons ✅ / ❌ / 🟡 écrivent directement
`candidatures.statut` (`accepte` / `refuse` / `entretien`) — les mêmes valeurs que le
back-office.

## Scripts

```bash
npm run dev       # développement
npm run build     # build de production
npm run start     # serveur de production
npm run lint      # ESLint
npx tsc --noEmit  # vérification de types
npm test          # tests unitaires (Vitest)
npm run test:watch
npm run test:e2e  # end-to-end (Playwright)
```

## Tests

### Unitaires — Vitest (117 tests)

Logique pure et routes API : anti-spam, consentement, longueurs de champs, rate-limit,
métadonnées SEO, JSON-LD, contrôle d'accès staff, garde Discord, purge RGPD, remontée
d'erreurs, cohérence de `.env.example`. Les routes sont testées avec Supabase mocké
(`// @vitest-environment node`).

Les Server Components `async` ne sont pas couverts par Vitest (limite connue) — c'est le
rôle de l'E2E.

### End-to-end — Playwright

```bash
npx playwright install chromium   # une seule fois
npm run test:e2e
```

Les specs « sans BDD » (pages publiques, navigation, gating du back-office) tournent avec
des variables Supabase **factices**, sans aucun projet.

Les **parcours BDD** de `e2e/flows.spec.ts` (recrutement, support, boutique, connexion
staff) ne s'activent que si tout est réuni : identifiants staff, clé service, URL Supabase
réelle **et projet effectivement joignable** — un préambule fait un vrai aller-retour vers
la base. Sinon les tests sont ignorés avec la raison exacte, plutôt que d'échouer en
timeout. Pour les activer : un Supabase de test seedé (un poste « Manager » ouvert en
catégorie XBZ Staff, un produit `available` avec `url`, le compte staff dans
`allow_staff_list`) et les migrations à jour.

## Intégration continue

`.github/workflows/xbz-web-ci.yml`, sur **chaque push et chaque PR, toutes branches** :

- **job `build`** : `lint` → `tsc --noEmit` → `build` → tests unitaires ;
- **job `e2e`** : Chromium + Playwright.

Secrets attendus (GitHub › Settings › Secrets and variables › Actions) :
`TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`, `TEST_SUPABASE_SECRET_KEY`,
`E2E_STAFF_EMAIL`, `E2E_STAFF_PASSWORD`. Absents → les parcours BDD sont simplement ignorés.

Dependabot (`.github/dependabot.yml`) suit npm et les actions GitHub, hebdomadaire,
mineures et correctifs regroupés.

Lance `npm test && npx tsc --noEmit && npm run lint && npm run build` avant de pousser.

## Sécurité

- **CSP stricte** + `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS (`next.config.ts`). Aucun script tiers : les statistiques
  Vercel sont servies depuis le domaine du site.
- **`import "server-only"`** sur tout module portant la clé service_role : le build
  échoue si l'un d'eux est importé, même indirectement, par un composant client.
- **Formulaires** : honeypot, délai minimum de remplissage, rate-limit par IP,
  consentement, longueurs bornées côté serveur (`src/lib/limits.ts` — le `maxLength` du
  navigateur se contourne).
- **JSON-LD** échappé (`src/lib/jsonld.ts`) avant injection.
- **Pas de redirection ouverte** sur `/auth/callback?next=`.

### Dépendances

Deux CVE traînent dans les dépendances **internes** de Next (`postcss`, `sharp` bundlés),
neutralisées par le bloc `overrides` de `package.json` (`npm audit` → 0 vulnérabilité)
sans downgrader Next.

> ❌ Ne lance **jamais** `npm audit fix --force` : il tenterait d'installer `next@9.3.3`.

## Déploiement

Hébergement **Vercel**. À vérifier avant une mise en production :

1. toutes les variables ci-dessus dans **Project Settings → Environment Variables** ;
2. les **migrations passées sur le projet Supabase de prod** (une colonne manquante fait
   tomber les formulaires en 500) ;
3. dans **Supabase → Authentication → URL Configuration**, l'URL
   `https://<domaine>/auth/callback` en Redirect URL — sinon la connexion Discord échoue
   en production alors qu'elle marche en local ;
4. le cron `vercel.json` actif et `CRON_SECRET` défini.

`next.config.ts` autorise déjà les images Supabase Storage (`*.supabase.co`).

## Pièges connus

- **Les noms de fichiers de convention Next sont à la lettre près.** `globalerror.tsx`,
  `opengraphimage.tsx` ou `route.txt` ne sont pas reconnus : Next les ignore en silence,
  la fonctionnalité disparaît sans la moindre erreur. Les noms exacts sont
  `global-error.tsx`, `opengraph-image.tsx`, `route.ts`, `not-found.tsx`, `loading.tsx`.
- **Les server actions sont des endpoints POST publics.** Toujours appeler `requireStaff()`
  *dans* l'action, jamais se reposer sur le layout.
- **Le cache de schéma PostgREST.** Après une migration, une erreur
  « Could not find the column … in the schema cache » signifie que la colonne manque
  vraiment (ou que le cache n'a pas été rechargé : `notify pgrst, 'reload schema';`).
