import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Indo Aerial Systems — Outreach Automation",
    description="Email & LinkedIn drip campaign automation for Indo Aerial Systems Pvt Ltd.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        settings.frontend_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    # Auto-create all tables (SQLite, no Docker needed)
    from app.database import Base, engine
    import app.models  # noqa — registers all models
    Base.metadata.create_all(bind=engine)

    # Migrate: add tags column to contacts if not present (SQLite safe)
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        cols = [c['name'] for c in inspector.get_columns('contacts')]
        if 'tags' not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE contacts ADD COLUMN tags TEXT DEFAULT '[]'"))
                conn.commit()
    except Exception as _mig_err:
        pass

    # Start APScheduler drip scheduler (every 15 min)
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.tasks.drip_scheduler import tick
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(tick, "interval", minutes=15, id="drip_tick")
    scheduler.start()
    logging.getLogger(__name__).info("Drip scheduler started (every 15 min)")


from app.api.v1.router import router as v1_router
app.include_router(v1_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok", "service": "Indo Aerial Systems Outreach API"}
