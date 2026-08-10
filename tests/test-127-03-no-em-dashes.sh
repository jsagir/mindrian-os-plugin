#!/usr/bin/env bash
# Phase 127 Plan 03 -- HARD RULE no em-dashes structural defense.
#
# Sweeps every Phase 127 file (sources + tests + fixtures + docs + JSON
# registry) for em-dash U+2014 and en-dash U+2013. Returns ZERO matches.
#
# The pre-commit hook enforces globally; this harness extends to docs +
# fixtures + tests so the phase's release gate is self-contained.
#
# The harness uses grep -P with hex escapes for the forbidden codepoints so
# the harness body itself contains zero em-dashes / en-dashes (lives under
# its own scrutiny).
#
# HARD RULE: no em-dashes (hyphens only) anywhere in this file.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Phase 127 files (sources + tests + docs). Fixtures swept separately via find.
PHASE_127_FILES=(
  "bin/mindrian-brain-mcp-client.cjs"
  "lib/core/directive-envelope.cjs"
  "lib/core/directive-envelope.test.cjs"
  "lib/core/refusal-messaging.cjs"
  "lib/core/refusal-messaging.test.cjs"
  "lib/core/migration-snapshot.cjs"
  "lib/core/migration-snapshot.test.cjs"
  "lib/core/mindrian-brain-shim.test.cjs"
  "scripts/migrate-brain-mcp-from-http-to-stdio.cjs"
  "scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs"
  "lib/core/doctor/class-m-brain-smoke.cjs"
  "lib/core/doctor/class-m-brain-smoke.test.cjs"
  "tests/test-127-00-shim-handshake.sh"
  "tests/test-127-01-migration-safety.sh"
  "tests/test-127-02-doctor-class-m.sh"
  "tests/test-127-03-acceptance-gates.sh"
  "tests/test-127-03-canon-part-8-adversarial.sh"
  "tests/test-127-03-no-em-dashes.sh"
  "docs/install/BRAIN-SETUP.md"
  "data/capability-map-registry.json"
)

# Fixture READMEs + JSON files swept dynamically.
FIXTURE_FILES=$(find tests/fixtures/127-01-migration tests/fixtures/127-03-acceptance \
  \( -name "*.md" -o -name "*.json" \) 2>/dev/null)

# Forbidden codepoints encoded as hex bytes to keep this file em-dash-free:
#   U+2014 EM DASH      -> UTF-8 bytes E2 80 94
#   U+2013 EN DASH      -> UTF-8 bytes E2 80 93
FORBIDDEN_REGEX='\xe2\x80\x94|\xe2\x80\x93'

FAIL_COUNT=0
SCANNED=0

for f in "${PHASE_127_FILES[@]}" $FIXTURE_FILES; do
  [ ! -f "$f" ] && continue
  SCANNED=$((SCANNED + 1))
  if grep -nP "$FORBIDDEN_REGEX" "$f" >/dev/null 2>&1; then
    echo "FAIL: $f contains em-dash or en-dash:"
    grep -nP "$FORBIDDEN_REGEX" "$f" | head -3
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo "Scanned $SCANNED Phase 127 files (sources + tests + fixtures + docs)"
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "NO-EM-DASHES HARD RULE: PASS across all Phase 127 files"
  exit 0
else
  echo "NO-EM-DASHES HARD RULE: FAIL ($FAIL_COUNT file(s) contain em-dash or en-dash)"
  exit 1
fi
