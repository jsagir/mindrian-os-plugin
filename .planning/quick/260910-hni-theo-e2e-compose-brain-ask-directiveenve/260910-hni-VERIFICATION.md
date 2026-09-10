---
phase: quick/260910-hni
verified: 2026-09-10T10:26:51Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Quick Task 260910-hni: Theo e2e compose brain_ask DirectiveEnvelope Verification Report

**Task Goal:** Theo e2e: compose brain_ask DirectiveEnvelope from Theo structured_rows + recommend_chain, fix askOp coverage shape, route commands into brain-router, live e2e smoke.
**Verified:** 2026-09-10T10:26:51Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `brain_ask` through the shim returns a DirectiveEnvelope whose `directive.guided.framework` names a real framework off Theo's recommended chain, not null | VERIFIED | Live run: `node tests/test-339-theo-ask-e2e-live.cjs` printed `directive.guided.framework: "Design Thinking"`, exit 0. Source at `lib/core/brain-client.cjs:1271-1281` sets `out.directive.guided.framework = (steps[0] && steps[0].framework) || null` from `recommendChain`'s real chain. |
| 2 | `next_gate.options` carries one entry per chain step, each with confidence in [0.5, 0.9] and `/mos:` command slugs | VERIFIED | Live run: `next_gate.options.length: 4`. Offline Arm 1 (`node tests/test-339-theo-ask-compose.cjs`, ok 1) asserts 4 options, confidence clamp `[0.5,0.9]`, top option exactly 0.9, and `/mos:`-stripped slugs. Code at `lib/core/brain-client.cjs:1252-1265`. |
| 3 | `grounding.rows` carries the Theo rows the answer stands on, so an EMPTY array is a visible signal | VERIFIED | Live run: `grounding.rows.length: 8`. `_projectGroundingRows` (`lib/core/brain-client.cjs:1188-1193`) projects to 4 named keys; Arm 4 (ok 5) confirms rows stay populated even when `chain_status` is `empty`/`unreachable`. |
| 4 | `askOp` against a Theo op answer reports real `coverage.matched` count with `source:'theo'`, not the `{count:0,rows:[],degraded:true}` sentinel | VERIFIED | Direct spot-check: `_normalizeAskOpResult({rows:[3],coverage:{matched:3}},...).count === 3` and `.source === 'theo'`; incumbent shape keeps `source: undefined`; error sentinel still degrades. Offline Arms 6/7 (ok 7, ok 8) pass. Code at `lib/core/brain-client.cjs` askOp normalizer. |
| 5 | `brainRoute` builds its chain from command slugs when present, instead of falling through to Tier-2 heuristic | VERIFIED | `lib/mcp/brain-router.cjs:370-378`: `opt.commands` slugs pushed into `rawChain` ahead of `opt.framework`, confirmed by direct grep and code read. |
| 6 | Incumbent-shaped response and every error sentinel pass through byte-unchanged | VERIFIED | Offline Arm 2 (ok 2, same object reference) and Arm 3a/3b (ok 3, ok 4: `egress_blocked` and transport `null` unchanged). `test-257-envelope-passthrough.cjs` (6/6 pass) confirms `wrapDirective`'s 7-key order is preserved when `grounding` is absent. |
| 7 | The question text never appears anywhere in the composed envelope | VERIFIED | Offline Arm 5 (Canon Part 8 tripwire, ok 6) asserts `JSON.stringify(composed)` excludes both the question and a canary planted in `query_terms` and in the query() wire diagnostics. Source confirms `delete out.query_terms;` is the only deletion and grounding rows are 4-named-key projections only - no raw row copy, no query_terms surviving `Object.assign`. |
| 8 | A live Theo session proves the e2e path; an unavailable Brain records SKIP, never a false PASS | VERIFIED | `node tests/test-339-theo-ask-e2e-live.cjs` ran against the real Theo origin on this machine (Brain key present) and printed `Phase 339 (quick/260910-hni) live e2e smoke: PASS`, exit 0 - a real PASS, not a SKIP. `tests/run-all-339.sh`'s `*.cjs` loop now uses `run_may_skip` (confirmed: `run-all-339.sh` reports `test-339-theo-ask-e2e-live.cjs: PASSED`). |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/brain-client.cjs` | `_inferRungFromQuestion`, `_composeTheoAsk`, `_normalizeAskOpResult` | VERIFIED | All three present, exported via `_test`/named export; behavior matches contract exactly (read at lines 1130-1300+). |
| `lib/core/directive-envelope.cjs` | `grounding` named additive field | VERIFIED | Lines 218-220: `_copyIfPlainObject(brainResponse.grounding)`, absence-safe, matches `egress_disclosure`/`refusal` pattern. |
| `lib/core/part8-egress-guard.cjs` | `recommend_chain` known-tool-shape arm | VERIFIED | `RECOMMEND_CHAIN_PROBLEM_TYPES` (line 336) + arm at line 449-463; `allow`/`ambiguous` verdicts confirmed by direct `classify()` calls in Task 2 verify script (rerun, passed). |
| `tests/test-339-theo-ask-compose.cjs` | Offline 7-arm suite, >=200 lines | VERIFIED | `node tests/test-339-theo-ask-compose.cjs` -> 8/8 subtests pass (arms 1,2,3a,3b,4,5,6,7), 0 network. |
| `tests/test-339-theo-ask-e2e-live.cjs` | Live smoke with honest SKIP, >=80 lines | VERIFIED | Ran live, exit 0, printed PASS (not SKIP) since Brain key is present on this machine. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `brain-client.cjs::ask` | `_composeTheoAsk` | `answer_mode==='structured_rows'` guard | WIRED | Confirmed live: a structured_rows Theo response produced a composed envelope with `directive`/`next_gate`/`grounding`. |
| `_composeTheoAsk` | `recommendChain` + `query` | injectable deps, defaulting to module wrappers | WIRED | Offline Arm 1 drives via injected stubs; live run drives via real defaults - both paths proven. |
| `directive-envelope.cjs::wrapDirective` | `envelope.grounding` | `_copyIfPlainObject` named additive | WIRED | `test-257-envelope-passthrough.cjs` Arm 3 confirms 7-key order intact when absent; direct call confirms attach when present. |
| `brain-router.cjs::brainRoute` | `rawChain` | `opt.commands` pushed ahead of `opt.framework` | WIRED | Code read at lines 370-378 confirms ordering matches plan. |
| `part8-egress-guard.cjs::_proveKnownToolShape` | `recommend_chain` payloads | exact-keys + rung enum | WIRED | Direct `classify()` calls (well-formed both vocabularies -> `allow`; extra key, off-enum, out-of-range max_steps -> `ambiguous`) all passed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Compose suite (offline, 7 arms) | `node tests/test-339-theo-ask-compose.cjs` | 8/8 pass, exit 0 | PASS |
| Live e2e smoke (must PASS not SKIP) | `node tests/test-339-theo-ask-e2e-live.cjs` | Real PASS printed, exit 0, `directive.guided.framework:"Design Thinking"`, `grounding.rows.length:8` | PASS |
| Envelope passthrough regression | `node tests/test-257-envelope-passthrough.cjs` | 6/6 pass, exit 0 | PASS |
| Alias-table roundtrip regression | `node tests/test-254-normalize-roundtrip-probe.cjs` | PASS (0 failures) | PASS |
| Dist bundle staleness | `node scripts/build-dist-bundles.cjs --check-stale` | `stale=false`, exit 0 | PASS |
| Phase 339 suite | `bash tests/run-all-339.sh` | PASS=13 FAIL=1 SKIP=0; sole failure is pre-existing, out-of-scope `test-339-update-path-single-source.cjs` (confirmed unrelated: predates this task's starting commit `978be5fa`, root cause in `960a7a2e` from Phase 341-06) | PASS (expected pre-existing failure only) |
| Acceptance roll-up | `node scripts/doctor.cjs --acceptance` | 20/20 points passed | PASS |
| Em-dash scan across all 3-commit-touched files | grep U+2014 over `git diff 978be5fa..HEAD --name-only` file list | Zero matches | PASS |
| Unchanged-path guarantee | `git diff 978be5fa..HEAD -- lib/core/rs-chain-feeder.cjs hooks/hooks.json` | 0 lines diff | PASS |
| `recommendChain`/`callTool`/alias-table function bodies unchanged | targeted diff grep on `brain-client.cjs` | No definition-line changes; only new call sites and new consumer code found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-260910-hni | 260910-hni-PLAN.md | Compose brain_ask envelope, fix askOp, route commands, live e2e | SATISFIED | All 8 must-have truths verified above; not a roadmap-tracked requirement (quick task, self-contained in its own plan). |

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found in any of the 6 production files or 2 new test files touched by commits `8ac58e35`/`b3b669aa`/`5dfd7583`. No empty-return stubs found in the composer or router code paths (both non-vacuously tested by scratch-mutation per the SUMMARY's RED/GREEN log, and independently spot-checked here with direct `_normalizeAskOpResult`/`classify()` calls against HEAD).

### Human Verification Required

None. All must-haves are verifiable by direct command execution and source inspection; no visual, real-time, or subjective-UX component in this task.

### Gaps Summary

No gaps. All 8 must-have truths hold against the live codebase at HEAD, not merely against SUMMARY.md's narrative. Every required command (`test-339-theo-ask-compose.cjs`, `test-339-theo-ask-e2e-live.cjs` live PASS, `test-257-envelope-passthrough.cjs`, `test-254-normalize-roundtrip-probe.cjs`, `build-dist-bundles.cjs --check-stale`) was re-run independently and passed with the expected exit codes and output. The Canon Part 8 no-echo guarantee was confirmed both by the standing tripwire test and by direct source read of `_composeTheoAsk`/`_projectGroundingRows`. The scope-boundary claims (alias tables, `recommendChain`, `callTool` belt, `hooks/hooks.json`, `lib/core/rs-chain-feeder.cjs` untouched) were independently confirmed via `git diff 978be5fa..HEAD` on those exact paths (zero diff) and targeted grep on `brain-client.cjs` for definition-line changes to `recommendChain`/`callTool` (none found). The one failing test in `run-all-339.sh` (`test-339-update-path-single-source.cjs`) is confirmed pre-existing and out of scope, logged correctly in `deferred-items.md`.

---

_Verified: 2026-09-10T10:26:51Z_
_Verifier: Claude (gsd-verifier)_
