---
phase: 250-honesty-rail-doctrine-amendment
plan: 02
subsystem: doctrine
tags: [amendment, decisions-md, hitl-shape, form-b, brain-connector, ratification]
status: checkpoint

requires:
  - phase: 250-honesty-rail-doctrine-amendment (250-01)
    provides: "The four refusal kinds, the doctrine-dead SKILL.md, and the Refusal section this amendment's causal record cites"
provides:
  - "docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md - the ratifiable amendment unit (not yet navigator-signed)"
  - "Form B hitl_stages declaration on skills/brain-connector/SKILL.md (stage brain-refusal-fork, shape F.1, mode gate)"
  - "docs/HITL-SHAPE-DECLARATION-CONTRACT.md updated: brain-connector moved from the exempt-five list to declared, four skills remain exempt"
affects: [252-guard-sweep]

tech-stack:
  added: []
  patterns:
    - "Amendment-sweep lockstep: the ratified doc's own STATUS + EFFECTIVE clause makes every intermediate release self-describing; decisions.md rows apply mechanically only in the release that completes SWEEP-01..03"
    - "Form B hitl_stages + connector.excluded:true coexist cleanly (gate predicate 2b only flags scalar hitl_shape + excluded, not hitl_stages + excluded) - the larry-personality precedent, now also brain-connector"

key-files:
  created:
    - docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md
    - tests/test-250-amendment-unit.cjs
  modified:
    - skills/brain-connector/SKILL.md
    - docs/HITL-SHAPE-DECLARATION-CONTRACT.md
    - dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md
    - dist/zed/.agents/skills/brain-connector/SKILL.md
    - dist/BUNDLE-VERSION.json

key-decisions:
  - "Task 1 (application-timing) was pre-ruled by the navigator via the orchestrator's live Decision Gate on 2026-08-10, before this execution session started - recorded verbatim below, not re-litigated."
  - "Test 1/2/3's verbatim-string assertions normalize whitespace (collapsing markdown hard-wrap newlines and stripping blockquote '> ' markers) before substring-matching, so editorial line-wrapping in the amendment doc's prose never produces a false-negative against a verbatim multi-line quote."

requirements-completed: []
requirements-pending: [HONEST-02]

duration: "~25min to the checkpoint (commit-to-commit span)"
completed: 2026-08-10
---

# Phase 250 Plan 02: Doctrine Amendment (Decisions #1/#8) + Form B Declaration Summary

**The single reviewable amendment unit for Decisions #1 and #8 is drafted, tested green, and
committed; the refusal fork's HITL shape is declared Form B on brain-connector with zero new
gate warns; the plan now sits at Task 3, the navigator ratification checkpoint, and is
PAUSED there awaiting sign-off.**

## Tasks Completed vs Stopped

| Task | Status | Detail |
|------|--------|--------|
| Task 1: Navigator call - amendment application timing | **RULED, not re-litigated** | Pre-ruled by the navigator via the orchestrator's live Decision Gate, 2026-08-10. See "Task 1 Ruling" below. |
| Task 2: The amendment unit - doc + Form B declaration + contract doc + gates | **COMPLETE** | Commit `decac6d0`. RED recorded (8/9 failing, doc absent), then green (9/9). |
| Task 3: Navigator ratification of the amendment unit | **STOPPED HERE - blocking checkpoint** | Genuine `checkpoint:human-verify`. Awaiting the navigator's "ratified" or a wording-change direction. |

## Task 1 Ruling (verbatim, as directed)

> **doc-now / rows-at-sweep** - the amendment doc merges now with the explicit
> in-force-with-the-SWEEP-release clause; decisions.md rows flip in 252's release commit.

Ruled by the navigator, 2026-08-10, via the orchestrator's live Decision Gate. This matches
the research recommendation (option-doc-now) and is recorded verbatim in
`docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` section 1 ("Application-timing ruling").

## The Amendment's Two Replacement Rows (verbatim)

**New Decision #1 row:**

