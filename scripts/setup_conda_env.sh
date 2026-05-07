#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_PREFIX="${CUA_CONDA_ENV_PREFIX:-${ROOT_DIR}/.conda-env}"
PKGS_DIR="${CUA_CONDA_PKGS_DIR:-${ROOT_DIR}/.conda-pkgs}"
CACHE_DIR="${CUA_CACHE_DIR:-${ROOT_DIR}/.cache}"
CONDA_BIN="${CONDA_EXE:-$(command -v conda || true)}"

if [[ -z "${CONDA_BIN}" ]]; then
  echo "conda command not found. Please install or initialize conda first." >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/environment.yml" ]]; then
  echo "environment.yml not found in ${ROOT_DIR}" >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/requirements.txt" ]]; then
  echo "requirements.txt not found in ${ROOT_DIR}" >&2
  exit 1
fi

echo "Using conda: ${CONDA_BIN}"
echo "Project root: ${ROOT_DIR}"
echo "Environment prefix: ${ENV_PREFIX}"
echo "Package cache: ${PKGS_DIR}"
echo "General cache: ${CACHE_DIR}"

mkdir -p "$(dirname "${ENV_PREFIX}")"
mkdir -p "${PKGS_DIR}"
mkdir -p "${CACHE_DIR}"

export CONDA_PKGS_DIRS="${PKGS_DIR}"
export XDG_CACHE_HOME="${CACHE_DIR}"
export CONDA_NOTICES_ENABLED=false

PARTIAL_COUNT="$(find "${PKGS_DIR}" -name '*.partial' | wc -l | tr -d ' ')"
if [[ "${PARTIAL_COUNT}" != "0" ]]; then
  echo "Cleaning ${PARTIAL_COUNT} stale conda partial download(s)"
  find "${PKGS_DIR}" -name '*.partial' -delete
fi

if [[ -d "${ENV_PREFIX}" ]]; then
  echo "Conda environment already exists at: ${ENV_PREFIX}"
else
  echo "Creating conda environment at: ${ENV_PREFIX}"
  "${CONDA_BIN}" create -p "${ENV_PREFIX}" python=3.11 pip -y
fi

echo "Installing Python dependencies with the environment's pip"
"${ENV_PREFIX}/bin/python" -m pip install --upgrade pip
"${ENV_PREFIX}/bin/python" -m pip install -r "${ROOT_DIR}/requirements.txt"

echo
echo "Conda environment is ready."
echo "Activate it with:"
echo "  conda activate ${ENV_PREFIX}"
echo
echo "Then run:"
echo "  bash scripts/run_api.sh"
