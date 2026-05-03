---
phase: 106-statusline-visibility-context-window-broadcast
plan: 02
subsystem: statusline
tags: [d-02, context-monitor, broadcast, operator, jtbd, token-budget, glyph-fence, carve-out, canon-part-3, canon-part-8]

# Dependency graph
requires:
  - phase: 106-00
    provides: Wave 0 stub + canonical message pattern at tests/test-context-monitor-d02-broadcast.cjs and tests/test-statusline-glyph-isolation.cjs (replaced by this plan with real test bodies)
  - phase: 99
    provides: lib/conversation/operator.cjs getCurrent(roomDir) -- consumed by context-monitor operator-glyph push (read-only); JUST_TALK cold-start default observed (we don't broadcast it)
  - phase: 100
    provides: lib/hmi/jtbd-state.cjs getCurrent(roomDir) -- consumed by context-monitor jtbd-glyph push (read-only); null-when-absent contract observed
  - phase: 88.1
    provides: scripts/context-monitor 681-line statusline renderer + visual.ANSI palette + bridge file write at ~/.mindrian/bridge/{md5}.json (preserved byte-for-byte)
  - phase: 91-06
    provides: Larry decision-engine dial segment in context-monitor (operator + JTBD glyphs slot in immediately after dial, before plugin brand)
provides:
  - "scripts/context-monitor renders 📊 token-budget glyph on every ctx threshold branch (50/65/80 contract preserved)"
  - "scripts/context-monitor renders ⚙️ {operator} glyph when operator state file exists with current != JUST_TALK"
  - "scripts/context-monitor renders 🎯 {jtbd} glyph when JTBD state file has non-null current.jtbd"
  - "scripts/context-monitor replaces 💀 skull glyph at >=80% with literal '⚠ compaction-imminent' text in same blink-red ANSI envelope"
  - "tests/test-context-monitor-d02-broadcast.cjs (7 hermetic tests covering all render conditions + JUST_TALK suppression + null token + missing state files)"
  - "tests/test-statusline-glyph-isolation.cjs (production-source carve-out fence: 3 exclusive D-02 glyphs may appear ONLY in scripts/context-monitor; ⚠ sanity-checked present without exclusivity)"
  - "STATUS-106-02 marked Complete in REQUIREMENTS.md traceability"
affects:
  - "Plan 106-03 doctor class G (consumes the broadcast contract for invisibility detection)"
  - "Plan 106-04 D-04 fallback echo (composes the same operator + JTBD + ctx values into Larry's response footer when statusline cannot fire)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Try/catch lazy-require pattern for context-monitor optional state reads (matches lib/core/statusline-cache.cjs and lib/core/nav-dial.cjs precedents from Phases 88.1/91): missing module or corrupt state file blanks the segment but never throws"
    - "Raw-UTF-8 emoji codepoints in scripts/context-monitor (NOT \\u{...} JS escape sequences) so the carve-out regression fence and the doctor Class F scanner find the glyphs via String.includes() rather than escape-sequence matching"
    - "Auto-compact-aware test inputs: tests use input 60% (-> displayed 72% sienna) and 85% (-> displayed 100% warning) to exercise the actual ctx branches the AUTO_COMPACT_BUFFER math produces, instead of naive raw thresholds"
    - "EXCLUSIVE vs SHARED glyph split in the fence test: 📊 🎯 ⚙️ are exclusive (carve-out), ⚠ is shared (pre-existing in 10 production source files); fence sanity-checks both classes appear in scripts/context-monitor but only enforces exclusivity for the new ones"
    - "Hermetic test envelope: per-test mkdtempSync roomDir + legacy 'room/' marker + HOME override redirects bridge file writes into the tmp dir; matches Phase 95.1 D-05 fixture pattern"

key-files:
  created:
    - "(none -- two test files were created in Wave 0 as stubs and replaced here)"
  modified:
    - "scripts/context-monitor (3 insertion points: ctx restyle 4 branches @ ~497-509, operator glyph push @ ~636-648, JTBD glyph push @ ~650-661; readPluginVersion / bridge write / room resolver / MINTO segment / Larry dial segment all unchanged)"
    - "tests/test-context-monitor-d02-broadcast.cjs (Wave 0 stub -> 7 hermetic tests, 194 lines)"
    - "tests/test-statusline-glyph-isolation.cjs (Wave 0 stub -> 156-line carve-out fence)"

key-decisions:
  - "PRESERVE 50/65/80 threshold contract in ctx block (researcher locked per RESEARCH.md Open Question #4 -- CONTEXT.md's 50/80 was a regression that would have lost the early-warning sienna band)"
  - "PRESERVE auto-compact-buffer math at lines 489-493 (more sophisticated than CONTEXT.md sketches; do NOT simplify to raw used_percentage rendering)"
  - "Tests use displayed-percentage-aware inputs (input 60% -> displayed 72% sienna; input 85% -> displayed 100% warning) instead of naive raw values; alternative would have been to disable the buffer math under a test flag, which would have created a divergent code path"
  - "Use raw UTF-8 emoji codepoints in scripts/context-monitor (📊 🎯 ⚙️) instead of \\u{...} escape sequences; the existing convention in EXPLORATION_LABELS uses escapes, but the carve-out fence test does String.includes() matching which only finds raw codepoints; consistent with the carve-out's intent (glyphs are visible to the human reader of the source)"
  - "Glyph fence splits EXCLUSIVE (3 new) vs SHARED (⚠, pre-existing in 10 files); plan literally specified all 4 as exclusive, but ⚠ would have retroactively flagged valid pre-Phase-106 production code as a violation; pragmatic split honors the plan's intent (regression fence for new glyphs) without breaking existing valid code"
  - "Operator/JTBD glyph push placement: AFTER Larry decision-engine dial, BEFORE plugin brand -- left-to-right read order on the statusline becomes 'room state -> reasoning -> engine position -> active operator -> active JTBD -> plugin version' which is informationally densest at the left edge"
  - "JUST_TALK default is suppressed in operator glyph push (every cold-start room is JUST_TALK; surfacing the default is just noise); Test 6 fixes this contract"

patterns-established:
  - "Pattern: Phase 106-D02 lazy-require with try/catch fallback -- new code paths in context-monitor inherit the pre-88 invariant that any failure leaves the prior statusline output unchanged"
  - "Pattern: glyph carve-out fence test that distinguishes exclusive (introduced by this plan) from shared (pre-existing) glyphs -- future plans that introduce new exclusive glyphs to the statusline can extend the EXCLUSIVE_GLYPHS list while leaving SHARED_GLYPHS sanity-only"
  - "Pattern: Wave 0 stub canonical-message replacement -- swap the entire stub file body with the real test; the run-feynman-tests.cjs registry entry stays byte-stable"

requirements-completed:
  - STATUS-106-02

# Metrics
duration: ~25 minutes wall-clock for code edits + 2 Feynman suite runs (RED-baseline + GREEN-final)
completed: 2026-05-03
---

# Phase 106 Plan 02: D-02 Context-Window Broadcast Summary

**Three insertion points in scripts/context-monitor (ctx-block restyle, operator glyph push, JTBD glyph push) plus skull-to-warning-text replacement at the >=80% threshold; 7-test broadcast suite + 3-glyph carve-out fence land as real tests replacing Wave 0 stubs; zero new Feynman regressions (165/169 baseline preserved); STATUS-106-02 verifiably implemented.**

## Performance

- **Duration:** ~25 minutes active work (3 atomic commits + 1 RED-baseline Feynman + 1 GREEN-final Feynman)
- **Started:** 2026-05-03T05:55:00Z (approximate, derived from first commit timestamp)
- **Completed:** 2026-05-03T06:20:00Z
- **Tasks:** 3 (Task 1 implementation + Task 2 broadcast tests + Task 3 fence test); all acceptance criteria PASS
- **Files modified:** 3 (1 source file edit, 2 test file rewrites)
- **Commits:** 3 atomic commits (RED + GREEN + fence)

## Accomplishments

### Task 1 (GREEN): scripts/context-monitor wiring

Three insertion points in the 681-line statusline renderer:

1. **ctx block restyle (~lines 497-509).** Prepended raw `📊 ` to all four threshold branches (`used < 50` green / `used < 65` yellow / `used < 65 <= used < 80` sienna / `used >= 80` warning). The skull glyph `\u{1F480}` at >=80% replaced with literal text `⚠ compaction-imminent ` wrapped in the existing `\x1b[5;31m` blink-red ANSI envelope. The 50/65/80 thresholds are PRESERVED per the researcher's locked recommendation (CONTEXT.md's 50/80 would have lost the sienna early-warning band). The `AUTO_COMPACT_BUFFER` math at lines 489-493 is UNTOUCHED.

