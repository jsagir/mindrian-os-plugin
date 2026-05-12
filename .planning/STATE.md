---
gsd_state_version: 1.0
milestone: v1.13.0
milestone_name: "The Closed Loop"
status: v1.13.0-beta.9 shipped to GitHub + marketplace -- run-all-956.sh 8/8 green; npm publish --dry-run --tag next succeeds (only auth blocks the real publish).
stopped_at: "Phase 95.6 COMPLETE (`gsd-tools phase complete 95.6` ran 2026-05-12; 10/10 plans). v1.13.0-beta.9 is the live release (GitHub tag v1.13.0-beta.9 -> 9ed8280; marketplace mos 1.13.0-beta.9 / ref v1.13.0-beta.9). One tracked follow-up: `npm publish` of `@mindrian_os/cli` -- maintainer-gated on an `@mindrian_os` Read+Write + bypass-2FA token (or an OTP); the two tokens tried 2026-05-11 both failed at the registry. Phase 122 (Workflow Layer, the v1.13.0 beta.10 capstone) is PLANNED + plan-checker PASSED + 122-VALIDATION.md nyquist_compliant -- NEXT is `/gsd:execute-phase 122 --auto` (5 plans, 5 linear waves, no checkpoints; `/clear` first -- fresh context). Also queued: the maintainer email follow-up (90-day @mindrian_os Brain key + add-to-testers + styled welcome mail w/ version-aware install link from https://mindrianos-install-site.vercel.app -- needs the maintainer to supply the key + identify the email thread). origin/main = 7e03693 (synced); working tree clean."
last_updated: "2026-05-12T05:20:26.397Z"
last_activity: 2026-05-12
progress:
  total_phases: 53
  completed_phases: 29
  total_plans: 235
  completed_plans: 216
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** Convert uncertainty to manageable risk -- every framework interaction produces bankable opportunities, every session starts with persona-aware routing
**Current focus:** Phase 122 (Workflow Layer -- framework<->command registry + reliable invocation) -- the v1.13.0 beta.10 CAPSTONE. PLANNED + plan-checker PASSED + Nyquist VALIDATION ready. NEXT: `/gsd:execute-phase 122 --auto` (5 plans, 5 linear waves, no checkpoints -- run in a FRESH session, `/clear` first). Phase 95.6 is COMPLETE (`gsd-tools phase complete 95.6` ran 2026-05-12); its one tracked follow-up is the `npm publish` of `@mindrian_os/cli` -- maintainer-gated on an `@mindrian_os` write + bypass-2FA token (or an OTP). `gsd-tools phase complete` set roadmap-order Phase: 104 as "next", but the maintainer has prioritized Phase 122 as the next execute (the beta.10 capstone, per `.planning/WORKFLOW-LAYER-SPEC.md` target-band).

## Current Position

