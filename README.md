# HINTERLAND — Pilotage des dossiers en retard (Overdue Files Monitoring)

Application web professionnelle (interface en français) pour piloter les dossiers
opérationnels HINTERLAND en retard à partir d'extractions Excel SPOT.

- Visualisation des dossiers en retard + KPI, analyse par COM, détail des dossiers,
  comparaison de snapshots (amélioration / dégradation).
- Préparation des données pour les alertes de suivi (pas d'envoi).

## Démarrage rapide (local, une seule commande)

Prérequis : Docker + Docker Compose, Node 20.

```bash
cp .env.example .env        # puis renseignez APP_PASSWORD et APP_SESSION_SECRET
docker compose up --build   # app http://localhost:3000 + postgres
```

Au premier démarrage, appliquez les migrations puis importez :

```bash
npm install
npm run db:migrate
npm run import -- --file data/Overdue_Files_SPOT.xlsx   # Fichier A (date lue dans le fichier)
npm run seed:demo   # alternative : jeu fictif pour tester sans données réelles
```

Connectez-vous avec le mot de passe `APP_PASSWORD`.

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | Chaîne PostgreSQL (locale, Neon/Supabase sur Vercel, Flexible Server sur Azure). |
| `APP_PASSWORD` | oui | Mot de passe partagé (auth minimale, remplacée plus tard par Entra ID — voir `src/lib/auth.ts`). |
| `APP_SESSION_SECRET` | oui | Secret de signature du cookie de session (aléatoire, long). |
| `MAX_UPLOAD_BYTES` | non | Taille max d'import web (défaut 4718592 ≈ 4,5 Mo). |
| `EXPORT_MAX_ROWS` | non | Limite d'export CSV (défaut 20000). |
| `PORT` / `HOSTNAME` | non | Écoute du serveur (défaut 3000 / 0.0.0.0 en conteneur). |

Aucun secret dans le code. `.gitignore` exclut `*.xlsx`, `*.xls`, `*.csv`, `data/`, `.env*`.
**Ne commitez jamais de données réelles ni de `.env`.**

## Stack et choix techniques

- Next.js 14 (App Router) + TypeScript, Tailwind CSS, Recharts. Aucune dépendance Vercel
  dans la logique métier.
- PostgreSQL (`DATABASE_URL`) + Drizzle (schéma `src/lib/schema.ts`, migrations `drizzle/`).
- Lecture Excel : `xlsx` (SheetJS) pour le Fichier A et la détection légère ; parseur
  streaming maison (`unzipper` + `saxes`) pour le Fichier B — ExcelJS, même en streaming,
  dépasse la mémoire Node sur ce fichier, et son arbre de dépendances casse le traçage
  `standalone` de Next. Le module d'import reste partagé (`src/lib/import/`) entre la
  route API et le CLI.
- Auth minimale isolée dans `src/lib/auth.ts` (Web Crypto, compatible Edge).

## Fichiers sources

**Fichier A — `Overdue_Files_SPOT.xlsx` (Sheet1 + Sheet2).**
- Sheet1 : résumé par COM. Date/heure d'extraction lue en haut de feuille → **date du snapshot**.
  En-têtes FR ligne 6 (EN ligne 7 ignorée), données dès ligne 8. Colonnes repérées **par texte
  d'en-tête, jamais par position**. Lignes sans « Unité COM » = sous-totaux d'agence
  (stockés à part, jamais comptés comme COM). Bloc de règles en bas lu pour information.
- Sheet2 : détail par dossier (~20 500 lignes). En-têtes FR ligne 1 (EN ligne 2 ignorée),
  données dès ligne 3. Lignes sans COM regroupées sous « Non affecté ». Doublons de
  dossiers **conservés et signalés**. Ligne de total en bas de feuille **exclue**.

**Fichier B — `Dossiers_Hinterland_Non_Archivés_par_COM.xlsx` (feuille `Feuil1`, ~41 Mo).**
Mêmes colonnes que Sheet2 mais **sans « Dossiers Validés »** et **sans date d'extraction**
(→ paramètre `--date AAAA-MM-JJ` obligatoire). **Jamais par le navigateur** : uniquement
le script CLI en streaming (voir ci-dessous).

Détection du type **par noms de feuilles + en-têtes**, pas par nom de fichier.
Les fichiers ne sont **pas conservés** : seules les lignes vont en base (+ nom et SHA-256
dans l'historique pour détecter les doublons).

## Imports

```bash
# Fichier A — date lue dans le fichier (--date optionnel pour forcer)
npm run import -- --file data/Overdue_Files_SPOT.xlsx [--force]

# Fichier B — --date OBLIGATOIRE, streaming par lots, barre de progression
npm run import -- --file data/Dossiers_Hinterland_Non_Archivés_par_COM.xlsx --date 2026-10-01 [--force] [--batch 5000]
```

- `--force` : en cas de même empreinte ou même date d'extraction, conserve les deux imports
  (le plus récent fait foi) au lieu de refuser. L'historique n'est **jamais écrasé**.
- Échec en cours de route : import marqué « Échec », ses lignes partielles sont retirées
  (seul cet `import_id`), les autres snapshots sont intacts.
- Interface web (`/import`, Fichier A uniquement, ≤ 4,5 Mo par fichier, **plusieurs fichiers
  déposables d'affilée**) : drag-and-drop multiple, contrôle par fichier, import groupé,
  erreurs/avertissements, historique (Réussi / Avertissements / Échec, origine web/cli).

## Règles métier (rappel — aucune règle inventée)

Seuils SPOT **informatifs, déjà appliqués** (affichés en légende) : Air 5 j ·
Maritime & Route locale 10 j · Maritime Hinterland 15 j. L'application ne recalcule rien.

- **Total dossiers en retard** = dossiers DISTINCTS avec ≥ 1 catégorie (détail Sheet2).
- Un dossier peut être dans plusieurs catégories : la somme des catégories n'est jamais
  présentée comme un nombre de dossiers. Taux par COM = retards / Validés 12 mois
  (affiché uniquement si la donnée existe).

## Pages

| Page | Contenu |
|---|---|
| `/` Tableau de bord | Sélecteur de snapshot (défaut : plus récent, dates jj/mm/aaaa), 10 cartes KPI cliquables (titre en haut, chiffre au centre, en bas variation vs N-1 : ▲/▼/▬ + écart signé + %, rouge hausse / vert baisse / gris stable, « Pas de comparaison » sans N-1, % omis si N-1 = 0), retards par catégorie, top 15 COM (voir tout), mini-évolution N-1/N. |
| `/coms` | Matrice COM × catégories (+ validés 12 mois), tri, filtres agence/unité, panneau détaillé + lien vers ses dossiers. |
| `/details` | Recherche dossier/COM, filtres (agence, unité, COM, catégorie via URL), tri, pagination **serveur**, export CSV limité (`EXPORT_MAX_ROWS`, message si dépassé). |
| `/evolution` | Deux sélecteurs (N et N-1, préremplis sur les deux plus récentes), bandeau de synthèse (total N-1 → N, variation et %), tableau par catégorie, tableau par COM triable (défaut : plus forte dégradation), tendance sur tous les snapshots avec une courbe par catégorie (sélectionnables) ; rouge = dégradation, vert = amélioration, gris = stable ; message clair si un seul snapshot. |
| `/import` | Voir « Imports ». |

> Périmètre des visualisations : le tableau de bord, l'analyse par COM, le détail et
> l'évolution portent sur les snapshots du **Fichier A** (dossiers en retard SPOT).
> Les imports du **Fichier B** (dossiers non archivés, table `raw_unarchived`) sont
> stockés et visibles dans l'historique `/import`, sans double-compte avec le Fichier A.

Design : fond clair, bleu marine, rouge dégradations (hausse), vert améliorations (baisse),
gris stable, sidebar fixe repliable sur mobile.

## Modèle de données (3 couches, PostgreSQL + Drizzle)

1. **Brutes** : `raw_com_summary` (résumé COM + sous-totaux `is_subtotal`), `raw_dossier_details`
   (Sheet2), `raw_unarchived` (Fichier B) — toutes rattachées à `import_id`.
2. **Historique** : `imports` (nom, SHA-256, type A/B, date d'extraction, date de chargement,
   lignes, statut, avertissements JSON, origine web/cli) + référentiels normalisés
   (`agencies`, `com_units`, `coms`).
3. **Calculées** : agrégats recalculés à la demande depuis 1+2 (`src/lib/stats.ts`, aucune
   table d'agrégats persistée).

Optimisations volume : textes normalisés (pas répétés par ligne), 10 catégories en
`smallint` + `flags_mask` (bits), index sur `import_id`, `com_id`, `agency_id`, `dossier`.

**Taille estimée** (mesurée) : ~20 566 dossiers Fichier A ≈ 3,9 Mo de table (~200 octets/ligne).
Le Fichier B reçu ne contient que **356 lignes de données réelles** (le reste du million de
lignes physiques = lignes vides formatées) ≈ 0,2 Mo. Extrapolation : **~200 Mo par million
de lignes réelles** — compatible avec une base managée modeste ; au-delà, partitionner par
`import_id` ou purger les snapshots obsolètes (jamais automatiquement).

## Déploiement

- **Local** : `docker compose up --build` (app + postgres 16). Migrations : `npm run db:migrate`.
- **Vercel** : poussez sur GitHub, créez le projet, définissez `DATABASE_URL` (Neon/Supabase,
  région proche), `APP_PASSWORD`, `APP_SESSION_SECRET`. Aucune écriture disque, aucun état
  en mémoire, fonctions courtes uniquement (le gros import reste en CLI). Santé :
  `/api/health` (liveness, public), `/api/ready` (teste la base, public).
- **Azure (plus tard)** : `Dockerfile` multi-stage fourni (`output: standalone`, utilisateur
  non-root `nextjs`) + future base Azure Database for PostgreSQL Flexible Server.
  Aucune dépendance Vercel dans la logique métier.

## Sécurité

Middleware Next.js : toutes les pages et `/api/*` exigent le cookie de session signé
(`APP_PASSWORD`), sauf `/login`, `/api/login`, `/api/logout`, `/api/health`, `/api/ready`.
Identité isolée dans `src/lib/auth.ts` (Web Crypto, compatible Edge) pour bascule future
vers Microsoft Entra ID. Logs JSON sur stdout (`src/lib/logger.ts`).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | Qualité (CI sur chaque push) |
| `npm run db:migrate` | Applique `drizzle/*.sql` |
| `npm run import -- --file …` | CLI d'import A/B |
| `npm run seed:demo` | Jeu fictif (faux COM) |
| `npm run seed:demo-snapshot` | **Local uniquement** : snapshot fictif daté 2026-09-23 (valeurs proches de l'actuel, aléatoires), marqué DÉMO dans l'historique. Refuse de tourner si `DATABASE_URL` ne pointe pas vers une base locale. Jamais lancé automatiquement. |
| `npm run seed:demo-clean` | **Local uniquement** : retire uniquement le snapshot DÉMO (même garde localhost). |

## Validation après import de Overdue_Files_SPOT.xlsx

Snapshot daté **30/09/2026** (date lue dans le fichier). Lignes de sous-total exclues des COM,
règles de bas de feuille exclues, « Non affecté » = 172 lignes, 4 doublons conservés et
signalés, ligne de total bas de Sheet2 exclue.

### Réconciliation avec la ligne de total de Sheet2 (aucun écart masqué)

La dernière ligne non vide de Sheet2 (ligne 20 569, sans dossier ni agence) est un **total
calculé par somme des colonnes** ; nous ne la comptons pas comme dossier (elle est exclue et
signalée dans les avertissements). Comparaison des 10 catégories :

| Catégorie | Ligne de total (somme) | Comptage application (dossiers) | Écart |
|---|---:|---:|---:|
| BAE | 166 | 166 | 0 |
| Facturation Douane | 41 | 41 | 0 |
| Mise en livraison | 61 | 61 | 0 |
| **Livraison** | **116** | **114** | **+2** |
| Retour conteneur | 62 | 62 | 0 |
| Déclarés non facturés | 833 | 833 | 0 |
| Facturation prestation | 2 519 | 2 519 | 0 |
| Archivage | 11 588 | 11 588 | 0 |
| Sans déclaration | 2 372 | 2 372 | 0 |
| **Avec débours** | **11 194** | **11 191** | **+3** |

Explication **ligne à ligne, sans masquage** :
- **Livraison +2** : deux lignes du fichier contiennent la valeur `2` dans la colonne
  « Livraison en retard » (lignes 9 781 et 10 576, dossiers 26222678 et 26210347). La somme
  Excel compte chaque unité (2+2), notre comptage compte chaque **dossier** une fois.
- **Débours +3** : trois lignes contiennent la valeur `2` (lignes 7 280, 7 281, 7 282,
  dossiers 25202931, 25202935, 25202938). Même cause.
- Aucune autre différence : pas de ligne ignorée à tort, pas de cellule texte, la ligne de
  total elle-même est correctement exclue (aucun dossier perdu — les 20 566 lignes du fichier
  sont bien en base).
- Sur les valeurs de référence du cahier des charges, l'écart de **+1 par catégorie** observé
  initialement (ex. Archivage 11 589) correspond à la ligne de total **comptée comme un
  dossier** par la référence (11 588 + 1) ; notre exclusion est conforme à la spec (« ne pas
  compter les totaux »).

Vérification directe en base : `SUM()` sur `raw_dossier_details` (chaque catégorie est un
`smallint` 0/1) — les chiffres ci-dessus sont reproductibles dossier par dossier.
