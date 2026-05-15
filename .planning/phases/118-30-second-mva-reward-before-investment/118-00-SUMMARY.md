---
phase: 118-30-second-mva-reward-before-investment
plan: "00"
subsystem: detection
tags: [hook, userpromptsubmit, classifier, anthropic-haiku, heuristic, sha256, state-contract, canon-part-8, canon-part-10]

# Dependency graph
requires:
  - phase: 117
    provides: "scripts/auto-explore-drain.cjs exit-0-on-error UserPromptSubmit hook pattern (precedent for stdin-reading hooks)"
  - phase: 89.2
    provides: "lib/core/rs-egress-telemetry.cjs tmp+rename atomic-write pattern (mirrored in mva-state.cjs)"
  - phase: 95.6
    provides: "lib/core/resolve-brain-key.cjs env precedence (env -> ~/.mindrian.env -> CWD/.env) pattern mirrored for ANTHROPIC_API_KEY resolution"
  - phase: 115
    provides: "lib/core/dual-path-detector kill-signal-overrides-positive (Pitfall-3) heuristic decision pattern"
provides:
  - "UserPromptSubmit detection layer: classifies user prompts as venture vs not-venture inside the 1500ms hook budget"
  - "State-file contract at ~/.mindrian/mva/<session-id>.json (the wire Plan 118-01 reads to fire the 6-agent dispatch)"
  - "Hebrew refusal envelope (per LD1 / OQ7): venture=false + reason=hebrew_unsupported_v1.13.0 + hebrew_refusal:true state field"
  - "Telemetry channel at ~/.mindrian/telemetry/v1.13/mva.jsonl (scalar-only; sentence-sha256-keyed)"
  - "ANTHROPIC_API_KEY resolver (env -> ~/.mindrian.env -> CWD/.env -> null) -- not via MINDRIAN_BRAIN_KEY"
  - "Heuristic keyword bank at data/mva-heuristic-keywords.json (venture_keywords + venture_negative_patterns + language_pattern_hebrew)"
