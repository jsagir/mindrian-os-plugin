#!/usr/bin/env bash
# Quick 261029-lcg aggregator: the legacy install clone check must use the
# legacy directory's own git root, and the migrator must repoint or remove
# symlinks that still point into the legacy directory.
# Hyphens only. exit 0 -> FAILED=0.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run "261029-lcg nested git check and symlink repoint" node tests/test-261029-lcg-legacy-clone-nested-git.cjs
run "341 legacy install teardown" node tests/test-341-legacy-install-teardown.cjs
run "install-state migration" node tests/test-install-state-migration.cjs

run "no em-dash or en-dash in 261029-lcg files" bash -c '
  files=$(ls -d tests/test-261029-lcg-*.cjs tests/run-all-261029-lcg.sh \
    scripts/migrate-legacy-install-location.cjs lib/core/doctor/shared.cjs 2>/dev/null)
  hits=$(LC_ALL=C grep -lP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASSED=$PASS FAILED=$FAIL"
[ "$FAIL" -eq 0 ]