> One-command install; the Brain is part of what installs. Larry's methodology comes from
> the Brain and says so; a keyless session gets an honest refusal and a visible path to a
> key, never an imitation.

**New Decision #8 row:**

> Honest refusal everywhere. A Brain failure or readiness miss surfaces in-turn and
> auto-queues enrichment; no surface conceals a failure or serves methodology the graph did
> not give.

Both rows are asserted byte-verbatim by `tests/test-250-amendment-unit.cjs` (Test 1, two
assertions). `.claude/includes/decisions.md` itself is UNCHANGED by this plan - Test 4 is a
negative assertion proving rows 1 and 8 still read their pre-amendment text
("Zero config; Larry works immediately." / "graceful degradation everywhere"). Application
rides Phase 252's release, per the Task 1 ruling.

## Consequential-Edits Ledger (as landed in the amendment doc, section 6)

1. `.claude/includes/decisions.md` rows 1, 5, and 8 - the verbatim replacement text.
2. `CLAUDE.md` - the "one-command install" / "zero infrastructure" claims. **Line numbers
   corrected from the original research's `:19`/`:84` to the current, drifted
   `CLAUDE.md:29` and `CLAUDE.md:94`** (re-verified this session by direct read).
3. **`docs/MINDRIAN-CANON.md:21`** - folded in per the user's direction and cross-checked
   against `252-RESEARCH.md`'s own coordination note ("MINDRIAN-CANON.md:21 - a gap in
   250's consequential ledger"). This line carries the dying Tier-0 doctrine ("Larry
   operates with Brain (Full Loop) or without Brain (Local Only)... Tier 0 methodology
   fallbacks... enriched but never replaced") at the constitutional layer, OUTSIDE
   `decisions.md`, and was absent from the original 250-RESEARCH.md ledger. It now rides
   252's release alongside the decisions.md rows. `MINDRIAN-CANON.md:193`'s unrelated
   "Tier 0 fallback" (cold-start option set) is explicitly excluded from this ledger item
   per 252's own vocabulary-collision finding - renamed, not amended, behavior unchanged.
4. `docs/install/BRAIN-SETUP.md`'s broader Tier-0 prose (the keyless sentence itself was
   already fixed in 250-01).
5. The tier-0-no-key fixture inversion (SWEEP-02), gated on `check-flagship-floor.cjs`.
6. The living-docs list, re-measured per `252-RESEARCH.md` from an original ~121-file
   estimate down to 72 non-dist files / 114 including dist mirrors - the ledger cites the
   re-measured count so 252 does not under-scope against the stale estimate.
7. The `source:'tier0'` hardcoded chains in `lib/core/brain-client.cjs` (site 11, marked in
   250-01, flipped in SWEEP-01).
8. The SEED-011 registration behavior (ships inside this milestone via plan 250-04 plus the
   operator deploy; cross-repo definition of done applies).

## Task 2 - RED Proof (recorded)

`node --test tests/test-250-amendment-unit.cjs` run before the amendment doc existed:
**8 of 9 tests failed** (`ENOENT` on `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md`). Test 4
(the decisions.md negative assertion) passed trivially - decisions.md already existed,
unchanged, from prior phases, so the lockstep guard was true before there was anything to
guard.

After drafting the amendment doc: 7 of 9 passed on the first full run; two failures were
test-authoring bugs, not doctrine gaps - the verbatim-row and causal-record assertions did
literal substring matching against prose that markdown hard-wraps at ~78-80 columns, so a
sentence spanning two source lines failed to match as one string. Fixed by normalizing
whitespace (collapsing wrap-newlines, stripping blockquote `> ` markers) before matching,
in the TEST file, not by reformatting the doc's prose into unreadable single lines. Final
run: **9/9 green.**

## Task 2 - Gates (baseline-diff, as required)

