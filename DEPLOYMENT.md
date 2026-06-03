# Docker/GHCR Broker Deployment

This repo builds one Docker image and deploys the same image to every broker server. Per-broker URLs are injected at container startup through runtime environment variables, so the image does not need to be rebuilt for each broker.

## GitHub Secrets

Create these repository secrets:

| Secret | Purpose |
| --- | --- |
| `BROKERS_JSON` | Optional JSON broker list override. If empty, CI/CD reads the checked-in `brokers.json`. |
| `BROKER_SSH_PRIVATE_KEY` | Private SSH key that can log in to each broker server listed in `BROKERS_JSON`. |
| `BROKER_ENV_GTA` | Runtime env file for the Grow Trading Academy broker. Referenced by `env_secret` in `BROKERS_JSON`. |
| `GHCR_USERNAME` | GitHub user or machine account used by broker servers to pull from GHCR. |
| `GHCR_TOKEN` | GitHub token with permission to read the GHCR package. For private packages, use `read:packages` plus repo access. |
| `LETSENCRYPT_EMAIL` | Email used by Certbot for HTTPS certificates. Optional if each broker entry has `ssl_email`. |

Do not commit real broker credentials. The checked-in `brokers.json` should contain only broker deployment metadata and `env_secret` names. Runtime environment values stay in secrets such as `BROKER_ENV_GTA`.

## Broker JSON Shape

```json
{
  "brokers": [
    {
      "id": "grow-trading-academy",
      "host": "103.91.186.142",
      "user": "root",
      "port": 40111,
      "channel": "canary",
      "enabled": true,
      "env_secret": "BROKER_ENV_GTA",
      "domain": "admin.growtradingacademy.com",
      "https": true,
      "backend_url": "https://services.growtradingacademy.com",
      "server_ip": "103.91.186.142",
      "backend_host": "127.0.0.1",
      "backend_port": 8091,
      "app_port": 8080
    }
  ]
}
```

## Broker Env Secret Shape

`BROKER_ENV_GTA` is stored separately from `BROKERS_JSON` and must use Docker `--env-file` format:

```env
BACKEND_TARGET=web
API_HOST=https://services.growtradingacademy.com
API_HOST_EXT=https://services.growtradingacademy.com
WS_HOST=wss://services.growtradingacademy.com
DEFAULT_MT5_SERVER=103.91.186.142
DISCOVERY_BASE_URL=https://superbackend.orrnn.com
USE_MOCK_DISCOVERY=false
```

Add another workflow env mapping if you create a new `env_secret` name for another broker.

The broker `domain` is the deployed admin UI host. The frontend backend API should use `backend_url`/`API_HOST`, such as `https://services.growtradingacademy.com`. The host Nginx config can still proxy `/api/`, `/manager/`, `/Manager/`, `/ext-api/`, and `/ws/` to `backend_host:backend_port` when a broker uses its admin domain as the API origin. Only set `nginx.listen_host` when every public HTTPS vhost on that IP is also configured for the same exact listen address; on a shared-IP server, leave it empty so nginx can select by SNI/server name.

## Server Requirements

Each broker server must have:

- Docker installed and running.
- SSH access for the configured `user`.
- The configured user must be able to run Docker commands, or have passwordless `sudo` for Docker.
- For Nginx/HTTPS automation, the configured user must have passwordless `sudo`.
- DNS `A`/`AAAA` record for the configured `domain` must point to the server before Certbot runs.
- Ports `80` and `443` must be open on the server firewall/security group.

When `domain` is set, the deployment binds Docker to `127.0.0.1:<app_port>` and configures host Nginx to serve the public domain. If `https` is true, Certbot configures the Let's Encrypt certificate and redirects HTTP to HTTPS.

## Workflow

On push to `main`, GitHub Actions:

1. Runs `npm ci` and `npm run build`.
2. Builds the Docker image.
3. Pushes the image to `ghcr.io/rtx5-orrnn/rtx5-broker-admin-ui` with `latest` and commit SHA tags.
4. SSHes into each broker server from `BROKERS_JSON`, or from checked-in `brokers.json` when that secret is empty.
5. Pulls the commit SHA image and restarts the container with that broker's runtime config.