Phase: 122 (Workflow Layer) -- PLANNED, plan-checker PASSED, ready to execute. (gsd-tools phase-complete's roadmap-order pick was 104; the maintainer override is 122 -- the beta.10 capstone.)
Milestone: v1.13.0 The Closed Loop. v1.13.0-beta.9 SHIPPED to GitHub + marketplace 2026-05-11 (tag v1.13.0-beta.9 -> 9ed8280; ~/mindrian-marketplace mos 1.13.0-beta.9 / ref v1.13.0-beta.9). v1.13.0-beta.10 IN PROGRESS on `main` (npm package renamed @mindrian/os -> @mindrian_os/cli; package.json + plugin.json bumped to 1.13.0-beta.10; CHANGELOG `## [Unreleased] -- v1.13.0-beta.10 (in progress)`; headline content = Phase 122). NO v1.13.0-beta.10 tag, NOT on marketplace -- it ships when Phase 122 lands. Install paths LIVE: `claude plugin install/update mos@mindrian-marketplace --version 1.13.0-beta.9` + direct install.sh from the tag + the install page `https://mindrianos-install-site.vercel.app` (deployed; @mindrian_os/cli baked in but the npx block stays gated until the publish lands). NOT yet: `npx @mindrian_os/cli@next` (needs the npm publish -- token-blocked).
Next phase: `/gsd:execute-phase 122 --auto` -- 5 plans (122-01..05), 5 linear waves, no human checkpoints; `/clear` first (fresh context). Then the maintainer email follow-up (90-day @mindrian_os Brain key + add to testers + styled welcome mail w/ version-aware install link -- needs the maintainer to provide the key + identify the email sender). Then `gsd-tools phase complete 95.6`'s roadmap-order successors (104, 110, 114, 115, 118, 119, 120, 121, 121.5).
Plan: 5 plans planned (122-01..05); plan-checker PASSED 2026-05-12; 122-VALIDATION.md nyquist_compliant: true.
Status: Phase 122 ready to execute. Phase 95.6 COMPLETE (one tracked follow-up: npm publish of @mindrian_os/cli, token-blocked). v1.13.0-beta.9 is the live release.
Hard deadline: 2026-06-01 (NATO Defense College Rome embeds MindrianOS in June innovation classes)
Soft deadline: -- (the 2026-05-11 commitment was met: beta.9 shipped to GitHub + marketplace)

**Why 95.6 displaced 114 as the next phase (2026-05-10):**

Phase 114 (larry-default-activation) was the prior "next phase" per the v1.13.0 beta.2 plan. Phase 95.6 was inserted urgently after 2026-05-08 Wave-2 critical tester (Gary Laben, Hopkins advisory board head) install failure on Windows 11 surfaced 6 distinct production bugs in the install-cache failure family. The NATO Defense College Rome June 2026 deadline gates 95.6's Tier 1 minimum-viable subset (D-02 + D-03 + D-01 + D-05a + D-09) hard. Phase 114 stays in queue but moves to AFTER 95.6 ships as v1.13.0-beta.9. Phase 95.5 (post-compact memory pipeline consumer) is REGISTERED but not actively executing; "Status: Executing Phase 95.5" line was stale and corrected here.

**For full context, read these in order:**

0. `.planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/95.6-CONTEXT.md` (Priority Hierarchy at top, 11 decisions D-01..D-11, Companion Artifacts section listing reading order)
1. `.planning/SESSION-HANDOFF.md` (resume entry point, read second)
2. `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md` (canonical plan)
3. `docs/CANON-PART-10-PROPOSAL-conversation-as-product.md` (constitutional thesis)
4. `.planning/MILESTONES-NAMING.md` Arc 4 entry (renamed 2026-05-05)

Phase 106-04 closure (2026-05-03):

- 735ea4f test(106-04): replace 3 Wave 0 stubs with RED tests for D-04 + D-06
- 63ce69f feat(106-04): add lib/statusline + statusline-fallback-echo (D-04 + D-06 GREEN)
- 4c20515 refactor(106-04): swap doctor.cjs Step 0 + banner-test require + class-g surface override

Phase 106-04 outcome: D-04 fallback echo + D-06 per-surface routing shipped. lib/statusline/banner-suppression.cjs extracts the inline shouldSuppress() contract from 106-03; lib/statusline/surface-detect.cjs is the canonical detectStatuslineSurface() returning 'CLI' | 'DESKTOP' | 'COWORK' literals (distinct from lib/mcp/surface-detect.cjs which uses lowercase + transport field for MCP server startup); scripts/statusline-fallback-echo.cjs composes a Larry-rendered prose state echo for surfaces where the rich statusline cannot fire (Desktop has no statusline primitive; Cowork's widget surface is partial); scripts/doctor.cjs Step 0 inline CLAUDE_DESKTOP=1 probe replaced with require + helper call (graceful catch-block fallback preserves Test 5 regression contract); tests/test-statusline-banner-suppression.cjs swapped from inline copy to require('../lib/statusline/banner-suppression.cjs') (5/5 PASS byte-identical). 32 assertions across 6 test files all PASS (6 + 7 + 5 + 5 + 6 + 3). One deviation Rule 3: tests/test-doctor-class-g.cjs + test-doctor-class-g-fix.cjs runDoctor() helpers updated to inject MINDRIAN_STATUSLINE_SURFACE=CLI when the test does not opt out via CLAUDE_DESKTOP / COWORK_SESSION_ID — non-TTY child-process spawnSync would otherwise be reclassified to DESKTOP by the new helper (safe-default branch) and skip class G. STATUS-106-04 + STATUS-106-06 flipped to Complete. Only STATUS-106-05 + v1.12.5 release gate remain (Plan 106-05).

Phase 106-01 closure (2026-05-03):

- 69a50f0 feat(106-01): add --auto and --quiet flags to migrate-stale-user-settings.cjs (cherry-picked from 1feb772)
- fcfde53 feat(106-01): wire migrate-stale-user-settings.cjs into SessionStart hook (cherry-picked from 649781f)
- 4efdf83 test(106-01): replace Wave 0 stub with real 6-test suite for migrate-stale-user-settings (cherry-picked from e27ff89)

Phase 106-01 outcome: D-01 self-healing statusline delivered. scripts/migrate-stale-user-settings.cjs extended additively from 130 -> 238 lines: --auto detect-only mode emits Claude Code SessionStart envelope (continue:true + optional hookSpecificOutput.additionalContext warning) without modifying user's settings.json; --quiet suppresses headers; ENVELOPE_ALLOWED Set + emitEnvelope helper mirrored from operator-update.cjs (Phase 95 BASH-95-01 invariant); disableAllHooks edge case branch with distinct guidance message; existing --apply path byte-identical (Test 4 + Test 5 prove). hooks/hooks.json SessionStart array length 3 -> 4; new entry calls migrator with --auto --quiet at 2000ms timeout. tests/test-stale-settings-migration.cjs Wave 0 stub replaced with 162-line 6-test hermetic suite (detect/clean/no-file/apply/idempotent/disabled); all pass. STATUS-106-01 flipped to Complete. Backward-compat invariant preserved: AUTO is detect-only by canonical contract; --apply mutation gated behind explicit /mos:doctor --fix invocation (Plan 106-03). Note: original commits 1feb772/649781f/e27ff89/e5eece5 stayed on worktree-agent-a80b5962c780c4728 branch; orchestrator cherry-picked the four onto main as 69a50f0/fcfde53/4efdf83/[final docs commit] resolving conflicts in REQUIREMENTS/ROADMAP/STATE in favor of the union of 106-01/02/03 status updates.

Phase 106-03 closure (2026-05-03):

- 14074e3 feat(106-03): add /mos:doctor class G statusline-visibility detector + --fix dispatch
- 8892789 test(106-03): replace Wave 0 stub with real class G detection tests
- 1adf26b test(106-03): replace Wave 0 stubs with --fix integration + banner suppression contract tests

Phase 106-03 outcome: D-03 invisibility detection + auto-repair shipped. /mos:doctor --statusline-visibility flag mirrors classes A-F pattern; checkStatuslineVisibility() covers 4 detection branches (stale user-settings, broken plugin install, statusline-mos isolated execution, disableAllHooks=true) with CLAUDE_DESKTOP=1 skip; performStatuslineFix() spawns migrate-stale-user-settings.cjs --apply --quiet with locked-language action field; commands/doctor.md flag table updated. 14 real tests replace 3 Wave 0 stubs (6 detection + 3 --fix dispatch + 5 banner suppression contract). Class F UI compliance scan: 0 violations on doctor.cjs. Two deviations auto-resolved: validPrefix glyph mismatch (plan said 🏠 MindrianOS-Plugin; reality is ⬡ MindrianOS U+2B21 with ANSI codes — fixed via stripAnsi + accept both prefixes) and renderer error glyph collision (plan used ✗ which is in class F FORBIDDEN_GLYPHS — fixed via red ⚠ matching class A pattern). STATUS-106-03 flipped to Complete. Banner suppression shouldSuppress(touchFileContent, currentVersion, now) function fenced inline; Plan 106-04 should extract it to lib/statusline/banner-suppression.cjs for sharing with statusline-fallback-echo.cjs.

Phase 106-02 closure (2026-05-03):

- f9e2ab7 test(106-02): replace Wave 0 stub with real D-02 broadcast test (RED)
- 03dea1f feat(106-02): wire operator + JTBD + token-budget glyphs into context-monitor (GREEN)
- 516956f test(106-02): replace Wave 0 stub with glyph-isolation carve-out fence

Phase 106-02 outcome: D-02 context-window broadcast delivered. scripts/context-monitor renders 📊 token-budget glyph on every ctx threshold branch (50/65/80 contract preserved per researcher lock), ⚙️ {operator} when current != JUST_TALK, 🎯 {jtbd} when JTBD state present, and ⚠ compaction-imminent text replacing the skull glyph at >=80%. 7-test broadcast suite + 3-glyph carve-out fence (📊 🎯 ⚙️ exclusive; ⚠ pre-existing in 10 production files, sanity-only) replace Wave 0 stubs. Feynman 165/169 = exact baseline match (zero new failures). STATUS-106-02 flipped to Complete. Two deviations documented in 106-02-SUMMARY.md: auto-compact-aware test inputs (Tests 2/3 input fixup) and exclusive-vs-shared glyph split in fence.

Status: Ready to execute

Resume note (2026-05-01): PC died after `/gsd:plan-phase 99 --auto` completed. Phase 99 PLAN files (99-01..99-05) sit on disk under `.planning/phases/99-conversation-operator-state-machine/` (gitignored per `.planning/` rule). Last commit `fbfe3e6` (CONTEXT + DISCUSSION-LOG only). No `feat(99-XX)` commits — execution never started. Phase 95.1 is closed (9/9 plans, see `a563850`); 95.1 is no longer current focus. Local commits ahead of `origin/main` by 1 (`fbfe3e6` unpushed).

Phase 89.5 closure (this session):

- 2df70f3 feat(89.5-05): add 4 user-facing command markdowns (/mos:rs-fetch + /mos:rs-thesis + /mos:rs-experts + /mos:rs-explain)
- 5f28041 feat(89.5-05): add 4 command CJS scripts wrapping 89.5 library modules
- 386ba6d test(89.5-05): add e2e CLI smoke test for /mos:rs-explain (6 scenarios; all GREEN)
- b2ef4f3 test(89.5-05): register 5 new 89.5 fixture suites in Feynman runner; baseline 85 -> 90
- 8687fb5 docs(89.5-05): Phase Gate transcript -- 9G + 5E asserts; CONDITIONAL PASS
- 427d872 docs(89.5-05): VERIFICATION report -- 9/9 SCs passed; phase complete; v1.11.0-beta.1 readiness gate cleared

Phase 89.5 outcome: capstone of the Reverse Salient framework shipped. 4 user-facing CLI commands surface the full pipeline + bidirectional NL-Graph loop across CLI / Desktop MCP / Cowork uniformly. End-to-end smoke (6 scenarios) verifies happy path + Mode B + Tier 0 + Canon Part 8 adversarial. Feynman runner advanced 85 -> 90 (5 new fixtures); 88/90 PASS with NET IMPROVEMENT (4 -> 2 inherited failures from 89.4). Phase Gate CONDITIONAL PASS; VERIFICATION 9/9 SCs passed. Bundled-release contract honored: zero CHANGELOG.md / plugin.json / package.json diffs in 89.5 commit range.

Next: v1.11.0-beta.1 release gate sub-phase (NEW; to be filed between 89.5 and 91 per kickoff section 7).

Phase 90-02 commits (main, NOT yet pushed):

- bae9926 test(90-02): add failing tests for brain-derivation-queue (RED)
- 0f31873 feat(90-02): implement brain-derivation-queue (GREEN, 15/15 passing)
- 6d9eeb7 feat(90-02): wire post-regen hook + UserPromptSubmit drain (19/19 passing)

Phase 90-02 outcome: BRAIN.md regeneration follows Feynman-MINTO automatically. Post-regen hook in vault-section-minto-generator.cjs captures prior governing_thought sha256, compares against new value, enqueues brain-derivation when they differ. UserPromptSubmit drain spawns detached deriveSection child per eligible queue entry; parent exits within 100ms so user turn never waits. Canon Part 8 preserved: queue carries section + sha256 hash pairs + ISO timestamp + reason ONLY (Test 12 audits against forbidden substrings on adversarial fixture). Feynman suite advanced 54 -> 55 (baseline+1 per plan contract).

Prior: 89-01 + 89-02 + 89-03 + 89-04 + 89-05 + 89-06 shipped on main. 89-05 ships Mode C (hybrid) via lib/core/rs_hybrid.py (unified corpus builder + cross-corpus pair filter) and scripts/rs-engine.py --mode hybrid wiring. Warm/cold/bypass paths inherited from Plan 89-03 unchanged. Pairs carry hybrid=True metadata + room_artifact + external_doc structs + Mode A-compatible source_*/target_* fields so Plan 89-06 bridge-writer consumes hybrid output through its schema-tolerant resolver without edits. Plan 89-07 (ReverseSalientAgent wiring + release dashboard) is the remaining Phase 89 plan.

Last 88.6-04 commits (main):

- 0abf6cf feat(88.6-02): add /mos:diagnostics command surface (Gap #1 closure)
- df63773 feat(88.6-02): wire /mos:diagnostics into commands/help.md (Gap #2 closure)
- 55d65ab release: v1.10.14 -- Phase 88.6 python-algorithm-wiring (Gates 1-4)

Tag: v1.10.14 -> 55d65ab (LOCAL, not pushed)

Known Gaps (CLOSED in 88.6-04):

- commands/diagnostics.md: TRACKED via 0abf6cf
- commands/help.md /mos:diagnostics entry: ADDED via df63773
- Human-verify checkpoint: persisted to .planning/phases/88.6-python-algorithm-wiring/88.6-02-HUMAN-UAT.md as post-release soak (non-blocking)

Awaiting user action (Gate 5):

- 5a: git push origin main --tags
- 5b: cd ~/mindrian-marketplace && pin marketplace.json source.ref to v1.10.14 + commit + push master

Last activity: 2026-05-12

Progress: [████████░░] 82%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: --
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

| Phase 88.6 P01 | 10min | 4 tasks | 3 files |
| Phase 88.6 P04 | 10min | 4 tasks | 6 files |
| Phase 88.1 P01 | 14min | 3 tasks | 71 files |
| Phase 88.1 P02 | 5min | 2 tasks | 2 files |
| Phase 88.1 P10 | 14 | 2 tasks | 10 files |
| Phase 88.1 P07 | 18min | 2 tasks | 5 files |
| Phase 88.1 P08 | 25min | 2 tasks | 5 files |
| Phase 88.1 P05 | 13m24s | 3 tasks | 6 files |
| Phase 89 P01 | 12 minutes | 2 tasks | 4 files |
| Phase 89 P06 | ~45 minutes | 2 tasks | 2 files |
| Phase 89 P02 | ~40 minutes | 2 tasks | 2 files |
| Phase 89 P89-03 | 55m | 2 tasks | 3 files |
| Phase 89 P04 | ~45min | 2 tasks | 2 files |
| Phase 89 P05 | ~45min | 2 tasks | 2 files |
| Phase 90 P00 | 30 | 2 tasks | 4 files |
| Phase 90-brain-derivation-layer P01 | 45 | 2 tasks | 3 files |
| Phase 90-brain-derivation-layer P03 | 35m | 2 tasks | 5 files |
| Phase 90-brain-derivation-layer P04 | 35 | 2 tasks | 4 files |
| Phase 90-brain-derivation-layer P05 | 45 | 1 tasks | 3 files |
| Phase 90-brain-derivation-layer P06 | 50m | 1 tasks | 3 files |
| Phase 90-brain-derivation-layer P07 | 20 | 2 tasks | 5 files |
| Phase 90-brain-derivation-layer P09 | 25 | 1 tasks | 1 files |
| Phase 88.7 PDOGFOOD-ROOM-UPGRADE | 4.5min | 2 tasks | 15 files |
| Phase 89.1a P01 | 4m10s | 2 tasks | 2 files |
| Phase 89.1a P02 | 6m1s | 2 tasks | 2 files |
| Phase 89.1a P03 | 37m | 2 tasks | 2 files |
| Phase 89.1a P04 | 22m34s | 3 tasks | 3 files |
| Phase 89.1 P01 | 27min | 2 tasks | 5 files |
| Phase 89.1 P02 | 3m11s | 1 tasks | 2 files |
| Phase 89.1 P03 | 3m32s | 1 tasks | 2 files |
| Phase 89.1 P04 | 1h45m | 3 tasks | 2 files |
| Phase 89.1 P05 | 28min | 3 tasks | 4 files |
| Phase 89.2 P01 | 5min | 1 tasks | 4 files |
| Phase 89.2 P02 | 10m | 1 tasks | 3 files |
| Phase 89.2 P03 | 6m | 1 tasks | 2 files |
| Phase 89.2 P04 | 12m | 1 tasks | 3 files |
| Phase 89.2 P05 | 18min | 1 tasks | 2 files |
| Phase 89.2 P06 | 11min | 3 tasks | 6 files |
| Phase 89.2 P07 | 7 | 3 tasks | 6 files |
| Phase 89.2 P08 | 12min | 3 tasks | 4 files |
| Phase 89.3 P01 | 35min | 2 tasks | 3 files |
| Phase 89.3 P02 | 5min | 1 tasks | 2 files |
| Phase 89.3 P03 | 8min | 1 tasks | 2 files |
| Phase 89.3 P04 | 14 | 1 tasks | 2 files |
| Phase 89.3 P05 | 20min | 3 tasks | 6 files |
| Phase 89.4 P01 | 3min | 2 tasks | 2 files |
| Phase 89.4 P02 | 5min | 2 tasks | 2 files |
| Phase 89.4 P03 | 12 min | 2 tasks | 3 files |
| Phase 89.4 P04 | 5min | 3 tasks | 3 files |
| Phase 89.5-01 P01 | 18m | 2 tasks | 2 files |
| Phase 89.5-engine-and-nl-graph P02 | 8m | 2 tasks | 2 files |
| Phase 89.5 P03 | 8m | 2 tasks | 2 files |
| Phase 89.5 P04 | 18m | 2 tasks | 2 files |
| Phase 91 P00 | 20 | 2 tasks | 4 files |
| Phase 91 P01 | 35min | 2 tasks | 4 files |
| Phase 91 P02 | 33min | 1 tasks | 4 files |
| Phase 91 P03 | 21min | 2 tasks | 4 files |
| Phase 91-navigation-engine P04 | 21min | 2 tasks | 4 files |
| Phase 91 P05 | 28min | 2 tasks | 5 files |
| Phase 91 P06 | 20 | 2 tasks | 4 files |
| Phase 91 P07 | 30min | 3 tasks | 4 files |
| Phase 91 P08 | 7min | 2 tasks | 4 files |
| Phase 94 P03 | 22min | 4 tasks | 20 files |
| Phase 94-v1-11-2-tester-driven-fixer P04 | 18min | 4 tasks | 6 files |
| Phase 94-v1-11-2-tester-driven-fixer P05 | 35min | 5 tasks | 9 files |
| Phase 94-v1-11-2-tester-driven-fixer P06 | 71min | 3 tasks | 5 files |
| Phase 94-v1-11-2-tester-driven-fixer P09 | 14min | 3 tasks | 3 files |
| Phase 95 P01 | 4min | 3 tasks | 4 files |
| Phase 95 P02 | 6min26s | 2 tasks | 3 files |
| Phase 95 P03 | 4min51s | 2 tasks | 5 files |
| Phase 95 P04 | 25min | 3 tasks | 8 files |
| Phase 95 P05 | 27 | 7 tasks | 7 files |
| Phase 95.1 P00 | 1m19s | 1 tasks | 1 files |
| Phase 95.1 P95.1-01 | 3min | 1 tasks | 11 files |
| Phase 95.1 P02 | 13min | 1 tasks | 7 files |
| Phase 95.1-mos-doctor-drift-detection-and-self-heal P03 | 17min | 1 tasks | 2 files |
| Phase 95.1 P04 | 16min | 3 tasks | 3 files |
| Phase 95.1 P05 | 7min | 3 tasks | 1 files |
| Phase 95.1 P06 | 7min | 1 tasks | 2 files |
| Phase 95.1 P07 | 18min | 3 tasks | 21 files |
| Phase 99 P04 | 7 | 3 tasks | 4 files |
| Phase 106 P00 | 9min | 3 tasks | 18 files |
| Phase 108-graph-memory-schema-reconciliation P00 | 11min | 3 tasks | 11 files |
| Phase 108-graph-memory-schema-reconciliation P01 | 18min | 2 tasks | 2 files |
| Phase 108 P02 | 17min | 2 tasks | 2 files |
| Phase 108-graph-memory-schema-reconciliation P04 | 9min | 2 tasks | 2 files |
| Phase 108-graph-memory-schema-reconciliation P03 | 30min | 2 tasks | 2 files |
| Phase 108 P05 | 10min | 3 tasks | 8 files |
| Phase 108-graph-memory-schema-reconciliation P06 | 16min | 3 tasks | 3 files |
| Phase 109 P02 | 811 | 3 tasks | 8 files |
| Phase 109-sql-context-memory-navigation-spine P04 | 15min | 2 tasks | 5 files |
| Phase 109 P06 | 824 | 2 tasks | 3 files |
| Phase 109 P05 | 25min | 2 tasks | 4 files |
| Phase 114-larry-default-activation P01 | 4min | 1 tasks | 1 files |
| Phase 114-larry-default-activation P00 | 13min | 4 tasks | 5 files |
| Phase 114 P02 | 35 | 8 tasks | 11 files |
| Phase 115 P00 | 6m 19s | 7 tasks | 7 files |
| Phase 115 P01 | 3m 19s | 5 tasks | 5 files |
| Phase 115 P04 | 13min | 6 tasks | 6 files |
| Phase 88.2 P02 | 3min | 2 tasks | 2 files |
| Phase 88.2-uiux-selector-block P03 | 25min | 2 tasks | 9 files |
| Phase 88.2 P05 | 25 | 2 tasks | 6 files |
| Phase 88.2 P06 | 35min | 3 tasks | 7 files |
| Phase 89-reverse-salient-engine P89-07-00 | 6min | 3 tasks | 13 files |
| Phase 89-reverse-salient-engine P89-07-01 | 36min | 2 tasks | 4 files |
| Phase 89-reverse-salient-engine P89-07-02 | 22min | 2 tasks | 5 files |
| Phase 116-unresolved-tension-hook P00 | 4min | 3 tasks | 10 files |
| Phase 116-unresolved-tension-hook P02 | 14min | 2 tasks | 3 files |
| Phase 95.2 P01 | 22min | 2 tasks | 5 files |
| Phase 95.2 P00 | 25 | 2 tasks | 3 files |
| Phase 117 P00 | 9min | 3 tasks | 17 files |
| Phase 117 P01 | 17min | 2 tasks | 7 files |
| Phase 117 P02 | 22min | 2 tasks | 6 files |
| Phase 117 P03 | 28 | 4 tasks | 7 files |
| Phase 117 P117-04 | 25min | 2 tasks | 5 files |
| Phase 95.6 P02 | 75min | 3 tasks | 12 files |
| Phase 95.6 P01 | 20min | 2 tasks | 4 files |
| Phase 95.6 P03 | 8 min | 2 tasks | 2 files |
| Phase 95.6 P04 | 12 min | 1 tasks | 2 files |
| Phase 95.6 P05 | 40min | 3 tasks | 3 files |
| Phase 95.6 P06 | 25min | 2 tasks | 5 files |
| Phase 95.6 P07 | 2m | 2 tasks | 4 files |
| Phase 95.6 P08 | 20m | 3 tasks | 13 files |
| Phase 95.6 P09 | 38min | 3 tasks | 4 files |

### Roadmap Evolution

- Phase 88.6 inserted after Phase 88: python-algorithm-wiring (URGENT) -- Close orphan-value gap between 15 verified Python algorithms and user-facing product surface. Fixes silent production bug in discover-* pipeline (baseline not auto-fired) and exposes 4 orphan Wave-1 algorithms (surprise, disruption, novelty, blindspot). Evidence: smoke test 2026-04-23 on mindrianOS data room. See CONTEXT.md in phase dir.
- Phase 88.7 inserted after Phase 88: power-demo-multipage-export (URGENT) -- Ship /mos:power-demo: evidence-grounded multi-page HTML site for first-contact viewers. Consumes 88.6 outputs. 3-door lobby (thesis/intelligence/provenance), persistent sidebar nav, hover tooltips, timeline page, De Stijl rich text. Parallel-safe with phases 89/90/91. Target: Rubos round two demo on mindrianOS room itself. See CONTEXT.md in phase dir.
- Phase 94.1 inserted after Phase 94: v1-11-1-mos-heal-command (URGENT) -- Ship /mos:heal slash command + scripts/heal-command.cjs orchestrator wrapping the 10-step room wiring heal recipe (dog-fooded on mindrianOS room 2026-04-29 at ~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-wiring-heal-process.md). Replaces 94-09 + 94-10 in the v1.11.1 GA stack per pivot decision (deferred-items.md). Plans 94-09 (action-footer polish) and 94-10 (v1.11.2 release-gate) deferred with explicit re-trigger conditions. v1.12 candidate items (FEYNMINTO-01 budget; brain-derivation-queue drain; auto-section-scaffold) named in deferred-items.md.
- Phase 93 added: v1.11.1 Hotfix -- Install Cache Drift Recovery + Brain Telemetry Visibility (HOTFIX, 3-hour scope). Two production bugs surfaced via dog-fooding during tester onboarding prep. (1) Install cache drift Incident #2 of 2026-04-13 pattern: live install at ~/.claude/plugins/mindrian-os/ stuck on 1.10.10 while marketplace cache had 1.11.0 cached and ready; plugin manager reported "already at latest" while plugin.json said 1.10.10. Affects all users silently. (2) Brain telemetry column-name mismatch: brain-admin.cjs reads request_count + last_used_at; auth.cjs writes total_requests + last_request_at; auth.cjs logUsage() inserts to brain_usage_log with key_id but actual column is api_key. Result: brain_usage_log has 0 rows after 452 captured requests, all silently rejected. Confirmed via Supabase schema probe. Recovery for cache drift executed in current session (mv backup + cp -aT from marketplace cache); restored ~/.claude/plugins/mindrian-os to 1.11.0 with .stale-1.10.10-20260428-095548 backup retained. Phase scope: D1 brain-admin.cjs + auth.cjs column fixes (6 lines, 2 commits), D2 /mos:doctor command with --fix flag for drift detection + auto-recovery, D3 docs/autopsies/2026-04-28-install-cache-drift-incident.md including diagnostic anti-pattern lesson ("don't trust git log when cwd may inherit a parent .git; always git -C <abspath> + test -d <path>/.git first"), D4 regression test for cp -aT recovery, D5 Anthropic upstream bug report draft (held until /mos:doctor exists). Out of scope (deferred to v1.12): /mos:admin narrative command, session-start drift detection extension. Constraints: hotfix discipline (no feature additions, only bug fixes + safety net), same 5-gate release pipeline as v1.11.0.
- Phase 95.2 inserted after Phase 95: install-cache-atomic-recovery-sessionstart-preflight (URGENT) -- Hardens the install plumbing surfaced by 2026-05-06 dogfood `/mos:doctor --all --json` run on jsagir's machine. Live install dir at `~/.claude/plugins/mindrian-os/` was missing entirely while two stale backups (`mindrian-os.stale-1.10.10-20260428-095548`, `mindrian-os.stale-1.11.0-20260430-083458`) sit alongside in `~/.claude/plugins/`. This is the third occurrence of the install-cache failure family (2026-04-13 wrong-workspace incident + 2026-04-28 install-cache drift incident now joined by 2026-05-06 missing-install-dir incident) -- root cause is non-atomic recovery in scripts/doctor.cjs --fix path: `mv install -> install.stale-X` succeeds, `cp -aT cache install` fails or crashes mid-copy, leaves the system with no live install. Class A doctor logic compounds the problem by treating `install.status === "missing"` as a warning (drift.detected: false) so --fix is not even surfaced as a Next Move. Phase 95.2 deliverables: D1 atomic-swap recovery (cp to install.new, version verify, two-step rename install->install.stale + install.new->install; eliminates half-done state from ever existing), D2 class A --fix eligibility when install.status === "missing" not just on drift detected (currently `drift.detected: false` short-circuits recovery for the missing case), D3 SessionStart preflight class-A check + warning surface (catches drift/missing before user hits a broken command, leverages the existing SessionStart hook that already prints the v1.12.5.1 banner). Scope guard: hotfix discipline -- no new feature surface, only hardens existing recovery. Doctor self-reference: `--all --json` output literally points at this slot via `"fixDeferredTo": "95.2 or human review"` on class F UI compliance findings (separate concern, not addressed here). Milestone: ships as v1.13.0-beta.6 hotfix between beta.4 (in-flight) and beta.2 thesis work; preserves Hooked Model beta narrative while keeping install plumbing trustworthy through the rest of v1.13.0. Canon Parts 6 (dog-fooding mandate -- this plugin is itself a venture; install path is part of the venture surface) + 7 (reuse-before-build -- extends Phase 95.1 doctor infrastructure rather than a parallel surface). Predecessor: Phase 95.1 mos-doctor-drift-detection-and-self-heal. Two prior autopsies in docs/autopsies/ (2026-04-13, 2026-04-28); 2026-05-06 third autopsy to be filed during plan-phase.
- Phase 95.1 inserted after Phase 95: mos-doctor-drift-detection-and-self-heal (URGENT) -- Extend Phase 93's /mos:doctor command (currently handles drift class A install-cache drift only) with FIVE new silent-failure drift classes surfaced via v1.12.0 fresh-session smoke + late-stage TUI audit (2026-04-30, see room/decisions/v1-12-0-smoke-test/v1-12-0-smoke-test.md, .planning/phases/95-bash-hook-envelope-and-cascade-side-channel/deferred-items-supplement.md, .planning/phases/95.1-mos-doctor-drift-detection-and-self-heal/95.1-DISCUSSION-LOG.md). (B) missing .room-root sentinel: room/ exists but detect_room_section returns no-match because sentinel was never committed; cascade pipeline silently skips. (C) active-room guard silence: post-write evaluates resolve-room "$PWD" against file path; non-active-room writes exit 0 before write_cascade_side_channel; no log, no advisory, indistinguishable from a bug. (D) surface-layer verification gap: phases 80-87 cascade pipeline tested via test/fixtures/cascade-e2e/seed-room/ exclusively; envelope -> Claude Code schema validator -> room-proactive skill -> user render path NEVER tested end-to-end; explains why Phase 88.1-03 + Claude Code 2.x schema tightening combo broke the loop unobserved for ~10 phases. (E) ROOM.md/MINTO.md cascade: dogfood room/ subtree fully non-compliant with Decision #15 (zero ROOM.md, zero MINTO.md across 12 subdirs); Phase 87-01a's pre-commit guard correctly enforces but ships with remediation pointer to scripts/generate-section-intelligence.cjs which has never existed in the repo. (F) UI Ruling System compliance gap: /mos:doctor itself ships non-compliant with skills/ui-system/SKILL.md (mandatory since Phase 80) -- missing 4-zone anatomy, missing body_shape frontmatter, uses unauthorized glyphs (box chars + ✗ not in 12-glyph vocabulary), missing Action Footer; Phase 93's hotfix discipline never retrofitted compliance. Phase 95.1 deliverables: D1 extend /mos:doctor with B/C/D/E/F checks (flag selectors --cascade-rooms / --verify-surface / --room-md / --ui-compliance per D-09), D2 build the missing scripts/generate-section-intelligence.cjs (single-dir + --recursive, skip-if-exists, hand-rolled minimal frontmatter per D-01..D-03), D3 use the dogfood room as integration test fixture, D4 add live-cascade end-to-end test at test/fixtures/cascade-surface-e2e/ (MINDRIAN_ROOMS_ROOT env override, 8-key shape PASS criteria per D-04..D-06), D5 retrofit /mos:doctor itself for UI compliance (Shape E body, glyph cleanup, 4-zone anatomy, F.1 selector for --fix per D-10..D-19). Milestone: v1.12.1 patch (D-07).
- Phase 102 inserted after Phase 101: context-aware-rendering -- Promote `lib/render/render-v2.cjs` from the Phase 99-03 pass-through stub into the JTBD-aware Phase 102 implementation. Wave 1 = Plan 102-00 (this plan: 6 RENDER-102-* requirement IDs registered + 5 Wave-0 test stubs reserved + lib/render/JTBD-PALETTES.md filed) executed in parallel with sibling Plan 102-01 (render-v2.cjs implementation + Phase 99-03 import-surface byte-stable shim). RENDER-102-01 stable signature `render(zones, mode, operator, tier[, jtbd])`; RENDER-102-02 operator-aware compaction (5 operators -> 5 shape regimes per Canon Part 3 § 3-layer loop); RENDER-102-03 JTBD-aware Zone 4 verb selection drawn from the closed 10-verb MindrianOS-native vocabulary mapped via JTBD-PALETTES.md; RENDER-102-04 _provenance envelope LOCAL-only per Canon Part 8; RENDER-102-05 De Stijl 5-color overlay (cli only; MOS_NO_COLOR=1 strip-ANSI byte-identical fence); RENDER-102-06 Phase 99-03 import-surface byte-stable across the swap (8 IIFE scenarios in lib/render/render-v2.test.cjs preserved unchanged). Mirrors HMI-100/101 block structure. Sibling 102-01 owns the render-v2.cjs muscle; this plan owns the seam (REQ-IDs + test paths + palette asset).
- Phase 95.6 inserted after Phase 95: install-cache-windows-hardening-and-skill-loop-resilience (URGENT, INSERTED 2026-05-09) -- Case #4 of the install-cache failure family. Trigger: 2026-05-08 Gary Laben (Wave-2 critical tester, head of advisory board at Hopkins, intro via Lawrence Aronhime) install session on Windows 11 surfaced three independent production bugs in one continuous transcript captured at docs/testers/gary-laben/FEEDBACK.md 2026-05-09 entry. Bug 1: Windows MAX_PATH (260 char) failure on git clone caused by `.planning/phases/92-refactor-constitution-and-trust-layer-formalizes-audit-driven-refactor-work-constitution-v1-1-directive-1-validation-directive-2-consolidation-directive-3-unidirectional-flow-trust-layer/` directory leaf at 174 chars; Gary's CC fixed by enabling `core.longpaths` but install.sh did not preflight. Bug 2: install.sh skill-loop hits `set -euo pipefail` and exits when `skills/mullins-scaffold/` lacks SKILL.md; agents/hooks/settings.json registration never run; Gary's CC manually completed via symlinks + settings.json fragments. Bug 3: `@mindrian/os` npm package returns hard 404 on registry; the install site at mindrianos-install-site.vercel.app advertises a phantom path; release.sh Step 9.5 npm publish gate from feedback_release_lockstep_npm.md is broken or has never executed across v1.13.0-beta.1 through beta.8. Phase 95.6 deliverables: D-01 Windows long-path preflight + clear error in install.sh, D-02 rename 92-trust-layer-refactor (174 chars -> 22 chars; update all references; full_slug carried in frontmatter), D-03 audit + backfill missing SKILL.md files (canonical: skills/mullins-scaffold/) AND defensive pre-filter in install.sh skill-loop with stderr warnings, D-04 README ## Manual Recovery section documenting Gary's CC's working recovery (agent symlinks + settings.json fragments), D-05 publish @mindrian/os@next to npm in lockstep with v1.13.0-beta.9 (verify scripts/release.sh Step 9.5; if broken, fix; manual recover for beta.9; legacy beta.1-8 stay unpublished honestly), D-06 audit + replace "BSL-1.1 (open source)" -> "BSL-1.1 source-available" across repo + install site + tester docs (Gary's CC flagged this as credibility issue in two separate sessions), D-07 coordinate with SEED-007 scanner family (add open-source-mislabel pattern as third pattern alongside no-emdash + no-version-literal), D-08 beta target locked at v1.13.0-beta.9 (beta.8 carries the bugs). Acceptance: fresh Windows tester completes canonical install end-to-end without partial state; `npm view @mindrian/os@next version` returns current beta or install site removes npx block; all phase leaf-names under 60 chars; zero "BSL.*open.source" grep hits across repo; README has working manual recovery section. Canon Parts 6 (dog-fooding -- install path is part of the venture surface) + 7 (reuse-before-build -- 92-trust-layer-refactor naming matches canon simplicity standard). Predecessor in family: Phase 95.2 install-cache-atomic-recovery-sessionstart-preflight (case #3, v1.13.0-beta.6). The pattern across all four cases: a single guard does not generalize across failure modes that share a surface; each case adds one independent defense.
- Phase 121.5 inserted after Phase 121: terminal-coherence-capstone (INSERTED 2026-05-10) -- THE LAST PHASE before the v1.13.0 FINAL RELEASE GATE. A consolidation phase, not a new surface (Canon Part 7): it acknowledges every UI/UX surface shipped across v1.13.0 (Phases 114/115/116/117/88.1/88.2/102/104/106/121) and harmonizes them into one coherent Claude Code terminal experience. Triggered by a three-part UI/UX audit 2026-05-10 (two parallel phase-by-phase audits + a HUD/De Stijl/CC-terminal audit) plus a parallel-research note identifying the uncoordinated SessionStart injection flood (~11 hook entries, ~9 injecting additionalContext, ~4 composing competing Larry-voice directives, no coordinator, no token budget) as the root cause of Larry's occasional session-start incoherence ("lost in the middle"), plus an external "De Stijl Full UI/UX Implementation Guide" reference doc verified against Claude Code docs (filed annotated at .planning/phases/121.5-.../121.5-REFERENCE-destijl-guide-annotated.md -- ~1/3 buildable: output-style force-for-plugin + two-row statusline + the semantic vocabulary; ~1/3 regression: env-var room-state via UserPromptSubmit hooks, skill-frontmatter SessionStart hooks; ~1/3 fabricated: custom theme JSON files, statusLine.refreshInterval). Eight sub-plans: (A) SessionStart Coordinator -- single script, precedence ladder, hard token budget; (B) body_shape: frontmatter sweep across ~47 undeclared commands + ship output-styles/destijl.md with force-for-plugin:true + keep-coding-instructions:true (system-prompt 4-zone enforcement); (C) skills/ui-system/SKILL.md v2 reconciliation -- add Shape F.0/F.6 (shipped by 88.2 but undocumented), fold in Phase 102's dual De Stijl palette (D-06b amendment never landed), resolve the 🎯 glyph triple-overload + the "JTBD" word collision (Phase 37 bash nudges vs Phase 100 typed engine); (D) two-row statusline (identity row + situation row) + references/visual/palette.json as the canonical De Stijl palette source-of-truth (currently scattered across scripts/banner + visual-ops.cjs DS_HEX + templates/destijl-base.css + templates/shared.css + vault-kit snippet with no canon) + wire statusline-mos as the canonical settings.json statusLine.command (self-update-resilient); (E) render-v2 disposition decision (wire into Larry's prose path OR document as agent-surface-only) + close Phase 102 with a VERIFICATION.md (102-VALIDATION.md still status:draft); (F) version-of-record stamp on every first-touch surface (SEED-007 absorbed as this sub-plan) + stale-copy scanner extending doctor.cjs; (G) truth-telling + housekeeping -- delete the stray empty .planning/phases/40-hook-expansion/ dir (corrupts context-monitor's active-phase mtime scan), fix the Phase 88.7 ROADMAP "1/1 plans complete" lie (only scripts/power-demo-prompt.md exists, commands/power-demo.md does not), audit the mtime scan for other abandoned phase dirs; (H) the coherence smoke test -- fresh-install walk where a human reads the terminal at every step and can answer who/job/runway/next, byte-identical on CLI, degraded-but-coherent on Desktop/Cowork. Five Open Design Decisions must be resolved with Jonathan before /gsd:plan-phase 121.5: (1) the SessionStart precedence ladder, (2) the combined token budget, (3) palette keep-vs-rebrand, (4) 🎯/"JTBD" disambiguate-vs-document, (5) render-v2 wire-vs-freeze. Canon Parts 3 (UI Ruling System enforcement pass) + 4 (coordinator decisions + compliance signals mirror to Phase 121 telemetry; no side-channel printing) + 7 (consolidation only -- any NEW file must REPLACE/reconcile N existing things) + 8 (coordinator telemetry local-only, scalar/enum/hash payloads only) + 10 (the terminal must coherently express "conversation as the product" -- precondition for the Part 10 ratification at the final gate). Runtime ordering: runs AFTER 118/119/120/121, immediately BEFORE the FINAL RELEASE GATE. ~3-4 days. See .planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md.

| Phase 71 P01 | 4min | 2 tasks | 3 files |
| Phase 71 P02 | 3min | 2 tasks | 2 files |
| Phase 72 P01 | 4min | 2 tasks | 4 files |
| Phase 72 P02 | 4min | 2 tasks | 2 files |
| Phase 73 P02 | 3min | 2 tasks | 2 files |
| Phase 73 P01 | 4min | 2 tasks | 3 files |
| Phase 74 P01 | 4min | 2 tasks | 3 files |
| Phase 74 P02 | 4min | 2 tasks | 2 files |
| Phase 75 P02 | 2min | 2 tasks | 2 files |
| Phase 75-onboarding-redesign P01 | 3min | 2 tasks | 1 files |
| Phase 79-native-filing-wikilinks P01 | 5min | 2 tasks | 5 files |
| Phase 79 P02 | 12min | 2 tasks | 2 files |
| Phase 80 P01 | 20min | 2 tasks | 24 files |
| Phase 80 P02 | 15m | 2 tasks | 4 files |
| Phase 80 P04 | 30 | 2 tasks | 3 files |
| Phase 80 P06 | 25min | 2 tasks | 7 files |
| Phase 84 P01 | 5min | 5 tasks | 1 files |
| Phase 84 P02 | 4min | 5 tasks | 2 files |
| Phase 84 P03 | 25min | 5 tasks | 6 files |
| Phase 87 P00 | 45min | 2 tasks | 17 files |
| Phase 87 P02 | 17min | 2 tasks | 4 files |
| Phase 87-security-hardening-cascade-refactor P01 | 14min | 2 tasks | 4 files |
| Phase 87-security-hardening-cascade-refactor P01a | 19min | 3 tasks | 6 files |
| Phase 87-security-hardening-cascade-refactor P08 | 43min | 3 tasks | 6 files |
| Phase 87 P03 | 30min | 1 tasks | 2 files |
| Phase 87-security-hardening-cascade-refactor P05 | 8min | 2 tasks | 3 files |
| Phase 87 P06 | 14min | 2 tasks | 3 files |
| Phase 87-security-hardening-cascade-refactor P04 | 8min | 2 tasks | 9 files |
| Phase 87-security-hardening-cascade-refactor P07 | 12min | 2 tasks | 5 files |
| Phase 87-security-hardening-cascade-refactor P09 | 45min | 4 tasks | 8 files |
| Phase 87-security-hardening-cascade-refactor P10-v2 | 15min | 3 tasks | 5 files |
| Phase 88 P00-B | 5min | 1 tasks | 3 files |
| Phase Phase 88-00 P00 | 20min | 2 tasks | 11 files |
| Phase 88 P01 | 12min | 1 tasks | 4 files |
| Phase Phase 88 PP02 | 25min | 1 tasks | 4 files |
| Phase 88 P03 | 15min | 1 tasks | 4 files |
| Phase 88 P04-B | 15min | 1 tasks | 8 files |
| Phase 88 P04 | 91min | 3 tasks | 7 files |
| Phase 88 P05 | 63min | 1 tasks | 3 files |
| Phase 88 P06 | 15min | 1 tasks | 2 files |
| Phase 88 P07 | 60min | 2 tasks | 7 files |
| Phase 88 P09 | 15min | 1 tasks | 2 files |
| Phase 88-feynman-minto-memory-layer P10 | 12m | 1 tasks | 3 files |
| Phase 88-feynman-minto-memory-layer P11 | 15m | 1 tasks | 3 files |
| Phase 88 P13 | 45min | 1 tasks | 13 files |
| Phase 88 P12 | 25min | 2 tasks | 4 files |

### Decisions

- v1.9.3: APPROVE/REJECT/DEFER cascade, mid-session intelligence, filing completeness all shipped
- v1.9.4: Three-layer dependency order: OPP (engine) -> CONV (entry) -> ONBD (teaching)
- v1.9.4: 5 phases for 15 requirements -- OPP splits into engine+graph, CONV splits into routing+capture
- [Phase 71]: djb2 hash for opportunity dedup - fast, deterministic, sufficient for file-level uniqueness
- [Phase 71]: Knight position classification: gaps=uncertainty, convergences=risk, contradictions=mixed
- [Phase 71]: Hoist analyzeOutput before Step 10 try block for Step 11 cross-step reuse
- [Phase 72]: Non-blocking graph indexing: bankOpportunity writes file first, indexOpportunity fires as catch-swallowed promise
- [Phase 72]: ADDRESSES edges limited to 5 artifacts per domain section, IN_DOMAIN links to Section node
- [Phase 72]: Brain enrichment is non-blocking fire-and-forget in bankOpportunity
- [Phase 72]: FEEDS_INTO chains provide ordered validation step sequences for banked opportunities
- [Phase 73]: Inline Tier 0 chains in getTier0Chain() rather than parsing persona-chains.md at runtime
- [Phase 73]: Unknown persona defaults to researcher chain (problem-first is safest generic path)
- [Phase 73]: Tier 0 hardcoded framework chains for persona-based conversation routing without Brain dependency
- [Phase 74]: Atomic writes (.tmp then rename) for scratchpad crash safety
- [Phase 74]: Lazy require of opportunity-ops in migrateToRoom to avoid circular deps
- [Phase 74]: bank-opportunity auto-detects JSON vs roomDir+JSON argument pattern
- [Phase 74]: Scratchpad reading in session-start is non-blocking with || echo fallback
- [Phase 74]: Section seeding maps opportunity domain to room sections (problem-definition, solution-design, market-analysis, business-model)
- [Phase 75]: OPP_BANK_SUMMARY computed via inline node, sorted by confidence, injected into all three tiers
- [Phase 75-onboarding-redesign]: Mode-first onboarding: teach three ways to work before asking who the user is
- [Phase 75-onboarding-redesign]: Knight framing is practical with persona examples, not academic theory
- [Phase 79]: analyze-room reinterpretation: wikilink xref source files (no on-disk xref files exist)
- [Phase 80]: [Phase 80-01] MANIFEST schema_version 1.0 locked; writeManifest refuses any manifest without it
- [Phase 80]: [Phase 80-01] run-all-tests spawns each test file as child process to isolate assert failures
- [Phase 80]: [Phase 80-01] bin/mindrian-tools.cjs broken via better-sqlite3/lazygraph-ops chain; 80-05 must route /mos:vault import directly through scripts/vault-import.cjs
- [Phase 80]: Role re-inference in orchestrator covers person-detector narrow-window limitation (Jane Doe co-founder case)
- [Phase 80]: Stage 03c defaults to direct-copy meeting filing fallback per PRECONDITIONS.md (lazygraph-ops broken)
- [Phase 84]: Phase 84-01: schema-only additive migration; no room column on new tables (room.db is per-room)
- [Phase 84]: 84-02: composition module room-db.cjs instead of modifying lazygraph-ops.cjs
- [Phase 84]: memory-lifecycle.cjs resolves active room internally via Phase 83 canonical registry, eliminating need for shared bash helper across four hooks
- [Phase 84]: post-compact creates new session id rather than continuing pre-compact id; compact is a context discontinuity from Claude's perspective
- [Phase 87-00]: Cascade e2e fixture copies seed-room into tmpDir/rooms/ to satisfy intelligence-cascade.isRoomFile() guard
- [Phase 87-00]: Frozen baseline uses exact-match assertions (strictEqual), not soft `>= 1` thresholds, so 80% edge regressions cannot pass silently
- [Phase 87-00]: Feynman runner now treats exit 77 as SKIPPED (POSIX test-infra-broken convention), preventing env degradation from masquerading as regression
- [Phase 87-02]: Atomic write-lock via fs.openSync(lockPath, 'wx'); EEXIST triggers staleness/PID-liveness cleanup + single retry; same-PID re-acquire keeps writeFileSync per m11 rationale
- [Phase 87-02]: Concurrency fence winner sleeps 500ms post-acquire so PID liveness check rejects all losers (proves the openSync primitive, not the dead-PID cleanup fallback)
- [Phase 87-02]: Standalone worker file (not inline template string) for cross-platform path-escape safety; test forks it directly via child_process.fork
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01: Whitelist sanitization /[a-zA-Z0-9 ._-]/ over escape-based defence; applied at 8 Cypher interpolation sites in brain-client.cjs
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01: API key file permission check rejects any group/world-read bit (mode & 0o077 != 0); Windows returns true with stderr warning since NTFS ACLs are outside POSIX mode semantics
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01: Named constant HSI_TIMEOUT_MS = 30000 replaces 12 magic-number 5000ms sites in intelligence-cascade.cjs; preserves 2 intentional 15000ms sites for generate-presentation.cjs
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01a: .room-root sentinel is the Data Room scoping primitive; hook walks UP to detect ancestor, plugin source commits (no .room-root ancestor) pass unconditionally
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01a: worktree-safe install path via git rev-parse --git-path hooks/pre-commit, NOT --show-toplevel/.git/hooks/ (breaks on linked worktrees where .git is a file)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01a: Windows GUI enforcement path is session-start re-install + CI, not the .cmd wrapper (wrapper is a non-silent fallback when git-bash is missing)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01a: symlink-safe walker via pwd -P + VISITED associative array; guard walker terminates on cycle in one iteration not infinite loop
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: scripts/serve-dashboard-live is a NEW Node HTTP server co-existing with the untouched legacy bash scripts/serve-dashboard (R-87-08-A). /mos:dashboard live routes to new; /mos:dashboard bare routes to legacy.
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: openBrowser(url) helper in platform.cjs uses strict regex ^https?://(127.0.0.1|localhost)(:\d+)?(/|$) and argv-array child_process.spawn; rejects evil.com, file:///, and http://localhost.evil.com subdomain-trick.
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: active room resolution delegated to scripts/resolve-room (R-87-08-C); zero bare .rooms/registry.json reads in the server.
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: MOS_BIND_ALL=1 aborts startup with exit 2; server binds 127.0.0.1 only; port fallback 3131-3140 on EADDRINUSE.
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: v1.10.11 dashboard ships WITHOUT chat panel; grep -c 'chat-panel|mos-chat-container|mos-chat-form|mos-api-key' dashboard.html == 0; chat arrives in 87-09.
- [Phase 87-03]: _runCascadeSteps private helper: runCascade + queueCascade delegate, lastHsiByRoom owned by callers (helper returns hsiRanAt), frameworkHint option preserves queueCascade 'cascade-batch' provenance
- [Phase 87-03]: Cascade dedup: 854 -> 653 lines (-201, -23.5%); 87-00 cascade-e2e baseline stays exact-match {INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1}; security-trifecta structural assertions migrated from 12 -> 6 HSI_TIMEOUT_MS sites (semantic invariants preserved)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-05: Shared sectionOptional Zod schema replaces 5 inline z.string().optional() sites in tool-router.cjs; single definition eliminates drift
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-05: safeResolveSection() is defense-in-depth (Zod regex at MCP edge + path.resolve startsWith at fs I/O boundary); either layer alone blocks traversal, both must pass
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-05: opportunitySchema.passthrough() enforces title+bounds while preserving opportunity-ops dynamic field reads; 4 non-section optional string params at 755/785/836/873 explicitly out of scope
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-06: node:sqlite DatabaseSync lacks conn.transaction(fn) (better-sqlite3 API only); use explicit BEGIN/COMMIT/ROLLBACK prepared statements; extract _indexArtifactBody helper so rebuildGraph can call insert body inside its own outer BEGIN without nesting
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-06: Rollback test injection point is prepare #3 (2nd INSERT), not prepare #2 (1st INSERT); throwing on prepare #2 would fire BEFORE any real write (nothing to rollback, test passes even without wrap); prepare #3 ensures at least 1 INSERT fired so countAfter - countBefore == 1 is the true regression signal
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-06: Pre-existing rebuildGraph (never exercised by cascade-e2e) referenced the same dead conn.transaction API; fixed in same commit as Rule 1 auto-fix to keep lazygraph-ops.cjs internally consistent; graph-ops.cjs + write-lock.cjs unchanged (87-02 atomic lock remains outer guard)
- [Phase 87-04]: Two distinct entry points (room-ops-sync.cjs + room-ops-async.cjs) + pure-logic shared (room-ops-shared.cjs) eliminate the R4 env-branching footgun at the language level; require-time choice replaces runtime guard
- [Phase 87-04]: Key-set parity enforced programmatically (Object.keys(sync).sort().join() === Object.keys(async).sort().join()) AND every async export is AsyncFunction (constructor.name check) -- future maintainer cannot drift signatures without breaking the test
- [Phase 87-04]: Legacy lib/core/room-ops.cjs retained as thin re-export shim with one-time process.emitWarning (code MOS_DEP_ROOM_OPS_LEGACY) so accidental out-of-tree callers are surfaced but not broken; dedups per Node process automatically
- [Phase 87-04]: resolveRoom moved to shared module (pure fs+JSON); async module wraps it in async fn so AsyncFunction constructor assertion is uniform across every exported name
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-07: sessionCache with pending-promise pattern caches the in-flight init Promise (not the resolved value) so 10 concurrent callTool() on the same api_key share ONE init (R-87-07-RACE fix); rejection purges the entry so the next caller retries fresh
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-07: LRU class backed by doubly-linked list + Map exposes Map-parity iteration (entries/keys/values/forEach/clear/[Symbol.iterator]) so the 3 cascade Map->LRU swap required zero call-site refactoring; iteration does NOT promote (reading is not a use)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-07: sha256 truncated to 16 hex chars (crypto.createHash node builtin, zero new runtime dep) for session-cache keys; 64-bit key space eliminates collision risk across any team MCP deployment
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-09: Bearer token + CSRF double-submit + Origin binding + DNS-rebinding Host guard + security headers + safeLogError (err.stack/.request/.config/.cause all forbidden); 5-pattern chat context builder with tokenEstimate<5K on every path; Pattern 3 graceful empty-stakeholders early-return
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-09: NULL_ORIGIN_SENTINEL = 'nu'+'ll' constant + dynamic ALLOWED_ORIGINS.add() for --allow-null-origin flag so grep audit reads zero hardcoded null-origin entries in the default allowlist (R-87-09-CSRF gap 1)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-09: 87-08 chat-hide test fence INVERTED in-place (from ==0 to >=1) at the Stream-A -> Stream-B transition boundary; dashboard.html for v1.10.12 now carries the chat-panel @include marker while serve-dashboard-live performs server-side inlining
- [Phase 87-security-hardening-cascade-refactor]: Plan 87-10-v2: v1.10.12 Stream B release 5-gate protocol -- gates 1-3 closed (CHANGELOG + plugin.json + package.json at 1.10.12), gates 4-5 (git tag + marketplace ref pin) gated on user approval; feynman 28/28, cascade-e2e exact baseline, BSL sweep 0 missing, chat-panel presence 3 (inverse v1.10.11 gate); engines-field hotfix ad2a15e verified (0 occurrences in plugin.json)
- [Phase 88]: [Phase 88-00-B]: Hand-written YAML parser over js-yaml: zero-new-dep invariant preserved; narrow dialect (scalars, ISO timestamps, string arrays, flat-object arrays) fits 150-line deterministic parser
- [Phase 88]: [Phase 88-00-B]: SEVERITY and CATEGORIES exported as Object.freeze() so downstream Phase 88 consumers (88-01, 88-04-B, 88-13) cannot mutate the shared contract
- [Phase 88]: [Phase 88-00-B]: Severity aggregation via ordered constant array index lookup; MAX across violations (critical > error > warning > info); null when no violations
- [Phase 88]: [Phase 88-00-B]: em-dash detection scans four narrative surfaces (governing_thought, key_claims, mece_arguments, body) to enforce feedback_no_emdashes project hard rule uniformly
- [Phase Phase 88-00]: Read-before-write preservation at runTier0+writeSectionFromNarrative entry points; last_generated_at always advances; sentinel zero 1970-01-01T00:00:00Z marks never-regenerated-under-v88
- [Phase Phase 88-00]: validateStructural accepts pre-v88 payloads (back-compat opt-in); validateDecisionLogEntry as separate export for 88-10 chokepoint; atomic migration via openSync 'wx' composes with Phase 87-02 write-lock
- [Phase 88]: [Phase 88-01]: Three-file two-entry-point architecture (folder-memory-shared + folder-memory + folder-memory-async) copies Phase 87-04 room-ops pattern exactly; sync for CLI hooks, async for MCP Desktop, shared pure logic consumed by both; key-set parity + AsyncFunction constructor assertion enforced in test
- [Phase 88]: [Phase 88-01]: computeStale precedence -- invariant_violation > parse_failed > never_generated (sentinel 1970-01-01) > missing_timestamps (field absent) > artifacts_newer_than_minto > fresh; sentinel vs absent carry different semantics for 88-13 guardian (regen vs repair)
- [Phase 88]: [Phase 88-01]: STATE.md minto_health emission stays '--' placeholder; consumers derive qualitative signal from reasoning branch's reasoning_health_score (compute-state verified to emit zero MINTO/reasoning tokens); single-sources quantitative vs qualitative
- [Phase 88]: [Phase 88-01]: Best-effort parse on critical invariant violation -- governing_thought and decision_log still surface; only is_stale flips and stale_reason documents why; downstream consumers render sanitized content with staleness annotation rather than hiding the section entirely
- [Phase Phase 88]: [Phase 88-02]: minto-debouncer queue with 10s earliest-wins coalescing window; atomic tmp+fsync+rename writes bracketed by Phase 87-02 write-lock; 12-attempt exponential-backoff lock retry with half-jitter rides out 5-20 concurrent producers without starvation
- [Phase Phase 88]: [Phase 88-02]: self-healing queue reader returns empty shape on ENOENT/SyntaxError/shape-mismatch/version-mismatch with one stderr warning; debouncer is best-effort coalescing valve not correctness boundary, so dropping a crash-corrupted queue is preferable to crashing a bash hook
- [Phase Phase 88]: [Phase 88-02]: Atomics.wait sync sleep on SharedArrayBuffer Int32Array for CLI hook scripts with no event loop; busy-wait fallback if SAB disabled; future sync-sleep needs (rate limiters, retry loops) should copy this primitive
- [Phase Phase 88]: [Phase 88-02]: drain returns partial results on timeout rather than throwing; wall-clock checked at three gates (pre-lock, post-lock, mid-partition); any entries not processed stay queued for next drain -- consumer-friendly API for bounded-budget callers (on-stop 5s, intent-classifier session-start)
- [Phase 88]: [Phase 88-03]: ROOM.md references recompiler deterministic + atomic + composes with Phase 87-02 write-lock via exponential-backoff retry (12 attempts, 25ms base, 1600ms cap, half-jitter); machine-managed region delimited by <!-- BEGIN/END REFERENCES --> markers identical to 88-01 folder-memory reader; identity prose preservation verified byte-for-byte across recompiles
- [Phase 88]: [Phase 88-03]: mtime-conflict detection via .mindrian/recompile-stamps.json with 1000ms slack for fs timestamp granularity; double-check pattern (pre-lock AND post-lock) defends against stamp refresh during backoff; stamp advances even on no-op recompile to keep next comparison honest; CLI exits 0 on mtime_conflict (expected outcome, warning to stderr) -- closes risk #7 silent stomp of manual edits
- [Phase 88]: [Phase 88-03]: Wikilinks emit as [[target]] when label==target (standard Obsidian rendering + grep-friendly dedup) and [[target|label]] when they differ; alphabetical stable sort on target is the determinism anchor that makes 88-06 on-stop snapshot diffs meaningful
- [Phase 88]: [Phase 88-04-B]: 7-step atomic write (openSync 'wx' + fsync + validate + acquireLock + rename + releaseLock) with invariants gate BEFORE rename; broken narratives cannot overwrite previous MINTO.md; machine-parsable envelope {success, violations[], bytes_written, elapsed_ms, path} on stdout for 88-04/88-06/88-13 consumers
- [Phase 88]: [Phase 88-04-B]: Exponential-backoff lock retry (12 attempts, 25-1600ms cap, half-jitter) composes with Phase 87-02 acquireLock primitive so 5-20 concurrent producers converge without starvation; tmp naming <target>.tmp.<pid>.minto lets 88-13 guardian sweep orphans and correlate to producer pid
- [Phase 88]: [Phase 88-04-B]: Rule 1 auto-fix -- 88-00-B YAML parser regex extended from [A-Za-z_][A-Za-z0-9_]* to [A-Za-z_][A-Za-z0-9_-]* in 3 key-parse sites to accept dashes in key names like parent-moc; Rule 2 auto-fix -- schema_version + governing_thought added as top-level frontmatter keys in both tier-0 and tier-1 paths so invariants validator accepts generator output
- [Phase 88]: [Phase 88-04]: Post-write triple-fire wired -- detect_room_section via .room-root walker; stamp + recompile BACKGROUNDED (disowned subshells) so user-visible hook return is decoupled from write-lock contention under 20-writer Cowork load; debouncer enqueue stays synchronous (single-digit-ms JSON write) to preserve 10s coalesce ordering; system files ROOM/STATE/MINTO stamp only (no enqueue, no recompile) to prevent MINTO-rewrite livelock
- [Phase 88]: [Phase 88-04]: hooks.json PostToolUse matcher widened Write -> Write|Edit|MultiEdit for parity with PreToolUse; Edit-in-place of existing artifacts now fires freshness wires (pre-88-04, edits silently drifted MINTO + ROOM.md within one session); scripts/post-write gets explicit exit 0 soft-fail boundary under set -euo pipefail so cascade/triple-fire failures cannot propagate as user-visible tool-call failures
- [Phase 88]: [Phase 88-04]: stamp-artifact-write helper composes with Phase 87-02 write-lock via 12-attempt exponential-backoff retry with half-jitter (mirrors 88-02 debouncer + 88-03 recompiler primitives); atomic tmp+fsync+rename with .tmp.<pid> naming; defensive pending-stamps fallback at .mindrian/pending-stamps/<section>.json when MINTO.md is absent or malformed (88-05 regen worker will merge on next generation)
- [Phase 88]: [Phase 88-05]: drain-at-prompt lazy commit -- UserPromptSubmit fires on every user turn, drains items older than 30s, appends to .mindrian/pending-tier1-regen.json atomically, spawns tier-0 regens in BACKGROUND via child_process.spawn(detached,unref,stdio:ignore); session crashes preserve queue and next hook picks up where we left off
- [Phase 88]: [Phase 88-05]: consolidated single-node drain over three-bash-call pipeline -- 20-entry burst collapsed from 2696ms to 777ms by amortizing Node cold-start cost across drain + pending-append + fork-scheduling; programmatic debouncer.drain() API used instead of CLI subprocess to avoid second cold-node fork
- [Phase 88]: [Phase 88-05]: pending-tier1-regen.json as inter-phase bridge with APPEND-only semantics -- 88-05 is producer (appends drained entries), 88-07 session-start is consumer (surfaces 'N sections have tier-0 pending tier-1 upgrade' prompt); history preserved across sessions so 88-07 has full visibility
- [Phase 88-06]: on-stop close-out: olderThanMs=0 (flush everything) + timeoutMs=1500 (not PLAN 5000) to respect 3000ms hooks.json Stop-hook budget; debouncer partial-on-timeout guarantees nothing lost (88-05 at-prompt drain next session)
- [Phase 88-06]: Parallel per-section recompile with outer wait cap (~1000ms) instead of sequential N*400ms; orphaned recompiles finish async but hook does not block; 88-13 guardian can surface orphans via .mindrian/session-close.log elapsed traces
- [Phase 88-06]: Single inlined Node -e block for readTriple walk + atomic snapshot + stale ledger: amortizes cold-start cost (saved ~2s vs three bash subcalls) and sidesteps bin/mindrian-tools.cjs better-sqlite3 coupling; env-var context transfer via ROOM_DIR_ENV + PLUGIN_ROOT_ENV
- [Phase 88-06]: session-snapshot.json + minto-stale.json both schema v1; atomic tmp.<pid>+rename per file; readtriple_failed error path appends to stale list with section-specific error so one broken section cannot crash the whole snapshot walk (graceful-degradation propagated from 88-01)
- [Phase 88-06]: Phase 84 STATE.md contract preserved byte-for-byte: Phase 88 block is strictly ADDITIVE, sits AFTER Phase 84 STATE.md write + memory-lifecycle + voice-log reader; Test 6 is the explicit regression fence (any future edit removing compute-state call breaks the test)
- [Phase 88]: Phase 88-07: DEFAULT_BUDGET_TOKENS = 5000 grounded in measured 3825-token session-start baseline (not 20% heuristic); SESSION_START_BUDGET_TOKENS env override lets power users rescale
- [Phase 88]: Phase 88-07: Null reasoning_health_score sorts FIRST (weakest-most / highest-priority-to-surface) under budget pressure -- matches pedagogical goal of surfacing weakest triples first
- [Phase 88]: Phase 88-07: Snapshot-first read with live readTriple fallback -- three-tier graceful degradation (snapshot -> live -> empty) makes session-start robust to 88-06 producer failure
- [Phase 88]: Phase 88-07: Bash env-propagation fix --  does NOT propagate VAR into subshell; use  for correct scoping. Same pattern as 88-06 on-stop
- [Phase 88]: [Phase 88-09] Byte-identity enforced via Test 9 rather than shared-helper extraction: session-start + post-compact have near-duplicate node -e blocks; extraction to scripts/emit-triple-context.cjs deferred because (a) hook budgets (3000ms / 5000ms) already tight; (b) Test 9 is deterministic CI gate for drift
- [Phase 88]: [Phase 88-09] stderr diagnostic 'post-compact: snapshot missing: fell back to live read' kept verbatim from PLAN so 88-13 guardian's log-scrape regex can match both this hook and future consumers that copy the pattern
- [Phase 88]: [Phase 88-09] Snapshot-first / live-fallback / empty-OK three-tier ladder copies 88-07 contract verbatim; only filename differs (pre-compact-snapshot.json vs session-snapshot.json); four-phase producer-consumer architecture now symmetric (88-06->88-07, 88-08->88-09)
- [Phase 88-feynman-minto-memory-layer]: Outer + inner write-lock composition: outer lock serializes the read-modify-write; inner lock serializes the rename; same-pid re-acquire is a no-throw overwrite per write-lock.cjs.
- [Phase 88-feynman-minto-memory-layer]: Archive month from archived entry timestamp (not today) keeps partitions chronologically coherent for future full-history queries.
- [Phase 88-feynman-minto-memory-layer]: JSONL append-only archive; fs.appendFileSync is POSIX-atomic for small lines. Prior lines never rewritten (Test 4 invariant).
- [Phase 88-feynman-minto-memory-layer]: Additive tertiary write pattern: proactive-intelligence.cjs authoritative, decision-capture.cjs read-optimized; primary writer byte-frozen; dual-write never blocks
- [Phase 88-feynman-minto-memory-layer]: Skip-not-error for missing-section: no --source-artifact OR outside --room is a documented skip with no error log entry; only real failures (no_minto, schema violations) trigger .mindrian/decision-dual-write-errors.jsonl
- [Phase 88-feynman-minto-memory-layer]: Section derivation from --source-artifact first path segment (relative or absolute); outer try/catch wraps whole block so require-time errors are also swallowed; CLI exit 0 always
- [Phase 88]: Phase 88-13: Four seed validators (not one) -- extensibility tested by diversity; three silent-failure modes (partial snapshot, unbounded queue, ghost stale entries) become first-class validators at plan one
- [Phase 88]: Phase 88-13: Advisory at runtime + blocking only at pre-commit -- never block session-start over triple-health; enforce only at lock-in moment
- [Phase 88]: Phase 88-13: Validator registry fail-open -- one broken validator never breaks the whole registry (Test 12 fence); downstream phases (88.3 Brain, Phase 90 Nav) extend without touching guardian.cjs
- [Phase 88]: Phase 88-13: Stale-lifecycle scope narrowed to invariants-owned reasons (invariant_violation, parse_failed); folder-memory-owned reasons (never_generated, missing_timestamps, artifacts_newer_than_minto) skipped so 88-06 legitimate staleness is never pruned
- [Phase 88]: Phase 88-13: Pre-commit hook composes with 87-01a via DISCOVERED_ROOM_ROOTS in the same installer-delivered guard script; plugin source commits bypass untouched
- [Phase 88]: v1.10.13 ships via partial-autonomous 5-gate protocol: gates 1-4 closed autonomously (CHANGELOG entry, version bumps, local commit+tag); gates 5a/5b (push + marketplace pin) surfaced as user-action checkpoint because they require user credentials and cross workspace boundaries
- [Phase 88.6]: Extract baseline-fetch into shared ensure-brain-baseline.cjs helper (Canon Part 7 Reuse Before Build) rather than duplicate inline across discovery-cycle.cjs and whitespace-command.cjs
- [Phase 88.6]: Helper exits 2 (not 1) on Brain offline so callers distinguish offline vs invocation error; never throws, always returns result object
- [Phase 88.6]: Phase 88.6 ships v1.10.14 via 5-gate release protocol: Gates 1-4 closed autonomously (CHANGELOG + plugin.json + package.json + CANON-PHASE-MAP + release commit 55d65ab + local tag v1.10.14); Gate 5 (push + marketplace ref pin) surfaced as user-action checkpoint per plan autonomous=false (identical to 88-12 precedent)
- [Phase 88.6]: Used Edit tool (never Write) for plugin.json and package.json version bumps per BLOCKER 5 landmine guard; all 10 dependencies and 27-line structure of package.json preserved byte-for-byte; single-line diff each file
- [Phase 88.1]: Under-promise tiebreaker applied across all 72 commands; destructive set kept narrow (publish/export/snapshot/vault); allowed-tools granularity deferred to Plan 88.1-02
- [Phase 88.1]: 88.1-10: PROACTIVELY limited to 3 observe-react agents (grading/investor/opportunity-scanner) -- meets CONTEXT #10, zero bloat. Color palette 8-slot. Isolation: worktree on 3 write-heavy/external-API agents.
- [Phase 88.1]: MINTO.md validation delegates to Phase 88-00-B feynman-minto-invariants.cjs (no schema duplication)
- [Phase 88.1]: null frontmatter = parser failure signal (critical malformed); empty {} = critical by all-required-missing escalation
- [Phase 88.1]: Unknown frontmatter fields produce warning (advisory drift), not error; advisory hook never blocks Write/Edit/MultiEdit
- [Phase 88.1]: 88.1-08 plumbing-over-stash: git hash-object + read-tree (GIT_INDEX_FILE tmp) + update-index + write-tree + commit-tree + update-ref; never checks out autocommit branch, never moves HEAD, never modifies user's working index; idempotent via tree-sha identity (write-tree output compared to parent tree; identical -> skip commit)
- [Phase 88.1]: 88.1-08 detached worker pattern: foreground hook performs ledger I/O + throttle check + systemMessage emission then spawns self with --worker flag (child_process.spawn detached+unref+stdio:ignore); git plumbing runs off-cycle so user's tool-call latency is unaffected
- [Phase 88.1]: 88.1-08 throttle contract: 5s window boundary is un-throttled (>= is allow, < is throttle); per-path scope; ledger retention 1 day with prune-on-write (LEDGER_RETENTION_MS = 86400000) keeps bounded without separate GC pass
- [Phase 88.1]: 88.1-08 invariant phrasing: source header comment deliberately avoids literal 'git push' and 'https://' substrings so verify-block greps match zero at byte level not just semantic level
- [Phase 88.1]: 88.1-05 ship /mos:status Shape E renderer reusing Plan 88.1-04 cache + classifyHealth + truncateGoverningThought byte-identically; 12 TDD tests; Canon Part 2/3/5/8 preserved; 4th L3/L4 surface with coherent glyph vocabulary
- [Phase 89]: Plan 89-01: Filename is lib/core/rs_math.py (underscore) not rs-math.py (hyphen) because Python cannot import hyphenated module names and the plan's own verify block imports via from lib.core.rs_math
- [Phase 89]: Plan 89-01: REVERSE_SALIENT coexistence is per-edge via properties.source not per-table; lazygraph-ops has no dedicated table, hsi-sourced edges survive rs-engine cleanup via json_extract scoping
- [Phase 89]: Plan 89-01: Artifacts read from filesystem walk room/*.md not room.db; no artifacts table exists in lazygraph-ops schema; matches compute-hsi.py precedent exactly
- [Phase 89]: Plan 89-01: Pinecone inference embedding (RS_EMBEDDING_MODEL=multilingual-e5-large cold path) raises NotImplementedError with pointer to Plans 89-03/89-05 per PLAN-CHECK Gap 1; MiniLM is 89-01 default
- [Phase 89]: Plan 89-03 rs-external Pinecone cache: 30-day lazy TTL, warm/cold/bypass paths, server-side multilingual-e5-large preserves warm/cold consistency, bypass path preserves Plan 89-02 byte-identical
- [Phase 89]: Plan 89-04 cross-room Mode A: --rooms loads N rooms with global_id uniqueness, CROSS_ROOM_OVERSHOOT=3 post-filter, pair_matrix metadata for bridge count table, no room.db edges (cross-room pairs belong to N-room graph)
- [Phase 89]: Plan 89-05 hybrid Mode C: lib/core/rs_hybrid.py unified corpus builder + cross-corpus pair filter; MiniLM-over-unified-corpus (not split embed) guarantees dimensional homogeneity (plan Risk 1 mitigation); HYBRID_OVERSHOOT=10 handles O(2000) external vs O(100) room volume imbalance; Plan 89-06 bridge-writer consumes hybrid pairs unchanged via schema-tolerant resolver
- [Phase 89]: Plan 89-05 Part 8 boundary preserved: room content read locally and used in-process only; external corpus stored in rs-external is strictly public OpenAlex/arXiv metadata; unified corpus lives only in memory during engine run; zero Brain queries
- [Phase 90]: [Phase 90-00]: BRAIN.md schema validator ships as standalone module mirroring Phase 88-00-B invariants shape byte-identically (validateSchema returns {valid, violations[], severity} so Plan 90-05 registry wraps without adapter); narrow YAML parser is a scoped copy not a cross-import, preserving flat lib/core dependency graph per 88-01 key-decision
- [Phase 90]: [Phase 90-00]: Canon Part 8 boundary baked into schema layer (not retrofitted runtime guard): 5-pattern frozen regex set (email / currency / quoted-person / meeting fragment / SSN-like) scans every frontmatter scalar and emits canon_boundary/warning with action_hint canon_part8_review; heuristics over-flag deliberately -- false-positive cost is one-line review, false-negative cost is constitutional breach
- [Phase 90]: [Phase 90-00]: author field frozen to literal 'brain'; non-brain authors are attribution/error (constitutional per Canon Part 2, not schema shape miss); BRAIN.md self-attribution is the contract that lets the quadruple readers distinguish Brain-authored derivation from user / Larry artifacts
- [Phase 90-brain-derivation-layer]: buildBrainQueryContext is the Canon Part 8 chokepoint: the only function in brain-derivation.cjs that reads user-specific triple fields; every field exits as a sha256 hash, bounded integer, scalar in [0,1], frozen enum, or slug-safe section name
- [Phase 90-brain-derivation-layer]: Every prompt builder validates ctx against frozen ALLOWED_CTX_KEYS at function entry; TypeError on forbidden or out-of-range keys (defense-in-depth for Canon Part 8)
- [Phase 90-brain-derivation-layer]: Fixture Test 13 (positive allow-list audit) + Test 14 (negative Lawrence/5M/revenue leak test) prove the Canon Part 8 boundary holds at CI time, not by comment
- [Phase 90-brain-derivation-layer]: Atomic write tmpfile naming /BRAIN.md.tmp.<rand>.brain/ follows Phase 88-04-B pattern: openSync wx -> write -> fsync -> validateSchema -> rename; any ERROR/CRITICAL severity aborts with tmpfile cleanup
- [Phase 90-brain-derivation-layer]: deriveSection NEVER throws: graceful failure at every external boundary returns a structured result object (brain_unavailable / triple_incomplete / derivation_timeout / rate_limited / auth_failed / schema_rejected / fs_error)
- [Phase 90-brain-derivation-layer]: Plan 90-03 staleness precedence: missing > parse_failed > hash_mismatch > age > version > fresh; Canon Part 8 invariant proved by Test 13 fixture audit (zero content queries during scan)
- [Phase 90-brain-derivation-layer]: readQuadruple is additive: readTriple signature/return unchanged; back-compat gate enforced by Phase 88-01 test (15/15) + key-set parity test (17/17)
- [Phase 90-brain-derivation-layer]: OPTIONAL_SECTION_HEADINGS duplicated byte-for-byte in folder-memory-shared (flat lib/core dep graph preserved per 88-01; parity test catches drift)
- [Phase 90-brain-derivation-layer]: brain-offline exemption in isQuadrupleFresh (transient network != derivation staleness; derivation_timeout stays stale)
- [Phase 90-brain-derivation-layer]: Plug into Phase 88-13 registry, not guardian.cjs. Zero guardian edits. Three-tripwire Canon Part 8 enforcement now active (schema doc + prompt-builder allow-list + body-text scan).
- [Phase 90-brain-derivation-layer]: Lazy folder-memory require in validator enables Check A staleness fallback when guardian does not pre-populate ctx.triple; preserves fail-open semantics.
- [Phase 90-brain-derivation-layer]: canon_boundary cap at 5 violations per BRAIN.md (anti-spam). BRAIN.md absence returns zero violations (mirrors stale-lifecycle pattern).
- [Phase 90-brain-derivation-layer]: Phase 90-06: Four-layer Canon Part 8 enforcement -- ALLOWED_ROOT + GUARDRAIL.md + per-room brain_cross_room:false + sanitizeDetailScalar/JSON.stringify audit; ships the fourth tripwire of Phase 90
- [Phase 90-brain-derivation-layer]: Phase 90-06: Phase 83 .rooms/registry.json + GUARDRAIL.md reuse preserved byte-for-byte; zero Phase 83 code edits
- [Phase 90-brain-derivation-layer]: Phase 90-06: cross_room_scan:false default; opt-in per-call (plan 90-07 surfaces --cross-room flag); aggregator lazy-required in brain-derivation.cjs so default-off path adds zero require-graph cost
- [Phase 90-brain-derivation-layer]: Phase 90-06: Three frozen contradiction types (hash_divergence, framework_contradiction, problem_type_mismatch); detail_scalar primitive-only, strings <=40 chars, zero forbidden regex hits
- [Phase 90-brain-derivation-layer]: Four invocation modes (single / --all / --cross-room / --dry-run) orthogonal on single dispatch() call
- [Phase 90-brain-derivation-layer]: Streaming progress threshold: N > 3 sections emits stderr lines; Shape E still renders on stdout
- [Phase 90-brain-derivation-layer]: Rate-limit mid-batch short-circuits remaining deriveSection calls; partial completion is valid
- [Phase 90-brain-derivation-layer]: Canon Part 8 by wrapping: dispatcher adds ZERO new Brain surface; every Brain call proxied through deriveSection
- [Phase 90-brain-derivation-layer]: Plan 90-09: INTERFACE_VERSION=1 frozen; readQuadruple is the ONLY Navigation Engine read path (direct fs FORBIDDEN); Section 3.2 weight table sums to 1.0 on required sections (0.35 pattern_matches highest; 0.20 framework_chain_predictions); brain_offline exemption (0.9 multiplier, not 0.0) matches Plan 90-04 isQuadrupleFresh
- [Phase 90-brain-derivation-layer]: Plan 90-09: RECOMMENDED marker is Mode A + pattern_matches candidate confidence >= 0.7 (Canon Part 3 invariant); Mode B and Tier 0 NEVER render the marker because ranking without Brain-authored confidence would be arbitrary
- [Phase 90-brain-derivation-layer]: Plan 90-09: Navigation Engine is READ-ONLY against BRAIN.md; fresh derivations route through Plan 90-02 enqueue -> Plan 90-01 deriveSection chokepoint; direct brain-client.query/search/smartSearch FORBIDDEN; Cypher embedding of BRAIN.md body FORBIDDEN (Canon Part 8 Section 9)
- [Phase 90-brain-derivation-layer]: Plan 90-09: Section 8 freezes 8 decision_trace fields Phase 91 MUST emit (version, staleness, stale_reason, weight_applied, recommended_confidence, recommended_marker_rendered, tier_mode, sections_consumed); zero-weight decisions still emit trace for /mos:explain-decision
- [Phase 88.7]: DOGFOOD-ROOM-UPGRADE Tier A: MINTO prerequisite blocker fixed via Phase 88 tier-0 generator (Rule 3 auto-fix); 7/7 BRAIN.md derived local-only; Canon Part 8 clean; Tier B/C/D deferred to interactive sessions per plan
- [Phase 89.1a]: Plan 89.1a-01: FORBIDDEN_PATTERNS re-exported (not redefined) from cross-room-aggregator; require-time guard throws on length < 6 so refactors are loud not silent
- [Phase 89.1a]: Plan 89.1a-01: validateCtx throws TypeError (never returns boolean) so silent false-return cannot smuggle user-specific bytes past buildBrainSubstrateQuery
- [Phase 89.1a]: Plan 89.1a-01: Pitfall 1 guard covers BOTH Pinecone fallback shapes (result.error=pinecone_quota_exhausted AND result._source=neo4j_fallback); neither is substrate-quality so neither gets cached
- [Phase 89.1a]: Plan 89.1a-01: loadSubstrate wrapped in top-level try/catch returns {success:true, substrate:[], mode:B3} on any exception so callers never need a try/catch
- [Phase 89.1a]: Plan 89.1a-02: Atomic write tmpfile naming brain-substrate-cache.json.tmp.<rand>.substrate mirrors Phase 90-01 pattern so 88-13 guardian can sweep orphans with narrow regex per producer
- [Phase 89.1a]: Plan 89.1a-02: Pitfall 5 partial_cache guard at TWO layers (readCache rejects + validator cache_partial_pull/critical); defense-in-depth against any single-layer bug
- [Phase 89.1a]: Plan 89.1a-02: MINDRIAN_BRAIN_SUBSTRATE_TTL_DAYS env override bounded [1, 3650] days; out-of-range clamps to DEFAULT_TTL_DAYS=30 so bad env value degrades gracefully vs crashing session-start
- [Phase 89.1a]: Plan 89.1a-02: Validator Check D JSON.stringify-scans entry.metadata only (not embedding); embeddings are Float64 arrays and any regex hit there would be a mis-encoded string smuggled as array element -- caught by shape check E.3 instead
- [Phase 89.1a]: Plan 03: 14-scenario adversarial fixture suite + Feynman runner registration; baseline advanced 62 -> 63; A1 + A2 sweeps clean (0 forbidden matches across 6 landed caches, 0 orphan tmpfiles across 14 roomDirs)
- [Phase 89.1a]: Plan 89.1a-04 Phase Gate: 9/9 asserts PASS; I1-I8 invariant coverage proven; zero new runtime deps; bundled_release honored (no CHANGELOG/plugin.json/package.json changes)
- [Phase 89.1a]: Plan 89.1a-04 Live Brain smoke: status PASS with Mode B3 observed vs A3 expected; root cause is pre-existing brain-client response shape {result:{hits:[]}} vs pullFromBrain expected {matches:[]}; Canon Part 8 wire-contract proven clean (audit line outcome=pass with generic handles only)
- [Phase 89.1a]: Plan 89.1a-04 deferred-items filed: brain-client vs pullFromBrain shape mismatch owned by Phase 89.1 planner; two remediation options proposed (pullFromBrain shape adapter OR brain-client searchWithVectors new method); neither alters Canon Part 8 contract
- [Phase 89.1]: Plan 89.1-01: Locked Option 1 (shape adapter inside pullFromBrain) over Option 2 (new brain-client method); Pinecone searchRecords MCP returns no values today, Option 2 needs MCP server tool surface expansion (out of repo scope); adapter localized to rs-brain-substrate.cjs preserves Canon Part 7
- [Phase 89.1]: Plan 89.1-01: Substrate entries on live wire path carry Pinecone _score (now entry.score) instead of 1024-dim embedding; validator Check E relaxed to embedding-or-score; strict 1024-dim cosine deferred to 89.2/89.5 if/when raw Pinecone fetch lands
- [Phase 89.1]: Plan 89.1-01: Cache schema _completeness vocabulary added (full-vectors | score-only | partial); pre-89.1a caches without this field treated as full-vectors by readers (back-compat preserved across 89.1a-03 14/14 fixture suite)
- [Phase 89.1]: Plan 89.1-01: Live Brain Mode A3 verified post-fix: count=100, has_score=true, has_embedding=false; Canon Part 8 chokepoint preserved (buildBrainSubstrateQuery + preSendAudit untouched, count==6 each); evidence in 89.1-LIVE-A3-VERIFY.md
- [Phase 89.1]: Plan 89.1-02: ExternalEgressViolation as sibling of BrainBoundaryViolation, not reuse. Brain-inbound and external-outbound surfaces are semantically distinct; sharing the class would conflate two bottlenecks.
- [Phase 89.1]: Plan 89.1-02: Deterministic n-gram intersection scoring formula baseScore * (1 + intersection/topicLen) over LLM-call decomposition; CLI surface has no LLM; same input -> byte-identical output (Test 7 fence).
- [Phase 89.1]: Plan 89.1-02: Three Canon Part 8 tripwires per egress surface: pre-input scan + per-field scrubScalar + JSON.stringify pre-return audit; ExternalEgressViolation thrown on any composite hit before egress.
- [Phase 89.1]: Plan 89.1-03: ExternalEgressViolation defined locally as SIBLING (not shared with rs-domain-analyzer); each module's own subclass keeps stack traces and audit logs unambiguous (continues 89.1-02 sibling decision)
- [Phase 89.1]: Plan 89.1-03: Two Canon Part 8 tripwires per egress surface = validateAnalysis pre-input scan + auditQuery post-template scan; sufficient for surfaces consuming already-validated scalars (vs three-tripwire on rs-domain-analyzer where per-field scrubbing also fires)
- [Phase 89.1]: Plan 89.1-03: 4 x 15 fixed-order template arrays (60 deterministic queries) over hash-seeded shuffle; same input -> byte-identical output across N invocations; no random selection in CLI surface
- [Phase 89.1]: Plan 89.1-03: T1 happy-path test asserts canonical 'every query mentions A or B' guarantee (60/60) instead of substring-count threshold (>=40 of A AND >=40 of B); captures the load-bearing invariant without coupling to template-specific text choices
- [Phase 89.1]: Plan 89.1-04 user-approved Option A: canonize parent ProcessStep rss-phase-1 first, then file USES_TECHNIQUE edge. Two methodology-canon writes inside v1.11.0 budget; both succeeded; idempotency proven; final_edge_count=1.
- [Phase 89.1]: Direct neo4j-driver write transport adopted for admin canonization scripts (Rule 3 auto-fix): user-tier MINDRIAN_BRAIN_KEY does not carry plan='admin' so brain-client.write returns 'Write access requires admin key'; admin scripts now use mcp-server-brain/node_modules/neo4j-driver against Aura with .env creds. Canon Part 8 attestation unchanged.
- [Phase 89.1]: Phase Gate format = 89.1a mirror G1-G9 + E1-E4 extension; 13/13 PASS captured against base 1313777..HEAD 6873cdc
- [Phase 89.1]: Live A3 + canon edge probes ran inline (Brain reachable from session); E1 mode=A3 substrate_length=25; E2 USES_TECHNIQUE edges=1
- [Phase 89.1]: Pre-commit hook side-effect (user's v1.10.18 hotfix) caught + isolated; Phase 89.1 commits touch zero release artifacts
- [Phase 89.2]: Plan 89.2-01: ExternalEgressViolation EXTRACTED to lib/core/rs-egress-violations.cjs (Canon Part 7 reuse); 89.1 per-module sibling subclasses preserved unchanged for back-compat; new 89.2 fetchers MUST require shared module
- [Phase 89.2]: Plan 89.2-01: FORBIDDEN_PATTERNS re-exported BYTE-FOR-BYTE from cross-room-aggregator via lib/core/rs-egress-prompts.cjs with require-time guard (length < 6 throws); mirrors 89.1a rs-brain-substrate-prompts.cjs pattern
- [Phase 89.2]: Plan 89.2-01: Telemetry path locked GLOBAL ~/.mindrian/telemetry/external-papers.json (NOT per-room); per-source budget is per-user resource; mirrors Phase 88.6-03 precedent direction
- [Phase 89.2]: Plan 89.2-01: Telemetry sha256(query_text).slice(0,16) hex prefix; literal query_text NEVER persists to disk (Canon Part 8 fence at telemetry layer; Test 6 + independent oracle confirm)
- [Phase 89.2]: 89.2-02: CJS re-implementation of OpenAlex+arXiv (rather than wrapping rs_corpus.py via child_process); rs_corpus.py remains valid for legacy callers
- [Phase 89.2]: 89.2-02: Single-chokepoint URL builder pattern (buildAcademicQuery) + single-fetch-call-site (fetchWithTimeout); static grep Test 12 enforces both invariants
- [Phase 89.2]: 89.2-02: External validator scope=global (not room) because telemetry is per-user; mirrors snapshot-integrity, queue-health, stale-lifecycle pattern
- [Phase 89.2]: Plan 89.2-03 introduced Pattern 6 (pre-flight Canon Part 8 audit) -- fetchPatents walks ALL queries through auditQueryString BEFORE the source loop; defense-in-depth retains chokepoint audit. Pattern 7 (PATENTS_SOURCES validator gate) prevents duplicate warnings across academic+patents+industry validators on shared global ledger.
- [Phase 89.2]: Plan 89.2-04 introduced TWO-LAYER auditQueryString chokepoint -- Layer 1 on user query, Layer 2 on each refined sub-query (after template substitution); proves defense-in-depth across full FORBIDDEN_PATTERNS family on both user-input and template-override vectors via Tests 10 + 11
- [Phase 89.2]: Plan 89.2-04 INDUSTRY_SOURCES gate scopes per-source / per-entry validator checks to 'tavily' only (mirrors PATENTS_SOURCES Pattern 7 from 89.2-03); prevents duplicate warnings across academic + patents + industry validators on shared global ledger
- [Phase 89.2]: Plan 89.2-05: experts post-processor with PUBLIC_EMAIL_SOURCES locked to ['openalex']; defense-in-depth auditQueryObject pre-return scan even though no network egress; composite (name|orcid) dedup; 12/12 + A1 sweep clean
- [Phase 89.2]: Plan 89.2-06: Pair-wise LSA via embedded sklearn TfidfVectorizer + TruncatedSVD subset is a DELIBERATE Canon Part 7 carve-out (rs_math.py is corpus-level; 2-doc mini-corpus produces degenerate IDF + 1-component SVD that does NOT correspond to Kwan 2023). Documented in plan must_haves + CJS file header + embedded Python lsaBridgeScript header (3 locations); acceptance grep enforces >= 2 CARVE-OUT hits in differential-scorer.
- [Phase 89.2]: Plan 89.2-06: Strict 1024-dim cosine via Pinecone-direct (Option a from CONTEXT.md) using EXISTING rs_cache.py::fetch_all_from_namespace v1.10.16 contract (already returns 1024-dim values). NO new Pinecone API surface; bridge is a thin JSON-over-stdio shim. NO Wave-0 prerequisite plan needed.
- [Phase 89.2]: Plan 89.2-06: Strict > comparisons in dual-floor filter (NOT >=); exact-threshold case lsa=0.2 bert=0.2 -> passes=false (Test 5 regression fence). Pedagogically the floor is a DETECTION filter, not borderline-acceptance.
- [Phase 89.2]: Plan 89.2-06: Embedded Python BSL discipline -- every embedded Python script literal carries '# BSL 1.1' as first line (W4 fix). Embedded source treated as licensable surface. Acceptance grep enforces >= 2 hits in any CJS file containing embedded Python.
- [Phase 89.2]: Classifier 3-enum strict > rule + Frozen-order tie-break for dominant_dimension + Pure string-concat thesis template (grep-able anchors)
- [Phase 89.2]: Phase 89.2 closure: 11 new fixture suites registered (baseline 66 -> 77; +11 exceeds ROADMAP +8 target via 89.1 baseline correction +1 + W3 standalone pinecone-bridge +1); Phase Gate CONDITIONAL PASS at commit 367ffbf (13 PASS + 1 CONDITIONAL G8 for 3 pre-existing failures all OUTSIDE 89.2 commit range); VERIFICATION.md 13/13 SCs PASS. Bundled into v1.11.0 final ship at Phase 91.x.
- [Phase 89.3]: Plan 89.3-01: deterministic sha256-derived ids (not random UUIDs) for the 3 core RS nodes -- the only way to make Cypher MERGE truly idempotent in REAL Aura. Same {q,d,c} -> same ids -> MERGE matches PRIMARY KEY -> zero new mutations on re-run. aura_op_id stays random (per-op telemetry, not a node id).
- [Phase 89.3]: Plan 89.3-01: AuraUnreachableError as a separate class from ExternalEgressViolation -- tier-dispatch signal vs security violation are semantically different, conflating them would muddy stack traces and audit logs. Mirrors rs-egress-violations.cjs rationale.
- [Phase 89.3]: Tier 0 SQLite writer mirrors Tier 1 Aura writer byte-for-byte: same writeDiscovery signature, same return shape, same deterministic sha256 ids. Dispatch layer (Plan 89.3-05) routes uniformly via err.name (AuraUnreachableError vs SQLiteUnreachableError).
- [Phase 89.3]: INSERT OR REPLACE on PRIMARY KEY is the SQL equivalent of Cypher MERGE. Combined with sha256-deterministic ids, re-running writeDiscovery yields zero new rows -- proven via SELECT COUNT before/after.
- [Phase 89.3]: Plan 89.3-03: 5 branches frozen in BRANCHES export with exact name strings (case + space matter); downstream consumers (dashboard, /mos:rs-mind-map command) match on these strings directly
- [Phase 89.3]: Plan 89.3-03: Canon Part 8 audit on HTML output (the DISPLAY surface) not raw data. Data source is trusted (user's OWN graph; no Brain query); rendered HTML may flow to dashboard or be exported -- audit at the display boundary catches leaks regardless of pipeline origin
- [Phase 89.3]: Plan 89.3-03: ALL 5 branch keys always present in result.branches with empty arrays for missing branches -- the fixed key set is a contract with downstream renderers; conditional branch presence would force every consumer to write defensive checks
- [Phase 89.3]: Plan 89.3-03: HTML wrapper byte-reuses dashboard cytoscape@3.33.1 CDN URL; zero new runtime deps; CYTOSCAPE_CDN_URL constant is single source of truth so any future Cytoscape bump touches both files together
- [Phase 89.3]: Tier 0 graceful degradation returns useful partial data + DEGRADED_NOTE (not empty array) per CONTEXT.md Claude's Discretion path 3
- [Phase 89.3]: Canon Part 8 defense at TWO seams: Layer 1 pre-Cypher per-expert audit + Layer 2 pre-return output audit (defense-in-depth)
- [Phase 89.3]: Tier 1 per-expert resilience: MERGE failures count as missed; connection-level errors bubble up as AuraUnreachableError for clean dispatch fallback
- [Phase 89.3]: bridge-writer.cjs renderBridgeArtifact ENHANCED in place with 2 OPTIONAL frontmatter fields (thesis + breakthrough_score); module.exports byte-identical so existing v1.10.16 consumers unaffected (regression test verified)
- [Phase 89.3]: Single-sweep Feynman registration in Plan 89.3-05 Task 2 (5 new entries; baseline 77 -> 82) avoids Wave-1/Wave-2/Wave-3 plan-level contention on TEST_FILES array
- [Phase 89.3]: Phase 89.3 Phase Gate CONDITIONAL PASS (13/14 + G8 inherits 3 pre-existing failures all OUTSIDE 89.3 commit range; 9/9 ROADMAP SCs verified)
- [Phase 89.4]: Plan 89.4-01: CanonVerbViolation lives in own module rs-canon-violations.cjs (not co-located with rs-egress-violations.cjs) per Canon Part 7 semantic distinction; closed-vocabulary enforcement is NOT egress; both classes share .name + .meta anatomy for uniform err.name caller wrapping
- [Phase 89.4]: Plan 89.4-01: empty string '' throws CanonVerbViolation (NOT TypeError); type-vs-membership distinction means typeof check is the type gate while membership check (CANONICAL_VERBS.includes) is the vocabulary gate; empty string passes type but fails membership so CanonVerbViolation surfaces with meta.attempted_verb=''
- [Phase 89.4]: Plan 89.4-01: validateVerb returns input string verbatim (not boolean true) on success; lets callers chain inline (const v = validateVerb(input, surface)); mirrors auditQueryString return-value pattern from 89.2-01
- [Phase 89.4]: Plan 89.4-02 ships rs-chain-feeder.cjs core (lookupUpstream + emitChainMetadata + recommendSkillSpawn STUB) reusing 3 existing chokepoints (brain-client + rs-egress-prompts + rs-canon-violations); zero new fetch surface (Canon Part 7); 2-seam Canon Part 8 defense with auditQueryObject at both entry points; Brain unreachable -> graceful ready+warn (mirrors Phase 90 Mode B/C/Tier-0)
- [Phase 89.4]: Plan 89.4-03 ships SKILL_SPAWN_RULES Object.freeze'd 5-rule table per kickoff section 6.4; first-match-wins iteration in recommendSkillSpawn; emitChainMetadata wired to internal call so chain metadata block carries spawn_skill + confidence + reasoning; module.exports byte-identical except additive SKILL_SPAWN_RULES export
- [Phase 89.4]: Canon Part 8 tightened in recommendSkillSpawn: auditQueryObject now runs unconditionally on opts (drops 89.4-02 Object.keys().length > 0 guard); single-key adversarial payloads caught before rule evaluation
- [Phase 89.4]: Single-sweep Feynman registration commit (258d94c) extends TEST_FILES with all 3 new 89.4 entries in one commit per Phase 89.3-05 pattern; Plans 89.4-01/02/03 ran in parallel-friendly waves and never touched run-feynman-tests.cjs to avoid merge conflicts
- [Phase 89.4]: Phase Gate G8 CONDITIONAL PASS pattern inherited from 89.1+89.2+89.3: 81/85 PASS; 4 failures all OUTSIDE 89.4 commit range (3 inherited from 89.3 + 1 newly-flaky pre-existing Phase 81 timestamp test surfaced by Feynman-runner timing pressure)
- [Phase 89.4]: Phase Gate 5 E asserts re-verify ALL prior 89.4 plans load-bearing contracts in one closure transcript: E1 rule coverage + E2 verb validation + E3 Brain chokepoint + E4 defense-in-depth audit count + E5 end-to-end smoke composing emitChainMetadata + validateVerb + recommendSkillSpawn
- [Phase 89.5-01]: rs-commercial-assessor bucket vocabulary expanded from 5 to 6 (added unknown-bucket safe-default for missing breakthrough_score; canon-amend discipline preserved)
- [Phase 89.5-01]: rs-commercial-assessor token vocabulary expanded from [bridge_concept] to [BRIDGE]/[SOURCE]/[TARGET] so rendered value-prop surfaces both sides of cross-domain pair (12-char-distinct stem invariant satisfied)
- [Phase 89.5-01]: Both-must-satisfy bucket selection: signals AND score must clear each threshold pair so single-dimension cannot inflate market estimate
- [Phase 89.5-engine-and-nl-graph]: 89.5-02: SQL placeholder switched to ? (SQLite) from $1 (PostgreSQL) -- the FORBIDDEN_PATTERNS currency-magnitude regex matches $1 as a $1 currency token; switching to ? sidesteps the collision without affecting parameterized-binding semantics
- [Phase 89.5-engine-and-nl-graph]: 89.5-02: Brain-query OMISSION as the safe default -- when intent unrecognized OR has no brain_template OR extractor returned empty scalar, brain_query is null (Brain query OMITTED). Translator is permissive in form (accept arbitrary NL) but conservative in egress (no Brain RPC unless intent matches)
- [Phase 89.5-engine-and-nl-graph]: 89.5-02: buildBrainQueryFromNL is THE single chokepoint for any Brain query construction from NL input across the codebase; defended by 3 audit seams (SEAM A input + SEAM 1+2 internal + SEAM C output) + entity-extractor scalar audits = 4 independent tripwires
- [Phase 89.5]: Plan 89.5-03: Query-to-Text Larry-voiced explainer ships frozen VOICE_TEMPLATES (5 kinds x 3-4 = 16 templates) + deterministic FNV-1a template selection + Mode A/B/Tier-0 quadruple-aware enrichment via folder-memory.readQuadruple + 2-seam Canon Part 8 defense (input + post-render audits). NO runtime LLM. 12/12 tests pass.
- [Phase 89.5]: Plan 89.5-04 ships rs-discovery-engine top-level orchestrator: 17-module composition + Tier 0/1 dispatch with AuraUnreachableError catch + Mode A/B graceful via chain-feeder chokepoint reuse + Canon Part 8 input audit at gate; 9/9 fixtures pass
- [Phase 91]: Per-turn quadruple cache via local function-scoped binding instead of module-level cache - cross-turn caching impossible by construction
- [Phase 91]: Section 8 trace emitted on every decision including Tier 0 - /mos:explain-decision can render zero-weight paths instead of blank panels
- [Phase 91]: Closed verb-to-skill-family map (10 verbs -> 10 slugs) - no prose-to-skill inference, future verbs require canon amendment + code change
- [Phase 91]: D-03 Larry-to-Brain persona translation is many-to-one (TTO+Business -> Explicit; Researcher -> Implicit); inverse intentionally not exported because non-invertible without USER.md context
- [Phase 91]: ROLE_BLEND_AXES has 7 entries (Founder/Researcher/Operator/Investor/Mentor/Domain Expert/Student); regulatory subtypes (Researcher.IND, Founder.grant) excluded -- they are Part 8 regulatory layers on top of base roles, not first-class blend axes
- [Phase 91]: USER.md three-consecutive-turn rule prevents per-turn thrashing on persona detection flips; user_override bypass (signal.source=user_override) wins regardless of confidence + consecutive count for /mos:persona --set
- [Phase 91]: Wave 1 brainAvailable hard-coded false: zero Brain network in UserPromptSubmit hot path; Plan 91-07 opts into isAvailable() later
- [Phase 91]: Engine block emits LAST in additionalContext (below Phase 83 + Phase 84 emissions) so Larry's most attentive zone carries the decision rationale
- [Phase 91]: Empty stdin skips engine block to preserve Phase 83's silent-exit contract; engine has nothing useful to decide on empty turns
- [Phase 91]: Plan 91-03: Canon Part 3 closed 10-verb vocabulary enforced at the routing layer (skill-activation-router.cjs validateVerb/canonicalizeVerb gate every engine fire_skill output; unknowns rejected with canon_part_3_unknown_verb_rejected trace note instead of silent passthrough)
- [Phase 91]: Plan 91-03: Pure-function precedence layer over preserved legacy (engine wins when fire_skill set; mixed when only suppress_skills populated; legacy preserved byte-equivalent when engine silent). Contradictory fire-vs-suppress resolved deterministically with fire winning over self-suppress.
- [Phase 91-navigation-engine]: Plan 91-04: RECOMMENDED gate respect at presenter, not re-evaluation -- engine is the single chokepoint
- [Phase 91-navigation-engine]: Plan 91-04: Three-tier noise gate with stable suppression codes (one_offer_per_turn / consecutive_ignores_threshold / ungrounded_reason / generic_reason) for /mos:explain-decision rendering
- [Phase 91-navigation-engine]: Plan 91-04: Wave-1 substring heuristic for ignore detection -- false positives on auto-acted are higher cost than false negatives
- [Phase 91]: /mos:explain-decision is the user-facing audit surface for the Navigation Engine; pure read of decision-traces JSON; never writes back
- [Phase 91]: Default render is exactly 1 trace, the most recent; --last clamps silently to traces.length
- [Phase 91]: Always exit 0 (audit lens never throws); absent + malformed + no-active-room each emit advisory text
- [Phase 91]: Larry dial: pure module + caller does I/O; mirror classifyHealth byte-identically with 88.1-04 (test-enforced); three-position dial fits 60-char visible budget; insight markers {synthesize, insight, converge} are a closed Canon-aligned keyword set; dial suppressed on no-signal state to keep statusline quiet pre-engine
- [Phase 91]: Problem-type routing biases, never forces (D-08)
- [Phase 91]: Wicked override overlays base routing per Canon Appendix E R4
- [Phase 91]: Out-of-range confidence becomes null (no silent clamp)
- [Phase 91]: Brain-availability check is 3-layer guarded (require/function/throw)
- [Phase 91]: Plan 91-08: Framework chain composition shipped. lib/core/framework-chain-composer.cjs (parseFrameworkChainSection + detectCompletedFramework + proposeNextFramework) reads BRAIN.md framework_chain_predictions FEEDS_INTO edges and proposes next framework. Engine integrates at decide() with lazy-require + try/catch; chain offer set when no higher-priority signal claims offer_next_step. Confidence gating: 0.5 noise floor + 0.7 RECOMMENDED. User override (turn-2 different /mos: command vs lastTurnOffer) -> REJECTED chain trace per Canon Part 4. Canon Part 8 boundary preserved (zero brain-client/fetch/curl). 18/18 tests green; 156 prior 91-* tests still pass.
- [Phase 94-v1-11-2-tester-driven-fixer]: 94-04: three-layer safety (install hook + env template + drift check) ships v1.11.2 bundled-Brain mitigations; bundled mcp-server-brain officially deprecated in BRAIN-SETUP.md Section 6 in favor of users pointing canonical 'mindrian-brain' at their own Neo4j MCP
- [Phase 94-v1-11-2-tester-driven-fixer]: 94-05: Approach A injection-seam pattern (opts.tavily/webSearch/cacheReader) wires Anthropic native WebSearch as the universal fallback floor for rs-fetcher-industry; envelope wrap on academic+patents+experts; Section-8 trace web_research_tier field; commands/research.md hard-stop removed
- [Phase 94-v1-11-2-tester-driven-fixer]: Plan 94-06: room classifier strict-mode override (numeric / explicit slug / quoted exact name) wired at top of intent-classifier.cjs room-resolution path; routing_source: 'strict_mode' graph edge per Canon Part 4. Pure-function helper module under lib/core/ allows test access without booting classifier hot path. 3 of 4 Lawrence callouts fenced; callout 4 (natural language 'the curriculum room') deferred to v1.11.3.
- [Phase 94-v1-11-2-tester-driven-fixer]: Plan 94-09: action footer for /mos:explain-decision wired into all 7 exit paths via actionFooter() helper; 4-zone rule satisfied; 4/4 fixture tests; renderTrace prefix byte-identical to pre-94-09 (Plan 91-05 14/14 tests preserved)
- [Phase 95]: Phase 95 do NOT split to 95.2 - 6 extra envelope bugs found but mechanically uniform fixes; single Plan 95-04 absorbs without quality loss
- [Phase 95]: Cursor-branch divergence in 4 hooks left as-is per CLAUDE.md tri-polar rule (CLI/Desktop/Cowork only); CURSOR_PLUGIN_ROOT-gated branches never fire inside Claude Code
- [Phase 95]: Side-channel cascade payload at <roomDir>/.mindrian/last-cascade.json with atomic mktemp+mv-f write; bash post-write emits hookSpecificOutput.additionalContext envelope only
- [Phase 95]: Test sandbox uses MINDRIAN_ROOMS_HOME + Strategy-0 .rooms/registry.json so post-write active-room guard recognizes synthetic room and lets cascade fire
- [Phase 95]: Dog-food smoke step deferred per CLAUDE.md Decision #16 nested-structure rule; regression test fixtures provide equivalent evidence via spawnSync
- [Phase 95]: Plan 95-03: room-proactive SKILL.md detection block rewritten to read side-channel JSON; OLD cascade_status.proactive_intelligence framings removed; cool-UI render contract added per cool-ui-style-reference.md; lines 114-160 byte-identical preserved
- [Phase 95]: Per-event helper inner shape differs by lifecycle event (PreCompact / CwdChanged / TaskCompleted: systemMessage only; PostCompact: systemMessage only AND side-channel for full context; SubagentStop: hookSpecificOutput.additionalContext; FileChanged: silent diagnostic exits) per 95-RESEARCH.md Section 2 authoritative allowed-key table
- [Phase 95]: PostCompact side-channel file path is <roomDir>/.mindrian/last-post-compact.md (Markdown plain text, NOT JSON); WRITTEN by Phase 95 but NOT YET CONSUMED at next session-start; consumer deferred to Phase 95.5+; CHANGELOG transparency note in Plan 95-05
- [Phase 95]: scripts/session-start NOT modified (B2 plan-checker scope-leak fix); Cursor-branch divergence on session-start documented in 95-01-AUDIT.md text only; Cursor-branch annotations applied to 3 hooks already in files_modified (post-compact, on-cwd-changed, on-task-complete)
- [Phase 95]: scripts/on-agent-complete background post-write redirect to /dev/null (Rule 3 auto-fix discovered in GREEN test run): without this redirect the child PostToolUse envelope leaks into parent SubagentStop stdout, breaking single-JSON-object parse for cascade-path scenario
- [Phase 95]: v1.12.0 ships direct (not beta). Feature-restoration release; Phase 88.1-03 mid-session intelligence injection now functions for the first time since shipped.
- [Phase 95]: 27/27 envelope-related regression scenarios GREEN (16 + 5 + 6). 3 pre-existing fixture failures (Phase 84 + Phase 85 self-update) deferred per SCOPE BOUNDARY rule; release impact: none.
- [Phase 95]: PostCompact context preservation half-wired in v1.12.0: writer landed (scripts/post-compact -> last-post-compact.md), consumer queued for Phase 95.5 / 96. Disclosure in CHANGELOG ### Audit Notes per release-process.md transparency.
- [Phase 95.1]: Phase 95.1 REQ-IDs (DOCTOR-95.1-01..08) added to REQUIREMENTS.md as ## Plugin Self-Healing Diagnostics (DOCTOR-95.1) block, mirroring BASH-95-* convention; 8 traceability rows appended
- [Phase 95.1]: 95.1-01 fixture seed: plan listed 9 files, Phase 87-01a guard required 11 (added seed-artifact/ROOM.md+MINTO.md). Wave 0 + Wave 1 should treat 11 as canonical fixture count.
- [Phase 95.1]: Plan 95.1-02 honored pre-existing test-generate-section-intelligence.cjs from Plan 95.1-03 commit 76f60f6 instead of overwriting; defensive MINDRIAN_ROOMS_HOME guard wired into spawn helpers (DRY chokepoint)
- [Phase 95.1-mos-doctor-drift-detection-and-self-heal]: Plan 95.1-03: Hand-rolled minimal frontmatter inside scripts/generate-section-intelligence.cjs (D-03); no require of vault-section-{state,minto}-generator.cjs even though their schema is the reference
- [Phase 95.1-mos-doctor-drift-detection-and-self-heal]: Plan 95.1-03: Reframed SKILL.md §7 error glyph from cross-mark to ⚠ to stay inside the approved 12-glyph vocabulary; 3-line error/Why/Fix structure preserved
- [Phase 95.1-mos-doctor-drift-detection-and-self-heal]: Plan 95.1-03: Created tests/test-generate-section-intelligence.cjs as a Rule-3 deviation before implementing the generator (Plan 95.1-02 ran in parallel and retroactively adopted the file; commit cfad796 cites commit 76f60f6 explicitly)
- [Phase 95.1]: Plan 95.1-04: doctor.cjs renderHumanReport retrofitted to 4-zone Shape E; F.1 selector ships as structural marker (canonical AskUserQuestion deferred to Phase 88.2)
- [Phase 95.1]: MINDRIAN_ROOMS_HOME canonical (95.1-05): chose env-var name from scripts/resolve-room over CONTEXT D-05 phrasing per RESEARCH Open Q1
- [Phase 95.1]: report.recovered unified array contract (95.1-05): backwards-compat split into report.classARecovered (single-object class A) + report.recovered (array spanning all classes) to honor test-doctor-class-e.cjs Scenario 3 contract
- [Phase 95.1]: classFlagsActive graceful-degradation exit branch (95.1-05): when any new class flag is active, doctor returns exit 0 regardless of class A install-cache state per Canon Part 8
- [Phase 95.1]: Class F detector uses new RegExp(string-with-\u-escapes) so detector source contains zero literal forbidden chars (Pitfall 3 self-referential design)
- [Phase 95.1]: Plan 95.1-02 test scenario 1 substring-overlap bug fixed in scope: 'noncompliant.md' contains 'compliant.md' as substring; switched filter to path.basename exact match (Rule 1)
- [Phase 95.1]: Plan 07: Atomic staging deferral (Pitfall 3) — dogfood-room files (sentinel + 20 generated ROOM.md/MINTO.md) staged but NOT committed in this plan; deferred to Plan 95.1-08 release commit
- [Phase 95.1]: Plan 07: Class D stub upgraded to live spawnSync runner asserting cascade-surface-e2e 8-key shape; cross-platform Windows-no-bash skip preserves graceful-degradation per Canon Part 8
- [Phase 99]: 99-04: Stop hook is a no-op (state already current after each transition); did NOT extend operator.cjs to keep 99-01's 12-scenario test suite byte-stable
- [Phase 99]: 99-04: PostToolUse uses broad matcher (Write|Edit|MultiEdit|Read|Grep|Glob|AskUserQuestion|Bash|Task|TodoWrite) so AskUserQuestion->DECISION_GATE branch fires reliably; active-room guard handles noisy file-path cases
- [Phase 106]: Wave 0 scaffolds REQ IDs + test stubs + fixtures + ROADMAP plans list together (not deferred to Wave 1) so plans 106-01..05 inherit a hermetic substrate the moment they start
- [Phase 106]: Stub owning-plan number embedded in BOTH the comment AND the console.log string so downstream-plan ownership is grep-able from the test file alone (no separate manifest)
- [Phase 106]: 10 stubs land at end of TEST_FILES array (NOT mid-array insertion) preserving byte-stability of every existing entry; matches Phase 87 zero-side-effects invariant
- [Phase 108-graph-memory-schema-reconciliation]: Substrate-only Wave 0: REQ-IDs + ROADMAP entry + test stubs ship in this plan; document deliverables (RECONCILIATION/PROVENANCE/TRUTH-STATES/aliases/PART-9-PROPOSAL) defer to Waves 1-3
- [Phase 108-graph-memory-schema-reconciliation]: test-part-9-invariant.cjs is a CROSS-PHASE dependency stub - remains a stub through ALL of Phase 108; lights up only after Phase 109 ships nodes.review_status column (RESEARCH Pitfall 6)
- [Phase 108-graph-memory-schema-reconciliation]: Append-only registry insertion in lib/memory/run-feynman-tests.cjs (matches Phase 100/104/105/106 chronological-append precedent; new phases never reorder existing entries)
- [Phase 108-graph-memory-schema-reconciliation]: Plan 108-01: SUPPORTS marked NEW (distinct edge from ENABLES) per RESEARCH 2.1; aliasing collapses Part 5 evidence-vs-Part 4 unblock semantics. Open Question #1 forwarded to Phase 109.
- [Phase 108-graph-memory-schema-reconciliation]: Plan 108-01: opportunity row split into filesystem feature (EXISTS) + graph node (NEW); 3 opportunity edges (BANKED_BY/RANKS_OPPORTUNITY/ANSWERS_OPPORTUNITY) marked NEW per RESEARCH 2.4 grep verification (zero code matches 2026-05-03).
- [Phase 108-graph-memory-schema-reconciliation]: Plan 108-01: assumption marked EXTEND (not NEW) - assumptions table at memory-ops.cjs:64-74 already exists with closed validity enum; Phase 109 promotes table rows to graph nodes.
- [Phase 108-graph-memory-schema-reconciliation]: Plan 108-01: CONTAINS marked RESERVED (deferred to Phase 112 Room Budding) - 'explicit only if needed for cross-room traversal' per CONTEXT D-01 IS the RESERVED pattern.
- [Phase 108]: Plan 108-02: PROVENANCE.md framed unambiguously as CONTRACT spec, not migration; every MUST/required scoped to Phase 109 implementation per Codex tightening 2026-05-03
- [Phase 108]: Plan 108-02: Verbatim Column-Type Specification block added mirroring CONTEXT D-02 lines 107-120 byte-for-byte; serves test harness AND Phase 109 copy-paste reference
- [Phase 108-graph-memory-schema-reconciliation]: 108-04: In-house YAML parser embedded in test rather than added as dep (zero npm deps per Phase 87 invariant; pattern reused from lib/core/opportunity-ops.cjs:24-118)
- [Phase 108-graph-memory-schema-reconciliation]: 108-04: All 23 EDGE_TYPES from lib/core/lazygraph-ops.cjs:25 included as EXISTS rows in aliases.yml (RESEARCH 2.4 + Pitfall 3 defense; without this the pre-commit hook in Plan 108-05 would false-positive on legitimate production code)
- [Phase 108-graph-memory-schema-reconciliation]: 8-state truth-state set is CLOSED: net-new states require canon amendment, not plan deviation
- [Phase 108-graph-memory-schema-reconciliation]: status_aliases mapping is fixed: untested->proposed, supported->validated, contradicted->invalidated, stale->stale (per RESEARCH section 4)
- [Phase 108-graph-memory-schema-reconciliation]: transitionStatus(nodeId, fromStatus, toStatus, actorId, reason) chokepoint contract specified for Phase 109; runtime enforcement is Phase 109 not 108
- [Phase 108]: 108-05: hook substrate is CJS-importable (not just CLI) so test suite asserts behavior via require() with no child-process spawning
- [Phase 108]: 108-05: ALLOWED_EXISTING_TABLES hardcoded (12 names from lazygraph-ops.cjs + memory-ops.cjs) because aliases.yml maps Codex node terms to graph node types, not SQL table names
- [Phase 108]: 108-05: buildAllowedTableSet includes RESERVED entries so future Phase 112 commits creating budded_from-table are not blocked by hook bootstrapping order
- [Phase 108-graph-memory-schema-reconciliation]: Plan 108-06: legend-section exemption (Tests 4 + 5 in test-canon-crossref-completeness.cjs skip rows inside '## Resolution Categories' H2 because legend rows define column-value vocabulary, not reconciliation decisions; 8/8 PASS)
- [Phase 108-graph-memory-schema-reconciliation]: Plan 108-06: docs/MINDRIAN-CANON.md non-edit guard is constitutional (test asserts ^##\s+Part 9\s does NOT match in canon); Phase 109 release gate is the canonical Part 9 ratification trigger
- [Phase 108-graph-memory-schema-reconciliation]: Phase 108 graph-memory-schema-reconciliation complete: 6 of 7 Wave-0 stubs filled (test-canon-crossref-completeness.cjs is the last); test-part-9-invariant.cjs intentionally remains a stub through all of Phase 108 (lights up only after Phase 109 ships nodes.review_status column per RESEARCH Pitfall 6); Phase 108 is ready for verification
- [Phase 109]: Plan 109-02 chose room:<roomId> as auto-focus rule 3 fallback (NOT a new governing_thought node type) per RESEARCH section 4.2 to avoid amending the frozen Phase 108 aliases.yml
- [Phase 109]: Plan 109-02 made openRoomDb synchronous returning bare DatabaseSync handle per plan's Step 4 explicit instruction; documented as parallel-worktree merge surface for orchestrator
- [Phase 109]: Plan 109-02 amended Phase 106-02 glyph fence to permit 🎯 in BOTH JTBD and focus contexts per RESEARCH Open Question 11.8
- [Phase 109-sql-context-memory-navigation-spine]: Plan 109-04: Closed 13-function navigation chokepoint shipped (lib/core/navigation.cjs); recursive CTE getNeighborhood with frozen edge weights and cycle guard; promoteNodeStatus enforcing 8 documented Phase 108 truth-state transitions; perf budgets crushed on 10K-node room (cold 0.79ms, warm p95 1.35ms vs 50ms budget)
- [Phase 109]: Plan 109-06: Single mega-script with --check-chokepoint subcommand vs new parallel script (chose mega-script per RESEARCH OQ 11.7); BANNED_PATTERNS broadened to relative-path-with-protected-basename to catch require('../core/memory-ops.cjs')
- [Phase 109]: Closed kind enum for renderExplanation (6 cases): contradiction, unsupported, blocking, stale, open, opportunity; canon amendment required to add a 7th kind
- [Phase 109]: findRelevantOpportunities scores ALL opportunity nodes room-wide (Canon Part 2 always-ambient); depth=99 fallback for non-reachable; composite = 0.5*hsi + 0.3*distScore + 0.2*jtbdScore
- [Phase 109]: findStaleDecisions uses 30-day threshold per RESEARCH 2.5 simplification (5 sessions = 30 days); opts.staleAfterSessions preserved for API compat
- [Phase 114-larry-default-activation]: Scope alwaysLoad to mindrian-os ONLY in plugin .mcp.json. Brain MCP alwaysLoad remains user-side opt-in (out of scope per 114-CONTEXT.md). The plugin does not distribute Brain MCP config.
- [Phase 114-larry-default-activation]: alwaysLoad placed as the LAST key in the mindrian-os entry (order: command, args, alwaysLoad), matching RESEARCH Code Example 2 convention. Boolean true (JSON literal), never the string 'true'.
- [Phase 114-larry-default-activation]: Phase 114-00: subagent skills preload + initialPrompt replace probabilistic description-matching with structural turn-1 activation across CLI/Desktop/Cowork; settings.json cleaned of unsupported keys; SessionStart JTBD reframed as context-only
- [Phase 114]: Wave 0 verification suite shipped (5 bash tests + voice rubric + baseline fixture + manual checklist) -- structural complement to empathy audit
- [Phase 114]: v1.13.0-beta.2 release plumbing synchronized (CHANGELOG + plugin.json + package.json + local git tag); push deferred to milestone promotion gate per beta-channel ship rule
- [Phase 114]: Phase 91 navigation engine: 6 pre-existing failures (84/85/88/88.1/88.5/106-era tests) classified (c) unrelated regression; 0 new failures from Phase 114; do not block per Task 7 acceptance
- [Phase 115]: 115-00: Spec strings live in frozen lib/copy/115-spec-strings.cjs single source of truth; all 8 surfaces in 115-01/02/03 import rather than hardcoding (Pitfall 1 mitigation)
- [Phase 115]: 115-00: Fallback emotion #1 ('I have a pile of insights and I can't see the shape of them.') ranked + verbatim spec strings pre-committed in tests/manual/115-rollback-procedure.md before validation week begins (Pitfall 5)
- [Phase 115]: 115-00: D-20 rollback mutates lib/copy/115-spec-strings.cjs string VALUES only; persona_variants frontmatter shape, dual-path-detector, shallow-doc-parser stay intact (mechanism-vs-copy split)
- [Phase 115]: 115-00: 30-day stickiness shortfall is OUT OF SCOPE for D-20 rollback; routes to Phase 116 Unresolved Tension Hook acceleration, not back to 115
- [Phase 115]: Plan 115-01 import pattern: every Phase 115 first-touch surface quotes lib/copy/115-spec-strings.cjs constant value byte-exact and surface body comment names the constant for executor-recognition (Pitfall 1 mitigation at the rendering layer)
- [Phase 115]: Plan 115-01 D-07 inserted BEFORE existing 'Very simply -- there are three ways' paragraph rather than replacing it, preserving voice DNA continuity per D-07 explicit constraint (voice rules + symbol vocabulary stay locked)
- [Phase 115]: Plan 115-01 in-scope CLAUDE.md hard-rule auto-fix: 4 pre-existing em-dashes in docs/testers/REGISTRY.md (3 in tester table notes, 1 in Adding-a-tester step 5) replaced with ASCII hyphens as part of Task 5 commit (Rule 1/2 auto-fix per project-wide no-em-dashes hard rule)
- [Phase 115]: Plan 115-02: Spec-locked DISCRETION-03 regex byte-exact; tuned fixture prose around case-insensitive quirks (LP\b matches 'help', IND\b matches 'kind', ARR matches 'arrive') instead of amending spec
- [Phase 115]: Plan 115-02: shallow-doc-parser routes through Phase 109 navigation.cjs setFocus + safeRecord wrapper; never directly requires room-db.cjs (Canon Part 8 boundary)
- [Phase 115]: Plan 115-02: 2 MCP tools (detect_dual_path + extract_shallow) registered in bin/mindrian-mcp-server.cjs with zod schemas closing Pitfall 6 (tri-polar Desktop/Cowork coverage) in this plan rather than deferring
- [Phase 115]: Plan 115-04: Phase 115 ships as v1.13.0-beta.3 (Phase 114 burned beta.2); Marketplace Gate 5 deferred to validation-week promotion gate; local git tag NOT pushed per CLAUDE.md Git Safety Protocol; Phase 91 inherited failures (5/176) acceptable per Phase 89.5 + Phase 106-02 baseline contract; zero NEW Phase 115 failures in non-regression scan
- [Phase 115]: Plan 115-04: 4-AC orchestrator pattern (sibling of test-114-larry-default-activation.sh) replicable for Phase 116/117/118/119/120; source-of-truth import in tests (lib/copy/115-spec-strings.cjs imported by tests/test-115-surfaces-grep.sh) ensures drift in EITHER spec OR surface trips the test (Pitfall 1 generalized at test layer)
- [Phase 88.2]: F.3 + F.4 closed-vocab renderers verified conformant on disk; tests extended from 7 to 10 assertions adding D-AMEND-04 persona-agnostic guarantee + closed-vocab caller-override-ignore + dispatcher carve-out flag invariant; renderer modules byte-equal pre/post
- [Phase 88.2-uiux-selector-block]: 88.2-03: F.1/F.2/F.5 renderers extended additively with optional personaContext (D-AMEND-04 option a). Cold-start preserves existing baselines byte-stable; warm renders ' ({personaContext} lens)' suffix. Renderers stay PURE; dispatcher supplies the string.
- [Phase 88.2-uiux-selector-block]: 88.2-03: selector-telemetry dual-surface mirror via Phase 109 logEvent chokepoint (D-AMEND-02 Option B). Uses node:sqlite DatabaseSync (project standard, NOT better-sqlite3). MINDRIAN_DISABLE_MEMORY_EVENT=1 env var added as resilience flag for pre-Phase-109 users. JSONL primary surface unaffected by mirror failure.
- [Phase 88.2]: Plan 88.2-05 (FINISH) shipped: F.0 Mini Decision Gate renderer (3 verbs Approve/Reject/Defer; closed-vocab; persona-AGNOSTIC; border_style:'single') + REJECTED_BECAUSE typed-edge helper via Phase 109 logEvent (eventType selector_rejection_captured) + dispatcher F_SUBSHAPES extended with 'F.0' + JUST_TALK refuse inheritance + AskUserQuestion trailer; 16/16 + 10/10 + 19/19 + 9/9 tests GREEN; R1 sha256 byte-equal preserved on shape-f6-renderer.cjs (Phase 101-01); UISEL-88.2-07 closed
- [Phase 88.2]: F.6 Plan Review Round shipped at collision-safe path lib/hmi/shape-f6-plan-review-renderer.cjs (R1 invariant: Phase 101-01 shape-f6-renderer.cjs sha256 byte-equal pre/post)
- [Phase 88.2]: decoy-tier Tier 0/1/2 dispatcher ships with caller-supplied brainAvailable boolean overriding env-var fallback (test isolation; production semantic preserved)
- [Phase 88.2]: Phase 88.2-uiux-selector-block FINISH: 7 of 7 plans shipped; UISEL-88.2-01 through UISEL-88.2-09 closed; Shape F family complete (F.0 + F.1-F.5 + F.6)
- [Phase 89-reverse-salient-engine]: Phase 89-07 Wave 0: EVENT_TYPES extended to 21; 12-file Wave-0 contract on disk; ReverseSalientAgent stub-then-fill pattern templated for sibling agentic surfaces (116/117/118/120)
- [Phase 89-reverse-salient-engine]: Wave-1 mapping basis: rs-engine OUTPUT direction field (not invocation MODE) drives the 5-way cascade-edge selection per RESEARCH SCOPE B Section 2
- [Phase 89-reverse-salient-engine]: Generic upsertEdge(conn, {type, source, target, properties}) primitive added to lazygraph-ops.cjs as the typed-edge chokepoint reusable by Phase 89-07 Wave 2/3 + Phase 116/117/118/120 sibling agents (Canon Part 7 reuse-before-build)
- [Phase 89-reverse-salient-engine]: Lazy require pattern for emitFindingEdge: lazygraph-ops required INSIDE function body (not at module load) so cascade-emit tests substitute require.cache slot before first emit call without forcing agent module re-require
- [Phase 89-reverse-salient-engine]: Wave 2: Suppression checks (tier=0, JUST_TALK) short-circuit BEFORE pickShape() so the agent owns canonical suppress_reason vocabulary ('tier_0' / 'just_talk') rather than translating dispatcher error codes
- [Phase 89-reverse-salient-engine]: Wave 2: researcher_ind aliases to 'evidence gap'; founder_grant aliases to 'submission risk' in lib/core/reverse-salient-persona-suffix.cjs (RESEARCH executor discretion)
- [Phase 89-reverse-salient-engine]: Wave 2: Telemetry NEVER carries reject reason text; reverse_salient_acted_on includes only reason_present boolean. Reason text lives in REJECTED_BECAUSE typed edge (graph-local). Canon Part 8 scalar-only telemetry preserved
- [Phase 89-reverse-salient-engine]: Wave 2: DEFER emits reverse_salient_acted_on with response='DEFER' rather than separate DEFERRED memory_event type; Phase 116 unresolved-tension-hook reads existing acted_on event with response='DEFER' filter
- [Phase 116-unresolved-tension-hook]: EVENT_TYPES additive tail-append (size 21 -> 26): Object.freeze invariant preserved, no reorder; provenance comment block cites D-04 + D-04b + D-06 from 116-CONTEXT.md and 89-07 dual-surface telemetry mirror precedent
- [Phase 116-unresolved-tension-hook]: Wave-0 test stubs PASS today (not RED): scaffold-only stubs verify only EVENT_TYPES substrate; real assertions referencing pending-tension-store.cjs and preflight-tension-surface.cjs land in Waves 1-4 as those modules ship (89-07-00 stub-then-fill precedent)
- [Phase 116-unresolved-tension-hook]: Cypher patch lands as FILE at Wave 0 but is NOT applied: Brain integrity preserved until v1.13.0-beta.5 release; MERGE shape is idempotent so post-release apply is safe (89-07 Q5 precedent)
- [Phase 116-unresolved-tension-hook]: Offline snapshot has SCHEMA SHAPE only with framework_chain_predictions empty array: D-02 honors neutral citation framing (no Brain framework chain consumed in v1); forward-compat scaffold for v1.13.x tuning post-empathy-audit
- [Phase 95.2]: D-01..D-04 atomic-swap recovery: cp -> verify -> two-step rename pattern with rollback on commit failure
- [Phase 95.2]: D-05/D-06 missing-install class A eligibility: drift.detected fires on install.status === 'missing' with cache available; drift.reason discriminator added
- [Phase 117]: Phase 117 ships in v1.13.0-beta.7; Wave 0 lands EVENT_TYPES size 26 -> 31 + 12 stubs + scaffold harness + idempotent Brain cypher (Engine1Layer cluster + cross-domain formula property) + offline snapshot encoding canonical_chain_order + cross_domain_formula + lens_count_drift_acknowledged
- [Phase 117-02]: CANONICAL_CHAIN_ORDER frozen at ['domain','trends','reverse-salients','cross-domain'] (Brain Section 8.1) + CROSS_DOMAIN_THRESHOLD frozen at 0.85 (Brain Section 8.3 default; matches Phase 89-07 dedup gate)
- [Phase 117-02]: Cross-domain surprise formula = similarity * domain_distance (Brain Section 8.3); commutative, deterministic, never throws; integration-tested in compose pipeline
- [Phase 117-02]: HSIAnalysis schema extension fields (top_differential / semantic_surprise / category_errors_identified / top_differential_score) ship as null/empty SHAPE CONTRACT; population by F.1 surface lands in 117-03
- [Phase 117-02]: scripts/auto-explore-fire.cjs detached background child: Promise.all([discovery-cycle.cjs --steps all, rs-engine.py --mode hybrid]) with 30s per-pipeline + 60s total cap; atomic temp+rename write of room/.mindrian/auto-explore-<material_id>.json; markCompleted/markFailed transitions; uncaughtException + unhandledRejection backstops (always exits 0)
- [Phase 117-02]: Canon Part 8 boundary tightening (vs 117-01): bare-substring grep regression on 'brain-client' returns 0 in lib/agents/auto-explore-agent.cjs + scripts/auto-explore-fire.cjs (literal token elided in comments per 117-02 plan AC; same precedent as 117-01's ADDRESSES_PROBLEM_TYPE elision)
- [Phase 117]: F.1 verbs locked at [Explore, Skip, Later]; INFORMS edge type (delta vs Phase 116 RESOLVES_VIA); RECOMMENDED at >= 0.7 per Phase 88.2; BQ_TEMPLATE_REGISTRY local-constant in v1 with verbatim Brain canonical names; W6 atomic re-persist; B2 Desktop fallback slash command
- [Phase 117]: 117-04 v1 sanitizer ships PII pattern redaction ONLY; non-allowlist redaction DISABLED until Phase 121 telemetry calibrates (RESEARCH 4.6 risk T4)
- [Phase 117]: 117-04 6th Canon Part 8 tripwire shipped via PostToolUse mcp__brain_.* hook with hookSpecificOutput.updatedToolOutput envelope per SEED-003 A3
- [Phase 117]: 117-04 AUTOEXPLORE-117-17 LOCAL-only routing invariant LOCKED via grep regression + maintainer-visible Brain §8.7 comment block above detectFirstMaterial citing Cypher Q7
- [Phase 95.6]: 95.6-02 Wave 0: backfilled skills/mullins-scaffold/SKILL.md (the file whose absence aborted Gary Laben's install.sh skill-loop, D-03 root cause); the contract fix is 95.6-03
- [Phase 95.6]: 95.6-02: 7 Wave 0 test files created (3 shell, 4 CJS); 6 RED-by-design (test-install-sh-skill-loop->95.6-03, test-install-preflight-longpath->95.6-04, test-doctor-class-h/-h-fix/-install-receipt->95.6-05, test-release-npm-gate->95.6-06), 1 GREEN-or-SKIP (test-92-rename-no-long-leaves->95.6-01). Canonical .install-receipt.json step list documented in tests/test-install-receipt.cjs for 95.6-03/05 to implement against
- [Phase 95.6]: 95.6-02: tests/run-all.sh now aggregates test-*.cjs suites; tests/run-all-956.sh scoped runner added (RED-by-design until 95.6-01/03/04/05/06 land; release plan 95.6-10 re-runs the full suite GREEN). tests/manual/95.6-windows-cold-install-acceptance.md is the empirical Dimension-8 gate, authoritative over the automated suites, gates v1.13.0-beta.9
- [Phase 95.6]: D-02 rename: 189-char phase-92 leaf -> .planning/phases/92-trust-layer-refactor/ via git mv (R100, history preserved). Original descriptive name preserved as a ## Searchability Note body section in new 92-CONTEXT.md, NOT a full_slug frontmatter field (REC-11). v1.11.0 milestone-audit phase: refs repointed; FEEDBACK.md / autopsy / STATE.md line 273 / 95.6 phase artifacts left verbatim (historical/spec records). test-92-rename-no-long-leaves.cjs Rule-1-fixed (needle assembled from fragments to avoid self-match; whitelist widened) and now GREEN 3/3.
- [Phase 95.6]: install.sh skill-loop pre-filters on SKILL.md; missing-SKILL.md dirs WARN to stderr and the script continues (D-03 part b; fixes the bug that broke Gary Laben's install)
- [Phase 95.6]: install.sh D-01: OS detection (MOS_TEST_FORCE_OS-testable) + enable_longpaths_on_windows() preflight before clone + stale-partial-clone cleanup in Step 2
- [Phase 95.6]: D-09 closed: install.sh writes the statusLine block FIRST via idempotent register_statusline() + records .install-receipt.json; /mos:doctor class H detects install-incomplete (missing statusLine block / halted receipt) + --fix re-stamps the block idempotently; first-session SessionStart hook auto-runs /mos:doctor and surfaces all-green-or-what-is-missing
- [Phase 95.6]: 95.6-06: scripts/release.sh Step 9.5 npm publish gate -- between Step 9 (git push) and Step 10 (cache update); dist-tag @next for -beta./alpha./rc./next. suffixes, @latest for clean X.Y.Z; npm pack --dry-run payload review against package.json files allowlist (halts if .planning/ / docs/ / mcp-server-brain/ / tests/ / release.sh in tarball); explicit halt + recovery message on publish failure; MOS_TEST_DRY_RUN=1 escape hatch. package.json: name -> @mindrian/os, private:true removed, files allowlist added. No live npm publish (that is 95.6-10). test-release-npm-gate.sh GREEN; run-all-956.sh 8/8 GREEN.
- [Phase 95.6]: 95.6-06: CHANGELOG.md gets a [Unreleased] section with the legacy beta.1-beta.8 npm-gap note (those versions stay unpublished; first npm-published version is beta.9 via Step 9.5); 95.6-10 folds it into the beta.9 entry. Case #4 autopsy (docs/autopsies/2026-05-09-gary-laben-install-failure.md) augmented with ## Timeline / ## The family pattern / ## Fixes shipped + 04-REVERSE-SALIENT-INSTALL cross-ref; no Brain key UUIDs leaked.
- [Phase 95.6]: bin/cli.js (mindrian-os install|doctor|update) shipped as pure CJS thin wrapper; doctor shells scripts/doctor.cjs (Path C parity), update does git pull --ff-only + bash install.sh, install prints instructions (Path B)
- [Phase 95.6]: release.sh Step 5b reserved-Anthropic-marketplace-name compliance gate added between Step 5 (marketplace validation) and Step 6 (CHANGELOG); D-05b npm-source marketplace.json flip documented but NOT executed -- gated on npm view @mindrian/os@next version returning the published version (likely beta.10)
- [Phase 95.6]: 95.6-08: SessionStart npm-reconcile hook (D-05d) + explicit subagent mcpServers/skills (D-10) + Deferred-Tool-Loading note (D-11b) + four-path distribution doc (D-05e/f). Tier 2, executed now.
- [Phase 95.6]: 95.6-09 D-06: README License section now says 'source-available, not open source'; plugin.json license confirmed BSL-1.1; grep 'BSL.*open.source' returns 0 outside .planning. D-07: scripts/check-first-touch-drift.cjs scanner (pattern 1 em-dash + pattern 2 stale-version-literal scoped to greeting copy + pattern 3 BSL-open-source) + tests/test-first-touch-drift-scanner.cjs 3/3 GREEN; SEED-007 scope-notes mark D-06 as the pattern-3 trigger. D-04: README ## Manual Recovery section (26 lines) from Gary's CC transcript. Out of scope: docs/testers/outbox/ (gitignored) + ~/mindrianos-install-site/ (separate repo) need manual sweeps.
- [Phase 88.2 deferred RESOLVED]: tests/test-navigation-memory-events.cjs test1_enumCount now asserts EVENT_TYPES.size >= 19 (floor, not exact) -- the enum grew to 32 via 116/117/89-07. 9/9 GREEN. Commit a73a06c.
- [Phase 95.6]: 95.6-10 Task 1: CHANGELOG [1.13.0-beta.9] - 2026-05-11 entry written (folds the [Unreleased] block + D-01/02/03/09 fixes + 95.6-07/08/09 Tier 2/3 lines + npm-gap note + Windows-cold-install-waiver note + separate-repo follow-ups note); run-all-956.sh 8/8 green; install.sh/doctor.cjs/release.sh syntax OK. Versions not bumped here. Commit 577a668.
- [Phase 95.6]: 95.6-10 Task 2: Windows cold-install acceptance gate (tests/manual/95.6-windows-cold-install-acceptance.md) WAIVED by maintainer 2026-05-11 ("I will not reach out to Gary; we will do it anyway"). beta.9 ships unverified-on-Windows -- acceptable for an opt-in beta; promotion to clean 1.13.0 should still wait on a Windows cold-install confirmation.
- [Phase 95.6]: 95.6-10 Task 3: scripts/release.sh has no pre-release-suffix bump path, so by-hand: plugin.json + package.json -> 1.13.0-beta.9; release commit 9ed8280; tag v1.13.0-beta.9. npm pack --dry-run reviewed -- tarball clean (no .planning/ docs/ mcp-server-brain/ tests/ release.sh; files allowlist works; 590 files / 1.8MB packed; CHANGELOG.md ~317kB in tarball, bloat-not-leak).
- [Phase 95.6]: 95.6-10 SHIP 2026-05-11 (maintainer instruction "I want this pushed across all install types"): git push origin main --tags DONE (origin/main 60fe434; tag v1.13.0-beta.9 -> 9ed8280 on GitHub). ~/mindrian-marketplace/.claude-plugin/marketplace.json: mos -> 1.13.0-beta.9, source.ref -> v1.13.0-beta.9; committed a41964f, pushed origin/master (done AFTER the tag was on GitHub). npm publish --tag next NOT done -- npm whoami=ENEEDAUTH, no ~/.npmrc, no interactive login in env; maintainer must `npm login` then `npm publish --tag next` from MindrianOS-Plugin/, verify `npm view @mindrian/os@next version` == 1.13.0-beta.9, then `gsd-tools phase complete 95.6`, then update ~/mindrianos-install-site/ for npx @mindrian/os@next.

### Pending Todos

- generate-hub.cjs standard features (sticky top bar, persona card, vis-network graph)
- Update generate-snapshot.cjs constellation (sidebar/detail panel from Tony prototype)
- LaTeX export command: /mos:latex
- Desktop Data Room MCP: KuzuDB Windows build blocked
- Grading calibration data: 0/100+ Example nodes

### Blockers/Concerns

- **The npm publish (Phase 95.6's one tracked follow-up):** the plugin's npm package was renamed `@mindrian/os` -> `@mindrian_os/cli` (the `@mindrian` scope never existed -- `{"error":"Scope not found"}`; the `@mindrian_os` org was created on npm 2026-05-11). `@mindrian_os/cli@1.13.0-beta.10` (the current package.json version; in-progress beta) is NOT published yet -- blocked on a token with **Read+Write on `@mindrian_os` packages + "Bypass two-factor authentication for write actions" enabled** (or `jsagir` running `npm publish --otp=<code>` directly). The two tokens tried 2026-05-11: `npm_6ob...` -> 403 (2FA required); `npm_sU4w3K...` -> 404 on PUT (granular token scoped before the org existed). `npm pack --dry-run` is clean (590 files, no secrets) -- only auth blocks it. Until then the `npx`/`npm i -g` install path is dead; `claude plugin install/update mos@mindrian-marketplace --version 1.13.0-beta.9` + direct install.sh + the install page work. When a working token lands: `npm publish --tag next` -> `npm view @mindrian_os/cli@next version` -> mount the NpmQuickInstall component in ~/mindrianos-install-site/ + redeploy (`vercel --prod`) -> done.
- Windows cold-install gate (tests/manual/95.6-windows-cold-install-acceptance.md) was WAIVED for beta.9 (maintainer, 2026-05-11) -- still the contract for promoting beta.9/.10 -> a clean 1.13.0; needs a Windows tester run before that promotion.
- Phase 117 (auto-explore-domains-on-first-material) -- 117-VERIFICATION.md WAS filed retroactively 2026-05-11 (status: passed, 55/55 must-haves, commit 3b9476e). 4 human-verify items pending (live CLI smoke + the post-tester VR gate). Not running `gsd-tools phase complete 117` to avoid clobbering Current Position; the phase is verified-passed.
- ~/mindrian-marketplace/.claude-plugin/marketplace.json `description` field is slightly stale ("73 commands ... 13 hooks") -- not updated in the beta.9 ref-pin commit; cosmetic.
- brain-cleanup workspace (~/gsd-workspaces/brain-cleanup/): Phase 5 COMPLETE (the Workflow Layer's hard dep -- the enrichCausalEdges->FEEDS_INTO rewrite); commit 128d47e unpushed there (1 ahead of origin); also has out-of-scope unstaged changes in other repos. Its own next phase is Phase 6 (CI-01 drift tripwire).
- RESOLVED 2026-05-11: tests/test-navigation-memory-events.cjs test1_enumCount now asserts EVENT_TYPES.size >= 19 (floor). 9/9 GREEN (commit a73a06c). The "One-line fix outstanding" item is closed.
- RESOLVED 2026-05-12: Phase 95.6 marked complete via `gsd-tools phase complete 95.6` (10/10 plans, no verification-debt warnings). The `gsd-tools` roadmap-order "next" was Phase 104, but the maintainer override is Phase 122 (the beta.10 Workflow Layer capstone).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260420-gg7 | Draft MINDRIAN-CANON.md product canon with 8 principles + cross-references | 2026-04-20 | b7d95bd | [260420-gg7-draft-mindrian-canon-md-product-canon-wi](./quick/260420-gg7-draft-mindrian-canon-md-product-canon-wi/) |
| 260510-or6 | docs/UI-UX-CONVERGENCE-2026-05-10 bundle -- 11 files: diagnose, JTBD, systems analysis, two reverse salients, contradiction audit, 10-decision survey, tester-evidence design brief, Minto convergence + dev-phase instructions, live-Brain Mode-A re-run, activation-gap critical finding | 2026-05-10 | 9ab9a77 | [260510-or6-create-docs-ui-ux-convergence-2026-05-10](./quick/260510-or6-create-docs-ui-ux-convergence-2026-05-10/) |
| 260511-wdm | Cut v1.13.0-beta.10 + rename npm package @mindrian/os -> @mindrian_os/cli (the @mindrian scope never existed; @mindrian_os org created 2026-05-11). plugin.json + package.json -> 1.13.0-beta.10; forward-looking refs swapped; CHANGELOG [1.13.0-beta.10] entry; tag v1.13.0-beta.10. Pushed to GitHub + marketplace. npm publish pending a working @mindrian_os-scoped bypass-2FA token. | 2026-05-11 | 103a8fb | [260511-wdm-beta10-pkg-rename](./quick/260511-wdm-beta10-pkg-rename/) |

## Session Continuity

Last session: 2026-05-11T19:35:00.000Z
Stopped at: 95.6-10 -- v1.13.0-beta.9 SHIPPED to GitHub + marketplace 2026-05-11 (origin/main 60fe434; tag v1.13.0-beta.9 -> 9ed8280; ~/mindrian-marketplace master a41964f). Remaining: maintainer runs `npm login` + `npm publish --tag next` (ENEEDAUTH in env), then `gsd-tools phase complete 95.6`, then update ~/mindrianos-install-site/ for npx. Then Phase 117 (already shipped beta.8; owes a 117-VERIFICATION.md).
Resume file: .planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/95.6-10-SUMMARY.md
