#!/usr/bin/env bash
# Phase 400.2.1: the persona deep-run defect fixes. Runs the phase tests, then the hook suites that the reader search
# guard touches, then bash tests/run-all-4002.sh; exits non-zero on any failure.
set -u
cd "$(dirname "$0")/.." || exit 1
FAIL=0
for t in tests/test-40021-persona-domain.cjs tests/test-40021-relevance-floor.cjs tests/test-40021-blue-coverage.cjs tests/test-40021-handle-guidance.cjs tests/test-40021-command-notes.cjs tests/test-40021-reader-search-hook.cjs tests/test-4002-rulings.cjs tests/test-4002-quick.cjs tests/test-386-web-credential-hook.cjs tests/test-391-hooks-contract.cjs tests/test-389-hook-unwire.cjs; do
  echo "--- 400.2.1: $t ---"
  if node "$t"; then echo ">>> 400.2.1: $t: PASSED"; else echo ">>> 400.2.1: $t: FAILED"; FAIL=1; fi
done
# Known red at base a594a682d (not counted): tests/test-346-catalogue-schema.cjs (ambient-stop.cjs and
# card-before-answer-hook.cjs are not catalogued) and tests/test-261029-qef-hook-timeouts.cjs.
echo "KNOWN_RED at base a594a682d (not counted): tests/test-346-catalogue-schema.cjs tests/test-261029-qef-hook-timeouts.cjs"
for c in "build-skill-mirrors.cjs --check" "build-connector-registry.cjs --check" "build-harness-manifest.cjs --check" "check-shape-declaration.cjs --check"; do
  echo "--- 400.2.1 check: $c ---"
  if node scripts/$c; then echo ">>> 400.2.1 check: $c: PASSED"; else echo ">>> 400.2.1 check: $c: FAILED"; FAIL=1; fi
done
if [ "$FAIL" -eq 0 ]; then
  echo "--- 400.2.1: run-all-4002 ---"
  if bash tests/run-all-4002.sh; then echo ">>> 400.2.1: run-all-4002: PASSED"; else echo ">>> 400.2.1: run-all-4002: FAILED"; FAIL=1; fi
fi
exit $FAIL
