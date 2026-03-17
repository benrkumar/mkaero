# Indo Aerial Systems — Outreach Automation Hub

> **Tough Parts. Smart Prices. Made in India.**

Automated email + LinkedIn drip campaign tool for Indo Aerial Systems Pvt Ltd.

---

## Features

- **Lead sourcing** via Apollo.io API (500+ contacts per fetch)
- **AI-generated copy** via Claude API — personalized per contact role, company, industry
- **4-step email drip** via Mailgun (open/click/bounce tracking + unsubscribe)
- **LinkedIn automation** via Playwright (connection requests + follow-up messages, rate-limited)
- **React dashboard** — campaign management, analytics, content preview
- **Celery + Redis** task queue for async scheduling

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- Docker Desktop

### 1. Environment setup
```bash
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Install Python dependencies
```bash
pip install -r requirements.txt
playwright install chromium
```

### 3. Start databases
```bash
docker compose up -d
```

### 4. Run migrations
```bash
alembic upgrade head
```

### 5. Start backend (Terminal 1)
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Start Celery worker (Terminal 2)
```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

### 7. Start Celery Beat scheduler (Terminal 3)
```bash
celery -A app.tasks.celery_app beat --loglevel=info
```

### 8. Start React dashboard (Terminal 4)
```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173
API docs: http://localhost:8000/docs

---

## Drip Campaign Flow

```
1. Create campaign (Dashboard → Campaigns → New)
2. Add sequence steps (email/LinkedIn, set delays)
3. Import leads via Apollo (Contacts → Import from Apollo)
4. Enroll contacts into campaign
5. Run campaign
6. Celery Beat executes steps on schedule
7. Track results in Dashboard
```

---

## Default Sequence (4 steps)

| Step | Day | Channel | Description |
|---|---|---|---|
| 1 | 0 | Email + LinkedIn | Introduction + connection request |
| 2 | 3 | Email | Value proof / case study |
| 3 | 7 | Email + LinkedIn | Direct CTA (call or sample) |
| 4 | 14 | Email | Breakup email |

---

## Target Personas (Apollo Filters)

- **Drone OEMs** — CEO, CTO, Founder, Head of Engineering
- **AgriTech** — Operations Head, Tech Lead
- **Defense** — Program Manager, R&D Lead
- **Export Buyers** — Procurement Manager, Supply Chain Head
- **Repair Shops** — Owner, Technician

---

## LinkedIn Safety

- Max 20 connections/day
- Max 50 messages/day
- Business hours IST only (Mon–Fri 9am–6pm)
- Auto-stops on CAPTCHA detection

---

## API Keys Required

| Service | Key | Purpose |
|---|---|---|
| Apollo.io | `APOLLO_API_KEY` | Lead sourcing |
| Mailgun | `MAILGUN_API_KEY` | Email delivery |
| Anthropic | `ANTHROPIC_API_KEY` | AI content generation |
| LinkedIn | Email + Password | Browser automation |
