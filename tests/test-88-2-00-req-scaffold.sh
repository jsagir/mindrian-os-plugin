#!/usr/bin/env bash
# Phase 88.2-00 Wave-0 -- assert UISEL-88.2-07/08/09 IDs exist in REQUIREMENTS.md.
# Exit 0 on full pass; exit non-zero with offending ID on first miss.
set -euo pipefail
REQ=".planning/REQUIREMENTS.md"
if [ ! -f "$REQ" ]; then
  echo "FAIL: $REQ not found"
  exit 2
fi
for ID in "UISEL-88.2-07" "UISEL-88.2-08" "UISEL-88.2-09"; do
  if ! grep -q "$ID" "$REQ"; then
    echo "FAIL: $ID missing from $REQ"
    exit 1
  fi
done
echo "PASS: 3/3 UISEL-88.2 IDs present"
exit 0
