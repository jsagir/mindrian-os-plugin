#!/usr/bin/env bash
# Phase 236 verification aggregator: the single PASS/FAIL gate for
# "room.db data loss fixes".
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. A graph rebuild can NEVER erase memory rows. The indexer owns Artifact and
#      Section nodes and the edges it derives. It does not own memory_event,
#      claims, decisions or stage_history, and it must not be able to delete them
#      by accident. The defect was a single unscoped statement that wiped the
#      whole nodes and edges tables before reindexing, taking the room's
#      irreplaceable journal with it.
#   2. A failed open TELLS THE TRUTH about its state. A database that is busy is
#      not the same as one that is broken, and neither is the same as one that is
#      simply absent. An open that swallows the difference reports a healthy room
#      that is not there.
#   3. The declared Node floor is the version where the room.db write-safety
#      option actually works, not the lower version where the module merely
#      loads.
#
# DISCOVERY IS BY GLOB, NOT BY LIST. This harness globs every tests/test-236-*
# file (both .cjs and .sh) and runs it. Adding a tests/test-236-* file requires
# NO edit to this runner. There is no hand-maintained execution list anywhere
# below, deliberately: a list is a second place to forget something.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   236-01  tests/test-236-rebuild-preserves-journal.cjs
#   236-01  tests/test-236-ecosystem-graph-preserves-journal.cjs
#   236-02  tests/test-236-backfill-default-preserves-journal.cjs
#   236-02  tests/test-236-rebuild-crash-mid-transaction.cjs
#   236-02  tests/test-236-rebuild-wal-concurrent-read.cjs
#   236-03  tests/test-236-open-busy-detected.cjs
#   236-03  tests/test-236-open-broken-detected.cjs
#   236-04  tests/test-236-engines-floor.cjs
#
# That is EIGHT, not seven. 236-RESEARCH.md's validation architecture named seven
# mutation-provable tests. While 236-01 was in flight it found a SECOND unscoped
# wipe site, in scripts/build-ecosystem-graph.cjs, and added an eighth test for
# it. 236-VALIDATION.md records the correction; the count in 236-04-PLAN.md's
# acceptance criteria predates it. Eight is the real number and this list is the
# real list.
#
# A test named above that is missing from disk is NOT reported by this runner as
# a failure, because a file that does not exist cannot be globbed. That is the
# honest limitation of glob discovery and the reason the names are written out
# here: the header is the checklist, the glob is the executor. What the runner
# DOES catch, loudly, is the case where NOTHING at all is discovered.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness that
# discovers nothing must FAIL, not print green. A clean summary over an empty
# discovery is the same false-success shape this entire phase exists to close.
#
# run_may_skip is kept even though no .sh test is planned for this phase, so a
# later plan that adds one inherits the behavior: an environment self-skip is
# tallied as SKIP, never as a pass it did not earn.
#
# THE PERMANENT REGRESSION GATE (the RCA's Test 3, scoped in here as a runner leg
# rather than a new commit-time check script, per Canon Part 7 reuse before
# build): a comment-stripped sweep asserting the unscoped delete has not returned
# anywhere under lib/. Two non-negotiable rules apply to it.
#
#   RULE 1  Strip whole-line comments BEFORE matching. Header prose and design
#           comments legitimately QUOTE the forbidden statement while explaining
#           why it is forbidden. Two such comments exist right now, in
#           lib/core/graph-backfill.cjs and lib/core/lazygraph-ops.cjs. Without
#           stripping, the gate would fire on the very comments documenting the
#           fix, and the next person to trip it would delete the gate.
#   RULE 2  Run a NEGATIVE SELF-TEST FIRST. A grep gate that quietly stopped
#           matching looks exactly like a clean codebase. Before the gate is
#           trusted over real files it runs over synthetic probes that must be
#           caught, plus probes that must NOT be, including a comment line naming
#           the forbidden statement and the legitimate scoped WHERE type IN form.
#
# NON-VACUITY. The sweep passing could mean "no unscoped delete exists" or it
# could mean "no delete of any kind exists, so the pattern has nothing to chew
# on". Those are very different states and only one of them is good. So a
# separate leg asserts, against UNSTRIPPED source under lib/, that the literal
# token DELETE FROM nodes still EXISTS somewhere. The gate has to prove it is
# discriminating unscoped from scoped, not unscoped from absent.
#
# THE DOCUMENTED ALLOWANCE, written down rather than silently regexed away.
# FOUR lines, all in lib/memory/test-rs-sqlite-mirror.cjs, all about the same
# thing. That file tests a rollback-SQL GENERATOR: it asserts on the CONTENT and
# the ORDERING of a rollback_cypher string the generator produced. To do that it
# searches for the bare statement text, twice with .indexOf for ordering and
# twice inside an assert.ok whose failure message quotes the statement it was
# looking for. Every one of those is a string literal being searched for inside
# generated text, not a statement being executed against a database.
#
# They are allowed by EXACT call shape, never by a broad regex and never by
# excluding the file: the allowance pins the const name plus the
# rollback_cypher.indexOf call plus the semicolon for the first pair, and the
# full assert.ok predicate plus its exact message for the second. A genuine
# future conn.exec of an unscoped delete, IN THIS SAME FILE, cannot match either
# shape and is still caught. The self-test below proves that with a probe, so
# the allowance is not taken on trust.
#
# Two of these four were NOT predicted when this gate was first written. The
# first run of the sweep surfaced them, which is the sweep doing its job: the
# gate was written, run against real files, and corrected by what it actually
# found rather than by what it was assumed it would find.
#
# scripts/hsi-to-graph.cjs needs NO allowance and gets none. It is Phase 242 and
# MOAT-01 territory, deliberately out of scope for this phase, and it is also
# irrelevant to this gate on two independent counts: the sweep is scoped to lib/
# and that file lives under scripts/, and its deletes are already scoped
# (DELETE FROM edges WHERE type = ...) so the pattern would not match them even
# if the sweep did reach it. A speculative allowance for a file the gate cannot
# see would be a hole with no reason behind it.
#
# Every leg is fully hermetic and makes ZERO network reach. No em-dashes.

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

