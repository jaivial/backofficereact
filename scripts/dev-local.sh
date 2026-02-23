#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKOFFICE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${BACKOFFICE_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_DIR}/backend"

BACKEND_ORIGIN="${BACKEND_ORIGIN:-http://127.0.0.1:8080}"
BACKEND_HEALTH_URL="${BACKEND_ORIGIN%/}/healthz"
BACKEND_STARTED=0
BACKEND_PID=""

backend_is_ready() {
  curl -fsS --max-time 1 "${BACKEND_HEALTH_URL}" >/dev/null 2>&1
}

cleanup() {
  if [[ "${BACKEND_STARTED}" -eq 1 && -n "${BACKEND_PID}" ]]; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
    wait "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if backend_is_ready; then
  echo "[dev-local] backend already running at ${BACKEND_ORIGIN}"
else
  echo "[dev-local] backend unreachable at ${BACKEND_ORIGIN}; starting Go backend..."
  (
    cd "${BACKEND_DIR}"
    unset PORT
    go run ./cmd/server
  ) &
  BACKEND_PID=$!
  BACKEND_STARTED=1

  for _ in $(seq 1 80); do
    if backend_is_ready; then
      break
    fi
    if ! kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
      echo "[dev-local] backend exited before becoming ready." >&2
      exit 1
    fi
    sleep 0.25
  done

  if ! backend_is_ready; then
    echo "[dev-local] backend still unreachable at ${BACKEND_ORIGIN}." >&2
    exit 1
  fi
fi

cd "${BACKOFFICE_DIR}"
bun --env-file .env.local server/index.ts
