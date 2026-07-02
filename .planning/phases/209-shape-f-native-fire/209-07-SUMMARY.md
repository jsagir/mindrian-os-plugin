---
phase: 209-shape-f-native-fire
plan: 07
subsystem: hooks
tags: [backstop-tuning, regex, adversarial-verification, phase-complete]

requires:
  - phase: 209-shape-f-native-fire (plan 05)
    provides: "the SENS-12 room-pick sensor this plan's incident replay drives"
  - phase: 209-shape-f-native-fire (plan 06)
    provides: "the H3 PRIMARY side-channel + producers this plan's backstop tuning is sequenced after (LOCKED wave order: tune the floor only once the native path is live)"
provides:
  - "Tuned ASCII_BOX_GLYPH_RE in scripts/check-card-fire.cjs: bare U+25A0 alternative dropped, multiline-labeled-box + numbered-prose-gate alternatives added"
  - "Widened askFired window: an OR across every assistant message since the last role:user record (the current turn), not the last message alone"
  - "tests/test-209-backstop-tuning.cjs - 13 assertions (FP/FN matrix, WR-07 signature stability, H2 window behaviors, retry-key stability, floor proof)"
  - "tests/test-209-incident-replay.cjs - the phase's adversarial verification, 4 lettered assertions (a-d) per 209-RESEARCH.md section 3"
affects: []

tech-stack:
  added: []
  patterns:
    - "(?:^|\\n) as a per-line anchor substitute, avoiding the /m flag entirely while still matching a line-start pattern anywhere inside a larger message"
    - "A single hermetic CARD_FIRE_SIDECHANNEL_PATH override at the TOP of a test file, not per-test, when every assertion in the file touches the same shared side-channel resource"

key-files:
  created:
    - tests/test-209-backstop-tuning.cjs
    - tests/test-209-incident-replay.cjs
  modified:
    - scripts/check-card-fire.cjs

key-decisions:
  - "H1's new numbered-prose-gate alternative accepts the known, explicitly-scoped FP risk (an ordinary '1. ... 2. ...' explanatory list in prose could theoretically match) because the plan's own FN requirement is exactly this shape, and PRIMARY (live since 209-06) plus the per-gate/session bounded-escape ceilings absorb any rare false intercept without a livelock risk."
  - "H2's window reset happens ONLY on a role:user record, never touching gate_signature or turnContextHash (the CR-03 invariant restated in the rewritten doctrine comment) - proven directly by a retry-key-stability assertion comparing hash values across repeated calls on a fixed fixture, not just asserted in prose."
  - "The now-dead lastAssistantContent variable (superseded by currentTurnAssistantContents) was removed rather than left as unused dead code."

patterns-established:
  - "The adversarial incident-replay test itself surfaced a genuine, previously undocumented cross-session noise property in the H3 side-channel's NO_SESSION_KEY union (a stale no-session record can leak into an unrelated session's PRIMARY check for up to TTL_MS) - discovered via real pollution left on the actual dev machine by earlier ad hoc sanity-testing, cleaned up, and now the reason every card-fire-touching test in this phase isolates its own hermetic side-channel path."

requirements-completed: [H1, H2]

duration: unknown (manual implementation)
completed: 2026-07-02
---

# Phase 209 Plan 07: Backstop Tuning + Adversarial Incident Replay (H1 + H2) Summary

**The backstop's regex stops false-positive-blocking sanctioned UI vocabulary and starts catching the multiline and numbered-prose gate shapes that slipped through; its detection window now spans the whole current turn instead of just the last message; and the phase's own adversarial replay proves the incident cannot recur silently - PASS=9 FAIL=0 SKIP=0 across all nine legs of every one of this phase's seven plans.**

## Performance

- **Tasks:** 3 completed
- **Files modified:** 3 (1 modified: check-card-fire.cjs; 2 new: the two test files)

## Accomplishments

