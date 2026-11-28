#!/usr/bin/env bash
# Quick 261127-bnd aggregator: the runner of the gate of the branch fix/261127-boundary (first cut).
# Hyphens only. exit 0 -> FAIL=0.
#
# The branch fixes 10 findings (F1 rs-explain remote leg; F2 F3 F12 F14 F16 and the 2 twins,
# the Brain lines of the command text; F17 the first input; F7 graph-query; F8 the intel
# pipeline default gate; F10 orchestration admin) and the 15 shell lines that put text on a
# shell command line (Tasks 4 to 6).
#
# Each leg gets its own new temp HOME, USERPROFILE, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME,
# MINDRIAN_BRAIN_URL=http://127.0.0.1:9, and no CLAUDE_ACTIVE_ROOM, CLAUDE_CODE_SESSION_ID
# or MINDRIAN_ROOM. The legs run one after the other.
#
# These tests were red before this quick and are NOT legs here (their result must not change):
#   lib/memory/test-rs-nl-to-query.cjs (14/16 passed, 2 failed),
#   tests/test-sqlite-ops.cjs (# pass 49, # fail 3),
#   tests/test-sqlite-concurrent.cjs (# pass 3, # fail 1),
#   tests/test-267-mcpv2-zod4-contract.cjs (RESULT: PASS=2 FAIL=2),
#   tests/test-363-command-contract.cjs (PASS: 5 FAIL: 3),
#   tests/test-359-prose-budget.cjs (16 passed, 2 failed, green after 406-P1),
#   tests/test-3696-voice-first-budget.cjs (PASS: 11 FAIL: 1, green after 406-P1),
#   tests/test-3696-operation-doctrine.cjs (PASS: 25 FAIL: 1, still red: RT1, 400.5 plan 04 and 369.7),
#   tests/test-358-b2-part8.cjs (passed=6 failed=1),
#   tests/test-234-plugin-root-migrated.cjs (18 passed, 1 failed),
#   tests/test-273-substrate-baseline-honest.cjs (exit 1: 202 measured, 204 documented),
#   tests/test-209-declared-implies-wired.cjs (exit 1),
#   node scripts/build-dist-bundles.cjs --check-stale (STALE, the bundle is from 2.0.0-beta.52).
#
# The acceptance roll-up (node scripts/doctor.cjs --acceptance) is run beside this runner, in
# a temp home: gate commands G0, G1, G3 and G4 of the plan.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT

PASS=0; FAIL=0

run() {
  local label="$1"; shift
  local d
  d="$(mktemp -d -p "$SB")"
  mkdir -p "$d/h/.mindrian" "$d/rooms"
  echo "--- $label ---"
  env -u CLAUDE_ACTIVE_ROOM -u CLAUDE_CODE_SESSION_ID -u MINDRIAN_ROOM \
    HOME="$d/h" USERPROFILE="$d/h" MINDRIAN_HOME="$d/h/.mindrian" MINDRIAN_ROOMS_HOME="$d/rooms" \
    MINDRIAN_BRAIN_URL=http://127.0.0.1:9 "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  else echo ">>> $label: FAILED (exit $status)"; FAIL=$((FAIL+1)); fi
  echo ""
}

leg() {
  local f="$1"
  case "$f" in
    *.sh) run "$f" bash "$f" ;;
    *) run "$f" node --no-warnings "$f" ;;
  esac
}

# The 9 new tests.
leg tests/test-261127-bnd-rs-explain-local.cjs
leg tests/test-261127-bnd-command-text.cjs
leg tests/test-261127-bnd-shell-args-bash.cjs
leg tests/test-261127-bnd-shell-args-text.cjs
leg tests/test-261127-bnd-shell-args-json.cjs
leg tests/test-261127-bnd-shell-text.cjs
leg tests/test-261127-bnd-graph-query-readonly.cjs
leg tests/test-261127-bnd-intel-no-gate.cjs
leg tests/test-261127-bnd-admin-not-available.cjs
leg tests/test-261127-bnd-flag-file-read.cjs

# The findings (27).
leg lib/memory/test-rs-explain-command.cjs
leg tests/test-223-intel-pipeline.cjs
leg tests/test-265-intel-roster-fan.cjs
leg tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs
leg tests/test-tool-router-grouped-reference.cjs
leg tests/test-205-surface-fence.cjs
leg tests/test-311-admin-visibility.cjs
leg tests/test-kwl-meeting-mcp-honesty.cjs
leg tests/test-rooms-open-actually-switches.cjs
leg tests/test-395-room-isolation.cjs
leg tests/test-400-3-room-db-opener.cjs
leg tests/test-sqlite-battle.cjs
leg lib/memory/index-artifact-transaction.test.cjs
leg lib/memory/lazygraph-rs-discoveries-view.test.cjs
leg tests/test-substrate-contract.cjs
leg tests/test-270-tool-schema-budget.cjs
leg tests/test-3692-four-commands.cjs
leg tests/test-265-file-meeting-gates.cjs
leg tests/test-386-semantic-scholar-approval.cjs
leg tests/test-363-baseline.cjs
leg tests/test-update-restart-cue.cjs
leg tests/test-341-update-collapsed.cjs
leg tests/test-354-extract-shallow-contract.cjs
leg tests/test-356-larry-contract.cjs
leg tests/test-chain-executor-part8-leak.cjs
leg tests/test-larry-handoff-seam.cjs
leg tests/test-115-persona-variants.sh

