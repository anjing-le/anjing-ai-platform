#!/usr/bin/env bash
set -euo pipefail

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

go_routes="$tmp_dir/go-routes.txt"
openapi_routes="$tmp_dir/openapi-routes.txt"
missing_in_openapi="$tmp_dir/missing-in-openapi.txt"
missing_in_go="$tmp_dir/missing-in-go.txt"

rg --no-filename 'mux\.HandleFunc\("/(api/|healthz)' internal -g '*.go' \
  | sed -E 's/.*HandleFunc\("([^"]+)".*/\1/' \
  | sort -u > "$go_routes"

rg -o '^  /(api/[^:]+|healthz):' contracts/openapi/platform-api.yaml \
  | sed -E 's/^  //; s/:$//' \
  | sort -u > "$openapi_routes"

comm -23 "$go_routes" "$openapi_routes" > "$missing_in_openapi"
comm -13 "$go_routes" "$openapi_routes" > "$missing_in_go"

if [[ -s "$missing_in_openapi" || -s "$missing_in_go" ]]; then
  echo "OpenAPI route contract is out of sync."

  if [[ -s "$missing_in_openapi" ]]; then
    echo
    echo "Registered in Go but missing from OpenAPI:"
    sed 's/^/- /' "$missing_in_openapi"
  fi

  if [[ -s "$missing_in_go" ]]; then
    echo
    echo "Declared in OpenAPI but not registered in Go:"
    sed 's/^/- /' "$missing_in_go"
  fi

  exit 1
fi

echo "OpenAPI route contract matches Go registered routes."
