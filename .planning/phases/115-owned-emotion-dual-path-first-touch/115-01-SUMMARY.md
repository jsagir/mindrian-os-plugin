---
phase: 115-owned-emotion-dual-path-first-touch
plan: 01
subsystem: surface-rewrites
tags: [owned-emotion, first-touch-surfaces, copy-rewrite, canon-part-10, source-of-truth-import, pitfall-1-mitigation]

# Dependency graph
requires:
  - phase: 115-00
    provides: lib/copy/115-spec-strings.cjs frozen single-source-of-truth (SPLASH_COPY, NEW_PROJECT_OPENER, MARKETING_LINE, DROR_TEST_CRITERIA, ONBOARD_OPENING_FRAMING, README_HERO_TAGLINE)
provides:
  - commands/splash.md: D-02 SPLASH_COPY tagline rendered after banner script invocation
  - commands/new-project.md: D-03 NEW_PROJECT_OPENER replaces Phase 114-era 'What are you working on?' opener in Step 3
  - commands/onboard.md: D-07 ONBOARD_OPENING_FRAMING leads Step 1 (emotion before methodology)
  - README.md: D-08 README_HERO_TAGLINE replaces 'Your project becomes your co-founder' bold line
  - docs/testers/REGISTRY.md: D-05 DROR_TEST_CRITERIA ships as 'Test subject criteria (Dror 2.0)' subsection in Protocol section
