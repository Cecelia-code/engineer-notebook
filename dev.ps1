$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$bundledModules = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"

if (Test-Path $bundledModules) {
  if ($env:NODE_PATH) {
    $env:NODE_PATH = "$bundledModules;$env:NODE_PATH"
  } else {
    $env:NODE_PATH = $bundledModules
  }
}

if (Test-Path $bundledNode) {
  & $bundledNode ".\scripts\dev.mjs"
  exit $LASTEXITCODE
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw "Node.js not found. Install Node.js or ensure the Codex bundled runtime exists."
}

& $nodeCommand.Source ".\scripts\dev.mjs"
