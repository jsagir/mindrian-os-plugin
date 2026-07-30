---
phase: 239-brain-access-surface
verified: 2026-07-30T13:05:30Z
status: passed
score: 3/3 roadmap success criteria verified (7/7 plan-declared must-haves independently confirmed)
overrides_applied: 0
---

# Phase 239: Brain-Access Surface Verification Report

**Phase Goal:** The Part-8 boundary's enforcement matches its doctrine: the egress guard and
PII sanitizer cover the live Brain tool names and the `query()` door user content actually
walks through, and the unused `sendPacket` door gets an explicit fate instead of silent limbo.

**Verified:** 2026-07-30T13:05:30Z
**Status:** passed
**Re-verification:** No -- initial verification

All commands below were re-run independently in this session, in this working tree
(`/home/jsagi/dev/MindrianOS-Plugin`, branch `main`, commit `1b53777e`), not copied from any
executor's or orchestrator's self-report. Two of the three success criteria were additionally
put through a hand-run mutation not documented as "already performed" anywhere in the
SUMMARYs, specifically to falsify the SUMMARY narrative rather than restate it (see Mutation
Proofs section). Every mutation was reverted and confirmed byte-identical to its pre-mutation
state before this report was written; `git status --porcelain` on every touched file is empty.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: seam-liveness helper over the Part-8 egress guard + PII sanitizer hook matchers against LIVE Brain tool names comes back green, and a mutation renaming a live tool (or staling a matcher) turns it red. | VERIFIED | `bash tests/run-all-239.sh` -> `Passed: 9  Failed: 0  Skipped: 0` (re-run twice, identical). Independently re-ran `node scripts/check-brain-tool-liveness.cjs` -> exit 0, real stdio handshake enumerates 6 live bare tool names, 12 composed scoped names, 10 agent claims, all live. **I performed my own mutation** (not the executor's): renamed the live hook matcher literal in `hooks/hooks.json` from `mindrian-brain__.*` to `mindrian-brain-STALE__.*` (both PreToolUse and PostToolUse groups). Re-ran `check-brain-tool-liveness.cjs` -> exit 1, `RESULT: DEAD SEAM FOUND`, `matcher_zero_matches` reported for both mutated matchers. Re-ran `bash tests/run-all-239.sh` under the same mutation -> `Passed: 6  Failed: 3`. Restored `hooks/hooks.json` from an out-of-repo backup, confirmed byte-identical via `cmp`, re-ran the liveness script -> exit 0 again, re-ran the aggregator -> `Passed: 9  Failed: 0` again. The claim is load-bearing, not decorative. |
| 2 | SC2: a canary token in an opportunity field / Blue Hat note, driven through the real `query()` path against a captured mock transport, is caught BEFORE the wire; removing `query()` coverage turns the gate red. | VERIFIED | `node tests/test-239-query-egress-canary.cjs` -> `PASS (0 failures)`, all 7 legs green, re-run twice identical. LEG 1/2/3 show `captured: []` (canary never reaches the mock transport) for the opportunity-field door, the Blue Hat `methodology_notes` door, and a PII canary. LEG 6 is the anti-vacuity control: a should-pass payload DOES reach the wire (`captured.length=2`), proving the guard is not simply blocking everything. **I performed my own mutation**: broke the `classify(` call inside `hatAwareRecommend` in `lib/core/brain-client.cjs` (renamed to `classifyDISABLED(`). Re-ran the canary suite -> `FAIL (1 failures)`, LEG 7 (the structural "guard still present" check) correctly went red with `hatAwareRecommend no longer calls classify( -- the raw-field guard was removed`. Restored the file from a full backup, confirmed byte-identical via `cmp`, re-ran -> `PASS (0 failures)` again. Note for the record (not a gap): under this specific mutation LEG 1-3 still passed, because the broken call throws and the surrounding code is fail-closed on any error (documented in-source: "Fail-closed: any missing or non-allow verdict skips the Brain leg") -- a defense-in-depth property, not a hole, and LEG 7 exists precisely to catch the "guard silently removed" shape that a fail-closed exception path could otherwise mask. |
| 3 | SC3: `sendPacket`'s fate is decided explicitly and recorded, either wired end-to-end or parked with a dated note at the call surface and in docs. | VERIFIED | Read `docs/architecture/SUBSTRATE-CONTRACT.md` lines 208-232: a dated (2026-07-30), specific, non-templated ADR amendment stating the census result (zero production `sendPacket(` callers across `lib/`, `scripts/`, `bin/`, `pipelines/`), the ruling (PARKED, not wired, because wiring is net-new feature work out of this remediation-only phase's scope), the consequence (the PB8-10 classifier belt inside `sendPacket` must not be counted as live Part-8 coverage), and an explicit re-open condition tied to a specific pre-commit guard and to this phase's own census test. This is a real decision record, not a placeholder or boilerplate line. `node tests/test-239-sendpacket-parked.cjs` -> `PASS (6 passed, 0 failed)`, re-run twice identical: LEG 1 machine-checked census (788 files scanned, zero non-allowlisted call sites), LEG 2 anti-vacuity (a seeded non-allowlisted call site IS caught), LEG 3 dated PARKED note found at the call surface, LEG 4 the doc-side amendment found, LEG 5 the prior contradictory claim in `tests/test-150-brain-egress.cjs` confirmed reconciled. |

