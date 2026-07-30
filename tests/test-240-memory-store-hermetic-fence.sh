#!/usr/bin/env bash
# Phase 240 Plan 02 -- MEM-03 SC3: the recursive store-tree hash fence.
#
# THIS FENCE MEASURES STORE MUTATION, NEVER EXIT CODE. tests/test-hmi-compliance-e2e.cjs
# and tests/test-memory-command.cjs both exit nonzero while fully hermetic (the
# latter's 2 Brain Mode A failures are documented pre-existing, unrelated to
# whether the store was touched). Converting either of those into a hermeticity
# alarm would be a false red. Leg 5 pins this with a probe that exits 1 and
# writes nothing.
#
# THE VERDICT HASHES THE WHOLE .memory/ + .rooms/ TREE: contents, relative
# paths, AND the path set (files and directories). A single-filename hash
# (e.g. jtbd-history.json only) is exactly the failure this fence exists to
# close: the one measured leaker (tests/test-jtbd-auto-anchor-empirical.sh,
# see 240-RESEARCH.md Finding 4) had its own cleanup trap deliberately scrub
# its slug out of jtbd-history.json while leaving .memory/audit.log and
# .memory/ROOM.md behind, so a jtbd-history.json-only hash read clean on the
# real developer machine for roughly two months while audit.log accumulated
# 5 leaked lines. A created-and-left EMPTY file or EMPTY directory carries
# zero content bytes, so the content hash alone is blind to it too -- that is
# why the path hash exists as a second, independent leg of the fingerprint.
#
# Every temporary root created below gets its own trap-registered removal via
# mos_register_tmp / mos_cleanup_all. Zero network reach. No em-dashes, no
# emoji. Use sha256sum (coreutils, already the repo's choice at
# tests/run-all-1441.sh and tests/test-127-01-migration-safety.sh); no
# hand-rolled digest, no new dependency.
#
# set -uo pipefail, NOT -e: suites under measurement in Leg 3 are explicitly
# ALLOWED to exit nonzero (see the exit-code-independence note above), and the
# fence must survive that to reach its own verdict.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Temp-root bookkeeping: every mktemp -d root created by this script is
# registered here and removed by ONE trap on EXIT.
# ---------------------------------------------------------------------------
MOS_TMP_ROOTS=()
mos_register_tmp() { MOS_TMP_ROOTS+=("$1"); }
mos_cleanup_all() {
  local r
  for r in "${MOS_TMP_ROOTS[@]:-}"; do
    [ -n "${r:-}" ] && rm -rf "$r" 2>/dev/null || true
  done
}
trap mos_cleanup_all EXIT

# ---------------------------------------------------------------------------
# The three hash functions. LC_ALL=C sorted throughout so the digest is
# stable across locales.
# ---------------------------------------------------------------------------

# mos_tree_content_hash <root>: contents + relative path per file, whole
# stream hashed. ABSENT if the root does not exist. The relative path is
# part of the hashed stream, so a rename is a change even with identical
# bytes.
mos_tree_content_hash() {
  local root="$1"
  if [ ! -d "$root" ]; then
    printf 'ABSENT'
    return 0
  fi
  ( cd "$root" && find . -type f -print0 2>/dev/null | LC_ALL=C sort -z | \
      while IFS= read -r -d '' f; do
        printf '%s  %s\n' "$f" "$(sha256sum "$f" | awk '{print $1}')"
      done
  ) | sha256sum | awk '{print $1}'
}

# mos_tree_path_hash <root>: files AND directories, no -type filter, so a
# created-and-left EMPTY directory or EMPTY file changes the verdict even
# though it contributes zero content bytes. ABSENT if the root is absent.
mos_tree_path_hash() {
  local root="$1"
  if [ ! -d "$root" ]; then
    printf 'ABSENT'
    return 0
  fi
  ( cd "$root" && find . -mindepth 1 -print0 2>/dev/null | LC_ALL=C sort -z | tr '\0' '\n' ) | sha256sum | awk '{print $1}'
}

# store_fingerprint <root>: both digests, space separated. This is the
# single value compared before and after.
store_fingerprint() {
  local root="$1"
  printf '%s %s' "$(mos_tree_content_hash "$root")" "$(mos_tree_path_hash "$root")"
}

