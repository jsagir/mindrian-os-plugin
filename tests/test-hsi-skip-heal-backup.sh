#!/usr/bin/env bash
# Phase 140-02 HARD-03 regression smoke test.
# Both HSI scanners (scripts/compute-hsi.py and scripts/rs-engine.py) walk the
# room filesystem and filter directories through their own SKIP_DIRS set. Neither
# set excluded .heal-backup, so a .heal-backup/<TS>/dup.md backup duplicate was
# indexed and polluted HSI / reverse-salient results (D-04: exclude ONLY
# .heal-backup this phase).
#
# Contract: drive each module's discover_artifacts() against a fixture room that
# contains a normal artifact AND a .heal-backup/<TS>/dup.md, and assert NO
# discovered artifact id or path contains ".heal-backup".
# RED before Task 3; GREEN after.
#
# The walk function does not need the embedding step, but compute-hsi.py exits at
# import if numpy/sklearn are missing. If those deps are unavailable, SKIP cleanly
# (exit 0) rather than RED-fail on environment -- per the plan's Environment
# Availability note. The skip-list assertion only runs when discovery is reachable.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() { echo "FAIL: $1" >&2; exit 1; }

for f in scripts/compute-hsi.py scripts/rs-engine.py; do
  [ -f "$REPO_ROOT/$f" ] || fail "missing scanner: $f"
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

ROOM="$WORK/room"
# Normal artifact (must be discovered; >50 chars of body so it is not skipped).
mkdir -p "$ROOM/market-analysis"
cat > "$ROOM/market-analysis/normal.md" <<'EOF'
# Normal Artifact

This is a real room artifact with enough body text to clear the fifty character
minimum that both scanners enforce before indexing an artifact for scoring.
EOF

# Backup duplicate under .heal-backup/<TS>/ (must NOT be discovered).
mkdir -p "$ROOM/.heal-backup/20260101-000000/market-analysis"
cat > "$ROOM/.heal-backup/20260101-000000/market-analysis/dup.md" <<'EOF'
# Duplicate Backup Artifact

This is a backup-dir duplicate that lives under .heal-backup and must never be
indexed by the HSI or reverse-salient scanners. It has plenty of body text too.
EOF

# Drive both walkers via importlib (filenames have hyphens) and print any
# discovered id/path that contains .heal-backup. Empty output == PASS.
HITS="$(python3 - "$REPO_ROOT" "$ROOM" <<'PY'
import sys, importlib.util
repo, room = sys.argv[1], sys.argv[2]

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

bad = []

# compute-hsi.py: discover_artifacts(room_dir) takes a path-like.
try:
    hsi = load("compute_hsi_mod", repo + "/scripts/compute-hsi.py")
except SystemExit:
    print("SKIP_DEPS"); sys.exit(0)
except Exception as e:
    print("LOAD_ERR compute-hsi: %s" % e); sys.exit(0)

for a in hsi.discover_artifacts(room):
    if ".heal-backup" in a.get("id", "") or ".heal-backup" in a.get("path", ""):
        bad.append("compute-hsi: %s | %s" % (a.get("id"), a.get("path")))

# rs-engine.py: discover_artifacts(room_dir: Path).
from pathlib import Path
try:
    rs = load("rs_engine_mod", repo + "/scripts/rs-engine.py")
except SystemExit:
    print("SKIP_DEPS"); sys.exit(0)
except Exception as e:
    print("LOAD_ERR rs-engine: %s" % e); sys.exit(0)

for a in rs.discover_artifacts(Path(room)):
    if ".heal-backup" in str(a.get("id", "")) or ".heal-backup" in str(a.get("path", "")):
        bad.append("rs-engine: %s | %s" % (a.get("id"), a.get("path")))

for line in bad:
    print(line)
PY
)"

if [ "$HITS" = "SKIP_DEPS" ]; then
  echo "SKIP: numpy/sklearn unavailable -- HARD-03 skip-list assertion not exercised"
  exit 0
fi

case "$HITS" in
  LOAD_ERR*) fail "scanner module failed to load: $HITS" ;;
esac

if [ -n "$HITS" ]; then
  echo "----- indexed .heal-backup artifacts -----" >&2
  echo "$HITS" >&2
  fail "a scanner indexed a .heal-backup/<TS>/ artifact (HARD-03 not fixed)"
fi

echo "OK: HARD-03 -- neither compute-hsi.py nor rs-engine.py indexes .heal-backup/<TS>/ artifacts"
exit 0
