import os
import logging
import urllib3
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from app.routes import quests, auth, enrollment, webhooks, leaderboard, notifications
from app.database.connection import engine, Base, SessionLocal
from app.database.seed import seed_initial_data
from app.models.auth import MoodleConfig
# Import so the tables are registered with Base before create_all() below.
from app.models.math_game import MathGameSession  # noqa: F401
from app.models.race import RaceRoom, RacePlayer, RaceAnswer  # noqa: F401
from app.models.drive import TeacherDriveConnection, DriveStudentFolder  # noqa: F401

# Suppress SSL warnings for localhost development
# urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)



# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# create_all() never ALTERs existing tables, so add newer columns explicitly.
# Idempotent (ADD COLUMN IF NOT EXISTS) and Postgres-only, which matches Neon.
from sqlalchemy import text as _sql_text
with engine.begin() as _conn:
    _conn.execute(_sql_text(
        "ALTER TABLE quests ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER"
    ))
    _conn.execute(_sql_text(
        "ALTER TABLE virtual_pets ADD COLUMN IF NOT EXISTS food INTEGER NOT NULL DEFAULT 0"
    ))
    # Verified email-change flow.
    _conn.execute(_sql_text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255)"
    ))
    _conn.execute(_sql_text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_code VARCHAR(10)"
    ))
    _conn.execute(_sql_text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_expires TIMESTAMPTZ"
    ))
    # Track whether the student has seen a badge's earn popup (offline replay).
    # On the FIRST add only, back-fill existing badges to "seen" so they don't
    # all flood as unseen on the next login. (Detect first-add by checking the
    # column before creating it — an unconditional back-fill on every restart
    # would wrongly mark genuinely-unseen new awards as seen.)
    _popup_col_existed = _conn.execute(_sql_text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'user_badges' AND column_name = 'popup_seen'"
    )).first() is not None
    _conn.execute(_sql_text(
        "ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS popup_seen BOOLEAN NOT NULL DEFAULT false"
    ))
    if not _popup_col_existed:
        _conn.execute(_sql_text("UPDATE user_badges SET popup_seen = true"))
    # Google Drive submission storage.
    _conn.execute(_sql_text(
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS gdrive_folder_id VARCHAR(128)"
    ))
    _conn.execute(_sql_text(
        "ALTER TABLE submission_attachments ADD COLUMN IF NOT EXISTS external_id VARCHAR(128)"
    ))

# Adding an enum value can't run inside a transaction on some Postgres versions,
# so use an autocommit connection. Enables the new 'complete_quiz' daily quest.
with engine.connect() as _conn:
    _conn = _conn.execution_options(isolation_level="AUTOCOMMIT")
    try:
        _conn.execute(_sql_text(
            "ALTER TYPE questtypeenum ADD VALUE IF NOT EXISTS 'complete_quiz'"
        ))
    except Exception as _exc:  # noqa: BLE001 - enum may already have the value
        logger.warning("Could not add 'complete_quiz' enum value: %s", _exc)

# Get Moodle URL from environment
moodle_url = os.getenv("MOODLE_URL")
if moodle_url:
    logger.info(f"Using Moodle URL from environment: {moodle_url}")
else:
    logger.warning("MOODLE_URL environment variable not set, using default")

# Seed initial data
with SessionLocal() as db:
    seed_initial_data(db)

    # Ensure the daily study-quest templates exist / are up to date (idempotent upsert).
    try:
        from app.services.daily_quest_service import DailyQuestService
        DailyQuestService(db).seed_daily_login_quest()
    except Exception as exc:  # noqa: BLE001 - don't block startup on seeding
        logger.warning("Daily quest template seeding failed: %s", exc)

    # Ensure system badges (streak / pet-level / progression tiers) exist (idempotent, additive).
    try:
        from app.seeders.badge_seeder import seed_badges
        seed_badges(db)
    except Exception as exc:  # noqa: BLE001 - don't block startup on seeding
        logger.warning("Badge seeding failed: %s", exc)

    # Display current Moodle configuration
    moodle_config = db.query(MoodleConfig).first()
    if moodle_config:
        logger.info(f"Current Moodle configuration: URL={moodle_config.base_url}, Service={moodle_config.service_name}")
    else:
        logger.warning("No Moodle configuration found in database")

