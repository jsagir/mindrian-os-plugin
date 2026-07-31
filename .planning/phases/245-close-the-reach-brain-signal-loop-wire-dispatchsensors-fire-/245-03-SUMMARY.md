---
phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-
plan: 03
subsystem: part8-egress-guard
tags: [canon-part-8, egress-guard, false-positive, positive-recognizer, rca, brain-client, requirement-5]

# Dependency graph
requires:
  - phase: 196
    provides: "classify() itself (three positive recognizers + one terminal catch-all) and the PreToolUse hook that turns its verdict into an exit code (part8-egress-guard.cjs, part8-egress-guard-hook.cjs)"
  - phase: 196.5
    provides: "the Shape F.1 leak-prevention gate renderer whose verbatim output settled research Assumption A1 (lib/hmi/part8-egress-gate.cjs)"
  - phase: 239
    provides: "the single exported BRAIN_TOOL_MATCHER authority and the check-brain-tool-liveness enumeration this plan's hook leg derives its scoped tool names from"
provides:
  - "_isProvablyEmptyPayload(payload): a positive proof of emptiness (plain object, non-array, zero own keys)"
  - "The empty_payload classify class: a contentless Brain payload classifies as allow instead of ambiguous"
  - "Unblocked brain-client.cjs::stats() and ::schema(), both of which pass a literal {} on every Brain-enabled install"
  - "tests/test-245-egress-contentless.cjs: a two-leg test (pure classifier + the real hook as a child process)"
  - ".planning/debug/245-part8-contentless-block.md: the Requirement 5 RCA, with the over-firing verdict and the D-28 brain_search disposition on record"
  - "Research Assumption A1 settled by captured verbatim stderr: the F.1 gate render branch fired, not a hook timeout"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repair a default-deny false positive by ADDING proof, never by SUBTRACTING denial: a new positive recognizer ahead of the catch-all, with the catch-all byte-unchanged"
    - "Place a new allow-branch AFTER the forbidden-pattern scan so nothing can ever precede default-deny, even when the branch trivially clears that scan anyway"
    - "Distinguish 'cannot prove it is safe' from 'provably has nothing to leak'; an empty payload is the one case where the two coincide"
    - "When one root cause yields two symptoms and only one is clearly a false positive, fix that one and FILE the other; resolving both because they share a line is how boundaries quietly move"
    - "Prove a boundary fix through the production hook chain as a child process, not through the pure function alone; a unit-only test is mutation-blind to the verdict-to-exit-code translation"
    - "Capture verbatim stderr from the real block to settle which branch fired, instead of reasoning about which branch must have fired"

key-files:
  created:
    - tests/test-245-egress-contentless.cjs
    - .planning/debug/245-part8-contentless-block.md
    - "~/MindrianRooms/rethinking-mindrianos/research/2026-07-31-phase-245-part8-contentless-block/ (room cross-file)"
  modified:
    - lib/core/part8-egress-guard.cjs

decisions:
  - "Verdict on Requirement 5's open clause: the guard was OVER-FIRING (SPEC option b), NOT correctly conservative. Evidence is its own inverted risk ordering: brain_ask carrying a real user question is allowed while a zero-argument brain_stats read is blocked."
  - "D-28 brain_search: FLAGGED, block LEFT IN PLACE, _isFreeFormTool NOT widened. A search string IS real user content, so the block may be correct; widening is a genuine egress-surface change that needs its own navigator decision."
  - "null and undefined stay fail-closed. A missing envelope field is a different claim from an explicitly empty object, and every shipped caller passes {} explicitly."
  - "The recognizer is payload-shaped, not tool-scoped. No contentless-tool allowlist was added (the research's defense-in-depth option was declined): the allowlist would be a second surface to keep in step with the Brain server, and zero keys is already the proof."

metrics:
  duration: ~35 min
  completed: 2026-07-31
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 245 Plan 03: Part 8 Contentless-Block Fix Summary

A zero-key Brain payload now classifies as `allow` / `empty_payload` through a new positive
recognizer placed ahead of a byte-unchanged fail-closed catch-all, unblocking
`brain_stats` / `brain_schema` without widening what may carry content.

## What Was Built

### Task 1: the provable-emptiness recognizer (`lib/core/part8-egress-guard.cjs`)

`_isProvablyEmptyPayload(payload)` returns true only for a plain object: non-null,
`typeof === 'object'`, `!Array.isArray`, `Object.keys(payload).length === 0`. Nothing else
qualifies. One branch inside `classify()` calls it and returns
`{ verdict: 'allow', class: 'empty_payload', reason: 'zero-key payload carries no bytes' }`.

Three invariants held, and each is stated in the code comment so a later reader cannot mistake
the change for a relaxation:

1. **The terminal catch-all is byte-unchanged.** Verified by diff: the only line in the diff
   matching `neither proven move-set` is a comment referencing it, never the `return` itself.
   Every payload carrying anything at all still returns `ambiguous`.
2. **`_isFreeFormTool` is byte-unchanged.** `brain_search` was deliberately not added.
3. **`null` and `undefined` stay fail-closed** via the pre-existing `non-object payload` early
   return, which was not touched.

