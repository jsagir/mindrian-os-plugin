---
phase: quick-261002-cud
plan: 01
subsystem: research-planner / mcp
tags: [mcp, research_run, canon-release, gate-ledger, egress-policy, plan_only, seed-104]
requires:
  - phase: 366
    provides: canon-release (366-11), egress policy and typed plan_only (366-17), perspective op set (366-12)
provides:
  - MCP research_run op basket mints session-keyed release gates; release answered through gate_answer
  - canonRelease.transportFromEnv, the one release transport chooser shared by the CLI and MCP doors
  - MCP run_quick answers typed plan_only and takes an offline flag
  - localRoomCheck strict-majority content-token coverage (SEED-104 residual)
affects: [phase 366 close-out, phase 289 gate ledger, MCP surface, wire snapshot]
tech-stack:
  added: []
  patterns:
    - "One transport chooser per egress door (Canon Part 7)"
    - "One ledger key resolver for mint and consume (ledgerKeyFor -> gateLedger.ledgerSessionKey)"
key-files:
  created:
    - tests/test-366-mcp-release-route.cjs
    - tests/test-366-mcp-plan-only.cjs
    - tests/test-seed104-room-check-tokens.cjs
    - .planning/quick/261002-cud-366-gap-fixes-research-cjs-plan-only-ses/261002-cud-PLAN.md
  modified:
    - lib/core/research-planner/canon-release.cjs
    - scripts/research-planner.cjs
    - lib/mcp/tools/research.cjs
    - lib/core/research-planner/quick.cjs
    - tests/fixtures/267/wire-snapshot-zod4.json
    - tests/test-365-never-do-gate.cjs
    - tests/run-all-366.sh
    - .planning/seeds/SEED-104-research-grant-family-loop-eureka-plan-unfetchable.md
    - .planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/deferred-items.md
key-decisions:
  - "DR-1: MCP release uses the same environment-chosen transport as the CLI; no replay file and no MOS_366_LIVE=1 means no gate and live_not_enabled"
  - "DR-2: canon items leave the filing gate; release offers ride their own gates; confirm items are listed with the CLI next step"
  - "DR-3: task order keeps the research_run registration, wire entry and N12 pin moving once"
  - "DR-4: strict-majority content-token coverage beside the exact phrase; single-token terms keep substring semantics"
requirements-completed: [EPV366-18, EPV366-22, EPV366-03, SEED-104]
duration: about 95 min
completed: 2026-10-02
---

# Quick 261002-cud: Phase 366 gap fixes in research.cjs, plan_only and room check Summary

**Over MCP, research_run now mints session-keyed, single-use release gates for unresolved room words (same transport rule as the CLI), answers typed plan_only with an offline flag instead of run_refused, and the room-only coverage check counts keyword coverage so a long zone term the room names in other words is no longer "0 artifacts".**

## Performance

- **Tasks:** 3 of 3 (each RED then GREEN), plus one follow-up commit for the orchestrator's session-key directive
- **Files modified:** 9 tracked source/test/fixture files, 3 new tests, plus the plan, SEED-104 note and deferred-items note

## Accomplishments

1. **Release over MCP (Task 1).** `op basket` computes `canonRelease.transportFromEnv(process.env)` and, when ok, passes `{ sessionId, deps }` to `planner.basketFor`. The response splits items into `items` (fileable only), `release_offers` (term, item_id, gate_id or null, F.8 card with options release / not_now, `unavailable_reason`, note, `line_on`) and `confirm_items` (term, canon_name, CLI next step). `gate_answer` is untouched: chain_result carries `sent {raw: term}`, guard `navigator_released`, one 23-key audit row, one PROPOSED translation row. Single use, cross-session refused, not_now sends nothing.
2. **Typed plan_only and offline (Task 2).** `opRunQuick` passes `offline: env.input.offline === true`, and a `plan_only` branch returns `ok true, status plan_only, reason egress_line_off, line, offline, sent false, outcome plan_only_not_sent`, the plan card and an honest next_step. `inputSchema` gains `offline` (boolean only). `DESCRIPTION` gains two sentences. The research_run wire entry was refreshed from the live wire and N12 re-pinned.
3. **SEED-104 residual (Task 3).** `localRoomCheck` keeps the exact-phrase hit and adds strict-majority content-token coverage (frozen `ROOM_CHECK_STOP`, `contentTokens`, per-file token set built lazily). On the hermetic fixture the seven-word term finds the opportunity-bank artifact (0 before); a 3-of-7 artifact stays out. deep.cjs inherits the fix with no edit.

