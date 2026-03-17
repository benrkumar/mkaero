#!/bin/bash
# Indo Aerial Systems — Outreach Hub startup script
# Run this script to start all services

set -e

echo "=== Indo Aerial Systems Outreach Hub ==="
echo ""

# 1. Start PostgreSQL + Redis
echo "[1/5] Starting PostgreSQL + Redis..."
docker compose up -d

# 2. Wait for DB to be ready
echo "[2/5] Waiting for database..."
sleep 3

# 3. Run Alembic migration
echo "[3/5] Running database migrations..."
alembic upgrade head

# 4. Install Playwright browsers (first time only)
if [ ! -d ".playwright" ]; then
  echo "[4/5] Installing Playwright browsers..."
  playwright install chromium
else
  echo "[4/5] Playwright already installed"
fi

echo ""
echo "=== Starting services ==="
echo ""
echo "Run these commands in separate terminals:"
echo ""
echo "  # FastAPI backend"
echo "  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "  # Celery worker"
echo "  celery -A app.tasks.celery_app worker --loglevel=info"
echo ""
echo "  # Celery Beat scheduler"
echo "  celery -A app.tasks.celery_app beat --loglevel=info"
echo ""
echo "  # React dashboard"
echo "  cd frontend && npm install && npm run dev"
echo ""
echo "Dashboard: http://localhost:5173"
echo "API docs:  http://localhost:8000/docs"
