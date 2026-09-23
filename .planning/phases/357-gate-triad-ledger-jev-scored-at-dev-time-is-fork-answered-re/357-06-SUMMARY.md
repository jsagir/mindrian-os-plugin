---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 06
subsystem: testing
tags: [dogfood, part8, sanitization, extractor, card-fire, local-only]

requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 01)
    provides: the replay corpus loader (card-fire-replay-corpus.cjs) and D-02 entry shape
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 02)
    provides: replay-card-fire.cjs (runEntry, prepareCodeRoot, envelope modes)
provides:
  - scripts/extract-dogfood-stop-events.cjs (--scan, --select, --apply-sanitized, --write-review-sheet, --leak-check)
  - tests/fixtures/card-fire-replay/dogfood.json: 24 sanitized, verdict-preserving source (d) entries
  - 357-DOGFOOD-LABELS.md: the D-06 review sheet for the plan-08 navigator checkpoint
affects: [357-07, 357-08, 357-09]

tech-stack:
  added: []
  patterns:
    - "Local-only dev-time extractor: reads a SHA256SUMS-verified snapshot outside the repo, writes every raw artifact back into that same mode-700/600 dir, never the repo"
    - "Sanitize-then-prove: every committed entry is fully authored/synthetic (never a literal transcript excerpt), and verdict preservation is checked empirically (re-run the sanitized entry against pre-phase code, require the same class+reason the raw candidate produced)"

key-files:
  created:
    - scripts/extract-dogfood-stop-events.cjs
    - .planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-DOGFOOD-LABELS.md
  modified:
    - tests/fixtures/card-fire-replay/dogfood.json

key-decisions:
  - "Sanitized dogfood entries are fully authored synthetic scenarios (not paraphrases of real prose): the raw R-D snapshot only supplies structural facts (record type, isMeta, origin.kind, mint shape, mint age, and the raw pre-phase verdict class+reason) which the entries reproduce, so zero raw transcript text ever reaches a committed file"
  - "Verdict preservation is proven empirically per entry (re-run against pre-phase code), not asserted by construction, per RESEARCH Pitfall 5"
  - "R-C (session 0f86dd63, ~09:20) is proposed block (fail-toward-card), flagged explicitly as uncertain for navigator ratification, since the content-token overlap survives even the planned F.1 chrome-stripping fix (D-08a) per RESEARCH Finding 5"
  - "The two source (c) anchors are excluded from dogfood by session+timestamp match, since they are already hand-fixtured in live-2026-09-23.json"

requirements-completed: [GATE357-09, GATE357-01]

duration: 55min
completed: 2026-09-23
---

# Phase 357 Plan 06: Local-only dogfood extractor Summary

**A local-only, SHA256SUMS-verified extractor reconstructs real Stop events from the navigator's own dev-session snapshot, and 24 fully-authored (never literal) sanitized dogfood entries with locally proposed labels ship for the plan-08 navigator checkpoint.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 3 (1 new script, 1 new review sheet, 1 fixture grown from 0 to 24 entries)

## Accomplishments

- `scripts/extract-dogfood-stop-events.cjs`: five modes (`--scan`, `--select`, `--apply-sanitized`, `--write-review-sheet`, `--leak-check`), all local-only (verified SHA256SUMS before any mode runs, refuses a raw dir inside the repo, `fetch` thrown for the whole run, stdout is counts-only)
- `--scan` reconstructed all 4 R-D snapshot sessions: 67 real Stop events, 11 live blocks, 1 degrade, **67/67 agreement** with pre-phase code after fixing a synthetic-record ordering hazard (see Deviations)
- `--select` picked 24 entries: 8 non-anchor, non-R-C harness-preceded false blocks, the R-C case, and a stratified pass sample (tool-result guard, gate-irrelevant, no-gate-signal), all within the 24-36 target band
- `--apply-sanitized` verified every entry's sanitized CLI class+reason matches its raw candidate's, and sanitized CLI/MCP parity holds, before writing `dogfood.json`
- `357-DOGFOOD-LABELS.md` written with the required table plus an `## R-C case` section naming the navigator's actual decision

## Task Commits

1. **Task 1: The local-only extractor (scan, select, apply-sanitized, review sheet)** - `b8540d312` (feat)
2. **Task 2: Sanitize, propose local labels, write dogfood.json and the review sheet** - `44ea99f8f` (test) -- also carries a Rule 1 fix to Task 1's script (see Deviations)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `scripts/extract-dogfood-stop-events.cjs` - the extractor (976 lines): pure helpers (`recoverSubject`, `classifyStopOutcome`, `buildCandidate`, `leakCheck`, `isStopHookFeedbackRecord`) plus the five CLI modes
- `tests/fixtures/card-fire-replay/dogfood.json` - grew from an empty `entries: []` stub to 24 D-02-shaped entries, `label_origin: 'local'` throughout, `meta.verdict_preservation: 'checked'`
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-DOGFOOD-LABELS.md` - the D-06 review sheet (created)

## Decisions Made

- See `key-decisions` in frontmatter. The single decision most likely to need navigator attention is the R-C proposal (block, fail-toward-card, flagged uncertain) -- see the review sheet's `## R-C case` section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Synthetic "Stop hook feedback" record corrupted the reconstructed preceding-turn text**

