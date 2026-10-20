# Migration Azure — AGL Overdue Files Monitoring

Runbook opérationnel final : Vercel → Azure Container Apps. Aucun secret réel ne doit
figurer dans ce document ni dans le dépôt.

## 1. Cible finale

| Élément | Valeur |
|---|---|
| Abonnement | `Azure subscription - Sandbox digital` (`adac1283-8199-48e5-8340-8a7616d86c46`) |
| Tenant | `3459533d-1446-42b8-a957-b3a7dcd0e7e6` |
| Resource group | `rgci-aglci-ai` (West Europe) |
| ACR | `aglcioverdueacr` (Basic, admin activé) |
| Image | `aglcioverdueacr.azurecr.io/overdue-files:<sha>` + `latest` |
| Environnement ACA | `aglci-overdue-env` (Consumption, sans VNet) |
| Application ACA | `aglci-overdue` (`Microsoft.App/containerApps`) |
| URL ACA | `https://aglci-overdue.niceriver-3ee36e6e.westeurope.azurecontainerapps.io` |
| Log Analytics | `aglci-overdue-logs` (30 jours) |
| PostgreSQL | `aglci-overdue-db` (v16, Burstable B1ms, 32 Go) |
| Base | `overdue` |
| Rollback temporaire | App Service `aglci-overdue` / plan `asp-aglci-overdue` (B1), arrêté le 2026-10-20 |
| Tags | `project=agl-overdue-files` |

**Décision d'architecture** : la cible est **Azure Container Apps**, avec un environnement
dédié et un Log Analytics dédié. L'App Service conteneur (`asp-aglci-overdue` + Web App
`aglci-overdue`) a été le premier déploiement de validation ; il est conservé temporairement
comme rollback, puis sera arrêté et supprimé avec accord explicite. Les deux ressources
portent le même nom `aglci-overdue`, mais sont de types différents (`Microsoft.Web/sites`
vs `Microsoft.App/containerApps`).

Le déploiement applicatif est **manuel après build** : GitHub Actions construit et pousse
l'image, puis un opérateur met à jour la révision ACA. Les role assignments Azure étant
bloqués sur cet abonnement, OIDC/UAMI n'est pas utilisé pour la CI/CD.

## 2. Principes d'exécution

- Annoncer chaque commande `az` qui crée ou modifie une ressource, puis attendre validation.
- Ne jamais supprimer une ressource existante sans accord explicite.
- Ne jamais afficher un secret (mot de passe, chaîne de connexion, identifiants ACR,
  secret ACA). Utiliser des variables shell ou des fichiers temporaires `chmod 600`
  hors dépôt, puis les supprimer.
- `.env.azure` est gitignoré et reste hors du dépôt. Il contient `APP_PASSWORD` avec des
  guillemets : parser la valeur avant de la transmettre à Azure.
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

Construire et pousser l'image avec un tag de commit et `latest`. Les identifiants admin
ACR sont lus dans Azure sans être affichés.

Vérifications :

```bash
az acr show -n aglcioverdueacr --query "{loginServer:loginServer,admin:adminUserEnabled}" -o json
az acr repository show-tags -n aglcioverdueacr --repository overdue-files -o table
az acr manifest show -r aglcioverdueacr -n overdue-files:<tag> \
  --query "{arch:architecture,os:os}" -o json
```

Image validée : `91a69d4`, `amd64/linux`, présente aussi sous `latest`.

## 5. PostgreSQL et données (P2)

```bash
az postgres flexible-server create -g rgci-aglci-ai -n aglci-overdue-db -l westeurope \
  --version 16 --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
  --public-access Enabled --admin-user overdueadmin --admin-password "$PGPW" \
  --tags project=agl-overdue-files
az postgres flexible-server db create -g rgci-aglci-ai -s aglci-overdue-db --name overdue
```

Règles firewall :

