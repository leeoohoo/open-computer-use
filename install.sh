#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${ROOT_DIR}"

echo "==> Setting up project-local conda environment"
bash scripts/setup_conda_env.sh

echo
echo "==> Running smoke test"
bash scripts/smoke_test.sh

echo
echo "Install complete."
echo "Start the API with:"
echo "  bash start.sh"