| Gate | Baseline (pre-edit) | After | Result |
|------|---------------------|-------|--------|
| `node scripts/check-shape-declaration.cjs --check` | 53 WARN violations, exit 0, brain-connector absent from the warn list | 53 WARN violations (identical set, diffed only in the SQLite experimental-warning PID line), exit 0, brain-connector still absent from the warn list | **Zero new warns** |
| `node scripts/build-connector-registry.cjs --check` | `connector-registry: OK` | `connector-registry: OK` | **R1 ledger unbroken** |
| `node scripts/build-dist-bundles.cjs --check-stale` | n/a (pre-rebuild) | `dist bundle fresh: stale=false`, exit 0 | **green** |
| `node --test tests/test-250-doctrine-fence.cjs` | n/a | 2/2 green | **fence stays green** |
| `bash tests/run-all-250.sh` | n/a | `PASS=6 FAIL=0 SKIP=0` (5 pre-existing 250 suites + the new amendment-unit suite, discovered by glob) | **green** |

## Form B Declaration (landed)

```yaml
hitl_stages:
  - stage: "brain-refusal-fork"
    shapes: ["F.1"]
    mode: "gate"
hitl_why: "A Brain failure or readiness miss is a genuine Decision-Gate fork: the navigator picks the next move (connect the key, retry, use partial graph material with provenance, or continue without methodology) - never silently degraded."
```

`connector.excluded: true` stays with its existing reason (Ambient always-on infra); the R1
ledger requires it. `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`'s exempt-skills list was
updated: brain-connector moved to declared, four skills remain exempt (context-engine,
room-passive, pws-methodology, ui-system).

## Task Commits

1. **Task 2: amendment unit + Form B declaration + contract doc + gates** - `decac6d0` (feat)

## The Ratification Checkpoint (Task 3, verbatim as presented to the navigator)

**Type:** human-verify
**Plan:** 250-02
**Progress:** 2/3 tasks complete (Task 1 ruled by prior gate, Task 2 committed); Task 3
blocking.

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Navigator call - amendment application timing | (ruled, no commit - orchestrator Decision Gate) | n/a |
| 2 | The amendment unit - doc + Form B declaration + contract doc + gates | `decac6d0` | `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md`, `tests/test-250-amendment-unit.cjs`, `skills/brain-connector/SKILL.md`, `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`, both dist mirrors |

### Current Task

**Task 3:** Navigator ratification of the amendment unit
**Status:** awaiting decision
**Blocked by:** the navigator has not yet reviewed and signed off on the amendment doc.

### Checkpoint Details

**What was built:** The complete amendment unit: `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md`
(both replacement rows verbatim, causal record a-e with citations, effective clause,
consequential-edits ledger including the MINDRIAN-CANON.md:21 coordination item and the
corrected CLAUDE.md:29/:94 line numbers, pending sign-off line), the Form B `hitl_stages`
declaration on brain-connector with clean R16/R1 gates, and the updated
declaration-contract doc.

**How to verify:**
1. Read `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` top to bottom.
2. Confirm the causal record is the record you want ON THE RECORD: the verbatim old clause,
   the sanitize-hook outage, the inert activation key, the counterfeit framing question,
   the 2026-08-10 stale-cache reproduction.
3. **EXPLICIT INTERPRETATION FLAG (research A3 - the one judgment call):** HONEST-02 says
   "rewrites Decisions #1 and #8 TOGETHER as one reviewable unit". This plan satisfies that
   with the ratified document carrying both replacement rows verbatim; the decisions.md row
   application is mechanical in Phase 252's release per your Task 1 ruling. Confirm this
   interpretation, or direct the inline variant.
4. Confirm the two verbatim replacement rows read exactly as you want them applied in 252
   (any wording change now updates doc + test constants in the same commit).
5. On approval: the executor fills the ratification block (navigator, date 2026-08-10 or
   the actual date), re-runs `node --test tests/test-250-amendment-unit.cjs` and
   `bash tests/run-all-250.sh` to confirm green with the signed doc.

### Awaiting