2. **Operator glyph push (~lines 636-648).** Lazy-required `lib/conversation/operator.cjs`. Read `getCurrent(roomDir)` and push `⚙️ {current}` only when `current != 'JUST_TALK'` (the cold-start default would be noise). Try/catch fallback: missing module or corrupt state file blanks the glyph but never throws. Placed AFTER the Larry decision-engine dial segment and BEFORE the plugin brand.

3. **JTBD glyph push (~lines 650-661).** Lazy-required `lib/hmi/jtbd-state.cjs`. Read `getCurrent(roomDir)` and push `🎯 {jtbd}` when the result is non-null with a non-empty `jtbd` field. Same try/catch fail-safe pattern. Placed immediately after the operator glyph.

The bridge file write (lines 474-486), `readPluginVersion` (lines 91-110), stdin parser (line 466), room resolution chain (lines 511-552), MINTO segment (line 615), and Larry dial segment (line 626) are ALL preserved byte-for-byte.

### Task 2 (RED -> GREEN): tests/test-context-monitor-d02-broadcast.cjs

7 hermetic tests that mkdtempSync a roomDir, optionally pre-stage `<room>/.mindrian/conversation-operator.json` and/or `<room>/.mindrian/jtbd-state.json`, spawn `node scripts/context-monitor` with stdin payload, then assert stdout substrings:

- Test 1: operator BUILD_ROOM + JTBD find-bottleneck + 25% input -> all three glyphs render, no warning
- Test 2: input 60% (-> displayed 72% sienna band) -> 📊 + percentage rendered, no warning
- Test 3: input 85% (-> displayed 100% warning band) -> 📊 + ⚠ compaction-imminent + blink-red ANSI, no skull
- Test 4: missing operator state file -> no ⚙️ glyph (graceful)
- Test 5: missing JTBD state file -> no 🎯 glyph (graceful)
- Test 6: operator current=JUST_TALK -> no ⚙️ glyph (default suppressed)
- Test 7: used_percentage null (before first API call) -> no 📊 glyph (existing `if (remaining != null)` short-circuit)

HOME override per-test redirects the bridge file write into the tmp dir for full hermeticity.

### Task 3 (fence): tests/test-statusline-glyph-isolation.cjs

Production-source walker (548 files scanned in this run) that asserts the 3 exclusive D-02 glyphs (📊 🎯 ⚙️) appear ONLY in `scripts/context-monitor`. Documentation surfaces (.md, *.html, tests/, test/, docs/, .planning/, .archive*, .deprecated-*) are skipped. The fence is a forever-on regression catch: any future plan that adds these glyphs to a non-carve-out source file will fail this test.

The fence also sanity-checks all 4 D-02 glyphs (incl. ⚠) appear at least once in `scripts/context-monitor` -- catches accidental glyph removal during refactor.

## Task Commits

Each task committed atomically with `--no-verify` (parallel-wave coordination per orchestrator instruction):

1. **Task 2 RED:** `f9e2ab7` -- `test(106-02): replace Wave 0 stub with real D-02 broadcast test (RED)` -- 7-test broadcast suite that fails on current scripts/context-monitor
2. **Task 1 GREEN:** `03dea1f` -- `feat(106-02): wire operator + JTBD + token-budget glyphs into context-monitor (GREEN)` -- 3 insertion points in scripts/context-monitor + Test 2/3 input fixup for auto-compact-aware math
3. **Task 3 fence:** `516956f` -- `test(106-02): replace Wave 0 stub with glyph-isolation carve-out fence` -- 156-line production-source walker

**Plan metadata commit:** pending -- this SUMMARY.md + STATE.md + ROADMAP.md plan-progress + REQUIREMENTS.md STATUS-106-02 flip will land in a single docs commit after self-check.

## Files Created/Modified

- `scripts/context-monitor` -- 3 insertion points modified; 4 raw-UTF-8 emoji codepoints introduced (📊 🎯 ⚙️ ⚠); skull glyph + skull-escape removed; bridge / readPluginVersion / room resolver / MINTO / dial all unchanged
- `tests/test-context-monitor-d02-broadcast.cjs` -- Wave 0 stub replaced with 7 hermetic tests (194 lines)
- `tests/test-statusline-glyph-isolation.cjs` -- Wave 0 stub replaced with 156-line carve-out fence

