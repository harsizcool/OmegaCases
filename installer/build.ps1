# Builds the setup program on Windows. build.sh builds every platform at once
# and needs a POSIX shell — Git Bash is enough:  bash ./build.sh
param([string]$Version = "1.0.0")

$ErrorActionPreference = "Stop"
$out = Join-Path $PSScriptRoot "dist"
$ldflags = "-s -w -X main.version=$Version"

Write-Host "==> tests"
go test ./...
if ($LASTEXITCODE -ne 0) { throw "tests failed" }

New-Item -ItemType Directory -Force $out | Out-Null

Write-Host "==> SETUP.EXE (windows/amd64)"
$env:CGO_ENABLED = "0"; $env:GOOS = "windows"; $env:GOARCH = "amd64"
go build -trimpath -ldflags $ldflags -o (Join-Path $out "SETUP.EXE") .
if ($LASTEXITCODE -ne 0) { throw "windows build failed" }

Write-Host "==> omegacases-setup (linux/amd64)"
$env:GOOS = "linux"
go build -trimpath -ldflags $ldflags -o (Join-Path $out "omegacases-setup") .
if ($LASTEXITCODE -ne 0) { throw "linux build failed" }

Remove-Item Env:GOOS, Env:GOARCH, Env:CGO_ENABLED
Get-ChildItem $out | Select-Object Name, Length
