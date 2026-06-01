#!/bin/sh
set -eu

CONFIG_FILE=/usr/share/nginx/html/runtime-config.js

js_escape() {
  printf '%s' "${1:-}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

api_host="${API_HOST:-${VITE_API_HOST:-}}"
ws_host="${WS_HOST:-${VITE_WS_HOST:-}}"
api_host_ext="${API_HOST_EXT:-${VITE_API_HOST_EXT:-}}"
default_mt5_server="${DEFAULT_MT5_SERVER:-${VITE_DEFAULT_MT5_SERVER:-}}"
discovery_base_url="${DISCOVERY_BASE_URL:-${VITE_DISCOVERY_BASE_URL:-}}"
use_mock_discovery="${USE_MOCK_DISCOVERY:-${VITE_USE_MOCK_DISCOVERY:-false}}"

cat > "$CONFIG_FILE" <<EOF
window.__RTX5_RUNTIME_CONFIG__ = {
  API_HOST: "$(js_escape "$api_host")",
  WS_HOST: "$(js_escape "$ws_host")",
  API_HOST_EXT: "$(js_escape "$api_host_ext")",
  DEFAULT_MT5_SERVER: "$(js_escape "$default_mt5_server")",
  DISCOVERY_BASE_URL: "$(js_escape "$discovery_base_url")",
  USE_MOCK_DISCOVERY: "$(js_escape "$use_mock_discovery")"
};
EOF
