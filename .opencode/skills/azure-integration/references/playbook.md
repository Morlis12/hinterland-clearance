# Playbook — Intégrer un projet web sur Azure

Playbook réutilisable pour déployer un projet Next.js/Node sur Azure, inspiré de
l'intégration JuriDesk AI et de la migration AGL Overdue Files Monitoring. Il couvre
plusieurs modèles d'hébergement et d'authentification, du plus simple (sandbox) au plus
sécurisé (OIDC + managed identity).

> À utiliser avec `docs/PROMPT-azure-integration.md` (prompt à coller) et le skill opencode
> `azure-integration`. Remplacer tous les `<...>` par les valeurs du projet.

## 1. Règles absolues

1. **Aucun secret affiché** : jamais dans le chat, les logs, les commandes visibles, le
   dépôt ou l'image. Utiliser `.env.<env>` gitignoré, variables shell, fichiers temporaires
   `chmod 600` hors dépôt, puis les supprimer.
2. **Annoncer chaque commande qui crée ou modifie une ressource** et attendre validation.
3. **Ne rien supprimer** sans accord explicite.
4. **Vérifier les droits avant de créer** : Contributor suffit pour créer les ressources,
   mais pas pour attribuer des rôles. OIDC/UAMI exigent Owner ou User Access Administrator.
5. **S'arrêter et signaler** si un droit manque, sans fallback silencieux vers des
   credentials longue durée si l'utilisateur a exigé OIDC.
6. **Ne pas confondre** « image poussée dans ACR » et « image réellement exécutée en prod ».
   Vérifier la configuration finale.
7. **Geler la source** pendant une copie de données ; vérifier les comptages après restauration.
8. **Migrations hors CI** par défaut : pas de base de production accessible depuis GitHub
   Actions. Les appliquer depuis un poste autorisé ou via un job dédié.

## 2. Découverte et inventaire

```bash
az login
az account show
az account set --subscription "<NOM_OU_ID>"

# Ressources existantes
az group list -o table
az role assignment list --assignee "<UPN_OU_OBJECT_ID>" --all -o table
az acr list -o table
az postgres flexible-server list -o table
az appservice plan list -g "<RG>" -o table
az webapp list -g "<RG>" -o table
az containerapp env list -g "<RG>" -o table
az containerapp list -g "<RG>" -o table
az monitor log-analytics workspace list -g "<RG>" -o table
```

Vérifier aussi :

- quotas App Service / ACA / PostgreSQL dans la région ;
- convention de nommage et tags du sandbox ;
- disponibilité globale du nom de Web App (`<nom>.azurewebsites.net`) ;
- présence de `gh` et d'un token GitHub pour automatiser les secrets (sinon saisie manuelle).

## 3. Questions à poser avant toute création

1. Abonnement et resource group : existant ou nouveau `rgci-<projet>` ?
2. Hébergement : App Service code/zip, Web App for Containers, ou Azure Container Apps ?
3. Base : PostgreSQL Flexible Server ou base existante ? Version, SKU, taille, TLS.
4. Authentification CI/CD : publish profile + ACR admin (sandbox), build/push ACR seul +
   mise à jour ACA manuelle (sans role assignment), ou OIDC + managed identity (production) ?
   Si OIDC, les rôles peuvent-ils être attribués ?
5. URL/domaine public, TLS, staging éventuel.
6. Secrets applicatifs : session, admin, IA, email, etc. (noms seulement).
7. Repo public/privé, droits GitHub pour créer secrets/variables.
8. Données à migrer : volume, fenêtre de gel, contrôles attendus.
9. Health check et readiness (chemins, dépendance DB ou non).
10. Migrations : manuelles, au démarrage, ou job dédié ? Qui a accès à la base ?
11. Budget/coûts acceptés et politique de rétention des images/snapshots.
12. Rollback attendu (image précédente, restauration DB, arrêt).

## 4. Matrice de décision

