#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_PREFIX="${CUA_CONDA_ENV_PREFIX:-${ROOT_DIR}/.conda-env}"

echo "Run the following command in your shell:"
echo
echo "  conda activate ${ENV_PREFIX}"
