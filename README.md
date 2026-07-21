# XBZ Esport — site web

Site officiel de la structure esport **XBZ Esport** (Rocket League) : pages publiques
(présentation, équipes, recrutement, actualité, boutique, support) + un back-office
staff pour gérer les rosters, les joueurs et les pôles.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4**
- **Supabase** (Postgres + Auth + Storage) — données dynamiques et espace staff
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

1. `supabase/migration_rosters_joueurs_bdd.sql` — tables `rosters` + `joueurs`, RLS.
2. `supabase/migration_equipes_bdd.sql` — table `poles`, colonnes `capacity`/`recrute`,
   `joueurs.pole_id`, seed des pôles, et le **bucket Storage public `joueurs`** (photos).
3. `supabase/migration_equipes_review.sql` — colonne `poles.badge` + contrainte
   « roster XOR pôle » + `ON DELETE CASCADE`.

Tables attendues en plus (côté Supabase) pour l'espace staff :

- `allow_staff_list(email)` — liste blanche des e-mails autorisés au back-office.
- `candidatures` / `support_messages` — réceptacles des formulaires (écriture via service_role).

L'accès à `/admin` exige d'être connecté **et** présent dans `allow_staff_list`.

## Scripts

```bash
npm run dev      # développement
npm run build    # build de production
npm run start    # serveur de production
npm run lint     # ESLint
npx tsc --noEmit # vérification de types
```

L'intégration continue (`.github/workflows/xbz-web-ci.yml`) rejoue lint + typecheck + build
sur chaque push/PR — lance donc `npm run build` en local avant de pousser.

## Déploiement

Le site se déploie sur **Vercel**. Pense à y renseigner toutes les variables d'environnement
ci-dessus. `next.config.ts` autorise déjà les images Supabase Storage (`*.supabase.co`).
