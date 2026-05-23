#!/usr/bin/env bash
# Phase 127.2 Plan 04 combined structural smoke test (Instance #4 + #7).
#
# Greps + file-existence + minimal functional checks. Designed for fast
# CI gating; the deep behavioral coverage lives in:
#   - tests/test-room-registry-windows-path.cjs (Instance #4)
#   - tests/test-mos-update-activation-gap.cjs  (Instance #7)
#
# Expected: 16+ PASS, 0 FAIL.

set -u  # NOT -e: we want every assertion to run even after a failure.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }

assert_grep() {
  local label="$1"; local pattern="$2"; local file="$3"
  if grep -q -- "$pattern" "$file" 2>/dev/null; then
    pass "$label"
  else
    fail "$label (pattern '$pattern' not found in $file)"
  fi
}

assert_file() {
  local label="$1"; local file="$2"
  if [[ -f "$file" ]]; then
    pass "$label"
  else
    fail "$label (file missing: $file)"
  fi
}

assert_exec() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    pass "$label"
  else
    fail "$label (command failed: $*)"
  fi
}

# --- Instance #4 structural checks (Windows POSIX path leak) -------------

assert_grep 'instance-4: normwin shim present in room-registry' 'normwin' scripts/room-registry
assert_grep 'instance-4: sys.platform gate present in room-registry' "sys.platform == 'win32'" scripts/room-registry
assert_grep 'instance-4: shim also injected into reapply-modifications' 'normwin' scripts/reapply-modifications

# --- Instance #7 structural checks (post-update activation) --------------

assert_file 'instance-7: scripts/post-update-activation.cjs exists' scripts/post-update-activation.cjs
assert_file 'instance-7: scripts/sessionstart-post-update-preflight.cjs exists' scripts/sessionstart-post-update-preflight.cjs
assert_grep 'instance-7: doctor.cjs declares --post-update flag handler' '--post-update' scripts/doctor.cjs
assert_grep 'instance-7: doctor.cjs registers activation-reached-the-wire acceptance point' 'activation-reached-the-wire' scripts/doctor.cjs
assert_grep 'instance-7: commands/update.md calls --fix --post-update' '\-\-fix --post-update' commands/update.md
assert_grep 'instance-7: hooks/hooks.json registers post-update-preflight' 'sessionstart-post-update-preflight' hooks/hooks.json
assert_grep 'instance-7: post-update-activation.cjs exports POST_UPDATE_TOUCH_FILE constant' 'POST_UPDATE_TOUCH_FILE' scripts/post-update-activation.cjs
assert_grep 'instance-7: post-update-activation.cjs exports activatePostUpdate fn' 'activatePostUpdate' scripts/post-update-activation.cjs
assert_grep 'instance-7: preflight reads ~/.mindrian/post-update-restart-pending' 'post-update-restart-pending' scripts/sessionstart-post-update-preflight.cjs

# --- Functional smoke (cheap to run, catches gross regressions) ----------

assert_exec 'functional: doctor.cjs --help renders without crashing' node scripts/doctor.cjs --help
assert_exec 'functional: doctor.cjs --post-update --json executes' bash -c 'node scripts/doctor.cjs --post-update --json | head -1 | grep -q "{"'
assert_exec 'functional: hooks/hooks.json parses as valid JSON' node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))"

# --- Hygiene: no em-dashes in user-facing surfaces we touched ------------

if grep -l "$(printf '\xe2\x80\x94')" scripts/post-update-activation.cjs scripts/sessionstart-post-update-preflight.cjs >/dev/null 2>&1; then
  fail 'hygiene: NEW source files contain em-dashes (forbidden by HARD rule)'
else
  pass 'hygiene: NEW source files free of em-dashes'
fi

# --- Final tally ---------------------------------------------------------

echo ''
echo '===================================================='
echo "test-127.2-04: $PASS / $((PASS + FAIL)) PASS$([ $FAIL -gt 0 ] && echo ", $FAIL FAIL")"
echo '===================================================='

[[ $FAIL -eq 0 ]]
