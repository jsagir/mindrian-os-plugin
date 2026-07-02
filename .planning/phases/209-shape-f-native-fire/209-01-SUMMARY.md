---
phase: 209-shape-f-native-fire
plan: 01
subsystem: hmi
tags: [shape-f, askuserquestion, dial-presenter, selector-dispatcher, intent-classifier, native-fire]

# Dependency graph
requires:
  - phase: 209-shape-f-native-fire (Wave 1, quick gate-native-fire-w1)
    provides: appendAskUserQuestionTrailer emits marker + BINDING line (E1); ui-system fire mandate (P3)
provides:
  - Engine-arm dial block now carries the BINDING line and a machine-readable AskUserQuestion contract (JSON payload), not just the scalar marker (E2)
  - Dial row labels resolve {topic}/{room_name} from live room context instead of the elevation fallback (E3)
  - emitBindingGate (F.8 binding gate) carries zones.footer + trailer (marker + binding) + guidance that names AskUserQuestion (E4)
affects: [209-02 B1/B2/B3 render rollout, 209-03 E5/H3/H4 conversational bridge, 209-04 eval gate + run-all-209, 209 incident replay]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SEED-020 trailer-door exemption reused a second time: a session-unbound / tier-agnostic gate mints its AskUserQuestion trailer via appendAskUserQuestionTrailer (dispatcher-owned), NOT pickShape, because pickShape's Canon Part 3 tier-0 refuse would suppress the gate"
    - "Tamper-safe contract serialization: the machine-readable contract line is built field-by-field from rendered.contract and JSON.stringify'd, never string-concatenated from unescaped label text (T-209-01)"
    - "Presence-guarded positional trailer reads: each appended line (marker / binding / contract) is guarded on its own presence so a missing field degrades to prior behavior rather than emitting 'undefined'"

key-files:
  created:
    - tests/test-209-engine-arm-contract.cjs
  modified:
    - scripts/intent-classifier.cjs

key-decisions:
  - "E4 uses the direct renderShapeF8 + appendAskUserQuestionTrailer fallback route (plan-sanctioned), not the pickShape('F.8') preferred route: pickShape maps the F.8 payload cleanly with no new dispatcher branch, but its tier-0 refuse would kill the session-unbound gate on a tier-0 install. The trailer-door route reuses the single SEED-020 construction site with zero new dispatcher branches (Canon Part 7) and keeps the gate tier-agnostic."
  - "buildDialSlotContext sources {topic} from the top relevantNodes display-name (falling back to the first cortexNodes name, then the raw node id) and OMITS the key when nothing resolves; it never sets {framework} so the composer's auditFrameworkSlot stays the only egress door (Canon Part 8)."
  - "roomContext is threaded OUT of runNavigationEngine (new resolve field room_context) into the render seam, mirroring how cortex_nodes already flows, so the db-closed render path can build the slot map from live LOCAL nodes."

patterns-established:
  - "E4 SEED-020 exemption: mint the trailer at the dispatcher door, capture the pre-trailer footer first to avoid duplicating marker+binding in additionalContext"
  - "Compact contract payload shape: { shape, mode, verbs (labels only), recommended }"

requirements-completed: [E3, E4]

# Metrics
duration: 15min
completed: 2026-07-02
---

# Phase 209 Plan 01: Shape-F Native Fire (engine-emission seam) Summary

**The engine-arm dial trigger and the F.8 binding gate are now self-decoding and machine-readable: both carry the BINDING imperative + a parseable AskUserQuestion contract, dial rows resolve live {topic}/{room_name}, and every fault still degrades to the base block.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-02T13:29:34Z
- **Completed:** 2026-07-02T13:33:29Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **E3 (slotContext threading):** `renderDial(reachList, {})` no longer passes empty opts. A new pure helper `buildDialSlotContext(roomContext, roomDir)` derives the flat composeLabel slot map (`room_name` from the room dir basename, `topic` from the top live node) so dial rows stop degrading to the generic ELEVATION_DEFAULTS lines. `roomContext` is threaded out of `runNavigationEngine` into the render seam.
- **E2 (contract serialization):** the engine-arm concat now appends E1's dropped `askuserquestion_binding` line AND a JSON-serialized `[AskUserQuestion payload: {...}]` contract line built field-by-field from `rendered.contract`. The Wave-1 Drift Report gap (E2 never shipped) is closed at the same seam.
- **E4 (F.8 binding gate):** `emitBindingGate` now includes `zones.footer` in its body, mints the AskUserQuestion trailer through the SEED-020 dispatcher door, appends marker + binding to `additionalContext`, and rewrites its guidance to open by naming the AskUserQuestion tool.
- **Regression proof:** `tests/test-209-engine-arm-contract.cjs` (6 behaviors / 21 assertions) covers E2/E3/E4 plus the degrade and tier_0 DIAL-ATOM-01 paths.

## Task Commits

Each task was committed atomically (TDD: test -> feat):

1. **Task 1 (E3 + E2): thread slotContext + emit binding + contract at engine arm**
   - `0adee0e7` (test) - failing engine-arm contract test (Tests 1-4)
   - `2e8e9cf1` (feat) - buildDialSlotContext + renderDial threading + binding/contract concat
