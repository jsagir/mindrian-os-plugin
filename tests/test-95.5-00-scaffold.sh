#!/usr/bin/env bash
# Phase 95.5 Wave 0 scaffold harness.
# Asserts the 4 Wave-0 deliverables landed correctly per RESEARCH section 11.
#
# NOTE: ASCII -- (two hyphens) used throughout. NO Unicode em-dashes.
set -euo pipefail

# Workspace guard (D-07: hook target is OUTSIDE plugin, but harness runs FROM
# plugin OR a parallel-execution worktree under .claude/worktrees/). The guard
# accepts the canonical workspace AND any worktree path under it so this
# scaffold passes both during parallel-agent execution and during post-merge
# orchestrator verification.
PLUGIN_ROOT="/home/jsagi/MindrianOS-Plugin"
WORKTREE_PREFIX="${PLUGIN_ROOT}/.claude/worktrees/"
if [[ "$PWD" != "$PLUGIN_ROOT" && "$PWD" != ${WORKTREE_PREFIX}* ]]; then
  echo "FAIL: must run from $PLUGIN_ROOT or a parallel worktree under ${WORKTREE_PREFIX}* (PWD=$PWD)"
  exit 1
fi

fail() { echo "FAIL: $1"; exit 1; }
ok()   { echo "ok: $1"; }

# 1. Test file exists and is syntactically valid
[ -f "lib/memory/post-compact-reinjection.test.cjs" ] || fail "test file missing"
node -c lib/memory/post-compact-reinjection.test.cjs >/dev/null || fail "test file syntax error"
ok "test file exists + valid"

# 2. Test file has 9 named tests
test_count=$(grep -c '^test(' lib/memory/post-compact-reinjection.test.cjs)
[ "$test_count" -ge 9 ] || fail "test count $test_count < 9"
named_count=$(grep -E 'Test [1-9]: ' lib/memory/post-compact-reinjection.test.cjs | wc -l)
[ "$named_count" -eq 9 ] || fail "named-test count $named_count != 9"
ok "9 named tests present"

# 3. D-05 vocabulary present
vocab_count=$(grep -c 'side-channel\|frontmatter stamp\|cross-room\|forensic\|Tier 0\|byte-identity' lib/memory/post-compact-reinjection.test.cjs)
[ "$vocab_count" -ge 6 ] || fail "D-05 vocabulary count $vocab_count < 6"
ok "D-05 vocabulary present"

# 4. Consumer stub exists, valid, require-able
[ -f "scripts/restore-post-compact-context.cjs" ] || fail "consumer stub missing"
node -c scripts/restore-post-compact-context.cjs >/dev/null || fail "consumer stub syntax error"
node -e "require('./scripts/restore-post-compact-context.cjs')" || fail "consumer stub not require-able"
consumer_out=$(node scripts/restore-post-compact-context.cjs 2>&1)
[ "$consumer_out" = '{"continue":true}' ] || fail "consumer stub did not emit silent envelope (got: $consumer_out)"
ok "consumer stub valid + silent"

# 5. Anti-pattern check: zero forbidden network calls in consumer.
# Note: grep returns exit 1 when no matches found; under set -e we have to
# guard the count with `|| true` so a clean (zero-match) consumer does not
# trip the harness.
nw=$(grep -cE 'brain-client|fetch|http|curl|brain.mindrian|tavily' scripts/restore-post-compact-context.cjs || true)
[ "$nw" -eq 0 ] || fail "Canon Part 8 violation: network surface in consumer ($nw matches)"
db=$(grep -cE 'require\(.*room-db' scripts/restore-post-compact-context.cjs || true)
[ "$db" -eq 0 ] || fail "anti-pattern: room-db require in consumer"
ok "Canon Part 8 + anti-pattern check passed"

# 6. No Unicode em-dashes (U+2014) or en-dashes (U+2013) in either deliverable
em_test=$(perl -ne 'print if /[\x{2014}\x{2013}]/' lib/memory/post-compact-reinjection.test.cjs | wc -l)
em_consumer=$(perl -ne 'print if /[\x{2014}\x{2013}]/' scripts/restore-post-compact-context.cjs | wc -l)
[ "$em_test" -eq 0 ] || fail "em-dash in test file"
[ "$em_consumer" -eq 0 ] || fail "em-dash in consumer"
ok "no em-dashes"

# 7. Feynman registration intact (line ~216 per RESEARCH section 11)
feynman_ref=$(grep -c 'post-compact-reinjection.test.cjs' lib/memory/run-feynman-tests.cjs || true)
[ "$feynman_ref" -ge 1 ] || fail "Feynman registration missing"
ok "Feynman registration present ($feynman_ref refs)"

echo "PASS: Wave 0 scaffold complete"
