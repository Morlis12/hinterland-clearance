<#
.SYNOPSIS
  Deploie une image ACR sur la Container App aglci-overdue, puis verifie la sante.

.DESCRIPTION
  Sans parametre : deploie le commit courant (git HEAD, doit etre pousse sur main
  pour que le workflow build-image ait construit l'image).
  Le mode de revision est Single : l'ancienne revision continue de servir le trafic
  tant que la nouvelle n'est pas saine.

.EXAMPLE
  .\scripts\deploy.ps1                       # deploie git HEAD
  .\scripts\deploy.ps1 -Tag 81c106a138e5...  # deploie un commit precis (SHA complet)
  .\scripts\deploy.ps1 -Tag 91a69d4 -Yes     # rollback vers l'ancienne image, sans confirmation
#>
[CmdletBinding()]
param(
    [string]$Tag,
    [switch]$Yes
)
$ErrorActionPreference = 'Stop'

$Rg   = 'rgci-aglci-ai'
$App  = 'aglci-overdue'
$Acr  = 'aglcioverdueacr'
$Repo = 'overdue-files'
$Url  = 'https://aglci-overdue.niceriver-3ee36e6e.westeurope.azurecontainerapps.io'

function Invoke-Az {
    $out = & az @args
    if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') a echoue (code $LASTEXITCODE)" }
    return $out
}

# 1. Connexion Azure
$acct = & az account show --query name -o tsv
if ($LASTEXITCODE -ne 0) { throw "Pas connecte a Azure : lance 'az login'." }
Write-Host "Abonnement : $acct"

# 2. Tag a deployer
if (-not $Tag) {
    $Tag = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Pas de depot git ici : passe -Tag <sha>." }
    $dirty = & git status --porcelain
    if ($dirty) { Write-Warning "Modifications locales non commitees : elles ne sont pas dans l'image." }
}
$short = $Tag.Substring(0, [Math]::Min(7, $Tag.Length)).ToLower()
$image = "$Acr.azurecr.io/${Repo}:$Tag"

# 3. L'image existe-t-elle dans ACR ?
$found = & az acr repository show-tags -n $Acr --repository $Repo --query "[?@=='$Tag']" -o tsv
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Impossible de lister les tags ACR ; je continue (Azure refusera si l'image manque)."
} elseif (-not $found) {
    throw "Image $image introuvable dans ACR. Le workflow 'Build and push image' est-il termine pour ce commit ?"
}

# 4. Etat actuel + confirmation
$current = Invoke-Az containerapp show -g $Rg -n $App --query "properties.template.containers[0].image" -o tsv
Write-Host "Image actuelle : $current"
Write-Host "Nouvelle image : $image"
if ($current -eq $image) { Write-Host "Deja deployee, rien a faire."; return }
if (-not $Yes) {
    $answer = Read-Host "Deployer sur la PRODUCTION ? (o/N)"
    if ($answer -notmatch '^[oOyY]') { Write-Host "Annule."; return }
}

# 5. Mise a jour (suffixe de revision unique ; repli sans suffixe en cas de conflit)
& az containerapp update -g $Rg -n $App --image $image --revision-suffix "v$short" -o none
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Echec avec le suffixe v$short, nouvel essai sans suffixe."
    Invoke-Az containerapp update -g $Rg -n $App --image $image -o none | Out-Null
}

# 6. Attente de la nouvelle revision (jusqu'a 3 minutes).
#    /api/ready seul ne suffit pas : en mode Single, l'ancienne revision peut encore repondre.
Write-Host "Attente de la nouvelle revision ..."
$ok = $false
for ($i = 1; $i -le 36; $i++) {
    Start-Sleep -Seconds 5
    $rev = (& az containerapp show -g $Rg -n $App --query "[properties.latestRevisionName, properties.latestReadyRevisionName]" -o tsv) -split "`n" | ForEach-Object { $_.Trim() }
    if ($LASTEXITCODE -eq 0 -and $rev.Count -ge 2 -and $rev[0] -and $rev[0] -eq $rev[1]) {
        try {
            $r = Invoke-WebRequest -Uri "$Url/api/ready" -UseBasicParsing -TimeoutSec 10
            if ($r.StatusCode -eq 200) { $ok = $true; Write-Host "Revision $($rev[0]) : $($r.Content)"; break }
        } catch { }
    }
}

if ($ok) {
    Write-Host "OK : $image"
} else {
    Write-Warning "La nouvelle revision n'est pas saine. L'ancienne revision sert encore le trafic."
    Write-Host "Logs :     az containerapp logs show -g $Rg -n $App --type console --tail 100"
    Write-Host "Rollback : .\scripts\deploy.ps1 -Tag $($current.Split(':')[-1]) -Yes"
    exit 1
}
