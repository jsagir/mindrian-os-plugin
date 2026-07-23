#!/usr/bin/env bash
# Phase 127.3 Plan 06 -- empirical regression test for the JTBD auto-anchor
# silent-failure bug. The protocol is derived from the RCA's
# "Reproduction Steps" section
# (.planning/debug/jtbd-auto-anchor-silent-failure/jtbd-auto-anchor-silent-failure.md).
#
# This is the goal-backward verification gate for the whole phase: the test
# PASSES only when Plans 00 / 01 / 02 / 03 / 04 / 05 have all landed correctly.
# If any of them regresses (or the future drifts back), this test FAILS.
#
# Two-half protocol (covers both layers of the RCA's three-defect cluster):
#
# HALF 1 -- jtbd-update.cjs hook end-to-end (Plan 01 + Plan 00):
#   Fresh test room via scripts/room-registry create (Plan 04 also seeds
#   USER.md / STATE.md / ROOM.md / .mindrian/). Seed conversation-operator.json
#   so the classifier threshold stays at 0.6 (default JUST_TALK raises it to
#   0.8 AND boosts the 'explore' fallback above any candidate JTBD because
#   JUST_TALK is in explore's operator_affinity). Fire scripts/jtbd-update.cjs
#   userprompt with a 4-cue decide-pursue message. Assert
#   <roomDir>/.mindrian/jtbd-state.json was created with current.jtbd ===
#   'decide-pursue'. This proves the chokepoint resolves the room AND the
#   classifier hook lifecycle ran end-to-end.
#
# HALF 2 -- across-session promotion (Plan 00 slug resolution + Phase 103-05):
#   Construct a synthetic 3-turn within-session history for the same JTBD and
#   call promoteIfEligible directly. Assert
#   ~/MindrianRooms/.memory/ exists with in_flight containing 'decide-pursue'
#   for the test room slug. This proves the chokepoint returns the canonical
#   registered slug (not path.basename fallback) AND the across-session
#   promotion gate (>= 3 turn_count) writes the in_flight row.
#
# Why split into two halves (deviation from the verbatim PATTERNS.md body):
#   The RCA's "fire the hook 3 times with the same cue" step does not actually
#   exercise the across-session 3-turn gate end-to-end on current code: the
#   isTransition gate in jtbd-update.cjs:115-122 short-circuits subsequent
#   turns when the classified jtbd + confidence are unchanged. Only ONE
#   transition lands in the history, so turn_count stays at 1 and
#   promoteIfEligible's `>=3` gate never fires. Faithfully reproducing the
#   RCA's INTENT (each layer of the pipeline is alive, not silently dead)
#   requires testing both halves on their canonical surfaces. This is the
#   Rule 1 fix the plan's <action> note authorizes: "use whichever cue /
#   protocol triggers the same outcome".
#
# Cleanup discipline (W-07 carry-forward + plan CRITICAL invariant #1):
#   scripts/room-registry has no `remove` subcommand at the time of writing.
#   Cleanup uses a Python fallback that edits ~/MindrianRooms/.rooms/
#   registry.json directly (atomic tmp+rename) AND removes the test room slug
#   from ~/MindrianRooms/.memory/jtbd-history.json (so the test never pollutes
#   real cross-session memory), wrapped in a trap on EXIT.
#
# Bash only. No emoji. No em-dashes. set -euo pipefail.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_ROOM_SLUG="test-jtbd-127.3-empirical"
ROOMS_HOME="${MINDRIAN_ROOMS_HOME:-${HOME}/MindrianRooms}"
TEST_ROOM="${ROOMS_HOME}/${TEST_ROOM_SLUG}"
REGISTRY_FILE="${ROOMS_HOME}/.rooms/registry.json"
MEMORY_FILE="${ROOMS_HOME}/.memory/jtbd-history.json"