| Contrainte | Track recommandé | Auth CI/CD | RBAC requis |
|---|---|---|---|
| Compte Contributor seul, livraison rapide, image non critique | App Service code/zip ou Web App for Containers | Publish profile + ACR admin | Aucun role assignment |
| Vrai conteneur, compte Contributor seul, déploiement manuel accepté | Azure Container Apps | ACR admin (build/push GitHub) + `az containerapp update` manuel | Aucun role assignment |
| Vrai conteneur, livraison automatique simple | Web App for Containers | Publish profile + ACR admin | Aucun role assignment |
| Production sécurisée, pas de credentials longue durée | App Service/ACA + OIDC + UAMI | OIDC fédéré GitHub | Owner/UAA pour AcrPull + Contributor app |
| Pas de registry nécessaire | App Service code/zip | Publish profile | Aucun |
| Miroir d'image uniquement | ACR (build/push) | ACR admin ou OIDC AcrPush | Selon auth |

### Points de vigilance

- **ACR admin** : credentials longue durée ; rotation et stockage sécurisé obligatoires.
- **Publish profile** : credential longue durée ; à révoquer/rotationner ; OIDC préférable
  en production.
- **OIDC** : app registration + federated credential limitée au repo/branche ; rôles minimaux.
- **`AcrPush` seul ne permet pas `az acr build`** (ACR Tasks exige `scheduleRun`). Utiliser
  `docker build` + `docker push` avec AcrPush, ou ajouter un rôle custom.
- **ACA + pull privé** : avec ACR admin, secret registry dans l'app ; avec OIDC, UAMI +
  `AcrPull` (role assignment).
- **ACA sans OIDC** : le workflow peut builder/pousser, mais `az containerapp update` reste
  manuel ; ne pas prétendre que la CI déploie.
- **App Service code/zip** : la prod n'exécute pas l'image ACR ; ne pas le présenter comme
  un déploiement conteneurisé.

## 5. Nommage et tags

Conventions indicatives :

- Resource group : `rgci-<projet>`
- ACR : `aglci<projet>` (alphanumérique, sans tiret)
- PostgreSQL : `pg-<projet>-prod` ou `aglci-<projet>-db`
- App Service Plan : `asp-<projet>-prod` ou `asp-aglci-<projet>`
- Web App : `aglci-<projet>` ou `<projet>-ai` (globalement unique)
- ACA env/app : `aglci-<projet>-env` / `aglci-<projet>`
- Image : `<projet>-ai` ou `<projet>`
- Tags minimum : `project=<projet>`, `env=prod|staging`, `owner=<équipe>`

## 6. Phase 0 — Préparation du dépôt

### Next.js

- `next.config.*` : `output: "standalone"`.
- Dockerfile multi-stage : deps → builder → runner non-root.
- Copier `public` et `.next/static` dans `.next/standalone` si le Dockerfile ne le fait pas.
- `PORT`/`HOSTNAME` cohérents (3000 ou 8080 selon la cible).
- Health `/api/health` (sans dépendance) et readiness `/api/ready` (avec DB).
- `.dockerignore` : `node_modules`, `.next`, `data/`, `*.xlsx`, `.env*`, `*.sql`, `*.dump`,
  `.git`, `.github`, `docs/`.
- `.gitignore` : `.env*`, dumps, données réelles, artefacts.

### Prisma

- Image Debian slim (pas Alpine), `binaryTargets = ["native", "debian-openssl-3.0.x"]`.
- Copier `prisma/` avant `npm ci` si `postinstall` exécute `prisma generate`.
- `DATABASE_URL` factice aux étapes de build ; jamais de vraie base dans l'image.
- Ne pas exécuter `prisma migrate deploy` dans le build Docker.
- Si migration au démarrage : script local `demarrage.js` + `prisma migrate deploy` avant
  `server.js`, et inclure `prisma/`, `migrations/`, `node_modules/prisma` dans l'artefact.

### Drizzle

- Schéma et migrations SQL dans `drizzle/`.
- Migration runner applicatif (ex. `scripts/migrate.ts` ou `.mjs`) ou migration manuelle.
- `pg` + `sslmode=require` pour Azure PostgreSQL.
- Ne pas inclure les dumps dans l'image.

### Commun

