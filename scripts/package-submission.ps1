$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$outputDir = Join-Path $projectRoot 'submission'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$archivePath = Join-Path $outputDir 'Wisata-Budaya-Planner-Source.zip'
$allowedRoots = @('src', 'public', 'scripts', 'tests', 'docs', 'submission')
$rootFiles = @('README.md', 'AGENTS.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'netlify.toml', 'postcss.config.mjs', 'eslint.config.mjs', 'playwright.config.ts', 'playwright.deployment.config.ts', 'vitest.config.ts', 'components.json', '.gitignore', '.gitattributes', '.npmrc', '.prettierignore')
$files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
foreach ($name in $rootFiles) { $files.Add((Get-Item -LiteralPath (Join-Path $projectRoot $name))) }
foreach ($relative in $allowedRoots) {
  $target = Join-Path $projectRoot $relative
  if (Test-Path -LiteralPath $target) {
    foreach ($file in Get-ChildItem -LiteralPath $target -Recurse -File -Force) {
      $entry = $file.FullName.Substring($projectRoot.Length + 1).Replace([System.IO.Path]::DirectorySeparatorChar, [char]'/')
      # Unpublished research and raw internal measurement output are not judge deliverables.
      if ($entry -match '^docs/(research|evidence)/') { continue }
      if ($entry -match '(^|/)(node_modules|\.next|\.git|\.netlify|\.submission-build|\.local-demo|test-results|playwright-report|__pycache__)(/|$)' -or $file.Name -like '.env*' -or $file.Extension -in @('.zip', '.log', '.pyc', '.tsbuildinfo', '.mp4', '.webm', '.mov', '.wav', '.mp3') -or $file.Name -match '(?i)(credential|secret|private[-_]?key)') { continue }
      $files.Add($file)
    }
  }
}
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files | Sort-Object FullName -Unique) {
    $entry = $file.FullName.Substring($projectRoot.Length + 1).Replace([System.IO.Path]::DirectorySeparatorChar, [char]'/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $stream.Dispose() }
$verifyDir = Join-Path $projectRoot ('.submission-build/archive-verify-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff'))
# Extraction target is explicitly constrained to this workspace's private build directory.
if (-not ([System.IO.Path]::GetFullPath($verifyDir).StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase))) { throw 'Invalid verification target.' }
[System.IO.Compression.ZipFile]::ExtractToDirectory($archivePath, $verifyDir)
$verified = 0
foreach ($file in $files | Sort-Object FullName -Unique) {
  $relative = $file.FullName.Substring($projectRoot.Length + 1)
  $copy = Join-Path $verifyDir $relative
  if (-not (Test-Path -LiteralPath $copy)) { throw "Archive is missing $relative" }
  if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash) { throw "Archive integrity mismatch: $relative" }
  $verified++
}
Write-Host "Verified $verified extracted files against source SHA-256 hashes."
Write-Host "Source archive: $archivePath"
Write-Host "SHA-256: $((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash)"
