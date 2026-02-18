#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_SCRIPT="$SCRIPT_DIR/build.sh"
APP_BIN="$APP_DIR/.build/debug/OpenPocketMenuBar"

"$BUILD_SCRIPT"

if [[ ! -x "$APP_BIN" ]]; then
  echo "[OpenPocket][panel] built binary not found: $APP_BIN" >&2
  exit 1
fi

exec "$APP_BIN"
