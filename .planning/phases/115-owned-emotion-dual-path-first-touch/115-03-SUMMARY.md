---
phase: 115-owned-emotion-dual-path-first-touch
plan: 03
subsystem: agent-frontmatter-and-body
tags: [persona-variants, owned-emotion, role-blend, dual-path-detection, canon-part-2a, canon-part-5, canon-part-10, larry-extended, ac-115-04]

# Dependency graph
requires:
  - phase: 114-larry-default-activation
    provides: agents/larry-extended.md Phase 114 baseline (skills array, model, color, initialPrompt-as-string)
  - phase: 115
    plan: 00
    provides: lib/copy/115-spec-strings.cjs INITIAL_PROMPT_DEFAULT for D-17 byte-exact equivalence
provides:
  - agents/larry-extended.md frontmatter persona_variants 10-key map (1 default + 9 Canon Appendix C hirer types)
  - agents/larry-extended.md initialPrompt updated to D-17 verbatim (byte-exact equals lib/copy/115-spec-strings.cjs INITIAL_PROMPT_DEFAULT)
  - agents/larry-extended.md body section ## Persona-Aware Turn 1 (Phase 115) with role_blend lookup + cold-start branch + reliability fence + dual-path detection branch
  - tests/test-115-persona-variants.sh 7-test bash suite for AC-115-04 verification
affects:
  - 115-04-release-orchestrator (consumes verified persona_variants frontmatter for v1.13.0-beta.2 promotion gate)
  - 116-unresolved-tension-hook (downstream Phase 116 builds on persistent role_blend reading)
  - 118-30-second-mva-reward-before-investment (downstream Phase 118 reads dual-path detector branch substrate)
  - 121-trajectory-telemetry (downstream Phase 121 records variant_key emissions per documented schema)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom frontmatter key (persona_variants:) loaded into system prompt context; agent body conditionally renders variant from role_blend lookup"
    - "Triple byte-exactness chain: persona_variants.default == initialPrompt == lib/copy constant (sibling-pattern to single-source-of-truth Wave 0 module)"
    - "Cold-start fallback + reliability fence pattern for probabilistic LLM agent body conditional logic (Pitfall 2 + Pitfall 8 mitigations)"

key-files:
  created:
    - tests/test-115-persona-variants.sh
  modified:
    - agents/larry-extended.md

key-decisions:
  - "persona_variants is a 10-entry YAML map (1 default + 9 Canon Appendix C hirer types) per RESEARCH DISCRETION-02 resolution; initialPrompt remains a top-level string scalar (Claude Code platform constraint)"
  - "3 unique non-default variant strings landed (founder + researcher + investor) per AC-115-04 minimum; 6 keys (researcher_ind, founder_grant, operator, mentor, domain_expert, student) aliased to default verbatim per Pitfall 7 known limitation"
  - "Aliased keys carry literal duplication (NOT YAML anchors) so all 10 strings parse uniformly across downstream tools; future phases write specific copy without touching the mechanism"
  - "Cold-start branch (Pitfall 2): USER.md absent OR role_blend missing OR all weights 0 -> render persona_variants.default; reliability fence (Pitfall 8): any failure -> default variant (never crash, never compose ad-hoc)"
  - "Dual-path detection branch documents BOTH CLI shell-out AND MCP tool path per RESEARCH DISCRETION-03 and tri-polar surface contract; coordinated with 115-02's lib/core/dual-path-detector.cjs + bin/mindrian-mcp-server.cjs detect_dual_path tool registration"
  - "Phase 114 baseline preserved byte-identical (skills array, model: inherit, color: purple, name, description) per Open Question 4 recommendation"

patterns-established:
  - "Persona-aware first-touch via custom YAML frontmatter map + agent body conditional render (scales to all 9 Canon Appendix C hirer types from day one; future copy without mechanism touch)"
  - "Reliability fence + cold-start fallback for agent body conditional logic (probabilistic LLM mitigation)"
  - "Triple byte-exactness chain: agent frontmatter.default == agent frontmatter.initialPrompt == lib/copy SSOT constant (eliminates spec-string drift across surface boundaries)"

requirements-completed: [AC-115-04]

# Metrics
duration: 4m 34s
completed: 2026-05-05
---

# Phase 115 Plan 03: Persona-Aware Turn-1 Mechanism + Dual-Path Detection Branch

**10-key persona_variants frontmatter + Persona-Aware Turn 1 body section + 7-test verification suite shipped on agents/larry-extended.md (single file edit + new test file). Mechanism scales to all 9 Canon Appendix C hirer types; 3 unique non-default copy strings (founder + researcher + investor) satisfy AC-115-04 minimum. Phase 114 baseline preserved byte-identical.**

## Performance

