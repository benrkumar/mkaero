#!/bin/bash
# Local staging — starts FastAPI backend + React frontend
# Usage: bash dev.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Install Python deps if needed
pip install -r "$ROOT/requirements.txt" -q

# Install frontend deps if needed
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd "$ROOT/frontend" && npm install
fi

echo ""
echo "=== Local Staging ==="
echo "  Frontend  → http://localhost:5173"
echo "  API docs  → http://localhost:8003/docs"
echo ""
echo "Press Ctrl+C to stop both services."
echo ""

# Trap Ctrl+C and kill both processes
trap 'kill %1 %2 2>/dev/null; echo ""; echo "Stopped."; exit 0' INT

# Start backend on port 8003 (matches vite proxy)
cd "$ROOT"
uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload &

# Start frontend dev server
cd "$ROOT/frontend"
npm run dev &

wait