**Score:** 3/3 roadmap success criteria verified, 2 of them independently re-mutated by the
verifier (not merely re-run) to confirm the gates are load-bearing rather than decorative.

### PLAN Frontmatter Must-Haves (merged across 239-01..07)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 4 | 239-01: `bash tests/run-all-239.sh` is a single command reporting PASS/FAIL/SKIP for every Phase 239 leg. | VERIFIED | Re-run: `Passed: 9  Failed: 0  Skipped: 0`. |
| 5 | 239-02: One exported `BRAIN_TOOL_MATCHER` authority is consumed by both `hooks.json` matchers and the anchored `isBrainTool` re-check. | VERIFIED | `grep -n BRAIN_TOOL_MATCHER lib/core/brain-response-sanitize.cjs` shows the export; the dead-matcher census leg inside `run-all-239.sh` (Leg A) is one of the 9 green legs, confirming `hooks/hooks.json` no longer contains the dead `mcp__brain_.*` literal and `brain-response-sanitize.cjs` no longer contains `indexOf('mcp__brain_')`. |
| 6 | 239-05: raw-field classify-first guard in `hatAwareRecommend`/`suggestValidationSteps`, strictly upstream of `sanitizeCypherInput` and template interpolation. | VERIFIED | LEG 5 of the canary suite transcript: `classify( at char 1137, sanitizeCypherInput( at char 1888 (ordering holds)`; LEG 4 proves template-laundering (T4) is closed. |
| 7 | 239-03: `check-brain-tool-liveness.cjs` enumerates live tool names via a real stdio `tools/list` handshake, not a hand-typed list. | VERIFIED | Direct run of `node scripts/check-brain-tool-liveness.cjs` shows `Live bare tool names (handshake tier, 6): brain_ask, brain_query, brain_schema, brain_search, brain_stats, brain_write` -- a real subprocess handshake, confirmed by reading the script's own tier-1 spawn-and-JSON-RPC logic. |
| 8 | 239-06: `sendPacket` parked with a dated note at the call surface AND in docs, contradictory claims reconciled, zero-caller census machine-checked. | VERIFIED | See Truth 3 above. |
| 9 | 239-04: PostToolUse PII sanitizer proven to fire on live names; dead `mcp__brain_` literals swept from tracked source. | VERIFIED | `tests/test-239-pii-sanitizer-liveness.cjs` is one of the 9 green `run-all-239.sh` legs; `grep -rn "mcp__brain_" lib/core/security/agentshield-scanner.cjs lib/core/grill-engine.cjs lib/core/eureka/online-pattern-query.cjs` returns nothing outside labelled superseded-example comments (verified by direct grep during this session). |
| 10 | 239-07: liveness gate wired into `scripts/verify-release` as a new numbered section, proven to block by mutating the real tree. | VERIFIED | `grep -n "check-brain-tool-liveness.cjs\|Brain tool liveness gate" scripts/verify-release` shows the section (numbered 19, not 18 -- Phase 238 took 18 first; the SUMMARY documents this collision and the test derives the number by regex, never a literal). `node tests/test-239-verify-release-section-18.cjs` -> `all 4 legs PASSED`, re-run twice identical, including its own live mutation-and-restore of `hooks/hooks.json` (LEG 3) and a clean-tree pass-text check (LEG 4). |

