---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 36
subsystem: gate-ledger
tags: [gap-closure, gap-1, gate, mirror, answered-elsewhere, d-15, d-16, d-19]
requires:
  - phase: 369-33
    provides: "gate_raised records, readRaisedGate / readGateState / readGateAnswerAnchor (answered_via), gate_list"
  - phase: 369-26
    provides: "withRoomTx ratification, releaseGate after COMMIT, replay by gate id"
provides:
  - "gate_render mirror_of: a session bound to the same room re-raises a gate raised elsewhere, drawn from the room's record"
  - "the mirror answer and the source's answer anchor written in ONE withRoomTx"
  - "answered_elsewhere replay for the source's owner, with exactly-once resume of a halted step"
affects: [369-41, 369-42, 369-44]
tech-stack:
  added: []
  patterns: ["mirror ledger entry (mirrorOf) owned by the mirroring session, session-scoped ledger unchanged", "typed GateStopped marker thrown inside withRoomTx, mapped after the rollback"]
key-files:
  created:
    - tests/test-369-gate-mirror.cjs
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/mcp/gate-raised.cjs
key-decisions:
  - "The mirror is a normal ledger entry owned by the mirroring session; gate-ledger.cjs is untouched, so a stranger still gets session_mismatch and the source's owner still answers (D-19)"
  - "The authoritative answered-elsewhere check is inside the write transaction (BEGIN IMMEDIATE, own handle, before the first write); a cheap read-only look is used only so stale_subject cannot mask it"
  - "A material_step or binding source mirrors as a general card with no resume owner and no subject promotion; the source's owner resumes its own step exactly once from the recorded answer"
  - "The resume payload carries the SOURCE gate id (research baskets key on it) plus decision_node_id"
requirements-completed: [SHELL369-12, GREC369-02]
duration: ~1h30
completed: 2026-10-04
---

# Phase 369 Plan 36: gate_render mirror_of and answered-elsewhere Summary

