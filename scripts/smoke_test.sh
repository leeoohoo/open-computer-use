#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${ROOT_DIR}/.conda-env/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  if [[ -x "${ROOT_DIR}/.venv/bin/python" ]]; then
    PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"
  else
    echo "No project Python environment found. Run bash scripts/setup_conda_env.sh first." >&2
    exit 1
  fi
fi

cd "${ROOT_DIR}"

echo "[1/3] Checking core imports"
"${PYTHON_BIN}" -c "from server.app.main import app; from executor.client.desktop.action_executor import DesktopActionExecutor; print(app.title)"

echo "[2/3] Running integration tests"
"${PYTHON_BIN}" -m unittest \
  tests.integration.test_coordinate_mapping \
  tests.integration.test_action_executor \
  tests.integration.test_agent_runner \
  tests.integration.test_chat_runner

echo "[3/3] Smoke test finished"
echo "Environment and core runtime look good."
