# Multi-stage build for StayBattle.
# Final image is a small Alpine Node runtime with the standalone Next.js
# bundle + the SQLite native bindings.

FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Set to "true" only when the container will sit behind a TLS terminator
# (nginx/Caddy/Cloudflare). Enables upgrade-insecure-requests + HSTS, which
# break a plain-http LAN install. Baked in at build time by next.config.ts.
ARG STAYBATTLE_HTTPS=false
ENV STAYBATTLE_HTTPS=$STAYBATTLE_HTTPS
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Runtime copy of the TLS flag: the voter cookie's Secure attribute is
# decided per request (src/lib/auth-cookie.ts), unlike the headers which
# were baked at build time. Override at run time with
# `environment: STAYBATTLE_HTTPS=true` in docker-compose if needed.
ARG STAYBATTLE_HTTPS=false
ENV STAYBATTLE_HTTPS=$STAYBATTLE_HTTPS

# Drop privileges
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
# next.config.ts imports the (tested) header builder from src/ — `next start`
# re-loads the config at boot, so the module must exist in the runtime image.
COPY --from=builder /app/src/lib/security-headers.ts ./src/lib/security-headers.ts

# SQLite data lives outside the bundle — mount this as a volume.
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
