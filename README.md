# RTX5 Broker Admin

RTX5 Broker Admin is the existing Vite React admin UI used for broker operations. The same source builds both the hosted web app and the Windows desktop app.

Nexa is available in the broker selector with API requests sent to
`https://nexa.orrnn.com` and live feeds at `wss://nexa.orrnn.com/ws/feed`.
Platform discovery records override its defaults; disabled Nexa records are
respected. Admin login uses `/manager/api/v2/admin/login` on this backend.
With `VITE_BROKER_ID=Nexa`, the admin selects the configured Nexa backend
without calling platform discovery. Set `VITE_API_HOST` and
`VITE_API_HOST_EXT` to `https://nexa.orrnn.com` for this installation.

## Web Development

```bash
npm ci
npm run dev
npm run build
```

For a broker that exposes manager/admin endpoints at the root, list its exact
origin in `VITE_DIRECT_MANAGER_ORIGINS` in `.env.local` (comma separated). For
example, TEST uses `https://fxtrustbrokerbackend.orrnn.com`. Other brokers keep
their existing `/manager` paths. Discovery's explicit `direct_manager_paths`
setting takes precedence when supplied.

Local requests stay under `/manager` so Vite can proxy login and flat routes such
as `GroupList`. The selected broker and direct-path mode travel in local routing
cookies; Vite strips those cookies and, where configured, the path prefix before
forwarding. Authentication fetches use `same-origin` credentials so those local
cookies reach Vite without including cookies on cross-origin login requests.

## Production Docker configuration

Give the production manager a broker-specific `.env` file and place it at
`$HOME/broker-admin-ui.env` on the deployment server, where `$HOME` belongs to
the SSH user used by the deploy workflow. At minimum, set `BROKER_ID` and
`API_HOST` to the broker's ID and API origin. For example:

```env
BACKEND_TARGET=web
BROKER_ID=your-broker-id
API_HOST=https://api.your-broker.example
WS_HOST=wss://api.your-broker.example
USE_MOCK_DISCOVERY=false
```

Set `BROKER_NAME` for a display name, `BROKER_SERVER` if login needs a specific
server handle, `DEFAULT_MT5_SERVER` if it uses a separate MT5 host,
`API_HOST_EXT` if the extended API uses another origin, and `FEED_WS_URL` or
`FEED_STATUS_URL` if the market feed uses different endpoints.
Keep `WS_HOST` at the WebSocket origin; other WebSocket routes use it too.
The `VITE_` names in the local `.env` are accepted by the container as well;
copy that file as-is and edit its broker values. Do not include both forms of
the same key. The desktop mode file changes only `VITE_BACKEND_TARGET`, so it
uses the same broker values from `.env`.

The deploy workflow passes this file to Docker with `--env-file`. The image
excludes source `.env` files, and the container generates browser runtime
configuration from the supplied values when it starts. After editing the server
file, restart or redeploy the container to apply changes. Runtime configuration
is public in the browser, so keep passwords and tokens in a separate secret
store, not in this file.

## Windows Desktop App

Run the Electron desktop app locally:

```bash
npm ci
npm run desktop:dev
```

Build the Windows x64 NSIS installer locally:

```bash
npm run desktop:build
```

Desktop builds use `vite build --mode electron` and package the existing `dist` output with Electron. The desktop app is unsigned for v1, so Windows SmartScreen may warn until code signing is added.

Desktop updates are manual. Publishing a GitHub release does not make running apps check or install automatically; users start the update flow from **Help > Check for Updates...**.

## Desktop Releases

The checked-in GitHub Actions workflow builds and deploys the web Docker image on pushes to `main`. Desktop publishing is currently a local command. Set `GH_TOKEN` in the shell environment, then run:

```bash
npm run release
```

Electron Builder publishes release assets to:

https://github.com/rtx5-orrnn/rtx5-broker-admin-releases/releases

Keep `GH_TOKEN` in a secret store or process environment. Do not commit it to source or env files.

## Broker Discovery Login Flow

The login bootstrap starts at `/`, where the user enters a Broker ID and chooses Manager or Admin. The UI normalizes the Broker ID, validates it, discovers the broker backend, stores the response in `sessionStorage` as `broker_info`, and then routes to `/manager-login` or `/admin-login`.

Manager login posts to `{broker_info.backend_url}/manager/api/v2/auth/login` with `user`, `password`, and the read-only `server` value from `broker_info.server_ip`. Admin login posts to `{broker_info.backend_url}/manager/api/v2/admin/login` with `user` and `password`. Successful login responses are stored in `sessionStorage` as `auth`, and the existing Admin token store is updated for the terminal APIs.

Discovery is configured with:

```env
VITE_BACKEND_TARGET=web
VITE_DISCOVERY_BASE_URL=https://superbackend.orrnn.com
VITE_USE_MOCK_DISCOVERY=true
```

Use `VITE_BACKEND_TARGET=web` for the hosted web app so each selected broker uses its broker-list backend/API URL. Use `VITE_BACKEND_TARGET=desktop` for the desktop/electron app so explicit desktop/local backend fields win first, public service URLs are preferred when present, and raw `server_ip` plus `server_port` is only the fallback.

Broker discovery entries should include a web URL field such as `backend_url`, `api_url`, `web_backend_url`, or `backend_domain`, plus a desktop field such as `server_ip`/`host` and `server_port`. Optional fields like `web_ext_api_url`, `desktop_backend_url`, and `ws_url` override the derived URLs when needed. A deployment `domain` is treated as the admin UI host, not the backend API URL. Use `nginx.listen_host` only on dedicated listen addresses; leave it empty on shared-IP broker servers.

`VITE_USE_MOCK_DISCOVERY=true` uses the local `testorrnn` and `orrnn` broker map while the SuperAdmin discovery endpoint is pending. Set it to `false` when `/api/v1/brokers/{broker_id}` is available.
