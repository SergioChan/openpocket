#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="${OPENPOCKET_E2E_IMAGE_TAG:-openpocket-e2e:local}"
SHM_SIZE="${OPENPOCKET_E2E_SHM_SIZE:-2g}"

cd "${ROOT_DIR}"

echo "[e2e] Building Docker image: ${IMAGE_TAG}"
docker build -f docker/e2e/Dockerfile -t "${IMAGE_TAG}" .

echo "[e2e] Running Docker container"
docker run --rm \
  --shm-size="${SHM_SIZE}" \
  -e OPENPOCKET_E2E_TASK="${OPENPOCKET_E2E_TASK:-Open Android Settings, then return to the home screen, then finish.}" \
  "${IMAGE_TAG}"
