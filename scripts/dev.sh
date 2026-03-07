#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-}"
DEV_AUTH_ENABLED="${DEV_AUTH_ENABLED:-false}"
DEV_BACKEND_URL="${DEV_BACKEND_URL:-http://localhost:8000}"
DEV_DATABASE_URL="${DEV_DATABASE_URL:-sqlite+aiosqlite:///$ROOT_DIR/data/dev.local.db}"
RESET_DEV_DB="${RESET_DEV_DB:-false}"

if [ -z "$PYTHON_BIN" ]; then
  if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
    PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "Error: no Python interpreter found (tried 'python' and 'python3')."
    echo "Hint: run with PYTHON_BIN=<your-python> ./scripts/dev.sh"
    exit 1
  fi
elif ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Error: '$PYTHON_BIN' is not available in PATH."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: 'npm' is not available in PATH."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: 'curl' is not available in PATH."
  exit 1
fi

if [ ! -d "$ROOT_DIR/web" ]; then
  echo "Error: frontend directory not found at '$ROOT_DIR/web'."
  exit 1
fi

if [ "$RESET_DEV_DB" = "true" ]; then
  db_file="$ROOT_DIR/data/dev.local.db"
  if [ -f "$db_file" ]; then
    rm "$db_file"
    echo "Removed local dev database: $db_file"
  fi
fi

backend_pid=""
frontend_pid=""

cleanup() {
  if [ -n "$backend_pid" ] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi
  if [ -n "$frontend_pid" ] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend on http://localhost:8000"
(
  cd "$ROOT_DIR" && \
    AUTH_ENABLED="$DEV_AUTH_ENABLED" \
    DATABASE_URL="$DEV_DATABASE_URL" \
    PYTHONUNBUFFERED=1 \
    "$PYTHON_BIN" -m src.main
) &
backend_pid=$!

# Wait for backend readiness before launching frontend to avoid startup 502s.
echo "Waiting for backend readiness..."
ready="false"
for _ in $(seq 1 30); do
  http_code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8000/api/health" || true)"
  if [ "$http_code" = "200" ]; then
    ready="true"
    break
  fi
  sleep 1
done

if [ "$ready" != "true" ]; then
  echo "Error: backend did not become ready within 30 seconds."
  exit 1
fi

echo "Starting frontend on http://localhost:3000"
(
  cd "$ROOT_DIR/web" && \
    BACKEND_URL="$DEV_BACKEND_URL" \
    NEXT_PUBLIC_BACKEND_URL="$DEV_BACKEND_URL" \
    NEXT_PUBLIC_AUTH_BYPASS=true \
    npm run dev
) &
frontend_pid=$!

echo "GymOS dev stack is running with auth bypass enabled in frontend."
echo "Backend DB: $DEV_DATABASE_URL"
echo "Press Ctrl+C to stop both services."

wait -n "$backend_pid" "$frontend_pid"
