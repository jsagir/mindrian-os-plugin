---
phase: 250-honesty-rail-doctrine-amendment
plan: 03
subsystem: doctrine
tags: [provenance, brain-connector, voice-color-mark, dist-mirrors, honest-rail]
status: complete

requires:
  - phase: 250-honesty-rail-doctrine-amendment (250-01)
    provides: "The four refusal kinds and the Refusal section this plan's PARTIAL/TIER0 marking cross-references (the F.1 fork, site-11 mark)"
  - phase: 250-honesty-rail-doctrine-amendment (250-02)
    provides: "Form B hitl_stages already landed on brain-connector's frontmatter; this plan touches only the body"
provides:
  - "skills/brain-connector/SKILL.md '## Provenance (where methodology came from)' section: the terminal/Cowork mark form, Desktop degrade form, partial form, absence-is-the-signal, tier0-chain disclosure, anti-nagging, HTML-export rule, font caveat"
  - "tests/test-250-provenance-fence.cjs: contract-string fence over SKILL.md + both dist mirrors + a LIVE collision guard against lib/hmi/voice-color-mark.cjs"
  - "lib/hmi/voice-color-mark.cjs: countDeStijlGlyphs now exported (was internal-only; zero behavior change)"
affects: [250-04-silent-registration, 252-guard-sweep]

tech-stack:
  added: []
  patterns:
    - "Provenance mark reuses the existing [■ BRAIN] chip vocabulary (ui-system F.7 dial) -- no new glyph, no sixth color; the mark sits at the END of a grounded block, the voice-color mark owns the turn start, so the two never collide positionally or contractually"
    - "Live collision guard over source grep: the fence requires the real voice-color-mark.cjs module and calls the real countDeStijlGlyphs on a constructed sample, rather than asserting a code pattern about the detector's regex -- the frozen 5-glyph contract is verified by execution, not by inspection"

key-files:
  created:
    - tests/test-250-provenance-fence.cjs
  modified:
    - skills/brain-connector/SKILL.md
    - dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md
    - dist/zed/.agents/skills/brain-connector/SKILL.md
    - dist/BUNDLE-VERSION.json
    - lib/hmi/voice-color-mark.cjs
    - tests/run-all-250.sh

key-decisions:
  - "[Rule 3 - blocking issue] lib/hmi/voice-color-mark.cjs's countDeStijlGlyphs was defined and used internally by detectVoiceMark but never appeared in module.exports. The plan's own Test 3 spec requires calling it live via require(). Exporting an already-implemented, already-used pure function is not a change to the frozen glyph/color contract (no new glyph, no new color, no logic change) -- it only makes an existing internal helper externally callable. Verified zero regression: the four existing voice-mark test suites (test-larry-voice-mark-182, test-243-voice-glyph-honest, test-voice-glyph-advisory, test-192-statusline-stance-chip) all stayed green, and no test in the repo asserts an exhaustive/closed module.exports shape for this module."
  - "The Provenance section's own no-em-dash self-check (Test 4) initially failed against its own test file: the regex literal /—/ in tests/test-250-provenance-fence.cjs itself contained a literal em-dash character. Fixed by switching to the \\u2014 escape sequence -- a test-authoring correction, not a doctrine violation (the SKILL.md prose itself never carried an em-dash)."

requirements-completed: [HONEST-03]
requirements-pending: []

duration: "~25min commit-to-commit span"
completed: 2026-08-10
---

# Phase 250 Plan 03: Provenance Contract (SKILL.md Section + Collision Guard + Dist Rebuild) Summary

**The HONEST-03 provenance leg ships: graph-grounded answers now carry a "■ BRAIN" source
line reusing the frozen ui-system chip vocabulary, absence of the line is the Larry-voice
signal (mirroring the voice-color-mark design), partial material is disclosed rather than
served silently, and a LIVE collision guard proves the frozen 5-glyph voice-mark contract
survives the new mark on execution, not just by inspection.**

## Task Outcome

| Task | Status | Detail |
|------|--------|--------|
| Task 1: The provenance contract - SKILL.md section + collision guard + dist rebuild | **COMPLETE** | Commit `7720bc90`. RED recorded (4/4 failing, section absent), then green (4/4). |

This plan carries a single task; it is now fully complete. HONEST-03's provenance leg is
contract-complete (the SEED-011 key-ceremony half of HONEST-03 rides plan 250-04, per the
plan's own NOTE -- not this plan's scope).

