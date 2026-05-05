---
phase: 115-owned-emotion-dual-path-first-touch
plan: 00
subsystem: testing-fixtures
tags: [owned-emotion, validation-fixtures, spec-strings, source-of-truth, rollback-procedure, empathy-audit, canon-part-10]

# Dependency graph
requires:
  - phase: 114-larry-default-activation
    provides: agents/larry-extended.md initialPrompt placeholder that 115-03 replaces with persona-aware variants
provides:
  - lib/copy/115-spec-strings.cjs frozen single-source-of-truth for D-02..D-09 spec strings (8 keys)
  - tests/fixtures/115-baseline-surfaces.txt pre-rewrite snapshot of 8 surfaces
  - tests/fixtures/115-validation-email-template.md 5-tester async D-13/D-15 email body
  - tests/fixtures/115-tester-rubric.md 5x4 synthesis table template (D-15)
  - tests/manual/115-acceptance.md 3-tester CLI/Desktop/Cowork empathy-audit checklist
  - tests/manual/115-rollback-procedure.md D-20 pre-committed rollback procedure
  - docs/copy/115-website-hero.md out-of-repo D-09 deliverable
affects: [115-01-surface-rewrites, 115-02-dual-path-detector, 115-03-persona-variants, 115-04-release-orchestrator, 116-unresolved-tension-hook, 121-trajectory-telemetry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen-table CJS module pattern for spec-string constants (sibling to lib/core/persona-taxonomy.cjs)"
    - "Pre-committed rollback procedure pattern (Pitfall 5 mitigation: deliberation forbidden during failure window)"
    - "Out-of-repo deliverable as in-repo verifiable artifact (Pitfall 4 mitigation: cross-repo manual handoff via CHANGELOG)"

key-files:
  created:
    - lib/copy/115-spec-strings.cjs
    - tests/fixtures/115-baseline-surfaces.txt
    - tests/fixtures/115-validation-email-template.md
    - tests/fixtures/115-tester-rubric.md
    - tests/manual/115-acceptance.md
    - tests/manual/115-rollback-procedure.md
    - docs/copy/115-website-hero.md
  modified: []

key-decisions:
  - "Spec strings live in a single frozen CJS module (lib/copy/115-spec-strings.cjs); all 8 surfaces in 115-01/02/03 import rather than hardcoding (Pitfall 1 mitigation)"
  - "Fallback emotion ranking is pre-committed: #1 = 'I have a pile of insights and I can't see the shape of them.' (Pitfall 5)"
  - "Mechanism vs copy split: D-20 rollback mutates lib/copy/115-spec-strings.cjs string VALUES only, not the 8-key shape; persona_variants frontmatter, dual-path-detector, shallow-doc-parser stay intact"
  - "Out-of-repo website hero (D-09) is owned in-repo as docs/copy/115-website-hero.md and applied manually post-merge per CHANGELOG action item; no gh automation"
  - "Pitfall 7 documented as known limitation: Researcher.IND + Founder.grant alias to default until role_blend schema extended in Phase 100 (deferred to v1.14.0); does NOT block AC-115-04 ship"
  - "30-day stickiness shortfall is OUT OF SCOPE for Phase 115 D-20 rollback; routes to Phase 116 Unresolved Tension Hook acceleration"

patterns-established:
  - "Single source of truth for cross-surface copy: frozen Object with named keys, imported by every surface, mutated only at pre-committed rollback points"
  - "Pre-flight Wave 0 establishes ALL validation infrastructure (template, rubric, baseline, rollback) BEFORE any production-code changes in Wave 1"
  - "Verbatim spec strings: byte-exact assertions on the four most-typo-attacked strings (SPLASH_COPY, NEW_PROJECT_OPENER, MARKETING_LINE, INITIAL_PROMPT_DEFAULT)"

requirements-completed: [AC-115-01, AC-115-02]

# Metrics
duration: 6m 19s
completed: 2026-05-05
---

# Phase 115 Plan 00: Wave 0 Preflight Summary

**Frozen 8-key spec-strings module + 5-tester async validation infrastructure + D-20 pre-committed rollback procedure shipped as Wave 0 prerequisites for Phase 115 owned-emotion dual-path first-touch.**

## Performance

- **Duration:** 6m 19s
- **Started:** 2026-05-05T19:06:23Z
- **Completed:** 2026-05-05T19:12:42Z
- **Tasks:** 7
- **Files created:** 7
- **Files modified:** 0

## Accomplishments

- `lib/copy/115-spec-strings.cjs` ships as the frozen single source of truth for D-02..D-09 spec strings (8 keys: SPLASH_COPY, NEW_PROJECT_OPENER, MARKETING_LINE, DROR_TEST_CRITERIA, INITIAL_PROMPT_DEFAULT, ONBOARD_OPENING_FRAMING, README_HERO_TAGLINE, WEBSITE_HERO_TAGLINE). All four most-typo-attacked strings verified byte-exact via runtime assertion. Object.isFrozen returns true.
- `tests/fixtures/115-baseline-surfaces.txt` (127 lines) captures pre-Phase-115 snapshot of 8 surfaces (commands/splash.md, commands/new-project.md, README.md, agents/larry-extended.md, commands/onboard.md, plus Dror criteria grep + website out-of-repo placeholder). Future regression diff is mechanical.
- `tests/fixtures/115-validation-email-template.md` ships the 5-tester async email body with verbatim vivid-memory probe question from the-owned-emotion.md and 4 questions (Y/N vivid, recency days, current-solution adequacy, free-text). Cohort confirmed against `docs/testers/REGISTRY.md`: lawrence-aronhime + justin-stitzlein + aryeh-holtzberg + adam-peters + shmuel-schuman.
- `tests/fixtures/115-tester-rubric.md` ships the 5x4 synthesis table with D-20 hard-threshold decision gate explicit (Q1 YES count >= 4 AND mean recency <= 14 days = SHIP).
- `tests/manual/115-acceptance.md` ships the 3-tester empathy-audit checklist (Tester A CLI cold-start, Tester B Desktop cold-start, Tester C Cowork investor role_blend=1.0) with Pitfall 7 documented.
- `tests/manual/115-rollback-procedure.md` is pre-committed BEFORE validation week begins (Pitfall 5 mitigation). Fallback emotion #1 ranked + verbatim spec strings written; mechanism-vs-copy split explicit (DO NOT REVERT list); 30-day stickiness signal correctly routed to Phase 116, not this rollback.
- `docs/copy/115-website-hero.md` is the in-repo verifiable artifact for the out-of-repo D-09 website hero rewrite at ~/mindrian-website/ (Pitfall 4 mitigation). Manual application steps documented; D-20 rollback cascade noted.

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/copy/115-spec-strings.cjs single source of truth** - `65c1fdc` (feat)
2. **Task 2: pre-Phase-115 baseline snapshot of 8 surfaces** - `74d4c68` (chore)
3. **Task 3: 5-tester async validation email template** - `19a512a` (feat)
4. **Task 4: 5x4 tester synthesis rubric template** - `8b8fc73` (feat)
5. **Task 5: 3-tester CLI/Desktop/Cowork empathy-audit checklist** - `e3b15fc` (feat)
6. **Task 6: D-20 rollback procedure (Pitfall 5 mitigation)** - `558c3de` (feat)
7. **Task 7: out-of-repo website hero deliverable (Pitfall 4)** - `6d56d2f` (feat)

**Plan metadata commit:** [pending — appended after STATE/ROADMAP updates]

## Files Created/Modified

- `lib/copy/115-spec-strings.cjs` - Frozen 8-key spec-strings module, single source of truth for D-02..D-09; downstream 115-01/02/03 surface rewrites import from here.
- `tests/fixtures/115-baseline-surfaces.txt` - 127-line pre-Phase-115 snapshot of 8 surface anchor lines for future mechanical regression diff.
- `tests/fixtures/115-validation-email-template.md` - 5-tester async email body (BCC cohort, 48h reply window) with verbatim vivid-memory probe question and 4 quick questions.
- `tests/fixtures/115-tester-rubric.md` - 5x4 synthesis table template; D-20 hard-threshold ship/rollback decision gate explicit.
- `tests/manual/115-acceptance.md` - 3-tester empathy-audit checklist covering AC-115-01..04 across CLI/Desktop/Cowork; Pitfall 7 (Researcher.IND alias-to-default) documented as known limitation.
- `tests/manual/115-rollback-procedure.md` - Pre-committed D-20 rollback procedure with fallback emotion #1 ranked + verbatim strings + DO-NOT-REVERT mechanism integrity guards.
- `docs/copy/115-website-hero.md` - In-repo verifiable artifact for out-of-repo website hero rewrite at ~/mindrian-website/; manual application steps + D-20 rollback cascade note.

## Decisions Made

- **Single source of truth pattern:** lib/copy/115-spec-strings.cjs is FROZEN at ship; downstream rewrites import via `require('./lib/copy/115-spec-strings.cjs').<KEY>`. Eliminates typo-attack surface across 8 surfaces (Pitfall 1).
- **Pre-committed rollback ranking:** Fallback emotion #1 ("I have a pile of insights...") chosen and verbatim spec strings written for all 8 surfaces in advance. Live deliberation during failure window forbidden (Pitfall 5).
- **Mechanism-vs-copy split:** D-20 rollback ONLY mutates string values in lib/copy/115-spec-strings.cjs; persona_variants frontmatter shape, dual-path-detector logic, shallow-doc-parser logic, and all test files stay untouched. Future fallback iterations are cheap.
- **Out-of-repo deliverable handling:** docs/copy/115-website-hero.md serves as the in-repo verifiable artifact for D-09; manual cross-repo handoff via CHANGELOG action item (no gh automation, per Open Question 3 in 115-RESEARCH.md).
- **30-day stickiness routing:** D-20 covers ONLY validation-week 4-of-5 hard threshold. 30-day Trigger Internal shortfall routes to Phase 116 Unresolved Tension Hook, not back to 115. Phase 115's emotion stays validated even if the loop hasn't fully closed at 30-day mark.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `<action>` blocks contained the verbatim file bodies for each of the 7 tasks. All 7 files were written byte-exact to the plan specification, including:

- All 5 spec strings byte-exact in lib/copy/115-spec-strings.cjs (verified via runtime grep + Node assertion).
- All 5 tester slugs and emails matching docs/testers/REGISTRY.md (lawrence-aronhime + justin-stitzlein + aryeh-holtzberg + adam-peters + shmuel-schuman; cohort identified at planning time, no Tester 5 placeholder needed).
- D-20 fallback emotion #1 ranked + verbatim strings pre-committed.
- Pre-commit timestamp present (`pre_committed_at: 2026-05-05`) before validation week begins.
- No em-dashes in any of the 7 files (verified via grep across all deliverables).
- No emoji in any of the 7 files (verified via U+1F300-1F9FF + U+2600-27BF range scan).

**Total deviations:** 0
**Impact on plan:** None. Plan fidelity is 100%.

## Issues Encountered

None. All 7 tasks completed in 6m 19s with no blockers.

The earlier em-dash check on Task 3 returned a non-zero exit because grep returns 1 when there are no matches; the chained `&&` interpreted "no matches" as failure. The diagnostic confirmed no em-dashes were present; the check logic itself was the issue. Subsequent verifications restructured the check with explicit if-then to avoid the false positive.

## Verification Results

### Spec-strings module (Task 1)

```
PASS: 8 frozen keys, all spec strings byte-exact
PASS: SPLASH_COPY substring grep ('Let's find the shape of it')
PASS: no em-dash
```

### All 7 Wave 0 files exist

```
OK: lib/copy/115-spec-strings.cjs
OK: tests/fixtures/115-validation-email-template.md
OK: tests/fixtures/115-tester-rubric.md
OK: tests/fixtures/115-baseline-surfaces.txt
OK: tests/manual/115-acceptance.md
OK: tests/manual/115-rollback-procedure.md
OK: docs/copy/115-website-hero.md
```

### Hard rules

```
OK: no em-dashes in any Wave 0 file
OK: no obvious emoji in Wave 0 files
```

## Canon Part 8 Audit (NO LEAK confirmed)

| Code path | LOCAL data → BRAIN? | Verdict |
|-----------|---------------------|---------|
| lib/copy/115-spec-strings.cjs | Static plugin-distributed strings; no user data; no network call | NO LEAK |
| tests/fixtures/115-validation-email-template.md | Email template body; tester replies file LOCAL to docs/testers/{slug}/replies/ | NO LEAK |
| tests/fixtures/115-tester-rubric.md | LOCAL synthesis file; never queried by Brain | NO LEAK |
| tests/fixtures/115-baseline-surfaces.txt | Snapshot of own plugin source; no user data | NO LEAK |
| tests/manual/115-acceptance.md | Manual checklist; no execution path that egresses data | NO LEAK |
| tests/manual/115-rollback-procedure.md | Procedure file; no execution path that egresses data | NO LEAK |
| docs/copy/115-website-hero.md | Static plugin-distributed strings; out-of-repo manual cross-repo paste | NO LEAK |

**Verdict:** PASSES Canon Part 8 conformance. Wave 0 introduces zero LOCAL → BRAIN egress paths.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Wave 0 is complete and Wave 1 (115-01 surface rewrites + 115-02 dual-path detector + 115-03 persona variants) is unblocked:

- 115-01 can `require('./lib/copy/115-spec-strings.cjs').SPLASH_COPY`, `.NEW_PROJECT_OPENER`, `.MARKETING_LINE`, `.DROR_TEST_CRITERIA` for the 4 spec-locked surface rewrites.
- 115-02 will use `INITIAL_PROMPT_DEFAULT` as the agents/larry-extended.md cold-start value when authoring the 5-feature additive-score dual-path detector.
- 115-03 will use the `persona_variants:` frontmatter shape with all 9 keys (default + 8 archetypes); the `default` value reads from `INITIAL_PROMPT_DEFAULT`.
- 115-04 release orchestrator can run the 8-grep regression diff against tests/fixtures/115-baseline-surfaces.txt to confirm rewrites landed.

5-tester validation email is ready to dispatch when Wave 1 ships; D-20 rollback procedure pre-committed and on disk.

No blockers identified.

## Self-Check: PASSED

**Files verified on disk (8/8):**
- FOUND: lib/copy/115-spec-strings.cjs
- FOUND: tests/fixtures/115-validation-email-template.md
- FOUND: tests/fixtures/115-tester-rubric.md
- FOUND: tests/fixtures/115-baseline-surfaces.txt
- FOUND: tests/manual/115-acceptance.md
- FOUND: tests/manual/115-rollback-procedure.md
- FOUND: docs/copy/115-website-hero.md
- FOUND: .planning/phases/115-owned-emotion-dual-path-first-touch/115-00-SUMMARY.md

**Commits verified in git log (7/7):**
- FOUND: 65c1fdc (Task 1)
- FOUND: 74d4c68 (Task 2)
- FOUND: 19a512a (Task 3)
- FOUND: 8b8fc73 (Task 4)
- FOUND: e3b15fc (Task 5)
- FOUND: 558c3de (Task 6)
- FOUND: 6d56d2f (Task 7)

---
*Phase: 115-owned-emotion-dual-path-first-touch*
*Plan: 00*
*Completed: 2026-05-05*