# assert_unmutated <label> <before> <after>: prints both fingerprints on a
# mismatch so the log names what moved. Returns 0 for UNMUTATED, 1 for
# MUTATED.
assert_unmutated() {
  local label="$1" before="$2" after="$3"
  if [ "$before" = "$after" ]; then
    echo "    UNMUTATED: $label"
    return 0
  fi
  echo "    MUTATED: $label"
  echo "      before: $before"
  echo "      after:  $after"
  return 1
}

echo "========================================"
echo "  Phase 240 -- MEM-03 hermetic store fence"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# LEG 1: the self-test that the fence bites. Runs FIRST, before any suite.
# ---------------------------------------------------------------------------
echo "--- Leg 1: self-test (proves the fence actually bites) ---"
LEG1_OK=1
SELFTEST_PROBE="$(mktemp -d)"
mos_register_tmp "$SELFTEST_PROBE"

leg1_must_catch() {
  local label="$1" before="$2" after="$3"
  if [ "$before" != "$after" ]; then
    echo "    caught: $label"
    return 0
  fi
  echo "    MISS (the fence is blind to this): $label"
  return 1
}
leg1_must_not_catch() {
  local label="$1" before="$2" after="$3"
  if [ "$before" = "$after" ]; then
    echo "    correctly ignored: $label"
    return 0
  fi
  echo "    FALSE POSITIVE: $label"
  return 1
}

B1="$(store_fingerprint "$SELFTEST_PROBE")"
mkdir -p "$SELFTEST_PROBE/.memory"
echo "leaked audit line" > "$SELFTEST_PROBE/.memory/audit.log"
A1="$(store_fingerprint "$SELFTEST_PROBE")"
leg1_must_catch "a leaked audit line" "$B1" "$A1" || LEG1_OK=0

B2="$(store_fingerprint "$SELFTEST_PROBE")"
: > "$SELFTEST_PROBE/.memory/ROOM.md"
A2="$(store_fingerprint "$SELFTEST_PROBE")"
leg1_must_catch "a created-and-left EMPTY file" "$B2" "$A2" || LEG1_OK=0

B3="$(store_fingerprint "$SELFTEST_PROBE")"
mkdir -p "$SELFTEST_PROBE/.rooms/.room-graph"
A3="$(store_fingerprint "$SELFTEST_PROBE")"
leg1_must_catch "a created-and-left EMPTY directory" "$B3" "$A3" || LEG1_OK=0

B4="$(store_fingerprint "$SELFTEST_PROBE")"
A4="$(store_fingerprint "$SELFTEST_PROBE")"
leg1_must_not_catch "no change at all" "$B4" "$A4" || LEG1_OK=0

if [ "$LEG1_OK" -eq 1 ]; then
  echo ">>> Leg 1 (self-test): PASSED"
  PASS=$((PASS + 1))
else
  echo ">>> Leg 1 (self-test): FAILED -- the fence is blind, every leg below proves nothing"
  FAIL=$((FAIL + 1))
fi
echo ""

# ---------------------------------------------------------------------------
# LEG 3 IMPLEMENTATION (defined before Leg 2 so Leg 2 can wrap it): the
# SUITE SWEEP under a sandboxed HOME. Discovery is by GLOB with a floor,
# never a hand list. tests/test-240-* is EXCLUDED so the fence can never
# recurse into the harness that discovers it.
# ---------------------------------------------------------------------------
run_suite_sweep() {
  local sandbox_home="$1"
  local suites=()
  local f

  shopt -s nullglob
  for f in tests/test-jtbd-*.cjs tests/test-jtbd-*.sh \
           tests/test-across-session-memory.cjs \
           tests/test-memory-hook-integration.cjs \
           tests/test-cross-room-memory.cjs \
           tests/test-memory-command.cjs \
           tests/run-all-127.3.sh; do
    case "$f" in
      tests/test-240-*) continue ;;
    esac
    suites+=("$f")
  done
  shopt -u nullglob

  echo "  discovered ${#suites[@]} suite(s):"
  for f in "${suites[@]}"; do
    echo "    - $f"
  done

  if [ "${#suites[@]}" -lt 10 ]; then
    echo "  !!! VACUITY: only ${#suites[@]} suite(s) discovered, floor is 10"
    SWEEP_DISCOVERED=${#suites[@]}
    SWEEP_VACUOUS=1
    return 1
  fi
  SWEEP_DISCOVERED=${#suites[@]}
  SWEEP_VACUOUS=0

  local sandbox_before sandbox_after
  sandbox_before="$(store_fingerprint "$sandbox_home/MindrianRooms")"
  echo "  sandbox MindrianRooms fingerprint before sweep: $sandbox_before"

  for f in "${suites[@]}"; do
    local interp rc
    case "$f" in
      *.cjs) interp="node" ;;
      *.sh)  interp="bash" ;;
      *) interp="bash" ;;
    esac
    env -u MINDRIAN_ROOMS_HOME HOME="$sandbox_home" timeout 300 "$interp" "$f" >/dev/null 2>&1
    rc=$?
    echo "    ran $f under sandboxed HOME (exit=$rc, printed for the record, NOT part of the verdict)"
  done

  sandbox_after="$(store_fingerprint "$sandbox_home/MindrianRooms")"
  echo "  sandbox MindrianRooms fingerprint after sweep:  $sandbox_after"
  SWEEP_BEFORE="$sandbox_before"
  SWEEP_AFTER="$sandbox_after"
  return 0
}

