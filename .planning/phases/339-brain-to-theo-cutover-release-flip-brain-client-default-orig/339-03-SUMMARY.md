---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 03
subsystem: testing
tags: [brain-client, theo, alias-table, refusal-messaging, gate-zero-write, cross-repo-note, 269-05-checklist]

# Dependency graph
requires:
  - phase: 339-01
    provides: tests/run-all-339.sh (glob discovery), tests/test-339-origin-single-source.cjs
  - phase: 339-02
    provides: tests/test-339-enrichment-theo-shapes.cjs, tests/test-339-update-path-single-source.cjs, tests/test-339-schema-memo-origin-keyed.cjs
provides:
  - tests/test-339-cross-repo-note.sh (FLIP-07, RED today, file-assertion arm)
  - tests/test-339-269-05-checklist.sh (FLIP-08, RED today, awk-scoped file-assertion arm)
  - tests/test-339-gate-zero-write.sh (FLIP-09, GREEN today by design, mechanized zero-write proof of the blocking gate's verify block, proven against Theo's live ruling at commit 81dfac8)
  - tests/test-254-normalize-roundtrip-probe.cjs Arms 4-5 extended for the two-table origin-keyed alias selector (FLIP-02, RED today)
  - tests/test-250-refusal-shapes.cjs Test 8, the update-path pin (FLIP-04b, RED today)