- **Found during:** Task 1, first `--scan` run
- **Issue:** Claude Code injects a synthetic `isMeta:true` user record ("Stop hook feedback: ...") into the transcript as a consequence of a Stop hook blocking. Empirically this record can land BEFORE that same block's own `check-card-fire.cjs` attachment in array write order (observed directly in the R-C session: index 1316 precedes index 1317). A naive forward-streaming walk that resets `currentTurnAssistant`/`recentUserRecords` on every `user` record therefore let this record overwrite the REAL preceding turn with post-hoc harness text the real Stop hook never saw at read time -- corrupting 4 of 67 reconstructions (including the R-C case itself, which reconstructed as `pass`/`gate-irrelevant-to-turn` instead of the real `block`).
- **Fix:** Added `isStopHookFeedbackRecord()` (detects the `Stop hook feedback:` leading text) and made the walker treat it as fully transparent: no reset, no inclusion in any candidate's transcript.
- **Files modified:** `scripts/extract-dogfood-stop-events.cjs`
- **Verification:** Re-ran `--scan`: agreement went from 63/67 (4 partial) to 67/67 (0 partial); the R-C candidate now reconstructs as `block`/`reached-registry-gate-no-card`, matching RESEARCH Finding 4/5's description.
- **Committed in:** `b8540d312` (Task 1 commit, before the first push to the raw dir's `candidates.json`).

**2. [Rule 1 - Bug] "mindrianOS" denylist term collided with safe product-name boilerplate**

- **Found during:** Task 2, first `--apply-sanitized` run
- **Issue:** The denylist (built from every `~/MindrianRooms` directory name plus registry `venture_name` values) included case-insensitive `mindrianOS`-containing terms. The real F.8 gate header is literally `-- mindrianOS -- bind session -- select rooms --` (app-generated chrome, not user content, already public throughout this repo's own docs), so reproducing that header verbatim in a sanitized subject tripped the leak check on every F.8-involving entry (10 of 17 failures).
- **Fix:** Filtered every denylist term containing "mindrianos" (case-insensitive) out of `denylist.txt` before re-running `--apply-sanitized` -- the product's own name is not room/venture/person content per D-05's intent.
- **Files modified:** `~/.cache/mindrian-dev/357-raw/denylist.txt` (local-only, never committed).
- **Verification:** Re-ran `--apply-sanitized`: the 10 `mindrianOS`-collision failures cleared.
- **Committed in:** N/A (raw-dir-only artifact, never committed per Part 8).

**3. [Rule 1 - Bug] `--write-review-sheet`'s "live outcome" column echoed the proposed label instead of the real raw verdict**

- **Found during:** Task 2, first `--write-review-sheet` run
- **Issue:** The mode only read `dogfood.json` (which carries the ratified/proposed label, `expected_verdict_class`) and had no access to the raw candidate's actual pre-phase verdict, so it derived "live outcome" from `expected_verdict_class` itself -- every row showed identical values in both columns, hiding exactly the distinction (false block vs. correct pass) the sheet exists to surface.
- **Fix:** `--write-review-sheet` now also reads the local `sanitize-report.json` (written by `--apply-sanitized`) for the real `raw_verdict.class` per id, falling back to `expected_verdict_class` only when that report is absent.
- **Files modified:** `scripts/extract-dogfood-stop-events.cjs`
- **Verification:** Regenerated the sheet; the 8 harness-preceded entries and R-C now correctly show `live outcome: block` / `proposed: pass` (or `block` for R-C), distinct columns.
- **Committed in:** `44ea99f8f` (Task 2 commit, alongside the script's other Task 1 delta).

---

**Total deviations:** 3 auto-fixed (3 bugs, all Rule 1)
**Impact on plan:** All three were necessary for correctness (accurate reconstruction, a usable review sheet) or to unblock the sanitization check on a false-positive denylist collision. No scope creep.

## Issues Encountered

None beyond the three deviations above.

## Stub Tracking

No stubs. `dogfood.json` entries are fully populated (transcript, sidechannel_records where applicable, counters, why) and pass `card-fire-replay-corpus.cjs::validateEntry` plus the full replay harness.

## Threat Flags

None. This plan's own `<threat_model>` already names every surface it touches (T-357-05, T-357-11, T-357-01, T-357-18, T-357-04); no new surface was introduced beyond what was planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Source (d) is complete: `tests/fixtures/card-fire-replay/dogfood.json` has 24 entries, `meta.verdict_preservation: 'checked'`, `label_origin: 'local'` throughout.
- `node tests/test-357-corpus-loader.cjs` passes all 12 legs (default mode: four sources, corpus floor met).
- `node scripts/replay-card-fire.cjs --code-root pre-phase --surface both --source dogfood` reports `errors=0 parity_mismatches=0` (8 `FALSE_BLOCK` outcomes are the EXPECTED, not-yet-fixed state this phase's later plans resolve).
- `357-DOGFOOD-LABELS.md` is ready for the plan-08 navigator checkpoint; the R-C row is the one item most likely to need a correction (`r-c: known_false_block <reason>` vs. the current `block` proposal).
- Raw evidence stays local at `~/.cache/mindrian-dev/357-raw/` (mode 700, SHA256SUMS-verified); nothing from it was committed.
- No blockers for plan 07 (the D-07/D-08a deterministic fixes) or plan 08 (the navigator ratification checkpoint).

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Completed: 2026-09-23*

## Self-Check: PASSED