A gate raised in Claude Code can now be decided once from another session of the same room: the shell raises a mirror of it (`gate_render mirror_of`), answers its own mirror, and the room records one decision; Larry's own later answer replays "answered elsewhere" and a halted step resumes exactly once. The session-scoped ledger rule set is unchanged.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 (RED) | 5089de8c9 | tests/test-369-gate-mirror.cjs, 10 arms; exit 1, 1 of 10 passing (dash guard). First FAIL line: `FAIL 1 mirror_of mints a different gate whose card is the room's record; refusals are typed` (the mirror renders the same card as the record: `mirror_of` was not yet an input, so a plain card was minted) |
| 2 | 5e5c1fd37 (full 5e5c1fd37e1b7357e5b93566d8507b9483d83113) | mirror_of on gate_render, `_answerInTx` / answered-elsewhere in gate_answer, `mirrorCardFrom` and `mirrorOptionIdsMatch` in gate-raised.cjs, both descriptions rewritten |
| 3 | none | sweep only; no defect found, so no commit |

## What was built

- **gate_render `mirror_of`** (string, 1 to 200). Refuses `mirror_with_gate_id` when `gate_id` is also given; resolves the caller's write room (`resolveMcpWriteRoom`, its refusal returned when unbound); reads `readGateState` for the source over the read-only door: answered gives `mirror_source_answered` with verdict and chosen, expired `gate_expired`, closed/unknown (also another room's, and a mirror id, which leaves no record) `unknown_gate`, a read failure `lookup_failed`. The card is built from the RECORD by `mirrorCardFrom` (header, select mode, options with ranks/descriptions/previews/recommended flag, subject, evidence); the caller's options must repeat the recorded ids in order or the call is `mirror_mismatch`. The floor notice is composed fresh by the existing notice block (the mirror reuses it unchanged). The mint carries `mirrorOf`, `approving`, `mirrorFramework`, `mirrorExpiresAt`, `mirrorSourceKind` plus `_mintContext`. A mirror never takes the inline elicitation rung (elicitation forced off), is skipped by the plan-33 observer (no record of its own), and its response adds `mirror_of`.
- **gate_answer `_answerInTx`** (the withRoomTx body, replacing the direct `_applyRatification` call). Before any write it reads, on the transaction handle: the gate's own answer anchor, and for a mirror the source's state (answered, closed, expired). A hit throws a `GateStopped` marker (rolled back, nothing written) that `_stoppedAnswer` maps after the rollback: the live entry is released first (synchronously), then `answered_elsewhere` answers `{ ok, replayed, already_answered, answered_elsewhere, gate_id, source_gate_id?, verdict, chosen, decision_node_id, answered_via }` with the RECORDED verdict and chosen (and `requested_verdict` plus a note when they differ), or `unknown_gate` detail `source_closed`, or `gate_expired`. A material_step entry with a resumeFn runs it once with the recorded `{ gate_id, chosen, verdict, decision_node_id }` and nests the result under `chain_result`. A mirror that nothing stopped writes its own ratification and then the source anchor (`gate_answer:<source>`, `answered_via` the mirror id) in the same transaction; a failed anchor write is fatal and rolls everything back (`persistence_failed`, mirror stays answerable).
- **stale_subject no longer masks the replay.** An approve on a mirror promotes the subject claim, which changes its revision; the owner's later approve would have read `stale_subject`. A read-only `_answeredInRoom` look skips that refusal when the room already holds an answer for the gate or its source. Mutation proof: removing it makes arm 3b fail with `stale_subject`.
- **Mirror keeps the source's `approving` ids** (289 coherence applies through it: arm 7) and the chain halt's framework handle (arm 8: `USES_FRAMEWORK` to `framework:six-thinking-hats`). `_promoteCardSubject` skips subject promotion when `mirrorSourceKind` is not `general`.
- **Descriptions.** gate_answer rewritten compactly to 1992 bytes (was 1934 plus the mirror text; every 369-26 state kept), gate_render 1352 bytes; both inside the 2048 floor (tests/test-234-tool-description-floor.cjs 204 passed, 48/48).
- **gate-ledger.cjs untouched** (arm 9 and `git log`: no commit of this plan touches it).

## Verification (final tree, nvm Node)

- `node tests/test-369-gate-mirror.cjs`: PASS=10 FAIL=0 (live stdio CLI process + live daemon + in-process owner). Arms: 1 mint and typed refusals; 2 one-transaction answer (decision node, SOURCED_FROM edges, source anchor `answered_via`, one shared `room_change_log.transaction_id`, `gate_list` drops S and reads it answered with `decision:gate:<mirror>`); 3 and 3b owner replay `answered_elsewhere` (also for an owner approve); 4 owner-first; 5 stranger `session_mismatch`, owner still answers, second mirror replays; 6 exactly-once resume; 7 coherence; 8 framework; 9 static order and ledger untouched.
- `node tests/test-369-gate-raised.cjs` PASS 11 FAIL 0; `node tests/test-234-tool-description-floor.cjs` 204 passed; `node tests/test-369-gate-recovery.cjs` PASS=11; `node tests/test-369-human-only.cjs` PASS=10; `node tests/test-369-shell-actions.cjs` PASS=17; `node tests/test-369-sessionful-acceptance.cjs` PASS=6; `bash tests/run-all-238.sh` PASS=10 FAIL=0.
- `bash tests/run-all-289.sh`: `PASSED=44 FAILED=3 SKIPPED=0 KNOWN=1` on the last run (the 3 are the expected-red window below); an earlier run read FAILED=4 because tests/test-289-cli-card-dual-era.cjs failed its process-hygiene leg (see Sweep).
- Dash guard over the three files: `LC_ALL=C /usr/bin/grep -nP "\xE2\x80\x94|\xE2\x80\x93"` prints nothing.

## Expected-red window (measured, owned by plan 369-41; GATE_BASE NOT re-pinned)

| Check | Measured |
|-------|----------|
| tests/test-365-never-do-gate.cjs N12 | 72 pass, 3 fail: gate_render description/title vs PLAN_BASE; **gate_answer description/title vs GATE_BASE (plan 369-26) is NEW red from this plan**; `lib/mcp/tools/gate.cjs` byte-identical to GATE_BASE. The last gate.cjs commit to pin is 5e5c1fd37e1b7357e5b93566d8507b9483d83113 (unless something else changes it first); gate_answer's pin needs its new description bytes |
| tests/test-267-mcpv2-zod4-contract.cjs | PASS=1 FAIL=3: (a) three description diffs `tool:gate_answer`, `tool:gate_render`, `tool:room_list`; (b) extras now include `tool:gate_answer:description` (new from this plan) beside `tool:gate_list:membership`, `tool:gate_render:description`, `tool:room_list:description`; (d) the two zod importers under scripts/ are 369.1-04, not this plan |
| tests/test-267-mcpv2-registration-api.cjs | `live tools/list count (48) != wire-snapshot-zod4.json local.tools count (47)` (PASS=70 FAIL=1) |
| tests/test-267-mcpv2-dual-era.cjs | red both eras (gate_list membership, gate_render and gate_answer descriptions) |
| tests/test-270-tool-schema-budget.cjs | `the measured surface matches the recorded AFTER toolCount` (4 passed, 1 failed). The new `mirror_of` input also moves the measured surface bytes |
| tests/test-276-tool-honesty-findings-closed.cjs | 146 passed, 3 failed: `gate_render.(default)` absent from live non-OK set; frozen_sweep.tools and .branches vs live. `node scripts/check-tool-honesty.cjs --check` itself reads OK (45 tools, 140 branches, 0 high-risk) |
| `node scripts/build-connector-registry.cjs --check` | measured OK at this tree (the orchestrator regenerated it for gate_list at 4d61eeb9f; this plan adds no tool) |
| `node ui/shared/scripts/gen-mcp-adapter.mjs --check` | measured "up to date" (not red); plan 41 should still regenerate and re-check because gate_render gained an input |

## Sweep of the gate suites (71 files naming gate_render / gate_answer / gate-ledger, plus the five named extras; e2e-369 excluded)

Method: each file run with the nvm Node in the live tree and in a `git archive 6c4a42144` copy (the tree right after plan 33; this is the "before this plan" baseline, plan 33's own pre-plan list is quoted from its SUMMARY). 59 files green in both, 1 skip (77) became a pass.

| Test file | Before (6c4a42144, archive) | After (this plan) | Owner |
|-----------|----------------------------|-------------------|-------|
| tests/test-369-gate-mirror.cjs | red (RED commit) | green 10/10 | this plan |
| tests/test-365-never-do-gate.cjs | green (the archive has no git history for the byte pins) | red N12 x3 (72/3), see window table | plan 369-41 pin (the gate_answer description pin is new) |
| tests/test-267-mcpv2-dual-era.cjs | red | red (adds gate_answer description) | plan 369-41 pin |
| tests/test-289-cli-card-dual-era.cjs | green | red on its "process hygiene" leg in 3 direct runs (PASS=5 FAIL=1); green inside `run-all-289.sh`; green in the archive with this plan's two gate files copied in | environmental, not gate code: the leg's `pgrep -f "node .*<bin path>"` finds a second server process that appears during the run (a `scripts/mindrian-mcp-server.cjs` process seen by a poll); it also kills anything it deems leaked. 369.1 owns bin/, scripts/mindrian-*.cjs and daemon-lifecycle; flagged for them, not edited here |
| tests/test-369-shared-core.cjs | red | green | peer-tree state, as plan 33 recorded |
| tests/test-369-shell-actions.cjs | skip (77) | green 17/17 | peer-tree state, as plan 33 recorded |
| tests/test-237-approve-executes.cjs, test-237-autonomy-parity.cjs, test-345-gate-ratify.cjs, test-363-mcp-tool.cjs, test-365-floor-gate.cjs, test-366-gated-term-release.cjs | red | red (same) | pre-existing (plan 33's list) |
| every other file | green | green | no change |

No new red is a defect of this plan: the only flips caused by this plan are the intended description/schema changes that existing wire pins freeze (all listed above for plan 369-41). No gate.cjs defect fix was needed, so Task 3 made no commit.

## Deviations from Plan

**1. [Rule 2 - correctness] stale_subject masked answered_elsewhere for an owner approve**
- **Found during:** designing arm 3 (before the RED commit).
- **Issue:** the mirror's approve promotes the subject claim; the source owner's later approve then fails the stale-subject check and never reaches the transaction, so "the owner's later answer replays answered_elsewhere" would be false for approves.
- **Fix:** `_answeredInRoom` read-only look skips the stale_subject refusal when the room already holds an answer for the gate or its source; the authoritative check stays inside the transaction. Arm 3b proves it (and a mutation run showed it fails without the guard).
- **Files:** lib/mcp/tools/gate.cjs. **Commit:** 5e5c1fd37.

**2. [Rule 2 - correctness] a mirror of a material_step source must not promote a subject**
- **Issue:** the mirror is drawn as a general card (no resume owner), which would let `_promoteCardSubject` treat the approval as a truth-claim approval for a card that authorized an action.
- **Fix:** `mirrorSourceKind` rides on the entry; `_promoteCardSubject` returns `kind_not_general` for a non-general source. **Commit:** 5e5c1fd37.

**3. [Rule 2 - correctness] a mirror is never an inline elicitation**
- A host that declares elicitation would have answered the mirror inline and consumed it with no source anchor. `gate_render` forces elicitation off for a mirror, so it takes the card or text rung and is answered only through gate_answer.

**4. [Plan wording] `grep -c "answered_elsewhere" lib/mcp/tools/gate.cjs` etc.** The acceptance greps hold (answered_elsewhere several times, `mirrorCardFrom` defined in gate-raised.cjs and called from gate.cjs through `gateRaised.mirrorCardFrom`).

No auth gates.

## Known Gaps / Deferred (handoffs, not edited here)

- **never-do proposal gates resumed through a mirror.** `lib/mcp/never-do-gate.cjs` `makeProposalResumeFn` looks up `decision:gate:<payload.gate_id>`. After an answered-elsewhere resume the payload `gate_id` is the SOURCE id (research baskets key on it), while the decision node is `decision:gate:<mirror>`, so that resume refuses `decision_node_missing` and adds nothing (a safe refusal). This plan passes `decision_node_id` in the payload; never-do-gate.cjs should read `payload.decision_node_id` when present. The chain and research resumeFns do not depend on the decision node id. Not in this plan's files; no test covers a mirrored never-do proposal.
- **A strategy card mirrored from a record** has its option previews capped at 1000 characters by the plan-33 record, so a mirror approval of a long goal proposal can fail the goal ratification softly (reported on the response, never flipping ok). Chain and general cards are unaffected.
- **A repeat answer of a released mirror** reads `unknown_gate` (the mirror has no anchor of its own once the source was answered first); the source's answer stands.
- **Plan 369-41** moves the pins above once, after the last gate.cjs commit, and re-checks gen-mcp-adapter.

## Known Stubs

None.

## Threat Flags

None new beyond the plan's register. T-369-36-01 (spoofed card) arm 1 mirror_mismatch and the card drawn from the record; -02 (cross-session consume) arm 5; -03 (double decision) arms 3, 4, 5 with the read inside the transaction (arm 9); -04 (approve with Hold) arm 7; -05 (which surface decided) arm 2 `answered_via`; -06 (resume twice) arm 6. Canon Part 8: nothing in a mirror carries a session id or reaches a Brain call (`mirrorCardFrom` copies by field name from the bounded record).

## Self-Check: PASSED

Created and modified files exist (tests/test-369-gate-mirror.cjs, lib/mcp/tools/gate.cjs, lib/mcp/gate-raised.cjs); commits 5089de8c9 and 5e5c1fd37 are ancestors of HEAD; gate-ledger.cjs, STATE.md, ROADMAP.md and every 369.1-owned file untouched by this plan.
