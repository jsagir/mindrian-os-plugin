#!/usr/bin/env bash
# Phase 233-03 Task 1 regression: compute-hsi.py's corpus exclude-list.
#
# ROOT CAUSE this locks (RCA
# .planning/debug/graph-derive-silent-clear-dead-api-derivation.md Section 9
# Defect #4): scripts/compute-hsi.py kept its OWN local
# SKIP_DIRS = {".lazygraph", ".git", "node_modules", ".hsi-cache.json",
# ".heal-backup"} literal instead of importing lib/core/rs_corpus_exclude.py, the
# shared source the other three walkers migrated to in Phase 200-01 / SEED-018.
# The copy drifted: it never learned .snapshots (historical STATE dumps) or
# sub-rooms (each of which is a FULL room with its own room.db). On motj that
# produced 207 scored artifacts whose top-20 pairs were ALL .snapshots/sub-rooms
# near-duplicates, and hsi-to-graph.cjs then wrote ZERO edges because none of
# those ids are Artifact nodes in the parent db. The drift IS the bug.
#
# Contract (all three legs must hold):
#   1. STATIC: no local SKIP_DIRS literal survives in compute-hsi.py.
#   2. STATIC: it imports the shared source exactly once.
#   3. FUNCTIONAL: discover_artifacts() on a fixture room shaped like the RCA's
#      own evidence (a real artifact + .snapshots/<ts>/dup.md +
#      sub-rooms/<slug>/some-artifact.md) returns NO id or path containing
#      .snapshots or sub-rooms, and DOES still return the real artifact.
#
# Legs 1-2 are pure grep and always run. Leg 3 drives the module through importlib
# (the filename has a hyphen, so a plain import cannot reach it) exactly the way
# tests/test-hsi-skip-heal-backup.sh does, and SKIPs cleanly when numpy/sklearn are
# unavailable -- compute-hsi.py sys.exit(1)s at import without them, which is an
# environment fact, not a regression. No network. No em-dashes.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUITE="test-233-hsi-skip-dirs-shared-source"

fail() { echo "FAIL [$SUITE]: $1" >&2; exit 1; }

HSI="$REPO_ROOT/scripts/compute-hsi.py"
SHARED="$REPO_ROOT/lib/core/rs_corpus_exclude.py"
[ -f "$HSI" ] || fail "missing scanner: scripts/compute-hsi.py"
[ -f "$SHARED" ] || fail "missing shared source: lib/core/rs_corpus_exclude.py"

# --- Leg 1: the local literal is gone -------------------------------------
LOCAL_LITERAL="$(grep -c "SKIP_DIRS = {" "$HSI" || true)"
[ "$LOCAL_LITERAL" -eq 0 ] \
  || fail "compute-hsi.py still defines a local SKIP_DIRS literal ($LOCAL_LITERAL occurrence(s)); drift not eliminated"

# --- Leg 2: it imports the ONE shared source, exactly once ----------------
IMPORTS="$(grep -c "from rs_corpus_exclude import" "$HSI" || true)"
[ "$IMPORTS" -eq 1 ] \
  || fail "expected exactly 1 'from rs_corpus_exclude import' in compute-hsi.py, found $IMPORTS"

# The shared source must actually carry the two tokens this defect turned on.
for tok in ".snapshots" "sub-rooms"; do
  grep -q "\"$tok\"" "$SHARED" \
    || fail "shared SKIP_DIRS is missing the token $tok (Defect #4 not closed at the source)"
done

# --- Leg 3: functional walk over an RCA-shaped fixture room ---------------
if ! command -v python3 >/dev/null 2>&1; then
  echo "SKIP [$SUITE]: python3 unavailable -- static legs 1-2 held"
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
ROOM="$WORK/room"

# A real section artifact (must be discovered; body over MIN_BODY_CHARS).
mkdir -p "$ROOM/market-analysis"
cat > "$ROOM/market-analysis/real-artifact.md" <<'EOF'
# Real Artifact

This is a genuine room artifact with enough body text to clear the shared
MIN_BODY_CHARS minimum that every walker enforces before indexing.
EOF

# A .snapshots historical STATE dump (must NOT be discovered).
mkdir -p "$ROOM/.snapshots/20260101-000000/market-analysis"
cat > "$ROOM/.snapshots/20260101-000000/market-analysis/dup.md" <<'EOF'
# Snapshot Duplicate

This is a historical state dump under .snapshots. It is a near-duplicate of the
real artifact, which is exactly why an unscoped scanner ranks it first.
EOF

# A sub-room artifact (must NOT be discovered: it belongs to the sub-room's db).
mkdir -p "$ROOM/sub-rooms/child-room/solution-design"
touch "$ROOM/sub-rooms/child-room/.room-root"
cat > "$ROOM/sub-rooms/child-room/solution-design/some-artifact.md" <<'EOF'
# Sub-room Artifact

This artifact belongs to a nested sub-room that carries its own room.db per the
Phase 169 NESTED_WITHIN contract, never to the parent room's HSI corpus.
EOF

OUT="$(python3 - "$REPO_ROOT" "$ROOM" <<'PY'
import sys, importlib.util
repo, room = sys.argv[1], sys.argv[2]

spec = importlib.util.spec_from_file_location("compute_hsi_mod", repo + "/scripts/compute-hsi.py")
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
except SystemExit:
    print("SKIP_DEPS"); sys.exit(0)
except Exception as e:
    print("LOAD_ERR %s" % e); sys.exit(0)

arts = mod.discover_artifacts(room)
bad = []
for a in arts:
    blob = "%s|%s" % (a.get("id", ""), a.get("path", ""))
    if ".snapshots" in blob or "sub-rooms" in blob:
        bad.append("POLLUTED " + blob)
if not any(a.get("id") == "market-analysis/real-artifact" for a in arts):
    bad.append("MISSING_REAL ids=%s" % [a.get("id") for a in arts])
for line in bad:
    print(line)
PY
)"

case "$OUT" in
  SKIP_DEPS)
    echo "SKIP [$SUITE]: numpy/sklearn unavailable -- static legs 1-2 held, walk not exercised"
    exit 0 ;;
  LOAD_ERR*)
    fail "compute-hsi.py failed to load: $OUT" ;;
esac

if [ -n "$OUT" ]; then
  echo "----- discover_artifacts() contract violations -----" >&2
  echo "$OUT" >&2
  fail "compute-hsi.py walked .snapshots / sub-rooms or dropped the real artifact (Defect #4 not fixed)"
fi

echo "PASS [$SUITE]: compute-hsi.py single-sources SKIP_DIRS and skips .snapshots + sub-rooms"
exit 0
