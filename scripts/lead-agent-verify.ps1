param(
  [switch]$SkipBackend,
  [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Name,
    [string]$Command,
    [string]$Workdir
  )

  Write-Host ""
  Write-Host "==> $Name"
  Push-Location $Workdir
  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      Invoke-Expression $Command 2>&1
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Step '$Name' failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

function Assert-Remote {
  param(
    [string]$RemoteName,
    [string]$ExpectedUrl
  )

  $actual = git remote get-url $RemoteName 2>$null
  if (-not $actual) {
    throw "Missing git remote '$RemoteName'."
  }

  if ($actual.Trim() -ne $ExpectedUrl) {
    throw "Remote '$RemoteName' points to '$actual' instead of '$ExpectedUrl'."
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot

if ($SkipBackend -and $SkipFrontend) {
  throw "At least one verification scope must remain enabled."
}

Write-Host "Lead agent verification started in $repoRoot"

Push-Location $repoRoot
try {
  Assert-Remote -RemoteName "origin" -ExpectedUrl "https://github.com/GodHercules/FundarMF.git"
  Assert-Remote -RemoteName "back" -ExpectedUrl "https://github.com/GodHercules/FundarMF_Back.git"
} finally {
  Pop-Location
}

if (-not $SkipBackend) {
  Invoke-Step -Name "Backend lint" -Command "pnpm lint" -Workdir (Join-Path $repoRoot "backend")
  Invoke-Step -Name "Backend build" -Command "pnpm build" -Workdir (Join-Path $repoRoot "backend")
  Invoke-Step -Name "Backend test" -Command "pnpm --filter fundarmf-api exec vitest run" -Workdir (Join-Path $repoRoot "backend")
}

if (-not $SkipFrontend) {
  Invoke-Step -Name "Frontend lint" -Command "pnpm lint" -Workdir (Join-Path $repoRoot "frontend")
  Invoke-Step -Name "Frontend typecheck" -Command "pnpm exec tsc --noEmit" -Workdir (Join-Path $repoRoot "frontend")
  Invoke-Step -Name "Frontend build" -Command "pnpm build" -Workdir (Join-Path $repoRoot "frontend")
  Invoke-Step -Name "Frontend test" -Command "pnpm exec vitest run" -Workdir (Join-Path $repoRoot "frontend")
}

Write-Host ""
Write-Host "Lead agent verification finished successfully."
