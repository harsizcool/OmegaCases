#!/usr/bin/env bash
# Builds the setup program as a plain executable for each platform.
# Run from the installer directory:  ./build.sh
#
# No packaging: each file in dist/ is a single self-contained binary that runs
# as-is. There is nothing to install and no runtime to provide.
set -euo pipefail

VERSION="${VERSION:-1.0.0}"
OUT="$(pwd)/dist"

# A stamp of when and from what this was built, so a report of what a binary did
# can be tied to the source it came from. The version number alone cannot do
# that: it does not change between builds.
STAMP="$(date -u +%Y%m%d-%H%M)"
if COMMIT="$(git rev-parse --short HEAD 2>/dev/null)"; then
  STAMP="${STAMP}-${COMMIT}"
fi

LDFLAGS="-s -w -X main.version=${VERSION} -X main.buildStamp=${STAMP}"

rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> tests"
go test ./...

build() {
  local goos="$1" goarch="$2" name="$3"
  echo "==> $name ($goos/$goarch)"
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
    go build -trimpath -ldflags "$LDFLAGS" -o "$OUT/$name" .
  # Linux and macOS copies have to be executable when they arrive, however they
  # were transferred.
  [ "$goos" = "windows" ] || chmod +x "$OUT/$name"
}

build windows amd64 SETUP.EXE
build linux   amd64 omegacases-setup-linux
build linux   arm64 omegacases-setup-linux-arm64

cat > "$OUT/README.txt" <<'NOTES'
OmegaCases setup — pick the one file for your machine and run it.

  Windows                        SETUP.EXE                      (double-click)
  Linux, normal PC or server     omegacases-setup-linux
  Linux, ARM (Raspberry Pi, …)   omegacases-setup-linux-arm64

On Linux or macOS, mark it executable once and run it with sudo (the web server
needs ports 80 and 443, and installing Docker needs root):

    chmod +x omegacases-setup-linux
    sudo ./omegacases-setup-linux

You do not need anything else first. If the source code or Docker is missing,
setup offers to fetch them.
NOTES

echo
echo "Built into $OUT:"
ls -lh "$OUT"
