import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Marketing Control Center",
    description="Email & LinkedIn drip campaign automation platform.",
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
    return {"status": "ok", "service": "Marketing Control Center API"}


# Serve React frontend (production build)
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        index = os.path.join(_frontend_dist, "index.html")
        return FileResponse(index)