# Strip whole-line comments (// or block-comment body lines, and # for python/sh)
# so header prose never trips a grep OR satisfies one.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*|#)' "$1" 2>/dev/null
}

shopt -s nullglob
found=0
for t in tests/test-236-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-236-*.sh; do
  found=1
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-236-* files discovered"
  exit 1
fi

# ---------------------------------------------------------------------------
# The unscoped-delete regression gate. This is what stops 236-01's fix silently
# regressing in a later phase.
#
# The pattern catches a delete of the nodes or edges table that is NOT narrowed
# by a WHERE clause: the table name followed by end of statement (a semicolon, a
# closing quote of any of the three kinds, a closing paren, or end of line)
# rather than by more SQL. The legitimate scoped form has WHERE immediately
# after the table name and therefore does not match.
# ---------------------------------------------------------------------------
UNSCOPED_RE='DELETE[[:space:]]+FROM[[:space:]]+(nodes|edges)[[:space:]]*(;|'"'"'|"|`|\)|$)'
# EXACT call-shape allowance, four lines, all in lib/memory/test-rs-sqlite-mirror.cjs.
# See the header for the written reason. Both alternatives pin the whole call
# expression, so a real exec of an unscoped delete in that same file is still caught.
UNSCOPED_ALLOW='(const first(Edge|Node)Del = result\.rollback_cypher\.indexOf\('"'"'DELETE FROM (edges|nodes)'"'"'\);|assert\.ok\(/DELETE FROM (nodes|edges)/\.test\(result\.rollback_cypher\), '"'"'rollback_cypher must contain DELETE FROM (nodes|edges)'"'"'\);)'

echo "--- unscoped-delete self-test: the gate actually bites ---"
SELFTEST_OK=1
GATE_TMP="$(mktemp -d)"
trap 'rm -rf "$GATE_TMP"' EXIT

# Both probes run the EXACT pipeline the sweep below runs, allowance filter
# included. A self-test that skipped the allowance would prove the pattern bites
# while saying nothing about whether the allowance then swallows the bite, which
# is the more likely way this gate goes quietly blind.
must_catch() {
  local label="$1" line="$2"
  printf '%s\n' "$line" > "$GATE_TMP/probe"
  if strip_comments "$GATE_TMP/probe" | grep -nE "$UNSCOPED_RE" | grep -vE "$UNSCOPED_ALLOW" | grep -q .; then
    echo "    caught: $label"
  else
    echo "    MISS (the gate is blind to this): $label -> $line"; SELFTEST_OK=0
  fi
}

must_not_catch() {
  local label="$1" line="$2"
  printf '%s\n' "$line" > "$GATE_TMP/probe"
  if strip_comments "$GATE_TMP/probe" | grep -nE "$UNSCOPED_RE" | grep -vE "$UNSCOPED_ALLOW" | grep -q .; then
    echo "    FALSE POSITIVE: $label -> $line"; SELFTEST_OK=0
  else
    echo "    correctly ignored: $label"
  fi
}

