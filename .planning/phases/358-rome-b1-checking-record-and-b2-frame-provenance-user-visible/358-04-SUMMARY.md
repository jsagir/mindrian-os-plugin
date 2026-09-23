---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 04
subsystem: mcp-surface
tags: [b1, mcp, claim-read, claim-verify, desktop, cowork, rome, tdd, cirs]

# Dependency graph
requires:
  - phase: 358-01
    provides: VERIFICATION_RUNGS, recordClaimVerification (rung/checked_by_id/resolves_dispute), readClaimVerification, listClaimsForChecking, readVerificationPortrait, render helpers, all additively re-exported by navigation.cjs
  - phase: 358-02
    provides: writeClaimNode carry-forward fix (checking record survives re-file), Claude Desktop (claude-ai) recognized as a write-enabled tier0 host
provides:
  - "claim_verify extended: required rung (schema enum/description generated from VERIFICATION_RUNGS), server-side checked_by_id via navigation.resolveByUser, resolves_dispute, a description clearing the 120-char floor, and an honest host block + MINDRIAN_MCP_FIRST hint on write_path_disabled"
  - "claim_read (new MCP tool, unconditional read, no write gate): claim view by id or words, claim list, room portrait, plain-text render, the same host block"
  - "tests/test-358-b1-surfaces.cjs -- stub-server legs (schemas, descriptions, Desktop write, unknown-host refusal, claim_read shapes, disputed sticks, review_status unchanged, static/connector/tool-honesty guards) plus a real stdio wire leg as claude-ai"
  - "tests/helpers/b1-358-child.cjs -- cross-process child (write | refile | file-again | read modes)"
  - "tests/test-358-b1-persistence.cjs -- AT2 literal: separate processes and sessions write, re-file, and reopen the record; a new-session re-file's duplicate is visible"