## Decisions Made

(See `key-decisions:` frontmatter for the full list.)

The most consequential decisions:

1. **50/65/80 thresholds preserved.** Plan and researcher both locked this. The CONTEXT.md draft proposed 50/80 (two-color); the existing context-monitor uses three (green/yellow/sienna/warning). Two-color would have lost the early-warning sienna band, which is exactly the visibility surface testers asked for. The plan's `<must_haves>` truth #5 made this an invariant.

2. **Auto-compact-buffer math preserved.** Lines 489-493 transform raw `used_percentage` via `usable = max(0, ((remaining-16.5)/(100-16.5))*100)` then `displayed = round(100 - usable)`. The plan explicitly said "MUST NOT be modified" and the test inputs were chosen to exercise the actual displayed branches (not the naive raw thresholds).

3. **Raw UTF-8 emoji vs \\u{...} escape.** The existing context-monitor convention uses `\\u{1F4CA}` etc. for emoji. The plan's Task 3 fence test does `content.includes('📊')` which only matches raw codepoints. To make the fence work as the plan intended (catch the new glyphs), the new D-02 glyphs land as raw UTF-8. The existing escape-form glyphs (e.g., `\\u{1F3AF}` for problem-definition's target) are unchanged -- they coexist with the new raw form for the same codepoint inside scripts/context-monitor.

4. **JUST_TALK default suppressed.** Every cold-start room defaults to JUST_TALK. Surfacing it as `⚙️ JUST_TALK` would be noise on every greeting. Plan's behavior contract truth #1 made this explicit. Test 6 is the regression fence.

## Deviations from Plan

### 1. [Rule 1 - Bug] Test 2 + Test 3 input values were inconsistent with the auto-compact-buffer math the plan explicitly preserved

**Found during:** Task 1 GREEN verification (running the broadcast tests after wiring).

**Issue:** The plan specified Test 2 input as `used_percentage: 75` with the assertion "75% renders sienna" (i.e., displayed 65 <= used < 80). But the AUTO_COMPACT_BUFFER math at scripts/context-monitor:489-493 transforms input 75% -> displayed 90% (warning band). The same math turns input 25% -> displayed 30% (Test 1 still passes, accidentally). And it pegs input 85% -> displayed 100% (Test 3 still passes correctly). Two of seven tests had inputs that didn't exercise the branch their assertions described.

**Fix:** Changed Test 2 input from `75` to `60` (-> displayed 72%, sienna band, no warning) and added a comment block explaining the math. Test 3 input stayed at `85` (-> displayed 100%, warning band) because that already lands in the right branch; only the comment was added. No assertions or branch logic changed. The fix is purely "make the test inputs reflect the math that the plan locked in."

**Files modified:** `tests/test-context-monitor-d02-broadcast.cjs` (Tests 2 + 3 only)

**Commit:** `03dea1f` (bundled with the GREEN feat commit; the test-input fix was discovered DURING the GREEN verification)

### 2. [Rule 1 / Rule 3 - Bug + Blocking] Glyph carve-out fence cannot retroactively forbid ⚠ (already in 10 production files)

**Found during:** Task 3 first run.

**Issue:** Plan Task 3 listed all four D-02 glyphs (📊 🎯 ⚙️ ⚠) as exclusive to scripts/context-monitor. But ⚠ (U+26A0 WARNING SIGN) is already used in 10 pre-Phase-106 production source files: lib/hmi/selector-dispatcher.cjs, lib/render/render-v2.cjs, scripts/doctor.cjs, scripts/session-start, scripts/jtbd-command.cjs, scripts/memory-command.cjs, scripts/operator-command.cjs, scripts/hmi-status-command.cjs, scripts/generate-section-intelligence.cjs, scripts/verify-release. Treating ⚠ as carve-out-exclusive would retroactively flag every one of those as a violation -- and the plan-as-written test would fail forever on existing valid code.

**Fix:** Split the fence's glyph list:
- `EXCLUSIVE_GLYPHS = ['📊', '🎯', '⚙️']` -- only in scripts/context-monitor (carve-out enforced)
- `SHARED_GLYPHS = ['⚠']` -- pre-existing, sanity-checked present in scripts/context-monitor without exclusivity