Navigator to type "ratified" to sign off, or describe the changes required (wording edits
loop back through Task 2's test constants).

**Resume-signal:** `Type "ratified" to sign off, or describe the changes required (wording edits loop back through Task 2's test constants).`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue fix] Test file's verbatim-string assertions broke on markdown hard-wrap**
- **Found during:** Task 2, first green-attempt run against the drafted amendment doc.
- **Issue:** `tests/test-250-amendment-unit.cjs`'s Test 1/2/3 asserted `text.includes(...)`
  against multi-word strings, but the amendment doc's prose (correctly) hard-wraps at
  ~78-80 columns for readability, so a sentence spanning two source lines contains an
  embedded `\n` the fixed-string constant does not. The old-clause blockquote additionally
  carried a `> ` prefix on its second line.
- **Fix:** Added a `normalizeWhitespace()` helper to the test file that strips leading
  `> ` blockquote markers per line, then collapses all whitespace runs (including
  newlines) to a single space, before substring-matching. This is a test-authoring
  correction, not a change to the doc's actual verbatim content - the underlying prose was
  never touched.
- **Files modified:** `tests/test-250-amendment-unit.cjs`
- **Committed in:** `decac6d0`

**2. [Rule 3 - Blocking issue fix] Test 2's SWEEP-01..03 phrase check needed a case-insensitive match**
- **Found during:** Task 2, same green-attempt run.
- **Issue:** The plan's Test 2 spec quotes the phrase as lowercase ("in force with the
  release that completes SWEEP-01..03"), but the amendment doc's STATUS + EFFECTIVE clause
  (per Pattern 6's drafting direction, which capitalizes the operative doctrine words)
  reads "IN FORCE with the release that completes SWEEP-01..03." Both are the same
  doctrine phrase; the case difference is stylistic emphasis, not a wording change.
- **Fix:** Changed the assertion to a case-insensitive regex.
- **Files modified:** `tests/test-250-amendment-unit.cjs`
- **Committed in:** `decac6d0`

---

**Total deviations:** 2 (both test-authoring corrections). **Impact on plan:** No scope
creep; no production/doctrine text differs from what the plan specified. Both deviations
are documented here rather than silently fixed.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired components introduced by this
plan.

## Threat Flags

None. This plan's threat register (T-250-05/06/07) is fully addressed by the landed work:
the causal record + authority + dated sign-off line live inside the tracked amendment doc
(T-250-05); Test 4's negative assertion on decisions.md rows 1/8 is live and green
(T-250-06); `connector.excluded:true` was kept and `build-connector-registry --check` is
green (T-250-07). No new trust-boundary surface was introduced outside the plan's own
`<threat_model>`.

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None. No external service configuration; zero npm dependencies touched.

## Next Phase Readiness

**This plan is PAUSED at Task 3, not complete.** HONEST-02 remains unchecked in
`REQUIREMENTS.md` until the navigator ratifies. On resume:

1. Present the amendment doc and this checkpoint's verification steps to the navigator.
2. On "ratified": fill the ratification block in
   `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` (navigator name, date), re-run
   `node --test tests/test-250-amendment-unit.cjs` and `bash tests/run-all-250.sh` to
   confirm still green, commit, mark HONEST-02 complete in REQUIREMENTS.md, and close out
   this plan's STATE.md / final-commit steps.
3. On a wording-change direction: loop back through Task 2's doc + test constants in the
   same commit, per the plan's own resume-signal instruction.

Plans 250-03 (provenance marking) and 250-04 (silent registration) do not depend on this
plan's ratification outcome and can proceed in parallel; their file scopes do not overlap
this plan's. A parallel executor is working on `scripts/intent-classifier.cjs` +
session-start (251-01) with zero file overlap expected against this plan's touched files.

---
*Phase: 250-honesty-rail-doctrine-amendment*
*Status: checkpoint (paused at Task 3)*

## Self-Check: PASSED

`docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` and `tests/test-250-amendment-unit.cjs`
verified present on disk. Commit `decac6d0` verified present in `git log --oneline --all`.
This SUMMARY.md itself verified present.
