# syntax=docker/dockerfile:1.7
#
# Backend image: Python + FastAPI + Node.js (for the MCP subprocess).
#
# The backend spawns `node ../mcp-server/index.js` via stdio (see
# backend/services/mcp_service.py). That means Node and the MCP server's
# JS code must live INSIDE this same container.
#
# Build context should be the repo root so we can copy both `backend/`
# and `mcp-server/` into the image:
#     docker build -f backend/Dockerfile -t mailmind-backend .
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_MAJOR=20

# System deps: curl+ca-certs for NodeSource, then Node.js 20.x
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get purge -y --auto-remove curl gnupg \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python deps ─────────────────────────────────────────────────
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --upgrade pip \
 && pip install -r ./backend/requirements.txt

# ── MCP server (Node) deps ──────────────────────────────────────
# Copied first as its own layer so adding backend code doesn't bust the
# node_modules cache.
COPY mcp-server/package.json mcp-server/package-lock.json ./mcp-server/
RUN cd mcp-server && npm ci --omit=dev

# ── Application source ──────────────────────────────────────────
COPY backend  ./backend
COPY mcp-server ./mcp-server

# Backend is the only thing that serves HTTP; the MCP server is spawned
# on demand as a child over stdio.
WORKDIR /app/backend
EXPOSE 8001

# `--host 0.0.0.0` so the container's published port is reachable.
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
