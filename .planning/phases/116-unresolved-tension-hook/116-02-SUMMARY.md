---
phase: 116-unresolved-tension-hook
plan: "116-02"
subsystem: agentic-surfacing
tags: [tension-hook, agentic, graph-native, canon-part-3, canon-part-4, canon-part-8, canon-part-10-subclaim-3, f1-dispatch, resolves-via, neutral-citation]

# Dependency graph
requires:
  - phase: 88.2-uiux-selector-block (Plan 88.2-04 + 88.2-05)
    provides: F.1 dispatch via lib/hmi/selector-dispatcher.cjs::pickShape({requestedShape:'F.1'}); F.0 sibling buildRejectedBecauseEdge precedent that buildResolvedViaEdge mirrors
  - phase: 89-reverse-salient-engine (Plan 89-07-02)
    provides: surfaceFinding + handleUserResponse skeleton; the 116-02 agent is a structural mirror with F.1 substituted for F.0 + RESOLVES_VIA substituted for the rs-engine cascade-edge mapping + JSONL state machine routing instead of telemetry-only response paths
  - phase: 109-sql-context-memory-navigation-spine
    provides: lib/core/navigation.cjs closed surface (D-06 chokepoint adherence)
  - phase: 116-00 (Wave 0 scaffold)
    provides: 5 EVENT_TYPES strings registered (tension_detected/surfaced/resolved/decayed/skipped); Wave-0 test stubs that this plan promotes to GREEN assertions
  - phase: 116-01 (Wave 1 detection substrate)
    provides: lib/memory/pending-tension-store.cjs (markResolved + requeue + readTensions + appendTension) + scripts/preflight-tension-surface.cjs SessionStart hook + findSurfaceableTensions on the closed surface
provides:
  - lib/agents/tension-hook-agent.cjs (4 exports + F1_VERBS + F1_HEADER constants; mirrors 89-07 ReverseSalientAgent skeleton with F.1 dispatch + RESOLVES_VIA cascade emission)
  - tests/test-tension-hook-f1-integration.cjs promoted from Wave-0 stub to 15 real assertions covering AC-2 + AC-3
  - tests/test-tension-hook-rendering.cjs promoted from Wave-0 stub to 10 real assertions covering AC-8 automated portion (byte-identical pickShape repeated-call determinism)
