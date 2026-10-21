#!/usr/bin/env bash
# Deploie une image ACR sur la Container App aglci-overdue, puis verifie la sante.
# Equivalent bash de scripts/deploy.ps1 (meme logique).
#
# Sans option : deploie le commit courant (git HEAD, doit etre pousse sur main pour que
# le workflow build-image ait construit l'image). Mode de revision Single : l'ancienne
# revision continue de servir le trafic tant que la nouvelle n'est pas saine.
#
# Usage :
#   ./scripts/deploy.sh                    # deploie git HEAD
#   ./scripts/deploy.sh -t <sha-complet>   # deploie un commit precis
#   ./scripts/deploy.sh -t 91a69d4 -y      # rollback vers l'ancienne image, sans confirmation
set -euo pipefail

RG="rgci-aglci-ai"
APP="aglci-overdue"
ACR="aglcioverdueacr"
REPO="overdue-files"
URL="https://aglci-overdue.niceriver-3ee36e6e.westeurope.azurecontainerapps.io"

TAG=""
YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    -t|--tag) TAG="${2:?Valeur manquante pour $1}"; shift 2 ;;
    -y|--yes) YES=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

die() { echo "ERREUR : $*" >&2; exit 1; }
warn() { echo "ATTENTION : $*" >&2; }

# 1. Connexion Azure
acct=$(az account show --query name -o tsv 2>/dev/null | tr -d '\r') || die "Pas connecte a Azure : lance 'az login'."
echo "Abonnement : $acct"

# 2. Tag a deployer
if [ -z "$TAG" ]; then
  TAG=$(git rev-parse HEAD 2>/dev/null) || die "Pas de depot git ici : passe -t <sha>."
  [ -z "$(git status --porcelain)" ] || warn "Modifications locales non commitees : elles ne sont pas dans l'image."
fi
short=$(printf '%s' "${TAG:0:7}" | tr '[:upper:]' '[:lower:]')
image="$ACR.azurecr.io/$REPO:$TAG"

# 3. L'image existe-t-elle dans ACR ?
if found=$(az acr repository show-tags -n "$ACR" --repository "$REPO" --query "[?@=='$TAG']" -o tsv 2>/dev/null | tr -d '\r'); then
  [ -n "$found" ] || die "Image $image introuvable dans ACR. Le workflow 'Build and push image' est-il termine pour ce commit ?"
else
  warn "Impossible de lister les tags ACR ; je continue (Azure refusera si l'image manque)."
fi

# 4. Etat actuel + confirmation
current=$(az containerapp show -g "$RG" -n "$APP" --query "properties.template.containers[0].image" -o tsv | tr -d '\r')
echo "Image actuelle : $current"
echo "Nouvelle image : $image"
if [ "$current" = "$image" ]; then echo "Deja deployee, rien a faire."; exit 0; fi
if [ "$YES" -ne 1 ]; then
  read -r -p "Deployer sur la PRODUCTION ? (o/N) " answer
  case "$answer" in [oOyY]*) ;; *) echo "Annule."; exit 0 ;; esac
fi

# 5. Mise a jour (suffixe de revision unique ; repli sans suffixe en cas de conflit)
if ! az containerapp update -g "$RG" -n "$APP" --image "$image" --revision-suffix "v$short" -o none; then
  warn "Echec avec le suffixe v$short, nouvel essai sans suffixe."
  az containerapp update -g "$RG" -n "$APP" --image "$image" -o none
fi

# 6. Attente de la nouvelle revision (jusqu'a 3 minutes).
#    /api/ready seul ne suffit pas : en mode Single, l'ancienne revision peut encore repondre.
echo "Attente de la nouvelle revision ..."
ok=0
for _ in $(seq 1 36); do
  sleep 5
  revs=$(az containerapp show -g "$RG" -n "$APP" \
    --query "[properties.latestRevisionName, properties.latestReadyRevisionName]" -o tsv 2>/dev/null | tr -d '\r' || true)
  latest=$(printf '%s\n' "$revs" | sed -n 1p)
  ready=$(printf '%s\n' "$revs" | sed -n 2p)
  if [ -n "$latest" ] && [ "$latest" = "$ready" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$URL/api/ready" || true)
    if [ "$code" = "200" ]; then
      ok=1
      echo "Revision $latest : /api/ready -> HTTP $code"
      break
    fi
  fi
done

if [ "$ok" -eq 1 ]; then
  echo "OK : $image"
else
  warn "La nouvelle revision n'est pas saine. L'ancienne revision sert encore le trafic."
  echo "Logs :     az containerapp logs show -g $RG -n $APP --type console --tail 100"
  echo "Rollback : ./scripts/deploy.sh -t ${current##*:} -y"
  exit 1
fi