- **H1:** `ASCII_BOX_GLYPH_RE` drops the bare U+25A0 alternative (a false-positive block on sanctioned UI vocabulary) and gains two alternatives: a multiline labeled box (`[1]...\n...\n[2]...`) and a numbered-prose gate (`1. .../2. ...` within a 3-line span, anchored via `(?:^|\n)` with no `/m` flag needed). The full FP/FN matrix (2 FP cases that must NOT match, 5 FN cases that must match, 1 WR-07 distinct-signature stability check) all pass.
- **H2:** `askFired` widens from the last assistant message alone to an OR across every assistant message since the last `role:user` record (`currentTurnAssistantContents`, reset on each user record). A card fired earlier in the same turn now correctly suppresses interception; a stale card from a prior turn still does not mask a no-card box in the next turn; the no-`role:user` degenerate path (one window spans the whole tail) still works; `gate_signature`/`turnContextHash` derivation is provably unchanged (a direct hash-stability assertion, not just an unchanged-code claim).
- **Adversarial verification:** the four RESEARCH-mandated lettered assertions (a-d) all pass, proving the phase's core claim end to end: the native card fires before any backstop involvement, the backstop stays silent on that turn, the render-coverage gate is green, and the sanctioned glyph still passes.
- **Phase-complete condition reached:** `bash tests/run-all-209.sh` reports **PASS=9 FAIL=0 SKIP=0** - every leg of every one of the phase's seven plans is green.

## Task Commits

1. **Task 1 + Task 2: H1 regex tuning + H2 window widening**
   - `beb3807f` feat(209-07): H1+H2 backstop tuning (regex FP/FN + current-turn window)
2. **Task 3: adversarial incident replay**
   - `b348f086` feat(209-07): adversarial phase verification - incident replay (Task 3)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `scripts/check-card-fire.cjs` - `ASCII_BOX_GLYPH_RE` tuned (4 alternatives, doctrine comment rewritten naming the H1 fix ID); `readTranscriptTurn`'s walk now tracks `currentTurnAssistantContents` (reset on `role:user`) instead of `lastAssistantContent`; `askFired` derived via `.some(scanContentForAskUserQuestion)` across that array; `ASCII_BOX_GLYPH_RE` added to `module.exports` for direct test access.
- `tests/test-209-backstop-tuning.cjs` - 13 assertions across the H1 FP/FN matrix + WR-07 stability, and the H2 fired-then-glyph / stale-cross-turn / degenerate-no-user / retry-key-stability behaviors, plus a floor-untouched proof.
- `tests/test-209-incident-replay.cjs` - 4 lettered assertions (a-d), each printed distinctly; a file-scoped hermetic `CARD_FIRE_SIDECHANNEL_PATH` isolates the whole run from the real `~/.mindrian` side-channel file.

## Decisions Made

See key-decisions in frontmatter. The most consequential in practice: discovering (via the incident-replay test itself, during authoring) that stale real-machine side-channel pollution from earlier manual sanity-testing was leaking into an unrelated test assertion through the H3 module's NO_SESSION_KEY union - not a bug in the union's design (which is necessary for the pickShape door's session-less records to ever surface), but a real property that demands every card-fire-touching test isolate its own side-channel path. The stale file was cleaned up on the dev machine and the test file now isolates hermetically for its entire run.

## Deviations from Plan

None in substance. All file paths, fix IDs, and acceptance criteria match the plan exactly.

## Issues Encountered

The incident-replay test initially failed on assertion (d) due to the cross-session pollution described above - resolved by (1) deleting the stale real `~/.mindrian/card-fire-reached.json` this session's own earlier manual testing had created, and (2) adding a file-scoped hermetic `CARD_FIRE_SIDECHANNEL_PATH` override so the test (and any future run of it) never touches the real file again. This is documented as a discovered property, not silently patched over.

## Verification Results

- `node tests/test-209-backstop-tuning.cjs` - exits 0, 13/13 assertions
- `node tests/test-209-incident-replay.cjs` - exits 0, 4/4 lettered assertions (a-d)
- `bash tests/run-all-209.sh` - **PASS=9 FAIL=0 SKIP=0** (the phase-complete condition)
- `bash tests/run-all-179.sh` - Passed: 12, Failed: 0, Skipped: 0 (unchanged)
- `node scripts/check-render-coverage.cjs` - 16 covered/0/0 gap (.cjs); 97 wired/0/0 unwired (.md)
- `node scripts/check-shape-declaration.cjs --check` - OK (128 declared, 5 skill-exempt, 133 scanned)
- Constitutional floor byte-verified: `MAX_FORCE_RETRIES = 3`, `MAX_SESSION_INTERCEPTS = 12` both present unchanged; no edits inside the Stop-block/degrade envelope regions
- Bare U+25A0 confirmed gone from the regex source line
- No em-dashes across all touched files

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 209 (Shape-F Native Fire) is COMPLETE: all 7 plans shipped, all 9 aggregator legs green, the adversarial replay proves the incident cannot recur silently. No further plans in this phase. The backstop's intercept counters are now the phase's own success telemetry (target: trend to zero on wired surfaces) rather than the mechanism navigators experience.

---
*Phase: 209-shape-f-native-fire*
*Completed: 2026-07-02*