## RED Proof (recorded)

`node --test tests/test-250-provenance-fence.cjs` run before the SKILL.md section existed:
**all 4 tests failed.**

- Test 1 (source contract strings): `AssertionError: expected a "## Provenance" section in
  skills/brain-connector/SKILL.md (RED before the rewrite lands it)`.
- Test 2 (dist parity): same failure against `dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md`.
- Test 3 (live collision guard): `countDeStijlGlyphs must be exported` -- `AssertionError:
  expected 'undefined' to equal 'function'`. This surfaced a genuine pre-existing gap: the
  function was implemented and used internally by `detectVoiceMark` but was never added to
  `module.exports`. Documented under Deviations below; fixed as a Rule 3 blocking-issue
  auto-fix (export only, zero logic change).
- Test 4 (no em-dash): same section-absent failure as Test 1 (the section didn't exist yet
  to check).

After writing the Provenance section, regenerating dist, and exporting
`countDeStijlGlyphs`: **4/4 green.**

```
ok 1 - Test 1: skills/brain-connector/SKILL.md carries the Provenance section with all seven contract points
ok 2 - Test 2: both dist mirrors carry the same Provenance contract strings
ok 3 - Test 3 (live collision guard): countDeStijlGlyphs ignores U+25A0, exactly-one-color-mark survives a marked block
ok 4 - Test 4: the Provenance section carries zero em-dashes (U+2014)
# tests 4
# pass 4
# fail 0
```

## The Provenance Section, Key Lines (verbatim, as landed in SKILL.md)

```markdown
## Provenance (where methodology came from)

Every graph-grounded answer carries ONE source line naming where its methodology came
from; a Larry-voice conversation turn carries none. Absence is the signal, mirroring the
Voice Signature design (larry-personality skill): color square = WHO is speaking, `■ BRAIN`
line = WHERE the methodology came from. One mechanism family, two planes. No new glyph, no
sixth color: the mark reuses the existing `[■ BRAIN]` chip vocabulary from
`skills/ui-system/SKILL.md`'s F.7 dial header chip -- the 12-glyph vocabulary is frozen.

- **THE MARK (terminal/Cowork):** `■ BRAIN: <framework> · <tool> · readiness <N>/4`,
  rendered at the END of the methodology content it grounds -- never turn-anchored (the
  voice-color mark owns the turn start).
- **Desktop degrade:** `**■ Brain:** <framework> · <tool> · readiness <N>/4` (bold markdown
  line, per the ui-system degrade table -- no box chars, no ANSI; `■` U+25A0 is a plain
  glyph that survives every surface).
- **PARTIAL:** a not_ready refusal answered with "use what the graph does hold" (the F.1
  fork, Refusal section above) serves prose search results marked
  `■ BRAIN (partial): <framework> · readiness <N>/4` -- the disclosed-degraded state, told,
  not hidden. Partial is served only after the navigator picks that fork; never by default.
- **TIER0 CHAINS:** anything derived from a `source:'tier0'` hardcoded chain (site 11,
  marked in Plan 250-01) is not graph-grounded -- no `■ BRAIN` line ever, and a methodology
  ask down that path refuses instead (until Phase 252 flips the chains).
- **ANTI-NAGGING:** one source line per answer, never per fact, never repeated within a
  turn -- a mark, not a narration.
- **HTML exports:** obey M:OS Design System v1.1 (the ui-system rule "if it renders as a
  page, it obeys M:OS") -- a source-line component, not the terminal chip.
- **Font caveat:** some fonts render `■` U+25A0 close to `⬛` U+2B1B; position disambiguates
  (the source line is never turn-anchored). Fallback if a live three-surface check shows
  real confusion: the literal word chip `[BRAIN]`.

The exactly-one-color-mark contract survives: `■` (U+25A0) is invisible to
`countDeStijlGlyphs` (`lib/hmi/voice-color-mark.cjs`), so a trailing source line never
breaks the frozen 5-glyph voice-mark count on a Larry turn.
```

Both dist mirrors (`dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md`,
`dist/zed/.agents/skills/brain-connector/SKILL.md`) carry the identical section, via
`node scripts/build-dist-bundles.cjs`.

## Collision-Guard Result (live, not source grep)