- `.env.example` sans valeurs réelles ; `.env.<env>` gitignoré.
- Logs JSON sur stdout ; pas de fichiers d'état locaux.
- Vérifier `lint`, `typecheck`, `build` avant tout push.

## 7. Phase 1 — Ressources Azure

### ACR

```bash
az acr create -g "<RG>" -n "<ACR>" -l westeurope \
  --sku Basic --admin-enabled true --tags project="<PROJET>"
az acr show -n "<ACR>" --query "{loginServer:loginServer,admin:adminUserEnabled}" -o json
```

Pour OIDC : `--admin-enabled false` et `AcrPull` pour l'UAMI, `AcrPush` pour le SP CI.

### PostgreSQL Flexible Server

```bash
az postgres flexible-server create -g "<RG>" -n "<PG>" -l westeurope \
  --version 16 --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
  --public-access Enabled --admin-user "<ADMIN>" --admin-password "$PGPW" \
  --tags project="<PROJET>"
az postgres flexible-server db create -g "<RG>" -s "<PG>" --name "<DB>"
```

- TLS 1.2+ ; `require_secure_transport=on`.
- Firewall : règle services Azure (0.0.0.0) si nécessaire ; règle IP temporaire pour les
  migrations/imports, supprimée après.
- Ne jamais ouvrir à tout Internet durablement.

### Web App for Containers

```bash
az appservice plan create -g "<RG>" -n "<PLAN>" -l westeurope \
  --is-linux --sku B1 --tags project="<PROJET>"
az webapp create -g "<RG>" -p "<PLAN>" -n "<APP>" \
  --container-image-name "<ACR>.azurecr.io/<IMAGE>:<TAG>" \
  --tags project="<PROJET>"
```

Puis configurer le registry avec les options courantes `--container-image-name`,
`--container-registry-url/user/password`, les app settings (`WEBSITES_PORT`), always-on,
HTTPS only, TLS 1.2, FTPS off, health check et logs. Selon la version de la CLI,
`--health-check-path` peut être absent de `az webapp config set` : utiliser
`--generic-configurations "healthCheckPath=/api/health"`. Forcer un `az webapp restart`
après modification des app settings et attendre `/api/ready`.

### Azure Container Apps

Créer un environnement dédié et un Log Analytics dédié (recommandé) :

```bash
az monitor log-analytics workspace create -g "<RG>" -n "<APP>-logs" -l westeurope \
  --retention-time 30 --tags project="<PROJET>"
az containerapp env create -g "<RG>" -n "<APP>-env" -l westeurope \
  --logs-workspace-id "<CUSTOMER_ID>" --logs-workspace-key "<KEY>" \
  --tags project="<PROJET>"
```

L'environnement peut rester plusieurs minutes en `Waiting` avant `Succeeded` : vérifier
avec `az containerapp env show`, ne pas relancer en boucle.

Créer l'application avec une image immuable, l'ingress, les ressources et les secrets :

```bash
az containerapp create -g "<RG>" -n "<APP>" --environment "<APP>-env" \
  --image "<ACR>.azurecr.io/<IMAGE>:<SHA>" \
  --registry-server "<ACR>.azurecr.io" \
  --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
  --ingress external --target-port 3000 --transport auto \
  --min-replicas 1 --max-replicas 2 --cpu 0.5 --memory 1Gi \
  --secrets database-url="$DATABASE_URL" app-password="$APP_PASSWORD" \
    app-session-secret="$APP_SESSION_SECRET" \
  --env-vars NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE_URL=secretref:database-url APP_PASSWORD=secretref:app-password \
    APP_SESSION_SECRET=secretref:app-session-secret \
  --tags project="<PROJET>"
```

Ajouter ensuite les probes Startup/Readiness/Liveness (`/api/health`, `/api/ready`).
Le manifeste YAML utilisé pour les probes contient les valeurs de secrets : le générer
à la volée, le garder en `chmod 600` hors dépôt, puis le supprimer. Ne jamais le committer.

Vérifier l'image et la révision réellement actives :

