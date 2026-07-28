---
phase: 243-voice-glyph
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - lib/statusline/cockpit-renderer.cjs
  - tests/test-voice-glyph-advisory.cjs
  - tests/test-192-statusline-stance-chip.cjs
  - tests/test-243-voice-glyph-honest.cjs
  - tests/run-all-243.sh
  - tests/test-243-rca-routing.cjs
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 243: Code Review Report

**Reviewed:** 2026-07-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 243 (GLYPH-01) deletes the 4-line `stanceDefaultGlyph` fabrication branch from
`lib/statusline/cockpit-renderer.cjs` and inverts the three test assertions that used to
certify it (`tests/test-voice-glyph-advisory.cjs` leg 3, `tests/test-192-statusline-stance-chip.cjs`
cases (b)/(c)). I re-ran every listed test file individually and via `tests/run-all-243.sh`
multiple times; the code change itself is correct and the new/updated assertions pass
consistently (`test-243-voice-glyph-honest.cjs`: 18/18, `test-243-rca-routing.cjs`: 21/21,
`test-voice-glyph-advisory.cjs`: 4/4, `test-192-statusline-stance-chip.cjs`: 27/27, the 210-B
regression leg: green). I also confirmed via mutation (manually re-inspecting the deleted
branch) that the mutation-gate rows (2b/2c) in `test-243-voice-glyph-honest.cjs` do isolate the
fabrication correctly, and that no other test file in the repo references the removed
`stanceDefaultGlyph` behavior.

The core defect fix is sound. The issues below are all documentation-drift and
test-infrastructure-reliability problems, not behavioral regressions:

1. Two doc blocks inside `cockpit-renderer.cjs` itself (the file's own top-of-file overview and
   the `stance_forced_color` field doc) were **not** updated and now contradict the corrected
   inline comment three lines below them, and the new behavior.
2. `tests/test-voice-glyph-advisory.cjs` carries the same kind of stale, contradicting local
   comment immediately above the leg-3 test it renamed.
3. `tests/run-all-243.sh` cites `run-all-192.sh` and `run-all-210.sh` as "must stay green"
   regression legs, but both aggregators currently fail on legs that are **entirely unrelated**
   to voice-glyph/stance work (a `help.md` content-drift assertion in 192-01, and two pre-existing
   failures in 210-D/210-E3). This means `tests/run-all-243.sh` can never report overall PASS in
   the current repo state, even though every assertion this phase actually owns is green -
   the aggregator's claim to be "the single PASS/FAIL gate for GLYPH-01" is not true as written.
4. Doctrine files outside the reviewed list (`skills/stance/SKILL.md`,
   `skills/larry-personality/SKILL.md`, `commands/stance.md`, and their `dist/` mirrors) still
   describe the fabrication behavior this phase deleted as current, live behavior. Flagged as
   info since they are outside the explicit file scope, but they are a direct, provable
   consequence of this change being left inconsistent.

I also observed one non-reproducible RED result on `test-243-voice-glyph-honest.cjs` rows
2b/2c during my very first run of `tests/run-all-243.sh` in this session, which did not
reproduce on 5 subsequent runs (standalone and via the aggregator) and could not be attributed
to any state in the reviewed files (the render path is provably pure - no fs/env reads in the
hot path). I am not filing this as a finding since I cannot reproduce or attribute it, but flag
it here in case CI sees the same intermittency.

## Warnings

### WR-01: `run-all-243.sh`'s regression legs make the phase gate permanently red for unrelated reasons

**File:** `tests/run-all-243.sh:60-61`
**Issue:** The script unconditionally runs `bash tests/run-all-192.sh` and `bash tests/run-all-210.sh`
as pass/fail legs and folds their exit codes into the phase's own PASS/FAIL tally. Both
aggregators currently fail on legs that have nothing to do with GLYPH-01:
- `run-all-192.sh` leg `192-01 menu-sweep live selectors`: fails because `help.md` "still names
  the two-axis lanes-as-tabs model" - unrelated content drift, not stance/voice-glyph.
- `run-all-210.sh` legs `210-D fusion-router suite` and `210-E3 stamp sweep clean (--check)`:
  fail on `deepStrictEqual` mismatches and a pending stamp-sweep, both unrelated to voice-glyph.