affects: [358-05, 358-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hostBlock(server, ctx): one helper reads server.server.getClientVersion() the same way the write gate already does and returns { client_name, host, host_tier, write_path_enabled } -- the live probe the 6 October runbook uses to learn Cowork's client name, reused by both the write refusal and every claim_read response"
    - "Schema-generated prose: RUNG_DESCRIPTION is built from navigation.VERIFICATION_RUNGS at module load, so the rung field's description and the paper author's eventual rung-list swap stay a one-constant edit, never a second literal"
    - "checked_by_id is never a schema field: it is stamped server-side inside the handler from navigation.resolveByUser(roomDir) only when checked_by !== 'system', so a client can never supply or spoof it (zod strips unknown keys before the handler runs)"
    - "claim_read attaches a single claim view only when listClaimsForChecking's total_matched is exactly 1, so a duplicate claim (Pitfall 3, a new session re-filing the same sentence) is listed but never silently resolved to one view"

key-files:
  created:
    - tests/test-358-b1-surfaces.cjs
    - tests/helpers/b1-358-child.cjs
    - tests/test-358-b1-persistence.cjs
  modified:
    - lib/mcp/tools/claim-verify.cjs

key-decisions:
  - "claim_read is a separate read tool, not a mode on claim_verify (CONTEXT.md Claude's Discretion + RESEARCH Alternatives Considered): a mode would let the write gate block reads on any host where writes are off, and would read as a read branch inside a write tool to the tool-honesty scanner"
  - "hostBlock is computed unconditionally in claim_read (even when the request is a plain successful read) and attached to every response including the claim_not_found refusal, so the Cowork client-name probe works from inside any host state, not just a refusal"
  - "The write_path_disabled refusal carries host plus a hint naming MINDRIAN_MCP_FIRST=desktop,cowork verbatim, matching the demo-machine fallback CONTEXT.md documents, so a Rome operator gets the exact remediation string without cross-referencing the runbook"
  - "claim_verify's pre-existing F.1 connector entry (hitl_shape, hitl_why, layer, layer_why) is kept byte-identical; only its description and schema changed, so data/mcp-tool-connectors.json's claim_verify row needs no regeneration -- only the new claim_read row does (358-05)"

patterns-established:
  - "Cross-process test fixtures live under tests/helpers/, are never a test themselves (no assertions, no exit-code grading beyond ok/error), print exactly one JSON line, and never require another tests/ file -- tests/helpers/b1-358-child.cjs is the first of these in the B1 surface and the pattern any later cross-process B2 test should copy"

requirements-completed: [B1-02, B1-03, B1-04, B1-05, B1-06, B1-07]

# Metrics
duration: ~40min
completed: 2026-09-23
---

# Phase 358 Plan 04: B1 MCP Surface (claim_verify rung + claim_read) Summary

**Extended claim_verify with a required rung, server-stamped checked_by_id and resolves_dispute, and added the new claim_read MCP tool (claim view, list, room portrait, plain-text render, an honest per-call host block), built TDD (RED then GREEN) with the real Claude Desktop identity proven over the actual stdio server and AT2 proven literally with separate OS processes and sessions.**

## Performance

- **Duration:** ~40 min (git-timestamped span across the three task commits, excluding initial PLAN/CONTEXT/RESEARCH/SUMMARY read)
- **Started:** 2026-09-23 (after reading PLAN/CONTEXT/RESEARCH/358-01/02/03-SUMMARY and the live codebase)
- **Completed:** 2026-09-23T18:34:42+03:00
- **Tasks:** 3/3 completed
- **Files modified:** 4 (3 created new, 1 pre-existing extended)

## Accomplishments

- Built `tests/test-358-b1-surfaces.cjs` (87 checks across 11 stub-server legs A1-A11 plus a real stdio wire leg B1): schema shape (rung required and range-checked, resolves_dispute optional boolean, rung description carrying every VERIFICATION_RUNGS label), description-floor and tool-honesty prose shape for both tools, the Desktop (claude-ai) write path end to end, the unknown-host refusal carrying an honest host block and a MINDRIAN_MCP_FIRST hint, claim_read's claim/list/portrait shapes (never a score, never the word "verified"), the disputed-sticks rules (a plain supports after a contradicts stays disputed; a system-checked resolution is refused; a person-resolved supports clears it), review_status/confidence byte-identical across every claim_verify call, static substrate guards (no confirmNode/promoteNodeStatus/brain/raw sqlite, no hard-coded enum fallback), the two connectors entries, and a `check-tool-honesty.cjs` `scanAll()` verdict check -- then a genuine JSON-RPC drive of `bin/mindrian-mcp-server.cjs` as `clientInfo.name: 'claude-ai'` (the real Claude Desktop identity) proving `claim_write` -> `claim_verify` -> `claim_read` -> `status_read` all work with no `MINDRIAN_MCP_FIRST` override.
- Extended `lib/mcp/tools/claim-verify.cjs`: removed the hard-coded enum fallback arrays (every enum now comes straight from `navigation.VERIFICATION_AGAINST_KINDS` / `VERIFICATION_METHODS` / `VERIFICATION_RESULTS`, always exported since 358-01); added `rung` (required, range-validated, description generated from `VERIFICATION_RUNGS`) and `resolves_dispute` (optional boolean) to the `claim_verify` schema; lengthened its description past the 120-character floor while keeping it honest about writing (no `NEGATION_PATTERNS` phrase) and mentioning `review_status` and `gate_answer`; added the `hostBlock(server, ctx)` helper (the live client-name probe the Rome runbook needs); changed the `write_path_disabled` refusal to carry `host` plus a hint naming the `MINDRIAN_MCP_FIRST=desktop,cowork` demo-machine fallback; stamped `checked_by_id` server-side from `navigation.resolveByUser(roomDir)` whenever `checked_by !== 'system'` (never a schema field, so a client can never supply it); on success, reads the claim view back through `navigation.readClaimVerification` and returns it alongside the raw `verification` object and its rendered text.
- Added the new `claim_read` tool in the same file, registered right after `claim_verify`, with no write gate (an unconditional read, the same pattern `graph_query` and `room_search` already use): reopens a claim by id or by words, lists claims (limit 1-100, newest first), always returns the room portrait and the rendered portrait text, attaches a single claim view only when exactly one claim matches, and carries the same `hostBlock` on every response including the `claim_not_found` refusal. Its description ends with the recognized "This tool writes nothing." disclaimer and never claims the word "verified".
- Updated the `connectors` export: `claim_verify`'s pre-existing F.1 entry stays byte-identical (only its description and schema changed); `claim_read` is born wired in the same commit with `hitl_shape: 'none'`, `layer: 'harness'`, and non-empty `hitl_why`/`layer_why`.
- Built `tests/helpers/b1-358-child.cjs` (a cross-process test fixture, never a test itself, never requiring another `tests/` file): four modes (`write`, `refile`, `file-again`, `read`), each registering its own tools fresh under a stubbed `claude-ai` identity and printing exactly one JSON line.
- Built `tests/test-358-b1-persistence.cjs` (23 checks): AT2 proven literally with five separate `cp.spawnSync` child processes -- write in session S1, re-file in session S1 (same process boundary, same node id, checking record intact), read in a brand-new process and session S2 (the full record: against, rung + rung_label, method, result, checked_by, a parseable checked_at, checked_by_id; `review_status: proposed`; `portrait.claims_disputed: 1`), a direct re-open of `room.db` in the parent process after every child has exited (never trusting a child's own success claim), then a `file-again` in session S2 (a new session re-filing the same sentence mints a NEW claim id, per Pitfall 3) and a read in session S3 showing BOTH claims (A still disputed, B unchecked, no single-claim view attached since there are two matches) -- the duplicate is visible, never silently hidden.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - MCP surfaces test (stub server legs + real stdio wire leg as claude-ai)** - `24f383220` (test)
2. **Task 2: GREEN - extend claim_verify and add claim_read in lib/mcp/tools/claim-verify.cjs** - `13dc76952` (feat)
3. **Task 3: AT2 literal - separate processes and sessions write, re-file and reopen the record** - `524bca631` (test)

_TDD plan: RED then GREEN for Task 1/2 (the MCP surface); Task 3 is a standalone `type="auto"` task (no RED/GREEN split named in the plan) and its own first run was green (23/23) against the Task 2 implementation already in the tree._

## Files Created/Modified

- `tests/test-358-b1-surfaces.cjs` - RED-first (32 passed / 29 failed before Task 2, exit 1), GREEN after (87 passed / 0 failed, exit 0). Stub legs A1-A11 plus wire leg B1 exactly as the plan's `<behavior>` list names them.
- `lib/mcp/tools/claim-verify.cjs` - `hostBlock` helper; `RUNG_DESCRIPTION` generated from `navigation.VERIFICATION_RUNGS`; `claim_verify` schema gains `rung` (required) and `resolves_dispute` (optional); `claim_verify` description lengthened and honest; `write_path_disabled` refusal carries `host` + hint; `checked_by_id` stamped server-side; response includes the claim view and its rendered text; new `claim_read` tool (claim view / list / portrait / rendered / rungs / note / host); `connectors` gains the `claim_read` entry, `claim_verify`'s entry unchanged.
- `tests/helpers/b1-358-child.cjs` - cross-process fixture, four modes, one JSON line per invocation, zero `tests/` requires.
- `tests/test-358-b1-persistence.cjs` - 23 checks, 5 `spawnSync` child invocations, AT2 literal end to end plus the direct-disk re-check and the visible-duplicate case.

## Decisions Made

- `claim_read`'s single-claim attach rule is keyed on `listClaimsForChecking`'s `total_matched === 1`, not on `claims.length === 1` after a limit clamp, so the rule is correct even when a future caller lowers `limit` below the true match count.
- `hostBlock` is computed once per call inside each handler (not memoized across calls) because `server.server.getClientVersion()` can answer differently across the lifetime of a stub in the test harness (A5's identity-switching legs depend on this), matching how the real MCP SDK's `getClientVersion()` is itself a live read, not a boot-time snapshot.
- The persistence test's step 4 (direct `room.db` re-open in the parent process) is placed AFTER the child processes have already exited and been asserted on, so it independently corroborates rather than substitutes for the cross-process proof in steps 1-3.

## Deviations from Plan

None. All three tasks match the plan's `<action>` steps as written:

- Task 1's harness (registerAndCapture with a mutable `getClientVersion`, the promise-based JSON-RPC client for the wire leg, the exact stub legs A1-A11 and wire leg B1) follows the plan's `<action>` description precisely; the RED run correctly failed only the claim_read/rung/description/checked_by_id-dependent legs (32 passed, 29 failed) exactly as the plan predicted, with every other leg (Desktop write via the pre-358-04 code path, connector presence for `claim_verify`, the static no-Brain/no-raw-sqlite guard, the wire leg's `claim_write`/`claim_verify` calls, `status_read`'s capability floor) already green because 358-01/02 had already shipped their halves.
- Task 2's GREEN implementation follows the plan's five numbered steps in order (header comment, enum-fallback removal + `RUNG_DESCRIPTION`, `claim_verify` schema/description/refusal/checked_by_id/response, the new `claim_read` tool, the `connectors` update) and turned every named verification command green on the first GREEN run (`test-358-b1-surfaces.cjs`, `test-234-tool-description-floor.cjs`, `check-tool-honesty.cjs --check`, the `scanAll()` verdict check, the static enum-fallback and confirmNode/brain/sqlite greps, the `register-core-tools.cjs`/`tool-router.cjs`/`status.cjs`/`data/` no-diff check, and the `test-358-b1-core.cjs` / `test-358-b1-cli.cjs` / `test-276-claim-write-primitive.cjs` regression trio).
- Task 3's cross-process helper and persistence test match the plan's exact mode names (`write | refile | file-again | read`), assertion sequence (1-5), and acceptance greps (`spawnSync` >= 3 measured 5, `require(.*tests/` = 0, `file-again` >= 1 measured 5) on the first run (23/23 passed).

## Issues Encountered

None blocking. No auth gates (the wire leg IS the auth-gate proof itself: the Desktop identity `claude-ai` succeeds with no `MINDRIAN_MCP_FIRST` override, per 358-02's host-tier fix already in the tree). No file collisions: `git status --short -- lib/mcp/tools/claim-verify.cjs` was clean before Task 2's edit, and the plan's forbidden-file list (`register-core-tools.cjs`, `tool-router.cjs`, `status.cjs`, `dual-path.cjs`, `sensors.cjs`, `views.cjs`, `gate.cjs`, `data/*.json`, `CLAUDE.md`, `lib/mcp/runtime-instructions.cjs`) was untouched throughout, confirmed by the `git diff $PLAN_BASE --stat` check in Task 2's own acceptance criteria.

## Verification Evidence

All commands from the plan's `<verify>` blocks and its top-level `<verification>` section were run and are green as of the final commit (except the two named, expected-red items):

```
node tests/test-358-b1-surfaces.cjs            -> 87 passed, 0 failed (exit 0)
node tests/test-358-b1-persistence.cjs         -> 23 passed, 0 failed (exit 0)
node tests/test-234-tool-description-floor.cjs -> 180 passed, 0 failed (exit 0; red since 42191a6ae, green now)
node scripts/check-tool-honesty.cjs --check    -> OK (39 tools, 133 branches, 0 high-risk)
node scripts/check-cirs-declaration.cjs --check 358-04-PLAN.md -> OK (1 plan)
node tests/test-358-b1-core.cjs                -> 18 passed, 0 failed (no regression)
node tests/test-358-b1-cli.cjs                 -> 28 passed, 0 failed (no regression)
node tests/test-276-claim-write-primitive.cjs  -> 44 passed, 0 failed (no regression)
bash tests/run-all-358.sh                      -> PASSED=22 FAILED=3 SKIPPED=1 on the mid-plan run
                                                   (new-session persistence leg still SKIPPED before
                                                   Task 3 landed the file); after Task 3, the SAME leg
                                                   is PASSED and SKIPPED count drops to 0
```

Acceptance-criteria checks (all satisfied):
- `grep -c "claude-ai" tests/test-358-b1-surfaces.cjs` = 14 (>= 2 required); `grep -c "mindrian-mcp-server.cjs"` = 2 (>= 1); `grep -c "write_path_disabled"` = 3 (>= 1); `grep -c "scanAll"` = 4 (>= 1); em-dash count = 0.
- `node tests/test-358-b1-surfaces.cjs` exits 0 (stub legs and the stdio wire leg).
- `node -e "...scanAll() rows for claim_verify/claim_read all OK..."` exits 0.
- `grep -v '^\s*//' lib/mcp/tools/claim-verify.cjs | grep -cE "confirmNode|promoteNodeStatus|brain|node:sqlite|DatabaseSync"` = 0.
- `grep -cE "'compare'|'observe'|'supports'|'contradicts'" lib/mcp/tools/claim-verify.cjs` = 0 (enum fallbacks removed).
- `git diff <PLAN_BASE> --stat -- lib/mcp/register-core-tools.cjs lib/mcp/tool-router.cjs lib/mcp/tools/status.cjs data/` shows no change made by this plan.
- `grep -c "spawnSync" tests/test-358-b1-persistence.cjs` = 5 (>= 3); `grep -c "require(.*tests/" tests/helpers/b1-358-child.cjs` = 0; `grep -c "file-again" tests/test-358-b1-persistence.cjs` = 5 (>= 1).
- No em-dashes in any of the 4 files touched by this plan.

**Named transient drift (expected until 358-05, per the plan's own `<objective>` paragraph):**
- `node scripts/build-connector-registry.cjs --check` reports `data/connector-registry.json is STALE` and `data/mcp-tool-connectors.json is STALE`. Confirmed by direct inspection: both generated files still contain only `mcp:claim_verify`, never `mcp:claim_read` (`grep -n "claim_read\|claim_verify" data/mcp-tool-connectors.json data/connector-registry.json` shows exactly one hit each, both `claim_verify`). This is the single named drift the plan's `<objective>` predicts; 358-05 regenerates both files.
- `node tests/test-270-tool-schema-budget.cjs`: 3 passed, 2 failed (`measured=42 after=40`, `delta=17.03%` over the 10% tolerance) -- the expected budget drift from adding one new tool with a full-length description.
- `node tests/test-270-connector-coverage.cjs`: 5 passed, 1 failed (`missing: claim_read` -- the same registry drift, seen from the coverage test's own angle).
- `node tests/test-276-tool-honesty-findings-closed.cjs`: 146 passed, 2 failed (`ledger frozen_sweep.tools=37 vs live=39`, `branches=131 vs live=133` -- exactly +1 tool / +2 branches, matching `claim_read`'s addition; the ledger needs re-freezing, owned by 358-05).

## Threat Model Coverage

All six threats in the plan's STRIDE register (T-358-17 through T-358-22) are mitigated exactly as declared:

- **T-358-17** (Tampering, claim_verify arguments): the zod schema at the boundary closes `rung` to an integer 1..`VERIFICATION_RUNGS.length`, `against_kind`/`method`/`result` to their navigation-sourced enums (no hard-coded fallback), and every string field to its length cap; `recordClaimVerification`'s own fail-closed validation runs beneath it. Proven by A2's schema-rejection legs.
- **T-358-18** (Elevation of privilege, self-confirmation): the static substrate guard (A10) proves neither `claim_verify` nor `claim_read` calls `confirmNode`, `promoteNodeStatus`, or any gate code; `resolves_dispute` is refused (`resolution_requires_person`) whenever `checked_by !== 'user'` (A8); `review_status`/`confidence` are proven byte-identical across every `claim_verify` call in A4 and A8, and independently re-verified from disk in the persistence test's step 4.
- **T-358-19** (Spoofing, `checked_by_id`): stamped server-side from `navigation.resolveByUser(roomDir)`, never a schema field, so a client-supplied `checked_by_id` is stripped by zod before the handler ever sees it. Proven by A4's `checked_by_id equals navigation.resolveByUser(room)` check and by the persistence test's cross-process record read.
- **T-358-20** (Information disclosure, `claim_read` returning room content, accepted): `claim_read` reaches only the local MCP client bound to this room (same trust boundary as `graph_query`/`room_search`); the static guard also confirms no Brain/network import in the file.
- **T-358-21** (Denial of service, large claim lists): `limit` is capped at 100 and `query` at 200 characters by the schema (A7's `limit 0`/`limit 101` rejection legs); one `SELECT` per call (unchanged from 358-01's `listClaimsForChecking`).
- **T-358-22** (Spoofing, a client claiming `claude-ai`, accepted per the 2026-09-23 ruling): writes still land `proposed` through `navigation.recordClaimVerification`'s own validation; the A5 leg proves an unrecognized host is refused with an honest, actionable `host` block instead of a silent allow or a silent deny.

No new trust boundaries beyond what the plan's threat register already covers were introduced. No `## Threat Flags` section is needed.

## Known Stubs

None. `claim_verify` and `claim_read` both have real, tested implementations reading and writing through `lib/core/navigation.cjs`; nothing renders a placeholder, a hardcoded empty value, or aspirational text. `tests/helpers/b1-358-child.cjs` is a genuine cross-process fixture (not a stub) whose four modes each exercise the real MCP tool handlers.

## Next Steps

- 358-05 regenerates `data/mcp-tool-connectors.json` and `data/connector-registry.json` (adding the `mcp:claim_read` row this plan's own commit deliberately left unregenerated), re-baselines `tests/test-270-tool-schema-budget.cjs`'s `AFTER` constant with the measured numbers named in that commit, and re-freezes `tests/fixtures/tool-honesty/276-dispositions.json`'s `frozen_sweep` (37/131 -> 39/133) with a `refrozen_at` entry.
- 358-06 writes the operator go/no-go runbook (`docs/2026-10-06-ROME-B1-GO-NO-GO.md`), which should cite this plan's wire-leg proof (real `claude-ai` identity, no `MINDRIAN_MCP_FIRST` override needed on Desktop) and the still-open Cowork client-name probe (`hostBlock`'s `client_name` field is exactly the live-probe mechanism the runbook needs).

## Self-Check: PASSED

- FOUND: `tests/test-358-b1-surfaces.cjs`
- FOUND: `tests/helpers/b1-358-child.cjs`
- FOUND: `tests/test-358-b1-persistence.cjs`
- FOUND: `lib/mcp/tools/claim-verify.cjs` (modified)
- FOUND: `.planning/phases/358-rome-b1-checking-record-and-b2-frame-provenance-user-visible/358-04-SUMMARY.md`
- FOUND commit `24f383220` (test: RED, Task 1)
- FOUND commit `13dc76952` (feat: GREEN, Task 2)
- FOUND commit `524bca631` (test: Task 3, AT2 literal)