affects: [339-04, 339-06, 339-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A .sh test arm that is GREEN by design in Wave 0 (test-339-gate-zero-write.sh), the mirror image of the phase's usual RED-by-design convention, stated explicitly in its own header so a future red run reads as a real finding rather than a broken test"
    - "awk heading-scoped extraction (never line-number scoped) for a cross-repo markdown subsection that another session may edit above the target heading"
    - "A scoping self-check arm (assert an out-of-section string is ABSENT from an extraction) alongside every positive literal assertion, so a broken extraction that swallowed too much text cannot pass by accident"

key-files:
  created:
    - tests/test-339-cross-repo-note.sh
    - tests/test-339-269-05-checklist.sh
    - tests/test-339-gate-zero-write.sh
  modified:
    - tests/test-254-normalize-roundtrip-probe.cjs
    - tests/test-250-refusal-shapes.cjs

key-decisions:
  - "Header-comment edits to test-254-normalize-roundtrip-probe.cjs were reverted to their original text (rather than updated to describe the new two-table Arm 4) to satisfy the plan's own literal acceptance criterion, 'git diff shows no hunk before line 255' -- PATTERNS.md's suggestion to also update the header line was NOT followed, since the PLAN.md acceptance criterion is authoritative and testable. See Deviations."
  - "test-250's REASONS guard (Test 8) is exercised through the public refusalResponse().reason field rather than by reaching into the unexported REASONS table directly, since reason = REASONS[k](ctx) verbatim -- functionally identical proof, no new export needed."
  - "test-339-gate-zero-write.sh's header comment paraphrases 'never an extended-regex match' instead of the literal string 'grep -E', because the plan's own <verify> block does `! grep -q 'grep -E' tests/test-339-gate-zero-write.sh`, and a comment merely NAMING grep -E as the forbidden form would trip that same check."

patterns-established:
  - "Test arms proving a cross-repo read-only precondition (test-339-gate-zero-write.sh) capture git status --porcelain sha256 in BOTH repos before and after, in subshells that do not persist the cd, and assert byte-identical output rather than trusting the absence of an error."

requirements-completed: [FLIP-02, FLIP-04, FLIP-07, FLIP-08, FLIP-09]

# Metrics
duration: 45min
completed: 2026-09-03
---

# Phase 339 Plan 03: Wave 0 Test Infrastructure, Part 3 of 3 Summary

**Three new `.sh` test arms (cross-repo note existence, the 269-05 checklist's three real legs, and the blocking gate's mechanized zero-write proof) plus two surgical extensions to existing tests (the two-table origin-keyed alias selector, the refusal-copy update-path pin) land with `tests/test-339-gate-zero-write.sh` GREEN by design against Theo's live coverage ruling at commit `81dfac8`, and every other new/extended arm RED by design, naming exactly what plans 339-04/06/09 must build.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-03T20:39:14Z (approx, per session context)
- **Completed:** 2026-09-03T21:24:00Z (approx)
- **Tasks:** 4 completed
- **Files modified:** 5 (3 created, 2 modified, plus this SUMMARY)

## Accomplishments

- `tests/test-339-cross-repo-note.sh` asserts `docs/339-NOTE-theo-desktop-connector-key.md` exists, carries at least 40 lines, contains all five required literals (`mindrian-brain`, `https://theo-mcp.onrender.com/mcp`, `BRAIN_TOOL_MATCHER`, `part8-egress-guard-hook.cjs`, `11d6f82`), and zero em-dashes. **RED today** (the note does not exist; lands in plan 339-09).
- `tests/test-339-269-05-checklist.sh` awk-extracts `269-05-PLAN.md` Task 1's block (from the `Task 1: BLOCKING GATE` marker to the closing `</task>` tag, marker-scoped never line-number-scoped) and asserts the three real legs (`Leg (a)`, `Leg (b)`, `Leg (c)`), `09-FLIP-RECORD.md`, `theo-mcp.onrender.com`, and that any surviving `pws-brain-mcp.onrender.com` or `Plans: TBD` line also carries `Retired`. **RED today** (Task 1 is still the pre-339 "confirm Theo Phase 9 timeline" checklist; the rewrite lands in plan 339-09).
- `tests/test-339-gate-zero-write.sh` is the mechanized twin of the blocking gate's verify block, proven **GREEN today** against Theo's live coverage ruling at Theo commit `81dfac8`: it awk-extracts the exact subsection `### Coverage re-measurement, 2026-09-03, and the ruling on it`, matches all eleven required literals fixed-string only, runs a scoping self-check (`Flip instructions for the plugin release` must NOT appear in the extraction), and asserts `git status --porcelain | sha256sum` is byte-identical in BOTH `/home/jsagi/dev/MindrianOS-Plugin` and `/home/jsagi/Theo` before and after. Porcelain hashes verified this run, recorded below.
- `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4-5 extended (never rewritten -- Arms 1-3 byte-identical, single diff hunk starts at line 255) for the two-table origin-keyed alias selector: `BRAIN_PROBLEM_TYPE_ALIASES_INCUMBENT`/`_THEO`, `THEO_ORIGINS` as a frozen array, `_brainProblemTypeAliases()` reading `BRAIN_URL`, and the accessor retargeted from `BRAIN_PROBLEM_TYPE_ALIASES[lc]` to `table[lc]`. Arm 5 now asserts disjointness against the UNION of both tables. **RED today**, failing with `marker not found in source: const BRAIN_PROBLEM_TYPE_ALIASES_INCUMBENT = Object.freeze(` -- exactly the missing-declaration message the plan's own verify block requires.
- `tests/test-250-refusal-shapes.cjs` gained Test 8 (appended after the existing seven, none modified): asserts rendered `unreachable`/`no_key` copy names `claude plugin update mos@mindrian-marketplace`, `NEXT_MOVES.unreachable` gains an `update` handle, and no `REASONS` entry (any `REFUSAL_KINDS`) ever carries the update-path literal. **RED today** on assertion 1 only; the seven pre-existing tests still PASS; Test 6's 120-char cap is byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the two file-assertion arms (FLIP-07, FLIP-08)** - `dc80655d` (test)
2. **Task 2: Write tests/test-339-gate-zero-write.sh (FLIP-09, GREEN in wave 1 by design)** - `d012e565` (test)
3. **Task 3: Extend tests/test-254-normalize-roundtrip-probe.cjs Arms 4 and 5 (FLIP-02)** - `631c31dc` (test)
4. **Task 4: Add the update-path pin to tests/test-250-refusal-shapes.cjs (FLIP-04b)** - `f13062db` (test)

**Plan metadata:** this commit (docs: complete plan) - recorded after this SUMMARY and STATE.md/ROADMAP.md updates land.

## Files Created/Modified

- `tests/test-339-cross-repo-note.sh` - new FLIP-07 file-assertion arm (executable, 86 lines)
- `tests/test-339-269-05-checklist.sh` - new FLIP-08 awk-scoped file-assertion arm (executable, 102 lines)
- `tests/test-339-gate-zero-write.sh` - new FLIP-09 mechanized zero-write proof, GREEN today (executable, 121 lines)
- `tests/test-254-normalize-roundtrip-probe.cjs` - Arms 4-5 extended for the two-table selector; stale STATED DECISION comment replaced
- `tests/test-250-refusal-shapes.cjs` - Test 8 appended, the update-path pin

## Decisions Made

- Reverted an initial header-comment edit in `tests/test-254-normalize-roundtrip-probe.cjs` back to its original text (see Deviations) so the diff's first hunk starts exactly at line 255, satisfying the plan's literal acceptance criterion.
- `tests/test-250-refusal-shapes.cjs` Test 8's `REASONS` guard reads through `refusalResponse(kind, ctx).reason` (the public API) rather than reaching into the unexported `REASONS` table, since `reason` is `REASONS[k](ctx)` verbatim -- an identical proof without a new export.
- `tests/test-339-gate-zero-write.sh`'s header comment states "never an extended-regex match" instead of literally writing the forbidden regex-engine flag as a string, because the plan's own `<verify>` block negatively greps for that exact substring in this file and a mention-as-a-negative-example would have self-tripped it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/test-339-gate-zero-write.sh`'s header comment self-tripped its own structural verify check**
- **Found during:** Task 2, running the plan's own `<verify><automated>` block after first draft
- **Issue:** The header comment explaining "use fixed-string matching, never an extended-regex match" was initially written literally naming the forbidden grep flag as a negative example (in prose, inside a comment). The plan's own verify command negatively greps the whole file for that exact two-token substring (`! grep -q '<flag>' tests/test-339-gate-zero-write.sh`), so the comment's own mention of the forbidden form as a *negative example* caused the structural check to report FAIL even though the script's actual logic never uses it.
- **Fix:** Reworded the comment to describe the constraint in prose ("fixed-string only... never an extended-regex match") without literally spelling out the forbidden flag anywhere in the file.
- **Files modified:** `tests/test-339-gate-zero-write.sh` (before its commit; the committed version already carries the fix)
- **Verification:** Re-ran the plan's exact verify command; `STRUCTURE_OK` now prints, and `grep -Fq 'sha256sum'` plus the negative substring check both pass.
- **Committed in:** `d012e565` (Task 2 commit; fixed before committing, no separate commit needed)

**2. [Rule 1 - Bug] `extractBraceBlock` cannot extract an array literal, used incorrectly on first draft of the `THEO_ORIGINS` structural proof**
- **Found during:** Task 3, first live run of the extended `test-254-normalize-roundtrip-probe.cjs`
- **Issue:** The first draft of Arm 4's new `THEO_ORIGINS` structural assertion called `extractBraceBlock(brainClientSrc, 'const THEO_ORIGINS = Object.freeze(')`, but `extractBraceBlock` brace-matches on `{` -- `THEO_ORIGINS`'s value is `Object.freeze([...])`, an ARRAY literal opening with `[`, not `{`. Calling the object-literal extractor on an array declaration would either throw ("no opening brace after marker") once the declaration exists, or silently match an unrelated `{` further down the file today, since the declaration does not exist yet.
- **Fix:** Replaced with a direct regex check on the raw source slice immediately following the declaration marker (`/const THEO_ORIGINS = Object\.freeze\(\s*\[/`), which correctly proves "declared as `Object.freeze([...])`, a frozen array" without depending on brace-matching machinery built for object literals.
- **Files modified:** `tests/test-254-normalize-roundtrip-probe.cjs` (before its commit; the committed version already carries the fix)
- **Verification:** Re-ran the extended test; the assertion now fails cleanly with the expected `marker not found` message (the declaration does not exist yet) rather than a brace-matching crash once 339-04 lands the real array, this assertion will correctly evaluate the regex instead.
- **Committed in:** `631c31dc` (Task 3 commit; fixed before committing, no separate commit needed)

### Genuine Findings (not fixed, out of scope for this test-only plan)

**3. [Discovery, not a defect] PATTERNS.md's header-edit suggestion conflicts with PLAN.md's own acceptance criterion for Task 3**
- **Found during:** Task 3, drafting the header-comment update for `tests/test-254-normalize-roundtrip-probe.cjs`
- **Finding:** `339-PATTERNS.md`'s "NEW `tests/test-339-*.cjs`" section explicitly recommends updating "the mirroring header line at `:31-34`" alongside deleting the stale STATED DECISION comment at `:261-276`. `339-03-PLAN.md`'s Task 3 acceptance criteria, however, explicitly requires `git diff` to show "no hunk before line 255" for Arms 1-3 to count as byte-identical -- and the file's header comment (lines ~26-36) sits well before line 255. Following PATTERNS.md's suggestion would violate the PLAN.md acceptance criterion verbatim.
- **Resolution:** Per this workflow's own precedence rule (PLAN.md is the authoritative, testable contract; PATTERNS.md is a research artifact offering style guidance), the header-comment text was left byte-identical to its pre-339 wording. Its two-sentence Arm 4/5 description ("BRAIN_PROBLEM_TYPE_ALIASES pin... NOT re-pointed to Theo's ids in this phase") is now stale relative to the actual Arm 4/5 code below it -- a cosmetic inconsistency, not a functional one, since the header is prose documentation and the arms themselves carry their own accurate in-line comments (including the new decision text superseding the old one). This is a known, named gap for whichever later plan next touches this file's header block (candidate: 339-04, which lands the production two-table selector this test proves).
- **Files modified:** none (informational only)
- **Verification:** `git diff tests/test-254-normalize-roundtrip-probe.cjs | grep '^@@'` shows a single hunk starting at `@@ -255,71 +255,120 @@`, confirming Arms 1-3 (and the header) are byte-identical.

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, both found and fixed before their governing task's commit), 1 documented-only (a PATTERNS.md-vs-PLAN.md tension, resolved in PLAN.md's favor, not a code defect).
**Impact on plan:** No scope creep. Both fixes correct this plan's own new/extended test logic before its first commit. The documented tension leaves a cosmetic (not functional) staleness in one file's header prose, named for a future plan to pick up.

## Issues Encountered

None beyond the two auto-fixed issues and the one documented finding above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 339-03's five deliverables are the final Wave 0 targets the implementing plans must turn GREEN (test-339-gate-zero-write.sh already GREEN, verified against Theo's live ruling):

- **339-04** (the origin-derived alias table, `_schemaCacheOrigin`) must satisfy `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4-5 in full: both `BRAIN_PROBLEM_TYPE_ALIASES_INCUMBENT`/`_THEO` tables, `THEO_ORIGINS` as a frozen array, and `_brainProblemTypeAliases()` reading `BRAIN_URL`. It should also resolve the cosmetic header-prose staleness this plan documented above (Deviation 3), since 339-04 is the plan that actually lands the two-table code the stale header describes incorrectly.
- **339-06** (`lib/core/update-path.cjs` and its refusal-copy amendment) must satisfy `tests/test-250-refusal-shapes.cjs` Test 8 without regressing Tests 1-7, and must resolve `tests/test-339-update-path-single-source.cjs` Arm 5's pre-existing `scripts/self-update:68` finding (documented in 339-02's SUMMARY, unchanged by this plan).
- **339-09** (the cross-repo note and the 269-05 checklist rewrite) must satisfy `tests/test-339-cross-repo-note.sh` (write `docs/339-NOTE-theo-desktop-connector-key.md` with all five literals, 40+ lines, zero em-dashes) and `tests/test-339-269-05-checklist.sh` (rewrite `269-05-PLAN.md` Task 1 to the three-leg shape, retiring the old six items with `Retired` annotations on every surviving `Plans: TBD` / `pws-brain-mcp.onrender.com` line).

**Porcelain sha256 evidence for FLIP-09** (verbatim from this session's live run of `tests/test-339-gate-zero-write.sh`, the first evidence entry for FLIP-09):
```
plugin repo (/home/jsagi/dev/MindrianOS-Plugin):
  before = f64eb2a0d1144f16f8540d35ac8ee84b30b07831af5d71c24b5e8bea2fad1e29
  after  = f64eb2a0d1144f16f8540d35ac8ee84b30b07831af5d71c24b5e8bea2fad1e29
theo repo (/home/jsagi/Theo):
  before = 192b6a958bb60cad487e76bd2d767efaacf94f49910b0058c778dfcefe907cbd
  after  = 192b6a958bb60cad487e76bd2d767efaacf94f49910b0058c778dfcefe907cbd
```
Both byte-identical, confirming the gate's own verify block is a pure read in both repos.

`bash tests/run-all-339.sh` discovers all 7 `tests/test-339-*` files (4 `.cjs` + 3 `.sh`, all three of this plan's new `.sh` arms included via glob, no runner edit needed): `PASS=3 FAIL=9 SKIP=0`. The 9 FAILs are exactly the Wave-0-red-by-design set (`test-339-origin-single-source.cjs`, `test-339-enrichment-theo-shapes.cjs`, `test-339-schema-memo-origin-keyed.cjs`, `test-339-update-path-single-source.cjs`, `test-339-cross-repo-note.sh`, `test-339-269-05-checklist.sh`, the `254`/`250` "must not regress" arms which are this plan's own intentional RED extensions, and the no-em-dash fence failing only on the two not-yet-created files `lib/core/update-path.cjs` and `docs/339-NOTE-theo-desktop-connector-key.md`). The 3 PASSes are `test-339-gate-zero-write.sh` (this plan's GREEN-by-design arm), `build-skill-mirrors.cjs --check`, and `build-dist-bundles.cjs --check-stale`.

No blockers.

---
*Phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig*
*Completed: 2026-09-03*