# The exact defect, as it stood before 236-01.
must_catch "the planted unscoped statement" "    conn.exec('DELETE FROM edges; DELETE FROM nodes;');"
must_catch "nodes wiped alone, single quotes" "    conn.exec('DELETE FROM nodes');"
must_catch "edges wiped alone, double quotes" "    conn.prepare(\"DELETE FROM edges\").run();"
must_catch "wiped via a template literal" "    conn.exec(\`DELETE FROM nodes\`);"
must_catch "bare statement, end of line" "  DELETE FROM nodes"
must_catch "extra whitespace between tokens" "    conn.exec('DELETE  FROM   nodes;');"
# The legitimate forms, which must survive.
must_not_catch "a comment line naming the forbidden statement" "// the old defect was conn.exec('DELETE FROM edges; DELETE FROM nodes;')"
must_not_catch "a block-comment body naming it" " * DELETE FROM edges; DELETE FROM nodes; then reindex."
must_not_catch "the legitimate scoped nodes form" "    'DELETE FROM nodes WHERE type IN (' + ph(INDEXER_OWNED_NODE_TYPES) + ')'"
must_not_catch "the legitimate scoped edges form" "    'DELETE FROM edges WHERE type IN (' + ph(derived) + ')'"
must_not_catch "a scoped delete by id" "  'DELETE FROM edges WHERE source = ? OR target = ?'"
must_not_catch "written-reason allowance, the indexOf ordering shape" "    const firstEdgeDel = result.rollback_cypher.indexOf('DELETE FROM edges');"
must_not_catch "written-reason allowance, the assert.ok content shape" "    assert.ok(/DELETE FROM nodes/.test(result.rollback_cypher), 'rollback_cypher must contain DELETE FROM nodes');"
must_not_catch "ordinary local code" "  const db = openRoomDbForCaller(roomDir);"
# The allowance must not become a hiding place. A REAL unscoped exec on a line
# that also mentions rollback_cypher, in the very file the allowance exists for,
# must still be caught. Otherwise the written reason quietly became a loophole.
must_catch "a real exec smuggled onto an allowance-adjacent line" "    conn.exec(result.rollback_cypher); conn.exec('DELETE FROM nodes');"
must_catch "a real exec dressed up as the indexOf shape" "    const firstEdgeDel = conn.exec('DELETE FROM edges');"

if [ "$SELFTEST_OK" -eq 1 ]; then
  echo ">>> unscoped-delete self-test: PASSED"; PASS=$((PASS+1))
else
  echo ">>> unscoped-delete self-test: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- unscoped-delete sweep: no unscoped wipe anywhere under lib/ ---"
GATE_OK=1
SWEPT=0
while IFS= read -r tgt; do
  SWEPT=$((SWEPT+1))
  HITS="$(strip_comments "$tgt" | grep -nE "$UNSCOPED_RE" | grep -vE "$UNSCOPED_ALLOW")"
  if [ -n "$HITS" ]; then
    echo "    UNSCOPED delete on an executable line in: $tgt"
    printf '      %s\n' "$HITS"
    GATE_OK=0
  fi
done < <(find lib -type f -name '*.cjs' | sort)
if [ "$SWEPT" -eq 0 ]; then
  echo "    swept ZERO files under lib/, so this leg proves nothing"
  GATE_OK=0
fi
if [ "$GATE_OK" -eq 1 ]; then
  echo "    swept $SWEPT files under lib/"
  echo ">>> unscoped-delete sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> unscoped-delete sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- unscoped-delete non-vacuity: the gate has something to discriminate ---"
# UNSTRIPPED on purpose. The question here is not "is any delete executable", it
# is "does the token exist at all". If it does not, the sweep above passed
# because there was nothing to match, which is not the same as being clean.
NONVACUOUS="$(grep -rlE 'DELETE FROM nodes' lib 2>/dev/null)"
if [ -n "$NONVACUOUS" ]; then
  echo "    DELETE FROM nodes still present under lib/ in:"
  printf '      %s\n' "$NONVACUOUS"
  echo ">>> unscoped-delete non-vacuity: PASSED"; PASS=$((PASS+1))
else
  echo "    the literal DELETE FROM nodes is ABSENT from lib/ entirely."
  echo "    The sweep above therefore passed vacuously: it discriminated nothing."
  echo ">>> unscoped-delete non-vacuity: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 236: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
