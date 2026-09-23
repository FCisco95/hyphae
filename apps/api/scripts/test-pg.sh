#!/usr/bin/env bash
# Runs the real-Postgres concurrency tests against a disposable local Docker container (never Neon).
set -euo pipefail
name="hyphae-test-pg-$$"
port="${HYPHAE_TEST_PG_PORT:-55432}"
docker run -d --rm --name "$name" -p "$port:5432" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=hyphae postgres:17 >/dev/null
trap 'docker stop "$name" >/dev/null' EXIT
until docker exec "$name" pg_isready -U postgres -d hyphae >/dev/null 2>&1; do sleep 0.5; done
sleep 1
cd "$(dirname "$0")/.."
HYPHAE_TEST_PG_URL="postgres://postgres:test@127.0.0.1:$port/hyphae" pnpm exec vitest run --config vitest.pg.config.ts
