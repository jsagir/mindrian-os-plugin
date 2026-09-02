#!/usr/bin/env bash
#
# Phase 127-02 Task 3 -- live Class M shell harness.
#
# Verifies the doctor's --brain-smoke flag wiring end-to-end:
#   T1: --help text mentions --brain-smoke
#   T2: --brain-smoke --json prints valid JSON with class:M, 6 layers
#   T3: --brain-smoke (no --json) exits 0 (class-flag invariant)
#   T4: no-identity refusal cascade (no key) -- L1 PASS, L2 FAIL, L3-L6 skipped
#   T5: commands/doctor.md documents the flag
#
# Canon parts: 7 (reuse of existing class-dispatch pattern), 8 (LOCAL-only).
#
# HARD RULE: no em-dashes anywhere in this file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export REPO_ROOT  # so bash -c subshells see it
cd "$REPO_ROOT"

PASS=0
FAIL=0
FAILED=()

run() {
  local name="$1"
  local body="$2"
  local logfile
  logfile="$(mktemp -t 127-02-out-XXXXXX.log)"
  # set -e inside the sub-shell body so an intermediate failure short-circuits.
  # set -o pipefail catches pipe failures.
  if bash -c "set -eo pipefail; $body" >"$logfile" 2>&1; then
    PASS=$((PASS+1))
    echo "PASS: $name"
  else
    FAIL=$((FAIL+1))
    FAILED+=("$name")
    echo "FAIL: $name"
    sed 's/^/    /' "$logfile"
  fi
  rm -f "$logfile"
}

# T1: --help mentions --brain-smoke
run "T1-help-mentions-brain-smoke" '
  node scripts/doctor.cjs --help 2>&1 | grep -q -- "--brain-smoke"
'

# T2: --brain-smoke --json prints valid JSON with class:M + 6 layers
run "T2-brain-smoke-json-output" '
  TMPDIR=$(mktemp -d -t 127-02-T2-XXXXXX)
  HOME="$TMPDIR" env -u MINDRIAN_BRAIN_KEY node scripts/doctor.cjs --brain-smoke --json > "$TMPDIR/out.json" 2>/dev/null
  node -e "
    const j = JSON.parse(require(\"fs\").readFileSync(\"$TMPDIR/out.json\", \"utf8\"));
    if (j.class !== \"M\") { console.error(\"class !== M, got: \" + j.class); process.exit(11); }
    if (!Array.isArray(j.layers)) { console.error(\"layers not array\"); process.exit(12); }
    if (j.layers.length !== 6) { console.error(\"expected 6 layers, got: \" + j.layers.length); process.exit(13); }
    if (typeof j.overall_ms !== \"number\") { console.error(\"overall_ms not number\"); process.exit(14); }
  "
  rm -rf "$TMPDIR"
'

# T3: --brain-smoke alone exits 0 (class-flag invariant)
run "T3-class-flag-invariant-exit-0" '
  TMPDIR=$(mktemp -d -t 127-02-T3-XXXXXX)
  HOME="$TMPDIR" env -u MINDRIAN_BRAIN_KEY node scripts/doctor.cjs --brain-smoke >/dev/null 2>&1
  EC=$?
  rm -rf "$TMPDIR"
  test "$EC" -eq 0
'

# T4: no-identity path (L1 OK via MINDRIAN_OS_ROOT, L2 FAIL because no key,
# L3-L6 cascade to skipped). MINDRIAN_OS_ROOT is the resolver's first
# precedence (env var) so L1 finds the plugin root cleanly even under
# hermetic HOME without a real install. L6 (store_identity) is always
# reached in the skipped state here and never touches the network -- this
# test runs with no key under a hermetic HOME.
run "T4-no-identity-refusal-cascade" '
  TMPDIR=$(mktemp -d -t 127-02-T4-XXXXXX)
  HOME="$TMPDIR" \
    MINDRIAN_OS_ROOT="$REPO_ROOT" \
    env -u MINDRIAN_BRAIN_KEY node scripts/doctor.cjs --brain-smoke --json > "$TMPDIR/out.json" 2>/dev/null
  node -e "
    const j = JSON.parse(require(\"fs\").readFileSync(\"$TMPDIR/out.json\", \"utf8\"));
    if (j.layers[0].ok !== true) { console.error(\"L1 should be true (via MINDRIAN_OS_ROOT); got: \" + j.layers[0].reason); process.exit(20); }
    if (j.layers[1].ok !== false) { console.error(\"L2 ok should be false (no key)\"); process.exit(21); }
    if (j.layers[2].ok !== false || j.layers[2].reason !== \"skipped-prior-layer-failed\") {
      console.error(\"L3 should be skipped; got ok=\" + j.layers[2].ok + \", reason=\" + j.layers[2].reason);
      process.exit(22);
    }
    if (j.layers[3].ok !== false || j.layers[3].reason !== \"skipped-prior-layer-failed\") {
      console.error(\"L4 should be skipped; got ok=\" + j.layers[3].ok + \", reason=\" + j.layers[3].reason);
      process.exit(23);
    }
    if (j.layers[4].ok !== false || j.layers[4].reason !== \"skipped-prior-layer-failed\") {
      console.error(\"L5 should be skipped; got ok=\" + j.layers[4].ok + \", reason=\" + j.layers[4].reason);
      process.exit(24);
    }
    if (j.layers[5].ok !== false || j.layers[5].reason !== \"skipped-prior-layer-failed\") {
      console.error(\"L6 should be skipped; got ok=\" + j.layers[5].ok + \", reason=\" + j.layers[5].reason);
      process.exit(25);
    }
  "
  rm -rf "$TMPDIR"
'

# T5: commands/doctor.md mentions --brain-smoke
run "T5-doctor-md-lists-brain-smoke" '
  grep -q -- "--brain-smoke" commands/doctor.md
'

echo ""
echo "==== RESULTS ===="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "Failed:"
  for t in "${FAILED[@]}"; do echo "  - $t"; done
  exit 1
fi
echo "CLASS M WIRED + LIVE PROBE VERIFIED"
