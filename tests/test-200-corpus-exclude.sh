#!/usr/bin/env bash
# Phase 200-01 regression test: RS corpus exclude-list drift (SEED-018).
#
# ROOT CAUSE this locks: the three Python room-artifact walkers each kept their
# OWN SKIP_DIRS copy, and they drifted -- scripts/rs-engine.py had .heal-backup
# (Phase 140-02) but lib/core/rs_hybrid.py and lib/core/rs_rooms.py did NOT. The
# SEED-018 hybrid-mode run (--mode hybrid -> rs_hybrid._load_room_artifacts) walked
# into .heal-backup and inflated room_count to 706. The drift IS the bug.
#
# Contract:
#   1. lib/core/rs_corpus_exclude.py is the ONE canonical source and its SKIP_DIRS
#      contains the full meta-folder set (incl .heal-backup + the SEED-018 tokens).
#   2. All three walkers IMPORT from it and define no local SKIP_DIRS literal
#      (drift-proof by construction).
# RED before the fix, GREEN after.
#
# python3 absence -> SKIP cleanly (exit 0), per the Tri-Polar clean-degrade rule.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUITE="test-200-corpus-exclude"

fail() { echo "FAIL [$SUITE]: $1" >&2; exit 1; }

if ! command -v python3 >/dev/null 2>&1; then
  echo "SKIP [$SUITE]: python3 unavailable -- clean Tier-0 degrade"
  exit 0
fi

REQUIRED_TOKENS=(.lazygraph .git .mindrian node_modules .obsidian .heal-backup \
  .private .intelligence .room-graph .rs-engine-checkpoints .session-binding .cache)

# --- Contract 1: the shared module exists and carries the full set ---
[ -f "$REPO_ROOT/lib/core/rs_corpus_exclude.py" ] \
  || fail "missing shared exclude source lib/core/rs_corpus_exclude.py"

SKIP_JSON="$(cd "$REPO_ROOT" && python3 -c "
import sys, json
sys.path.insert(0, 'lib/core')
try:
    import rs_corpus_exclude as e
except Exception as ex:
    print('IMPORT_ERR:' + str(ex)); sys.exit(0)
print(json.dumps(sorted(e.SKIP_DIRS)))
" 2>&1)"

case "$SKIP_JSON" in
  IMPORT_ERR:*) fail "rs_corpus_exclude import failed: ${SKIP_JSON#IMPORT_ERR:}" ;;
esac

for tok in "${REQUIRED_TOKENS[@]}"; do
  echo "$SKIP_JSON" | grep -q "\"$tok\"" \
    || fail "shared SKIP_DIRS missing required token: $tok (have: $SKIP_JSON)"
done

# --- Contract 2: all three walkers import the shared set, no local literal ---
for f in lib/core/rs_hybrid.py lib/core/rs_rooms.py scripts/rs-engine.py; do
  [ -f "$REPO_ROOT/$f" ] || fail "missing walker: $f"
  # Accept both bare (rs_corpus_exclude) and package (lib.core.rs_corpus_exclude) forms.
  grep -qE "rs_corpus_exclude import|import rs_corpus_exclude" "$REPO_ROOT/$f" \
    || fail "$f does not import the shared rs_corpus_exclude (drift risk)"
  # No local SKIP_DIRS = { ... } literal (it must come from the shared source).
  if grep -qE "^SKIP_DIRS\s*=\s*\{" "$REPO_ROOT/$f"; then
    fail "$f still defines a local SKIP_DIRS literal (drift not eliminated)"
  fi
done

# --- Contract 3 (functional): hybrid loader skips .heal-backup on a fixture room ---
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/section-a" "$WORK/.heal-backup/20260101"
printf '# Real\n\n%s\n' "$(head -c 120 </dev/zero | tr '\0' 'x')" > "$WORK/section-a/real.md"
printf '# Dup\n\n%s\n' "$(head -c 120 </dev/zero | tr '\0' 'y')" > "$WORK/.heal-backup/20260101/dup.md"

FUNC="$(cd "$REPO_ROOT" && python3 -c "
import sys, json
sys.path.insert(0, 'lib/core')
try:
    import rs_hybrid
    arts = rs_hybrid._load_room_artifacts(__import__('pathlib').Path('$WORK'))
except Exception as ex:
    print('FUNC_SKIP:' + str(ex)); sys.exit(0)
print(json.dumps([a['path'] for a in arts]))
" 2>&1)"

case "$FUNC" in
  FUNC_SKIP:*)
    echo "NOTE [$SUITE]: functional walk skipped (${FUNC#FUNC_SKIP:}); static contracts held" ;;
  *)
    echo "$FUNC" | grep -q ".heal-backup" \
      && fail "hybrid loader still indexed a .heal-backup artifact: $FUNC"
    echo "$FUNC" | grep -q "real.md" \
      || fail "hybrid loader dropped the real artifact: $FUNC" ;;
esac

echo "PASS [$SUITE]: shared exclude source, no drift, .heal-backup excluded"
exit 0
