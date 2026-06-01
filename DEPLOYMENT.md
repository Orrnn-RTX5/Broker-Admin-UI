# Docker/GHCR Broker Deployment

This repo builds one Docker image and deploys the same image to every broker server. Per-broker URLs are injected at container startup through runtime environment variables, so the image does not need to be rebuilt for each broker.

## GitHub Secrets

Create these repository secrets:

| Secret | Purpose |
| --- | --- |
| `BROKERS_JSON` | JSON broker list. Use `brokers.example.json` as the template. |
| `BROKER_SSH_PRIVATE_KEY` | Private SSH key that can log in to each broker server listed in `BROKERS_JSON`. |
| `GHCR_USERNAME` | GitHub user or machine account used by broker servers to pull from GHCR. |
| `GHCR_TOKEN` | GitHub token with permission to read the GHCR package. For private packages, use `read:packages` plus repo access. |

Do not commit real broker credentials. `brokers.json` is ignored by Git for local notes; the workflow reads the real config from the `BROKERS_JSON` secret.

## Broker JSON Shape

```json
{
  "brokers": [
    {
      "name": "broker-name",
      "host": "203.0.113.10",
      "port": 22,
      "user": "deploy",
      "deploy_dir": "/opt/rtx5-broker-admin-ui",
      "container_name": "rtx5-broker-admin-ui",
      "app_port": 8080,
      "env": {
        "API_HOST": "https://broker-api.example.com",
        "API_HOST_EXT": "http://broker-api.example.com:8091",
        "WS_HOST": "wss://broker-api.example.com/ws/feed",
        "DEFAULT_MT5_SERVER": "broker-api.example.com",
        "DISCOVERY_BASE_URL": "https://superbackend.orrnn.com",
        "USE_MOCK_DISCOVERY": "false"
      }
    }
  ]
}
```

## Server Requirements

Each broker server must have:

- Docker installed and running.
- SSH access for the configured `user`.
- The configured user must be able to run Docker commands.
- The selected `app_port` must be open in the firewall or reverse proxy.

## Workflow

On push to `main`, GitHub Actions:

1. Runs `npm ci` and `npm run build`.
2. Builds the Docker image.
3. Pushes the image to `ghcr.io/rtx5-orrnn/rtx5-broker-admin-ui` with `latest` and commit SHA tags.
4. SSHes into each broker server in `BROKERS_JSON`.
5. Pulls the commit SHA image and restarts the container with that broker's runtime config.
