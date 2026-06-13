#!/usr/bin/env bash
set -euo pipefail

docker compose -f infra/local/docker-compose.yml config >/dev/null
docker compose -f infra/local/docker-compose.image.yml config >/dev/null

echo "Compose files are valid."
