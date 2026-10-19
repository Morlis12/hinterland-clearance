# Migration Azure — AGL Overdue Files Monitoring

Runbook opérationnel de la migration Vercel → Azure. Aucun secret réel ne doit figurer
dans ce document ni dans le dépôt.

## 1. Cible

| Élément | Valeur |
|---|---|
| Abonnement | `Azure subscription - Sandbox digital` |
| Resource group | `rgci-aglci-ai` (West Europe) |
| ACR | `aglcioverdueacr` (Basic, admin activé) |
| Image | `aglcioverdueacr.azurecr.io/overdue-files:<sha-court>` + `latest` |
| App Service Plan | `asp-aglci-overdue` (Linux, B1) |
| Web App conteneur | `aglci-overdue` → `https://aglci-overdue.azurewebsites.net` |
| PostgreSQL | `aglci-overdue-db` (v16, Burstable B1ms, 32 Go) |
| Base | `overdue` |
| Tags | `project=agl-overdue-files` sur toutes les ressources créées |

Modèle retenu : **Web App for Containers + ACR admin + publish profile** (modèle JuriDesk),
sans OIDC/UAMI/role assignment. Les credentials sont longue durée : rotation et durcissement
documentés en fin de runbook.

## 2. Principes d'exécution

- Annoncer chaque commande `az` qui crée ou modifie une ressource, puis attendre validation.
- Ne jamais supprimer une ressource existante sans accord explicite.
- Ne jamais afficher un secret (mot de passe, chaîne de connexion, publish profile,
  identifiants ACR). Utiliser des variables shell ou des fichiers temporaires `chmod 600`
  hors dépôt, puis les supprimer.
- `.env.azure` est gitignoré et reste hors du dépôt.
- Vercel reste en ligne et inchangé pendant la recette. Geler les imports Vercel pendant
  le dump pour éviter toute divergence.
- Les migrations sont appliquées manuellement (`npm run db:migrate`) depuis un poste
  autorisé par le firewall, pas depuis GitHub Actions.

## 3. Préparation du dépôt (P0)

1. `.dockerignore` : exclure `node_modules`, `.next`, `data/`, `*.xlsx`, `.env*`, `*.sql`,
   `*.dump`, `.git`, `.github`, `docs/`.
2. `.gitignore` : `.env.azure`, `*.sql`, `*.dump` (le fichier suivi
   `drizzle/0001_init.sql` reste suivi).
3. Renommage visible : « AGL Overdue Files Monitoring », sous-titre « Pilotage des dossiers
   en retard ».
4. Vérifier `npm run lint`, `npm run typecheck`, `npm run build`.
5. Commit/push après validation.

### Occurrences « Hinterland » conservées

| Emplacement | Raison |
|---|---|
| `Sidebar.tsx`, `ui.tsx`, `src/lib/import/constants.ts` : « Maritime Hinterland : 15 jours » | Règle métier SPOT |
| `Dossiers_Hinterland_Non_Archivés_par_COM.xlsx` (README, code) | Nom du fichier source |
| Cookie `hinterland_session`, clés `localStorage` `hinterland-*` | Identifiants internes (évite déconnexion/reset des préférences) |
| `docker-compose.yml`, `.env.example` | Base locale de développement uniquement |
| Nom du dépôt GitHub `hinterland-clearance` | Remote et conventions ; hors périmètre |
| `docs/HINTERLAND-presentation.pptx` | Binaire de présentation ; régénération optionnelle |
| `drizzle/0001_init.sql:1` | Commentaire de migration historique, non visible dans l'application |
| `data/.gitkeep` | Commentaire listant les noms de fichiers sources |

## 4. ACR et image (P1)

```bash
az acr create -g rgci-aglci-ai -n aglcioverdueacr -l westeurope \
  --sku Basic --admin-enabled true --tags project=agl-overdue-files
```

Construire et pousser l'image avec un tag de commit court et `latest`. Les identifiants
admin ACR sont lus dans Azure sans être affichés.

Vérifications :

```bash
az acr show -n aglcioverdueacr --query "{loginServer:loginServer,admin:adminUserEnabled}" -o json
az acr repository show-tags -n aglcioverdueacr --repository overdue-files -o table
```

## 5. PostgreSQL et données (P2)

```bash
az postgres flexible-server create -g rgci-aglci-ai -n aglci-overdue-db -l westeurope \
  --version 16 --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
  --public-access Enabled --admin-user overdueadmin --admin-password "$PGPW" \
  --tags project=agl-overdue-files
az postgres flexible-server db create -g rgci-aglci-ai -s aglci-overdue-db -d overdue
```

Règles firewall :

- `AllowAllAzureServicesAndResourcesWithinAzureIps` (0.0.0.0) : nécessaire pour ACA/App Service
  sans VNet ; à documenter comme point de durcissement (private endpoint/VNet ensuite).
- Règle temporaire `cli-admin` avec l'IP publique du poste : **supprimée après la migration**.