affects: [116-03, 116-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "89-07 ReverseSalientAgent surfaceFinding + handleUserResponse skeleton mirrored with F.1 substitution (instead of F.0) and RESOLVES_VIA cascade emission (instead of mode-mapped 5-edge cascade)"
    - "buildResolvedViaEdge sibling helper mirrors 88.2-05's buildRejectedBecauseEdge: full input validation -> lazy require lazygraph-ops -> upsertEdge -> graceful try/catch envelope"
    - "Pre-dispatch suppression short-circuit: tier===0 + operator==='JUST_TALK' both return {surfaced:false, suppress_reason:...} BEFORE the dispatcher.pickShape call, mirroring RESEARCH 3.4 + Pitfall 5"
    - "Canon Part 8 Larry-voice routing split: this module is the response-routing surface (no user content); the citation rendering lives in 116-01's composeLarryVoiceDirective additionalContext block"
    - "D-02 neutral framing enforcement: zero persona-suffix module imports; recommendedVerb:null even in Mode A; agent does NOT consume the Phase 115 persona variant module"
    - "Test substitution via require.cache stubs (mirrors test-reverse-salient-f0-integration.cjs precedent) so the dispatcher / lazygraph / pendingStore can be swapped per-test without mutating module state"

key-files:
  created:
    - lib/agents/tension-hook-agent.cjs
  modified:
    - tests/test-tension-hook-f1-integration.cjs (Wave-0 stub replaced with 15 real assertions)
    - tests/test-tension-hook-rendering.cjs (Wave-0 stub replaced with 10 real assertions)

key-decisions:
  - "RESOLVES_VIA edge type already shipped in EDGE_TYPES (lib/core/lazygraph-ops.cjs:25) per RESEARCH Section 9 finding. No EDGE_TYPES extension needed; buildResolvedViaEdge passes `type:'RESOLVES_VIA'` to the existing upsertEdge primitive. Total EDGE_TYPES count remains 23."
  - "properties.source='tension-hook' attribution distinguishes the agent's RESOLVES_VIA edges from any future rs-engine-sourced RESOLVES_VIA edges. Downstream telemetry / audits can filter by source to attribute cascade origins."
  - "buildResolvedViaEdge lives ON the agent module (not on pending-tension-store) to keep pending-tension-store STORAGE-only (per Wave-1 architecture). The agent is the natural home for cascade-edge emission since it owns the user-response routing."
  - "SKIP path uses appendTension (not markSurfaced) because markSurfaced increments surfacing_count; SKIP must NOT consume a strike. Per RESEARCH 11.2 SKIP records last_response='SKIP' on a NEW transition entry preserving state='surfaced' so the next SessionStart re-evaluates whether to surface again."
  - "Suppression short-circuit fires BEFORE dispatcher.pickShape rather than after the dispatcher's own refuse path. Reasons: (1) avoids wasted CPU on a payload that will be dropped, (2) records the more semantic suppress_reason ('tier_0' / 'just_talk') vs the dispatcher's error code ('tier-0-refused' / 'render_v2_compaction_violation'), (3) matches the 89-07 ReverseSalientAgent pattern verbatim."
  - "Telemetry deferred to Wave 4 per RESEARCH ordering. The agent module deliberately omits recordSelectorMirror calls; the dispatcher's own emitTelemetry:true flag fires selector_presentation events, but tension_detected / tension_surfaced / tension_resolved / tension_skipped / tension_decayed events fire from the agent in Wave 4 (116-04). Suppression-paths-still-emit-telemetry (per Pitfall 5 / D-04c) is enforced when 116-04 wires the recordSelectorMirror calls; the agent is structured so the future insertion is one line at each return path."

requirements-completed: [TENSION-116-SURFACE, TENSION-116-F1]
# TENSION-116-DECAY / TENSION-116-TELEMETRY remain for Waves 3+4.

# Metrics
duration: 14min
completed: 2026-05-06
---

# Phase 116 Plan 116-02: F.1 Surface + Response Routing Summary

**Lands the F.1 Mini Decision Gate dispatch + neutral-citation Larry-voice surface + user-response routing + RESOLVES_VIA typed cascade edge emission. The closed loop now has its production-code path: when Claude reads the SessionStart additionalContext directive from 116-01 and dispatches F.1 via AskUserQuestion, the user's pick (Resolve / Later / Skip) routes back through this module which (a) updates JSONL state and (b) emits RESOLVES_VIA cascade edge on Resolve.**

## Performance

- **Duration:** ~14 minutes
- **Started:** 2026-05-06 (Wave-2 F.1 surface)
- **Tasks:** 2 (both auto + tdd)
- **Files created:** 1 (lib/agents/tension-hook-agent.cjs, 405 LOC)
- **Files modified:** 2 (test-tension-hook-f1-integration.cjs Wave-0 stub -> 477 LOC; test-tension-hook-rendering.cjs Wave-0 stub -> 192 LOC)
- **Total Wave-2 LOC delta:** +1052 / -34
- **Parallel-executor mode:** all 2 commits used --no-verify per orchestrator contract

## Accomplishments

- 4 exports + 2 constants of `lib/agents/tension-hook-agent.cjs` (405 LOC) ship: `composeFinding`, `surfaceFinding`, `buildResolvedViaEdge`, `handleUserResponse`, `F1_VERBS`, `F1_HEADER`. Module follows the 89-07 ReverseSalientAgent skeleton (Steps 5+6 of `docs/AGENTIC-SURFACING-PATTERN.md`) with F.1 substitution for F.0 and RESOLVES_VIA substitution for the mode-mapped 5-edge cascade.
- `surfaceFinding` short-circuits BEFORE `dispatcher.pickShape` on `tier===0` (returns `{surfaced:false, suppress_reason:'tier_0'}`) and `operator==='JUST_TALK'` (returns `{surfaced:false, suppress_reason:'just_talk'}`). On valid call, dispatches via `pickShape({requestedShape:'F.1', payload:{verbs:['Resolve','Later','Skip'], header:F1_HEADER, recommendedVerb:null, emitTelemetry:true}})`. Per D-02 neutral: `recommendedVerb:null` even in Mode A. On dispatcher error envelope, captures `result.rendered.error` as `suppress_reason`.
- `handleUserResponse` implements three branches per CONTEXT.md D-04b state machine + RESEARCH Section 11.2:
  - **RESOLVE**: `pendingStore.markResolved(roomSlug, finding.id, 'RESOLVE')` (state -> 'resolved') + `buildResolvedViaEdge` (RESOLVES_VIA cascade edge with `properties.source='tension-hook'`)
  - **LATER**: `pendingStore.requeue(roomSlug, finding.id)` (state -> 'queued'; `surfacing_count` NOT decremented per RESEARCH 11.2)
  - **SKIP**: `readTensions(roomSlug)` -> find current entry -> `appendTension(roomSlug, {...current, last_response:'SKIP'})` preserving `state='surfaced'` so next SessionStart re-evaluates
  - **FREE_TEXT**: log only; Larry interprets per Canon Part 3 Verb 10; no JSONL state change.
- `buildResolvedViaEdge` mirrors 88.2-05's `buildRejectedBecauseEdge` precedent: full input validation (`tension_id` non-empty, `source_node_id` non-empty, `target_node_id` non-empty, `parent_decision_id` non-empty, `db` truthy) -> lazy `require('../core/lazygraph-ops.cjs')` -> `upsertEdge(db, {type:'RESOLVES_VIA', source:source_node_id, target:target_node_id, properties:{source:'tension-hook', agent:'unresolved-tension', tension_id, parent_decision_id, resolved_at}})` -> graceful try/catch envelope; never throws.
- `composeFinding` builds a Canon-Part-8-clean finding object: caller-supplied `tension_id` (re-used as the deterministic `id`) + `tension_type` + `source_node_id` + `target_node_id` + `source_section` + `target_section`. Zero `body_text` / `source_title` / `target_title` / `quoted_text` fields (those live in the graph and are fetched by Larry on his first turn via 116-01's INSTRUCTION FOR LARRY directive).
- 25 real assertions across 2 test files (15 F.1 integration + 10 rendering determinism) replace Wave-0 stubs. Both files cover their target ACs in the Validation Architecture matrix; integration covers AC-2 + AC-3 (F.1 dispatch + Resolve / Later / Skip paths + RESOLVES_VIA edge); rendering covers AC-8 automated portion (byte-identical pickShape repeated-call determinism + JUST_TALK + tier=0 suppression paths).
- R1 byte-equal invariant preserved on `lib/hmi/shape-f6-renderer.cjs` (sha256 `1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf`).
- Wave-0 + Wave-1 sibling tests (35 assertions across 4 files: decay + detection + persistence + telemetry) still PASS unchanged.

## Task Commits

Each task was committed atomically with --no-verify (parallel executor mode):

1. **Task 1: Create lib/agents/tension-hook-agent.cjs (4 exports + 89-07 skeleton mirror) + tests/test-tension-hook-f1-integration.cjs (15 real assertions)** - `ce7f333` (feat) - 870 insertions / 18 deletions
2. **Task 2: Promote tests/test-tension-hook-rendering.cjs to AC-8 assertions (10 real tests)** - `6f60bef` (test) - 182 insertions / 16 deletions

**Plan metadata commit:** Pending (created with this SUMMARY).

## Files Created/Modified

### Created (1 file)

- `lib/agents/tension-hook-agent.cjs` (405 lines) -- F.1 surface module. 4 function exports (composeFinding, surfaceFinding, buildResolvedViaEdge, handleUserResponse) + 2 constants (F1_VERBS, F1_HEADER). Anti-pattern clean: zero `room-db` requires (Phase 109 D-06 chokepoint preserved), zero `brain-client` requires (Canon Part 8 boundary preserved), zero `console.log` / `process.stdout.write` calls (RESEARCH 13.9 telemetry side-channel rule), zero `persona_variants` consumption (D-02a Phase 115 NOT consumed), zero `reverse-salient-persona-suffix` import (D-02 neutral), zero inline `AskUserQuestion(` call sites (D-06 dispatch-only). Lazy requires for dispatcher + lazygraph let tests substitute via `require.cache` per-test.

### Modified (2 files)

- `tests/test-tension-hook-f1-integration.cjs` -- Wave-0 stub (4 substrate assertions) replaced with 15 real assertions covering AC-2 + AC-3. Tests use `require.cache` stub substitution per `tests/test-reverse-salient-f0-integration.cjs` precedent. Coverage: export shape (Tests 1-2); suppression branches tier_0 / just_talk / invalid_finding (Tests 3-5); F.1 dispatch contract (Test 6 -- the load-bearing assertion); dispatcher error envelope (Test 7); handleUserResponse RESOLVE / LATER / SKIP (Tests 8-10); buildResolvedViaEdge happy + invalid + missing-db (Tests 11-13); composeFinding determinism + Canon Part 8 cleanliness (Test 14); anti-pattern grep clean comprehensive (Test 15 -- 9 sub-assertions covering room-db / brain-client / console.log / persona-suffix / persona-variants / AskUserQuestion / em-dash + F.1 literal + RESOLVES_VIA literal + tension-hook attribution literal).
- `tests/test-tension-hook-rendering.cjs` -- Wave-0 stub (3 substrate assertions) replaced with 10 real assertions covering AC-8 automated portion. Tests use the real dispatcher (no mocks; the F.1 renderer is pure CJS with no FS reads). Coverage: byte-identical determinism (Test 1 -- the load-bearing AC-8 assertion); contract.verbs auto-append + de-dup (Tests 2 + 8); contract.shape + keyboard literals (Tests 3-4); tier=1 Mode B no recommendation (Test 5); tier=2 Mode A still no recommendation per D-02 (Test 6); canonical De Stijl header (Test 7); tier=0 + JUST_TALK error envelope (Tests 9-10).

## Decisions Made

- **OQ-2 / D-08: F.1 body shape distinct from F.0.** The dispatcher already routes F.0 and F.1 to separate renderers (`shape-f0-renderer.cjs` vs `shape-f1-renderer.cjs`). F.0 contract has 3 closed verbs `[Approve, Reject, Defer]` with `freeTextOffered:false`; F.1 contract has up to 5 user verbs + Free-Text auto-appended (`freeTextOffered:true`). Verified byte-distinct contracts in Test 2 + Test 4 (rendering tests). No additional renderer work needed; this plan only consumes the existing F.1 dispatch path.
- **EDGE_TYPES non-extension.** Confirmed `RESOLVES_VIA` already in `lib/core/lazygraph-ops.cjs:25` `EDGE_TYPES` array (RESEARCH Section 9 finding verified). `buildResolvedViaEdge` passes `type:'RESOLVES_VIA'` to the existing `upsertEdge` primitive without modifying `EDGE_TYPES`. Total `EDGE_TYPES` count remains 23.
- **buildResolvedViaEdge homed on agent module (not pending-tension-store).** Per the Wave-1 architecture, `pending-tension-store.cjs` is STORAGE-only (JSONL append + LWW replay). Cascade-edge emission belongs on the agent surface that owns the user-response routing. This keeps `pending-tension-store` graph-clean (zero `lazygraph-ops` imports) and preserves the layer separation.
- **SKIP uses appendTension, not markSurfaced.** `markSurfaced` increments `surfacing_count`, which would consume a strike against the 3-strikes decay budget per D-03a. SKIP must NOT consume a strike per RESEARCH 11.2. Solution: `readTensions` -> find current entry -> `appendTension` with `last_response='SKIP'` preserving `state='surfaced'`. Verified in Test 10: `appendCalls[0].entry.last_response === 'SKIP'` and `appendCalls[0].entry.state === 'surfaced'`; `markCalls.length === 0` and `requeueCalls.length === 0`.
- **Pre-dispatch suppression short-circuit (not post).** Both tier=0 and JUST_TALK paths refuse BEFORE calling `dispatcher.pickShape`. Reasons: (1) saves the dispatcher CPU cost for a payload that would be refused anyway, (2) records the more semantic `suppress_reason` ('tier_0' / 'just_talk') instead of the dispatcher's lower-level error codes ('tier-0-refused' / 'render_v2_compaction_violation'), (3) matches the 89-07 ReverseSalientAgent pattern verbatim. Verified in Tests 3 + 4: `dispatcherCalls.length === 0` after suppression.
- **Telemetry deferred to Wave 4 (116-04).** The agent module deliberately omits `recordSelectorMirror` calls. The dispatcher's `emitTelemetry:true` flag still fires `selector_presentation` events on successful dispatch, but the dedicated `tension_detected` / `tension_surfaced` / `tension_resolved` / `tension_skipped` / `tension_decayed` events fire from the agent in Wave 4 per the 116-RESEARCH ordering. The agent is structured so the future telemetry insertion is a single line at each return path (matching 89-07's `emitDetected` / `emitActedOn` insertion pattern). Suppression-paths-still-emit-telemetry (per Pitfall 5 / D-04c) lands when 116-04 wires the calls.
- **persona_variants grep cleanliness fix on first run.** Initial draft had a literal `persona_variants` mention in the file header docs ("Phase 115 persona_variants module is NOT consumed"). The Test 15 anti-pattern grep flagged it because the comment-stripping regex doesn't run against the substring count assertion. Reworded to "the Phase 115 persona variant module is NOT consumed" -- behavioral phrasing instead of literal API name. Same mitigation pattern Wave 1 used on its own anti-pattern grep cleanliness pass (per 116-01-SUMMARY.md Test 14 fix).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 15 anti-pattern grep flagged file-header docs**
- **Found during:** Task 1 verification (15 tests run, but acceptance criteria check `grep -F "persona_variants"` returned 1)
- **Issue:** The acceptance criteria's literal `grep -F 'persona_variants'` substring check matched the file header documentation paragraph that uses the literal API name to teach the rule. The test (which strips comments first) passed; the acceptance criteria substring grep did not.
- **Fix:** Reworded the file header from "Phase 115 persona_variants module is NOT consumed" to "the Phase 115 persona variant module is NOT consumed" -- behavioral phrasing instead of a literal API name. Both the Test 15 regex (which strips comments first) and the acceptance criteria literal substring grep now pass.
- **Files modified:** `lib/agents/tension-hook-agent.cjs` (header docs only; functional code unchanged)
- **Verification:** Acceptance criteria checks all green: 0 hits on `room-db`, 0 on `brain-client`, 0 on `console.log` / `process.stdout.write`, 0 on `persona_variants`, 0 on `reverse-salient-persona-suffix`, 0 on `AskUserQuestion(`, 0 on em-dashes.
- **Committed in:** `ce7f333` (Task 1 commit; the fix landed before commit so the commit reflects the post-fix file)

### Out-of-scope discoveries (logged, not fixed)

None this wave. The Wave-3 sibling stub (decay) and Wave-4 sibling stub (telemetry) remain Wave-0/1 placeholders awaiting their respective Waves. This is the documented hand-off pattern.

---

**Total deviations:** 1 auto-fixed (Rule 1 -- documentation rewording)
**Impact on plan:** None on substance; reworded one docstring phrase to match the acceptance criteria's grep-clean invariant. All other Task 1 + Task 2 acceptance criteria green on first run.

## Issues Encountered

None blocking. The 1 deviation above was caught by Task 1 acceptance criteria check (literal substring grep after Test 15 regex passed) and resolved inline. Task 2 ran clean (all 10 rendering tests + all acceptance criteria green on first verification).

## Anti-pattern Guard Verification

```
$ grep -E "require.*core/room-db" lib/agents/tension-hook-agent.cjs | wc -l
0  -- Phase 109 D-06 chokepoint preserved

$ grep -E "brain-client|brain_client" lib/agents/tension-hook-agent.cjs | wc -l
0  -- Canon Part 8 boundary preserved

$ grep -E "console\.log|process\.stdout\.write" lib/agents/tension-hook-agent.cjs | wc -l
0  -- RESEARCH 13.9 telemetry side-channel rule

$ grep -F "persona_variants" lib/agents/tension-hook-agent.cjs | wc -l
0  -- D-02a Phase 115 NOT consumed

$ grep -F "reverse-salient-persona-suffix" lib/agents/tension-hook-agent.cjs | wc -l
0  -- D-02 neutral citation (no persona suffix)

$ grep -F "AskUserQuestion" lib/agents/tension-hook-agent.cjs | wc -l
0  -- D-06 dispatch-only (no inline AskUserQuestion calls)

$ grep -P "\x{2014}" lib/agents/tension-hook-agent.cjs tests/test-tension-hook-f1-integration.cjs tests/test-tension-hook-rendering.cjs | wc -l
0  -- zero em-dashes across all 3 116-02 deliverables (memory rule feedback_no_emdashes)

$ node -e "const m=require('./lib/agents/tension-hook-agent.cjs'); ['composeFinding','surfaceFinding','buildResolvedViaEdge','handleUserResponse'].forEach(k=>{ if(typeof m[k]!=='function') throw new Error(k); }); console.log('OK');"
OK  -- 4 function exports verified

$ node -e "const lz=require('./lib/core/lazygraph-ops.cjs'); if(!lz.EDGE_TYPES.includes('RESOLVES_VIA')) throw new Error('RESOLVES_VIA missing'); console.log('OK count=',lz.EDGE_TYPES.length);"
OK count= 23  -- RESOLVES_VIA preserved on the existing closed surface
```

## R1 Invariant Confirmation

```
$ sha256sum lib/hmi/shape-f6-renderer.cjs
1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf  lib/hmi/shape-f6-renderer.cjs
```

Phase 101-01 R1 byte-equal preserved across this plan.

## Canon Part 8 Boundary Confirmation

- `lib/agents/tension-hook-agent.cjs`: zero Brain client imports verified by grep; the agent is graph-LOCAL throughout (per CONTEXT line 144: "Phase 116 has NO direct dependency on Phase 110 -- it stays graph-LOCAL throughout"). Reads route through `lib/core/navigation.cjs` (chokepoint preserved); writes route through `lib/core/lazygraph-ops.cjs upsertEdge` (typed-edge chokepoint preserved). The finding object built by `composeFinding` is Canon-Part-8-clean by construction (verified in Test 14: zero `body_text` / `source_title` / `target_title` / `quoted_text` fields). The user-content denylist enforcement happens upstream at `pending-tension-store.appendTension` time.
- The RESOLVES_VIA edge `properties` carry only enum scalars + sha256 hashes + integers + ISO timestamps (`source:'tension-hook'`, `agent:'unresolved-tension'`, `tension_id:32-hex`, `parent_decision_id:'tension:32-hex'`, `resolved_at:ISO-8601`, optional `actor_id:string`). Zero user-content strings.

## D-02 Neutral Citation Confirmation

The agent does NOT consume:
- Phase 115 persona variant module (zero `persona_variants` references)
- 89-07's reverse-salient-persona-suffix module (zero `reverse-salient-persona-suffix` references)
- Any role_blend resolution helper (the 89-07 `resolvePersonaKey` / `resolvePersonaSuffix` helpers are agent-private)

`recommendedVerb:null` is hard-coded in the `dispatcher.pickShape` payload, even when tier>=2 (Mode A). Verified in rendering Test 6: `r.rendered.contract.recommended === null` at tier=2. Per CONTEXT.md D-02 (locked): Founders, researchers, and investors all see identical wording.

## D-08 Three-Surface Determinism Confirmation

The agent has zero surface-specific code paths. The F.1 surface render is identical across CLI / Desktop / Cowork because:
1. 88.2-05 `selector-dispatcher` already shipped tri-polar (D-08 verified at 88.2-05 release).
2. `shape-f1-renderer` is pure CJS with zero FS reads (verified at 88.2-01 release).
3. The agent's `surfaceFinding` calls `dispatcher.pickShape` with the same payload regardless of surface; surface detection is the dispatcher / renderer's responsibility, not the agent's.

Verified in rendering Test 1: byte-identical `rendered.zones.body` on repeated `pickShape` calls with identical inputs. Manual cross-surface smoke (the AC-8 manual portion) is documented in `116-VALIDATION.md`.

## Wave-2 -> Wave-3 Handoff

Wave 3 (116-03) wires the decay state machine fixture tests over `markSurfaced` + `markResolved` + `markDropped` + `requeue` with cross-session JSONL replay assertions. The 3-strikes rule per D-03a (after 3 surfacings without resolve, transition to `dropped`) is enforced at SessionStart query time (D-03b filter excludes `surfacing_count >= 3` in `findSurfaceableTensions`) AND at the JSONL transition (Wave 3 will add a `decayIfMaxSurfacings(roomSlug)` helper that scans + transitions queued entries with surfacing_count >= 3 to dropped before the next surface attempt).

Real assertions in `tests/test-tension-hook-decay.cjs` (currently Wave-0 stub) replace the placeholder, covering AC-4 + AC-5.

The Wave-2 surface provides everything Wave 3 needs: `handleUserResponse` LATER path correctly preserves surfacing_count (no decrement); RESOLVE path terminally transitions to 'resolved' (Wave 3 verifies it never re-surfaces); SKIP path preserves state='surfaced' so Wave 3 can verify cross-session re-evaluation.

## Wave-2 -> Wave-4 Handoff

Wave 4 (116-04) wires:
- `recordSelectorMirror(roomDir, 'tension_detected', payload)` insertion at the suppression branches in `surfaceFinding` per Pitfall 5 / D-04c
- `recordSelectorMirror(roomDir, 'tension_surfaced', payload)` on successful dispatch
- `recordSelectorMirror(roomDir, 'tension_resolved' | 'tension_skipped' | 'tension_decayed', payload)` on the corresponding `handleUserResponse` paths
- Real assertions in `tests/test-tension-hook-telemetry.cjs` (currently Wave-0 stub) covering AC-3 + AC-7 (Canon Part 8 substring audit on JSON.stringify(payload))
- v1.13.0-beta.5 release plumbing (CHANGELOG bump, plugin.json version, marketplace ref)

The agent's return shapes already carry `latency_ms` (computed from `surfaceStartedAtMs`), the response enum (`'RESOLVE'` / `'LATER'` / `'SKIP'` / `'FREE_TEXT'`), and the `jsonl` / `edge` sub-results -- all of which Wave 4 can mirror to telemetry without restructuring the agent.

## Self-Check: PASSED

**Created files (1) verified on disk:**
- FOUND: lib/agents/tension-hook-agent.cjs (405 LOC, syntax check OK, 4 function exports + F1_VERBS + F1_HEADER constants present)

**Modified files (2) verified in git diff:**
- FOUND: tests/test-tension-hook-f1-integration.cjs (Wave-0 stub replaced with 15 real assertions; 15/15 PASS)
- FOUND: tests/test-tension-hook-rendering.cjs (Wave-0 stub replaced with 10 real assertions; 10/10 PASS)

**Commits verified in git log:**
- FOUND: ce7f333 (Task 1: tension-hook-agent + F.1 integration tests)
- FOUND: 6f60bef (Task 2: rendering tests)

**Verification gates (10 of 10 GREEN):**
- 15/15 F.1 integration tests PASS
- 10/10 rendering tests PASS
- 25/25 Wave-2 test pair PASS together
- 35/35 Wave 0+1 sibling tests still PASS unchanged (decay + detection + persistence + telemetry)
- F.1 dispatch shape contract verified: `pickShape({requestedShape:'F.1'}) -> {shape:'F.1', rendered.contract.verbs:['Resolve','Later','Skip','Free-Text']}`
- Tier 0 + JUST_TALK suppression short-circuit pre-dispatch verified
- 4 anti-pattern greps return 0 (room-db, brain-client, console, persona modules)
- 0 hits on em-dashes across all 3 116-02 deliverables
- R1 byte-equal preserved (`1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf`)
- EDGE_TYPES preserved at 23 (RESOLVES_VIA already shipped; no extension needed)

---
*Phase: 116-unresolved-tension-hook*
*Completed: 2026-05-06*