- **Duration:** 4m 34s
- **Started:** 2026-05-05T19:19:08Z
- **Completed:** 2026-05-05T19:23:43Z
- **Tasks:** 3
- **Files created:** 1 (tests/test-115-persona-variants.sh)
- **Files modified:** 1 (agents/larry-extended.md)

## Accomplishments

- `agents/larry-extended.md` frontmatter `initialPrompt:` value replaced from Phase 114 placeholder ("I'm Larry. What are you working on?") to D-17 verbatim ("I'm Larry. What decision is stuck? (Tell me, or paste a doc/CV.)") -- byte-exact equals `lib/copy/115-spec-strings.cjs` `INITIAL_PROMPT_DEFAULT`.
- `agents/larry-extended.md` frontmatter `persona_variants:` 10-key map added (Canon Appendix C 9 hirer types + default) per RESEARCH DISCRETION-02 resolution. 3 unique non-default copy strings landed for founder, researcher, investor (AC-115-04 minimum 3 satisfied). 6 keys (researcher_ind, founder_grant, operator, mentor, domain_expert, student) alias to default verbatim per Pitfall 7 known limitation (researcher_ind / founder_grant not detectable from 7-key role_blend until role_blend schema extends in Phase 100 / v1.14.0).
- `agents/larry-extended.md` body appends new `## Persona-Aware Turn 1 (Phase 115)` section documenting: 7-step turn-1 procedure (read USER.md role_blend, pick highest-weight role, map canonical_role to persona_variants_key, look up variant, cold-start fallback, render-and-continue, reliability fence); canonical role -> persona_variants_key mapping table (9 entries with Researcher.IND + Founder.grant alias-to-default annotation); Dual-Path Detection subsection consuming Plan 115-02 artifacts (CLI shell-out OR MCP detect_dual_path; 3 explicit branches: upload / type / ambiguous); "Why this exists" footnote (Canon Part 10 sub-claim 2 grounding + Canon Part 8 LOCAL-only audit).
- `tests/test-115-persona-variants.sh` 7-test bash suite ships for AC-115-04 verification + Phase 114 non-regression + CLAUDE.md hard-rule compliance. `bash tests/test-115-persona-variants.sh` exits 0 with 7/7 PASS.
- `bash tests/test-114-substrate-preload.sh` continues to PASS (Phase 114 non-regression: skills array byte-identical, initialPrompt is non-empty string, settings.json no-skills, paths-scoping intact).

## Task Commits

Each task was committed atomically with --no-verify (parallel-wave protocol):

1. **Task 1: Edit frontmatter -- replace initialPrompt + add persona_variants 10-key map** -- `ecb8658` (feat)
2. **Task 2: Add ## Persona-Aware Turn 1 (Phase 115) section to body** -- `9523ba8` (feat)
3. **Task 3: Write tests/test-115-persona-variants.sh** -- `55fa743` (test)

**Plan metadata commit:** [pending -- appended after STATE/ROADMAP updates]

## Files Created/Modified

- `agents/larry-extended.md` (modified, +72 lines / -1 line):
  - Frontmatter: `initialPrompt:` value updated; `persona_variants:` 10-key map added (lines 11-22).
  - Body: `## Persona-Aware Turn 1 (Phase 115)` section appended (after the existing `For full voice style guide, see references/personality/voice-dna.md.` line); contains 7-step procedure, canonical role mapping table, dual-path detection subsection with 3 branches, "Why this exists" footnote.
  - Phase 114 baseline preserved byte-identical: name, description, model, color, skills array, all body content from Voice through "For full voice style guide..." line.
- `tests/test-115-persona-variants.sh` (created, 126 lines, executable):
  - 7-test bash suite using sibling-pattern (set -euo pipefail, pass/fail helpers, gray-matter via node -e).
  - Test 1: 10-key persona_variants map verified.
  - Test 2: triple byte-exactness chain (default == initialPrompt == lib/copy constant).
  - Test 3: 3 unique non-default strings (founder, researcher, investor).
  - Test 4: 6 keys aliased to default (Pitfall 7).
  - Test 5: agent body documents role_blend lookup + cold-start fallback + 115-02 artifact references.
  - Test 6: Phase 114 baseline preserved (name, model, color, skills array).
  - Test 7: no em-dashes in agents/larry-extended.md (CLAUDE.md hard rule).

## Decisions Made