# Cleanup function: removes the test room dir, deregisters it from
# registry.json via a Python fallback (no `remove` subcommand exists), clears
# the `active` field if it still points at the test room, and scrubs the
# test slug from the cross-session memory file (so the test never pollutes
# real in_flight / parked / completed entries).
cleanup() {
  rm -rf "${TEST_ROOM}" 2>/dev/null || true

  if [ -f "${REGISTRY_FILE}" ]; then
    python3 - "${REGISTRY_FILE}" "${TEST_ROOM_SLUG}" <<'PY_EOF' 2>/dev/null || true
import json, os, sys
reg_path = sys.argv[1]
slug = sys.argv[2]
try:
    with open(reg_path, 'r') as f:
        reg = json.load(f)
except Exception:
    sys.exit(0)
changed = False
if isinstance(reg.get('rooms'), dict) and slug in reg['rooms']:
    del reg['rooms'][slug]
    changed = True
if reg.get('active') == slug:
    reg['active'] = ''
    changed = True
if changed:
    tmp = reg_path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(reg, f, indent=2)
    os.replace(tmp, reg_path)
PY_EOF
  fi

  if [ -f "${MEMORY_FILE}" ]; then
    python3 - "${MEMORY_FILE}" "${TEST_ROOM_SLUG}" <<'PY_EOF' 2>/dev/null || true
import json, os, sys
mem_path = sys.argv[1]
slug = sys.argv[2]
try:
    with open(mem_path, 'r') as f:
        mem = json.load(f)
except Exception:
    sys.exit(0)
if isinstance(mem.get('rooms'), dict) and slug in mem['rooms']:
    del mem['rooms'][slug]
    tmp = mem_path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(mem, f, indent=2)
    os.replace(tmp, mem_path)
PY_EOF
  fi
}
trap cleanup EXIT

# Step 1a: pre-clean any prior state, then create a fresh room.
cleanup
bash "${REPO}/scripts/room-registry" create "${TEST_ROOM_SLUG}" "${TEST_ROOM_SLUG}" >/dev/null

# Step 1b: seed conversation-operator.json with current=BUILD_ROOM. Without
# this seed the default operator is JUST_TALK, which raises the classifier
# threshold to 0.8 AND boosts the 'explore' fallback JTBD (its
# operator_affinity includes JUST_TALK) above any token-stratum candidate.
# BUILD_ROOM is in decide-pursue's operator_affinity, contributing +0.3 and
# keeping the threshold at 0.6.
mkdir -p "${TEST_ROOM}/.mindrian"
cat > "${TEST_ROOM}/.mindrian/conversation-operator.json" <<'OP_EOF'
{
  "schema_version": "1.0.0",
  "current": "BUILD_ROOM",
  "previous": null,
  "entered_at": "2026-05-24T00:00:00.000Z",
  "context": {
    "active_room": "test-jtbd-127.3-empirical",
    "active_section": null,
    "methodology_in_flight": null,
    "decision_gate_pending": null
  },
  "history": []
}
OP_EOF

# Half 1 / Step 2: fire the hook once with a 4-cue decide-pursue message.
# The taxonomy cues for decide-pursue are: "should we pursue", "go / no-go",
# "is this worth", "kill it or keep it", "pivot", "double down". This message
# packs four substring hits so the tokens stratum saturates at
# normalize(>=3)=1.0 -> 0.5 contribution. Plus +0.3 operator boost -> 0.8.
JTBD_CUE_MESSAGE="should we pursue this idea, pivot or double down or kill it or keep it"
CLAUDE_USER_MESSAGE="${JTBD_CUE_MESSAGE}" \
  MINDRIAN_DEBUG=1 \
  node "${REPO}/scripts/jtbd-update.cjs" userprompt

# Half 1 / Step 3: assert the state file was written and current.jtbd is
# 'decide-pursue' (not the explore fallback that the BROKEN-pre-127.3
# resolver would have left untouched -- i.e. file absent entirely).
if [ ! -f "${TEST_ROOM}/.mindrian/jtbd-state.json" ]; then
  echo "FAIL: ${TEST_ROOM}/.mindrian/jtbd-state.json was not created on first cue" >&2
  echo "  Plan 01 (jtbd-update.cjs chokepoint reroute) likely regressed." >&2
  exit 1
