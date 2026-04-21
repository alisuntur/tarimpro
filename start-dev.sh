#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
LOG_DIR="$ROOT/.runlogs"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://${BACKEND_HOST}:${BACKEND_PORT}}"

mkdir -p "$LOG_DIR"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON_EXE="$ROOT/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_EXE="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_EXE="$(command -v python)"
else
  echo "Python bulunamadi. Once Python 3 kur." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm bulunamadi. Once Node.js kur." >&2
  exit 1
fi

BACKEND_OUT="$LOG_DIR/backend.out.log"
BACKEND_ERR="$LOG_DIR/backend.err.log"
FRONTEND_OUT="$LOG_DIR/frontend.out.log"
FRONTEND_ERR="$LOG_DIR/frontend.err.log"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "TarimPro gelistirme sunuculari baslatiliyor..."
echo "Backend:  http://${BACKEND_HOST}:${BACKEND_PORT}/docs"
echo "Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}/"
echo
echo "Loglar:"
echo "  $BACKEND_OUT"
echo "  $BACKEND_ERR"
echo "  $FRONTEND_OUT"
echo "  $FRONTEND_ERR"
echo

(
  cd "$BACKEND_DIR"
  "$PYTHON_EXE" -m uvicorn main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
) >"$BACKEND_OUT" 2>"$BACKEND_ERR" &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
) >"$FRONTEND_OUT" 2>"$FRONTEND_ERR" &
FRONTEND_PID=$!

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

exit 1
