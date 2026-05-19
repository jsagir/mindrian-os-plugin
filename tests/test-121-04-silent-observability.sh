#!/usr/bin/env bash
# Phase 121-04 -- D-12 silent-observability invariant.
# Verifies NO user-facing surface references the telemetry corpus count.
# Per CONTEXT.md D-12: "Telemetry is lab-side concern. User doesn't need to see it."
# SEED-002's /gsd:new-milestone trigger reads the corpus; users do not.
#
# 4 gates:
#   1. no user-facing surface references the telemetry corpus
#   2. commands/status.md is clean of all telemetry / trajectory / corpus / SEED-002 references
#   3. statusline broadcast scripts do not surface corpus
#   4. TELEMETRY-SCHEMA.md ITSELF references D-12 invariant (documentation evidence)
#
# bash only. No emoji. No em-dashes (per memory rule feedback_no_emdashes).

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# User-facing surface directories.
USER_FACING_DIRS=()
for d in commands lib/hmi skills; do
  if [ -d "$d" ]; then
    USER_FACING_DIRS+=("$d")
  fi
done
if [ "${#USER_FACING_DIRS[@]}" -eq 0 ]; then
  fail "no user-facing directories present (commands/, lib/hmi/, skills/)"
fi

# Forbidden user-facing references (D-12 corpus exposure):
#   - "telemetry corpus" / "trajectory corpus" / "events corpus"
#   - "corpus count" / "corpus size" / "corpus events"
#   - "N / 100" or "/100 events" (the >=100 trigger threshold)
#   - "SEED-002 progress" (premature exposure of the lab loop)
FORBIDDEN_PATTERNS='(telemetry|trajectory|events)[[:space:]]+corpus|corpus[[:space:]]+(count|size|events)|/[[:space:]]*100[[:space:]]+events|[[:space:]]/100[[:space:]]+events|SEED-002[[:space:]]+progress|trajectory[[:space:]]+corpus|telemetry[[:space:]]+corpus'

# Gate 1: no user-facing surface references the corpus
HITS=$(grep -rEi "$FORBIDDEN_PATTERNS" "${USER_FACING_DIRS[@]}" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  echo "$HITS" >&2
  fail "user-facing surface references telemetry corpus (D-12 silent-observability invariant violated)"
fi

# Gate 2: /mos:status command is clean of all telemetry layer references.
# Per D-12, the /mos:status surface MUST NOT include a "trajectory corpus" row.
if [ -f commands/status.md ]; then
  if grep -Ei "telemetry|trajectory|corpus|SEED-002" commands/status.md >/dev/null 2>&1; then
    grep -Ei "telemetry|trajectory|corpus|SEED-002" commands/status.md >&2
    fail "commands/status.md exposes telemetry layer (D-12 violation)"
  fi
fi

# Gate 3: statusline broadcast scripts do not surface corpus.
# Statusline files live in lib/hmi/ or scripts/statusline*; both checked.
STATUSLINE_FILES=()
for cand in lib/hmi/statusline*.cjs lib/hmi/statusline*.js scripts/statusline*.cjs scripts/statusline*.js scripts/statusline*.sh; do
  if [ -f "$cand" ]; then
    STATUSLINE_FILES+=("$cand")
  fi
done
if [ "${#STATUSLINE_FILES[@]}" -gt 0 ]; then
  if grep -lEi "telemetry corpus|trajectory corpus|corpus count|/100 events|SEED-002" "${STATUSLINE_FILES[@]}" 2>/dev/null | head -1 | grep -q .; then
    grep -Ei "telemetry corpus|trajectory corpus|corpus count|/100 events|SEED-002" "${STATUSLINE_FILES[@]}" >&2
    fail "statusline references telemetry corpus (D-12 violation)"
  fi
fi

# Gate 4: TELEMETRY-SCHEMA.md ITSELF references D-12 invariant (documentation evidence).
[ -f docs/TELEMETRY-SCHEMA.md ] || fail "docs/TELEMETRY-SCHEMA.md missing"
grep -qE "D-12|silent observability|Silent Observability" docs/TELEMETRY-SCHEMA.md \
  || fail "docs/TELEMETRY-SCHEMA.md missing D-12 silent-observability section"

echo "PASS: D-12 silent-observability invariant (4 gates green; user-facing surfaces clean across ${#USER_FACING_DIRS[@]} dirs)"
