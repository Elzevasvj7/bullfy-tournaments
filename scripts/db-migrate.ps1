$ErrorActionPreference = "Stop"

$container = "bullfy-tournaments-postgres"
$database = "bullfy_tournaments"
$user = "bullfy"
$root = Split-Path -Parent $PSScriptRoot

function Wait-Postgres {
  for ($i = 0; $i -lt 30; $i++) {
    docker exec $container pg_isready -U $user -d $database | Out-Null
    if ($LASTEXITCODE -eq 0) {
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "Postgres container is not ready."
}

function Invoke-SqlFile {
  param([string] $Path)

  Get-Content -Raw -LiteralPath $Path |
    docker exec -i $container psql -U $user -d $database -v ON_ERROR_STOP=1

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply SQL file: $Path"
  }
}

Wait-Postgres

$migrationFiles = Get-ChildItem -Path (Join-Path $root "db/migrations") -Filter "*.sql" | Sort-Object Name

foreach ($file in $migrationFiles) {
  Write-Host "Applying migration $($file.Name)"
  Invoke-SqlFile -Path $file.FullName
}

Write-Host "Migrations applied."
