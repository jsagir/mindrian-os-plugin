---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 14
subsystem: ui-shared-claude-adapter
tags: [claude-adapter, d-14, a1-ruling, room-proposal, seed-067, wave-2]

requires:
  - phase: 369-08
    provides: ProposalSchema and ProposalSource, the session pool with its own adapter session
provides:
  - 369-ADAPTER-RULING.md (A1 ruled room-proposal, F7 and SEED-067 notes)
  - roomProposalSource and copyReference (read-only ProposalSource, no spawn)
  - tests/test-369-claude-adapter.cjs (static, fake-pool and live-daemon arms)
affects: [369-21, 369-32]

tech-stack:
  added: []
  patterns:
    - "Adapter takes a one-method pool (adapterCall) so a fake pool records every tool it touches"
    - "Recommendation read from the room's own claim standing, never from a model"

key-files:
  created:
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-ADAPTER-RULING.md
    - ui/shared/src/claude-adapter.ts
    - tests/test-369-claude-adapter.cjs
  modified: []

key-decisions:
  - "A1 ruled by the navigator 2026-10-03, reply verbatim 'room-proposal (Recommended)': no claude spawn; proposals arrive through the room"
  - "The adapter names only room_bind, claim_read and graph_query, all on the adapter's own MCP session"
  - "A proposal is the newest proposed claim whose text names the selected node id; recommended approve when its standing points at a source, else hold"

requirements-completed: [SHELL369-02]

duration: 25min
completed: 2026-10-03
---

# Phase 369 Plan 14: Claude adapter (room-proposal) Summary

**The navigator ruled A1 as room-proposal, so the shell never runs the person's Claude Code: the person pastes one reference line to Larry, Larry files a proposed claim naming the node, and a read-only adapter on its own MCP session maps that claim to a ProposalSchema-valid proposal.**

## Accomplishments

- **Task 1, the ruling.** `369-ADAPTER-RULING.md` records the navigator's reply verbatim (`room-proposal (Recommended)`), the date, both options with pros and cons, why the room path was chosen (no commercial-terms question, no second process or key), the F7 note (registerCapability kernel absent from lib/, Phases 212/213 not live cards, adapter registers through the existing action layer as proposeDecision in plan 32, the todo stays unresolved) and the SEED-067 note (no second key, no agent-native model loop without a separate ruling).
- **Task 2, the adapter.** `ui/shared/src/claude-adapter.ts` exports `roomProposalSource({ pool })` (`proposeResult` returning `{ ok, proposal, elapsed_ms }` or `{ ok: false, reason }`, plus `propose` for the ProposalSource contract, which rejects with the reason) and `copyReference(selectedNodeId, question)`. It binds its own session to the room, lists proposed claims whose text names the node (`claim_read` query), reads the newest by id, reads the claim's outbound `SOURCED_FROM` targets through `graph_query` for evidence, and validates with `ProposalSchema`. Reasons: `invalid_request`, `room_unavailable`, `no_proposal`, `proposal_invalid`. No write tool name appears in the file (grep count 0).
- **Task 3, the proof.** `tests/test-369-claude-adapter.cjs`: 9 arms, all PASS. Static (no write tool, no spawn, no cookie or nonce in code, no long dash, loads under type stripping), copyReference, six fake-pool arms (every tool call recorded and checked against the read vocabulary; newest wins; other-node, own-node and non-proposed claims skipped; each failure reason), and three live arms against the hermetic flag-ON daemon with a seeded room (valid proposal with the node and the claim's source as evidence and recommended approve; claim counts unchanged and the adapter session id distinct from a human session; no_proposal for an unnamed node; room_unavailable for an unknown room).

## Task Commits

1. Task 1, ruling: `7c9099ff7`
2. Task 2, adapter: `00aa84638`
3. Task 3, test: `6244749fa`

## Test Results

- `node tests/test-369-claude-adapter.cjs`: PASS=9 FAIL=0, exit 0. The live-Claude arm does not exist on this path: nothing is spawned under the room-proposal ruling.
- `node tests/test-369-walled-manifest.cjs`: 7 passed, 0 failed.
- `node tests/test-369-shared-core.cjs`: PASS=13 FAIL=0 (ui/shared still sound).
- `node tests/test-369-ts-erasable-gate.cjs`: 7 passed, 1 failed. NOT caused by this plan: the greps stage flags `ui/bakeoff/agent-native/app/tsconfig.json` (a TS `paths` alias), a file from a parallel plan that is not mine. Logged here, not fixed (scope boundary).

## Deviations from Plan

### Plan branch not built (consequence of the ruling, not a defect)

- `tests/fixtures/369/fake-claude.cjs` was not created, and `headlessClaudeProposalSource` / `buildArgv` do not exist. The plan lists the fake binary in `files_modified` for the headless branch only; under room-proposal nothing is spawned, so a fake `claude` would be dead code. The plan's room-proposal test arms (seeded claim maps to a valid proposal, none yields `no_proposal`, copyReference contains the node id, no write tool name in the module) are all covered, plus extra boundary arms.

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan wording] "filed with created_by larry" cannot be read back**
- **Found during:** Task 2 (reading `claim_write` and `claim_read`)
- **Issue:** `claim_write` stamps `created_by = 'system'` on every claim (typed-claim.cjs), and `claim_read` does not return `created_by`, so a larry-only filter is impossible.
- **Fix:** the filter is: type claim, `review_status` proposed, text names the selected node id, not the selected node itself. The copyReference line asks Larry to write the node id in the claim text, which is how the shell correlates the claim to the node. Recorded in 369-ADAPTER-RULING.md.

**2. [Rule 2 - Missing contract detail] ProposalSource returns a Proposal, but the plan names `{ ok: false, reason: 'no_proposal' }`**
- **Fix:** `proposeResult` returns the envelope the plan describes; `propose` (the ProposalSource contract from plan 08) resolves the Proposal or rejects with the reason, so both shapes are available and plan 08's type is unchanged.

## Notes

- `room_changes` (plan 13) is not needed by this adapter: it reads the room through `claim_read` and `graph_query`. The shell's change feed that shows the new claim is plan 13/15 territory.
- The evidence list holds the selected node plus the claim's `SOURCED_FROM` targets; a claim with no source edge recommends `hold`.
- STATE.md and ROADMAP.md were not touched (orchestrator instruction).

## Known Stubs

None.

## Threat Flags

None. Register mitigations that apply to this branch: T-369-14-01 (no write tool name, static arm; read vocabulary asserted against every recorded call), T-369-14-02 (no cookie or nonce in code, own adapter session proven distinct), T-369-14-05 (A1 ruled and recorded with the navigator's reply), T-369-14-06 (ProposalSchema validation, `proposal_invalid` arm). T-369-14-03 and -04 (hooks in a headless run, a hung process) do not arise: nothing is spawned.

## Self-Check: PASSED

- FOUND: 369-ADAPTER-RULING.md, ui/shared/src/claude-adapter.ts, tests/test-369-claude-adapter.cjs
- FOUND commits: 7c9099ff7, 00aa84638, 6244749fa
