#!/usr/bin/env bash
# Run from anywhere: bash eureka/_tests/rest/run-all.sh   (needs node >= 18; no network, no installs)
cd "$(dirname "$0")" || exit 1
fail=0
for t in test-*.cjs; do node "$t" || fail=1; done
exit $fail