```bash
az containerapp revision list -g "<RG>" -n "<APP>" -o table
az containerapp show -g "<RG>" -n "<APP>" \
  --query "{fqdn:properties.configuration.ingress.fqdn,image:properties.template.containers[0].image,min:properties.template.scale.minReplicas,max:properties.template.scale.maxReplicas}" -o json
```

## 8. Phase 2 — Secrets et configuration

- Générer les secrets avec `openssl rand -hex 32` (session) et un mot de passe DB fort.
- Stocker dans `.env.<env>` gitignoré (`chmod 600`), jamais dans le dépôt.
- App Service : app settings (`DATABASE_URL`, secrets applicatifs, `WEBSITES_PORT`).
- ACA : secrets (`az containerapp secret set`) + `secretref` dans les variables d'environnement.
  Le credential registry est aussi un secret (nom auto-généré du type
  `<acr><resourcegroup><acr>` sans séparateurs). Un changement de secret seul peut ne pas
  créer de révision : mettre à jour l'app ou redémarrer pour que le conteneur le lise.
- GitHub : secrets via UI/API ; variables non sensibles. Mode manuel : seuls les secrets
  ACR sont nécessaires au workflow de build/push.
- Rotation : documenter la procédure, ne jamais réutiliser un secret de sandbox en prod.
- Après déploiement, vérifier qu'aucun secret n'apparaît dans les logs. Pour un manifeste
  ACA temporaire, supprimer le fichier dès l'application.

## 9. Phase 3 — Copie de données

1. Geler les écritures sur la source.
2. Dump avec un client PostgreSQL de version ≥ source (Docker `postgres:17-alpine`).
3. `--data-only --no-owner --no-privileges` ; fichier hors dépôt (`/tmp/...`).
4. Restaurer dans l'ordre des dépendances (référentiels → imports → tables filles).
5. Resynchroniser les séquences `SERIAL` sur `MAX(id)`.
6. Contrôles : nombre d'imports, nombre de lignes, sommes par catégorie, readiness.
7. Supprimer la règle firewall temporaire, le dump et les fichiers de travail.
8. Consigner les comptages dans le runbook ; ne jamais afficher la chaîne source.

Compatibilité des versions :

- Un dump PG17 contient `SET transaction_timeout = 0;`, inconnu en PG16 : retirer ces lignes
  avant restauration, ou dumper avec un client de la version cible.
- Si le dump multi-table échoue en `SSL SYSCALL error: EOF detected`, dumper table par table
  puis concaténer les fichiers dans l'ordre des dépendances.
- Vérifier les séquences `SERIAL` et les sommes, pas seulement les `COUNT(*)`.

## 10. Phase 4 — Image et CI/CD

### Build/push ACR (admin)

```yaml
- uses: docker/setup-buildx-action@v3
- uses: docker/login-action@v3
  with:
    registry: ${{ vars.ACR_LOGIN_SERVER }}
    username: ${{ secrets.ACR_USERNAME }}
    password: ${{ secrets.ACR_PASSWORD }}
- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: |
      ${{ vars.ACR_LOGIN_SERVER }}/${{ vars.IMAGE_NAME }}:latest
      ${{ vars.ACR_LOGIN_SERVER }}/${{ vars.IMAGE_NAME }}:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Déploiement Web App for Containers (publish profile)

```yaml
- uses: azure/webapps-deploy@v3
  with:
    app-name: ${{ vars.WEBAPP_NAME }}
    publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
    images: ${{ vars.ACR_LOGIN_SERVER }}/${{ vars.IMAGE_NAME }}:${{ github.sha }}
```

### Déploiement App Service code/zip

- Build complet dans GitHub Actions (pas Oryx) ; `SCM_DO_BUILD_DURING_DEPLOYMENT=false`.
- Artefact zip avec `server.js` à la racine, `public`, `.next/static`, `package.json`,
  migrations si nécessaire.
- `azure/webapps-deploy@v3` avec `package` + publish profile.

### Déploiement ACA manuel (sans OIDC)

Mode recommandé quand les role assignments sont bloqués (Contributor seul) :

1. GitHub Actions construit et pousse l'image uniquement (tags SHA + `latest`).
2. Un opérateur met à jour la révision après validation :

```bash
az containerapp update -g "<RG>" -n "<APP>" \
  --image "<ACR>.azurecr.io/<IMAGE>:<SHA>" \
  --revision-suffix "<SHA_COURT>"
