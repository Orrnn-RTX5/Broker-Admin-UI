#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -z "${BROKERS_JSON:-}" ]]; then
  echo "BROKERS_JSON secret is empty; skipping broker deploy."
  exit 0
fi

if [[ -z "${IMAGE_REF:-}" ]]; then
  echo "IMAGE_REF is required." >&2
  exit 1
fi

if [[ -z "${BROKER_SSH_PRIVATE_KEY:-}" ]]; then
  echo "BROKER_SSH_PRIVATE_KEY secret is required when BROKERS_JSON is set." >&2
  exit 1
fi

if [[ -z "${GHCR_USERNAME:-}" || -z "${GHCR_TOKEN:-}" ]]; then
  echo "GHCR_USERNAME and GHCR_TOKEN secrets are required for server-side image pulls." >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

mkdir -p "$HOME/.ssh"
key_file="$HOME/.ssh/rtx5_broker_deploy"
printf '%s\n' "$BROKER_SSH_PRIVATE_KEY" > "$key_file"
chmod 600 "$key_file"

brokers_file="$tmpdir/brokers.json"
printf '%s' "$BROKERS_JSON" > "$brokers_file"
jq -e '.brokers and (.brokers | type == "array")' "$brokers_file" >/dev/null

broker_count="$(jq '.brokers | length' "$brokers_file")"
if [[ "$broker_count" -eq 0 ]]; then
  echo "No brokers configured; skipping broker deploy."
  exit 0
fi

shell_quote() {
  printf '%q' "$1"
}

write_runtime_env() {
  local broker_json="$1"
  local output_file="$2"

  jq -r '
    (.env // {})
    | to_entries[]
    | select(.value != null)
    | "\(.key)=\(.value | tostring | gsub("\r"; "") | gsub("\n"; "\\n"))"
  ' <<< "$broker_json" > "$output_file"
}

ssh_opts=(
  -i "$key_file"
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=3
)

for ((i = 0; i < broker_count; i++)); do
  broker="$(jq -c ".brokers[$i]" "$brokers_file")"
  name="$(jq -r ".name // \"broker-$i\"" <<< "$broker")"
  host="$(jq -r '.host // empty' <<< "$broker")"
  user="$(jq -r '.user // "root"' <<< "$broker")"
  port="$(jq -r '.port // 22' <<< "$broker")"
  deploy_dir="$(jq -r '.deploy_dir // "/opt/rtx5-broker-admin-ui"' <<< "$broker")"
  container_name="$(jq -r '.container_name // "rtx5-broker-admin-ui"' <<< "$broker")"
  app_port="$(jq -r '.app_port // 8080' <<< "$broker")"

  if [[ -z "$host" ]]; then
    echo "Broker '$name' is missing host." >&2
    exit 1
  fi

  target="$user@$host"
  runtime_env_file="$tmpdir/$i-runtime.env"
  write_runtime_env "$broker" "$runtime_env_file"

  echo "Deploying $name to $target on app port $app_port"

  ssh -p "$port" "${ssh_opts[@]}" "$target" "mkdir -p $(shell_quote "$deploy_dir")"
  ssh -p "$port" "${ssh_opts[@]}" "$target" "cat > $(shell_quote "$deploy_dir")/runtime.env" < "$runtime_env_file"

  remote_env="IMAGE_REF=$(shell_quote "$IMAGE_REF")"
  remote_env="$remote_env CONTAINER_NAME=$(shell_quote "$container_name")"
  remote_env="$remote_env APP_PORT=$(shell_quote "$app_port")"
  remote_env="$remote_env DEPLOY_DIR=$(shell_quote "$deploy_dir")"
  remote_env="$remote_env GHCR_USERNAME=$(shell_quote "$GHCR_USERNAME")"
  remote_env="$remote_env GHCR_TOKEN=$(shell_quote "$GHCR_TOKEN")"

  ssh -p "$port" "${ssh_opts[@]}" "$target" "$remote_env bash -s" <<'REMOTE'
set -Eeuo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on this server." >&2
  exit 1
fi

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null
docker pull "$IMAGE_REF"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "$APP_PORT:80" \
  --env-file "$DEPLOY_DIR/runtime.env" \
  "$IMAGE_REF"
docker image prune -f >/dev/null 2>&1 || true
REMOTE
done