Placement is load-bearing: the branch sits AFTER the CONTENT-SET `scanForContent` block and
BEFORE `_looksLikePacket`, so default-deny still runs first on every call and no branch can
precede it (threat T-245-11). An empty object trivially clears that scan, so the ordering costs
nothing and preserves the invariant instead of relying on it.

`scripts/part8-egress-guard-hook.cjs` was NOT touched. Its `ambiguous` -> `exit 2` translation
and its fail-OPEN-on-internal-error posture (accepted risk A3/T6) are both unchanged.

### Task 2: the two-leg test (`tests/test-245-egress-contentless.cjs`)

41 assertions, bare `node`, zero framework, exit non-zero on failure.

**Unit leg (32 assertions)** drives `classify()` directly: `{}` -> `allow` / `empty_payload` for
`brain_stats`, `brain_schema`, a non-Brain tool name, and an empty tool name (the recognizer is
payload-shaped, not tool-scoped, asserted so that is on record as deliberate). `undefined`,
`null`, `[]`, `{a:1}`, `{question:''}`, `{topK:5}` all stay `ambiguous`. A CONTENT-SET payload
still `block` / `content_set`. `{question:'lean startup methodology'}` on `brain_ask` still
`allow` / `move_set`. `_isFreeFormTool('...brain_search')` is still `false` (the D-28 non-widening
assertion). Plus direct seam assertions on `_isProvablyEmptyPayload` itself.

**Hook leg (9 assertions)** spawns `scripts/part8-egress-guard-hook.cjs` as a child process four
times with `PART8_FORCE_BRAIN_AVAILABLE=1` (and once with `=0`), driving synthetic PreToolUse
envelopes on stdin. Scoped tool names are DERIVED at run time from
`scripts/check-brain-tool-liveness.cjs`, never hand-typed, because the hook calls
`isBrainTool(toolName)` BEFORE `classify()` and a bare name would allow vacuously.

| Case | Payload | Brain | Expected | Result |
|------|---------|-------|----------|--------|
| A | `brain_stats {}` | available | exit 0, no gate text | exit 0, stderr empty |
| B | `brain_query {cypher: <content>}` | available | exit 2 + gate text | exit 2 |
| C | `brain_stats {a:1}` | available | exit 2 (catch-all untouched) | exit 2 |
| D | `brain_stats {}` | Brain-less | exit 0 | exit 0 |

Case C was added beyond the plan's two required hook cases (deviation Rule 2, below) because it
is the case that actually settles Assumption A1.

### Task 3: the RCA (`.planning/debug/245-part8-contentless-block.md`, 321 lines)

Written to the `docs/RCA-TEMPLATE.md` standard with `kind: rca`, committed with `git add -f`
because `.planning/` is gitignored. Carries: the Source-of-Truth Preamble, Symptoms with the
verbatim gate JSON, Scope and Impact, two Eliminated hypotheses (hook timeout, matcher
over-breadth), three Evidence entries, Technical Root Cause, the explicit over-firing verdict, the
Required Code Changes, the Tests section, the `brain_search` D-28 section, a per-finding
classification table, the gates-cleared section, and the Resolution with verification output.

## Deviations from Plan

### Auto-fixed / auto-added

**1. [Rule 2 - Missing critical evidence] Added hook cases C and D**

- **Found during:** Task 2
- **Issue:** The plan's two required hook cases were a contentless allow and a CONTENT-SET block.
  Neither exercises the AMBIGUOUS branch, which is the branch the live `brain_stats` block
  actually fell into pre-fix. Case B's block comes from the `content_set` verdict, which renders a
  DIFFERENT stderr message than the ambiguous gate. Recording only Case B's stderr would have
  answered a question Assumption A1 did not ask.
- **Fix:** Added Case C (`{a:1}` with Brain available -> exit 2, capturing the ambiguous-branch
  stderr) and Case D (contentless with `PART8_FORCE_BRAIN_AVAILABLE=0` -> exit 0, pinning the
  D-08a degrade leg). Case C both settles A1 correctly and doubles as a direct proof that the
  catch-all is untouched at the hook level, not just at the classifier level.
- **Files modified:** `tests/test-245-egress-contentless.cjs`
- **Commit:** 99a5f33a

No other deviations. No architectural changes. No package installs. No Rule 4 escalations.

## Assumption A1: SETTLED

The plan asked for the verbatim first stderr line of the blocking hook case. Both were captured.

**CONTENT-SET block (Case B), first stderr line, verbatim:**

```
Canon Part 8: outbound Brain payload carries CONTENT-SET (content_set). Blocked. forbidden pattern hit: @[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}
```

**AMBIGUOUS block (Case C) - the branch the live `brain_stats` interception actually took -
first stderr line, verbatim:**

```
{"zones":{"header":"-- part 8 -- this may leak unknown -- pick --","body":"1. Reformulate\n2. Cancel\n3. Free-Text","signals":"","footer":null},"contract":{"shape":"F.1","keyboard":"askuserquestion","verbs":["Reformulate","Cancel","Free-Text"],"mode":"A","recommended":"Reformulate","personaContext":null,"standingOptions":false}}
```

