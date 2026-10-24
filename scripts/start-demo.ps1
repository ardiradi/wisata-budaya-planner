param([switch]$Rebuild)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 LTS before running this local demo.' }
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') { throw 'This locked project requires Node.js 24 LTS.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/next/package.json'))) {
  throw 'Dependencies are missing. Run npm ci while package downloads are available, then rerun this script. Runtime planning needs no internet provider.'
}
$running = $null
try { $running = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2 } catch { }
if ($running) {
  if ($running.Content -notmatch 'Wisata Budaya|wisatabudaya') { throw 'Port 3000 belongs to another application. Stop that application or use npm run dev -- --port 3001.' }
  if ($Rebuild) { throw 'Stop the existing preview before requesting -Rebuild.' }
  Write-Host 'Local preview is already running: http://127.0.0.1:3000/'
  Write-Host 'Traveler demo: /rencana | Editorial simulation: /editorial'
  exit 0
}
if ($Rebuild -or -not (Test-Path -LiteralPath (Join-Path $projectRoot '.next/BUILD_ID'))) {
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'The optimized local build failed. Read the diagnostics before presenting.' }
}
Write-Host 'Synthetic local demonstration. No API keys, live providers, accounts or database.'
Write-Host 'Open http://127.0.0.1:3000/ after Ready appears. Ctrl+C stops the preview.'
& npm run start
exit $LASTEXITCODE