```

3. Vérifier la révision, `/api/ready`, puis les logs.
4. Le suffixe doit être unique et en minuscules ; en cas de conflit, l'omettre pour laisser
   ACA générer un suffixe.

### Déploiement ACA + OIDC

- `azure/login@v2` avec `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
- `docker/login`/`az acr login` + push, puis `az containerapp update --image`.
- Rôles : `AcrPush` sur l'ACR, `Contributor` sur l'app ACA (pas tout le RG).
- Vérifier `/api/ready` avec retries.

### Règles CI

- Lint/typecheck ; le build de production peut être fait par Docker.
- Pas de migration DB dans la CI par défaut.
- Secrets GitHub : noms seulement dans la doc ; valeurs jamais affichées.
- Attendre la readiness après déploiement ; échouer le job sinon. En mode manuel, la
  readiness est vérifiée par l'opérateur après `az containerapp update`.

## 11. Phase 5 — Recette

- Health et readiness publics.
- Connexion et parcours métier principal.
- Volumétrie et agrégats identiques à la source.
- Filtres, exports, imports, pages critiques.
- Logs sans erreur critique ; erreurs 5xx surveillées.
- Test d'import sur snapshot jetable puis nettoyage validé.
- Vérifier la configuration réellement exécutée (image/tag, port, variables).
- Résumé final sans secrets : URL, ressources, contrôles, points restants.

## 12. Phase 6 — Runbook, rollback, durcissement

Runbook minimum :

- architecture et noms des ressources ;
- commandes de logs, restart, redéploiement ;
- ACA : environnement/Log Analytics, révisions, probes, mise à jour manuelle de l'image ;
- rotation des secrets ;
- migrations et restauration DB ;
- rollback image/tag (révision ACA précédente, App Service temporaire si conservé) ;
- suppression des règles firewall temporaires ;
- dette de sécurité et plan de durcissement.

Durcissement :

- OIDC + UAMI à la place des credentials longue durée ;
- Key Vault / secrets managés ;
- private endpoint/VNet PostgreSQL ;
- suppression de la règle 0.0.0.0 ;
- alertes, budgets, rétention d'images ;
- séparation staging/prod.

## 13. Pièges fréquents

1. `npm ci` échoue sans schéma Prisma → copier `prisma/` avant.
2. `npm run build` lance une migration DB → utiliser un build dédié sans DB.
3. Prisma Alpine incompatible → Debian slim + binaryTargets.
4. Assets 404 en standalone → copier `public` et `.next/static`.
5. Zip déployé au mauvais niveau → `server.js` à la racine.
6. Build Oryx timeout → build dans GitHub Actions.
7. Script de démarrage absent du zip → le committer et l'inclure.
8. Migrations non appliquées → job manuel ou startup script fiable.
9. DB prod inaccessible depuis GitHub → migrations hors CI.
10. Firewall PostgreSQL oublié → règle temporaire + suppression.
11. `DATABASE_URL` sans SSL → `sslmode=require`.
12. Port non routé → `PORT`/`WEBSITES_PORT` cohérents.
13. Health check qui dépend de la DB → liveness séparée de readiness.
14. Secrets dans l'image/repo → `.dockerignore` + `.gitignore`.
15. Publish profile/ACR admin longue durée → rotation/OIDC.
16. Image ACR non utilisée en prod → vérifier la configuration réelle.
17. `AcrPush` + `az acr build` → échec `scheduleRun` ; utiliser docker push.
18. Role assignment impossible avec Contributor → arrêt et demande Owner/UAA.
19. Nom de Web App non globalement unique → vérifier avant création.
20. App registration refusée → arrêt, pas de contournement.
21. `postgres flexible-server db create` avec `-d` → échec ; utiliser `--name`.
22. `firewall-rule` avec `-n` → échec ; utiliser `--server-name` ; la création peut bloquer
    plusieurs minutes mais réussir, vérifier avec `firewall-rule list`.
