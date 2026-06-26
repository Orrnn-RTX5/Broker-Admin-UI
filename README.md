# RTX5 Broker Admin

RTX5 Broker Admin is the existing Vite React admin UI used for broker operations. The same source builds both the hosted web app and the Windows desktop app.

## Web Development

```bash
npm ci
npm run dev
npm run build
```

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

Create and push a version tag from the source repo:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions runs `.github/workflows/admin-desktop-release.yml` on tags matching `v*`. The workflow installs with `npm ci`, runs tests, lint, web build, and then publishes the Windows installer with `electron-builder`.

Release assets are uploaded to:

https://github.com/rtx5-orrnn/rtx5-broker-admin-releases/releases

The workflow uses only the repository secret `RTX5_BROKER_ADMIN_RELEASES` as `GH_TOKEN` for cross-repo publishing. Do not commit GitHub tokens to source, `.env`, README, package scripts, or workflow logs.

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
