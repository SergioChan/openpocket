#!/usr/bin/env bash
set -euo pipefail

cd /workspace

npm run build
node test/integration/docker-agent-e2e.mjs