23. Dump PG17 vers PG16 → `transaction_timeout` inconnu ; retirer les lignes ou dumper en 16.
24. Dump interrompu par `SSL SYSCALL error: EOF detected` → dump par tables puis concaténation.
25. `.env` avec valeurs entre guillemets + `grep | cut` → guillemets inclus dans le secret ;
    utiliser `set -a; . ./.env` ou parser les guillemets. Après correction, redémarrer le
    conteneur : les app settings peuvent ne pas rafraîchir le process en cours.
26. `az webapp config set --health-check-path` absent → `--generic-configurations
    "healthCheckPath=/api/health"`.
27. Options `--docker-*` dépréciées → utiliser `--container-*`.
28. `sslmode=require` avec `pg` → warning de sémantique ; `verify-full` en cible durcie.
29. `az containerapp create --revision-mode` non reconnu → le mode Single est le défaut ;
    ne pas relancer en boucle, vérifier `revision list`.
30. Création d'environnement ACA qui reste en `Waiting` → peut prendre plusieurs minutes ;
    vérifier `provisioningState` avant de conclure à un échec.
31. Image poussée dans ACR mais révision inchangée → ACA ne tire pas `latest` tout seul ;
    utiliser un tag SHA et `az containerapp update --image`.
32. Manifeste ACA avec valeurs de secrets → fichier temporaire `chmod 600` hors dépôt,
    supprimé après usage ; jamais commité.
33. Logs système ACA avec `FailedGetExternalMetric`/`FailedUpdateStatus` → souvent transitoire
    lors du remplacement d'une révision ; vérifier la révision courante et la santé.
34. Même nom pour App Service et ACA → types différents ; toujours préciser
    `Microsoft.Web/sites` ou `Microsoft.App/containerApps` dans les diagnostics.
35. `--revision-suffix` en conflit ou en majuscules → suffixe unique en minuscules ;
    l'omettre pour générer automatiquement.
36. ACA + PostgreSQL : la règle « services Azure » suffit pour l'egress public ; les IP
    sortantes peuvent changer, ne pas les coder en dur dans le firewall ; private endpoint
    en cible durcie.
37. `az containerapp secret set` seul → peut ne pas redémarrer la révision ; mettre à jour
    l'app ou redémarrer pour prendre en compte le secret.
38. Guillemets dans `.env` → parser avant de créer les secrets ACA, sinon le conteneur
    reçoit une valeur fausse et le login/DB échoue.
39. Test d'import sur la cible → toujours prévoir le nettoyage SQL et la remise à zéro des
    séquences, puis vérifier les comptages et les sommes.

## 14. Checklist finale

- [ ] Droits vérifiés (Contributor/Owner/UAA, app registration).
- [ ] Modèle d'hébergement et d'auth choisis explicitement.
- [ ] `.dockerignore` / `.gitignore` en place.
- [ ] Standalone + assets + health/readiness.
- [ ] Ressources créées avec tags et validées.
- [ ] PostgreSQL TLS + firewall minimal.
- [ ] Secrets hors dépôt, jamais affichés.
- [ ] Données copiées et contrôlées (si applicable), versions dump/cible compatibles.
- [ ] Secrets `.env` correctement parsés (guillemets) et conteneur redémarré après changement.
- [ ] Image buildée/poussée, tag de commit.
- [ ] ACA : environnement + Log Analytics dédiés, ingress/port/ressources/replicas validés.
- [ ] ACA : probes Startup/Readiness/Liveness, révision `Healthy`, logs sans erreur critique.
- [ ] CI/CD : build/push ACR opérationnel ; déploiement ACA manuel testé (ou OIDC validé).
- [ ] Recette fonctionnelle et logs OK.
- [ ] Import de test nettoyé (lignes + imports + séquences) et comptages/sommes vérifiés.
- [ ] App Service de rollback arrêté/supprimé selon la procédure et l'accord obtenu.
- [ ] Runbook, rollback et durcissement documentés.
- [ ] Aucun secret commité ni affiché.
