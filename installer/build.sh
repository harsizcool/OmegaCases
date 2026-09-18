#!/usr/bin/env bash
# Builds the setup program for Windows and Linux, and packages the Linux build
# as a .deb. Run from the installer directory:  ./build.sh
set -euo pipefail

VERSION="${VERSION:-1.0.0}"
OUT="$(pwd)/dist"
LDFLAGS="-s -w -X main.version=${VERSION}"

rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> tests"
go test ./...

echo "==> SETUP.EXE (windows/amd64)"
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "$LDFLAGS" -o "$OUT/SETUP.EXE" .

echo "==> omegacases-setup (linux/amd64)"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "$LDFLAGS" -o "$OUT/omegacases-setup" .

echo "==> omegacases-setup-arm64 (linux/arm64)"
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags "$LDFLAGS" -o "$OUT/omegacases-setup-arm64" .

# ── Debian package ──────────────────────────────────────────────────────────
# Built by hand rather than with dpkg-deb, so the .deb can be produced from any
# machine with Go and tar, including Windows.
build_deb() {
  local arch="$1" binary="$2"
  local work="$OUT/deb-$arch"
  local pkg="omegacases-setup_${VERSION}_${arch}"

  rm -rf "$work"
  mkdir -p "$work/DEBIAN" "$work/usr/bin" "$work/usr/share/doc/omegacases-setup"
  install -m 0755 "$binary" "$work/usr/bin/omegacases-setup"
  install -m 0644 README.md "$work/usr/share/doc/omegacases-setup/README.md" 2>/dev/null || true

  local size
  size=$(du -sk "$work/usr" | cut -f1)

  cat > "$work/DEBIAN/control" <<CONTROL
Package: omegacases-setup
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${arch}
Depends: ca-certificates
Recommends: docker.io | docker-ce
Installed-Size: ${size}
Maintainer: OmegaCases <harsiscoolasemota@gmail.com>
Description: Guided installer for the OmegaCases website
 Sets up OmegaCases on one machine: the PostgreSQL database and data API,
 live updates, image storage, the site itself, and a reverse proxy that
 obtains and renews its own HTTPS certificate.
 .
 Run "sudo omegacases-setup" from the directory holding the OmegaCases
 source code.
CONTROL

  cat > "$work/DEBIAN/postinst" <<'POSTINST'
#!/bin/sh
set -e
if ! command -v docker >/dev/null 2>&1; then
  echo ""
  echo "omegacases-setup is installed, but Docker is not."
  echo "Install it first:   curl -fsSL https://get.docker.com | sh"
  echo ""
fi
echo "Next: cd into the OmegaCases source directory and run  sudo omegacases-setup"
POSTINST
  chmod 0755 "$work/DEBIAN/postinst"

  # A .deb is an ar archive of exactly three members, in this order, and dpkg
  # requires these exact names — so they are assembled in their own directory
  # rather than being renamed per package.
  local staging="$OUT/ar-$arch"
  rm -rf "$staging"
  mkdir -p "$staging"
  tar --numeric-owner --owner=0 --group=0 -czf "$staging/control.tar.gz" -C "$work/DEBIAN" .
  tar --numeric-owner --owner=0 --group=0 -czf "$staging/data.tar.gz" -C "$work" ./usr
  printf '2.0\n' > "$staging/debian-binary"
  ( cd "$staging" && ar rc "$pkg.deb" debian-binary control.tar.gz data.tar.gz )
  mv "$staging/$pkg.deb" "$OUT/$pkg.deb"
  rm -rf "$staging" "$work"
  echo "==> $pkg.deb"
}

if command -v ar >/dev/null 2>&1; then
  build_deb amd64 "$OUT/omegacases-setup"
  build_deb arm64 "$OUT/omegacases-setup-arm64"
else
  echo "!! 'ar' is not available, so the .deb was skipped."
  echo "   The plain Linux binaries in dist/ work on their own."
fi

echo
echo "Built into $OUT:"
ls -lh "$OUT"
