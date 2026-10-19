# Prompt réutilisable — Intégrer `<PROJET>` sur Azure

Copier tout le bloc ci-dessous dans opencode, puis remplacer les `<...>`. Ne jamais coller
de secrets réels dans ce prompt.

---

Tu es mon assistant DevOps. Intègre `<PROJET>` sur Azure en suivant le playbook
`docs/azure-integration-playbook.md` et, si disponible, le skill `azure-integration`.

## Contexte

- Projet : `<PROJET>`
- Repo GitHub : `<URL_REPO>` (branche `<BRANCHE>`, public/privé : `<...>`)
- Stack : `<Next.js version / Node / TypeScript / Prisma ou Drizzle / PostgreSQL / ...>`
- URL souhaitée : `<https://...>`
- Domaine métier : `<...>`
- Hébergement souhaité : `<App Service code/zip | Web App for Containers | Azure Container Apps>`
- Auth CI/CD souhaitée : `<publish profile + ACR admin | OIDC + UAMI | à décider>`
- Base : `<PostgreSQL Flexible Server | existante | autre>`
- Health / readiness : `<chemins>`
- Migration DB : `<commande manuelle | au démarrage | job dédié>`
- Données à migrer : `<volume, source, fenêtre de gel>`
- Secrets applicatifs (noms seulement) : `<...>`
- Environnement : `<sandbox | prod>` ; staging : `<oui/non>`

## Règles

1. Commence par **lire le playbook** et **inventorier** l'existant avec `az` (lecture seule).
2. Vérifie les droits : Contributor suffit pour créer les ressources, pas pour attribuer des
   rôles. OIDC/UAMI exigent Owner ou User Access Administrator. Si un droit manque :
   **arrête-toi et signale-le**, sans fallback silencieux.
3. Pose les questions du playbook (section 3) avant de créer quoi que ce soit. Propose un
   plan avec étapes, commandes, checkpoints et rollback. Attends validation.
4. Annonce chaque commande `az` qui crée ou modifie une ressource et attends validation.
5. N'affiche jamais un secret (mot de passe, chaîne de connexion, publish profile,
   identifiants ACR, clé IA/email). Utilise des variables shell ou des fichiers temporaires
   `chmod 600` hors dépôt, puis supprime-les.
6. Ne supprime aucune ressource existante sans accord explicite.
7. Gèle la source pendant la copie de données ; vérifie les comptages et agrégats après.
8. Les migrations DB ne tournent pas en CI par défaut. Documente la procédure manuelle.
9. Ne confonds pas « image poussée dans ACR » et « image réellement exécutée en prod ».
10. Termine par la recette, les logs, le runbook et un résumé **sans secrets**.

## Livrables attendus

- `Dockerfile` et `.dockerignore` adaptés (si conteneur).
- `.gitignore` complété (secrets, dumps, données).
- Workflow(s) GitHub Actions : build image, déploiement, readiness.
- Liste des secrets/variables GitHub (noms seulement) et procédure de saisie.
- Ressources Azure créées/configurées avec tags.
- Données copiées et contrôlées (si applicable).
- `docs/migration-<projet>.md` : runbook (logs, restart, migrations, rollback, rotation,
  durcissement).
- Recette fonctionnelle et résumé final sans secrets.

## Checkpoints obligatoires

1. Inventaire + droits + questions → plan validé.
2. Repo prêt (Dockerfile, ignore, rename, health) → validation.
3. Ressources réseau/registry/DB → validation.
4. Secrets configurés (sans affichage) → validation.
5. Copie de données + contrôles → validation.
6. Image/CI/CD → validation.
7. Recette + runbook + résumé → validation.

Commence par l'inventaire et les questions. Ne crée rien avant mon accord explicite.
