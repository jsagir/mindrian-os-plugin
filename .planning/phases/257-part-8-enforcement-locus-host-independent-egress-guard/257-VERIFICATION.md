---
phase: 257-part-8-enforcement-locus-host-independent-egress-guard
verified: 2026-09-03T07:27:42Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 257: Part 8 enforcement locus (host-independent egress guard) Verification Report

**Phase Goal:** Make the already-shipped Part 8 guard's verdict VISIBLE and CORRECTLY CLASSIFIED at
the model-facing surface, lock it with a wire-level structural invariant, and rule explicitly on the
one surface that genuinely has no local belt (P3: client CLI direct HTTP + Desktop + Cowork).
**Verified:** 2026-09-03T07:27:42Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is goal-backward, code-first verification. Every claim below was independently re-derived
against the working tree at `git rev-parse HEAD` = `1559556c` (main), not copied from
SUMMARY.md/COMPLIANCE.md prose. Every test suite cited was re-run live in this session; every file
cited was opened and grepped directly; every commit cited was inspected with `git show`.

## Goal Achievement

### Observable Truths (LOCUS-01 .. LOCUS-10)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| LOCUS-01 | `brain_ask` renders `egress_blocked` as a typed refusal, not a well-formed empty envelope | VERIFIED | `lib/core/refusal-messaging.cjs:202` adds `egress_blocked` as 6th `REFUSAL_KINDS` member with `BRAIN_EGRESS_BLOCKED` status. `bin/mindrian-brain-mcp-client.cjs:190-191` branches on `raw.error === 'egress_blocked'` and calls `refusalResponse('egress_blocked', ...)`. Live-wire proof: `node tests/test-257-shim-honest-refusal.cjs` Arm 1/2/3/5 all `ok` (re-run this session). |
| LOCUS-02 | `egress_disclosure` survives to the `brain_ask` model-facing response (COMP-02 non-vacuous) | VERIFIED | `lib/core/directive-envelope.cjs:201-207` — `wrapDirective()` additively copies `egress_disclosure` and `refusal` from `brainResponse`, previously a fixed 7-key builder that dropped both. `node tests/test-257-envelope-passthrough.cjs` — re-run this session as part of `run-all-257.sh`, PASSED. |
| LOCUS-03 | Every live-advertised Brain tool proven on the wire to leak zero bytes, with honest refusal + ambiguous-proceeds-and-discloses | VERIFIED | `tests/test-257-brain-tool-egress-invariant.cjs` (499 lines) spawns the real `bin/mindrian-brain-mcp-client.cjs` and derives the tool list from a live `tools/list` (Arm 1b/1c prove bidirectional reconciliation, not a frozen array). Re-run directly this session: 11/11 arms `ok`, including Arm 7a/7b self-check mutation legs proving the test can actually fail. |
| LOCUS-04 | The false census parenthetical is corrected + the handoff carries an append-only dated correction | VERIFIED | `lib/mcp/brain-composition-census.cjs` diff is comment-only (confirmed: `test-254-composition-census.cjs` Arm 3 "no `lib/mcp/` file opens its own wire" unchanged, re-run this session, 9/0). `docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md` grew +63 lines (correction block), original text intact (append-only, not deleted). |
| LOCUS-05 | The far-side ruling (D-01) documented, both pragmatic and principled halves | VERIFIED | `docs/257-NOTE-part8-enforcement-locus-rulings.md` Section 1 (250 lines total) — read in full: dead-service evidence table + the RECEIPT-vs-USE structural argument, both present and substantive, not a stub. |
| LOCUS-06 | The direct-HTTP gap (D-02) documented with four-path coverage table + open RCA cited by filename | VERIFIED | `docs/257-NOTE-part8-enforcement-locus-rulings.md` (via `257-COMPLIANCE.md` Section B, reproduced from the note) names P1/P2 covered, P3/P4 not covered, cites `.planning/debug/part8-egress-guard-blocks-pws-brain-mcp-unconditionally.md` by filename without investigating it. |
| LOCUS-07 | All six Brain tools reject undeclared keys before any handler runs | VERIFIED | `bin/mindrian-brain-mcp-client.cjs` — all six `server.registerTool()` calls use `z.strictObject(...)` (grepped directly, lines 148-291). `node tests/test-257-strict-input-shapes.cjs` re-run this session: Arm A (rejection on the wire, all 6 tools) + Arm B (zero outbound capture-server requests) + Arm G (mutation leg: pre-migration registration does NOT reject) all `ok`. |
| LOCUS-08 | Baseline honesty: both frozen-literal 239 arms de-frozen, pre/post counts both recorded | VERIFIED | `tests/test-239-brain-tool-liveness.cjs` and `tests/test-239-verify-release-section-18.cjs` both grep `hooks.json` at run time (confirmed present in diff). `bash tests/run-all-239.sh` re-run this session: 9 passed / 0 failed (was 7/2 per `257-BASELINE.md`, delta explicitly stated in `257-COMPLIANCE.md`). |
| LOCUS-09 | Theo forward-compat note (D-08) covering T-1/T-2/T-3 | VERIFIED | `docs/257-NOTE-theo-forward-compat-enforcement-locus.md` (175 lines) — read in full, all three items present with concrete reasoning, not placeholders. |
| LOCUS-10 | Canon Part 8 PR gate discharged: automated leg + human Canon Custodian sign-off | VERIFIED | Automated leg independently re-run this session (Class O PASS, `run-all-257.sh` 8/0, `run-all-239.sh` 9/0, `check-substrate.cjs --diff` clean). Human leg: `257-09-SUMMARY.md` "Task 3: Canon Custodian sign-off (RESOLVED)" records navigator (Jonathan Sagir) reply "approve" 2026-09-03; `.planning/REQUIREMENTS.md` LOCUS-10 row is `[x]` with the sign-off sentence appended (commit `103a576c`, verified via `git log`). |

