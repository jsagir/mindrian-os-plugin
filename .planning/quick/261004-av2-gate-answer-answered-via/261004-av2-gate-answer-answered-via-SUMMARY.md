---
phase: quick
plan: 261004-av2
subsystem: mcp-gate
tags: [gate_answer, answered_via, hmac-proof, canon-part-9, cr-02, seed-114]
requires: [Phase 369 gate contract (plans 26, 33, 36, 38, 41, 42)]
provides:
  - answered_via marker (browser_nonce | mcp_relayed; unrecorded on read) on the answer record, decision node, mirror source anchor, gate_answer reply and gate_list
  - lib/mcp/answer-route.cjs (route vocabulary, proof check, honest confirm reason)
  - shell proof on the nonce path (control.ts answerRouteMeta, _meta through the pool)
affects: [gate_answer, gate_list read, shell approveDecision, lib/ui-shell/dist]
tech-stack:
  added: []
  patterns: [protocol-level _meta proof (not a tool input), HMAC keyed from the 0600 control token with domain separation]
key-files:
  created: [lib/mcp/answer-route.cjs, tests/test-av2-answered-via.cjs]
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/core/navigation/room-projection.cjs
    - lib/core/navigation/reasoning-write.cjs
    - lib/core/strategy/goal-gate.cjs
    - ui/shared/src/mcp-session-pool.ts
    - ui/shell/server/control.ts
    - ui/shell/server/actions.ts
    - lib/ui-shell/dist/
    - tests/test-369-gate-mirror.cjs
    - tests/test-369-gate-mirror-shell.cjs
    - tests/test-365-never-do-gate.cjs
key-decisions:
  - "Proof travels in request _meta['mindrian/answer_route'] as an HMAC over gateId + sha256(nonce), keyed from the control token; the daemon recomputes it from the token file; match gives browser_nonce, anything else mcp_relayed"
  - "Written values browser_nonce and mcp_relayed; unrecorded is read-only; no chain_resume, no mirror_browser"
  - "369-36's use of answered_via for the mirror gate id moved to via_gate_id; the reader maps older rows"
  - "confirmed_by stays the resolveByUser navigator on both routes; the honest wording goes in the confirm reason and in answered_via on the decision node (confirm-node.cjs untouched)"
requirements-completed: [QUICK-261004-av2, 369-CR-02]
duration: about 55 min
completed: 2026-10-04
---

# Quick 261004-av2: gate_answer records answered_via Summary

Every gate_answer now says how it reached the room: a browser click the shell proved with an HMAC over the gate id and the render nonce (browser_nonce), or anything else (mcp_relayed, a model relaying a card, Desktop, Cowork, chain halts, research, never-do and goal gates).

## The design