# CORS + environment settings (centralized in app.config)
from app.config import CORS_ORIGINS as origins, CORS_ORIGIN_REGEX, IS_PRODUCTION
import re as _re

# Hide interactive docs / OpenAPI schema in production.
app = FastAPI(
    title="LearningQuest API",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# Configure CORS. The extra-origin regex is opt-in via CORS_ORIGIN_REGEX — there
# is no broad "*.vercel.app" default (which would let any Vercel site call us).
_cors_kwargs = dict(
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Length"],
    max_age=600,  # Cache preflight requests for 10 minutes
)
if CORS_ORIGIN_REGEX:
    _cors_kwargs["allow_origin_regex"] = CORS_ORIGIN_REGEX
app.add_middleware(CORSMiddleware, **_cors_kwargs)

_origin_re = _re.compile(CORS_ORIGIN_REGEX) if CORS_ORIGIN_REGEX else None


def _origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    return origin in origins or bool(_origin_re and _origin_re.match(origin))


# Error handling middleware
@app.middleware("http")
async def errors_handling(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled request error")
        # Echo the caller's origin (never wildcard) so credentialed CORS
        # requests can still read the error response.
        origin = request.headers.get("origin")
        cors_headers = {}
        if _origin_allowed(origin):
            cors_headers = {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Vary": "Origin",
            }
        # Don't leak internals (stack/DB details) to clients in production.
        detail = "Internal server error" if IS_PRODUCTION else str(exc)
        return JSONResponse(
            status_code=500,
            content={"detail": detail},
            headers=cors_headers,
        )

# Mount static files directory.
# Use a hardened StaticFiles that blocks MIME-sniffing everywhere and forces
# user-uploaded files to download (so an uploaded .html/.svg can't run script
# from this origin).
class SecureStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        if path.startswith("uploads/") or path.startswith("uploads\\"):
            response.headers["Content-Disposition"] = "attachment"
        return response


app.mount("/static", SecureStaticFiles(directory="static"), name="static")

# Include routers
from app.routes import daily_quests
from app.routes.badges import router as badges_router 
from app.routes.activity_log import router as activity_log_router
from app.routes.virtual_pet import router as virtual_pet_router
from app.routes.profile import router as profile_router
from app.routes.analytics import router as analytics_router
from app.routes.progress import router as progress_router
from app.routes.quest_analytics import router as quest_analytics_router
from app.routes.admin import router as admin_router
from app.routes.classes import router as classes_router
from app.routes.quiz import router as quiz_router
from app.routes.games import router as games_router
from app.routes.race import router as race_router
from app.routes.dashboard import router as dashboard_router
from app.routes.drive import router as drive_router

app.include_router(quests.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(classes_router, prefix="/api")
app.include_router(quiz_router, prefix="/api")
app.include_router(games_router, prefix="/api")
app.include_router(race_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(drive_router, prefix="/api")


@app.on_event("startup")
async def _capture_event_loop():
    """Record the running loop so background pushes (e.g. badge-awarded SSE) can
    be scheduled from synchronous endpoints too."""
    import asyncio
    from app.services.realtime import set_main_loop
    set_main_loop(asyncio.get_running_loop())
app.include_router(enrollment.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(daily_quests.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(badges_router, prefix="/api")
app.include_router(activity_log_router, prefix="/api")
app.include_router(virtual_pet_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(progress_router, prefix="/api")
app.include_router(quest_analytics_router, prefix="/api/quest-analytics")

@app.get("/")
async def root():
    return {"message": "Welcome to MoodleQuest API"}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting MoodleQuest API server")
    uvicorn.run(app, host="0.0.0.0", port=8002)