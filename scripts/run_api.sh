#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN=""
HOST="${CUA_HOST:-127.0.0.1}"
PORT="${CUA_PORT:-8000}"
RELOAD="${CUA_RELOAD:-1}"
LOG_LEVEL="${CUA_LOG_LEVEL:-info}"

cd "$ROOT_DIR"

if [[ -x ".conda-env/bin/python" ]]; then
  PYTHON_BIN="${ROOT_DIR}/.conda-env/bin/python"
elif [[ -x ".venv/bin/python" ]]; then
  PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"
else
  PYTHON_BIN="python3"
fi

export PYTHONUNBUFFERED=1

CMD=(
  "${PYTHON_BIN}"
  -m
  uvicorn
  server.app.main:app
  --host
  "${HOST}"
  --port
  "${PORT}"
  --log-level
  "${LOG_LEVEL}"
)

if [[ "${RELOAD}" == "1" || "${RELOAD}" == "true" || "${RELOAD}" == "yes" ]]; then
  CMD+=(--reload)
fi

exec "${CMD[@]}"