# ---------------------------------------------------------------------------
# LEG 2: LIVE-STORE confirmation. Read-only against the REAL store, captured
# BEFORE any sandboxing. This is the literal SC3 sentence: the whole JTBD /
# memory suite set must never touch the developer's real store, from a
# HOME-independent code path.
# ---------------------------------------------------------------------------
echo "--- Leg 2 + Leg 3: live-store confirmation wrapping the suite sweep ---"
REAL_ROOT="${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}"
LEG2_BEFORE_MEM="$(store_fingerprint "${REAL_ROOT}/.memory")"
LEG2_BEFORE_ROOMS="$(store_fingerprint "${REAL_ROOT}/.rooms")"
echo "  real store .memory  fingerprint before: $LEG2_BEFORE_MEM"
echo "  real store .rooms   fingerprint before: $LEG2_BEFORE_ROOMS"

SANDBOX_HOME="$(mktemp -d)"
mos_register_tmp "$SANDBOX_HOME"

SWEEP_DISCOVERED=0
SWEEP_VACUOUS=0
SWEEP_BEFORE=""
SWEEP_AFTER=""
run_suite_sweep "$SANDBOX_HOME"
SWEEP_RC=$?

LEG2_AFTER_MEM="$(store_fingerprint "${REAL_ROOT}/.memory")"
LEG2_AFTER_ROOMS="$(store_fingerprint "${REAL_ROOT}/.rooms")"
echo "  real store .memory  fingerprint after:  $LEG2_AFTER_MEM"
echo "  real store .rooms   fingerprint after:  $LEG2_AFTER_ROOMS"

LEG2_OK=1
assert_unmutated "real store .memory" "$LEG2_BEFORE_MEM" "$LEG2_AFTER_MEM" || LEG2_OK=0
assert_unmutated "real store .rooms" "$LEG2_BEFORE_ROOMS" "$LEG2_AFTER_ROOMS" || LEG2_OK=0

if [ "$LEG2_OK" -eq 1 ]; then
  echo ">>> Leg 2 (live-store confirmation): PASSED"
  PASS=$((PASS + 1))
else
  echo ">>> Leg 2 (live-store confirmation): FAILED -- a suite reached the real store"
  FAIL=$((FAIL + 1))
fi
echo ""

echo "--- Leg 3: suite sweep verdict ---"
if [ "$SWEEP_VACUOUS" -eq 1 ]; then
  echo ">>> Leg 3 (suite sweep): FAILED -- only $SWEEP_DISCOVERED suite(s) discovered, floor is 10"
  FAIL=$((FAIL + 1))
else
  LEG3_OK=1
  assert_unmutated "sandbox MindrianRooms" "$SWEEP_BEFORE" "$SWEEP_AFTER" || LEG3_OK=0
  if [ "$LEG3_OK" -eq 1 ]; then
    echo ">>> Leg 3 (suite sweep, $SWEEP_DISCOVERED suites): PASSED"
    PASS=$((PASS + 1))
  else
    echo ">>> Leg 3 (suite sweep, $SWEEP_DISCOVERED suites): FAILED -- sandbox store was mutated"
    FAIL=$((FAIL + 1))
  fi
fi
echo ""

# ---------------------------------------------------------------------------
# LEG 4: the DELIBERATELY NON-HERMETIC FIXTURE, seeded against ITS OWN
# sandboxed HOME so proving the fence never touches the real store while
# proving it (Pitfall 6). The scratch probe lives under a mktemp -d
# directory, NEVER inside tests/, so no glob (including Leg 3's) can ever
# discover it.
# ---------------------------------------------------------------------------
echo "--- Leg 4: deliberately non-hermetic fixture (the fence must catch a real leak) ---"
LEAK_HOME="$(mktemp -d)"
mos_register_tmp "$LEAK_HOME"
LEAK_SCRATCH="$(mktemp -d)"
mos_register_tmp "$LEAK_SCRATCH"