- **10-entry persona_variants shape (not 9):** Per RESEARCH DISCRETION-02 resolution lines 152-161, the map carries `default` PLUS the 9 Canon Appendix C hirer types -- 10 entries total. The "9-key" framing in the plan refers to the 9 hirer types; the verify assertion locks the count at exactly 10 keys to capture the default.
- **Aliased keys carry literal string duplication, not YAML anchors:** YAML anchors (`&` / `*`) are technically equivalent but cause issues with downstream parsers (gray-matter handles them; some others don't). Literal duplication ensures uniform parse across all consumers. Cost is 6 duplicated strings; benefit is unambiguous parse semantics.
- **Pitfall 7 documentation in agent body:** The mapping table explicitly annotates `Researcher.IND` and `Founder.grant` as aliased-to-default in v1.13.0 with forward reference to Phase 100 / v1.14.0 role_blend schema extension. This makes the known limitation visible at the agent-instruction layer, not buried in research documents.
- **Dual-path detection branch documents BOTH CLI and MCP paths:** Per CLAUDE.md tri-polar design rule (CLI / Desktop / Cowork), the agent body spells out the CLI shell-out invocation AND the MCP tool name. The agent picks based on runtime surface; both paths are first-class.
- **Cold-start branch + reliability fence as explicit numbered steps:** Pitfall 2 (cold-start) is step 5 of the 7-step procedure; Pitfall 8 (reliability fence) is step 7. Numbered explicitness reduces probabilistic LLM drift on edge cases.

## Deviations from Plan

None -- plan executed exactly as written.

The plan's `<action>` blocks contained the verbatim file bodies for Task 1 (frontmatter replacement) and Task 2 (body section appendage) and Task 3 (full test suite body). All 3 changes were applied byte-exact to the plan specification, including:

- All 10 persona_variants strings byte-exact (verified via runtime gray-matter parse + 7/7 PASS test suite).
- All 3 unique non-default variants present (founder + researcher + investor) with Set-size assertion.
- All 6 aliased keys verbatim equal to persona_variants.default (loop-iteration assertion).
- initialPrompt byte-exact equals `lib/copy/115-spec-strings.cjs` `INITIAL_PROMPT_DEFAULT` (require-and-compare assertion).
- Phase 114 baseline (name, model, color, skills array, description) byte-identical (loop assertion + sibling test).
- No em-dashes anywhere in agents/larry-extended.md (verified via Python U+2014 + U+2013 count = 0; bash grep -nE assertion in test 7).
- No emoji (verified via reading the diff manually; no U+1F300-1F9FF range characters).

**Total deviations:** 0
**Impact on plan:** None. Plan fidelity is 100%.

## Issues Encountered

**Pre-execution rebase:** the worktree was branched from `origin/main` at `afcea5f` (v1.13.0-beta.1) before Phase 114 + 115-00 + 115-01 commits were merged to local `main`. The agents/larry-extended.md file in that worktree state had no `skills:` array and no `initialPrompt:` (Phase 114 hadn't applied yet). Rebased the worktree onto local `main` (HEAD `4052b79`) before starting Task 1; this picked up the Phase 114 baseline frontmatter, the 115-00 Wave 0 deliverables (lib/copy/115-spec-strings.cjs + tests/test-114-substrate-preload.sh), and the 115-01 commands/* + README.md + onboard.md surface rewrites.

Post-rebase, the worktree state matched the plan's `<read_first>` expectations exactly. No further deviations.

## Verification Results

### AC-115-04 verification (Plan 03 deliverable test)

```
PASS: Test 1: persona_variants has 10 keys (1 default + 9 Canon Appendix C hirer types)
PASS: Test 2: persona_variants.default == initialPrompt == lib/copy/115-spec-strings.cjs INITIAL_PROMPT_DEFAULT (byte-exact)
PASS: Test 3: founder + researcher + investor are 3 unique non-default strings (AC-115-04 minimum 3 satisfied)
PASS: Test 4: 6 keys (researcher_ind, founder_grant, operator, mentor, domain_expert, student) aliased to default
PASS: Test 5: agent body documents role_blend lookup + cold-start fallback + 115-02 artifact references
PASS: Test 6: Phase 114 baseline preserved (name, model, color, skills array)
PASS: Test 7: no em-dashes in agents/larry-extended.md

==== test-115-persona-variants.sh: 7/7 PASSED ====
```

### Phase 114 substrate-preload non-regression (load-bearing)

```
PASS: agents/larry-extended.md frontmatter has skills: [larry-personality, context-engine, room-passive, room-proactive] in canonical order
PASS: agents/larry-extended.md frontmatter has initialPrompt as non-empty string
PASS: settings.json no longer contains unsupported skills array; agent: larry-extended preserved
PASS: skills/room-passive/SKILL.md frontmatter has paths: array (defense-in-depth)
PASS: skills/room-proactive/SKILL.md frontmatter has paths: array (defense-in-depth)
NOTE: claude plugin validate failed or unsupported subcommand (CC version may not support validate subcommand; non-blocking).

==== AC-114-01 substrate preload: ALL CHECKS PASSED ====
```

The Phase 114 substrate-preload test continues to PASS after Plan 115-03 edits. skills array byte-identical (4 entries in canonical order); initialPrompt is still a non-empty string (just a different value); settings.json untouched; paths-scoping on room-passive + room-proactive intact. The `claude plugin validate --plugin-dir .` line emits an "unknown option" notice on this CC version; the test's NOTE clause handles this gracefully and the suite still exits 0.

### Frontmatter integrity check

```
persona_variants keys: 10
initialPrompt: "I'm Larry. What decision is stuck? (Tell me, or paste a doc/CV.)"
```

## Canon Part 8 Audit (NO LEAK confirmed)

| Code path | LOCAL data -> BRAIN? | Verdict |
|-----------|----------------------|---------|
| agents/larry-extended.md persona_variants frontmatter | Static plugin-distributed strings; NO user data; NO network call | NO LEAK |
| agents/larry-extended.md ## Persona-Aware Turn 1 body section | Plugin instructions only; describes LOCAL USER.md role_blend reading; describes LOCAL detector / parser invocation; describes LOCAL room.db setFocus + memory_event writes | NO LEAK |
| Agent body conditional render of persona variant | Variant string is plugin-distributed; selection key is enum scalar from role_blend (no substrings egress); no Brain query | NO LEAK |
| Dual-path detector + shallow-doc-parser branch (cross-references) | Already audited in 115-02 Canon Part 8 check -- NO LEAK | NO LEAK |
| tests/test-115-persona-variants.sh | Local fixture parse via gray-matter; no network; no Brain client | NO LEAK |

**Verdict:** PASSES Canon Part 8 conformance. Plan 115-03 introduces zero LOCAL -> BRAIN egress paths. Pre-existing brain-boundary-scan hook (Phase 87) passes without modification.

The persona-aware mechanism is structurally Canon-Part-8-safe: variant strings are plugin-distributed (NOT generated from user data); USER.md role_blend reading happens entirely locally; the only output is a variant_key enum scalar (founder | researcher | ... | default) emitted to Phase 121 telemetry per the documented schema. No matched user substrings reach Brain.

## File-Disjointness with 115-01 + 115-02 (Wave 1 parallel verification)

Per Wave 1 file-disjointness contract:

- 115-01 owns: commands/splash.md, commands/new-project.md, commands/onboard.md, README.md (4 surfaces). VERIFIED on disk: these files have 115-01 commits in `git log` (4052b79, 29ba994, 7f99743, 2cd8228), NOT touched by 115-03.
- 115-02 owns: lib/core/dual-path-detector.cjs, lib/core/shallow-doc-parser.cjs, bin/mindrian-mcp-server.cjs (and tests). NOT touched by 115-03.
- 115-03 owns: agents/larry-extended.md (1 surface), tests/test-115-persona-variants.sh (1 new file). VERIFIED via `git status --short` showing only these 2 files modified across the plan's 3 commits.

Zero file overlap confirmed. Wave 1 merge-resolution per planner's option-(a) is structurally safe.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Plan 115-03 is complete and Plan 115-04 (release orchestrator) is unblocked:

- 115-04 can run `bash tests/test-115-persona-variants.sh` as part of the v1.13.0-beta.2 promotion gate.
- 115-04 can run `bash tests/test-114-substrate-preload.sh` as the Phase 114 non-regression check (continues to PASS).
- Wave 1 file-disjointness verified; orchestrator's Wave 1 merge step has 3 file-disjoint executor branches to consolidate.
- The persona_variants 10-entry map structure is frozen; future phases (e.g., 115-04, 116, 118) write specific copy for the 6 currently-aliased keys without touching the mechanism.

No blockers identified.

## Self-Check: PASSED

**Files verified on disk (2/2):**
- FOUND: agents/larry-extended.md (modified)
- FOUND: tests/test-115-persona-variants.sh (created, executable)

**Commits verified in git log (3/3):**
- FOUND: ecb8658 (Task 1 -- feat: persona_variants frontmatter)
- FOUND: 9523ba8 (Task 2 -- feat: Persona-Aware Turn 1 body section)
- FOUND: 55fa743 (Task 3 -- test: 7-test verification suite)

**Verification suites:**
- 7/7 PASS on tests/test-115-persona-variants.sh (AC-115-04)
- 5/5 PASS on tests/test-114-substrate-preload.sh (Phase 114 non-regression)
- 0 em-dashes in agents/larry-extended.md (Python U+2014 count)
- 0 emoji in agents/larry-extended.md (manual diff review + range scan)

---
*Phase: 115-owned-emotion-dual-path-first-touch*
*Plan: 03*
*Wave: 1 (parallel with 115-01 + 115-02; file-disjoint by design)*
*Completed: 2026-05-05*