`tests/test-250-provenance-fence.cjs` Test 3 requires the real
`lib/hmi/voice-color-mark.cjs` and calls the real `countDeStijlGlyphs` on a constructed
sample turn: one legitimate voice-color glyph (`\u{2B1C}` white square, invisibility) +
prose + a trailing `■ BRAIN: Jobs to Be Done · brain_search · readiness 3/4` line.

**Result: `countDeStijlGlyphs(sample) === 1`** -- exactly the one legitimate voice-color
glyph; `■` U+25A0 is invisible to the detector's 5-glyph `MARK_GLYPHS` map (it only matches
`U+1F7E6/E5/E8` and `U+2B1B/1C`). A second assertion,
`countDeStijlGlyphs('■ BRAIN: x') === 0`, confirms a bare provenance line with no voice mark
counts zero. The exactly-one-color-mark contract in `detectVoiceMark` is untouched --
`lib/hmi/voice-color-mark.cjs`'s glyph map, color map, and detection logic were not edited;
only `countDeStijlGlyphs` was added to `module.exports` (see Deviations).

## Dist Rebuild Verification

```
$ node scripts/build-dist-bundles.cjs
Wrote dist/generic-claude-dir/ (126 skills, nested .claude/skills/**)
Wrote dist/zed/ (126 skills, flat .agents/skills/**, 13235/51200 catalog bytes = 26%)
Wrote dist/BUNDLE-VERSION.json (source_version 1.16.0-beta.12, 126 skills, 13235 catalog bytes)
Wrote dist/README.md (no-auto-update statement + staleness check)

$ node scripts/build-dist-bundles.cjs --check-stale
dist bundle fresh: stale=false (source_version 1.16.0-beta.12)
$ echo $?
0
```

Diff scope confirmed minimal: only `dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md`,
`dist/zed/.agents/skills/brain-connector/SKILL.md`, and `dist/BUNDLE-VERSION.json` changed
(no unrelated stale-skill sweep this time -- the 250-01 rebuild already cleared that drift).

## Gates (as required)

| Gate | Result |
|------|--------|
| `node --test tests/test-250-provenance-fence.cjs` | 4/4 green (RED run recorded first) |
| `node --test tests/test-250-doctrine-fence.cjs` | 2/2 green, still green after the SKILL.md edit + dist rebuild |
| `node scripts/build-dist-bundles.cjs --check-stale` | exit 0 |
| `bash tests/run-all-250.sh` | `PASS=7 FAIL=0 SKIP=0` (6 pre-existing 250 suites + the new provenance-fence suite, discovered by glob) |
| `node --test tests/test-larry-voice-mark-182.cjs tests/test-243-voice-glyph-honest.cjs tests/test-voice-glyph-advisory.cjs tests/test-192-statusline-stance-chip.cjs` | all green -- zero regression from the `countDeStijlGlyphs` export |
| `node scripts/check-shape-declaration.cjs --check` | 53 WARN violations, exit 0 (identical baseline to 250-02's recorded set; brain-connector still absent from the warn list -- this plan touched only the SKILL.md body, not frontmatter) |
| `node scripts/build-connector-registry.cjs --check` | `connector-registry: OK` |

## Task Commit

1. **Task 1: provenance contract - SKILL.md section + collision guard + dist rebuild** - `7720bc90` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue fix] `countDeStijlGlyphs` was never exported from `lib/hmi/voice-color-mark.cjs`**
- **Found during:** Task 1, first RED run of Test 3 (the live collision guard).
- **Issue:** The plan's Test 3 spec explicitly says "require lib/hmi/voice-color-mark.cjs
  and call countDeStijlGlyphs" -- but the module only exported `VOICE_COLOR_MARKS`,
  `MARK_COLORS`, `MARK_PALETTE_KEYS`, `MARK_GLYPHS`, `COLOR_GLYPHS`, `NON_DESTIJL_GLYPHS`,
  `markForMove`, `glyphForColor`, `glyphForMove`, `detectVoiceMark`, `paletteAnchorOk`.
  `countDeStijlGlyphs` was defined and used internally by `detectVoiceMark` but never
  reached `module.exports`. A grep across the whole repo (including all `.claude/worktrees/`
  copies) confirmed no other file exported or required it directly -- this was a genuine gap,
  not a naming mismatch.
