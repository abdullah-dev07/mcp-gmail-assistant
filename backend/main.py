import hmac

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from db import init_db
from routes import ai, auth, chat, emails

app = FastAPI()
init_db()

# CORS origins: localhost:3000 is always allowed; production domains
# (e.g. https://mailmind.vercel.app) are appended via FRONTEND_ORIGIN.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API-key gate ──────────────────────────────────────────────────────────
# Every request to protected routes must carry `X-API-Key: <API_KEY>`.
# If API_KEY is unset we skip the check (convenient for `make dev`), but on
# any public deployment this env var MUST be set to a long random string.
_API_KEY = settings.api_key.strip()

# Paths that must remain reachable without a key:
#   /            - health check for Render / Docker
#   /auth/login  - user clicks a link; browser can't attach a custom header
#   /auth/callback - Google redirects the user here; Google can't send headers
_PUBLIC_PATHS: set[str] = {"/", "/auth/login", "/auth/callback"}


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    if not _API_KEY:
        return await call_next(request)

    # CORS preflight requests never carry custom headers; let them through so
    # the CORS middleware can answer them.
    if request.method == "OPTIONS":
        return await call_next(request)

    if request.url.path in _PUBLIC_PATHS:
        return await call_next(request)

    provided = request.headers.get("x-api-key", "")
    # compare_digest guards against timing attacks on the string compare.
    if not hmac.compare_digest(provided, _API_KEY):
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing API key"},
        )

    return await call_next(request)


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(emails.router, prefix="/emails", tags=["emails"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])

@app.get("/")
def root():
    return {"status": "running"}