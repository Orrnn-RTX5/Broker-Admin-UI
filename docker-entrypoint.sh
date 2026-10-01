#!/bin/sh
set -eu

CONFIG_FILE="${DIST_DIR:-/app/dist}/runtime-config.js"

js_escape() {
  printf '%s' "${1:-}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

api_host="${API_HOST:-${VITE_API_HOST:-}}"
ws_host="${WS_HOST:-${VITE_WS_HOST:-}}"
api_host_ext="${API_HOST_EXT:-${VITE_API_HOST_EXT:-}}"
default_mt5_server="${DEFAULT_MT5_SERVER:-${VITE_DEFAULT_MT5_SERVER:-}}"
default_discovery_base_url="${DEFAULT_DISCOVERY_BASE_URL:-${VITE_DEFAULT_DISCOVERY_BASE_URL:-https://superbackend.orrnn.com}}"
discovery_base_url="${DISCOVERY_BASE_URL:-${VITE_DISCOVERY_BASE_URL:-$default_discovery_base_url}}"
use_mock_discovery="${USE_MOCK_DISCOVERY:-${VITE_USE_MOCK_DISCOVERY:-false}}"
backend_target="${BACKEND_TARGET:-${VITE_BACKEND_TARGET:-${BACKEND_MODE:-${VITE_BACKEND_MODE:-web}}}}"
broker_id="${BROKER_ID:-${VITE_BROKER_ID:-}}"
broker_name="${BROKER_NAME:-${VITE_BROKER_NAME:-}}"
broker_server="${BROKER_SERVER:-${VITE_BROKER_SERVER:-}}"
feed_broker_id="${FEED_BROKER_ID:-${VITE_FEED_BROKER_ID:-}}"
feed_ws_url="${FEED_WS_URL:-${VITE_FEED_WS_URL:-}}"
feed_status_url="${FEED_STATUS_URL:-${VITE_FEED_STATUS_URL:-}}"
feed_send_token="${FEED_SEND_TOKEN:-${VITE_FEED_SEND_TOKEN:-true}}"
feed_broker_token="${FEED_BROKER_TOKEN:-${VITE_FEED_BROKER_TOKEN:-}}"
direct_manager_origins="${DIRECT_MANAGER_ORIGINS:-${VITE_DIRECT_MANAGER_ORIGINS:-}}"
super_admin_api_host="${SUPER_ADMIN_API_HOST:-${VITE_SUPER_ADMIN_API_HOST:-https://superbackend.orrnn.com}}"

normalize_origin() {
  printf '%s' "${1:-}" | sed -e 's#/*$##' -e 's#^http://##' -e 's#^https://##' | tr '[:upper:]' '[:lower:]'
}

discovery_origin="$(normalize_origin "$discovery_base_url")"
api_origin="$(normalize_origin "$api_host")"
api_ext_origin="$(normalize_origin "$api_host_ext")"

if [ -z "$discovery_origin" ] || [ "$discovery_origin" = "$api_origin" ] || [ "$discovery_origin" = "$api_ext_origin" ]; then
  discovery_base_url="$default_discovery_base_url"
fi

cat > "$CONFIG_FILE" <<EOF
window.__RTX5_RUNTIME_CONFIG__ = {
  BACKEND_TARGET: "$(js_escape "$backend_target")",
  BROKER_ID: "$(js_escape "$broker_id")",
  BROKER_NAME: "$(js_escape "$broker_name")",
  BROKER_SERVER: "$(js_escape "$broker_server")",
  FEED_BROKER_ID: "$(js_escape "$feed_broker_id")",
  FEED_WS_URL: "$(js_escape "$feed_ws_url")",
  FEED_STATUS_URL: "$(js_escape "$feed_status_url")",
  FEED_SEND_TOKEN: "$(js_escape "$feed_send_token")",
  FEED_BROKER_TOKEN: "$(js_escape "$feed_broker_token")",
  DIRECT_MANAGER_ORIGINS: "$(js_escape "$direct_manager_origins")",
  SUPER_ADMIN_API_HOST: "$(js_escape "$super_admin_api_host")",
  API_HOST: "$(js_escape "$api_host")",
  WS_HOST: "$(js_escape "$ws_host")",
  API_HOST_EXT: "$(js_escape "$api_host_ext")",
  DEFAULT_MT5_SERVER: "$(js_escape "$default_mt5_server")",
  DEFAULT_DISCOVERY_BASE_URL: "$(js_escape "$default_discovery_base_url")",
  DISCOVERY_BASE_URL: "$(js_escape "$discovery_base_url")",
  USE_MOCK_DISCOVERY: "$(js_escape "$use_mock_discovery")"
};
EOF

exec "$@"
