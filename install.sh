#!/bin/sh
# ─── READ THIS BEFORE RUNNING ──────────────────────────────────────────
# Good — you opened the file. Do that with every install script you find
# online, not just this one. It's the difference between trusting someone
# else's word and trusting your own eyes.
#
# This installer does exactly FOUR things, in order:
#   1. Checks that Docker is installed (just a check — won't install it)
#   2. Pulls the StayBattle Docker image from GHCR
#   3. Creates ~/staybattle/data for the SQLite DB
#   4. Runs the container on port 3000 (override with STAYBATTLE_PORT)
#
# It does NOT:
#   - Touch your shell profile, dotfiles, PATH, or any system config
#   - Add cron jobs, systemd units, or background services
#   - Send any telemetry, analytics, or call-home requests
#   - Need root / sudo (Docker may, separately, depending on your setup)
#   - Modify anything outside ~/staybattle/
#
# The rest of the file is plain POSIX sh — no obfuscation, no eval, no
# base64 blobs, no piping to other scripts. Scroll through it. If you
# can't tell what a line does, ask before running.
#
# Source:  https://github.com/datboip/StayBattle/blob/main/install.sh
# Project: https://github.com/datboip/StayBattle  (AGPL v3)
# ───────────────────────────────────────────────────────────────────────
# StayBattle one-liner installer.
#   curl -fsSL https://raw.githubusercontent.com/datboip/StayBattle/main/install.sh | sh
#
# Sets up a self-hosted StayBattle instance in ~/staybattle, runs it on port
# 3000 by default. Re-running this is safe — it'll just update the image and
# keep your data intact.

set -e

REPO="datboip/StayBattle"
# Pin to a specific release with: STAYBATTLE_TAG=v0.4.1 sh install.sh
# Defaults to :latest, which tracks main and may move under you.
TAG="${STAYBATTLE_TAG:-latest}"
IMAGE="ghcr.io/${REPO}:${TAG}"
DEFAULT_PORT=3000
DEFAULT_DIR="${HOME}/staybattle"
CONTAINER_NAME="staybattle"

# ---- helpers ----
say()  { printf "\033[1;36m›\033[0m %s\n" "$1"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$1"; }
fail() { printf "\033[1;31m✗\033[0m %s\n" "$1" >&2; exit 1; }
done_() { printf "\033[1;32m✓\033[0m %s\n" "$1"; }

PORT="${STAYBATTLE_PORT:-$DEFAULT_PORT}"
DATA_DIR="${STAYBATTLE_DIR:-$DEFAULT_DIR}/data"

# ---- preflight ----
say "Checking for Docker…"
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker isn't installed."
  cat <<EOM

StayBattle uses Docker so you don't have to deal with Node, npm, build tools,
etc. Install Docker first:

  - macOS:        https://docs.docker.com/desktop/install/mac-install/
  - Windows:      https://docs.docker.com/desktop/install/windows-install/
  - Linux:        https://docs.docker.com/engine/install/

Then re-run this script.

(If you'd rather install from source without Docker, clone the repo:
  https://github.com/${REPO}
and run \`npm install && npm run dev\`.)
EOM
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker is installed but the daemon isn't running. Start Docker Desktop (or 'sudo systemctl start docker') and re-run."
fi

# ---- check port ----
if command -v lsof >/dev/null 2>&1 && lsof -i ":${PORT}" >/dev/null 2>&1; then
  warn "Port ${PORT} looks busy. Set a different one with: STAYBATTLE_PORT=3001 sh install.sh"
fi

# ---- prepare data dir ----
mkdir -p "${DATA_DIR}"
say "Data will live in ${DATA_DIR}"

# ---- handle existing container ----
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  say "Existing ${CONTAINER_NAME} container found — stopping it for the update."
  docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker rm "${CONTAINER_NAME}" >/dev/null 2>&1 || true
fi

# ---- pull image ----
say "Pulling ${IMAGE} from ghcr.io…"
docker pull "${IMAGE}"

# ---- run ----
say "Starting StayBattle on port ${PORT}…"
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${PORT}:3000" \
  -v "${DATA_DIR}:/app/data" \
  "${IMAGE}" >/dev/null

# ---- wait for readiness ----
say "Waiting for the server to be ready…"
for i in $(seq 1 30); do
  if curl -fs "http://localhost:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cat <<EOM

$(done_ "StayBattle is running")

  Open:       http://localhost:${PORT}   (this machine only)
  Data:       ${DATA_DIR}
  Logs:       docker logs -f ${CONTAINER_NAME}
  Stop:       docker stop ${CONTAINER_NAME}
  Update:     re-run this install script anytime
  Uninstall:  docker rm -f ${CONTAINER_NAME} && rm -rf ${DATA_DIR}

Sharing with your crew (they can't click localhost):
  Same WiFi:  http://<your-LAN-IP>:${PORT}   (ip addr / ipconfig)
  Anywhere:   cloudflared tunnel --url http://localhost:${PORT}
              (free, prints a https://*.trycloudflare.com URL)

Sign in with any name + a 4–6 digit PIN to claim it, then set up your first
battle. Share the invite code with your crew.

Have fun.
EOM