**Score:** 10/10 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/refusal-messaging.cjs` | `egress_blocked` as 6th kind, own status/reason/next-moves/render tables | VERIFIED | 525 lines, min_lines 60 n/a (existing file); `egress_blocked` present at 7 distinct sites incl. `REASONS`, `RENDER_COPY`, `renderRefusal()` switch |
| `lib/core/doctor/class-m-brain-smoke.cjs` | `BRAIN_EGRESS_BLOCKED` in `STRUCTURED_REFUSAL_STATUSES` | VERIFIED | Confirmed present, line 110 |
| `lib/core/directive-envelope.cjs` | additive `egress_disclosure`/`refusal` pass-through in `wrapDirective()` | VERIFIED | 217 lines; `_copyIfPlainObject` used for both fields, additive not destructive |
| `lib/mcp/brain-composition-census.cjs` | corrected Seam A comment, "Phase 257" cited | VERIFIED | 184 lines, comment-only diff, `Phase 257` present |
| `docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md` | append-only dated `CORRECTION` block | VERIFIED | 211 lines, `CORRECTION` present, original text intact |
| `docs/257-NOTE-part8-enforcement-locus-rulings.md` | D-01/D-02 rulings, 4-path table, D-05 flag | VERIFIED | 250 lines (min 90) |
| `docs/257-NOTE-theo-forward-compat-enforcement-locus.md` | T-1/T-2/T-3 | VERIFIED | 175 lines (min 60) |
| `bin/mindrian-brain-mcp-client.cjs` | `honestRefusal()` helper, `egress_blocked` branch, `registerTool`+`z.strictObject` for all 6 tools | VERIFIED | 304 lines; all patterns present and wired (grepped directly) |
| `tests/test-257-refusal-egress-kind.cjs` | Arms for shape/status/no-echo | VERIFIED | 159 lines (min 60); part of `run-all-257.sh`, PASSED |
| `tests/test-257-envelope-passthrough.cjs` | Arms for survival/byte-identical/no-laundering | VERIFIED | 180 lines (min 70); PASSED |
| `tests/test-257-shim-honest-refusal.cjs` | G1/G3 wire proof + block-vs-outage arms | VERIFIED | 439 lines (min 90); 8 arms `ok`, re-run directly |
| `tests/test-257-brain-tool-egress-invariant.cjs` | Locked structural invariant, live spawn, derived tool list | VERIFIED | 499 lines (min 140); 11 arms `ok`, re-run directly, includes self-check mutation arms |
| `tests/run-all-257.sh` | Phase aggregator | VERIFIED | 125 lines (min 40); re-run directly, 8/0/0 |
| `tests/test-257-strict-input-shapes.cjs` | Undeclared-key rejection + catalog parity | VERIFIED | 559 lines (min 90); re-run directly, all arms `ok` |
| `.planning/phases/257.../257-COMPLIANCE.md` | Part 8 PR gate discharge record | VERIFIED | 506 lines (min 60); every command cited was independently re-run this session and matched |
| `.planning/REQUIREMENTS.md` | LOCUS-01..10 rows | VERIFIED | All 10 present, all `[x]`, no orphaned Phase 257 IDs found via `grep "Phase 257"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/core/refusal-messaging.cjs` | `lib/core/doctor/class-m-brain-smoke.cjs` | `STRUCTURED_REFUSAL_STATUSES` contains `BRAIN_EGRESS_BLOCKED` | WIRED | Grepped both files directly |
| `lib/core/brain-client.cjs` | `lib/core/directive-envelope.cjs` | `egress_disclosure` field survives `wrapDirective()` | WIRED | Confirmed by code read + `test-257-envelope-passthrough.cjs` PASS |
| `bin/mindrian-brain-mcp-client.cjs` | `lib/core/refusal-messaging.cjs` | `refusalResponse('egress_blocked', ...)` | WIRED | Line 191, live-tested |
| `bin/mindrian-brain-mcp-client.cjs` | `lib/core/directive-envelope.cjs` | refusal object survives to `wrapDirective()` output | WIRED | `test-257-shim-honest-refusal.cjs` Arm 1 proves it on the wire |
| `tests/test-257-brain-tool-egress-invariant.cjs` | `bin/mindrian-brain-mcp-client.cjs` | spawned as real child process, driven over stdio JSON-RPC | WIRED | Re-run directly, confirmed real spawn (hygiene line: "1 shim process(es) spawned this run, none still alive after cleanup") |
| `bin/mindrian-brain-mcp-client.cjs` | `@modelcontextprotocol/sdk` | `registerTool` with `z.strictObject` inputSchema | WIRED | Confirmed on all 6 registrations; SDK/zod pins (1.29.0 / 3.25.76) match `package.json` |
| `.planning/phases/257.../257-COMPLIANCE.md` | `.planning/phases/257.../257-BASELINE.md` | every suite result stated against recorded pre-change value | WIRED | Confirmed: 239 (7/2 → 9/0), 234 (8/3 unchanged), doctor Class O (unchanged PASS) |

### Behavioral Spot-Checks (live re-run this session, not copied from SUMMARY)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase's own aggregator green | `bash tests/run-all-257.sh` | Passed 8 Failed 0 Skipped 0 | PASS |
| 239 baseline delta honest | `bash tests/run-all-239.sh` | Passed 9 Failed 0 (was 7/2) | PASS |
| Phase 250 regression lock (post CR-01 fix) | `node tests/test-250-refusal-shapes.cjs` | 7 passed, 0 failed (was 6/1 before fix per REVIEW.md) | PASS |
| `run-all-250.sh` full suite | `bash tests/run-all-250.sh` | PASS=8 FAIL=0 SKIP=0 | PASS |
| Phase 127-00 shim regression lock (post Addendum-2 fix) | `node --test lib/core/mindrian-brain-shim.test.cjs` | 6/6 subtests ok, 1 pass / 0 fail | PASS |
| Phase 127-00 shim regression, its consumer | `node --test lib/core/refusal-messaging.test.cjs` | 8/8 subtests ok, 1 pass / 0 fail | PASS |
| `run-all-127.sh` full sweep | `bash tests/run-all-127.sh` | 13 passed / 3 failed (matches claimed; remaining 3 = pre-existing GraphRAG fixture gap, none reference phase-257-touched modules) | PASS (as claimed) |
| `run-all-266.sh` unaffected | `bash tests/run-all-266.sh` | PASS=9 FAIL=0 | PASS |
| `run-all-259.sh` unaffected | `bash tests/run-all-259.sh` | PASS=5 FAIL=0 | PASS |
| `run-all-234.sh` baseline unchanged | `bash tests/run-all-234.sh` | PASS=8 FAIL=3 (matches recorded pre-existing baseline, none of the 3 failures touch phase-257 files) | PASS (as claimed) |
| Doctor acceptance Class O | `node scripts/doctor.cjs --acceptance` | Class O `agentshield-all-surfaces-clean` PASS. (16/18 overall this run — see Anti-Patterns/Process Findings below for the 2 unrelated fails) | PASS (load-bearing row) |
| Substrate diff clean | `node scripts/check-substrate.cjs --diff` | Exit 0, no output | PASS |
| Post-approval CR-01 fix commit is real, narrowly scoped | `git show f2665848` | Test-only change, matches described root cause | PASS |
| Post-approval Addendum-2 fix commit is real, narrowly scoped | `git show 1559556c` | Test-only change + 1-line narrow regex exemption in `check-schema-aliases.cjs`, matches described root cause | PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| LOCUS-01 | 257-01, 257-06 | SATISFIED | See truths table |
| LOCUS-02 | 257-02, 257-06 | SATISFIED | See truths table |
| LOCUS-03 | 257-07 | SATISFIED | See truths table |
| LOCUS-04 | 257-03 | SATISFIED | See truths table |
| LOCUS-05 | 257-04 | SATISFIED | See truths table |
| LOCUS-06 | 257-04 | SATISFIED | See truths table |
| LOCUS-07 | 257-08 | SATISFIED | See truths table |
| LOCUS-08 | 257-05 | SATISFIED | See truths table |
| LOCUS-09 | 257-04 | SATISFIED | See truths table |
| LOCUS-10 | 257-09 | SATISFIED | See truths table |

No orphaned Phase 257 requirements found (`grep "Phase 257" REQUIREMENTS.md` returns only the
header/traceability lines, all ten LOCUS IDs accounted for in plan `requirements:` frontmatter with
no gaps: 01→[257-01,257-06], 02→[257-02,257-06], 03→[257-07], 04→[257-03], 05,06,09→[257-04],
07→[257-08], 08→[257-05], 10→[257-09]).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in any of the 17 phase-touched files | — | None found (grepped directly) |
| `bin/mindrian-brain-mcp-client.cjs:66` | 66 | Dead `pluginRoot` variable (WR-03, pre-existing, not introduced by this phase) | INFO | Cosmetic, no functional impact |
| `lib/core/directive-envelope.cjs:129-140` | — | `_copyIfPlainObject` docstring overstates safety for array-valued sub-fields (WR-01, code review) | WARNING | Low practical severity — confirmed `next_moves` only ever carries closed-enum handles, never user content; every call site builds a fresh object. Not fixed this phase, correctly flagged as future hardening in REVIEW.md, not a Part 8 breach. |
| `bin/mindrian-brain-mcp-client.cjs:217-232` | — | `brain_query` still reports a Part 8 block as `unreachable`, not `egress_blocked` (G2/WR-02) | WARNING (accepted, ruled) | Explicitly ratified deferral (D-05); pinned by 2 tests as `unreachable_known_gap`, not fixed. Correctly documented, not silently hidden. |
| `.planning/ROADMAP.md` (Phase 257 section) | ~56, ~230 | Stale status text: "Plans: 8/9 plans executed; 257-09 Tasks 1-2 of 3 complete... Task 3... pending navigator review" and `257-09-PLAN.md` checkbox still `[ ]`, even though Task 3 was resolved (navigator approved 2026-09-03, `.planning/REQUIREMENTS.md` LOCUS-10 flipped `[x]` in commit `103a576c`) | WARNING | `git log` confirms commit `6fbb9898` (which updated ROADMAP.md) landed BEFORE commit `103a576c` (which recorded the Task 3 resolution and only touched REQUIREMENTS.md/257-09-SUMMARY.md). `257-09-SUMMARY.md`'s own self-check claims "`.planning/ROADMAP.md` -- FOUND, Phase 257 Plans line and Wave 5 entry updated" — this claim is now stale relative to the file's actual current content. `node .../gsd-tools.cjs query roadmap.get-phase 257` currently returns the stale text verbatim. Does not affect shipped functionality or requirement traceability (REQUIREMENTS.md is authoritative and correct), but is a real process/documentation gap a future session reading ROADMAP.md would be misled by. Recommend: a small follow-up edit to ROADMAP.md's Phase 257 "Plans:" status line and the `257-09-PLAN.md` checkbox/Wave-5 note, to state Task 3 RESOLVED and the phase COMPLETE. |

### Post-Approval Fixes: In-Scope Quality-Gate Work, Not Scope Creep

Two regressions were found and fixed after the Canon Custodian's "approve" (2026-09-03):

1. **CR-01** (code review, commit `f2665848`): Plan 06's `honestRefusal()` DRY refactor broke
   `tests/test-250-refusal-shapes.cjs` Test 7, which counted literal `refusalResponse('unreachable'`
   occurrences instead of checking the real invariant. Fix rewrote the test to check behavior, not
   text; two mutation legs verified the fixed test still catches real regressions; **no production
   code changed**.
2. **Addendum 2** (orchestrator regression_gate, commit `1559556c`): the identical bug class in a
   different prior phase (127-00's `mindrian-brain-shim.test.cjs` Test 2, counting literal
   `server.tool('brain_X'` occurrences broken by Plan 08's legitimate `registerTool()` migration).
   Same fix shape (match either API name, verify the real invariant), same mutation-leg discipline.
   Also widened `ALLOWED_SENDPACKET_FILES` by one narrow single-file regex to fix an unrelated
   pre-existing lexical false-positive in the D-08 `check-sendpacket` pre-commit hook (audited all
   274 tracked `*.test.cjs` files before widening; confirmed this was the only file needing it).
   **No production code changed** except this one narrow, security-preserving exemption addition.

**Assessment: both are legitimate in-scope quality-gate work, not scope creep.** Neither fix changes
what the phase's own deliverable does (the `egress_blocked` honesty fix, the strict-schema
migration, the invariant test); both fixes only repair pre-existing regression-lock tests that
encoded an implementation detail instead of the behavioral invariant they were meant to protect —
exactly the failure mode this phase's D-06/LOCUS-03 test (`test-257-brain-tool-egress-invariant.cjs`)
was built to prevent from recurring. The Canon Custodian's approval covered the diff surface, the
four-path coverage claim, and the two D-01/D-02 rulings "as stated" — none of which either fix
touches (both fixes are entirely inside `tests/` plus one narrow allow-list regex, zero touch to
`bin/mindrian-brain-mcp-client.cjs`, `lib/core/refusal-messaging.cjs`, or
`lib/core/directive-envelope.cjs`). Re-opening the checkpoint for a test-only regression repair
would be process theater, not real risk management; both fixes are independently re-verified in
this report (see Behavioral Spot-Checks table). Recorded honestly in `257-COMPLIANCE.md`'s two
addenda, which is itself evidence of the phase's own honesty discipline (D-10) being applied to
its own compliance record, not just to the code.

### Human Verification Required

None. The phase's one blocking human-verify checkpoint (Task 3, Canon Custodian sign-off) already
resolved 2026-09-03 with the navigator's "approve," independently confirmed present in
`.planning/REQUIREMENTS.md` (LOCUS-10 row, commit `103a576c`) and `257-09-SUMMARY.md`.

### Gaps Summary

No BLOCKER-level gaps. All 10 LOCUS truths independently verified against the live codebase (not
copied from SUMMARY.md), every cited test suite was re-run in this session and matched the claimed
results byte-for-byte (including the two post-approval regression fixes), every artifact exists,
is substantive, and is wired. Requirement traceability is clean: all ten LOCUS-01..10 IDs are
declared across the nine plans with no orphans and all resolve `[x]` in REQUIREMENTS.md.

One WARNING-level process finding: `.planning/ROADMAP.md`'s Phase 257 section carries stale status
text (Plans line + Wave 5 entry) that still describes Task 3 as pending, even though it resolved
after the last ROADMAP.md edit. This does not affect the shipped code, the requirement ledger, or
the Canon Custodian sign-off record — all of which are correct and independently confirmed — but it
is a real inconsistency a future session reading `roadmap.get-phase 257` would see and should be
corrected with a small follow-up edit before the next phase's planning session reads this roadmap
section as context.

Three further code-review WARNINGs (WR-01 shallow-copy overstatement, WR-02 the G2 `brain_query`
gap) and one INFO item (WR-03 dead `pluginRoot`) are pre-existing, already-documented,
correctly-scoped-out or low-severity findings — not phase-blocking, consistent with REVIEW.md's own
"issues_found" classification which never named them as required-before-merge.

---

_Verified: 2026-09-03T07:27:42Z_
_Verifier: Claude (gsd-verifier)_
