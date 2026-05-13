---
phase: 124
slug: feynman-temporal-awareness
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-13
populated: 2026-05-13
---

# Phase 124 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Body derived from `124-CONTEXT.md` D-11 (test suite shape) + the 5 plan files (124-00 through 124-04). Mirrors the `122-VALIDATION.md` and `110-VALIDATION.md` shape.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:assert/strict` + `node:child_process` + `node:sqlite` (Node 22+); hand-rolled CJS test files registered in `lib/memory/run-feynman-tests.cjs` (no jest/mocha/vitest/zod in this repo -- see CLAUDE.md "What NOT to Use") |
| **Config file** | none -- the test list is the `TEST_FILES[]` array inside `lib/memory/run-feynman-tests.cjs`; the scoped 124 suite is `tests/run-all-124.sh` (mirrors `tests/run-all-110.sh` -- bash only, no emoji, no em-dashes) |
| **Quick run command** | `node tests/test-feynman-timeline-renderer.cjs && node tests/test-feynman-timeline-runner.cjs` (the relevant suite per task) |
| **Full suite command** | `bash tests/run-all-124.sh` (the scoped 124 runner) and `node lib/memory/run-feynman-tests.cjs` (the de-facto whole-repo suite, with the new files registered) |
| **Estimated runtime** | scoped 124 suite < ~10s (all tests are deterministic in-memory sqlite + tmp-dir fixtures; zero network at test time -- the renderer is pure SQL-over-room.db, the runner is fs + sqlite, no external surface) |

---

## Sampling Rate

