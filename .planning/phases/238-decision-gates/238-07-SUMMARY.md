---
phase: 238-decision-gates
plan: 07
subsystem: testing
tags: [card-fire, decision-gates, backstop, fixture-corpus, gate-04, regex-classifier]

# Dependency graph
requires:
  - phase: 238-01
    provides: tests/helpers/cardfire-hermetic-238.cjs (makeHermeticCardFireEnv), tests/run-all-238.sh
provides:
  - "tests/fixtures/card-fire-corpus-238.json (sanitized, two-half, provenance-tagged card-fire corpus)"
  - "tests/test-238-card-fire-corpus.cjs (table-driven corpus test over the real classifyCardFire, four side-channel states, hermetic)"
  - "The observed-RED baseline for 238-08: exactly 5 Half A entry ids currently intercept and must turn green"
affects: [238-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Corpus-as-pinning-fixture: a committed JSON file with expect_fire booleans and a source provenance field, asserted against the real classifier, not the raw regex predicate"
    - "Non-throwing state-1 recorder pattern (checkState1) alongside the throwing ok() harness, so an intentionally-RED assertion set does not abort collection of the other entries' results in the same run"

key-files:
  created:
    - tests/fixtures/card-fire-corpus-238.json
    - tests/test-238-card-fire-corpus.cjs
  modified: []

key-decisions:
  - "Zero corpus entries carry source:'live-log'. 238-RESEARCH.md measured 0/38 live intercept-log records fire on computeBackstopHit today, so copying any of them would add a vacuous entry while importing real conversation content. Documented in the corpus's own meta block, not just this summary."
  - "The Half B 'reconstructed-two-honest-paths-fork' entry (cfec3113 structural reconstruction) is rendered as a bracket box, not as bare numbered prose. The RCA's own resolution states the numbered-prose rendering no longer fires (that arm was retired) but 'a bracket-box [1]...[2] rendering of the same fork still force-fires via arms 1-3' -- so the bracket-box rendering is the only form of this reconstruction that both preserves the fork's real history AND satisfies Half B's anti-vacuity requirement (must fire on the shipped predicate today)."
  - "State 4's 'intercept is true' language in the plan is scoped to the subset of Half A whose text trips computeBackstopHit today (5 of 10 entries), not literally all ten. A plain numbered list with no bracket notation cannot trip any backstop arm under any of 238-RESEARCH.md's three candidate remedies, so applying 'intercept true' to all ten would be internally inconsistent with the plan's own premise. Scoped explicitly in the test's comments so a future reader sees the reasoning, not just the code."

requirements-completed: [GATE-04]

# Metrics
duration: ~55min
completed: 2026-07-29
---

# Phase 238 Plan 07: Card-Fire Corpus Summary

**Sanitized two-half card-fire fixture corpus (10 must-not-fire, 4 must-still-fire) plus a table-driven test over the real classifier, observed RED on exactly the 5 measured live false-positive shapes and GREEN on every other state, landed before 238-08's classifier fix.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-29T16:23:20Z (session start, first file read)
- **Completed:** 2026-07-29T19:23:10+03:00 (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 2 (both new)

## Accomplishments

- Built `tests/fixtures/card-fire-corpus-238.json`: 10 Half A (`expect_fire: false`) entries and 4 Half B (`expect_fire: true`) entries, each with `id`, `source`, `expect_fire`, `why`, `text`. Provenance is honest: 5 Half A entries are `authored` fixtures matching the exact false-positive shapes `238-RESEARCH.md` section 5b measured live (inline citation, footnote list, markdown reference-link definitions, array indexing, code enum); 5 Half A entries plus 1 Half B entry are `source: 'rca'`, structurally reconstructed (never copied) from the debug RCA history; the remaining 3 Half B entries are `authored` canonical gate shapes (multiline bracket box, bulleted bracket box, the `type 1, 2, or 3` literal).
- Verified live against the shipped `computeBackstopHit`: **exactly 5 of 10** Half A entries fire today (`inline-academic-citation`, `footnote-reference-list`, `markdown-reference-link-definitions`, `array-indexing-in-prose`, `code-enum-indexing`) -- meeting the "at least 5" shape-coverage acceptance bar precisely, not vacuously. **All 4 of 4** Half B entries fire today, satisfying the anti-vacuity control.
- Built `tests/test-238-card-fire-corpus.cjs`: drives every corpus entry through the real `classifyCardFire(turn, registry)` (never the raw predicate) across all four side-channel states the 238-08 remedy is state-dependent on. `sidechannel_health` / `reach_corroborated` are set on the hand-built turn even though `classifyCardFire` does not read them yet -- harmless today, and exactly what makes state 1 observably RED before the fix.
- Ran it: **exits non-zero today**, with failures confined to state 1 on exactly the 5 fire-today Half A entries. States 2, 3, and 4 are all green (32 total assertions, 27 pass via the throwing `ok()` harness, 5 fail via the non-throwing `checkState1` recorder that still runs and reports every entry rather than aborting on the first failure).
- Confirmed `bash tests/run-all-238.sh` now reports the `238-07/08 card-fire corpus (GATE-04)` leg as **FAILED**, not SKIPPED -- the documented mid-phase state per the runner's own header.
- Confirmed zero touches to `scripts/` or `lib/` from this plan's two commits (`git diff --stat scripts/check-card-fire.cjs` empty against both commits); the three dirty `scripts/`/`lib/` files visible in `git status` predate this session and are unrelated (statusline/context-monitor work, not card-fire).
- Confirmed `tests/test-209-backstop-tuning.cjs` (the `ASCII_BOX_GLYPH_RE` regression pin) still passes: 13/13.

## Task Commits

1. **Task 1: Build the sanitized two-half fixture corpus** - `191d47a5` (test)
2. **Task 2: Build the table-driven corpus test and observe it RED on the must-not-fire half** - `2e726b1f` (test)

**Plan metadata:** this summary's own commit (pending, `.planning/` is gitignored so `git add -f`).

## Files Created/Modified

- `tests/fixtures/card-fire-corpus-238.json` - the committed, sanitized, provenance-tagged 14-entry corpus (10 Half A + 4 Half B)
- `tests/test-238-card-fire-corpus.cjs` - the table-driven test, four side-channel states, hermetic on the whole file

## Decisions Made

See `key-decisions` in frontmatter. In short: no live-log entries (would be vacuous, per 238-RESEARCH.md's own 0/38 measurement); the cfec3113 fork reconstruction is rendered as a bracket box (the only rendering that is both historically grounded and non-vacuous under D-06's frozen regexes); state 4's "intercept is true" claim is scoped to the fire-today subset of Half A, not literally every entry, because a plain-prose entry cannot trip any backstop arm regardless of side-channel status.

## Deviations from Plan

None - plan executed exactly as written. The state-4 scoping decision above is a clarification of an internally ambiguous instruction (the plan's prose said "Half A entries" without qualifying the fire-today subset), resolved in the only way consistent with the plan's own stated remedy directions in `238-RESEARCH.md` section 5c, and documented in both the test's comments and this summary rather than silently narrowed.

## Sanitization Verification (D-14)

**Check run, not assumed:**

```bash
grep -inE "jonathan|sagir|aronhime|lawrence|mindrian|motj|sanhedrin|village of life|villageoflife|overlook|secunda|adams|leibowitz|diana zhu|calvo|rabbi|kaltmann|hebrew|align-ecosystem|eureka-213" tests/fixtures/card-fire-corpus-238.json
```

Result: the only matches are inside the `meta.sanitization_statement` and `meta.live_log_entries_note` fields themselves (both are descriptive statements ABOUT the absence of such content, e.g. "no Hebrew source material... appears anywhere in this file" -- the word "Hebrew" appears only as a negation, not as content). Zero matches inside any `entries[].text` field. All fixture subject matter uses generic placeholders (`sample-project`, `sample-library`, `example.invalid` URLs).

```bash
grep -cP '\x{2014}' tests/fixtures/card-fire-corpus-238.json   # 0
grep -cP '\x{2014}' tests/test-238-card-fire-corpus.cjs        # 0
git check-ignore tests/fixtures/card-fire-corpus-238.json      # (empty -- not ignored, committed)
```

## Failing State-1 Entry Ids (verbatim, for 238-08)

```json
["inline-academic-citation", "footnote-reference-list", "markdown-reference-link-definitions", "array-indexing-in-prose", "code-enum-indexing"]
```

238-08 must turn exactly these 5 ids green under state 1 (healthy side channel, no corroborating reach record) while keeping every state-2/3/4 assertion green and every other state-1 entry green. `node tests/test-238-card-fire-corpus.cjs` must exit 0 at the end of 238-08.

## Issues Encountered

None. Live measurement matched `238-RESEARCH.md`'s predictions exactly (5/10 Half A fire, 4/4 Half B fire), so no corpus redesign was needed after the first verification pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tests/fixtures/card-fire-corpus-238.json` and `tests/test-238-card-fire-corpus.cjs` are committed and ready for 238-08 to consume.
- `scripts/check-card-fire.cjs` is untouched (out of scope for this plan, confirmed via `git diff --stat`).
- 238-08 (Wave 3, depends on this plan and 238-05) implements the CONFIRMER discriminator design from `238-RESEARCH.md` section 5c option 1 (backstop hit AND corroborating side-channel reach record), adds `sidechannel_health` / `reach_corroborated` to `deriveTurnSignals`, teaches `classifyCardFire` to read them, and must turn `node tests/test-238-card-fire-corpus.cjs` fully green while never touching `ASCII_BOX_GLYPH_RE` (byte-identical, D-06).
- No blockers.

---
*Phase: 238-decision-gates*
*Plan: 07*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: tests/fixtures/card-fire-corpus-238.json
- FOUND: tests/test-238-card-fire-corpus.cjs
- FOUND: .planning/phases/238-decision-gates/238-07-SUMMARY.md
- FOUND: commit 191d47a5 (Task 1)
- FOUND: commit 2e726b1f (Task 2)
