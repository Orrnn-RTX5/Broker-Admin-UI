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

Local browser development uses Vite's HTTP proxy. Keep
`VITE_USE_DEV_PROXY=true` in `.env.development.local` so the Journal and other
authenticated APIs go through the local origin. Disabling it makes the browser
call the broker directly; a backend that does not allow the localhost origin
will produce a CORS `Network Error`. Restart Vite if an environment change has
not been applied automatically.

For a broker that exposes manager/admin endpoints at the root, list its exact
origin in `VITE_DIRECT_MANAGER_ORIGINS` in `.env.local` (comma separated). For
example, TEST uses `https://fxtrustbrokerbackend.orrnn.com`. Other brokers keep
their existing `/manager` paths. Discovery's explicit `direct_manager_paths`
setting takes precedence when supplied.

Login and flat routes such as `GroupList` stay under `/manager` locally. Native
routes such as `/api/v1/manager/journal` keep their versioned path through the
same Vite proxy. The selected broker and direct-path mode travel in local routing
cookies; Vite strips those cookies and, where configured, the path prefix before
forwarding. Authentication fetches use `same-origin` credentials so those local
cookies reach Vite without including cookies on cross-origin login requests.

## Production Docker configuration

The Docker image is shared across brokers. Supply each installation's runtime
values in the GitHub environment secret `ADMIN_UI_ENV`. The deployment writes
these values to `$HOME/broker-admin-ui.env` on its server (or the configured
`ADMIN_UI_ENV_FILE`). For example:

```env
BACKEND_TARGET=web
BROKER_ID=your-broker-id
API_HOST=https://api.your-broker.example
WS_HOST=wss://api.your-broker.example
FEED_WS_URL=wss://api.your-broker.example/ws/feed
FEED_STATUS_URL=https://api.your-broker.example/ws/feed/status
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

The deploy workflow passes these values to Docker with `--env-file`. The image
excludes source `.env` files, and the container generates browser runtime
configuration from the supplied values when it starts. After editing the
`ADMIN_UI_ENV` secret, redeploy the container to apply changes. Runtime configuration
is public in the browser, so keep passwords and tokens in a separate secret
store, not in this file.

Missing build assets must return an uncached `404`, never the SPA document.
The Node runtime and optional Nginx configuration enforce this, while HTML and
runtime configuration stay uncached. On web, a failed lazy CSS or JavaScript
download triggers at most one automatic reload per minute in a tab. If the
download still fails, the error screen offers a document reload; React's cached
failed lazy import cannot be retried by simply resetting the error boundary.

### Web releases for multiple brokers

Pushing to `main` builds the current commit and deploys its immutable image
digest to the `production` GitHub environment. No broker approval SHA or
previously validated image is required. `ADMIN_RELEASE_SOURCE_SHA` and
`ADMIN_RELEASE_IMAGE_REF` are no longer used. Release-candidate pushes publish
an image without deploying. Pull requests run a build only; the release path
uses the Docker build, without a full unit-test run or server inventory scan.

In GitHub **Settings > Environments**, configure `production` for the default
installation and create one environment per additional broker. For each, set:

- Secrets: `ADMIN_UI_ENV`, `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`,
  `GHCR_USERNAME`, and `GHCR_TOKEN` (with package-read access).
- Variables: `ADMIN_CONTAINER_NAME`, `ADMIN_PORT_MAPPING`, and
  `ADMIN_UI_ENV_FILE` if overriding the defaults `broker-admin-ui`, `8080:80`,
  and `$HOME/broker-admin-ui.env`.

Existing repository secrets/variables remain fallbacks for `production`.
For additional brokers, set all target secrets at environment level so they
cannot fall back to another broker's server. When sharing a server, use distinct
container names, host ports, and environment-file paths.

To deploy another broker, open **Actions > CI - Build and Deploy Admin UI >
Run workflow**, choose the `main` branch and that broker's environment. The
workflow builds the selected commit and deploys only to the selected target.
Server startup and runtime-configuration checks remain, with rollback on failure.
There is no automatic deployment to every broker.

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

The checked-in GitHub Actions workflow builds web images on `main` and `release-candidate/**`, deploys `main` to `production`, and supports manual deployments to other broker environments. Desktop publishing is currently a local command. Set `GH_TOKEN` in the shell environment, then run:

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
