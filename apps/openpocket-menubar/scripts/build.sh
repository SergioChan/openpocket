#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_ROOT="$(xcrun --show-sdk-path)"

cd "$APP_DIR"
swift build \
  -Xswiftc -Xcc \
  -Xswiftc -isysroot \
  -Xswiftc -Xcc \
  -Xswiftc "$SDK_ROOT"
