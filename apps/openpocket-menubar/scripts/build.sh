#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_ROOT="$(xcrun --show-sdk-path)"
MODULE_CACHE_DIR="$APP_DIR/.build/cc-module-cache"

swift_build() {
  mkdir -p "$MODULE_CACHE_DIR"
  swift build \
    -Xswiftc -Xcc \
    -Xswiftc -isysroot \
    -Xswiftc -Xcc \
    -Xswiftc "$SDK_ROOT" \
    -Xswiftc -Xcc \
    -Xswiftc "-fmodules-cache-path=$MODULE_CACHE_DIR"
}

cd "$APP_DIR"
if ! swift_build; then
  echo "[OpenPocket][panel] swift build failed; cleaning local build cache and retrying once..."
  rm -rf "$APP_DIR/.build"
  swift_build
fi