**Verdict on A1: CONFIRMED, and narrowed.** The live interception was the `classify()` catch-all
translated by `part8-egress-guard-hook.cjs:179-202`, and specifically the GATE RENDER leg
(`lib/hmi/part8-egress-gate.cjs`), not the minimal fallback notice and not a hook timeout. A
timeout emits neither. The header string `-- part 8 -- this may leak unknown -- pick --` is the
leak-prevention card the session saw, and `class: unknown` in it is the catch-all's own class
token, which is the fingerprint.

## Mutation Proof

```
mutate:  return Object.keys(payload).length === 0;
     ->  return Object.keys(payload).length !== 0;
run:     node tests/test-245-egress-contentless.cjs
result:  MUTANT_EXIT=1        (test reddens)
restore: RESTORED_EXIT=0      (test greens)
```

The test is not vacuous: inverting the single condition the fix turns on makes it fail.

## Room Cross-File: SUCCEEDED

`~/MindrianRooms/rethinking-mindrianos/research/` was writable. Filed at
`~/MindrianRooms/rethinking-mindrianos/research/2026-07-31-phase-245-part8-contentless-block/2026-07-31-phase-245-part8-contentless-block.md`,
cross-linked both ways: the room entry names the RCA path and the phase's SPEC entry; the RCA's
Non-Code Follow-ups names the room. The room's own hooks auto-committed it and queued a MINTO
regen. Per the CLAUDE.md dev-research compositing rule: same finding, two homes, cross-linked.
The dev repo has the executable decision, the room has the reasoning trail.

## Verification Results

| Check | Result |
|-------|--------|
| `node tests/test-245-egress-contentless.cjs` | exit 0, 41 assertions, both legs |
| `node tests/part8-egress-guard-hook.test.cjs` | exit 0 (PB8-04/05/07/08 + T3 green) |
| `node tests/part8-leak-sweep-191.test.cjs` | exit 0 (32 assertions) |
| `node tests/test-decide-part8-invariant.cjs` | exit 0 (2 passed, 0 failed) |
| `bash tests/run-all-245.sh` | PASS=9 FAIL=0 SKIP=0, 8 files discovered, em-dash fence green |
| `node scripts/doctor.cjs --acceptance` | 15/16, sole failure `eureka-fts-index-visible` (pre-existing, Phase 244 closure, `jonathan-contractor-motj` 451 orphan rows). No new failure attributable to this plan. |
| `git diff docs/MINDRIAN-CANON.md` | empty (Canon Part 8 unmodified) |
| `grep -cP '\x{2014}'` on all four artifacts | 0 |
| Catch-all + `_isFreeFormTool` diff | zero change (only a referencing comment appears in the diff) |

## Threat Model Dispositions Honored

| Threat | Disposition | How |
|--------|-------------|-----|
| T-245-10 Information Disclosure (widening lets content cross) | mitigated | `Object.keys().length === 0` required; `{a:1}`, `[]`, `null`, `undefined` all asserted non-allow; catch-all and `_isFreeFormTool` diff-verified unchanged |
| T-245-11 EoP (ordering bypasses default-deny) | mitigated | Branch inserted AFTER `scanForContent`; CONTENT-SET block asserted still firing at both classifier and hook |
| T-245-12 Spoofing (array masquerading as empty object) | mitigated | `!Array.isArray` + non-null + `typeof === 'object'`; `[]` asserted `ambiguous` at both the `classify` and `_isProvablyEmptyPayload` levels |
| T-245-13 EoP (hook fails open on internal error) | accepted | `part8-egress-guard-hook.cjs` not touched at all |
| T-245-14 Tampering (matcher drift) | accepted | `hooks/hooks.json` not touched; the test DERIVES scoped names from the single Phase 239 authority rather than introducing a second copy |
| T-245-SC Tampering (package installs) | mitigated | Zero packages installed. `package.json` unchanged. |

## Known Stubs

None. Every artifact this plan declares is wired and exercised by a running test.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust
boundary. The change is a pure in-process predicate over a JavaScript object inside an existing
classifier, and it strictly narrows the set of payloads that reach the gate.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `4fb3ace9` | `fix(245-03)`: the `_isProvablyEmptyPayload` recognizer + classify branch + export |
| 2 | `99a5f33a` | `test(245-03)`: the two-leg test, unit + real hook child process |
| 3 | `da69827d` | `docs(245-03)`: the Requirement 5 RCA with the over-firing verdict and D-28 |

## Self-Check: PASSED

- `lib/core/part8-egress-guard.cjs` FOUND (modified, `_isProvablyEmptyPayload` present, `empty_payload` present)
- `tests/test-245-egress-contentless.cjs` FOUND
- `.planning/debug/245-part8-contentless-block.md` FOUND and git-tracked (`git ls-files --error-unmatch` succeeded)
- Room cross-file FOUND at `~/MindrianRooms/rethinking-mindrianos/research/2026-07-31-phase-245-part8-contentless-block/`
- Commit `4fb3ace9` FOUND
- Commit `99a5f33a` FOUND
- Commit `da69827d` FOUND