- **Fix:** Added `countDeStijlGlyphs` to `module.exports`, with a comment explaining why
  (Phase 250-03's live collision guard) and stating explicitly that this is zero new
  behavior -- no new glyph, no new color, no logic change to the pure function itself.
  Verified no test in the repo asserts an exhaustive/closed shape for this module's exports
  (`Object.keys` checks were absent from every consuming test file), and the four existing
  voice-mark test suites all stayed green after the change.
- **Files modified:** `lib/hmi/voice-color-mark.cjs`
- **Verification:** `node --test tests/test-larry-voice-mark-182.cjs
  tests/test-243-voice-glyph-honest.cjs tests/test-voice-glyph-advisory.cjs
  tests/test-192-statusline-stance-chip.cjs` -- all green, zero regression.
- **Committed in:** `7720bc90`

**2. [Rule 3 - Blocking issue fix] The provenance fence's own no-em-dash test carried a literal em-dash**
- **Found during:** Task 1, running `bash tests/run-all-250.sh` after the section landed and
  Test 3's export fix was applied.
- **Issue:** `tests/test-250-provenance-fence.cjs`'s no-em-dash regex was written as the
  literal character class `/—/` -- which itself contains a literal U+2014 em-dash character
  inside the test file, tripping the phase runner's own em-dash sweep on the test file
  itself (not on any doctrine or production text).
- **Fix:** Replaced the literal character with the `—` Unicode escape sequence in both
  occurrences (the shared `assertContractPoints` helper and the standalone Test 4). This is
  a test-authoring correction; the SKILL.md prose itself never carried an em-dash at any
  point.
- **Files modified:** `tests/test-250-provenance-fence.cjs`
- **Committed in:** `7720bc90`

**3. [Minor addition] Added the new test file to `tests/run-all-250.sh`'s em-dash sweep target list**
- **Found during:** Task 1, after creating the new test file.
- **Rationale:** The runner's own header states its em-dash fence sweeps "every file this
  phase touches"; `tests/test-250-provenance-fence.cjs` is a phase-250 file the enumerated
  list did not yet include. One-line addition, zero behavior change to any other target.
- **Files modified:** `tests/run-all-250.sh`
- **Committed in:** `7720bc90`

---

**Total deviations:** 3 (2 Rule-3 blocking-issue fixes, 1 minor scope-consistent addition).
**Impact on plan:** No scope creep beyond what the plan's own Test 3 spec required to be
callable; no production behavior changed outside the one intentional export.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired components introduced by this
plan.

## Threat Flags

None new. This plan's threat register (T-250-09 spoofed provenance, T-250-10 glyph
confusion) is addressed by the landed work: T-250-09's mitigation (the mark's closed
fence-tested form) is live via Test 1/2; T-250-10's mitigation (the live collision guard +
position anchoring) is live via Test 3, and the font-caveat fallback (`[BRAIN]` word chip)
is recorded in the section text itself.

## Issues Encountered

None beyond the three deviations above.

## User Setup Required

None. No external service configuration; zero npm dependencies touched (repo convention
honored).

## Next Phase Readiness

- HONEST-03's provenance contract leg is complete and independently verified: the
  Provenance section ships in `skills/brain-connector/SKILL.md` and both dist mirrors, the
  live collision guard proves `countDeStijlGlyphs` is invisible to `■` U+25A0, and the
  doctrine fence stays green.
- Live three-surface rendering proof is explicitly deferred to plan 250-04's
  released-build checkpoint (restart-to-apply rule), per this plan's own success criteria --
  this plan claims contract, not live behavior.
- SEED-011's key-ceremony resolution (the second half of HONEST-03) rides plan 250-04, not
  this plan (per the plan's own NOTE).
- `lib/hmi/voice-color-mark.cjs`'s `countDeStijlGlyphs` export is now available for any
  future consumer (e.g. plan 250-04's three-surface checkpoint) without needing to
  re-derive glyph-counting logic.
- A parallel executor (251-01, Cache-Aware Trigger Redesign) shared this checkout during
  this session with zero file overlap against this plan's touched files; commit `7720bc90`
  landed cleanly between `a0696999` (250-02's ratification) and `ea237e6d` (251-01's
  closeout), verified via `git diff --diff-filter=D` (zero unintended deletions) and
  `git status` (only this plan's 7 files staged at commit time).

---
*Phase: 250-honesty-rail-doctrine-amendment*
*Completed: 2026-08-10*
