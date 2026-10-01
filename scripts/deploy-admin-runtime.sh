#!/bin/sh
set -eu

: "${ADMIN_UI_ENV_B64:?ADMIN_UI_ENV was not prepared by GitHub Actions}"
: "${NEW_IMAGE:?The immutable admin image reference is missing}"
: "${GHCR_TOKEN:?GHCR_TOKEN is missing}"
: "${GHCR_USERNAME:?GHCR_USERNAME is missing}"

CONTAINER_NAME="${ADMIN_CONTAINER_NAME:-broker-admin-ui}"
PORT_MAPPING="${ADMIN_PORT_MAPPING:-8080:80}"
STABLE_ENV_FILE="${ADMIN_UI_ENV_FILE:-$HOME/broker-admin-ui.env}"
ENV_FILE=""
PREVIOUS_CONTAINER=""
OLD_STOPPED=false
CANDIDATE_ATTEMPTED=false
COMMITTED=false

# A second runner must not replace the same container during this transaction.
if ! command -v flock >/dev/null 2>&1; then
  echo 'The admin deployment host requires flock.' >&2
  exit 1
fi
exec 9>"$HOME/.broker-admin-ui.deploy.lock"
if ! flock -n 9; then
  echo 'Another admin deployment is already running.' >&2
  exit 1
fi

cleanup() {
  result=$?
  trap - EXIT HUP INT TERM
  if [ "$COMMITTED" != true ]; then
    if [ "$CANDIDATE_ATTEMPTED" = true ]; then
      docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
    if [ -n "$PREVIOUS_CONTAINER" ]; then
      if docker rename "$PREVIOUS_CONTAINER" "$CONTAINER_NAME" &&
          docker start "$CONTAINER_NAME" >/dev/null; then
        echo 'Previous admin container restored with its original environment.'
      else
        echo 'ERROR: Previous admin container could not be restored.' >&2
        result=1
      fi
    elif [ "$OLD_STOPPED" = true ]; then
      docker start "$CONTAINER_NAME" >/dev/null || result=1
    fi
  fi
  if [ -n "$ENV_FILE" ]; then rm -f "$ENV_FILE"; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

umask 077
if [ ! -d "$(dirname "$STABLE_ENV_FILE")" ]; then
  echo 'The configured admin environment directory does not exist.' >&2
  exit 1
fi
ENV_FILE=$(mktemp "${STABLE_ENV_FILE}.candidate.XXXXXX")
# Decode as data: never source, eval, or interpolate the secret into a command.
printf '%s' "$ADMIN_UI_ENV_B64" | base64 --decode > "$ENV_FILE"
unset ADMIN_UI_ENV_B64
if [ ! -s "$ENV_FILE" ]; then
  echo 'ADMIN_UI_ENV is empty.' >&2
  exit 1
fi
for key in BROKER_ID API_HOST FEED_WS_URL FEED_STATUS_URL; do
  if ! grep -Eq "^(${key}|VITE_${key})=.+" "$ENV_FILE"; then
    echo "ADMIN_UI_ENV must set $key or VITE_$key." >&2
    exit 1
  fi
done

case "$NEW_IMAGE" in
  *@sha256:*) ;;
  *) echo 'The admin deployment requires an immutable image digest.' >&2; exit 1 ;;
esac

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
unset GHCR_TOKEN
docker pull "$NEW_IMAGE"

if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  previous_name="${CONTAINER_NAME}-previous-$$"
  if docker inspect "$previous_name" >/dev/null 2>&1; then
    echo 'The previous-container backup name is already in use.' >&2
    exit 1
  fi
  docker stop "$CONTAINER_NAME" >/dev/null
  OLD_STOPPED=true
  docker rename "$CONTAINER_NAME" "$previous_name"
  PREVIOUS_CONTAINER="$previous_name"
fi

CANDIDATE_ATTEMPTED=true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p "$PORT_MAPPING" \
  "$NEW_IMAGE" >/dev/null

ready=false
attempt=0
while [ "$attempt" -lt 30 ]; do
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" != true ]; then
    echo 'The new admin container exited before becoming ready.' >&2
    exit 1
  fi
  if docker exec "$CONTAINER_NAME" node -e '
    fetch("http://127.0.0.1/healthz", { signal: AbortSignal.timeout(3000) })
      .then(response => { if (!response.ok) process.exitCode = 1; })
      .catch(() => { process.exitCode = 1; });
  ' >/dev/null 2>&1; then
    ready=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done
if [ "$ready" != true ]; then
  echo 'The new admin container failed its readiness check.' >&2
  exit 1
fi

# Check the generated browser configuration, not just Docker's running flag.
docker exec "$CONTAINER_NAME" node -e '
  const fs = require("node:fs");
  const vm = require("node:vm");
  const path = require("node:path");
  const sandbox = { window: {} };
  const filename = path.join(process.env.DIST_DIR || "/app/dist", "runtime-config.js");
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), sandbox, { timeout: 1000 });
  const config = sandbox.window.__RTX5_RUNTIME_CONFIG__ || {};
  for (const key of ["BROKER_ID", "API_HOST", "FEED_WS_URL", "FEED_STATUS_URL", "FEED_BROKER_TOKEN"]) {
    const expected = process.env[key] || process.env["VITE_" + key];
    if (key === "FEED_BROKER_TOKEN" && !expected) continue;
    if (!expected || config[key] !== expected) {
      console.error("Generated runtime configuration does not match " + key + ".");
      process.exit(1);
    }
  }
'

# Promote the file only after the candidate has loaded and verified its values.
mv -f "$ENV_FILE" "$STABLE_ENV_FILE"
ENV_FILE=""
COMMITTED=true
if [ -n "$PREVIOUS_CONTAINER" ]; then
  if ! docker rm "$PREVIOUS_CONTAINER" >/dev/null; then
    echo 'Admin deployment succeeded; the previous stopped container needs cleanup.' >&2
  fi
fi
echo 'Admin deployment succeeded with runtime configuration from ADMIN_UI_ENV.'
