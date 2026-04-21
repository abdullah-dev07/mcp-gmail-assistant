# syntax=docker/dockerfile:1.7
#
# Frontend image: Next.js production build served by `next start`.
# Multi-stage to keep the final image lean (no dev deps, no source maps).
#
#     docker build -t mailmind-frontend ./frontend

# ── 1) install ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2) build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_BACKEND_URL is baked into the browser bundle at build time.
# Default points at the host-mapped backend port; override with:
#     docker build --build-arg NEXT_PUBLIC_BACKEND_URL=http://api.example.com ...
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

RUN npm run build

# ── 3) runtime ──────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Copy only what `next start` needs at runtime.
COPY --from=builder /app/package.json  ./package.json
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/.next         ./.next
COPY --from=builder /app/public        ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
