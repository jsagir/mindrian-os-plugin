#!/usr/bin/env bash
# Phase 233-03 Task 1 regression: compute-hsi.py --scope-to-nodes.
#
# ROOT CAUSE this locks (RCA
# .planning/debug/graph-derive-silent-clear-dead-api-derivation.md Section 9
# Defect #5): the structural index does not always nodeify every real artifact
# (motj: 33 Artifact nodes vs ~70 files on disk). hsi-to-graph.cjs then refuses to
# write any pair whose endpoint is not a node -- correct behavior, but it means a
# full-corpus HSI run burns an LSA + embedding pass on artifacts that can never
# become an edge, and the top-20 cut gets consumed by pairs that are silently
# discarded downstream (only 6 of 20 pairs were writable).
#
# Contract, proven by GROUND TRUTH (the bytes of the written .hsi-results.json,
# never an assertion about which code path was taken): given a room with THREE
# real .md artifacts on disk but only TWO of them present as Artifact nodes in
# room.db, `--scope-to-nodes` writes results referencing ONLY the two node-backed
# ids. The orphan must appear nowhere in the file.
#
# A second leg proves the fallback is a fallback and not a silent zeroing: the
# SAME room WITHOUT room.db (Tier 0 / pre-structural-index) still scores all three.
#
# Fully hermetic: HF_HUB_OFFLINE=1 / TRANSFORMERS_OFFLINE=1 forbid any model
# download, so this test makes ZERO network reach. If numpy/sklearn or the local
# MiniLM cache are unavailable, SKIP cleanly -- that is an environment fact, not a
# regression. No em-dashes.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUITE="test-233-hsi-scope-to-nodes"

fail() { echo "FAIL [$SUITE]: $1" >&2; exit 1; }

HSI="$REPO_ROOT/scripts/compute-hsi.py"
[ -f "$HSI" ] || fail "missing scanner: scripts/compute-hsi.py"

grep -q -- "--scope-to-nodes" "$HSI" \
  || fail "compute-hsi.py does not declare --scope-to-nodes"

