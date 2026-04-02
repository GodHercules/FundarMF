$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\PC\Documents\FundarMF"
$backendDir = Join-Path $repoRoot "backend"
$apiDir = Join-Path $backendDir "api"
$testScript = Join-Path $repoRoot "scripts\local-e2e-form-submit.cjs"

$env:NOTIFY_MODE = "mock"
$env:NOTIFY_EMAIL_ENABLED = "false"
$env:NOTIFY_WHATSAPP_ENABLED = "false"
$env:N8N_WEBHOOK_ENABLED = "false"

Write-Host "==> Starting DB (docker compose)"
pnpm --dir $backendDir db:up

Write-Host "==> Prisma generate/deploy/seed"
pnpm --dir $backendDir --filter fundarmf-api prisma:generate
pnpm --dir $backendDir --filter fundarmf-api prisma:deploy
pnpm --dir $backendDir --filter fundarmf-api prisma:seed

Write-Host "==> Build API"
pnpm --dir $backendDir --filter fundarmf-api build

Write-Host "==> Start API"
$apiProcess = Start-Process -FilePath "node" -ArgumentList "dist/src/main.js" -WorkingDirectory $apiDir -PassThru

Write-Host "==> Waiting for health"
$healthUrl = "http://localhost:4000/public/health"
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $ready) {
  Write-Error "API não ficou pronta em 30s"
}

Write-Host "==> Run E2E test"
node $testScript

Write-Host "==> Stop API"
Stop-Process -Id $apiProcess.Id -Force

Write-Host "==> Done"