- **Value set.** Written: `browser_nonce`, `mcp_relayed`. Read-only: `unrecorded` (an anchor written before this change). No `chain_resume` (chain_run's direct resume writes no anchor, the 369-26 residual) and no `mirror_browser` (the mirror's source anchor carries the mirror's own route plus `via_gate_id`).
- **Proof derivation** (identical in the test, `lib/mcp/answer-route.cjs` and `ui/shell/server/control.ts`):
  - `routeKey = HMAC-SHA256(key = control token trimmed, data = 'mindrian answer route v1')`
  - `tag = SHA-256 hex of the render nonce` (the raw nonce never leaves the shell)
  - `mac = HMAC-SHA256(key = routeKey, data = gateId + "\n" + tag)` hex
  - carried as `_meta['mindrian/answer_route'] = { v: 1, tag, mac }` on the callTool request. It is not a tool input: gate_answer and gate_render input schemas, titles and descriptions are byte-identical to cd27faa94.
  - The daemon (`routeOf`) reads the proof from `extra.mcpReq._meta` (SDK 2.1.0; A3 proved it reaches the handler, so no fallback carrier was needed) with `extra._meta` as the v1 shape, reads the control token file with the launcher's guards (lstat, no link, plain file, O_NOFOLLOW, own uid, no group/other bits), compares with `timingSafeEqual`, never throws, and degrades to `mcp_relayed`.
- **Where it is derived and written.** One `answerRoute.routeOf(` call in the gate_answer handler, before the peek. It is carried on the answer object and written on: the `gate_answer:<id>` memory_event, the decision node props (`writeReasoningNode` gained an optional `answeredVia`), the mirror source anchor (`answered_via` = the mirror's route, `via_gate_id` = the mirror id), the fresh reply and the binding no-room reply. Replays (`replayed`, `answered_elsewhere`) report the RECORDED marker, never the route of the repeating call; `gate_list` reads it through `readGateState`.
- **via_gate_id rename.** 369-36 wrote the mirror's gate id as `answered_via` on a source anchor. That meaning moved to `via_gate_id`; `readGateAnswerAnchor` maps an older row (answered_via not in the route set) to `via_gate_id` and reads `answered_via` as `unrecorded`. Two assertions followed it (test-369-gate-mirror about line 291, test-369-gate-mirror-shell about line 311).
- **Why confirmed_by stays the navigator.** Canon Part 9's guard (`promoteNodeStatus` agent_attribution_forbidden) needs a human principal for a truth claim, and the session client name is an unauthenticated client-supplied string. So `confirmed_by` is `resolveByUser` on both routes; every confirmNode a gate_answer makes (decision node, card subject claim or opportunity, strategy goal anchor via a new optional `confirmReason` on `ratifyGoalProposal`) names the route in its reason text: "(answered_via browser_nonce, proven by the route)" or "(answered_via mcp_relayed, relayed by the model, not proven by the route)". `confirm-node.cjs` and `gate-ledger.cjs` are untouched (git diff against cd27faa94 is empty; gate-ledger keeps exactly one `_ledger.delete(` in non-comment lines).
- **Shell.** `approveDecision` calls `answerRouteMeta(ledgerId, nonce)` once, after `nonces.reserve` accepted the render nonce and before `gateAnswer`; `via()` threads it as call meta; the pool puts it in `callTool` `_meta` only when given; `adapterCall` never sends one.
- **Tri-Polar.** CLI and Desktop (stdio server processes) and Cowork (daemon through the shim) always record `mcp_relayed`; only the browser workspace records `browser_nonce`.

## Commits (full shas, each confirmed an ancestor of HEAD)

| Step | Commit | Message |
|------|--------|---------|
| RED | cb0c00a0c5bc3553e384cffb977e2e7f047690c2 | test(261004-av2): RED arms for the gate_answer answered_via marker (CR-02 option 2) |
| Task 1 GREEN | ea60b398b91e05b6013b882e84a9366715c06cba | feat(261004-av2): gate_answer records answered_via ... on the answer record, decision node, mirror source anchor and reply |
| Task 2 | 178b9e55afb458fc0903dca17ed32fed8bacf22c | feat(261004-av2): the shell proves a browser click to the daemon on the render-nonce path (answered_via browser_nonce) |
| Task 3 | 75b5be78fa268e025815964ecaf13693b370826b | test(261004-av2): re-pin GATE_BASE to ea60b398b after the answered_via marker (2026-10-04) |

RED first FAIL line: `FAIL A1 a model-composed answer (no proof) records mcp_relayed on the reply, record, decision node and confirm reason` (reply carried no answered_via; `+ undefined - 'mcp_relayed'`); RED exited 1, PASS=0 FAIL=11.

## Before and after (measured)

| Check | Baseline (Step 0) | After |
|-------|-------------------|-------|
| tests/test-av2-answered-via.cjs | n/a (new) | exit 0, PASS=11 FAIL=0 (A1-A6, B1-B4, dash guard) |
| test-365-never-do-gate | 75/0 | 75/0 (74/1 between Task 1 and Task 3, N12 byte-identity only, as predicted) |
| test-369-gate-recovery | PASS=11 | PASS=11 |
| test-369-gate-mirror | PASS=10 | PASS=10 |
| test-369-gate-raised | 11/0 | 11/0 |
| test-369-gate-hardening | 20/0 | 20/0 |
| test-369-human-only | PASS=10 | PASS=10 |
| test-369-shell-actions | PASS=17 | PASS=17 |
| test-369-gate-mirror-shell | PASS=10 | PASS=10 (9/1 between Task 1 and Task 2, the line-311 assertion) |
| test-369-sessionful-acceptance | PASS=6 | PASS=6 |
| test-369-289-precondition | PASS | PASS |
| test-i2x-t2-node-write-back | 78 assertions | 78 assertions |
| test-365-baseline | 7/0 | 7/0 |
| test-345-gate-ratify | rc=1 (known, real registry visible) | rc=1, identical failing leg |
| test-363-mcp-tool | 11 pass / 4 fail (M3, M4, M5, M7, known) | 11 / 4, identical legs |
| run-all-289 | PASSED=47 FAILED=0 KNOWN=1 | PASSED=47 FAILED=0 KNOWN=1 |
| run-all-238 | PASS=10 FAIL=0 | PASS=10 FAIL=0 |
| test-267 zod4 / registration / dual-era | not run at baseline | 4/0, 71/0, 5/0 (green; no description or schema moved) |
| run-all-267 | not run at baseline | PASS=31 FAIL=0 SKIP=3 |
| test-270, test-234, test-276 | not run at baseline | 5/0, 204/0 (48/48 tools), 149/0 |
| check-tool-honesty --check | 45 tools, 140 branches, 0 high-risk | OK, 45 tools, 140 branches, 0 high-risk (276-dispositions.json untouched) |
| GATE_BASE | cd27faa94 | ea60b398b91e05b6013b882e84a9366715c06cba = `git log -1 --format=%H -- lib/mcp/tools/gate.cjs` (PIN_OK), moved once |
| build-connector-registry / build-orchestration-projection / gen-mcp-adapter / build-ui-shell --check / check-render-coverage | OK | all OK (render coverage 17 covered, 0 gap; ui-shell dist fresh, source hash b87db0e5e8e97888, 270 dist files verified; build wrote 271 files, 10583606 bytes) |
| test-369-ui-dist-fresh, test-369-shared-core, test-369-claude-adapter | n/a | 18/0, PASS=15, PASS=9 |

The 369.1 peer's commits and diffs (lib/core/mcp-dep-heal.cjs and friends) were never staged by this task. Known pre-existing reds from 369-38 and 369-41 (test-363 M3-M7, test-345) are unchanged; test-237-approve-executes, test-237-autonomy-parity and test-366 R6b were not in the sweep.

## Deviations from Plan

**1. [Rule 3 - Blocking] test-av2 adapterCall regex tightened in the Task 2 commit.** The RED file's static B4 arm matched `adapterCall` with a loose fallback pattern; once the pool exists as written it needed an exact match of the method body. Changed in the Task 2 commit (same file as the RED commit, no behaviour change). Commit 178b9e55a.

**2. Assertion updates in the two mirror tests** (named in the plan): test-369-gate-mirror (via_gate_id = M, answered_via mcp_relayed) in the Task 1 commit; test-369-gate-mirror-shell (via_gate_id = mirror ledger id, answered_via one of the two routes; that arm's spy pool drops the proof) in the Task 2 commit.

**3. Build recipe.** The orchestrator note said to hand-copy edited ui/shared/src files into ui/shell/node_modules/mos-ui-shared; build-ui-shell.cjs refreshes that copy itself (its header says so), so no manual copy was needed. Build and `--check` both green.

None otherwise - the plan was executed as written; A3 proved `_meta` reaches the handler at `extra.mcpReq._meta`, so no alternative carrier was invented.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The same-user residual (T-av2-03) stands as accepted: a same-user process that can read the 0600 control token can mint the proof (369-SESSION-CONTRACT.md section 3 class). SEED-114 owns the human-only route.

## Open items for the navigator (recorded, not built)

1. The shell's "Confirmed by you" copy reads `confirmed_by` only and does not yet show the route. For an `mcp_relayed` confirm, the decision node's `confirmed_by` is still the navigator identity; the honest wording lives in the confirm reason text and in `answered_via` on the node and anchor. The shell's wording for an `mcp_relayed` confirm is a copy and design call.
2. chain_run's direct resume still writes no gate_answer anchor (the 369-26 residual), so such a resume has no marker.
3. The same-user residual above (SEED-114).

## Self-Check: PASSED

- FOUND: lib/mcp/answer-route.cjs, tests/test-av2-answered-via.cjs, this SUMMARY
- FOUND commits (all ancestors of HEAD): cb0c00a0c, ea60b398b, 178b9e55a, 75b5be78f
- Dash guard (LC_ALL=C, E2 80 94 and E2 80 93) over every touched file (dist excluded): clean
- STATE.md and ROADMAP.md untouched
