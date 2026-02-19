#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_SCRIPT="$SCRIPT_DIR/build.sh"
APP_BIN="$APP_DIR/.build/debug/OpenPocketMenuBar"

VERSION="${1:-0.0.1}"
APP_NAME="OpenPocket Control Panel.app"
RELEASE_DIR="$APP_DIR/dist/release"
APP_BUNDLE="$RELEASE_DIR/$APP_NAME"
ZIP_NAME="openpocket-panel-macos-v${VERSION}.zip"
ZIP_PATH="$RELEASE_DIR/$ZIP_NAME"

"$BUILD_SCRIPT"

if [[ ! -x "$APP_BIN" ]]; then
  echo "[OpenPocket][panel] built binary not found: $APP_BIN" >&2
  exit 1
fi

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

cp "$APP_BIN" "$APP_BUNDLE/Contents/MacOS/OpenPocketMenuBar"
chmod +x "$APP_BUNDLE/Contents/MacOS/OpenPocketMenuBar"

cat >"$APP_BUNDLE/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>OpenPocket Control Panel</string>
  <key>CFBundleExecutable</key>
  <string>OpenPocketMenuBar</string>
  <key>CFBundleIdentifier</key>
  <string>com.openpocket.menubar</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>OpenPocket Control Panel</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${VERSION}</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

mkdir -p "$RELEASE_DIR"
rm -f "$ZIP_PATH"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_BUNDLE" "$ZIP_PATH"

echo "[OpenPocket][panel] release package created: $ZIP_PATH"