Chaîne cible (ne jamais l'afficher) :
`postgresql://overdueadmin:<mot-de-passe>@aglci-overdue-db.postgres.database.azure.com:5432/overdue?sslmode=require`

Séquences :

1. Ajouter `APP_SESSION_SECRET` et `PG_ADMIN_PASSWORD` à `.env.azure` sans affichage.
2. `DATABASE_URL=<cible> npm run db:migrate` (schéma Drizzle, idempotent).
3. Dump data-only de la base Vercel via Docker `postgres:17-alpine` vers
   `/tmp/opencode/overdue-data.sql` (hors dépôt).
4. Restaurer dans l'ordre des dépendances : `agencies`, `com_units`, `coms`, `imports`,
   `raw_com_summary`, `raw_dossier_details`, `raw_unarchived`.
5. Contrôles :
   - `imports` = 2 ;
   - `raw_dossier_details` = 40 159 ;
   - sommes par catégorie identiques à la source ;
   - séquences `SERIAL` alignées sur `MAX(id)` ;
   - `/api/ready` retourne `imports: 2`.
6. Supprimer la règle firewall temporaire et le fichier de dump.

## 6. App Service conteneur (P3)

```bash
az appservice plan create -g rgci-aglci-ai -n asp-aglci-overdue -l westeurope \
  --is-linux --sku B1 --tags project=agl-overdue-files
az webapp create -g rgci-aglci-ai -p asp-aglci-overdue -n aglci-overdue \
  --deployment-container-image-name aglcioverdueacr.azurecr.io/overdue-files:<tag> \
  --tags project=agl-overdue-files
```

Configurer ensuite :

- registry ACR (URL + identifiants admin, sans affichage) ;
- `WEBSITES_PORT=3000`, `PORT=3000`, `HOSTNAME=0.0.0.0` ;
- `DATABASE_URL`, `APP_PASSWORD`, `APP_SESSION_SECRET`, `NODE_ENV=production` ;
- always-on, HTTPS only, TLS 1.2, FTPS désactivé ;
- health check plateforme `/api/health` ;
- logs applicatifs.

Vérifications :

```bash
curl -i https://aglci-overdue.azurewebsites.net/api/health
curl -i https://aglci-overdue.azurewebsites.net/api/ready
az webapp log tail -g rgci-aglci-ai -n aglci-overdue
```

## 7. CI/CD (P4)

Workflow : `.github/workflows/deploy-azure.yml`.

1. `npm ci`, lint, typecheck.
2. Build et push de l'image avec `docker/login-action` + `docker/build-push-action`
   (tags `latest` + `${{ github.sha }}`).
3. Déploiement de l'image via `azure/webapps-deploy@v3` avec
   `AZURE_WEBAPP_PUBLISH_PROFILE` et `images: <acr>/<image>:<sha>`.
4. Attente de `/api/ready` avec retries.

Secrets GitHub (noms seulement) :

- `ACR_USERNAME`
- `ACR_PASSWORD`
- `AZURE_WEBAPP_PUBLISH_PROFILE`

Variables GitHub :

- `ACR_LOGIN_SERVER`
- `WEBAPP_NAME`
- `IMAGE_NAME`

Les valeurs sont générées hors dépôt et saisies manuellement dans GitHub (`gh` absent).
Elles ne doivent jamais être affichées.

## 8. Recette (P5)

- Connexion avec `APP_PASSWORD`.
- Tableau de bord : dernier snapshot = 19 593 dossiers.
- Comparaison N-1 → N : 20 566 → 19 593.
- Évolution, filtres agence/unité/COM/catégorie, analyse par COM, détail.
- Import web sur un snapshot jetable (fichier A, option doublon/force ou copie modifiée),
  puis nettoyage SQL validé des lignes du test ; retour à 2 imports / 40 159 lignes.
- Logs App Service sans erreur critique.
- Résumé final sans secrets : URL, ressources, contrôles, points restants.

## 9. Rollback et diagnostic

- **Image** : redéployer un tag précédent via `az webapp config container set` ou le workflow.
- **Config** : `az webapp config appsettings list` (ne pas afficher les valeurs sensibles).
- **Logs** : `az webapp log tail`, `az webapp log download`.
- **DB** : dump de sécurité avant toute migration ; restauration data-only dans l'ordre.
- **Arrêt d'urgence** : `az webapp stop` (ne supprime rien).

## 10. Durcissement ultérieur

- Passer à OIDC GitHub + managed identity `AcrPull` lorsque Owner/User Access Administrator
  est disponible ; supprimer alors publish profile et ACR admin.
- Key Vault pour les secrets, private endpoint/VNet pour PostgreSQL, suppression de la règle
  0.0.0.0.
- Rotation des credentials ACR/publish profile ; alertes App Service et PostgreSQL.
- Ne jamais confondre « image poussée dans ACR » et « image réellement exécutée » :
  vérifier `az webapp config container show`.
