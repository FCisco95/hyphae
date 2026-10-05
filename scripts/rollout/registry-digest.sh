#!/usr/bin/env bash
# Prints the HTTP status and registry digest of registry.fly.io/hyphae-api:<tag> or @<digest>,
# read-only. Used by docs/demo/2026-10-05-api-rollout-plan.md to pin the machine update to an
# immutable digest. The Fly token goes to curl on stdin, never into argv or a file.
set -euo pipefail
ref="${1:?usage: registry-digest.sh <tag|sha256:digest>}"
# flyctl 0.4 prints a deprecation notice for this command on stderr; the token is on stdout.
fly auth token 2>/dev/null | {
  read -r t
  printf 'Authorization: Basic %s\n' "$(printf 'x:%s' "$t" | base64 | tr -d '\n')"
} | curl -sS -o /dev/null -D - -H @- \
  -H 'Accept: application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json' \
  "https://registry.fly.io/v2/hyphae-api/manifests/${ref}" |
  tr -d '\r' |
  awk -v ref="$ref" 'tolower($1) ~ /^http/ { code = $2 }
    tolower($1) == "content-type:" { type = $2 }
    tolower($1) == "docker-content-digest:" { digest = $2 }
    END { print ref, code, digest, type }'
