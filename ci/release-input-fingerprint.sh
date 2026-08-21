#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:?reconstructed source root required}"
cd "$ROOT"

for required in apps packages scripts; do
  test -d "$required" || { echo "Missing release input directory: $required" >&2; exit 2; }
done

{
  find apps packages scripts \
    -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/android/*' \
    ! -path '*/ios/*' \
    -print0

  for root_file in package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json .npmrc; do
    test ! -f "$root_file" || printf '%s\0' "$root_file"
  done
} \
| LC_ALL=C sort -zu \
| while IFS= read -r -d '' file; do
    printf '%s  %s\n' "$(sha256sum "$file" | awk '{print $1}')" "$file"
  done \
| sha256sum \
| awk '{print $1}'
