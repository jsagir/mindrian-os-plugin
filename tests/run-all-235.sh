#!/usr/bin/env bash
# Phase 235 verification aggregator -- the single PASS/FAIL gate for
# "CIRS commit gate + seam liveness helper".
#
# BSL 1.1. Copyright (c) Mindrian 2026.
#
# What this phase has to prove is that a gate which LOOKS installed is actually
# live. Phase 235 exists because three independently hand-authored copies of the
# git pre-commit hook body had drifted (scripts/hooks/pre-commit,
# scripts/hooks/pre-commit-room-minto-guard.sh, and a heredoc template inside
# scripts/install-pre-commit.sh), and scripts/session-start ran BOTH installers
# every session. setup-hooks.sh's `cmp -s` reinstall check fires whenever the
# installed hook differs, so the narrower body silently overwrote the richer one
# and the born-wired connector-registry / orchestration-projection /
# shape-declaration gates were never live in the actual installed
# .git/hooks/pre-commit. Separately, scripts/release.sh swallowed
# check-shape-declaration.cjs's exit code with an unconditional `|| true`, so the
# documented "--strict restores hard-fail" contract was false.
#
# Plan 235-01 collapses the three hook sources into ONE canonical file both
# installers copy verbatim, and gives release.sh a real --strict-shape flag.
# Plan 235-02 lands the seam-liveness helper.
#
# This harness GLOB-DISCOVERS every tests/test-235-* file (both .cjs and .sh) and
# runs it, so downstream plans add coverage WITHOUT editing this file.
#
# TWO explicit extra legs sit outside that glob by design, wired by hand so they
# cannot silently never run (a test that is never discovered is worse than no
# test, because the harness still prints a green summary):
#
#   1. lib/memory/room-minto-hook.test.cjs -- the PRE-EXISTING hook test. Phase
#      235-01 changed the content of the exact file its Test 4 self-heal
#      assertion byte-compares, so this suite staying green is a load-bearing
#      no-regression signal for this phase, not an unrelated test.
#   2. The byte-identity gate below -- `cmp` on the two tracked hook files. It is
#      the ONE invariant that makes the whole fix hold by construction rather
#      than by discipline, and no .cjs test file owns it.
#
# If lib/core/seam-liveness.test.cjs exists (235-02), it is run too; it sits
# outside the tests/test-235-* glob for the same reason.
#
# Canon Part 8: every leg is local. Zero Brain, zero network.
# No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# A leg that may legitimately self-SKIP on environment. Exit 0 plus a SKIP line
# is tallied as SKIP, not as a pass it did not earn.
run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# Glob-discovered legs: every tests/test-235-* file, .cjs and .sh.
# ---------------------------------------------------------------------------
shopt -s nullglob
found=0
for t in tests/test-235-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-235-*.sh; do
  found=1
  # Never recurse into this aggregator itself.
  [ "$(basename "$t")" = "run-all-235.sh" ] && continue
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-235-* files discovered"
  exit 1
fi

# ---------------------------------------------------------------------------
# EXPLICIT extra leg 1: the pre-existing hook suite (see the header).
# ---------------------------------------------------------------------------
run "room-minto-hook.test.cjs (pre-existing, no-regression)" node lib/memory/room-minto-hook.test.cjs

# ---------------------------------------------------------------------------
# EXPLICIT extra leg: 235-02's seam-liveness suite, if it has landed. It sits
# outside the tests/test-235-* glob, so it is named here rather than left
# undiscovered. Absent = SKIP (this file ships with 235-01, before 235-02).
# ---------------------------------------------------------------------------
echo "--- seam-liveness.test.cjs (235-02) ---"
if [ -f "lib/core/seam-liveness.test.cjs" ]; then
  if node lib/core/seam-liveness.test.cjs; then
    echo ">>> seam-liveness.test.cjs: PASSED"; PASS=$((PASS+1))
  else
    echo ">>> seam-liveness.test.cjs: FAILED"; FAIL=$((FAIL+1))
  fi
else
  echo "SKIP: lib/core/seam-liveness.test.cjs not present yet (lands in Plan 235-02)"
  echo ">>> seam-liveness.test.cjs: SKIPPED"; SKIP=$((SKIP+1))
fi
echo ""

# ---------------------------------------------------------------------------
# EXPLICIT extra leg 2: the byte-identity invariant (CIRS-01).
#
# scripts/hooks/pre-commit and scripts/hooks/pre-commit-room-minto-guard.sh must
# be byte-identical. Both installers copy the guard file verbatim, so the moment
# these two diverge the phase-235 bug is back: whichever installer runs last
# wins, and a guard block silently stops being live. This is the invariant that
# makes the fix hold by construction. It is checked here and nowhere else.
#
# The per-guard greps are COMMENT-STRIPPED first, so the file's own header prose
# describing a guard can neither satisfy nor trip the gate.
# ---------------------------------------------------------------------------
echo "--- CIRS-01 invariant: the two tracked hook files are byte-identical ---"
IDENT_OK=1
for f in scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh; do
  if [ ! -f "$f" ]; then
    echo "    MISSING: $f"; IDENT_OK=0
  fi
done
if [ "$IDENT_OK" -eq 1 ]; then
  if cmp -s scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh; then
    echo "    byte-identical: scripts/hooks/pre-commit == scripts/hooks/pre-commit-room-minto-guard.sh"
  else
    echo "    DIVERGED: the two tracked hook files differ. The phase-235 bug is back."
    echo "    Recovery: cp scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh"
    IDENT_OK=0
  fi
fi

# Every guard the canonical hook is required to carry. A missing entry means an
# installer path silently lost a gate.
REQUIRED_GUARDS=(
  'build-command-registry.cjs" --check'
  'build-connector-registry.cjs" --check'
  'build-orchestration-projection.cjs" --check'
  'build-skill-mirrors.cjs" --check'
  'build-brain-packet-schema.cjs" --check'
  'check-schema-aliases.cjs" --check-sendpacket'
  'check-reward-before-investment.cjs'
  'feynman-minto-guardian.cjs'
  'check-schema-aliases.cjs"'
  'check-substrate.cjs" --diff'
  'build-harness-manifest.cjs" --check'
  'check-render-coverage.cjs" --check'
  'build-corpus-stats.cjs" --check'
  'check-shape-declaration.cjs" --check'
  'check-help-coverage.cjs'
  'command-registration-check.cjs'
)
if [ "$IDENT_OK" -eq 1 ]; then
  for g in "${REQUIRED_GUARDS[@]}"; do
    if grep -v '^[[:space:]]*#' scripts/hooks/pre-commit | grep -qF -- "$g"; then
      :
    else
      echo "    MISSING GUARD (on an executable line): $g"
      IDENT_OK=0
    fi
  done
fi

# The installer must never hand-author hook content again: it copies the
# canonical guard source, exactly as setup-hooks.sh does.
if ! grep -qE 'cmp -s.*pre-commit-room-minto-guard\.sh' scripts/install-pre-commit.sh; then
  echo "    install-pre-commit.sh no longer installs from the canonical guard source via cmp-then-copy"
  IDENT_OK=0
fi

if [ "$IDENT_OK" -eq 1 ]; then
  echo ">>> CIRS-01 invariant: PASSED"; PASS=$((PASS+1))
else
  echo ">>> CIRS-01 invariant: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 235: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