- **After every task commit:** Run the relevant `tests/test-feynman-timeline-*.cjs` for that task (e.g. after Plan 124-01 Task 2: `node tests/test-feynman-timeline-renderer.cjs && node tests/test-feynman-timeline-empty-state.cjs`; after Plan 124-02 Task 3: `node tests/test-feynman-timeline-runner.cjs`; after Plan 124-03 Task 4: `node scripts/build-command-registry.cjs --check`).
- **After every plan wave:** Run the scoped 124 suite (`bash tests/run-all-124.sh`) and `node lib/memory/run-feynman-tests.cjs` (full suite).
- **Before `/gsd:verify-work`:** Full 124 suite green (`bash tests/run-all-124.sh` exits 0); `node scripts/build-command-registry.cjs --check` exits 0 (the Phase 122 tripwire confirms the new command's frontmatter is well-formed); `node lib/memory/run-feynman-tests.cjs` runs to completion; the Canon Part 9 invariant test (`tests/test-feynman-timeline-canon-part-9-invariant.cjs`) passes.
- **Max feedback latency:** ~10 seconds.

---

## Per-Task Verification Map

| Plan / Task | Wave | Requirement(s) | Test Type | Automated Command | New file (Wave 0?) | Status |
|-------------|------|----------------|-----------|-------------------|--------------------|--------|
| 124-00 / T1 (REQUIREMENTS + ROADMAP) | 0 | TEMPORAL-124-01..10 (all) | infra | `grep -c "TEMPORAL-124-0\|TEMPORAL-124-10" .planning/REQUIREMENTS.md \| awk '$1 == 20 { exit 0 } { exit 1 }' && grep -q "124-00-PLAN.md" .planning/ROADMAP.md && grep -q "124-04-PLAN.md" .planning/ROADMAP.md` | -- (edits existing files) | pending |
| 124-00 / T2 (4 RED stubs + run-all-124.sh + lib/core/feynman/ROOM.md + Feynman runner registration) | 0 | TEMPORAL-124-10 (test infra) | infra | `for f in tests/test-feynman-timeline-renderer.cjs tests/test-feynman-timeline-runner.cjs tests/test-feynman-timeline-empty-state.cjs tests/test-feynman-timeline-canon-part-9-invariant.cjs tests/run-all-124.sh lib/core/feynman/ROOM.md; do test -f "$f"; done && bash tests/run-all-124.sh; [ $? -eq 1 ]` (exit 1 today is correct-by-design -- 4 RED stubs) | YES -- 4 stubs + `tests/run-all-124.sh` + `lib/core/feynman/ROOM.md` | pending |
| 124-01 / T1 (firstCapturedLastTouchedBySection on insights.cjs + re-export on navigation.cjs) | 1 | TEMPORAL-124-02, TEMPORAL-124-07 | unit | `node -e "const nav = require('./lib/core/navigation.cjs'); if (typeof nav.firstCapturedLastTouchedBySection !== 'function') process.exit(1);"` | -- (extends existing files) | pending |
| 124-01 / T2 (lib/core/feynman/timeline-renderer.cjs) | 1 | TEMPORAL-124-02, -04, -05, -07 | unit | `node -e "const r = require('./lib/core/feynman/timeline-renderer.cjs'); if (typeof r.renderTimeline !== 'function' || r.THRESHOLDS.recent_ms !== 604800000) process.exit(1);" && ! grep -E "require\\(.*brain-client\|fetch\\(\|http\\.request" lib/core/feynman/timeline-renderer.cjs` | YES -- `lib/core/feynman/timeline-renderer.cjs` | pending |
| 124-01 / T3 (fill renderer + empty-state test stubs) | 1 | TEMPORAL-124-02, -04, -05, -07 | unit | `node tests/test-feynman-timeline-renderer.cjs && node tests/test-feynman-timeline-empty-state.cjs` | fills `tests/test-feynman-timeline-renderer.cjs` + `tests/test-feynman-timeline-empty-state.cjs` (from 124-00 stubs) | pending |
| 124-02 / T1 (EVENT_TYPES +2 in memory-events.cjs) | 1 | TEMPORAL-124-09 | unit | `node -e "const m = require('./lib/core/navigation/memory-events.cjs'); if (!m.EVENT_TYPES.has('feynman_timeline_refreshed') \|\| !m.EVENT_TYPES.has('feynman_timeline_refresh_failed') \|\| m.EVENT_TYPES.size < 37) process.exit(1);"` | -- (extends existing file) | pending |
| 124-02 / T2 (lib/core/feynman/timeline-runner.cjs) | 1 | TEMPORAL-124-01, -03, -08 | unit | `node -e "const r = require('./lib/core/feynman/timeline-runner.cjs'); if (typeof r.refreshAll !== 'function' \|\| typeof r.refreshSection !== 'function' \|\| r.SENTINEL_START !== '<!-- TIMELINE_AUTO_START -->') process.exit(1);" && ! grep -E "require\\(.*brain-client\|fetch\\(\|http\\.request" lib/core/feynman/timeline-runner.cjs` | YES -- `lib/core/feynman/timeline-runner.cjs` | pending |
| 124-02 / T3 (fill runner test stub) | 1 | TEMPORAL-124-01, -03, -08, -09 | integration | `node tests/test-feynman-timeline-runner.cjs` | fills `tests/test-feynman-timeline-runner.cjs` (from 124-00 stub) | pending |
| 124-03 / T1 (session-start cascade slot after cache-prune) | 2 | TEMPORAL-124-03 | infra | `grep -q "# --- BEGIN feynman timeline refresh" scripts/session-start && grep -q "# --- END feynman timeline refresh ---" scripts/session-start && grep -q "lib/core/feynman/timeline-runner.cjs" scripts/session-start && bash -n scripts/session-start` | -- (extends existing file) | pending |
| 124-03 / T2 (commands/feynman-timeline-refresh.md) | 2 | TEMPORAL-124-03 | doc | `test -f commands/feynman-timeline-refresh.md && grep -q "^kind: utility" commands/feynman-timeline-refresh.md && grep -q "^frameworks: \[\]" commands/feynman-timeline-refresh.md && grep -q 'serves_jtbd: \["validate-idea", "build-knowledge"\]' commands/feynman-timeline-refresh.md` | YES -- `commands/feynman-timeline-refresh.md` | pending |
| 124-03 / T3 (scripts/feynman-timeline-refresh-command.cjs) | 2 | TEMPORAL-124-03 | unit | `node -c scripts/feynman-timeline-refresh-command.cjs && node -e "const d = require('./scripts/feynman-timeline-refresh-command.cjs'); if (typeof d.parseArgv !== 'function') process.exit(1); const a = d.parseArgv(['node','script']); if (!a.all) process.exit(1);"` | YES -- `scripts/feynman-timeline-refresh-command.cjs` | pending |
| 124-03 / T4 (data/command-registry.json regen + Phase 122 --check) | 2 | TEMPORAL-124-03 | integration | `node scripts/build-command-registry.cjs && node scripts/build-command-registry.cjs --check && grep -q "/mos:feynman-timeline-refresh" data/command-registry.json` | -- (regenerates existing file) | pending |
| 124-04 / T1 (fill canon-part-9-invariant test stub) | 3 | TEMPORAL-124-10 | invariant | `node tests/test-feynman-timeline-canon-part-9-invariant.cjs && bash tests/run-all-124.sh` | fills `tests/test-feynman-timeline-canon-part-9-invariant.cjs` (from 124-00 stub) | pending |
| 124-04 / T2 (docs/CANON-PHASE-MAP.md Part 9 row) | 3 | TEMPORAL-124-10 (canon docs) | doc | `grep -q "Phase 124 feynman-temporal-awareness" docs/CANON-PHASE-MAP.md && awk '/### Part 9 - Memory Locality and Interpretation/,/### Part 10/' docs/CANON-PHASE-MAP.md \| grep -q "Phase 124"` | -- (extends existing file) | pending |
| 124-04 / T3 (docs/MINDRIAN-CANON.md Part 9 cross-reference) | 3 | TEMPORAL-124-10 (canon docs) | doc | `grep -q "Phase 124 (FEYNMAN.md Temporal Awareness)" docs/MINDRIAN-CANON.md && awk '/### Implementing phase/,/^## /' docs/MINDRIAN-CANON.md \| grep -q "Phase 124"` | -- (extends existing file) | pending |

*Status: pending / green / red / flaky. Maps to CONTEXT D-11 + each plan's `<verify><automated>` block.*

---

## Wave 0 Requirements (the test scaffold -- all in plan 124-00 Task 2, then filled by downstream plans)

- [ ] `tests/test-feynman-timeline-renderer.cjs` -- stub in 124-00; filled in 124-01 (covers `renderTimeline` 4-bucket fixture + env-override + stable output + sub-room scoping + no-em-dash sweep)
- [ ] `tests/test-feynman-timeline-empty-state.cjs` -- stub in 124-00; filled in 124-01 (covers empty-db placeholder + other-section non-leak via D-08 scoping)
- [ ] `tests/test-feynman-timeline-runner.cjs` -- stub in 124-00; filled in 124-02 (covers sentinel replace + body byte-preserved (SHA256) + watermark frontmatter set + idempotent re-run + watermark skip + failure handling + memory_event logged + first-encounter sentinel append)
- [ ] `tests/test-feynman-timeline-canon-part-9-invariant.cjs` -- stub in 124-00; filled in 124-04 (covers forbidden-require sweep + forbidden-call sweep + fs-instrument allow-list + adversarial seed forbidden-substring sweep + renderer-imports-navigation regression)
- [ ] `tests/run-all-124.sh` -- created in 124-00 (mirrors `tests/run-all-110.sh`); CJS_SUITES = the 4 suites; the runner exits 1 today (RED-by-design) and exits 0 once 124-01, 124-02, 124-04 fill their stubs
- [ ] all 4 test paths registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` in 124-00 (the Phase 124 block goes AFTER the Phase 123 block, before the closing `];`)
- [ ] `lib/core/feynman/ROOM.md` -- ICM Layer 0 identity for the new dir per CLAUDE.md decision #15 (D-07 location lock; the renderer + runner ship next door in Plans 124-01 and 124-02)
- No new test framework needed -- node `assert` + `child_process` + `node:sqlite` is the framework (matches `lib/memory/run-feynman-tests.cjs` + every existing `*.test.cjs`).

---

## The Canon Part 9 Invariant Test (release-gate-equivalent, non-negotiable)

`tests/test-feynman-timeline-canon-part-9-invariant.cjs` -- LOAD-BEARING. If this fails, Phase 124 does not ship.

**Five invariant assertions** (mirrors the Phase 90 brain-derivation.test.cjs 5-tripwire pattern + Phase 110's `tests/test-brain-packet-part8-invariant-per-job.cjs` adversarial sweep + Phase 109's `tests/helpers/fs-instrument.cjs` allow-list):

1. **Forbidden-require sweep**: The renderer + runner + command dispatcher source files (`lib/core/feynman/timeline-renderer.cjs`, `lib/core/feynman/timeline-runner.cjs`, `scripts/feynman-timeline-refresh-command.cjs`) MUST NOT match any of:
   - `require('brain-client')` (any path form)
   - `require('node:http')` / `require('node:https')`
   - `require('http')` / `require('https')` (bare module forms)

2. **Forbidden-call sweep**: The same 3 files MUST NOT match:
   - `fetch(`
   - `http.request(` / `https.request(`
   - `http.get(` / `https.get(`

3. **fs-instrument allow-list**: With `tests/helpers/fs-instrument.cjs` installed (`throwOnViolation: false`), calling `runner.refreshSection(roomDir, 'market-analysis', { db, now_ms })` end-to-end against a tmp room dir produces ZERO reads outside the allow-list. Allow-list: `room.db` family (room.db, .wal, .shm, .journal) OR paths ending in `/FEYNMAN.md` OR `.FEYNMAN.md.tmp.<pid>.<ts>` atomic-write temp files OR any path inside the tmp room dir.

4. **Adversarial seed forbidden-substring sweep**: With an in-memory db seeded with INNOCUOUS `memory_event` rows, the renderer produces a `markdown_body` that contains NONE of:
   - `SECRET RAW BODY`
   - `leak@example.com`
   - `/home/jsagi/secret/`
   - `${INJECT}`
   This proves the renderer reads ONLY SQL, never the FEYNMAN.md file body (the file body is the runner's domain, and the renderer never sees it).

5. **Regression -- renderer imports navigation**: The renderer source MUST contain `require('../navigation.cjs')` -- proves the test is scanning the right file and the renderer has not been accidentally hollowed out.

**Failure mode:** any one of the 5 assertions failing causes `node tests/test-feynman-timeline-canon-part-9-invariant.cjs` to exit non-zero, which causes `bash tests/run-all-124.sh` to exit non-zero, which blocks the phase release.

---

## Hard Invariant Tests (D-02 body byte-preservation)

These live INSIDE `tests/test-feynman-timeline-runner.cjs` (Plan 124-02 Task 3):

- **Test 1 (sentinel replace + body byte-identical)**: A fixture FEYNMAN.md with sentinels + a human body is refreshed. After regen, `SHA256(bodyOutsideSentinels(pre)) === SHA256(bodyOutsideSentinels(post))`. The sentinel-bounded section IS replaced.

- **Test 3 (idempotent re-run)**: Two consecutive `refreshSection` calls with the same `now_ms` produce a byte-identical file (the watermark check skips the second run OR the deterministic renderer emits the same bytes).

- **Test 7 (first-encounter sentinel append)**: A fixture FEYNMAN.md with NO sentinel pair gets the pair appended at EOF; the first N lines of the original human body are byte-identical post-regen.

These three tests together enforce the D-02 hard invariant.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The session-start cascade slot actually runs the timeline-refresh on a real Claude Code session start, against a real user room with FEYNMAN.md files | TEMPORAL-124-03 | Requires a real Claude Code session start + a real room with FEYNMAN.md files; cannot be unit-tested because the slot runs INSIDE the session-start bash entry point and depends on the active-room registry | Set up a fixture room with at least one section folder containing a FEYNMAN.md with the sentinel pair; switch to it via `/mos:rooms switch <slug>`; restart the Claude session; confirm the FEYNMAN.md `## Timeline (auto)` block updates (or the watermark skips it correctly when no new memory_event rows landed). |
| `/mos:feynman-timeline-refresh` actually renders in a live CLI session | TEMPORAL-124-03 | The slash-command resolution flows through the Claude Code plugin hook substrate, which is not the same as `node scripts/feynman-timeline-refresh-command.cjs` directly | In a live `claude` session in a room with multiple section folders + FEYNMAN.md files: run `/mos:feynman-timeline-refresh`; confirm the F.0 Action Report renders with the per-section breakdown; run `/mos:feynman-timeline-refresh --section market-analysis` and confirm only that section is touched. |
| The Larry-explains face renders cleanly across LTR + RTL section folders + sub-rooms | TEMPORAL-124-04, -07 | Visual / pedagogical quality is subjective; the test asserts the D-05 template literal structure, but the "does it look right to a 12-year-old?" judgment is human | In a fixture room with 5+ sections + 2 sub-rooms + a variety of memory_event types: run `/mos:feynman-timeline-refresh --all`; open each FEYNMAN.md; confirm the `## Timeline (auto)` block reads as a coherent narrative; confirm sub-room slugs land correctly. |
| The Canon Part 9 prose update reads cleanly as canon text | TEMPORAL-124-10 (docs half) | Subjective prose quality | Read the new paragraph in `docs/MINDRIAN-CANON.md` Part 9 `### Implementing phase`; verify it parses as canon prose (uses Part 9 numbering, cross-references Parts 4 / 6 / 8, lives within the Mindrian Canon voice; matches the tone of the existing Phase 109 / 108 / 110 sentences). |

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency (the 4 Wave-0 stubs in 124-00 cover every later task's test file; the renderer + runner unit tests cover the renderer + runner deliverables; the Phase 122 `--check` tripwire covers the command frontmatter; the Canon Part 9 invariant test covers the structural assertions)
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify (every task in every plan has an `<automated>` block; per-task and per-wave runs are defined above)
- [x] Wave 0 covers all MISSING references (the 4 new test files are registered in `lib/memory/run-feynman-tests.cjs` + `tests/run-all-124.sh` in plan 124-00; later plans fill bodies without changing paths; no plan registers new test files outside the 4 Wave-0 stubs)
- [x] No watch-mode flags (all commands are one-shot `node ...` / `bash ...` / `grep ...`)
- [x] Feedback latency < ~10s (deterministic local tests; the only filesystem touches are tmp-dir fixtures + the test-target source files; zero network)
- [x] `nyquist_compliant: true` set in frontmatter (every task has an `<automated>` verify; every test file has a corresponding Wave-0 stub OR is itself a Wave-0 substrate artifact)

**Approval:** approved (planner) 2026-05-13