affects: [118-01, 118-02, 118-03, 118-04, 118-05, 118-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook-as-pin: detection layer writes the session state file Plan 118-01 reads; the hook fires on the FIRST user sentence BEFORE any room-creation investment (B5 reward-before-investment)"
    - "Sync hook + async enrichment split: classify() runs synchronously inside the 1500ms hook budget via heuristic + cache; classifyAsync() runs the Haiku 4.5 enrichment path in the dispatcher worker (Plan 118-01) where async is natural"
    - "sha256-keyed cache (in-memory Map) avoids re-classifying identical sentences within a session; cache key = sha256(normalized_sentence)"
    - "Test seam _test.{setFetch,clearCache} mirrors Plan 90-01 / 125-05 idiom: tests inject mock fetch + reset cache between suites"
    - "Atomic tmp+rename state writes (mirrors lib/core/rs-egress-telemetry.cjs Phase 89.2 pattern)"
    - "Three-layer Canon Part 8 boundary: (a) LOCAL -> BRAIN: NEVER fires (no Brain MCP calls); (b) LOCAL -> ANTHROPIC API: governed by separate boundary, sends raw sentence for classification; (c) LOCAL DISK (state + telemetry): sha256-only, NEVER raw sentence"

key-files:
  created:
    - "scripts/mva-detect.cjs (148 lines, the UserPromptSubmit hook entry point; reads stdin payload, calls classifier, writes state, emits telemetry, exit 0 on any error)"
    - "lib/core/mva-classifier.cjs (262 lines, two-mode classifier: heuristic sync + Haiku async; exports classify, classifyAsync, isVentureSentence, loadHeuristic, resolveAnthropicKey, _test)"
    - "lib/core/mva-state.cjs (135 lines, session-scoped state I/O with atomic tmp+rename writes; exports writePending, readPending, markRunning, markComplete, isAlreadyRunning, stateDir, stateFile, sessionId)"
    - "lib/core/mva-classifier.test.cjs (228 lines, 7 unit tests T1-T7 covering heuristic positive/negative, Hebrew detection, length guard, cache hit, state round-trip, no-key fallback)"
    - "lib/core/mva-detect.smoke.test.cjs (211 lines, 6 spawn-based smoke tests S1-S6 covering venture/non-venture/Hebrew/empty/malformed-JSON/Canon-Part-8-grep paths; S1 asserts sub-1500ms wall clock)"
    - "data/mva-heuristic-keywords.json (16 venture_keywords + 10 venture_negative_patterns + language_pattern_hebrew U+0590-U+05FF range)"
  modified:
    - "hooks/hooks.json (UserPromptSubmit array: inserted mva-detect.cjs entry at idx 1, between intent-classifier idx 0 and brain-derivation-drain idx 2; timeout=1500ms)"
    - "tests/run-all-118.sh (aggregator extended with Plan 00 test files alongside Plan 01 sibling-executor entries)"

key-decisions:
  - "Sync hook + async enrichment split: heuristic + cache run synchronously inside the 1500ms hook budget; Haiku 4.5 enrichment moves to classifyAsync() called from Plan 118-01's dispatcher worker, NOT from the hook. Node lacks first-class sync HTTP, so a sync Haiku call inside the hook would either block the budget (deasync busy-loop) or fail probabilistically. The split honors the 1500ms budget deterministically and gives Plan 118-01 a natural async surface for enrichment."
  - "writePending() initializes pipeline_status='pending' (not just the caller's payload). Plan 118-01's dispatcher needs a status enum to coordinate; this avoids a follow-up patch when 118-01 lands. Documented in the test contract (T6)."
  - "Telemetry emits for EVERY classification outcome (venture AND non-venture AND Hebrew refusal), not just ventures. Future analysis needs the full distribution to detect classifier drift; scalar-only schema (no raw prompt) keeps Canon Part 8 invariants intact."

patterns-established:
  - "Hook-budget-deterministic classifier: any future UserPromptSubmit classifier should split sync (budget-safe heuristic + cache) from async (LLM enrichment in dispatcher worker), not call LLMs from inside the hook"
  - "State-file-as-wire: a hook writes a per-session JSON state file; downstream agents read it to coordinate. Atomic tmp+rename guarantees readers never see a half-written file"
  - "sha256-only egress: every disk write (state + telemetry) uses sha256(prompt) as the largest string token; raw user content lives only in transient memory for the classification call"
  - "Hebrew refusal as graceful gate (LD1): non-supported languages SHORT-CIRCUIT classifier; write a hebrew_refusal:true marker so the orchestrator (Plan 118-03) can render the bilingual refusal block without re-classifying"

requirements-completed: [MVA-118-01, MVA-118-02, MVA-118-03]

# Metrics
duration: 50min
completed: 2026-05-15
---

# Phase 118 Plan 00: UserPromptSubmit Detection Summary

**UserPromptSubmit hook + dual-mode (heuristic sync / Haiku-4.5 async) venture-sentence classifier + session-scoped state file at ~/.mindrian/mva/<session-id>.json; this is the entry pin for the entire 30-Second MVA pipeline.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-05-15T15:12:00Z
- **Completed:** 2026-05-15T16:02:00Z
- **Tasks:** 2 (Task 1 TDD RED/GREEN; Task 2 hook wiring + smoke)
- **Files created:** 6
- **Files modified:** 2

## Accomplishments

- Hook fires on every UserPromptSubmit and classifies the prompt in single-digit ms (well under the 1500ms hook budget); S1 smoke test asserts the wall clock invariant per run
- Venture-positive sentences write a state file with sentence_sha256 + classifier metadata + pipeline_status='pending' that Plan 118-01 will read to dispatch the 6 agents
- Hebrew prompts short-circuit BEFORE any API call (per LD1) and write a hebrew_refusal:true marker so Plan 118-03's orchestrator can render the bilingual refusal once
- Length guard (< 12 chars OR > 600 chars) short-circuits without any API or heuristic call (Test T4 verifies fetch counter = 0)
- Heuristic fallback works without any API key (Test T7 verifies fetch counter = 0 when ANTHROPIC_API_KEY absent); the 16-keyword bank + 10-negative-pattern kill list classify with confidence='medium'
- sha256-keyed in-memory cache means a re-typed sentence in the same session returns the cached classification without re-classifying (Test T5 verifies third call leaves fetch counter unchanged)
- Atomic state writes (tmp + renameSync) guarantee Plan 118-01's reader never sees a half-written JSON; source-grep audit in T6 enforces the pattern on every CI run
- Telemetry channel ~/.mindrian/telemetry/v1.13/mva.jsonl captures every classification outcome (venture + non-venture + Hebrew) with sha256-only egress; raw prompts NEVER touch disk (verified by S1 + S3 string-search assertions)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `998d5493` (test: failing tests for classifier + state + heuristic data)
2. **Task 1 GREEN:** `118ed208` (feat: implement mva-classifier + mva-state; 7/7 tests pass)
3. **Task 2:** `8eda1e24` (feat: scripts/mva-detect.cjs + hooks.json wiring + smoke test; 6/6 smoke pass)

All three commits used `git commit --no-verify` per the parallel-wave protocol invariant.

## Files Created/Modified

### Created
- `scripts/mva-detect.cjs` (148 lines) -- UserPromptSubmit hook entry point. Reads stdin JSON, calls classifier, writes state on venture or hebrew_refusal, emits telemetry, always exits 0
- `lib/core/mva-classifier.cjs` (262 lines) -- Two-mode classifier with sync (heuristic + cache) and async (Haiku 4.5) paths
- `lib/core/mva-state.cjs` (135 lines) -- Session-scoped state I/O with atomic tmp+rename writes
- `lib/core/mva-classifier.test.cjs` (228 lines) -- 7 unit tests covering all classifier + state contracts
- `lib/core/mva-detect.smoke.test.cjs` (211 lines) -- 6 spawn-based smoke tests for the hook entry point
- `data/mva-heuristic-keywords.json` -- Heuristic keyword bank (venture_keywords + venture_negative_patterns + Hebrew range)

### Modified
- `hooks/hooks.json` -- mva-detect.cjs registered in UserPromptSubmit array at idx 1, between intent-classifier (0) and brain-derivation-drain (2); timeout=1500ms
- `tests/run-all-118.sh` -- aggregator extended with Plan 00 test paths

## State File Contract (the wire to Plan 118-01)

```
path:     ~/.mindrian/mva/<session-id>.json
            session-id = process.env.CLAUDE_SESSION_ID || 'default'
schema:
  sentence_sha256:        64-hex sha256(prompt)            -- NEVER raw prompt
  classified_at:          epoch ms
  classifier_source:      'heuristic' | 'heuristic_fallback' | 'language_detect' | 'haiku-4-5'
  classifier_confidence:  'high' | 'medium' | 'low' | null
  locale:                 'en' | 'he'
  hebrew_refusal:         true                              -- only on LD1 branch
  pipeline_status:        'pending' | 'running' | 'complete'
  started_at:             epoch ms (set by markRunning)
  completed_at:           epoch ms (set by markComplete)
atomicity:                writeFileSync to <file>.tmp.<pid>.<rand>, then
                          fs.renameSync (rename is POSIX-atomic; readers
                          never see a half-written file)
reader API:               require('lib/core/mva-state.cjs').readPending()
                          returns null on absent / parse-error / read-error
                          (graceful: readers treat null as "no pending")
```

## Telemetry Channel

```
path:     ~/.mindrian/telemetry/v1.13/mva.jsonl
event:    mva_classified
schema:
  event:                 'mva_classified'
  timestamp:             ISO8601
  sha256_of_sentence:    64-hex
  venture:               bool
  source:                classifier_source enum string
  confidence:            classifier_confidence enum or null
  reason:                classification reason string or null
  classified_in_ms:      wall-clock elapsed scalar
```

Mirrors the Phase 110 sanitized-telemetry pattern (sha256 + scalar-only). Per OQ8 lean, Plan 118-00 owns this path under the precedent of Plan 88.1-16 query-efficiency-telemetry; Phase 121 trajectory telemetry can later co-mount or hand off.

## Decisions Made

See `key-decisions` in frontmatter. Three primary calls:

1. **Sync hook + async enrichment split.** Node lacks first-class sync HTTP, so calling Haiku inside the 1500ms hook would either block (deasync busy-loop) or fail probabilistically. The split honors the budget deterministically and gives Plan 118-01 a natural async surface.

2. **writePending() initializes pipeline_status='pending'.** Plan 118-01's dispatcher needs a status enum to coordinate; this avoids a follow-up patch when 118-01 lands. Documented in the test contract (T6 expects pipeline_status:'pending' after writePending).

3. **Telemetry emits for every classification outcome.** Future drift detection needs the full distribution; scalar-only schema keeps Canon Part 8 intact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] writePending() initializes pipeline_status='pending'**
- **Found during:** Task 1 GREEN test run
- **Issue:** Plan 118-00 plan-task-1 says "writePending(payload) then readPending() returns the same object" -- but Plan 118-01's dispatcher needs `pipeline_status` as a coordination enum (markRunning sets 'running', isAlreadyRunning gates re-fire on 'running'). If writePending stored the bare payload, the first markRunning() would write a status field that was undefined on initial read, leaving an ambiguous gap between writePending and markRunning where readPending().pipeline_status === undefined.
- **Fix:** writePending() merges {pipeline_status: 'pending'} into the body. T6 now asserts (a) all caller fields preserved byte-identical AND (b) pipeline_status='pending' after writePending.
- **Files modified:** lib/core/mva-state.cjs (writePending merge), lib/core/mva-classifier.test.cjs (T6 widened from deepEqual to field-subset + status assertion)
- **Verification:** T6 GREEN; downstream dispatcher tests (lib/core/mva-dispatcher.test.cjs from sibling Plan 118-01) read pipeline_status without ambiguity
- **Committed in:** 118ed208 (Task 1 GREEN)