fi
CURRENT_JTBD=$(python3 -c "
import json
try:
    s = json.load(open('${TEST_ROOM}/.mindrian/jtbd-state.json'))
    cur = s.get('current') or {}
    print(cur.get('jtbd') or '')
except Exception:
    print('')
")
if [ "${CURRENT_JTBD}" != "decide-pursue" ]; then
  echo "FAIL: jtbd-state.json current.jtbd was '${CURRENT_JTBD}', expected 'decide-pursue'" >&2
  echo "  Classifier did not match the 4-cue message; check lib/hmi/jtbd-taxonomy.json." >&2
  exit 1
fi

# Half 2 / Step 4: directly invoke promoteIfEligible with a synthetic 3-turn
# history for decide-pursue. This proves Plan 00's chokepoint returns the
# canonical registered slug (so getRoomMemory finds the test room AT THE
# REGISTERED SLUG, not at the path.basename fallback) AND the Phase 103-05
# across-session pipeline writes in_flight when the turn_count gate is
# satisfied. See header note "Why split into two halves" for rationale.
node -e "
  const path = require('path');
  process.env.MINDRIAN_ROOMS_HOME = '${ROOMS_HOME}';
  const m = require('${REPO}/lib/hmi/across-session-memory.cjs');
  const { resolveActiveRoom } = require('${REPO}/lib/core/resolve-active-room.cjs');
  const resolved = resolveActiveRoom();
  if (!resolved || resolved.slug !== '${TEST_ROOM_SLUG}') {
    process.stderr.write('FAIL: chokepoint did not resolve test room. got: ' + JSON.stringify(resolved) + '\\n');
    process.exit(2);
  }
  const synthHistory = [
    { from: 'explore', to: 'decide-pursue', trigger: 'user_message', at: new Date(Date.now()-3000).toISOString(), evidence: ['tokens:4'] },
    { from: 'decide-pursue', to: 'decide-pursue', trigger: 'user_message', at: new Date(Date.now()-2000).toISOString(), evidence: ['tokens:4'] },
    { from: 'decide-pursue', to: 'decide-pursue', trigger: 'user_message', at: new Date(Date.now()-1000).toISOString(), evidence: ['tokens:4'] },
  ];
  const synthCurrent = { jtbd: 'decide-pursue', confidence: 0.8, entered_at: new Date(Date.now()-3000).toISOString(), evidence: ['tokens:4','operator:BUILD_ROOM'] };
  const r = m.promoteIfEligible(resolved.slug, { current: synthCurrent, history: synthHistory });
  if (!r || r.action !== 'promoted') {
    process.stderr.write('FAIL: promoteIfEligible did not promote. got: ' + JSON.stringify(r) + '\\n');
    process.exit(3);
  }
"

# Half 2 / Step 5: assert promotion landed in across-session memory.
RESULT=$(node -e "
  process.env.MINDRIAN_ROOMS_HOME = '${ROOMS_HOME}';
  const m = require('${REPO}/lib/hmi/across-session-memory.cjs');
  const r = m.getRoomMemory('${TEST_ROOM_SLUG}');
  process.stdout.write(JSON.stringify(r && r.in_flight || []));
")
if ! echo "${RESULT}" | grep -q '"decide-pursue"'; then
  echo "FAIL: in_flight did not contain decide-pursue after synthetic 3-turn promote" >&2
  echo "  got: ${RESULT}" >&2
  echo "  Plan 00 chokepoint slug resolution OR Phase 103-05 across-session pipeline regressed." >&2
  exit 1
fi

# Half 2 / Step 6: assert ~/MindrianRooms/.memory/ was lazily bootstrapped
# by the across-session pipeline (the third symptom from the RCA's actual:
# section -- "~/MindrianRooms/.memory/ directory DOES NOT EXIST"; after the
# fix it MUST exist with jtbd-history.json present).
if [ ! -f "${MEMORY_FILE}" ]; then
  echo "FAIL: ${MEMORY_FILE} was not created by promoteIfEligible" >&2
  echo "  lib/hmi/across-session-memory.cjs::ensureDir + atomicUpdateMemory regressed." >&2
  exit 1
fi

echo "PASS: JTBD auto-anchor empirical regression test"
exit 0