## Planner decisions as decided (DR-1 to DR-4)

- **DR-1 transport parity.** The MCP door uses the SAME environment-chosen transport as the CLI, now `canonRelease.transportFromEnv(env)`; `canonTransport()` in scripts/research-planner.cjs is a one-line delegation. Without MOS_366_THEO_REPLAY or MOS_366_LIVE=1 the MCP basket mints no gate and answers `live_not_enabled`. Making MCP release live by default is a separate navigator ruling (one-line change to transportFromEnv's default).
- **DR-2 canon items leave the filing gate.** The F.8 filing gate carries fileable items only. Release offers ride their own gates; canon_confirm items are listed with the CLI canon-confirm next step. An MCP confirm route is owed.
- **DR-3 task order.** The one registration change (inputSchema, description, wire entry, N12 pin) happened once, in Task 2.
- **DR-4 token coverage rule.** Content tokens are NFKC-lowercased runs of letters and numbers of length >= 3 (or holding a digit), minus the closed function-word list, deduped. An artifact counts when the exact phrase is present, or when the term has 2 or more content tokens and the artifact holds at least floor(n/2)+1 of them. Single-token terms keep substring semantics.

## Commits

| Commit | Message |
| --- | --- |
| 15654cee2 | test: failing MCP release-route legs C1-C12 (also commits the PLAN.md) |
| beb8d2c54 | fix: MCP basket mints session-keyed release gates; release answered through gate_answer |
| da5f6598b | test: failing MCP plan_only and offline legs P1-P6 |
| 0b39f8528 | fix: research_run run_quick answers plan_only and takes offline; wire entry refreshed (this is the SHA RESEARCH_BASE pins: 0b39f852828022f67e56993b94539c5757dca207) |
| a3978968d | test: re-pin research_run parity base in test-365 N12 |
| a372e502a | test: failing SEED-104 room-check token legs K1-K7 |
| c92c9b2f5 | fix: room-only coverage check counts strict-majority keyword coverage; three tests registered in run-all-366.sh; SEED-104 note |
| b5356bab8 | fix: derive the release gate session key through the one shared ledger resolver (orchestrator directive; C1b strengthened) |
| 393a92a04 | docs: note the Phase 366 items closed by the quick in deferred-items.md |

The SUMMARY is committed after this file (see the final report for its SHA).

## Suite lines: Step 0 baseline vs final (hermetic, node 22.23.1)

| Suite | Step 0 | Final |
| --- | --- | --- |
| run-all-366 | PASSED=63 FAILED=1 SKIPPED=4 KNOWN=1 (the one FAILED was the dash pin catching a literal dash in my own in-flight RED test, fixed before commit; otherwise green) | PASSED=67 FAILED=0 SKIPPED=4 KNOWN=1 (three new legs listed and PASSED) |
| run-all-363 | PASSED=44 FAILED=2 SKIPPED=1 KNOWN=7 (known reds: run-all-3551 drift, no-new-dependency) | PASSED=44 FAILED=2 SKIPPED=1 KNOWN=7 (same two) |

Caveat: the Step 0 baselines were started in the background and my edits landed while they ran, so they are not a pure HEAD baseline. The 363 baseline failure set equals the two reds the plan names, which makes it trustworthy for the comparison.

New and listed tests, final: test-366-mcp-release-route 13/0, test-366-mcp-plan-only 6/0, test-seed104-room-check-tokens 7/0, test-366-mcp-perspective-ops 9/0, test-366-gated-term-release 28/0, test-366-egress-policy 24/0, test-363-mcp-tool 15/0, test-363-run-quick 19/0, test-363-acceptance-whitespace green (W1 flagged false holds), test-seed104-grant-family-loop 19/0, test-365-never-do-gate 75/0, test-270-tool-schema-budget 5/0, test-234-tool-description-floor 192/0, test-267-mcpv2-dual-era PASS=5, check-tool-honesty --check exit 0, build-connector-registry --check exit 0. `git diff f7910ac1f` over gate.cjs, planner.cjs, filing.cjs, families.cjs, whitespace-recall.cjs is empty. No em-dash or en-dash in any touched file.

## Deviations from Plan

**1. [Rule 3 - Blocking] test-363-mcp-tool M11 forbids "brain|theo|adapter-client|part8" in research.cjs non-comment lines.**
- **Found during:** Task 1 GREEN (M11 went red).
- **Issue:** the plan's code read `it.theo_on`, emitted a `theo_on` field, and its description sentence said "the Brain's canon-name lookup". All trip M11, and the plan also demanded test-363-mcp-tool stay green.
- **Fix:** kept M11 untouched (it is a Part 8 guard). The offer carries `line_on` instead of `theo_on`, the egress-off case is detected by `it.note === canonRelease.OFF_NOTE`, and the description says "the remote canon-name lookup" (still satisfies P5's "canon-name lookup", no vendor name).
- **Files:** lib/mcp/tools/research.cjs. **Commits:** beb8d2c54, 0b39f8528.

**2. [Rule 1 - Bug] Wire snapshot `$schema` line.** The live wire emits JSON Schema 2020-12 for research_run while the other 47 snapshot entries carry draft-07 and the compare normalizes it. I kept draft-07 for research_run so the diff touches only the description, the new `offline` property and `refreshed_by`. test-267-mcpv2-dual-era PASS=5 on repeat runs (one run flaked on the process-hygiene leg while a baseline suite ran concurrently).

**3. [Orchestrator directive] Session key derivation.** Mid-task the orchestrator asked that the mint key come through the shared resolver gate_answer's consume uses, with a leg asserting mint and consume agree. Implemented as `ledgerKeyFor(env)` (the single derivation, used for the release mint, the filing approval record and the file check), and C1b now asserts the ledger entry's sessionKey equals `ledgerSessionKey(resolveEffectiveSessionId(undefined, extra))` for the session-less and the named caller, then answers the session-less caller's own gate through gate_answer. Commit b5356bab8.

**4. P2 is weak before the fix** (it passes vacuously on the old run_refused path because that path also sends nothing); P1 and P3 carry the RED signal. Left as is.

## Closed items (strike in deferred-items.md and the 366-17 summary)

- 366-11 "The MCP door does not mint release gates yet".
- 366-17 "MCP door ... opRunQuick has no branch for plan_only ... cannot pass offline".
- The SEED-104 room-only `ws:extraction_failure` false negative.

A short "Closed by quick 261002-cud" note was appended to deferred-items.md (commit 393a92a04) as the objective allowed; the original lines were not struck.

## Owed follow-ups

- An MCP confirm route for canon_confirm items (CLI canon-confirm only today).
- `op grant_request` on an egress-off plan still answers `plan_not_ready` with `reason_detail` `egress_line_off`.
- The plan review card "overturn a line" affordance (366-17).
- gate-ledger consume-before-session-check (Phase 289): a refused cross-session answer destroys the owner's gate (T-cud-03 transfer). C8 only asserts nothing is sent.
- Any navigator ruling to make the MCP release live by default (DR-1).
- The directory mtime of ~/MindrianRooms/egain-des-liquid-conductor changed during the run (the room root, not the evidence file; the evidence file mtime is unchanged at 1790889623). This quick never wrote there; likely another process or a hook.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The only new egress, the navigator-gated `{raw: term}` over MCP, was in the threat model (T-cud-01, T-cud-02) and is covered by C3, C9, C10, C11.

## Self-Check

Verified before the final commit: the three new test files exist, all eight code and test commits above resolve in `git log`, and run-all-366 ends FAILED=0.

## Self-Check: PASSED