- `AllowAllAzureServicesAndResourcesWithinAzureIps_2026-10-19_22-8-23` (`0.0.0.0`) :
  nécessaire pour l'accès depuis les services Azure sans VNet (App Service puis ACA).
  Point de durcissement : private endpoint/VNet, puis suppression de cette règle.
- Règle temporaire `cli-admin` avec l'IP publique du poste : ajoutée uniquement pour les
  opérations SQL, puis supprimée (dernier nettoyage d'import inclus).

Chaîne cible (ne jamais l'afficher) :
`postgresql://overdueadmin:<mot-de-passe>@aglci-overdue-db.postgres.database.azure.com:5432/overdue?sslmode=require`

Séquences :

1. Ajouter `APP_SESSION_SECRET` et `PG_ADMIN_PASSWORD` à `.env.azure` sans affichage.
2. `DATABASE_URL=<cible> npm run db:migrate` (schéma Drizzle, idempotent).
3. Dump data-only de la base Vercel via Docker `postgres:17-alpine` vers
   `/tmp/opencode/overdue-data.sql` (hors dépôt).
4. Restaurer dans l'ordre des dépendances : `agencies`, `com_units`, `coms`, `imports`,
   `raw_com_summary`, `raw_unarchived`, `raw_dossier_details`.
5. Contrôles :
   - `imports` = 2 ;
   - `raw_dossier_details` = 40 159 ;
   - `raw_com_summary` = 70 ; `raw_unarchived` = 0 ;
   - sommes par catégorie identiques à la source ;
   - séquences `SERIAL` alignées sur `MAX(id)` ;
   - `/api/ready` retourne `imports: 2`.
6. Supprimer la règle firewall temporaire et le fichier de dump.

### Résultat constaté le 2026-10-19

- Source PostgreSQL **17.2**, cible **16**. Dump par tables puis concaténation, car un dump
  multi-table a échoué sur `raw_dossier_details` (`SSL SYSCALL error: EOF detected`).
- Imports : id 1 `Overdue Files SPOT.xlsx` (2026-09-30, **20 566** lignes, origin web) ;
  id 2 `Overdue Files SPOT (1).xlsx` (2026-10-19, **19 593** lignes, origin web) ; les deux
  au statut `warnings`.
- Lignes : `imports=2`, `raw_com_summary=70`, `raw_unarchived=0`,
  `raw_dossier_details=40 159`, `agencies=3`, `com_units=30`, `coms=35`.
- Sommes identiques source/cible :
  `bae|fact_douane|mise_en_livraison|livraison|retour_conteneur|declares_non_factures|fact_prestation|archivage|sans_declaration|debours`
  = `474|62|136|264|144|1708|4949|22000|4564|22331`.
- Séquences : `agencies=6`, `com_units=59`, `coms=35`, `imports=2`, `raw_com_summary=70`,
  `raw_unarchived=1`, `raw_dossier_details=40159`.
- Dump et règle `cli-admin` supprimés après vérification.

### Pièges rencontrés

- Un dump PostgreSQL 17 contient `SET transaction_timeout = 0;`, paramètre inconnu en PG16 :
  retirer les deux lignes avant restauration, sinon
  `unrecognized configuration parameter "transaction_timeout"`.
- `az postgres flexible-server db create` attend `--name`/`-n`, pas `-d`.
- `firewall-rule` attend `--server-name`, pas `-n` ; la création peut bloquer plusieurs minutes
  tout en réussissant. Vérifier avec `firewall-rule list`.
- `pg` avertit sur la sémantique de `sslmode=require` ; utiliser `sslmode=verify-full` en cible
  durcie.

## 6. Azure Container Apps (P3 remplacé)

### 6.1 Log Analytics

```bash
az monitor log-analytics workspace create -g rgci-aglci-ai -n aglci-overdue-logs \
  -l westeurope --retention-time 30 --tags project=agl-overdue-files
```

Résultat : `aglci-overdue-logs`, customerId `771c41c2-9762-47bf-8ca4-24c1bd428e21`,
rétention 30 jours.

### 6.2 Environnement ACA

```bash
az containerapp env create -g rgci-aglci-ai -n aglci-overdue-env -l westeurope \
  --logs-workspace-id <customerId> --logs-workspace-key <clé> \
  --tags project=agl-overdue-files
```

Résultat constaté :

- `provisioningState=Succeeded` ;
- domaine par défaut `niceriver-3ee36e6e.westeurope.azurecontainerapps.io` ;
- `staticIp=51.144.189.238` ;
- pas de VNet (`vnetConfiguration` nul), plan Consumption ;
- logs `log-analytics` ;
- IP sortantes observées (indicatives, susceptibles de changer) :
  `51.137.8.84`, `51.137.8.250`, `40.114.177.194`, `40.114.177.222`, `20.8.61.140`,
  `20.23.204.52`, `4.180.170.19`. Ne pas les coder en dur dans le firewall PostgreSQL :
  la règle « services Azure » couvre l'accès.

La création peut rester plusieurs minutes en `Waiting` avant de passer `Succeeded`.
Vérifier avec `az containerapp env show` / les journaux d'activité, sans relancer en boucle.

### 6.3 Application ACA

```bash
ACR_USER=...   # lu sans affichage
ACR_PASS=...   # lu sans affichage
az containerapp create -g rgci-aglci-ai -n aglci-overdue \
  --environment aglci-overdue-env \
  --image aglcioverdueacr.azurecr.io/overdue-files:<tag> \
  --registry-server aglcioverdueacr.azurecr.io \
  --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
  --ingress external --target-port 3000 --transport auto \
  --min-replicas 1 --max-replicas 2 --cpu 0.5 --memory 1Gi \
  --secrets database-url="$DATABASE_URL" app-password="$APP_PASSWORD" \
    app-session-secret="$APP_SESSION_SECRET" \
  --env-vars NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE_URL=secretref:database-url APP_PASSWORD=secretref:app-password \
    APP_SESSION_SECRET=secretref:app-session-secret \
  --tags project=agl-overdue-files
```

Configuration effective :

| Paramètre | Valeur |
|---|---|
| FQDN | `aglci-overdue.niceriver-3ee36e6e.westeurope.azurecontainerapps.io` |
| Ingress | externe, port 3000, transport Auto, HTTP non sécurisé refusé |
| Ressources | 0.5 CPU, 1 GiB |
| Réplicas | min 1, max 2 |
| Révision | Single (défaut) |
| Secrets | `database-url`, `app-password`, `app-session-secret`, credential ACR auto-créé |
| Révision validée | `aglci-overdue--0000001`, `Healthy` |

Notes :

- `--revision-mode` n'est pas accepté par `az containerapp create` sur la version de CLI
  utilisée ; le mode Single est le défaut. Ne pas bloquer sur ce flag.
- Le secret ACR est nommé automatiquement
  `aglcioverdueacrazurecrio-aglcioverdueacr`.
- Pour un tag immuable, utiliser le SHA complet ou court du commit, jamais uniquement
  `latest`.

### 6.4 Probes

Probes appliquées à la révision `aglci-overdue--0000001` :

| Type | Path | Initial delay | Period | Failure threshold | Timeout |
|---|---|---|---|---|---|
| Startup | `/api/health` | 5 s | 5 s | 30 | 3 s |
| Readiness | `/api/ready` | 5 s | 10 s | 3 | 3 s |
| Liveness | `/api/health` | 15 s | 30 s | 3 | 3 s |

Les probes ont été ajoutées via un manifeste YAML temporaire contenant les valeurs de
secrets, puis le fichier a été supprimé (`chmod 600`). Ne jamais committer un manifeste
avec des secrets. En pratique, repasser par le portail ou par un manifeste régénéré à la
volée, puis vérifier `az containerapp revision list`.

### 6.5 Validation constatée

- `GET /api/health` → 200 `{"status":"ok","service":"agl-overdue-files"}`.
- `GET /api/ready` → 200 `{"status":"ready","db":"ok","imports":2}`.
- Login avec `APP_PASSWORD` sans guillemets → 200.
- `/api/dashboard` sans cookie → 401.
- Dashboard : snapshot 2, **19 593** dossiers, évolution **20 566 → 19 593**.
- `/api/snapshots` : 2 snapshots (id 2 puis id 1).
- Pages `/`, `/coms`, `/details`, `/evolution`, `/import` → 200.
- Logs console : aucune erreur applicative ; avertissement `pg` sur `sslmode=require`
  (comportement actuel de `pg-connection-string`, à traiter au durcissement).
- Logs système : avertissements transitoires `FailedGetExternalMetric` / `FailedUpdateStatus`
  liés à la suppression de l'ancienne révision lors du remplacement ; la révision courante
  est `Healthy`. Ne pas confondre avec une panne persistante.

Commandes utiles :

```bash
curl -i https://aglci-overdue.niceriver-3ee36e6e.westeurope.azurecontainerapps.io/api/health
curl -i https://aglci-overdue.niceriver-3ee36e6e.westeurope.azurecontainerapps.io/api/ready
az containerapp revision list -g rgci-aglci-ai -n aglci-overdue -o table
az containerapp logs show -g rgci-aglci-ai -n aglci-overdue --type console --tail 100
az containerapp logs show -g rgci-aglci-ai -n aglci-overdue --type system --tail 100
```

### 6.6 Test d'import et nettoyage

Test effectué sur ACA avec `data/Overdue_Files_SPOT.xlsx` et `POST /api/import?force=1` :

- `http=200`, `ok:true`, `importId=3`, `fileType=A`, `extractionDate=2026-09-30`,
  `rowCount=20566`, `status=warnings`, 4 warnings ;
- doublons détectés : byHash=1, byDate=1 ;
- snapshots temporairement à 3, puis nettoyage.

Nettoyage appliqué (règle firewall temporaire, puis suppression) :

```sql
BEGIN;
DELETE FROM raw_dossier_details WHERE import_id=3;
DELETE FROM raw_com_summary   WHERE import_id=3;
DELETE FROM raw_unarchived    WHERE import_id=3;
DELETE FROM imports           WHERE id=3;
SELECT setval(pg_get_serial_sequence('imports','id'),
              COALESCE((SELECT MAX(id) FROM imports),1));
SELECT setval(pg_get_serial_sequence('raw_dossier_details','id'),
              COALESCE((SELECT MAX(id) FROM raw_dossier_details),1));
SELECT setval(pg_get_serial_sequence('raw_com_summary','id'),
              COALESCE((SELECT MAX(id) FROM raw_com_summary),1));
SELECT setval(pg_get_serial_sequence('raw_unarchived','id'),
              COALESCE((SELECT MAX(id) FROM raw_unarchived),1));
COMMIT;
```

Après nettoyage : `imports=2`, `raw_dossier_details=40 159`, `raw_com_summary=70`,
`raw_unarchived=0`, `agencies=3`, `com_units=30`, `coms=35` ; sommes identiques ;
`/api/ready` → `imports:2` ; dashboard → 19 593 ; snapshots → 2.

## 7. CI/CD (P4)

Workflow : `.github/workflows/build-image.yml`.

1. `npm ci`, lint, typecheck.
2. Build et push de l'image avec `docker/login-action` + `docker/build-push-action`
   (tags `latest` + `${{ github.sha }}`).
3. **Pas de déploiement Azure dans le workflow** : l'image est disponible dans ACR.
4. Mise à jour ACA manuelle après validation :

```bash
az containerapp update -g rgci-aglci-ai -n aglci-overdue \
  --image aglcioverdueacr.azurecr.io/overdue-files:<sha> \
  --revision-suffix <sha-court>
```

Le suffixe de révision doit être unique et en minuscules. En cas de conflit, omettre
`--revision-suffix` pour laisser ACA générer un suffixe.

Secrets GitHub (noms seulement) :

- `ACR_USERNAME`
- `ACR_PASSWORD`

Variables GitHub :

- `ACR_LOGIN_SERVER` = `aglcioverdueacr.azurecr.io`
- `IMAGE_NAME` = `overdue-files`

`AZURE_WEBAPP_PUBLISH_PROFILE` et `WEBAPP_NAME` ne sont plus nécessaires. Si le premier
est déjà présent dans GitHub, le supprimer.

`gh` n'est pas disponible sur le poste : la saisie est manuelle. Récupération des
identifiants ACR hors affichage :

```bash
umask 077
mkdir -p /tmp/opencode/github-secrets
az acr credential show -n aglcioverdueacr --query username -o tsv \
  > /tmp/opencode/github-secrets/acr-username.txt
az acr credential show -n aglcioverdueacr --query 'passwords[0].value' -o tsv \
  > /tmp/opencode/github-secrets/acr-password.txt
chmod 600 /tmp/opencode/github-secrets/*
```

Après saisie dans GitHub, supprimer le dossier. Ne pas pousser le workflow avant d'avoir
saisi les secrets, sinon le premier run échouera.

## 8. Recette (P5)

- Connexion avec `APP_PASSWORD`.
- Tableau de bord : dernier snapshot = 19 593 dossiers.
- Comparaison N-1 → N : 20 566 → 19 593.
- Évolution, filtres agence/unité/COM/catégorie, analyse par COM, détail.
- Import web sur un snapshot jetable (fichier A, option doublon/force ou copie modifiée),
  puis nettoyage SQL validé des lignes du test ; retour à 2 imports / 40 159 lignes.
- Logs ACA sans erreur critique.
- Résumé final sans secrets : URL, ressources, contrôles, points restants.

## 9. Cutover et sort de l'App Service

1. ACA est la cible ; l'URL à communiquer est le FQDN ACA.
2. L'App Service `aglci-overdue` a été arrêté le 2026-10-20 (`az webapp stop`) ; conserver
   le plan/Web App 24–48 h pour rollback. Redémarrage possible avec `az webapp start`.
3. Passé ce délai, supprimer la Web App et le plan **uniquement avec accord explicite**.
4. Supprimer le secret GitHub `AZURE_WEBAPP_PUBLISH_PROFILE` s'il existe.
5. Ne pas supprimer l'ACR ni PostgreSQL : ils sont utilisés par ACA.
6. Aucun domaine personnalisé n'est configuré ; pas de bascule DNS à faire.

## 10. Rollback et diagnostic

- **Révisions ACA** : lister, activer/désactiver une révision connue bonne.
- **Image** : redéployer un tag précédent via `az containerapp update --image`.
- **Config** : `az containerapp show` (les secrets ne sont pas affichés en clair).
- **Logs** : `az containerapp logs show --type console|system`.
- **DB** : dump de sécurité avant toute migration ; restauration data-only dans l'ordre.
- **Arrêt d'urgence ACA** : désactiver la révision ou réduire les réplicas ; ne pas
  supprimer la ressource.
- **Rollback App Service** : tant qu'il est conservé, redémarrer l'App Service et vérifier
  `/api/ready` ; il partage la même base.

## 11. Durcissement ultérieur

- Passer à OIDC GitHub + managed identity `AcrPull` lorsque Owner/User Access Administrator
  est disponible ; supprimer alors le mot de passe ACR admin et, si possible, automatiser
  `az containerapp update`.
- Key Vault pour les secrets ACA ; private endpoint/VNet pour PostgreSQL ; suppression de
  la règle `0.0.0.0`.
- Rotation des credentials ACR et des secrets applicatifs ; alertes ACA/PostgreSQL/Log
  Analytics.
- Traiter l'avertissement `pg` `sslmode=require` (utiliser `verify-full`).
- Traiter les vulnérabilités `npm audit` (Next 14.2.18) et planifier la montée de version.
- Ne jamais confondre « image poussée dans ACR » et « image réellement exécutée » :
  vérifier l'image de la révision ACA active.
