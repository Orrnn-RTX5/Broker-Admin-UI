#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -z "${BROKERS_JSON:-}" ]]; then
  if [[ -f brokers.json ]]; then
    echo "BROKERS_JSON secret is empty; using checked-in brokers.json."
    BROKERS_JSON="$(cat brokers.json)"
  else
    echo "BROKERS_JSON secret is empty and brokers.json is missing; skipping broker deploy."
    exit 0
  fi
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
  local env_secret_name
  local env_secret_value

  write_inline_runtime_env() {
    jq -r '
      (.env // {})
      | to_entries[]
      | select(.value != null)
      | "\(.key)=\(.value | tostring | gsub("\r"; "") | gsub("\n"; "\\n"))"
    ' <<< "$broker_json" > "$output_file"
  }

  env_secret_name="$(jq -r '.env_secret // empty' <<< "$broker_json")"
  if [[ -n "$env_secret_name" ]]; then
    if [[ ! "$env_secret_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "Invalid env_secret name: $env_secret_name" >&2
      exit 1
    fi

    env_secret_value="${!env_secret_name:-}"
    if [[ -z "$env_secret_value" ]]; then
      if jq -e '(.env // {}) | type == "object" and length > 0' <<< "$broker_json" >/dev/null; then
        echo "Broker env secret '$env_secret_name' is empty; using inline env from broker config."
        write_inline_runtime_env
        return
      fi

      echo "Broker env secret '$env_secret_name' is empty or not mapped in the workflow, and no inline env fallback is configured." >&2
      exit 1
    fi

    if printf '%s' "$env_secret_value" | jq -e 'type == "object"' >/dev/null 2>&1; then
      printf '%s' "$env_secret_value" | jq -r '
        to_entries[]
        | select(.value != null)
        | "\(.key)=\(.value | tostring | gsub("\r"; "") | gsub("\n"; "\\n"))"
      ' > "$output_file"
    else
      printf '%s\n' "$env_secret_value" > "$output_file"
    fi

    return
  fi

  write_inline_runtime_env
}

ssh_opts=(
  -i "$key_file"
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=3
)

for ((i = 0; i < broker_count; i++)); do
  broker="$(jq -c ".brokers[$i]" "$brokers_file")"
  enabled="$(jq -r 'if (.enabled // true) == true then "true" else "false" end' <<< "$broker")"
  if [[ "$enabled" != "true" ]]; then
    name="$(jq -r ".name // .id // \"broker-$i\"" <<< "$broker")"
    echo "Skipping disabled broker $name"
    continue
  fi

  broker_id="$(jq -r ".id // .name // \"broker-$i\"" <<< "$broker")"
  channel="$(jq -r '.channel // "production"' <<< "$broker")"
  name="$(jq -r ".name // .id // \"broker-$i\"" <<< "$broker")"
  host="$(jq -r '.host // empty' <<< "$broker")"
  user="$(jq -r '.user // "root"' <<< "$broker")"
  port="$(jq -r '.port // 22' <<< "$broker")"
  deploy_dir="$(jq -r --arg id "$broker_id" --arg channel "$channel" '.deploy_dir // "/opt/rtx5-broker-admin-ui/\($id)/\($channel)"' <<< "$broker")"
  container_name="$(jq -r --arg id "$broker_id" --arg channel "$channel" '.container_name // "rtx5-broker-admin-ui-\($id)-\($channel)"' <<< "$broker")"
  app_port="$(jq -r '.app_port // 8080' <<< "$broker")"
  domain="$(jq -r '.domain // .nginx.domain // empty' <<< "$broker")"
  backend_host="$(jq -r '.backend_host // .nginx.backend_host // "127.0.0.1"' <<< "$broker")"
  backend_port="$(jq -r '.backend_port // .nginx.backend_port // 8091' <<< "$broker")"
  enable_nginx="$(jq -r 'if ((.nginx.enabled // false) == true) or ((.domain // .nginx.domain // "") != "") then "true" else "false" end' <<< "$broker")"
  enable_https="$(jq -r 'if (.https // .nginx.https // true) == true then "true" else "false" end' <<< "$broker")"
  ssl_email="$(jq -r '.ssl_email // .nginx.email // empty' <<< "$broker")"
  if [[ -z "$ssl_email" ]]; then
    ssl_email="${LETSENCRYPT_EMAIL:-}"
  fi

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
  remote_env="$remote_env DOMAIN=$(shell_quote "$domain")"
  remote_env="$remote_env BACKEND_HOST=$(shell_quote "$backend_host")"
  remote_env="$remote_env BACKEND_PORT=$(shell_quote "$backend_port")"
  remote_env="$remote_env ENABLE_NGINX=$(shell_quote "$enable_nginx")"
  remote_env="$remote_env ENABLE_HTTPS=$(shell_quote "$enable_https")"
  remote_env="$remote_env SSL_EMAIL=$(shell_quote "$ssl_email")"

  ssh -p "$port" "${ssh_opts[@]}" "$target" "$remote_env bash -s" <<'REMOTE'
set -Eeuo pipefail

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

docker_cmd() {
  if docker ps >/dev/null 2>&1; then
    docker "$@"
  else
    as_root docker "$@"
  fi
}

install_nginx_stack() {
  if command -v nginx >/dev/null 2>&1 && { [ "$ENABLE_HTTPS" != "true" ] || command -v certbot >/dev/null 2>&1; }; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    as_root env DEBIAN_FRONTEND=noninteractive apt-get update
    as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx
    return
  fi

  echo "Nginx/Certbot auto-install currently supports Debian/Ubuntu servers with apt-get." >&2
  echo "Install nginx, certbot, and the nginx certbot plugin manually, then rerun deploy." >&2
  exit 1
}

reload_nginx() {
  as_root nginx -t

  if command -v systemctl >/dev/null 2>&1; then
    as_root systemctl enable --now nginx
    as_root systemctl reload nginx
  elif command -v service >/dev/null 2>&1; then
    as_root service nginx reload || as_root service nginx restart
  else
    as_root nginx -s reload || as_root nginx
  fi
}

ensure_conf_d_include() {
  if as_root grep -Fq 'include /etc/nginx/conf.d/*.conf;' /etc/nginx/nginx.conf; then
    return
  fi

  tmp_nginx="$(mktemp)"
  if ! as_root awk '
    BEGIN { inserted = 0 }
    /^[[:space:]]*http[[:space:]]*\{/ && inserted == 0 {
      print
      print "    include /etc/nginx/conf.d/*.conf;"
      inserted = 1
      next
    }
    { print }
  ' /etc/nginx/nginx.conf > "$tmp_nginx"; then
    rm -f "$tmp_nginx"
    echo "Failed to prepare nginx.conf with conf.d include." >&2
    exit 1
  fi

  if ! grep -Fq 'include /etc/nginx/conf.d/*.conf;' "$tmp_nginx"; then
    rm -f "$tmp_nginx"
    echo "Could not find http block in /etc/nginx/nginx.conf for conf.d include." >&2
    exit 1
  fi

  as_root cp /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.bak.$(date +%s)"
  as_root install -m 0644 "$tmp_nginx" /etc/nginx/nginx.conf
  rm -f "$tmp_nginx"
}

configure_nginx() {
  if [ "$ENABLE_NGINX" != "true" ]; then
    return
  fi

  if [ -z "$DOMAIN" ]; then
    echo "ENABLE_NGINX is true but DOMAIN is empty." >&2
    exit 1
  fi

  if ! printf '%s' "$DOMAIN" | grep -Eq '^[A-Za-z0-9.-]+$'; then
    echo "DOMAIN contains invalid characters: $DOMAIN" >&2
    exit 1
  fi

  if [ "$ENABLE_HTTPS" = "true" ] && [ -z "$SSL_EMAIL" ]; then
    echo "HTTPS is enabled for $DOMAIN but SSL_EMAIL/LETSENCRYPT_EMAIL is empty; registering without email."
  fi

  install_nginx_stack

  tmp_conf="$(mktemp)"
  cat > "$tmp_conf" <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN;

  client_max_body_size 20m;

  location /api/ {
    proxy_pass http://$BACKEND_HOST:$BACKEND_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /manager/ {
    proxy_pass http://$BACKEND_HOST:$BACKEND_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /Manager/ {
    proxy_pass http://$BACKEND_HOST:$BACKEND_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /ext-api/ {
    proxy_pass http://$BACKEND_HOST:$BACKEND_PORT/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /ws/ {
    proxy_pass http://$BACKEND_HOST:$BACKEND_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  location / {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX

  conf_path="/etc/nginx/conf.d/$CONTAINER_NAME.conf"
  as_root mkdir -p /etc/nginx/conf.d
  as_root install -m 0644 "$tmp_conf" "$conf_path"

  if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
    as_root rm -f "/etc/nginx/sites-enabled/$CONTAINER_NAME.conf"
    as_root rm -f "/etc/nginx/sites-available/$CONTAINER_NAME.conf"
    as_root rm -f /etc/nginx/sites-enabled/default
  fi
  as_root rm -f /etc/nginx/conf.d/default.conf
  ensure_conf_d_include

  rm -f "$tmp_conf"
  reload_nginx

  nginx_dump="$(mktemp)"
  if ! as_root nginx -T > "$nginx_dump" 2>&1; then
    cat "$nginx_dump" >&2
    rm -f "$nginx_dump"
    exit 1
  fi

  if ! grep -Fq "server_name $DOMAIN;" "$nginx_dump"; then
    cat "$nginx_dump" >&2
    rm -f "$nginx_dump"
    echo "Nginx loaded config does not include server_name $DOMAIN." >&2
    exit 1
  fi
  rm -f "$nginx_dump"

  if [ "$ENABLE_HTTPS" = "true" ]; then
    certbot_args="--register-unsafely-without-email"
    if [ -n "$SSL_EMAIL" ]; then
      certbot_args="-m $SSL_EMAIL"
    fi

    as_root certbot --nginx \
      --non-interactive \
      --agree-tos \
      --redirect \
      --keep-until-expiring \
      $certbot_args \
      -d "$DOMAIN"
    reload_nginx
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on this server." >&2
  exit 1
fi

port_binding="$APP_PORT:80"
if [ "$ENABLE_NGINX" = "true" ]; then
  port_binding="127.0.0.1:$APP_PORT:80"
fi

printf '%s' "$GHCR_TOKEN" | docker_cmd login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null
docker_cmd pull "$IMAGE_REF"
docker_cmd rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker_cmd run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "$port_binding" \
  --env-file "$DEPLOY_DIR/runtime.env" \
  "$IMAGE_REF"
docker_cmd image prune -f >/dev/null 2>&1 || true
configure_nginx
REMOTE
done