command -v python3 >/dev/null 2>&1 || { echo "SKIP [$SUITE]: python3 unavailable"; exit 0; }
command -v node >/dev/null 2>&1 || { echo "SKIP [$SUITE]: node unavailable"; exit 0; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
ROOM="$WORK/room"

mkdir -p "$ROOM/market-analysis" "$ROOM/solution-design"

cat > "$ROOM/market-analysis/node-backed-one.md" <<'EOF'
# Node Backed One

Museums that sell tickets by emotion rather than by exhibit see repeat visits
climb, because the visitor books a feeling and not a floor plan. The pricing
model follows the emotional arc of the visit rather than the square footage.
EOF

cat > "$ROOM/solution-design/node-backed-two.md" <<'EOF'
# Node Backed Two

An aqueduct is the right institutional metaphor: it moves a scarce resource
across terrain that would otherwise block it, and every segment must hold or the
whole line fails. Governance is the maintenance crew, not the architect.
EOF

cat > "$ROOM/market-analysis/orphan-not-a-node.md" <<'EOF'
# Orphan Not A Node

This artifact exists on disk but the structural index never nodeified it. That is
Defect #5 in miniature: real content that no edge can ever attach to, because
hsi-to-graph refuses an endpoint that is not an Artifact node.
EOF

# --- Build a room.db carrying EXACTLY the two node-backed ids --------------
# Routed through the repo's own openGraph + the shared NOT-NULL-safe insertNode,
# never a hand-rolled INSERT, so the fixture matches what the real indexer writes.
node -e '
const path = require("path");
const repo = process.argv[1];
const room = process.argv[2];
const { openGraph, closeGraph } = require(path.join(repo, "lib/core/lazygraph-ops.cjs"));
const { insertNode } = require(path.join(repo, "lib/core/node-insert.cjs"));
(async () => {
  const { db, conn } = await openGraph(room);
  try {
    for (const id of ["market-analysis/node-backed-one", "solution-design/node-backed-two"]) {
      insertNode(conn, id, "Artifact", JSON.stringify({ title: id }));
    }
    const row = conn.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = ?").get("Artifact");
    if (!row || row.c !== 2) { throw new Error("fixture db has " + (row && row.c) + " Artifact nodes, expected 2"); }
  } finally {
    await closeGraph(db);
  }
})().catch(e => { console.error("FIXTURE_ERR " + e.message); process.exit(1); });
' "$REPO_ROOT" "$ROOM" || fail "could not build the fixture room.db"

[ -f "$ROOM/.mindrian/room.db" ] || fail "fixture room.db was not created"

# --- Leg A: --scope-to-nodes scores ONLY the two node-backed ids -----------
SCOPED_OUT="$WORK/scoped.json"
set +e
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_DATASETS_OFFLINE=1 \
  timeout 600 python3 "$HSI" "$ROOM" --scope-to-nodes --output "$SCOPED_OUT" >"$WORK/scoped.log" 2>&1
RC=$?
set -e

if [ "$RC" -ne 0 ] || [ ! -f "$SCOPED_OUT" ]; then
  if grep -qiE "requires numpy|requires scikit-learn|sentence-transformers not installed|couldn't connect|offline|OSError" "$WORK/scoped.log"; then
    echo "SKIP [$SUITE]: HSI embedding stack unavailable offline (rc=$RC) -- scoping not exercised"
    sed -n '1,12p' "$WORK/scoped.log"
    exit 0
  fi
  echo "----- compute-hsi.py output -----" >&2
  cat "$WORK/scoped.log" >&2
  fail "compute-hsi.py --scope-to-nodes failed (rc=$RC)"
fi

# GROUND TRUTH: read the ids the written file actually carries.
SCOPED_IDS="$(python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))
ids = sorted(a['id'] for a in d.get('artifacts', []))
print(','.join(ids))
" "$SCOPED_OUT")"

[ "$SCOPED_IDS" = "market-analysis/node-backed-one,solution-design/node-backed-two" ] \
  || fail "scoped artifacts should be exactly the two node-backed ids, got: [$SCOPED_IDS]"

# The orphan must not survive ANYWHERE in the file (artifacts list or pair list).
if grep -q "orphan-not-a-node" "$SCOPED_OUT"; then
  fail "the orphan artifact leaked into the scoped .hsi-results.json (Defect #5 not closed)"
fi

# --- Leg B: no room.db degrades to scoring everything, not to zero --------
ROOM2="$WORK/room-no-db"
mkdir -p "$ROOM2"
cp -r "$ROOM/market-analysis" "$ROOM/solution-design" "$ROOM2/"

UNSCOPED_OUT="$WORK/unscoped.json"
set +e
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_DATASETS_OFFLINE=1 \
  timeout 600 python3 "$HSI" "$ROOM2" --scope-to-nodes --output "$UNSCOPED_OUT" >"$WORK/unscoped.log" 2>&1
RC2=$?
set -e

[ "$RC2" -eq 0 ] && [ -f "$UNSCOPED_OUT" ] \
  || { cat "$WORK/unscoped.log" >&2; fail "--scope-to-nodes crashed on a room with no room.db (rc=$RC2); it must degrade, not fail"; }

FALLBACK_COUNT="$(python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))
print(len(d.get('artifacts', [])))
" "$UNSCOPED_OUT")"

[ "$FALLBACK_COUNT" -eq 3 ] \
  || fail "with no room.db the fallback must score all 3 artifacts, got $FALLBACK_COUNT (silent zeroing is the false-success class this phase closes)"

grep -q "no room.db" "$WORK/unscoped.log" \
  || fail "the fallback must log one stderr line naming the missing room.db"

echo "PASS [$SUITE]: --scope-to-nodes intersects with the real Artifact node set and degrades safely"
exit 0
