import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import ai, auth, chat, emails

app = FastAPI()

# CORS origins are comma-separated in FRONTEND_ORIGIN. Local dev always stays
# allowed; production domains (e.g. https://mailmind.vercel.app) are appended
# via env on the deployment platform.
_ORIGIN_ENV = os.getenv("FRONTEND_ORIGIN", "")
_extra_origins = [o.strip() for o in _ORIGIN_ENV.split(",") if o.strip()]
_origins = ["http://localhost:3000", *_extra_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(emails.router, prefix="/emails", tags=["emails"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])

@app.get("/")
def root():
    return {"status": "running"}