2. **Task 2 (E4): emitBindingGate footer + trailer + AskUserQuestion guidance**
   - `2c1155f9` (test) - failing E4 assertions (Tests 5-6)
   - `fc8def0d` (feat) - trailer door + footer inclusion + guidance rewrite

**Plan metadata:** (this commit) docs(209-01): complete plan

## Files Created/Modified

- `tests/test-209-engine-arm-contract.cjs` (created) - 6-behavior regression suite for the E2/E3/E4 seams; pure in-memory fixture, no room.db / no network; stubs the presenter via the require cache to assert slotContext threading and captures stdout to parse the emitBindingGate envelope.
- `scripts/intent-classifier.cjs` (modified) - added `pickNodeDisplayName` + `buildDialSlotContext` helpers; threaded slotContext into `renderDial`; appended binding + contract at the engine-arm concat; threaded `room_context` out of `runNavigationEngine` and into the render call site; reworked `emitBindingGate` to carry footer + trailer + AskUserQuestion-naming guidance; exported `buildDialSlotContext`.

## Decisions Made

- **E4 route (discretion resolved):** the plan offered two routes and directed the fallback whenever the preferred route "would require ANY new dispatcher branch." The `pickShape('F.8')` route needs no new branch (the F.8 branch already passes options/header through), but it applies the Canon Part 3 tier-0 refuse, which would suppress the session-unbound binding gate on a tier-0 install. Since an unbound session MUST be able to fire its binding card regardless of tier (same rationale as the D-01 cold card), I used the plan-sanctioned fallback: direct `renderShapeF8` + `appendAskUserQuestionTrailer`, reusing the single SEED-020 construction door with zero new dispatcher branches. The 150.5-02 engine-arm exemption justification is copied into a comment at the site.
- **{topic} source:** `getNeighborhood` rows carry no dedicated name field, so `pickNodeDisplayName` probes `name`/`label`/`title`/`properties.*` then falls back to the raw node `id`, and omits the slot when nothing resolves (never renders 'undefined' or an empty label).

## Deviations from Plan

None - plan executed as written. The E4 route selection was an explicit discretion point the plan delegated (preferred vs fallback), resolved to the fallback for the tier-0 reason documented above; this is within the plan's stated latitude, not an unplanned deviation.

## Issues Encountered

- The plan step 2 text ("extend the ctx object with `roomContext: context.roomContext`") named a variable (`context`) that is local to `runNavigationEngine` and not in scope at the call site (:2441, inside the `emitEngineDecisionBlock().then(out => ...)` callback). Resolved by threading `room_context` out through the `runNavigationEngine` resolve object (alongside the existing `cortex_nodes`) and reading `out.room_context` at the call site. This is the same out-threading pattern the plan's own analog (cortex_nodes) uses.

## Threat Surface Scan

No new trust boundaries beyond the plan's threat model. T-209-01 (contract-line tampering) is mitigated: the payload is built field-by-field and JSON.stringify'd, never concatenated from raw label text. T-209-02 (DoS) is mitigated: all new logic stays inside the existing try/catch degrade paths (return base / return false), and buildDialSlotContext never throws (verified by Tests 3 and 6). T-209-03/04 unchanged: {framework} is never sourced locally, and trailer strings are composed exclusively by selector-dispatcher.

## Verification

- `node tests/test-209-engine-arm-contract.cjs` - exits 0 (21 assertions across 6 behaviors)
- `node -e "require('./scripts/intent-classifier.cjs')"` - loads clean
- `grep -c askuserquestion_binding scripts/intent-classifier.cjs` = 1; `grep -c "AskUserQuestion payload:"` = 1; `renderDial(reachList, {})` no matches
- `node scripts/check-render-coverage.cjs` - 16 covered, 0 gap (no .cjs keyspace regression)
- `node tests/test-gate-native-fire-w1.cjs` - PASS (Wave 1 acceptance unbroken)
- F.8 / binding-gate regression: `test-195-f8-umbilical`, `test-194-*`, `test-binding-gate-degrade`, `test-session-binding-consumer`, `test-session-binding-file` all PASS
- `grep -P '\x{2014}'` on both touched files - no em-dashes
- `bash tests/run-all-209.sh` - not present yet (SKIP acceptable; leg pre-declared by 209-04, not landed in this wave)

## Next Phase Readiness

- The engine-arm and F.8 binding-gate seams now emit the self-decoding contract natively. Ready for 209-02 (B1/B2/B3 command-plane render rollout) and 209-03 (E5 conversational bridge + H3 PRIMARY side-channel producers, which will emit from these same two mint sites).
- No blockers. `tests/run-all-209.sh` and the eval gate arrive with 209-04.

## Self-Check: PASSED

- FOUND: tests/test-209-engine-arm-contract.cjs
- FOUND: scripts/intent-classifier.cjs (modified)
- FOUND commit 0adee0e7 (test), 2e8e9cf1 (feat), 2c1155f9 (test), fc8def0d (feat)

---
*Phase: 209-shape-f-native-fire*
*Completed: 2026-07-02*