cat > "$LEAK_SCRATCH/leak-probe.sh" <<'LEAK_EOF'
#!/usr/bin/env bash
set -eu
mkdir -p "$HOME/MindrianRooms/.memory"
echo "deliberately leaked line" >> "$HOME/MindrianRooms/.memory/audit.log"
LEAK_EOF
chmod +x "$LEAK_SCRATCH/leak-probe.sh"

LEG4_BEFORE="$(store_fingerprint "$LEAK_HOME/MindrianRooms")"
echo "  leak-home fingerprint before: $LEG4_BEFORE"
env -u MINDRIAN_ROOMS_HOME HOME="$LEAK_HOME" bash "$LEAK_SCRATCH/leak-probe.sh"
LEG4_AFTER="$(store_fingerprint "$LEAK_HOME/MindrianRooms")"
echo "  leak-home fingerprint after:  $LEG4_AFTER"

# Confirm the leak landed ONLY inside LEAK_HOME, never the real store.
REAL_MEM_AFTER_LEG4="$(store_fingerprint "${REAL_ROOT}/.memory")"

rm -rf "$LEAK_SCRATCH/leak-probe.sh"

if assert_unmutated "leak-home (expected to MUTATE)" "$LEG4_BEFORE" "$LEG4_AFTER"; then
  echo ">>> Leg 4 (seeded leak): FAILED -- the fence reported UNMUTATED for a real leak, it is blind"
  FAIL=$((FAIL + 1))
else
  echo "  fence correctly reported MUTATED for the seeded leak"
  if [ "$REAL_MEM_AFTER_LEG4" = "$LEG2_BEFORE_MEM" ]; then
    echo "  real store .memory confirmed untouched by the seeded leak"
    echo ">>> Leg 4 (seeded leak): PASSED"
    PASS=$((PASS + 1))
  else
    echo "  !!! real store .memory CHANGED while proving Leg 4 -- the proof fixture itself leaked"
    echo ">>> Leg 4 (seeded leak): FAILED"
    FAIL=$((FAIL + 1))
  fi
fi
echo ""

# ---------------------------------------------------------------------------
# LEG 5: EXIT-CODE INDEPENDENCE. A probe that writes nothing to the store and
# exits 1 must still verdict UNMUTATED, and the leg must PASS despite the
# nonzero exit. Pins Finding 4 conclusion 5 so a future edit cannot quietly
# fold exit codes into the verdict.
# ---------------------------------------------------------------------------
echo "--- Leg 5: exit-code independence (a failing probe must not redden the verdict) ---"
EXITCODE_HOME="$(mktemp -d)"
mos_register_tmp "$EXITCODE_HOME"
EXITCODE_SCRATCH="$(mktemp -d)"
mos_register_tmp "$EXITCODE_SCRATCH"

cat > "$EXITCODE_SCRATCH/exit1-probe.sh" <<'EXIT_EOF'
#!/usr/bin/env bash
exit 1
EXIT_EOF
chmod +x "$EXITCODE_SCRATCH/exit1-probe.sh"

LEG5_BEFORE="$(store_fingerprint "$EXITCODE_HOME/MindrianRooms")"
env -u MINDRIAN_ROOMS_HOME HOME="$EXITCODE_HOME" bash "$EXITCODE_SCRATCH/exit1-probe.sh"
PROBE_RC=$?
LEG5_AFTER="$(store_fingerprint "$EXITCODE_HOME/MindrianRooms")"
echo "  probe exit code: $PROBE_RC (expected 1, printed for the record, NOT part of the verdict)"
rm -rf "$EXITCODE_SCRATCH/exit1-probe.sh"

if assert_unmutated "exit-code-1 probe (writes nothing)" "$LEG5_BEFORE" "$LEG5_AFTER"; then
  echo ">>> Leg 5 (exit-code independence): PASSED"
  PASS=$((PASS + 1))
else
  echo ">>> Leg 5 (exit-code independence): FAILED -- fingerprint changed with nothing written"
  FAIL=$((FAIL + 1))
fi
echo ""

echo "========================================"
echo "  Summary"
echo "========================================"
echo "  PASS=$PASS FAIL=$FAIL"
echo "========================================"

[ "$FAIL" -eq 0 ]