**2. [Rule 3 - Blocking] process.stdout.write IS required for hook envelope (precedent reconciliation)**
- **Found during:** Task 2 done-criteria audit
- **Issue:** Plan 118-00 Task 2 done criteria says "mva-detect.cjs has zero stdout writes (verify: grep 'process.stdout' returns 0; stderr-only for errors)". But Claude Code's hook protocol requires the hook to emit its envelope JSON (`{"continue": true, ...}`) on STDOUT for the hook system to consume. The precedent the plan says to mirror -- scripts/auto-explore-drain.cjs:55 -- itself uses `process.stdout.write(JSON.stringify(filtered))` for the envelope.
- **Fix:** scripts/mva-detect.cjs uses exactly one stdout write (the envelope emit inside emitEnvelope, wrapped in try/catch so it never throws). All error reporting goes to stderr. Mirrors the auto-explore-drain.cjs pattern verbatim.
- **Files modified:** scripts/mva-detect.cjs (line 60: `process.stdout.write(JSON.stringify(filtered))` inside try/catch)
- **Verification:** S1-S5 smoke tests confirm hook exits 0 and the envelope reaches the spawnSync caller via stdout; S6 source-grep confirms the only stdout write is the envelope path, not a side-channel print
- **Committed in:** 8eda1e24 (Task 2)
- **Reconciliation:** Future re-readers of the plan should treat the "zero stdout writes" done criterion as "zero stdout writes outside the canonical hook envelope emit". This is consistent with the plan's "Implementation references: scripts/auto-explore-drain.cjs (precedent stdin-reading hook)" instruction at Task 2 Step 1.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking-precedent reconciliation)
**Impact on plan:** Both auto-fixes preserve plan intent. The first hardens the contract Plan 118-01 reads (no ambiguous status gap); the second reconciles the done-criterion grep with the precedent the plan instructs us to mirror.

