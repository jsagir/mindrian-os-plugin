#!/usr/bin/env bash
# RCA rs-engine-python-insert-not-null-and-detail-drop-regression -- Test 1.
#
# scripts/rs-engine.py's node-write (write_reverse_salient_edges) used a bare
# 3-column `INSERT INTO nodes (id, type, properties)`, which crashes with
# `NOT NULL constraint failed: nodes.source_path` on any room.db carrying the
# Phase-109 wide provenance schema (source_path / created_by / created_at /
# last_seen_at NOT NULL). lib/core/node-insert.cjs fixed the same defect
# class for its 4 JS call sites (Phase 140-01); rs-engine.py is Python and
# was never covered. See .planning/debug/resolved/
# rs-engine-python-insert-not-null-and-detail-drop-regression.md.
#
# Given: a room.db built with the Phase-109 wide nodes schema, and a room
#        with >=2 markdown artifacts (rs-engine's --mode internal minimum).
# When:  `python3 scripts/rs-engine.py --mode internal --room <roomDir>
#        --topk 1 --threshold 0.0` is run directly.
# Then:  exit code 0, no "NOT NULL constraint failed" in stderr, and `nodes`
#        gains rows with source_path populated (not NULL).
#
# Exit 0 = all checks pass; exit 1 = any check failed.

set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || { echo "FAIL: cannot cd to repo root"; exit 1; }

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL  $1"; }

echo "RCA rs-engine-python-insert-not-null-and-detail-drop-regression -- Test 1"
echo "Repo: $REPO_ROOT"
echo ""

TMP_ROOM="$(mktemp -d)"
cleanup() { rm -rf "$TMP_ROOM"; }
trap cleanup EXIT

mkdir -p "$TMP_ROOM/section-a" "$TMP_ROOM/section-b" "$TMP_ROOM/.mindrian"

cat > "$TMP_ROOM/section-a/artifact-one.md" <<'EOF'
# Artifact One

This is the first synthetic artifact used by the NOT-NULL provenance
regression test. It needs at least fifty characters of body text so
discover_artifacts does not skip it as too short.
EOF

cat > "$TMP_ROOM/section-b/artifact-two.md" <<'EOF'
# Artifact Two

A second, differently-worded synthetic artifact for the same regression
test, covering an unrelated topic so the LSA and semantic matrices do not
collapse the two artifacts into an identical vector.
EOF

# Build a room.db with the Phase-109 WIDE nodes schema directly (mirrors the
# post-migration shape in lib/core/migrations/phase-109-nodes-provenance.cjs;
# see tests/test-navigation-migration-idempotent.cjs for the JS-side
# equivalent of this same 12-column setup).
python3 - "$TMP_ROOM/.mindrian/room.db" <<'PYEOF'
import sqlite3
import sys

conn = sqlite3.connect(sys.argv[1])
conn.execute(
    """
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}',
      source_path TEXT NOT NULL,
      created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')),
      confidence REAL,
      review_status TEXT NOT NULL DEFAULT 'proposed',
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      source_section TEXT,
      confirmed_by TEXT,
      confirmed_at INTEGER,
      valid_from INTEGER,
      valid_to INTEGER,
      invalidated_at INTEGER,
      last_modified_at INTEGER
    )
    """
)
conn.execute(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, "
    "properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type))"
)
conn.commit()
conn.close()
PYEOF
SETUP_EXIT=$?

if [ "$SETUP_EXIT" -ne 0 ]; then
  fail "setup: could not build migrated room.db fixture"
  echo ""
  echo "Results: $PASS pass, $FAIL fail"
  exit 1
fi
pass "setup: migrated (wide) room.db fixture built"

# When: run rs-engine.py directly against the migrated fixture room.
# threshold 0.0 disables the abs(semantic - lsa) filter so a pair is kept
# regardless of how similar the two synthetic artifacts happen to score.
STDERR_LOG="$(mktemp)"
python3 scripts/rs-engine.py --mode internal --room "$TMP_ROOM" --topk 1 --threshold 0.0 >/dev/null 2>"$STDERR_LOG"
EXIT_CODE=$?

if [ "$EXIT_CODE" -eq 0 ]; then
  pass "rs-engine.py exits 0 against a migrated room.db"
else
  fail "rs-engine.py exited $EXIT_CODE against a migrated room.db (stderr: $(cat "$STDERR_LOG"))"
fi

if grep -q "NOT NULL constraint failed" "$STDERR_LOG"; then
  fail "rs-engine.py stderr still contains 'NOT NULL constraint failed' (regression NOT fixed)"
else
  pass "rs-engine.py stderr has no NOT NULL constraint failure"
fi

# Then: nodes table gained rows with source_path populated (not NULL).
NODE_CHECK="$(python3 - "$TMP_ROOM/.mindrian/room.db" <<'PYEOF'
import sqlite3
import sys

conn = sqlite3.connect(sys.argv[1])
total = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
null_source_path = conn.execute("SELECT COUNT(*) FROM nodes WHERE source_path IS NULL").fetchone()[0]
print(f"{total} {null_source_path}")
PYEOF
)"
TOTAL_NODES="$(echo "$NODE_CHECK" | awk '{print $1}')"
NULL_NODES="$(echo "$NODE_CHECK" | awk '{print $2}')"

if [ "${TOTAL_NODES:-0}" -ge 2 ] 2>/dev/null; then
  pass "nodes table gained rows ($TOTAL_NODES total)"
else
  fail "nodes table did not gain the expected rows (got: '$NODE_CHECK')"
fi

if [ "${NULL_NODES:-1}" -eq 0 ] 2>/dev/null; then
  pass "no NULL source_path rows in nodes (provenance columns populated)"
else
  fail "found rows with NULL source_path (got: '$NODE_CHECK')"
fi

rm -f "$STDERR_LOG"

echo ""
echo "Results: $PASS pass, $FAIL fail"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  exit 0
fi
echo "SOME CHECKS FAILED"
exit 1
