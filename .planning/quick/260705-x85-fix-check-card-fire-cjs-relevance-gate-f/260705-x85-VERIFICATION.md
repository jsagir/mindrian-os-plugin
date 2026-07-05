---
phase: 260705-x85-fix-check-card-fire-cjs-relevance-gate-f
verified: 2026-07-06T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Quick Task 260705-x85: Fix check-card-fire.cjs relevance-gate false positive Verification Report

**Task Goal:** Fix check-card-fire.cjs relevance-gate false positive: PRIMARY-path gateTopicallyRelevant compares user text against the assistant's own reply instead of the gate's real subject
**Verified:** 2026-07-06T00:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths / Must-Have Checks

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | `gateTopicallyRelevant`'s 2nd arg prefers real `gate_subject_text` over `outputText`, additively (fallback unchanged) | VERIFIED | `scripts/check-card-fire.cjs:494-498`: `const gateSubjectText = (typeof t.gate_subject_text === 'string' && t.gate_subject_text) ? t.gate_subject_text : outputText;` then `gateRelevance.gateTopicallyRelevant(precedingUserText, gateSubjectText)`. `gateAlreadyAnswered`/`gateLabels` (lines 490-493) untouched, still derived from `outputText`. |
| 2 | `turnContextHash`, `gateSignature`, retry-key derivation untouched | VERIFIED | `git diff 3fd9b81b^ 62b09ee8 -- scripts/check-card-fire.cjs` shows zero `-`/`+` lines touching `turnContextHash`, `gateSignature(`, `bumpRetryCount`, or the retry-key derivation — confirmed via targeted grep on the diff (no matches). |
| 3 | `readReachedGates`'s bare entry-path-array return contract unchanged; `readReachedGateSubjects` is a separate additive export | VERIFIED | `git diff 3fd9b81b^ 3fd9b81b -- lib/core/card-fire-sidechannel.cjs` shows `readReachedGates`'s function body untouched (zero lines changed inside it); `readReachedGateSubjects` added as a fully separate function (lines 301-332) with its own dedupe/collection logic, exported alongside (not replacing) `readReachedGates`. |
| 4 | Three producer call sites pass `subjectText` from real rendered content already in scope; no other call-site behavior changed | VERIFIED | `lib/hmi/selector-dispatcher.cjs:1085-1093` (pickShape door): `gateSubjectText` built from `result.rendered.zones.header`/`.body`, passed as `subjectText` alongside unchanged `surface`/`shape`. `scripts/intent-classifier.cjs:1103-1108` (engine arm): `subjectText: rendered.text`, `sessionId`/`surface`/`shape` unchanged. `scripts/intent-classifier.cjs:2157-2164` (emitBindingGate F.8): `subjectText` from `zones.header`+`zones.body`, `sessionId`/`surface`/`shape` unchanged. Each diff (`3ff24877`) is a single added object-literal key per call site — no other params/logic touched. |
| 5 | Full test suite passes (re-run by verifier, not trusted from SUMMARY) | VERIFIED | Ran independently: `node tests/test-209-primary-sidechannel.cjs` → 12/12 PASS (exit 0). `node tests/test-card-fire-relevance-gate.cjs` → 4/4 PASS (exit 0). `bash tests/run-all-179.sh` → 12 passed, 0 failed, 0 skipped (exit 0). `bash tests/run-all-209.sh` → PASS=9 FAIL=0 SKIP=0 (exit 0). `bash tests/run-all-210.sh` → PASS=14 FAIL=0 SKIP=0 (exit 0). Matches SUMMARY's reported numbers exactly. |
| 6 | Behavior 9 asserts the specific 2026-07-05 incident shape is fixed, not a generic assertion | VERIFIED | `tests/test-209-primary-sidechannel.cjs:239-296`: records a stale PRIMARY reach with `subjectText` about `'rethinking-mindrianos governing_thought solution-design MindrianOS architecture refactor'`, builds a turn about drafting a Gmail email for Diana, asserts `turn.gate_subject_text` equals the recorded stale subject, asserts `classifyCardFire` returns `{intercept:false, reason:'gate-irrelevant-to-turn'}`, AND asserts the OLD comparison (`gateTopicallyRelevant(precedingUserText, outputText)`) would have returned `true` — a documented mechanism-of-failure contrast, not a generic pass/fail check. |
| 7 | No version bump / CHANGELOG.md / plugin.json / package.json changes | VERIFIED | `git show --stat` on all three task commits (`3fd9b81b`, `3ff24877`, `62b09ee8`) shows only: `lib/core/card-fire-sidechannel.cjs`, `lib/hmi/selector-dispatcher.cjs`, `scripts/intent-classifier.cjs`, `scripts/check-card-fire.cjs`, `tests/test-209-primary-sidechannel.cjs`. No `CHANGELOG.md`, `.claude-plugin/plugin.json`, or `package.json` in any commit's file list. |

