# Starts the API server + frontend for local Windows development.
#
# api-server and @workspace/db load DATABASE_URL/JWT_SECRET/PORT straight from
# the workspace-root .env at process startup (see artifacts/api-server/src/loadEnv.ts
# and lib/db/src/loadEnv.ts) — no manual $env forwarding needed for those.
# This script only reads PORT/VITE_PORT itself, to wire the frontend dev
# server's proxy target at the backend port.
$env:PATH = "C:\Program Files\Git\bin;C:\Program Files\Git\usr\bin;" + $env:PATH
# Prevents Git Bash/MSYS from rewriting POSIX-looking env values (e.g. BASE_PATH="/") into Windows paths
$env:MSYS_NO_PATHCONV = "1"
$env:MSYS2_ARG_CONV_EXCL = "*"

$envValues = @{}
Get-Content "$PSScriptRoot\.env" | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $name, $value = $_ -split '=', 2
    $envValues[$name] = $value
}
$apiPort = $envValues["PORT"]
$vitePort = $envValues["VITE_PORT"]

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "`$env:PATH='$env:PATH'; `$env:MSYS_NO_PATHCONV='1'; `$env:MSYS2_ARG_CONV_EXCL='*'; `$env:NODE_ENV='development'; cd '$PSScriptRoot'; pnpm --filter @workspace/api-server run dev"
)

Start-Sleep -Seconds 3

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "`$env:PATH='$env:PATH'; `$env:MSYS_NO_PATHCONV='1'; `$env:MSYS2_ARG_CONV_EXCL='*'; `$env:PORT='$vitePort'; `$env:BASE_PATH='/'; `$env:API_PROXY_TARGET='http://localhost:$apiPort'; `$env:NODE_ENV='development'; cd '$PSScriptRoot'; pnpm --filter @workspace/pos-system run dev"
)

Write-Host "API server: http://localhost:$apiPort"
Write-Host "Frontend:   http://localhost:$vitePort"