affects: [115-02-dual-path-detector, 115-03-persona-variants, 115-04-release-orchestrator, 116-unresolved-tension-hook, 121-trajectory-telemetry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verbatim spec-string surfacing: every Phase 115 first-touch surface quotes lib/copy/115-spec-strings.cjs constant values byte-exact, surface body comments name the constant for executor-recognition (Pitfall 1 mitigation at the rendering layer)"
    - "Surgical insertion vs replacement (D-07): emotion paragraph blockquote prepended BEFORE existing 'Very simply -- there are three ways' paragraph rather than replacing it, preserving voice DNA continuity ('Very simply -- ...' opener already present in onboard.md)"
    - "Bold-tagline swap (D-08): single-line README hero edit preserves all badges, footer links, body sections, version number; minimizes diff surface for mechanical regression diff against tests/fixtures/115-baseline-surfaces.txt"
    - "Em-dash scrub (CLAUDE.md hard rule): pre-existing em-dashes in REGISTRY.md table rows + Adding-a-tester step 5 replaced with ASCII hyphens as part of in-scope edit (Rule 1 + Rule 2 auto-fix per CLAUDE.md no-em-dashes hard rule)"

key-files:
  created:
    - .planning/phases/115-owned-emotion-dual-path-first-touch/115-01-SUMMARY.md
  modified:
    - commands/splash.md
    - commands/new-project.md
    - commands/onboard.md
    - README.md
    - docs/testers/REGISTRY.md

key-decisions:
  - "All 5 surfaces import from lib/copy/115-spec-strings.cjs (Pitfall 1 mitigation: every D-string carried byte-exact; future executors can grep -F the constant value AND the comment naming the constant)"
  - "D-07 inserted BEFORE existing 'Very simply -- there are three ways' paragraph rather than replacing -- voice DNA continuity preserved per D-07 explicit constraint (voice rules + symbol vocabulary stay locked)"
  - "REGISTRY.md em-dash scrub treated as in-scope deviation (Rule 1/2 auto-fix): CLAUDE.md no-em-dashes hard rule applies project-wide; the file is now in scope for this plan, so 4 pre-existing em-dashes (3 in tester table Path A/B/banana-ripener notes, 1 in Adding-a-tester step 5) replaced with ASCII hyphens"
  - "agents/larry-extended.md NOT touched in this plan (file-disjoint from 115-03 sole owner per option-a Wave 1 partition)"
  - "lib/core/* + bin/mindrian-mcp-server.cjs NOT touched in this plan (file-disjoint from 115-02 sole owner)"

patterns-established:
  - "Wave-1 file-disjointness preserved by surface partition: 115-01 owns visible copy surfaces (splash, new-project, onboard, README, REGISTRY); 115-02 owns mechanism (lib/core/* + MCP server wiring); 115-03 owns initialPrompt + persona_variants frontmatter (agents/larry-extended.md)"
  - "Spec-string surface comments: every rewritten body block names lib/copy/115-spec-strings.cjs <KEY> + Pitfall 1 explicitly so future regressions are caught by grep on either the value or the constant-name comment"
  - "In-scope CLAUDE.md hard-rule enforcement: when a plan modifies a file, pre-existing em-dashes in that file are scrubbed to ASCII hyphens as part of the same commit (Rule 1/2 auto-fix scope)"

requirements-completed: [AC-115-02]

# Metrics
duration: 3m 19s
completed: 2026-05-05
---

# Phase 115 Plan 01: Surface Rewrites (5 First-Touch Files) Summary

**5 first-touch surfaces (commands/splash.md, commands/new-project.md, commands/onboard.md, README.md, docs/testers/REGISTRY.md) rewrite to verbatim spec strings imported from lib/copy/115-spec-strings.cjs; D-02 + D-03 + D-05 + D-07 + D-08 land byte-exact; Phase 114-era 'What are you working on?' + 'Your project becomes your co-founder' replaced with the Phase 115 owned emotion across the CLI/Desktop/Cowork first-touch loop.**

## Performance

- **Duration:** 3m 19s
- **Started:** 2026-05-05T19:17:45Z
- **Completed:** 2026-05-05T19:21:04Z
- **Tasks:** 5
- **Files created:** 0 (5 file edits + this SUMMARY.md)
- **Files modified:** 5

## Accomplishments

- `commands/splash.md` now renders the D-02 SPLASH_COPY tagline ("Stuck on a decision you can't name? Let's find the shape of it.") on its own line after the De Stijl Mondrian banner script invocation. Frontmatter (name, description, body_shape: raw, serves_jtbd: ["explore"], allowed-tools) byte-identical pre/post. Body comment names lib/copy/115-spec-strings.cjs SPLASH_COPY as source-of-truth (Pitfall 1 mitigation).
- `commands/new-project.md` Step 3 ("Deep Exploration") opener rewritten from the Phase 114-era "I'm Larry. What are you working on?" to the D-03 form "I'm Larry. What decision is stuck?" Cold-start full default invitation ("Tell me, or paste a doc/CV.") documented as appropriate for agents/larry-extended.md initialPrompt surface (D-06, owned by Plan 115-03), not for explicit /mos:new-project invocation. Upload-path forward-reference to Plan 115-02 mechanism (lib/core/dual-path-detector.cjs + lib/core/shallow-doc-parser.cjs) embedded.
- `commands/onboard.md` Step 1 leads with D-07 ONBOARD_OPENING_FRAMING blockquote BEFORE the existing "Very simply -- there are three ways to use MindrianOS" paragraph. Insertion not replacement: voice DNA continuity preserved per D-07 constraint (voice rules + symbol vocabulary stay locked; only the OPENING framing changes). Mode 1 / Mode 2 / Mode 3 sections + Steps 2 onward byte-identical.
- `README.md` hero bold tagline rewritten from "Your project becomes your co-founder." to "For founders stuck on a decision they can't name." (D-08 = MARKETING_LINE = D-04). All badges (Plugin Version, License, Commands, Skills, Agents, Hooks, Edge Types, Brain Nodes, Node, Surfaces) preserved. All footer links (Website, Marketplace, Brain Access, Roadmap) preserved. "What MindrianOS Actually Does" H2 + 57x telemetry claim + Quick Start + Permissions + every other section preserved byte-identical.
- `docs/testers/REGISTRY.md` gains a new "Test subject criteria (Dror 2.0 -- D-05 per Phase 115)" subsection IMMEDIATELY BEFORE "Adding a tester" in the Protocol section. Subsection embeds D-05 verbatim ("a founder who is stuck on a decision right now and cannot name it.") + 3-step recruitment screen + Pitfall-1-mitigation framing + D-20 rollback path (mutate lib/copy/115-spec-strings.cjs DROR_TEST_CRITERIA value, not subsection structure). Active testers table (Lawrence + Justin + Aryeh + Adam + Shmuel rows) preserved. Adding-a-tester + Per-tester-folder-structure + Sending-a-release-update + Expiry-handling + Cross-references subsections preserved.
- 4 pre-existing em-dashes in `docs/testers/REGISTRY.md` (3 in tester rows: Path A em-dash, Path B em-dash, banana-ripener em-dash; 1 in Adding-a-tester step 5) replaced with ASCII hyphens as in-scope CLAUDE.md hard-rule enforcement (Rule 1/2 auto-fix; em-dash check is also a Phase 115 verification gate per Pitfall-2 hard rule).

## Task Commits

Each task was committed atomically with --no-verify (Wave 1 parallel-executor convention to avoid pre-commit hook contention):

1. **Task 1: D-02 SPLASH_COPY in commands/splash.md** - `2cd8228` (feat)
2. **Task 2: D-03 NEW_PROJECT_OPENER in commands/new-project.md Step 3** - `7f99743` (feat)
3. **Task 3: D-07 ONBOARD_OPENING_FRAMING in commands/onboard.md Step 1** - `29ba994` (feat)
4. **Task 4: D-08 README_HERO_TAGLINE in README.md** - `4052b79` (feat)
5. **Task 5: D-05 DROR_TEST_CRITERIA in docs/testers/REGISTRY.md + em-dash scrub** - `d450a7b` (feat)

**Plan metadata commit:** [pending - appended after STATE/ROADMAP updates]

## Files Created/Modified

- `commands/splash.md` - Banner-script body retained; D-02 SPLASH_COPY tagline + Pitfall-1 source-of-truth reference inserted after the bash code block; "After printing the tagline, say nothing else" phrase preserves the original Phase 88 visual-discipline rule.
- `commands/new-project.md` - Step 3 opener line replaced with D-03; cold-start dual-path extension paragraph + upload-path forward-reference to 115-02 mechanism embedded; Voice Rules / Step 4-9 / ROOM.md template / git-setup / KAIROS-context / opportunity-bank-seeding all byte-identical.
- `commands/onboard.md` - Step 1 D-07 emotion blockquote + source-of-truth reference inserted IMMEDIATELY AFTER the H2 heading and BEFORE the existing first paragraph; Mode 1/2/3 + Step 2 (Opportunity Bank) + Step 3 (Knight framing) + Step 4 (USER.md) + Step 4b + Step 5 (What's New) + Step 6 (Wrap) + USER.md generation + Marker writing + Error handling all byte-identical.
- `README.md` - Single bold-tagline line swap; logo `<img>` + h1 + "Powered by PWS" paragraph + "Built by Jonathan Sagir" + 10 badges + 4 footer links + every body section preserved.
- `docs/testers/REGISTRY.md` - 4 em-dash to hyphen replacements + new Test-subject-criteria subsection insertion before Adding-a-tester; active testers table + 4 other Protocol subsections preserved.

## Decisions Made

- **Source-of-truth surfacing pattern:** every rewritten surface contains BOTH the verbatim spec string AND a body comment naming `lib/copy/115-spec-strings.cjs` <KEY> as the source-of-truth. Future executors get two recovery surfaces: grep on the string value (mechanical regression check) and grep on the constant-name reference (semantic regression check). Pitfall 1 mitigation at the rendering layer.
- **D-07 insertion not replacement:** the existing onboard.md line "Very simply -- there are three ways to use MindrianOS. Pick the one that fits how you think." is preserved; the D-07 emotion blockquote is inserted BEFORE it. This honors the D-07 constraint ("voice rules + symbol vocabulary stay locked; only the OPENING framing changes") while still surfacing the emotion as the literal first thing the user reads in Step 1.
- **README hero scope minimization:** D-08 is a single-line bold-tagline swap. Plugin Version badge (currently v1.10.10) explicitly NOT bumped in this plan -- 115-04 release orchestrator owns the version bump to v1.13.0-beta.3 per Wave-2 contract. Reduces 115-01 diff surface for the 115-04 mechanical regression diff against tests/fixtures/115-baseline-surfaces.txt.
- **REGISTRY.md em-dash scrub as in-scope auto-fix:** CLAUDE.md hard rule "no em-dashes in any output" applies project-wide; the file is in-scope for Plan 115-01 by virtue of the D-05 subsection insertion; the 4 pre-existing em-dashes (3 in active-testers table notes, 1 in Adding-a-tester step 5) are not Phase 115 regressions but are in scope for cleanup per Rule 1 + Rule 2 (CLAUDE.md compliance is a correctness requirement, not a feature).

## Deviations from Plan

**1. [Rule 1/2 - Auto-fix CLAUDE.md hard-rule violation] Em-dash scrub in docs/testers/REGISTRY.md (Task 5)**

- **Found during:** Task 5 verification (`grep -nP "[\x{2014}\x{2013}]" docs/testers/REGISTRY.md` returned 4 matches)
- **Issue:** docs/testers/REGISTRY.md contained 4 pre-existing em-dashes (lines 18, 19, 20, 39) from prior tester-cohort work (NOT introduced by Phase 115). The plan's Task 5 verify block runs an em-dash check that would have failed; CLAUDE.md hard rule "no em-dashes in any output" applies project-wide.
- **Fix:** Replaced 4 em-dashes with ASCII double-hyphens in the same Task 5 commit (consistent with onboard.md "Very simply --" pattern).
  - Line 18: `Path A — full install` -> `Path A -- full install`
  - Line 19: `Path B — paste-prompt` -> `Path B -- paste-prompt`
  - Line 20: `"Banana ripener" — coined the framing` -> `"Banana ripener" -- coined the framing`
  - Line 39: `the per-tester folder scaffolding — never commit` -> `the per-tester folder scaffolding -- never commit`
- **Files modified:** docs/testers/REGISTRY.md (Task 5 commit absorbs the scrub)
- **Commit:** d450a7b (combined with the D-05 subsection insertion per task-atomicity convention)

The plan's verify block explicitly checks for em-dashes; the auto-fix turns a verification gate into a passing check. No semantic content changed in the affected lines (Path A, Path B, banana-ripener annotation, step 5 of Adding-a-tester all read identically).

**Total deviations:** 1 (Rule 1/2 auto-fix; documented per spec)
**Impact on plan:** zero -- the plan's Task 5 verify block (`grep -nP "—|—" docs/testers/REGISTRY.md && echo "FAIL: em-dash" && exit 1 || echo "PASS"`) now passes because of this fix; without it, Task 5 would have failed verification despite the D-05 string landing correctly.

## Issues Encountered

None. All 5 tasks completed in 3m 19s with no blockers.

The em-dash discovery on Task 5 was anticipated by the plan's verify block; the fix was a 4-line substitution applied in the same commit. No additional commits, no scope drift.

## Verification Results

### All 5 D-strings landed byte-exact

```
PASS D-02 SPLASH    grep -F "Stuck on a decision you can't name? Let's find the shape of it." commands/splash.md
PASS D-03 NEW_PROJECT  grep -F "I'm Larry. What decision is stuck?" commands/new-project.md
PASS D-07 ONBOARD   grep -F "if you're here, you're probably stuck on a decision you can't quite name" commands/onboard.md
PASS D-08 README    grep -F "**For founders stuck on a decision they can't name.**" README.md
PASS D-05 DROR      grep -F "a founder who is stuck on a decision right now and cannot name it." docs/testers/REGISTRY.md
```

### Hard rules

```
PASS no em-dashes across all 5 modified files (commands/splash.md, commands/new-project.md, commands/onboard.md, README.md, docs/testers/REGISTRY.md)
PASS no emoji in any of the 5 modified files
PASS pre-115 hero "Your project becomes your co-founder" removed from README.md (regression check passes)
```

### Frontmatter integrity (gray-matter parse)

```
OK frontmatter: commands/splash.md name=splash serves_jtbd=["explore"]
OK frontmatter: commands/new-project.md name=new-project serves_jtbd=["explore"]
OK frontmatter: commands/onboard.md name=onboard serves_jtbd=["explore"]
```

### File-disjointness (Wave 1 partition)

```
agents/larry-extended.md last touched at commit 0c6b5ff (Phase 114) - 115-03 sole owner; 115-01 did NOT touch
lib/core/dual-path-detector.cjs not yet present in repo - 115-02 sole owner; 115-01 did NOT touch
lib/core/shallow-doc-parser.cjs not yet present in repo - 115-02 sole owner; 115-01 did NOT touch
bin/mindrian-mcp-server.cjs last touched at commit 5d09163 (Phase 58) - 115-02 sole owner for 115 wave; 115-01 did NOT touch
```

## Canon Part 8 Audit (NO LEAK confirmed)

| Code path | LOCAL data -> BRAIN? | Verdict |
|-----------|---------------------|---------|
| commands/splash.md edit | Static plugin-distributed copy (banner script + tagline string); no user data; no network call | NO LEAK |
| commands/new-project.md edit | Static plugin-distributed instructions + forward-reference to 115-02 mechanism (which is itself NO-LEAK per its own audit) | NO LEAK |
| commands/onboard.md edit | Static plugin-distributed copy; D-07 framing paragraph; no user data | NO LEAK |
| README.md edit | Static plugin-distributed marketing copy; visible publicly on GitHub | NO LEAK |
| docs/testers/REGISTRY.md edit | Static recruitment criteria documentation; tester emails are LOCAL-only (already in registry pre-115) | NO LEAK |

**Verdict:** PASSES Canon Part 8 conformance. Plan 115-01 is pure copy edits + 1 in-file em-dash scrub; introduces zero LOCAL -> BRAIN egress paths. Pre-existing brain-boundary-scan hook (Phase 87) passes without modification.

## User Setup Required

None - no external service configuration required for Plan 115-01.

The 5-tester async validation email (Wave 0 deliverable at `tests/fixtures/115-validation-email-template.md`) is ready to dispatch when Wave 2 release orchestration (115-04) lands; until then, the tester pool is informed by the existing wave-2 BCC convention.

## Next Phase Readiness

Plan 115-01 closes the visible-surface partition of Wave 1. Sibling plans:

- **115-02 (sibling, Wave 1, in progress):** owns lib/core/dual-path-detector.cjs + lib/core/shallow-doc-parser.cjs + bin/mindrian-mcp-server.cjs wiring. Test commit aedfca1 already landed (TDD RED). 115-01 forward-references the mechanism in commands/new-project.md Step 3 -- the connection is now in place; once 115-02 ships, the upload-path response works end-to-end.
- **115-03 (sibling, Wave 1):** owns agents/larry-extended.md initialPrompt swap + persona_variants frontmatter map (D-06, D-10, D-11, D-12). 115-01 commands/new-project.md Step 3 references the agents/larry-extended.md initialPrompt surface for cold-start dual-path invitation; once 115-03 ships, the surface coverage is complete.
- **115-04 (Wave 2):** release orchestrator. Will run the 8-grep regression diff against `tests/fixtures/115-baseline-surfaces.txt` to confirm all 8 surface rewrites landed (5 in this plan + 3 in 115-03 + Wave-0-shipped docs/copy/115-website-hero.md), bump plugin version to v1.13.0-beta.3, update CHANGELOG.md, dispatch 5-tester async validation email.

No blockers identified for Plan 115-01.

## Self-Check: PASSED

**Files verified on disk (5/5 modified + 1 created):**
- FOUND: commands/splash.md (modified)
- FOUND: commands/new-project.md (modified)
- FOUND: commands/onboard.md (modified)
- FOUND: README.md (modified)
- FOUND: docs/testers/REGISTRY.md (modified)
- FOUND: .planning/phases/115-owned-emotion-dual-path-first-touch/115-01-SUMMARY.md (created)

**Commits verified in git log (5/5):**
- FOUND: 2cd8228 (Task 1 - splash.md)
- FOUND: 7f99743 (Task 2 - new-project.md)
- FOUND: 29ba994 (Task 3 - onboard.md)
- FOUND: 4052b79 (Task 4 - README.md)
- FOUND: d450a7b (Task 5 - REGISTRY.md + em-dash scrub)

---
*Phase: 115-owned-emotion-dual-path-first-touch*
*Plan: 01*
*Completed: 2026-05-05*
