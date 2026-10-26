#!/usr/bin/env bash
# One-click start for Tackle AI on macOS / Linux:  ./boot.sh   (first time: chmod +x boot.sh)
# Press Ctrl+C or close the terminal to stop. An Ollama this script started is stopped too;
# one that was already running is left alone.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-5173}"
OLLAMA_PID=""

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  [ -n "$OLLAMA_PID" ] && kill "$OLLAMA_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM HUP

if ! command -v node >/dev/null; then
  echo "Node.js 18+ is required: brew install node  (or https://nodejs.org)"; exit 1
fi

if ! command -v ollama >/dev/null; then
  echo "Ollama not found - AI features will be unavailable. Install from https://ollama.com"
elif curl -s -o /dev/null "http://localhost:11434/api/tags"; then
  echo "Ollama is already running - leaving it as it is."
else
  echo "Starting Ollama..."
  ollama serve >/dev/null 2>&1 &
  OLLAMA_PID=$!
fi

echo "Starting Tackle AI at http://localhost:$PORT  (Ctrl+C to stop everything)"
PORT="$PORT" node server.js &
SERVER_PID=$!
for _ in $(seq 40); do curl -s -o /dev/null "http://localhost:$PORT" && break; sleep 0.25; done
if command -v open >/dev/null; then open "http://localhost:$PORT"; elif command -v xdg-open >/dev/null; then xdg-open "http://localhost:$PORT"; fi
wait "$SERVER_PID"