## Issues Encountered

None during planned work. The sandbox blocked one `set +e` shell script the planner asked me to run during the end-to-end verification block (Plan verification step 2-6), but the smoke test (lib/core/mva-detect.smoke.test.cjs) exercises every step of that verification block via spawnSync, so the verification surface is preserved; the sandbox just blocked the redundant inline form.

## Canon Part 8 Self-Audit

All three new code files (scripts/mva-detect.cjs, lib/core/mva-classifier.cjs, lib/core/mva-state.cjs) verified clean via:

```
grep -rE "brain_query|brain_search|mcp__brain_|require.*brain-client" \
  scripts/mva-detect.cjs lib/core/mva-classifier.cjs lib/core/mva-state.cjs
```

exit=1 (no matches; clean).

The OUTBOUND payload to Anthropic (in classifyAsync()) carries the user's sentence. This is the Anthropic-direct boundary, NOT the Brain MCP boundary. Per Canon Part 8 the boundary is `LOCAL -> BRAIN: NO`; Anthropic is a separate boundary. The state file and telemetry channel both honor the LOCAL boundary by writing sha256(prompt) only -- the raw sentence never reaches disk.

## LD1 / LD2 References

- **LD1 (English-only for v1.13.0, Hebrew refusal retained):** Honored. Classifier detects U+0590-U+05FF range in single-char check BEFORE Haiku call; T3 + S3 assert the refusal envelope and that no fetch is attempted. State carries `hebrew_refusal: true` + `locale: 'he'`; Plan 118-03's orchestrator will read this and render the bilingual refusal text once.
- **LD2 (Vercel REST API direct):** Not Plan 00's concern; LD2 governs Plan 118-04. Plan 00 emits no Vercel calls.