The sanity check at the end of the test still asserts all four glyphs appear in scripts/context-monitor (catches accidental removal during a future refactor). The split is documented in the test's header comment block AND in this SUMMARY's deviation log so future readers don't re-introduce the strict-fence assumption.

**Files modified:** `tests/test-statusline-glyph-isolation.cjs` (split + comment block)

**Commit:** `516956f` (the fence commit itself documents the split in its commit body)

### 3. [Rule 1 - Bug] Initial sanity check assertion was over-strict

**Found during:** Task 3 second run.

**Issue:** The fence test's "production directory walked" sanity check expected lib/, scripts/, commands/, agents/, skills/, hooks/, pipelines/, bin/ to all contribute scanned files. But commands/ and agents/ are markdown-only surfaces (skipped by the .md filter inside shouldSkipFile()). The check fired a false-positive "SKIP_DIRS over-broad" failure on commands/.

**Fix:** Trimmed the sanity check to CODE-bearing dirs only: lib/, scripts/, hooks/. Preserves the SKIP_DIRS over-broadening detection without false-positives on markdown-only directories.

**Files modified:** `tests/test-statusline-glyph-isolation.cjs`

**Commit:** `516956f` (bundled into the fence commit)

## Issues Encountered

- **Parallel-wave commit interleaving.** While 106-02 was running, parallel agents 106-01 and 106-03 were also committing to the same branch. Their commits (8892789, 1adf26b, 14074e3) appeared between mine. The git log shows the interleaved order. Self-check confirmed all three of MY commits (f9e2ab7, 03dea1f, 516956f) are present and reachable. No coordination issue; --no-verify avoided pre-commit hook contention as the orchestrator instructed.
- **Transient Feynman count mid-wave (163/169) vs final (165/169).** During parallel execution the Feynman runner picked up partially-replaced stubs from 106-01 and 106-03 in flight. The final 165/169 baseline matches Wave 0's recorded baseline exactly (same 4 inherited failures: test-self-update-platform, test/84-smart-notebook-copilot, lib/memory/post-compact-reinjection, lib/memory/decision-capture). Zero regressions introduced by 106-02.
- **dashboard/graph.json side-effect.** Same as Wave 0 -- a different test in the suite touches dashboard/graph.json as a build artifact. Discarded with `git checkout -- dashboard/graph.json` before the metadata commit. Wave 0 SUMMARY documents this is expected pre-existing test fixture behavior; not a regression.

## User Setup Required

None. All new code paths are LOCAL filesystem reads. No new dependencies, no new env vars, no new MCP surfaces, no Brain queries. Canon Part 8 invariant honored: zero remote egress added.

## Next Phase Readiness

**Ready for parallel-wave completion + Wave 2 dispatch:**

- Plan 106-03 (D-03 doctor class G) has already executed in parallel (commits 8892789, 1adf26b, 14074e3 visible on the branch). It can now consume the broadcast contract documented here.
- Plan 106-04 (D-04 fallback echo + D-06 surface detect) inherits the operator + JTBD + ctx values pattern from this plan -- when the statusline cannot fire (Desktop, Cowork, post-detect repair window), the same three values can be composed into Larry's response footer using the bridge file `~/.mindrian/bridge/{md5(roomDir).slice(0,8)}.json` already written by context-monitor:474-486.
- Plan 106-05 (D-05 onboarding + v1.12.5 release gate) has no dependency on this plan beyond REQUIREMENTS.md STATUS-106-02 being Complete.

**No blockers** for the rest of Phase 106.

---
*Phase: 106-statusline-visibility-context-window-broadcast*
*Completed: 2026-05-03*

## Self-Check: PASSED

All claims verified:
- `scripts/context-monitor` modified at the 3 insertion points; smoke test confirms baseline payload still emits ctx bar with `📊` glyph
- `tests/test-context-monitor-d02-broadcast.cjs` exists and exits 0 with all 7 PASS lines + "All 7 tests PASS"
- `tests/test-statusline-glyph-isolation.cjs` exists and exits 0 with "PASS: glyph isolation fence (4 glyphs, 1 allowed file, 548 files scanned)"
- Commits f9e2ab7, 03dea1f, 516956f all reachable from HEAD via `git log --oneline | grep`
- Full Feynman suite reports 165/169 = exact baseline match with Wave 0 (zero new failures)