**Score:** 7/7 plan-declared must-haves independently confirmed (in addition to the 3 roadmap SCs, several overlap 1:1 with the SCs and are not double-counted in the headline score).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/run-all-239.sh` | Phase aggregator, 9 legs | VERIFIED | Executable, re-run twice, `Passed: 9 Failed: 0 Skipped: 0` both times. |
| `tests/helpers/brain-capture-server.cjs` | Shared SSE-shaped capture server | VERIFIED | `node -e "require('./tests/helpers/brain-capture-server.cjs')"` loads cleanly; consumed by `tests/test-brain-client-params.cjs` and `tests/test-239-query-egress-canary.cjs`. |
| `scripts/check-brain-tool-liveness.cjs` | Real stdio handshake liveness gate | VERIFIED | Direct run confirms real subprocess handshake, not a hand-typed list; mutation-provable (see Truth 1). |
| `lib/core/brain-response-sanitize.cjs` (`BRAIN_TOOL_MATCHER`) | Single tool-name authority | VERIFIED | Exported constant confirmed present and consumed by `hooks/hooks.json` matchers per the census leg. |
| `lib/core/brain-client.cjs` (`hatAwareRecommend`, `suggestValidationSteps`) | Raw-field classify-first guard | VERIFIED | Source-order proof (LEG 5), mutation-provable (see Truth 2). |
| `tests/test-239-query-egress-canary.cjs` | SC2 proof, 7 legs | VERIFIED | Re-run: `PASS (0 failures)`. |
| `tests/test-239-sendpacket-parked.cjs` | SC3 census proof, 6 legs | VERIFIED | Re-run: `PASS (6 passed, 0 failed)`. |
| `docs/architecture/SUBSTRATE-CONTRACT.md` (Phase 239-06 amendment) | Dated, real decision record | VERIFIED | Read in full; specific, dated, non-templated, names the census result and the re-open condition. |
| `scripts/verify-release` (new section) | Liveness gate wired into release gate | VERIFIED | Section 19 present, branches on all 3 exit codes of `check-brain-tool-liveness.cjs`, mutation-provable (see Truth 4 above / 239-07). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `hooks/hooks.json` (Pre/PostToolUse Brain matchers) | `lib/core/brain-response-sanitize.cjs` `BRAIN_TOOL_MATCHER` | shared matcher constant | WIRED | Census leg in `run-all-239.sh` (Leg A) is green; confirmed red under my own hand-mutation of the matcher literal, then confirmed green again after restore. |
| `lib/core/brain-client.cjs` `query()` | `lib/core/part8-egress-guard.cjs` `classify()` | labelled backstop call | WIRED | LEG 4/5/6 of the canary suite exercise this path with real verdicts (`ambiguous`/`allow`/`block`), not stubs. |
| `scripts/verify-release` section 19 | `scripts/check-brain-tool-liveness.cjs` | direct subprocess invocation, branches on exit 0/1/other | WIRED | Confirmed by direct read (`sed -n '515,536p' scripts/verify-release`) and by `tests/test-239-verify-release-section-18.cjs` LEG 3/4 (real mutation, real restore). |
| `lib/core/brain-client.cjs` `sendPacket()` | `docs/architecture/SUBSTRATE-CONTRACT.md` amendment + `tests/test-239-sendpacket-parked.cjs` census | dated in-source park note cross-referenced to the doc amendment | WIRED | LEG 3 (note found at call surface), LEG 4 (doc amendment found), LEG 5 (contradiction with `tests/test-150-brain-egress.cjs`'s old claim reconciled) all green. |

### Mutation Proofs (performed independently by this verifier, not the executor)

| Claim | Mutation | Pre-mutation | Post-mutation | Restored |
|-------|----------|---------------|----------------|----------|
| SC1 load-bearing | Renamed live matcher literal `mindrian-brain__.*` -> `mindrian-brain-STALE__.*` in `hooks/hooks.json` (both hook groups) | `check-brain-tool-liveness.cjs` exit 0; `run-all-239.sh` Passed 9/Failed 0 | `check-brain-tool-liveness.cjs` exit 1, `DEAD SEAM FOUND`; `run-all-239.sh` Passed 6/Failed 3 | Yes -- `cmp` byte-identical to pre-mutation backup, both gates green again |
| SC2 load-bearing | Renamed `hatEgressGuard.classify(` -> `hatEgressGuard.classifyDISABLED(` inside `hatAwareRecommend` in `lib/core/brain-client.cjs` | `test-239-query-egress-canary.cjs` PASS (0 failures) | `test-239-query-egress-canary.cjs` FAIL (1 failure) -- LEG 7 correctly detects the removed guard call | Yes -- `cmp` byte-identical to pre-mutation backup, suite green again |

Both mutations were reverted before this report was finalized; `git status --porcelain -- hooks/hooks.json lib/core/brain-client.cjs scripts/check-brain-tool-liveness.cjs` returns empty.

### Regression Checks

| Command | Expected | Observed | Status |
|---------|----------|----------|--------|
| `bash tests/run-all-196.sh` | Passed: 5, Failed: 0 | Passed: 5, Failed: 0, Skipped: 0 | PASS -- the cross-plan fixture gap from 239-02/239-04 (`part8-egress-guard-hook-fixture-stale-after-239-02`, resolved per 239-04-SUMMARY.md) is fully resolved |
| `node tests/test-150-brain-egress.cjs` | PASS (MEM-04 zero-prose invariant) | `PASS test-150-brain-egress.cjs (MEM-04: zero memory cortex prose in the Brain packet)` | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| BRAIN-01 | 239-01, 02, 03, 04, 07 | Egress guard + PII sanitizer hooks match live Brain tool names (B-1). | SATISFIED (real evidence exists; ROADMAP/REQUIREMENTS.md still shows `Pending` -- see note below) | Truth 1 above, mutation-proven by this verifier independently, not just re-run. |
| BRAIN-02 | 239-05 | User-typed content cannot reach a Brain query uninspected; guard covers `query()`, not only `sendPacket`. | SATISFIED (same caveat) | Truth 2 above, mutation-proven by this verifier independently. |
| BRAIN-03 | 239-06 | `sendPacket`'s fate decided explicitly and recorded. | SATISFIED (same caveat) | Truth 3 above; real dated decision record read in full, census test re-run green. |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps exactly BRAIN-01/02/03 to Phase 239
and all three appear across the seven plans' frontmatter `requirements:` fields.

**Note for the orchestrator (per this session's instructions, not this verifier's call to make):**
`.planning/REQUIREMENTS.md` currently shows all three as `[ ]` / `Pending`. The codebase
evidence above supports marking them complete; the actual edit is left to whoever owns
ROADMAP.md/REQUIREMENTS.md updates, per this verification task's explicit instruction.

### Anti-Patterns Found

None blocking. Scanned every file named in the seven plans' `key-files` (created + modified)
lists for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`. The only regex hits were substring
false positives on the framework name `JTBD` (contains the letters `TBD`) inside prose,
fixture strings, and doc text -- not debt markers. Zero real hits.

`git status --porcelain` shows only pre-existing, unrelated dirty files
(`lib/statusline/ctx-window.cjs`, `package-lock.json`, `scripts/context-monitor`,
`scripts/statusline-fallback-echo.cjs`, three statusline test files) and pre-existing untracked
`.planning/debug/*.md` research trail files plus one unrelated `dist/zed/` artifact -- none of
these are in any Phase 239 plan's `files_modified`/`key-files` list, and none were touched by
this verification session's own mutation probes (confirmed via targeted `git status --porcelain`
on the specific files this verifier mutated, both empty after restore).

### Human Verification Required

None. This phase is entirely security/infra tooling (hook matchers, an egress guard, a
release-gate script, a decision-record amendment) with no UI or visual surface, and every
claimed behavior -- including the "turns red under mutation" claims for SC1 and SC2 -- was
independently reproduced by this verifier via direct command execution, not merely re-read from
SUMMARY.md prose.

### Gaps Summary

None. All 3 ROADMAP success criteria and all 7 plan-declared must-have truths are independently
verified against live command output and, for the two SCs whose claims center on
mutation-provability (SC1, SC2), independently re-mutated by this verifier using a mutation NOT
identical to the executor's own documented mutation, confirming the gates are load-bearing gates
rather than SUMMARY narrative. The `docs/architecture/SUBSTRATE-CONTRACT.md` decision record for
`sendPacket` was read in full and is a real, dated, specific ruling, not a placeholder. All
regression suites (`run-all-196.sh`, `test-150-brain-egress.cjs`) remain green. No debt markers,
no stub artifacts, no orphaned requirements. The only outstanding item is administrative: BRAIN-01/
02/03 still read `Pending` in `.planning/REQUIREMENTS.md`, which this report recommends resolving
but does not resolve itself, per instruction.

---

*Verified: 2026-07-30T13:05:30Z*
*Verifier: Claude (gsd-verifier)*
