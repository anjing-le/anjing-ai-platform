#!/usr/bin/env bash
set -euo pipefail

files="$(find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -name '*.go' -print | sort)"

if [[ -z "$files" ]]; then
  echo "No Go files found."
  exit 0
fi

unformatted="$(printf '%s\n' "$files" | xargs gofmt -l)"

if [[ -n "$unformatted" ]]; then
  echo "Go files are not gofmt formatted:"
  printf '%s\n' "$unformatted" | sed 's/^/- /'
  echo
  echo "Run: gofmt -w <files>"
  exit 1
fi

echo "Go files are gofmt formatted."