**Score:** 7/7 checks verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/core/card-fire-sidechannel.cjs` | additive subject field + `readReachedGateSubjects` export | VERIFIED | `subject` field added to `recordReachedGate`'s pushed record (sanitized via `sanitizeSubjectText`, bounded to `MAX_SUBJECT_CHARS=300`); `readReachedGateSubjects` exported at module.exports; `readReachedGates` body byte-identical to pre-change. |
| `lib/hmi/selector-dispatcher.cjs` | subjectText wired at pickShape trailer door | VERIFIED | Lines 1085-1093, header+body joined, additive key only. |
| `scripts/intent-classifier.cjs` | subjectText wired at engine-arm F.1 and emitBindingGate F.8 | VERIFIED | Lines 1103-1108 (F.1, `rendered.text`) and 2157-2164 (F.8, `zones.header`+`zones.body`). |
| `scripts/check-card-fire.cjs` | `deriveTurnSignals` threads `gate_subject_text`; `classifyCardFire` prefers it | VERIFIED | `deriveTurnSignals` (lines 943-1016) reads `readReachedGateSubjects` only inside the branch where side-channel supplied `ranEntries`; returns `gate_subject_text` with direct-field precedence. `classifyCardFire` (lines 494-498) prefers it over `outputText`. |
| `tests/test-209-primary-sidechannel.cjs` | new Behavior 8 (subject round-trip) + Behavior 9 (regression proof) | VERIFIED | Both present and passing (see checks 5-6 above). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `card-fire-sidechannel.cjs` | `check-card-fire.cjs` | `readReachedGateSubjects()` call inside `deriveTurnSignals` | WIRED | Called only when side-channel supplied `ranEntries`, guarded by try/catch, joins result into `sideChannelSubjectText`. |
| `selector-dispatcher.cjs` | `card-fire-sidechannel.cjs` | `recordReachedGate({..., subjectText})` | WIRED | `subjectText` computed from real rendered zones and passed. |
| `intent-classifier.cjs` (F.1, F.8) | `card-fire-sidechannel.cjs` | `recordReachedGate({..., subjectText})` | WIRED | Both call sites pass real rendered content. |
| `check-card-fire.cjs::classifyCardFire` | `gate-relevance.cjs::gateTopicallyRelevant` | direct call with `gateSubjectText` | WIRED | Second arg now prefers `t.gate_subject_text`, falls back to `outputText`. |

### Behavioral Spot-Checks / Test Suite Execution (run directly by verifier)

| Suite | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| test-209-primary-sidechannel | `node tests/test-209-primary-sidechannel.cjs` | 12/12 assertions PASS | PASS |
| test-card-fire-relevance-gate | `node tests/test-card-fire-relevance-gate.cjs` | 4/4 legs PASS | PASS |
| run-all-179 | `bash tests/run-all-179.sh` | Passed: 12, Failed: 0, Skipped: 0 | PASS |
| run-all-209 | `bash tests/run-all-209.sh` | PASS=9 FAIL=0 SKIP=0 | PASS |
| run-all-210 | `bash tests/run-all-210.sh` | PASS=14 FAIL=0 SKIP=0 | PASS |

### Anti-Patterns Found

None. Grep for `TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER|not implemented|coming soon` across the added lines of all three task commits returned zero matches.

### Requirements Coverage

Not applicable (quick task, no formal REQUIREMENTS.md mapping — confirmed no `requirements:` field in PLAN frontmatter).

### Human Verification Required

None. All checks were verifiable programmatically via code reading, diffing, and direct test execution.

### Gaps Summary

None. All 7 must-have checks from the verification brief are VERIFIED against the actual codebase (not the SUMMARY's self-report). The fix is additive and surgical exactly as planned: `readReachedGates`'s contract, `turnContextHash`, `gateSignature`, and the retry-key derivation are byte-identical pre/post change (confirmed via targeted diffs, not assumption). All 5 independently-executed test suites pass with counts matching the SUMMARY's claims. Out-of-scope items (version bump, CHANGELOG, plugin.json, package.json) were confirmed untouched via `git show --stat` on all three task commits.

---

_Verified: 2026-07-06T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
