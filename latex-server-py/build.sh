#!/usr/bin/env bash
# Vercel build script — downloads the tectonic static binary so it can be
# bundled into the Lambda via vercel.json `includeFiles`.
set -euo pipefail

mkdir -p bin

TECTONIC_URL="https://github.com/tectonic-typesetting/tectonic/releases/latest/download/tectonic-x86_64-unknown-linux-musl.tar.gz"

echo "Downloading tectonic..."
curl -fsSL "$TECTONIC_URL" | tar xz -C bin/
chmod +x bin/tectonic

echo "tectonic ready: $(bin/tectonic --version)"