## Hook Position (hooks.json UserPromptSubmit)

```
[0] intent-classifier        timeout=2000  (Phase 99 precedent)
[1] mva-detect.cjs           timeout=1500  (Plan 118-00, this plan)
[2] brain-derivation-drain   timeout=2000  (Phase 90)
[3] operator-update.cjs      timeout=3000  (Phase 99)
[4] jtbd-update.cjs userprompt timeout=3000 (Phase 100)
[5] auto-explore-drain.cjs   timeout=3000  (Phase 117)
```

mva-detect runs AFTER intent-classifier (so operator state is fresh) and BEFORE brain-derivation-drain + auto-explore-drain (so downstream hooks see the MVA state file mva-detect just wrote).

## Self-Check: PASSED

Files verified present on disk:
- FOUND: scripts/mva-detect.cjs (5938 bytes, executable)
- FOUND: lib/core/mva-classifier.cjs (13368 bytes)
- FOUND: lib/core/mva-state.cjs (5161 bytes)
- FOUND: lib/core/mva-classifier.test.cjs (9917 bytes)
- FOUND: lib/core/mva-detect.smoke.test.cjs (7962 bytes)
- FOUND: data/mva-heuristic-keywords.json (951 bytes)
- FOUND: .planning/phases/118-30-second-mva-reward-before-investment/118-00-SUMMARY.md (this file)

Commits verified in git log:
- FOUND: 998d5493 (test 118-00 RED)
- FOUND: 118ed208 (feat 118-00 GREEN Task 1)
- FOUND: 8eda1e24 (feat 118-00 Task 2 + hook wiring)

Test suites green:
- lib/core/mva-classifier.test.cjs: 7/7 pass
- lib/core/mva-detect.smoke.test.cjs: 6/6 pass
- Phase 118 aggregator (tests/run-all-118.sh): 5/5 suites green (Plan 00 + Plan 01 entries)

## Next Phase Readiness

Plan 118-01 (dispatch architecture) is unblocked. Its dispatcher reads `lib/core/mva-state.cjs::readPending()` to see whether a venture sentence is pending; calls `markRunning()` before the 6-agent fan-out; calls `markComplete()` after the deck deploys. The state-file contract is frozen by this plan and verified by T6.

Plan 118-03 (progressive streaming / orchestrator) will read the same state file and additionally branch on `hebrew_refusal === true` to render the LD1 bilingual refusal block.

Plan 118-04 (Feynman deck Vercel deploy) consumes the venture-positive state via Plan 118-01's dispatcher; no direct read of Plan 00's state surface.

Sibling executor (Plan 118-01) committed in parallel; its dispatcher tests (8/8) already GREEN against Plan 00's state contract -- the two plans land cleanly together in the same wave.

---
*Phase: 118-30-second-mva-reward-before-investment*
*Plan: 00 (userprompt-detection)*
*Completed: 2026-05-15*
