# XBZ Esport — site web

Site officiel de la structure esport **XBZ Esport** (Rocket League) : pages publiques
(présentation, équipes, recrutement, actualité, boutique, support) **en français et en
anglais**, + un back-office staff pour gérer les candidatures, les rosters, les joueurs,
les pôles, l'actualité et la boutique.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4**
- **next-intl** — site bilingue français / anglais
- **Supabase** (Postgres + Auth + Storage) — données dynamiques et espace staff
- **Vitest** + **Testing Library** (unitaires) · **Playwright** (E2E)
- **Vercel** (hébergement, cron, Web Analytics) · **Discord** (connexion staff, notifications)

## Sommaire

- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Langues (i18n)](#langues-i18n)
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
| `NEXT_PUBLIC_SUPABASE_URL` | Projet Supabase | **le site ne démarre pas** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (lecture soumise à la RLS) | **idem** |
| `SUPABASE_SECRET_KEY` | Clé service_role — **serveur uniquement** | **idem** |
| `DISCORD_GUILD_ID` | Serveur Discord autorisé à la connexion staff | bouton Discord refusé (fail-safe) |
| `DISCORD_STAFF_ROLE_IDS` | Rôles autorisés, séparés par des virgules | idem |
| `BOT_RECRUTEMENT_URL` / `BOT_SUPPORT_URL` | Endpoints du bot Discord | formulaires OK, pas de notification |
| `BOT_SHARED_SECRET` | En-tête `x-xbz-secret` envoyé au bot | le bot n'exige rien |
| `CRON_SECRET` | Protège `/api/cron/purge` | **la purge refuse tout appel** |
| `DISCORD_ERROR_WEBHOOK_URL` | Salon d'alertes (erreurs serveur + navigateur) | erreurs seulement dans les logs |
| `BREVO_API_KEY` / `MAIL_FROM_EMAIL` | E-mail des accusés de réception de rétractation (Brevo) | accusé non envoyé ; **paiement live refusé** |
| `MAIL_FROM_NAME` | Nom affiché de l'expéditeur | « XBZ Esport » |
| `E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD` | Compte staff pour les E2E | parcours BDD ignorés |

> ⚠️ Toute variable `NEXT_PUBLIC_*` part dans le **bundle navigateur** : jamais de secret.
> `SUPABASE_SECRET_KEY`, `BOT_SHARED_SECRET`, `CRON_SECRET` restent côté serveur.

Le test `src/lib/env.test.ts` échoue si une variable utilisée dans le code n'est pas
documentée dans `.env.example` (et inversement, pour les variables mortes).

## Langues (i18n)

Le site existe en **français** et en **anglais**, via [next-intl](https://next-intl.dev).

### URL

Chaque page porte sa langue : `/fr/equipes`, `/en/equipes`. Une URL sans préfixe
(`/equipes`) est redirigée en **308 permanent** vers `/fr/…` — les liens partagés avant
la mise en place des langues continuent de fonctionner et Google transfère le
référencement acquis.

Cette redirection est **volontairement indépendante du visiteur** : ni `Accept-Language`
ni le cookie de langue ne la font varier. Une redirection permanente qui changerait de
cible selon la personne serait incachable par le CDN, et Google recevrait tantôt le
français tantôt l'anglais sur la même adresse. La langue se choisit par l'URL ou par le
sélecteur du menu ; le cookie `XBZ_LOCALE` ne sert qu'à mémoriser ce choix.

### Où vivent les textes

- `messages/fr.json` et `messages/en.json` — **tout** le texte de l'interface publique,
  organisé par page (`home`, `leClub`, `equipes`, `boutique`, `support`…).
- Le **contenu de la base** a sa propre traduction, en colonnes `_en` : voir
  [Contenu de la base](#contenu-de-la-base).
- Le **back-office n'est pas traduit** (staff francophone).
- `src/app/global-error.tsx` reste en français : il remplace le layout quand tout a déjà
  échoué, donc hors du fournisseur de traductions.

### Contenu de la base

Chaque champ traduisible garde sa colonne d'origine (français) et reçoit une colonne
jumelle `_en` — 11 colonnes au total, créées par
`supabase/migration_i18n_contenu_03082026.sql` :

| Table      | Colonnes traduites                          |
| ---------- | ------------------------------------------- |
| `articles` | `title_en`, `excerpt_en`, `content_en`      |
| `products` | `name_en`, `description_en`                 |
| `rosters`  | `description_en`                            |
| `poles`    | `name_en`, `description_en`, `badge_en`     |
| `joueurs`  | `bio_en`, `palmares_en`                     |

**Les traductions sont facultatives.** Une colonne `_en` vide fait afficher le français
sur `/en` — un contenu non traduit reste lisible plutôt que de laisser un blanc. On peut
donc passer la migration et déployer sans rien avoir traduit, puis traduire au fil de
l'eau depuis le back-office (repli « Version anglaise » sous chaque formulaire).

Le repli est **champ par champ** pour le texte, mais **liste entière** pour les tableaux
(`content_en`, `palmares_en`) : un palmarès à moitié traduit mélangerait les deux langues
dans un même bloc.

Trois champs sont traduits **sans aucune saisie**, parce qu'ils sont dérivables :

- `joueurs.pays` — dérivé de `pays_code` (ISO) via `Intl.DisplayNames`, donc correct dans
  n'importe quelle langue. Le champ libre `pays` ne sert que de repli.
- `joueurs.role` et les catégories (`articles.category`, `products.category`) — listes
  fermées, traduites dans `messages/*.json` (`playerRoles`, `articleCategories`,
  `productCategories`).

Ne sont volontairement **pas** traduits : les noms propres (`rosters.name`, `joueurs.pseudo`,
`joueurs.nom`, `articles.author`) et les termes du jeu (`rank`, `rang` : « Supersonic
Legend » se dit pareil).

La langue est résolue **dans la couche data** (`src/lib/actualite.ts`, `boutique.ts`,
`roster.ts`, `equipes.ts`) : les composants reçoivent un objet déjà dans la bonne langue
et ne savent rien des colonnes `_en`. Le cache, lui, reste bilingue — une seule entrée
sert `/fr` et `/en`.

⚠️ **La migration doit passer AVANT ou AVEC le déploiement.** Les requêtes nomment les
colonnes `_en` explicitement : sur une base non migrée, PostgREST renvoie une erreur et la
page se vide. `src/lib/i18ncolumns.test.ts` vérifie que chaque colonne de la migration est
bien lue par le site, écrite par le back-office, et présente dans un formulaire.

### Ajouter une chaîne

1. Ajouter la clé dans `messages/fr.json` **et** `messages/en.json`.
2. La lire avec `getTranslations` (serveur) ou `useTranslations` (client).

`src/i18n/messages.test.ts` échoue si une clé manque d'un côté, si une traduction est
vide, ou si les variables ICU (`{count}`) et les balises de texte riche (`<game>`) ne
correspondent pas entre les deux langues.

### ⚠️ Pages prérendues (`force-static`)

`le-club`, `support`, `mentions-legales` et `confidentialite` sont générées au build,
dans les deux langues. Dans ce mode il n'y a **pas de requête**, donc pas de langue
« ambiante » : `getTranslations()` sans argument et `useTranslations()` retombent
silencieusement sur le français, et la page anglaise part en ligne en français — sans
aucune erreur. Sur ces pages, il faut donc :

- `getTranslations({ locale, namespace })` — jamais la forme courte ;
- `<Link locale={locale}>` — sinon les liens pointent vers `/fr/…` ;
- pas de `useTranslations()` dans la page ni dans ses composants serveur.

`src/i18n/staticpages.test.ts` vérifie ces trois règles et échoue sinon.

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

Boutique en ligne (voir [Boutique](#boutique-stripe)), **avant** de déployer le code
correspondant :

- `migration_boutique_stripe_01102026.sql` — tailles et stock (`product_variants`),
  commandes (`orders`) et fonctions de réservation du stock.
- `migration_pages_produit_02102026.sql` — photos supplémentaires et guide des tailles.
- `migration_export_commandes_03102026.sql` — `orders.refunded_amount` (montant remboursé,
  pour l'export comptable). Le code fonctionne avant cette migration.
- `migration_retractation_05102026.sql` — `order_withdrawals` (déclarations de rétractation
  en ligne). **À passer AVANT de déployer** : sans elle, la fonction « Renoncer au contrat
  ici » répond « envoi impossible ».
- `migration_personnalisation_05102026.sql` — personnalisation nom et numéro d'un article
  (`products.personalizable`, `products.personalization_price`) et nouvelle version des
  fonctions de réservation / restitution du stock. **À passer AVANT de déployer** ; sans elle
  le site fonctionne, la personnalisation reste simplement invisible.

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
   `app_metadata` (champ que seule la clé service_role peut écrire) et vaut **1 jour**
   (`STAFF_TTL_DAYS`), après quoi une reconnexion revérifie le rôle (« Session staff
   expirée : reconnecte-toi avec Discord »).
2. **Allowlist email** — `allow_staff_list`, pour les comptes mot de passe, et
   seulement si l'email du compte est **confirmé** (`email_confirmed_at`). Garder
   « Confirm email » activé dans Supabase (Authentication → Providers → Email) :
   sinon Supabase confirme d'office toute inscription, et ouvrir un compte à
   l'adresse d'un membre listé suffirait à hériter de son accès.

Retirer un accès : enlever le rôle Discord (effectif à la prochaine connexion, au plus
tard sous 1 jour) et/ou supprimer la ligne dans `allow_staff_list` — puis **supprimer le
compte** dans Supabase (Authentication › Users), faute de quoi ses données de connexion
(identifiant, pseudo, e-mail) restent chez nous. Un refus définitif à la connexion Discord
(`not_member` / `missing_role`) supprime, lui, le compte d'un inconnu automatiquement ;
jamais celui d'un compte e-mail + mot de passe ni d'une adresse de `allow_staff_list`.

La garde vit dans `src/lib/adminguard.ts` (`requireStaff`) et sert **à la fois** au layout
`/admin` et à **chaque server action** — une server action est un endpoint POST joignable
directement, on ne se repose jamais sur le layout seul.

Sections du back-office : **Candidatures**, **Rosters & Joueurs**, **Pôles & Staff**,
**Actualité**, **Boutique**, **Commandes**.

## Boutique (Stripe)

Paiement sur la page **Stripe Checkout** hébergée : aucune clé n'atteint le navigateur.
Sans `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`, la boutique reste un aperçu
(« Bientôt disponible ») : déployer avant de les renseigner ne risque rien.

> **Avant de passer en clé live (`sk_live_…`)** : le paiement est **refusé** (503, la boutique
> affiche « bientôt ») tant que `liveBlockers()` n'est pas vide — la liste exacte de ce qui
> manque est écrite dans les journaux Vercel (`[boutique] paiement live refusé : …`). Il
> faut : un **médiateur** (`LEGAL.mediator`), un **téléphone** (`LEGAL.phone`, articles
> R.111-1 et D.211-1), la **rétractation en ligne** (`LEGAL.onlineWithdrawal`, obligatoire
> depuis le 19 juin 2026), l'**envoi d'e-mails** configuré (`BREVO_API_KEY` et
> `MAIL_FROM_EMAIL`) et la **migration** `migration_retractation_05102026.sql` passée.
> La clé de test n'est pas concernée.
>
> **L'encadré des garanties légales** des CGV (`cgv.garantiesEncadre`) est le modèle
> officiel du décret n° 2022-946, annexe I-A : ne jamais le reformuler. Un test en
> verrouille l'empreinte ; ne la recalculer qu'après avoir recopié un nouveau modèle.

- **Personnalisation nom et numéro** (ex. maillot) : un **interrupteur par produit**, éteint
  par défaut — Back-office → Boutique → Modifier → « Personnalisation nom et numéro » (case
  + supplément en € TTC par pièce personnalisée). Éteint, rien n'est proposé ni accepté :
  les articles déjà au panier avec un texte sont signalés « indisponibles ». Allumé, la
  fiche produit propose nom (12 lettres au plus, majuscules) et/ou numéro (0 à 99), avec
  l'accord du client sur l'exclusion de la rétractation (article L.221-28, 3° du Code de la
  consommation). Le texte voyage dans le panier, est **revalidé et prix recalculé en base**
  (supplément compris dans le prix unitaire payé), imprimé en description sur la page
  Stripe, affiché en évidence dans les commandes du back-office et dans l'export.
  Une taille, plusieurs textes = plusieurs lignes ; le stock se compte **par taille**.
  Règles dans `src/lib/personalization.ts`, mêmes bornes dans la base.
- **Stock réservé 32 minutes** au départ vers Stripe, confirmé par le **webhook** signé
  (`/api/stripe/webhook`), rendu si le paiement est abandonné. Le prix fait toujours
  autorité côté base. Détail du parcours : `src/lib/shop.ts`.
- **Webhook Stripe** — endpoint `https://www.xbz-esport.org/api/stripe/webhook`, cinq
  événements : `checkout.session.completed`, `…async_payment_succeeded`,
  `…async_payment_failed`, `checkout.session.expired`, `charge.refunded`. Un secret
  différent par mode (test / live).
- **Remboursements** : faits depuis Stripe, la commande passe seule en « Remboursée »
  (total) ou reçoit une note (partiel) ; le montant est gardé. Le stock n'est pas remis
  automatiquement : un colis remboursé n'est pas forcément revenu.
- **Rétractation en ligne** (obligatoire depuis le 19 juin 2026, directive 2023/2673 et
  art. L.221-21 du Code de la consommation) — lien « Renoncer au contrat ici » dans le pied
  de **chaque** page, sur la page de confirmation de commande et dans les CGV. Parcours :
  page `/boutique/retractation` → le client donne nom, e-mail de la commande (numéro de
  commande facultatif) → relit → « Confirmer la rétractation » → route
  `api/boutique/retractation`. Toute déclaration valide est **enregistrée** (même si la
  commande n'est pas retrouvée : `match` = `exact` / `single` / `ambiguous` / `none`),
  horodatée par le serveur, puis l'**accusé de réception** part par e-mail (contenu de la
  déclaration + date et heure). Un échec d'envoi est noté (`ack_error`) et le cron
  quotidien réessaie ; le staff est prévenu sur Discord (sans donnée personnelle) et
  traite l'onglet **Commandes › Rétractations** (rattacher une commande, renvoyer
  l'accusé, marquer traitée). Plafond : 3 accusés par adresse et par jour (anti-spam
  par e-mail) — au-delà, la déclaration est gardée, seul l'envoi automatique est suspendu.
  Code : `src/lib/withdrawal.ts` (logique pure), `withdrawal-server.ts` (envoi, alerte,
  filet), `mailer.ts` (Brevo).
- **Mise en service de la rétractation en ligne** — dans cet ORDRE (aucune étape ne se
  fait avant la précédente) :
  1. Appliquer le lot, puis dans Supabase › SQL Editor exécuter
     `supabase/migration_retractation_05102026.sql` (rejouable), et vérifier avec
     `select to_regclass('public.order_withdrawals');` (doit répondre le nom de la table).
  2. **Brevo** (compte gratuit, 300 e-mails/jour) : ajouter le domaine `xbz-esport.com` et
     créer chez l'hébergeur DNS les enregistrements que Brevo affiche — **code Brevo (TXT),
     DKIM, DMARC (TXT)**. Ne pas toucher aux MX ni au SPF de Google, et **ne jamais créer un
     second enregistrement SPF** (un domaine n'en a qu'un) ; si un `_dmarc` existe déjà, le
     modifier au lieu d'en ajouter un. Attendre « domaine authentifié ».
  3. **Brevo › Sécurité › Adresses IP autorisées : désactiver le blocage.** Vercel n'a pas
     d'IP de sortie fixe : sinon Brevo répond **401 « unrecognised IP address »** à chaque
     envoi (visible dans `ack_error` et dans l'alerte Discord).
  4. Brevo › Expéditeurs : ajouter `support@xbz-esport.com` (un code arrive dans cette boîte
     Google), puis **SMTP & API › Clés API** : créer une clé. Un compte Brevo neuf peut devoir
     être activé par leur support avant d'envoyer.
  5. Vercel › Settings › Environment Variables, environnement **Production** :
     `BREVO_API_KEY`, `MAIL_FROM_EMAIL=support@xbz-esport.com` (même domaine que celui
     authentifié), `DISCORD_COMMANDES_WEBHOOK_URL` (sans lui, aucune alerte du staff) et
     `CRON_SECRET` (sans lui, le filet quotidien ne tourne jamais). **Puis redéployer.**
  6. **Test, avec la clé Stripe de test** : faire une déclaration avec sa propre adresse
     (3 accusés par boîte et par jour au plus). Vérifier : l'accusé arrive, hors spams, avec la
     date et l'heure ; l'alerte Discord ; la ligne dans Commandes › Rétractations. Supprimer
     ensuite la déclaration d'essai (bouton « Supprimer » de l'onglet).
  7. Seulement alors : passer en clé `sk_live_` (voir l'encadré plus haut).
- **Garde-fous de la route publique** (elle envoie des e-mails sous notre domaine) : 5 envois
  par minute et 12 par heure et par IP ; champ piège (déclaration **gardée** mais accusé
  suspendu et staff alerté) ; au plus **3 accusés par boîte** (casse, « +tag » et points de
  Gmail ramenés ensemble), **100 par jour** au total, dont 40 pour les déclarations non
  rapprochées, pour rester sous les 300 de Brevo. Un accusé retenu par un plafond n'est pas
  perdu : le cron le renvoie dès que la fenêtre de 24 h se libère, ou le staff le renvoie à la
  main. Déclarations conservées **5 ans** (puis supprimées par le cron) ; celles au piège
  rempli, 30 jours.
- **Back-office › Commandes** : « à expédier » avec l'adresse, lien vers le paiement dans
  Stripe, « Marquer expédiée ».
- **Export comptable (CSV)** — encart « Export comptable » de la page Commandes, route
  `/admin/commandes/export` (réservée au staff). Commandes payées, classées par **date de
  paiement** (heure de Paris), une ligne par commande ou par article ; montants au
  centime, date et montant des remboursements, référence Stripe. Format Excel français
  (UTF-8 avec BOM, séparateur `;`, virgule décimale). Nom, e-mail et adresse ne sortent
  que si la case est cochée ; chaque export est tracé dans les journaux (qui, quelle
  période, avec ou sans données personnelles). Les textes saisis par les clients sont
  neutralisés contre l'**injection de formules** (`=`, `+`, `-`, `@` en tête de cellule).

## RGPD

- **Consentement** obligatoire et horodaté (`consent_at`) sur les deux formulaires,
  revalidé côté serveur (422 sinon).
- **Conservation 24 mois** : `/api/cron/purge` supprime candidatures et messages plus
  anciens, plus les IP anti-flood de plus d'une heure. Déclenché par le cron Vercel
  (`vercel.json`, 3 h du matin) et protégé par `CRON_SECRET` — **sans ce secret, la route
  refuse tout appel** plutôt que d'exposer un endpoint de suppression ouvert.
- **Commandes : conservées 10 ans** (pièces comptables), aucune purge automatique. Les
  premières atteindront 10 ans en **octobre 2036** : ajouter alors la suppression ou
  l'anonymisation dans `/api/cron/purge` (délai à compter de la clôture de l'exercice, donc
  avec une marge d'un an).
- **Copies Discord** : chaque formulaire est aussi publié par le bot dans un salon du staff ;
  ces messages ne sont pas purgés par le cron. À supprimer à la main au bout de 24 mois (ou
  sur demande) — l'identifiant de la base figure dans le message.
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

### Unitaires — Vitest (173 tests)

Logique pure et routes API : anti-spam, consentement, longueurs de champs, rate-limit,
métadonnées SEO, JSON-LD, contrôle d'accès staff, garde Discord, purge RGPD, remontée
d'erreurs, cohérence de `.env.example`, parité des deux catalogues de traduction. Les routes sont testées avec Supabase mocké
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
- **`force-static` fait perdre la langue.** Voir [Langues](#langues-i18n) : sur une page
  prérendue, `getTranslations()` sans langue explicite rend l'anglais en français, sans
  la moindre erreur au build ni au runtime.
- **Les server actions sont des endpoints POST publics.** Toujours appeler `requireStaff()`
  *dans* l'action, jamais se reposer sur le layout.
- **Le cache de schéma PostgREST.** Après une migration, une erreur
  « Could not find the column … in the schema cache » signifie que la colonne manque
  vraiment (ou que le cache n'a pas été rechargé : `notify pgrst, 'reload schema';`).