# The scripts of the shell lines (33).
leg tests/test-386-research-speaker-approval.cjs
leg tests/test-261030-eo7-research-speaker-apply-context.cjs
leg tests/test-261030-eo7-research-speaker-urlencode.cjs
leg tests/test-386-web-path-gate.cjs
leg tests/test-36925-rid-registry-relative-path.cjs
leg tests/test-36925-rid-repair.cjs
leg tests/test-204-room-chooser.cjs
leg lib/memory/statusline-active-room-write.test.cjs
leg tests/test-phase-56.sh
leg tests/test-127.2-04-windows-path-and-update-activation.sh
leg tests/test-358-b1-cli.cjs
leg tests/test-358-b1-separation.cjs
leg tests/test-358-b1-refile.cjs
leg tests/test-358-b2-cli.cjs
leg tests/test-358-b2-persistence.cjs
leg tests/test-358-b2-core.cjs
leg tests/test-358-b2-routing.cjs
leg tests/296-rs-experts-degrade.test.cjs
leg tests/test-rs-experts-find-mcp.cjs
leg tests/test-200-local-tier0.cjs
leg tests/test-261006-0hl-close-loop-cli.cjs
leg tests/test-223-close-loop.cjs
leg tests/test-223-supersedes-chain.cjs
leg tests/test-348-one-supersession-door.cjs
leg tests/test-361-cli.cjs
leg tests/test-361-filing.cjs
leg tests/test-361-command-contract.cjs
leg tests/test-361-agent-contract.cjs
leg tests/test-143.2-doctrine-presence.cjs
leg tests/test-227-frontdoor-restraint.cjs
leg tests/test-204-ignite-wiring-grep.cjs
leg tests/test-400-3-honest-status.cjs
leg lib/memory/post-write-triple.test.cjs

# The 5 generator checks and the render coverage.
run "build-skill-mirrors check" node scripts/build-skill-mirrors.cjs --check
run "build-command-registry check" node scripts/build-command-registry.cjs --check
run "build-connector-registry check" node scripts/build-connector-registry.cjs --check
run "build-orchestration-projection check" node scripts/build-orchestration-projection.cjs --check
run "build-harness-manifest check" node scripts/build-harness-manifest.cjs --check
run "render coverage check" node scripts/check-render-coverage.cjs --check

run "substrate baseline is 202" bash -c '
  out=$(node scripts/check-substrate.cjs --baseline 2>&1)
  printf "%s\n" "$out" | grep -qF "Found 202 violation(s)" || { printf "%s\n" "$out" | tail -3; exit 1; }'

run "no em-dash or en-dash in 261127-bnd files" bash -c '
  files="
    commands/bono.md
    commands/compare-ventures.md
    commands/dominant-designs.md
    commands/file-meeting.md
    commands/find-analogies.md
    commands/find-connections.md
    commands/new-project.md
    commands/room.md
    commands/rooms.md
    commands/rs-experts.md
    commands/rs-explain.md
    commands/update.md
    commands/whitespace.md
    lib/core/flag-file-read.cjs
    lib/core/graph-ops.cjs
    lib/core/intel-pipeline.cjs
    lib/core/lazygraph-ops.cjs
    lib/mcp/tool-router.cjs
    lib/memory/test-rs-explain-command.cjs
    pipelines/analogy/03-search.md
    references/meeting/filing-protocol.md
    references/personality/agent-operations.md
    scripts/claim-checks.cjs
    scripts/close-loop.cjs
    scripts/create-speaker-profile
    scripts/dominant-design-research.cjs
    scripts/mindrian-tools.cjs
    scripts/research-speaker
    scripts/room-question.cjs
    scripts/room-registry
    scripts/rs-experts-command.cjs
    scripts/rs-explain-command.cjs
    skills/bono/SKILL.md
    skills/compare-ventures/SKILL.md
    skills/conversation-mode/SKILL.md
    skills/dominant-designs/SKILL.md
    skills/file-meeting/SKILL.md
    skills/find-analogies/SKILL.md
    skills/find-connections/SKILL.md
    skills/new-project/SKILL.md
    skills/room/SKILL.md
    skills/rooms/SKILL.md
    skills/rs-experts/SKILL.md
    skills/rs-explain/SKILL.md
    skills/update/SKILL.md
    skills/whitespace/SKILL.md
    tests/run-all-261127-bnd.sh
    tests/test-261127-bnd-admin-not-available.cjs
    tests/test-261127-bnd-command-text.cjs
    tests/test-261127-bnd-flag-file-read.cjs
    tests/test-261127-bnd-graph-query-readonly.cjs
    tests/test-261127-bnd-intel-no-gate.cjs
    tests/test-261127-bnd-rs-explain-local.cjs
    tests/test-261127-bnd-shell-args-bash.cjs
    tests/test-261127-bnd-shell-args-json.cjs
    tests/test-261127-bnd-shell-args-text.cjs
    tests/test-261127-bnd-shell-text.cjs
    tests/test-363-command-contract.cjs
  "
  hits=$(LC_ALL=C grep -lP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

run "no personal name shape in the update command" bash -c '
  if grep -nE "confirmed in the field by [A-Z][a-z]+ [A-Z][a-z]+" commands/update.md skills/update/SKILL.md; then exit 1; fi
  exit 0'

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