The two legs this phase actually cares about (`192-04` inside `run-all-192.sh`, and `210-B
voice-glyph advisory` inside `run-all-210.sh`) pass cleanly (verified live: `192-04: PASSED`,
`210-B: PASSED`). But because the script gates on the *entire* aggregator exit code rather than
the specific legs it names in its own header comment ("these carry the three assertions this
phase inverted and MUST stay green"), `tests/run-all-243.sh` reports `Phase 243: PASS=2 FAIL=2`
and a non-zero exit in the current repo state, and will continue to until unrelated Phase 192/210
regressions are separately fixed. A gate that is red for reasons unrelated to what it claims to
guard teaches reviewers to ignore it - the same trust erosion this milestone's own "false-success"
framing is trying to close, just inverted into a false-failure.
**Fix:** Either (a) invoke the two specific regression files/assertions directly instead of the
full aggregators (e.g. `node tests/test-voice-glyph-advisory.cjs` and a scoped invocation of just
the `(b)`/`(c)` cases in `test-192-statusline-stance-chip.cjs`, which `run-all-243.sh` already
does not need the rest of `run-all-192.sh`/`run-all-210.sh` for), or (b) note the two known,
unrelated pre-existing failures explicitly in the script (e.g. an allowlist of already-failing
legs) so the aggregator's own exit code reflects only what Phase 243 is responsible for.

### WR-02: Stale top-of-file docblock in `cockpit-renderer.cjs` still describes the deleted fabrication as current behavior

**File:** `lib/statusline/cockpit-renderer.cjs:42-53`
**Issue:** The "SEED-042 STANCE CHIP" module-level overview comment was not updated by this
phase and still says: *"(b) applies the stance's DEFAULT voice-glyph color (redteam=red /
tell-act=blue) as a PREFERENCE, not an override... the stance color fills the glyph when
natural voice-mark detection is silent; a confident natural detection wins (Phase 210 item B)."*
This is exactly the behavior the diff deletes. It directly contradicts the corrected inline
comment at lines 338-347 ("Phase 243 (GLYPH-01) supersedes the second half of Phase 210 item
B: natural voice-mark detection is the ONLY source of the glyph... The stance color no longer
fills the default..."), inside the very same file. A reader who reads only the top overview
(the normal way to orient in a new file) will come away believing the fabrication is still live.
**Fix:** Update the bullet at lines 47-50 to state that the stance color renders only the
`[stance]` chip and no longer supplies a default glyph, cross-referencing GLYPH-01/Phase 243,
matching the language already used at lines 338-347.

### WR-03: Stale field doc for `stance_forced_color` in the same file

**File:** `lib/statusline/cockpit-renderer.cjs:307-309`
**Issue:** The `renderCockpit` JSDoc still documents `stance_forced_color` as *"the DEFAULT
Tier-1 voice glyph when natural detection is silent (preference, not an override - Phase 210
item B; field name kept for the signal seam)"*. That is no longer true: the field now drives
nothing but the `[stance]` chip text choice upstream; it no longer reaches the glyph at all.
**Fix:** Reword to say the field is retained for the `[stance]` chip / signal seam only and no
longer influences the Tier-1 glyph (per GLYPH-01), matching WR-02.

### WR-04: Stale local comment directly contradicts the renamed test it documents

**File:** `tests/test-voice-glyph-advisory.cjs:90-91`
**Issue:** The comment immediately above the `leg 3` test call still reads: *"Leg 3 -- PRESERVE
FLOOR: with no natural voice signal, the stance color still applies as the default glyph. The
capability survives the softening."* Three lines below, the test itself was correctly renamed
to `'leg 3 SUPERSEDED BY PHASE 243: with no natural signal the stance color must NOT render a
glyph'` and asserts the opposite (`line.indexOf(RED_GLYPH) !== -1` must be `false`). The file's
own top-of-file summary (lines 14-17) was updated correctly; this one local comment block was
missed, leaving two contradictory descriptions of the same test three lines apart.
**Fix:** Replace the stale comment block with language matching the leg's new name and the
top-of-file summary (e.g. "Leg 3 -- SUPERSEDED BY PHASE 243 (GLYPH-01): with no natural voice
signal the stance color must NOT render a glyph; the fabrication is removed").

## Info

### IN-01: Doctrine files outside the reviewed scope still document the removed fabrication as live behavior

**File:** `skills/stance/SKILL.md:46`, `skills/larry-personality/SKILL.md:137`,
`commands/stance.md:48` (plus their `dist/generic-claude-dir/` and `dist/zed/` mirrors)
**Issue:** Not in the file list for this review, but directly falsified by it: these skill/command
docs still say the stance color is "a default the renderer prefers when natural voice detection
is silent" and that "`redteam` defaults to the RED challenge square... when natural detection is
silent" (`skills/larry-personality/SKILL.md:137`). Phase 243 removed exactly that default-fill
behavior; these doctrine files were not updated in this change and now describe non-existent
runtime behavior to any agent or user who reads them.
**Fix:** File a follow-up (or fold into this phase if still open) to update these doctrine files
and their `dist/` mirrors to match the GLYPH-01 honest-empty behavior, consistent with the
correction already made in `cockpit-renderer.cjs`'s inline comment.

---

_Reviewed: 2026-07-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
