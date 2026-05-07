#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${CUA_HOST:-127.0.0.1}"
PORT="${CUA_PORT:-8000}"
RELOAD="${CUA_RELOAD:-0}"
OPEN_BROWSER="${CUA_OPEN_BROWSER:-1}"
AUTO_REQUEST_PERMISSIONS="${CUA_AUTO_REQUEST_PERMISSIONS:-1}"
HEALTH_TIMEOUT_SECONDS="${CUA_HEALTH_TIMEOUT_SECONDS:-60}"
SERVER_LOG="${OPEN_COMPUTER_USE_SERVER_LOG:-${ROOT_DIR}/server_debug.log}"
CHAT_LOG="${OPEN_COMPUTER_USE_CHAT_LOG:-${ROOT_DIR}/chat_debug.log}"
SERVER_CONFIG="${OPEN_COMPUTER_USE_SERVER_CONFIG:-${ROOT_DIR}/server_config.json}"
PYTHON_BIN=""
BOOTSTRAP_PID=""
SERVER_PID=""

if [[ "${HOST}" == "0.0.0.0" ]]; then
  BROWSER_HOST="${CUA_BROWSER_HOST:-127.0.0.1}"
else
  BROWSER_HOST="${CUA_BROWSER_HOST:-${HOST}}"
fi

BASE_URL="http://${BROWSER_HOST}:${PORT}"
HEALTH_URL="${BASE_URL}/health"
UI_URL="${BASE_URL}/"
MCP_URL="${BASE_URL}/mcp"

cd "${ROOT_DIR}"

if [[ -x ".conda-env/bin/python" ]]; then
  PYTHON_BIN="${ROOT_DIR}/.conda-env/bin/python"
elif [[ -x ".venv/bin/python" ]]; then
  PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"
else
  PYTHON_BIN="$(command -v python3 || true)"
fi

if [[ -z "${PYTHON_BIN}" ]]; then
  echo "No usable Python runtime found." >&2
  echo "Please run: bash install.sh" >&2
  exit 1
fi

touch "${SERVER_LOG}" "${CHAT_LOG}"

open_browser() {
  local url="$1"
  if [[ "${OPEN_BROWSER}" != "1" ]]; then
    return 0
  fi

  if command -v open >/dev/null 2>&1; then
    open "${url}" >/dev/null 2>&1 || true
    return 0
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${url}" >/dev/null 2>&1 || true
  fi
}

probe_health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "${HEALTH_URL}" >/dev/null 2>&1
    return $?
  fi

  "${PYTHON_BIN}" - "${HEALTH_URL}" <<'PY' >/dev/null 2>&1
import sys
from urllib.request import urlopen

with urlopen(sys.argv[1], timeout=3) as response:
    if response.status < 200 or response.status >= 300:
        raise SystemExit(1)
PY
}

request_permissions() {
  if [[ "${AUTO_REQUEST_PERMISSIONS}" != "1" ]]; then
    return 0
  fi

  echo "Requesting missing permissions where supported..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsS \
      -X POST "${BASE_URL}/api/v1/permissions/request" \
      -H "Content-Type: application/json" \
      -d '{"permission_ids":[],"request_missing_only":true,"open_settings_on_failure":true}' \
      >/dev/null 2>&1 || true
    return 0
  fi

  "${PYTHON_BIN}" - "${BASE_URL}/api/v1/permissions/request" <<'PY' >/dev/null 2>&1 || true
import json
import sys
from urllib.request import Request, urlopen

payload = json.dumps(
    {
        "permission_ids": [],
        "request_missing_only": True,
        "open_settings_on_failure": True,
    }
).encode("utf-8")
request = Request(
    sys.argv[1],
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urlopen(request, timeout=5):
    pass
PY
}

cleanup_bootstrap() {
  if [[ -n "${BOOTSTRAP_PID}" ]] && kill -0 "${BOOTSTRAP_PID}" >/dev/null 2>&1; then
    kill "${BOOTSTRAP_PID}" >/dev/null 2>&1 || true
    wait "${BOOTSTRAP_PID}" >/dev/null 2>&1 || true
  fi
}

forward_signal() {
  local signal="$1"
  echo
  echo "Received ${signal}, stopping server..."
  cleanup_bootstrap
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill -s "${signal}" "${SERVER_PID}" >/dev/null 2>&1 || kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  exit 0
}

wait_for_server_then_bootstrap() {
  local attempt
  for attempt in $(seq 1 "${HEALTH_TIMEOUT_SECONDS}"); do
    if [[ -n "${SERVER_PID}" ]] && ! kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
      echo
      echo "Server process exited before the health check passed." >&2
      return 1
    fi

    if probe_health; then
      echo
      echo "Server is ready."
      echo "UI: ${UI_URL}"
      echo "HTTP MCP discovery: ${MCP_URL}"
      echo "HTTP MCP JSON-RPC endpoint: ${MCP_URL}"
      echo "Server log: ${SERVER_LOG}"
      echo "Chat log: ${CHAT_LOG}"
      echo "Server config: ${SERVER_CONFIG}"
      request_permissions
      open_browser "${UI_URL}"
      return 0
    fi
    sleep 1
  done

  echo
  echo "Warning: server did not become ready within ${HEALTH_TIMEOUT_SECONDS} seconds." >&2
  echo "You can still try opening: ${UI_URL}" >&2
  echo "Server log: ${SERVER_LOG}" >&2
  return 0
}

echo "Starting Open Computer Use"
echo "Project root: ${ROOT_DIR}"
echo "Python: ${PYTHON_BIN}"
echo "Bind: http://${HOST}:${PORT}"
echo "Browser URL: ${UI_URL}"
echo "HTTP MCP: ${MCP_URL}"
echo "Auto request permissions: ${AUTO_REQUEST_PERMISSIONS}"
echo "Open browser: ${OPEN_BROWSER}"
echo "Reload: ${RELOAD}"
echo "Server log: ${SERVER_LOG}"
echo "Chat log: ${CHAT_LOG}"
echo "Server config: ${SERVER_CONFIG}"

trap 'forward_signal INT' INT
trap 'forward_signal TERM' TERM

printf '\n[%s] starting Open Computer Use server\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "${SERVER_LOG}"

env \
  CUA_HOST="${HOST}" \
  CUA_PORT="${PORT}" \
  CUA_RELOAD="${RELOAD}" \
  OPEN_COMPUTER_USE_CHAT_LOG="${CHAT_LOG}" \
  OPEN_COMPUTER_USE_SERVER_CONFIG="${SERVER_CONFIG}" \
  PYTHONUNBUFFERED="1" \
  bash "${ROOT_DIR}/scripts/run_api.sh" >> "${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

wait_for_server_then_bootstrap &
BOOTSTRAP_PID=$!

set +e
wait "${SERVER_PID}"
SERVER_EXIT_CODE=$?
set -e

cleanup_bootstrap

if [[ "${SERVER_EXIT_CODE}" -ne 0 ]]; then
  echo
  echo "Server exited with code ${SERVER_EXIT_CODE}." >&2
  echo "Last 40 lines from ${SERVER_LOG}:" >&2
  tail -n 40 "${SERVER_LOG}" >&2 || true
fi

exit "${SERVER_EXIT_CODE}"
