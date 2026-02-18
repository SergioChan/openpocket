# OpenPocket Menu Bar App (macOS)

Native macOS menu bar control panel for OpenPocket.

## What it provides

- Menu bar icon (status item), no Dock icon (`NSApplication` accessory mode)
- Control panel UI for runtime operations
- UI onboarding flow (no CLI onboarding required)
- Permission controls for local file viewing
- Storage root and view scope controls (subpaths + file extensions)
- Agent prompt file management (open/edit/save prompt files)
- Gateway process lifecycle controls
- Emulator start/stop/show/hide controls

## Requirements

- macOS 13+
- Xcode command-line tools
- OpenPocket runtime initialized (`openpocket init`)

## Build

```bash
cd /Users/sergiochan/Documents/GitHub/phone-use-agent/apps/openpocket-menubar
./scripts/build.sh
```

## Run

```bash
cd /Users/sergiochan/Documents/GitHub/phone-use-agent/apps/openpocket-menubar
./scripts/run.sh
```

Or from repo root:

```bash
openpocket panel start
```

## Notes

- In this environment, Swift builds require `-isysroot` flags because `/usr/local/include/Block.h` conflicts with Apple SDK headers.
- The provided scripts include the required flags automatically.
