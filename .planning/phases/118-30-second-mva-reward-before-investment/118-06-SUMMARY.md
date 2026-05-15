---
phase: 118-30-second-mva-reward-before-investment
plan: "06"
slug: rule-linter-dror-harness
subsystem: rule-enforcement + acceptance-harness
tags: [reward-before-investment, rule-linter, dror-harness, ld1-locked, critical-1, critical-5, critical-4, warn-2, warn-4, warn-5, canon-part-6, canon-part-7, canon-part-8, canon-part-10, em-dash-free, hooked-action-axis]

# Dependency graph
requires:
  - phase: 118-00 (scripts/mva-detect.cjs + lib/core/mva-state.cjs -- harness spawns the hook + reads the state file)
  - phase: 118-03 (lib/core/mva-telemetry.cjs ALLOWED_FIELDS schema; mva_brief_rendered.total_duration_ms field name -- WARN-2 invariant)
  - phase: 118-04 (Plan 118-04 mva-vercel-deploy substrate; the harness asserts CLASSIFICATION + state-write end-to-end, the downstream deck build is asserted in mva-deck-builder.test.cjs)
  - phase: 118-05 (commands/mva-brief.md + commands/mva-option.md -- already declared interactive_first_reward; the linter validates them as compliant baseline)
  - phase: 122 (the workflow-layer pre-commit guard pattern -- this plan adds Phase 118-06 guardian block immediately before the Phase 88-13 feynman-minto-guardian)
  - phase: 123 (release-pipeline lockstep -- the linter check + Dror harness ride along in v1.13.0-beta.17 release flight)
provides:
  - "docs/reward-before-investment-rule.md (the universal architectural rule shipped in-repo per Canon Part 6 dog-fooding; source-of-truth note points at the room copy; em-dashes -> hyphens)"
  - "lib/core/mva-rule-linter.cjs (scanCommands + validateFrontmatter + REWARD_TYPES frozen Set of 6 canonical values for v1.13.0)"
  - "scripts/check-reward-before-investment.cjs (CLI wrapper -- table + Larry-voice success line; exit 1 on missing/invalid)"
  - "lib/core/mva-rule-linter.test.cjs (11 tests: 7 library baseline + 4 hook/audit invariants)"
  - "tests/test-mva-dror-harness.cjs (Dror 2.0 acceptance harness; 5 tests covering 3 fixture sentences + concurrency invariant + telemetry sanity; reads LD1 from 118-CONTEXT.md at startup per CRITICAL-1+5)"
  - "4 commands' frontmatter declarations: new-project=instant_brief / file-meeting=paragraph_preview / grade=calibration_distribution_preview / onboard=reframe_question"
  - "scripts/hooks/pre-commit Phase 118-06 guardian block (CRITICAL-4 hook wire; COMMIT_NO_VERIFY=1 bypass per wave-protocol invariant)"
  - "Phase 118 aggregator extension: tests/run-all-118.sh now registers 16 suites total (14 prior + 2 net-new); 16/16 GREEN at Plan 06 completion"
  - "lib/memory/run-feynman-tests.cjs Phase 118 block (15 test registrations spanning Plans 00-06)"
affects:
  - 119 (the room-as-receipt-invariant phase: Phase 119 will swap option-2 of the 3-option footer to actually invoke /mos:new-project --from-brief <sha8>; commands/new-project.md frontmatter declaration already prepared)
  - 121.5 (terminal-coherence capstone: consumes the dror_pass telemetry concept as evidence base for the Hooked Action axis re-score gate)
  - "follow-up phases: audit + declare interactive_first_reward on the remaining ~82 commands (currently reported as missing by the linter; rule-doc registers this as a separate follow-up audit phase)"
  - "follow-up phases: implement actual remediations on file-meeting (paragraph_preview), grade (calibration_distribution_preview), onboard (reframe_question) -- the FIELD is declared today; the per-command flow remediation is separate"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-vocabulary frozen-Set enum (REWARD_TYPES) -- 6 values for v1.13.0; future expansions are canon amendments not command-level inventions (per Canon Part 7 reuse-before-build)"
    - "Hand-rolled YAML-ish frontmatter parser mirroring scripts/build-command-registry.cjs (no new runtime deps; handles key:value + JSON arrays + dash lists + inline comments + quote stripping)"
    - "Three-bucket scan output (compliant / missing / invalid) with per-entry { path, reason, value } -- graceful degradation when a file has no frontmatter at all (legacy compatibility, flagged as missing not crash)"
    - "CRITICAL-1+5 future-grep pattern: literal substrings LD1 + LOCKED inline in the harness source so reviewers can confirm OQ1 is closed via grep; canon-deletion guard throws clear error if LD1 block is missing from 118-CONTEXT.md"
    - "CRITICAL-4 hook scaffold E2E: temp git repo + copy hook + scripts + lib + stage broken commands/foo.md + invoke bash hooks/pre-commit + assert non-zero exit + stderr contains foo.md (proves the hook chain wired end-to-end, not just present)"
    - "Hermetic HOME spawn pattern: each Dror harness test creates fs.mkdtempSync home; spawns hook with env.HOME = hermeticHome; reads state file + telemetry from that home; never touches the dev machine's ~/.mindrian/"

key-files:
  created:
    - docs/reward-before-investment-rule.md
    - lib/core/mva-rule-linter.cjs
    - lib/core/mva-rule-linter.test.cjs
    - scripts/check-reward-before-investment.cjs
    - tests/test-mva-dror-harness.cjs
    - .planning/phases/118-30-second-mva-reward-before-investment/118-06-SUMMARY.md
    - .planning/phases/118-30-second-mva-reward-before-investment/deferred-items.md
  modified:
    - commands/new-project.md (frontmatter only -- body byte-identical; interactive_first_reward: instant_brief + rule-doc line-reference comment)
    - commands/file-meeting.md (frontmatter only; interactive_first_reward: paragraph_preview)
    - commands/grade.md (frontmatter only; interactive_first_reward: calibration_distribution_preview)
    - commands/onboard.md (frontmatter only; interactive_first_reward: reframe_question)
    - commands/mva-brief.md (auto-fix Rule 3: added teaching field + serves_jtbd; pre-existing Phase 122 build-command-registry gap from Plan 04 deferred)
    - commands/mva-option.md (auto-fix Rule 3: added teaching field + serves_jtbd; pre-existing Plan 05 deferred)
    - data/command-registry.json (regenerated after frontmatter changes via scripts/build-command-registry.cjs)
    - scripts/hooks/pre-commit (Phase 118-06 guardian block: invokes linter when any commands/*.md staged; respects COMMIT_NO_VERIFY=1)
    - tests/run-all-118.sh (added 2 entries: mva-rule-linter.test.cjs + test-mva-dror-harness.cjs; 14 -> 16 suites)
    - lib/memory/run-feynman-tests.cjs (appended Phase 118 block; 15 test registrations spanning Plans 00-06)

key-decisions:
  - "WARN-5 audit fix landed verbatim: commands/new-project.md carries interactive_first_reward: instant_brief (NOT reframe_question). Per docs/reward-before-investment-rule.md lines 56-58 the prescribed remediation IS the Instant Brief pipeline (which Phase 118 itself IS). Test 10 + Test 11 in mva-rule-linter.test.cjs assert this parity."
  - "CRITICAL-1+5 LD1 LOCKED wire shipped as instructed: tests/test-mva-dror-harness.cjs reads LD1 from .planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md ## Locked Decisions ### LD1 block at startup. The literal keywords LD1 and LOCKED appear inline in the harness source (verified by grep). The harness DOES NOT fail loudly on 'OQ1 unresolved' -- OQ1 is CLOSED per LD1. The ONLY failure mode is canon-deletion (LD1 block missing from CONTEXT.md), which throws a clear restore-LD1 error."
  - "CRITICAL-4 hook wire shipped + scaffold E2E test: Test 8 grep-asserts scripts/hooks/pre-commit contains 'check-reward-before-investment.cjs'; Test 9 scaffolds a temp git repo, copies hook + linter, stages a missing-field commands/foo.md, invokes bash hooks/pre-commit, and asserts exit non-zero AND stderr contains foo.md. This proves the hook chain wired end-to-end, not just present."
  - "WARN-2 invariant honored: the Dror harness asserts total_duration_ms <= 45000 (NOT duration_ms). Plan 118-03 mva-telemetry.cjs ALLOWED_FIELDS schema lists total_duration_ms as the correct field name for mva_brief_rendered."
  - "WARN-4 invariant honored: no `2>&amp;1` XML entities anywhere in Plan 06's shell code. The verify blocks use plain `2>&1` (verified by grep)."
  - "Per binding decision B5: this plan ships the rule + the linter + the 4 named commands' DECLARATIONS. Per-command actual remediations (other than /mos:new-project, which IS Phase 118's canonical implementation) are out-of-scope follow-up phases."
  - "Pre-existing teaching-field gap on Plans 04/05 MVA helpers (mva-brief, mva-option) was auto-fixed under Deviation Rule 3 (blocking issue): the Phase 122 build-command-registry --check guard was blocking the commit chain. Added one-sentence Larry-voice teaching strings + serves_jtbd: ['explore']. Tracked in deferred-items.md as a transparent record (not silently absorbed)."
  - "Linter design choice: graceful 'missing' on no-frontmatter files (legacy compatibility). Many of the ~82 missing commands have no frontmatter at all or no `interactive_first_reward` key; the linter degrades to {reason: 'no_frontmatter'} or {reason: 'missing_field'} respectively, never crashes. This makes the linter forward-compatible with the follow-up sweep phase."

patterns-established:
  - "Reward-before-investment rule as a CI-enforceable invariant: a frozen-Set REWARD_TYPES + a frontmatter-scanner + a CLI exit-code + a pre-commit hook block + a scaffold E2E test. Replicable for any future architectural constraint that needs declarative enforcement at the command-spec level (per the rule doc's 'Detection mechanism' section)."
  - "Acceptance harness reads LOCKED canon decisions at runtime: tests/test-mva-dror-harness.cjs readLD1FromContext() reads the LD1 block from 118-CONTEXT.md ## Locked Decisions and uses it as a frozen invariant. If the LD1 block is deleted, the harness throws a clear restore-LD1 error -- the canon-deletion guard is the ONLY failure mode for the Hebrew refusal test."
  - "Hermetic HOME pattern for hook-end-to-end tests: spawn child process with env.HOME = fs.mkdtempSync; assert state + telemetry from that hermetic home; never touch dev-machine's ~/.mindrian/. Replicable for any future hook test that writes to ~/.mindrian/."

requirements-completed: [MVA-118-24, MVA-118-25, MVA-118-26, MVA-118-27, MVA-118-28]

canon_parts: [Part 6, Part 7, Part 10]

# Metrics
metrics:
  duration_minutes: ~75
  date_completed: 2026-05-15
  tests_added: 16   # 11 linter unit + 5 Dror harness
  tests_green: 16
  files_created: 7
  files_modified: 10
  commits: 3
---

# Phase 118 Plan 06: Rule-Linter + Dror 2.0 Harness Summary

Universal reward-before-investment rule shipped as an in-repo doc + a frozen-vocabulary linter + a CI-enforceable pre-commit gate + the source-spec's hardest acceptance harness; closes the loop between the architectural constraint and Phase 118's canonical implementation.

## Commits

| Task | SHA | Summary |
|------|-----|---------|
| Task 1 | `8e96cf0d` | mva-rule-linter library + CLI + 11 unit tests (T1-T7 GREEN; T8-T11 RED-by-design until Task 2) |
| Task 2 | `5175d33b` | docs/reward-before-investment-rule.md + 6 frontmatter declarations + scripts/hooks/pre-commit guardian wire; all 11 tests GREEN |
| Task 3 | `fb8a0cb1` | tests/test-mva-dror-harness.cjs + tests/run-all-118.sh + lib/memory/run-feynman-tests.cjs Phase 118 block; 16/16 aggregator GREEN |

## The REWARD_TYPES closed vocabulary (v1.13.0 canonical)

| Value | Used by | Source line |
|-------|---------|-------------|
| `reframe_question` | `/mos:onboard` | rule doc 68-70 |
| `instant_brief` | `/mos:new-project`, `/mos:mva-brief` | rule doc 56-58 (the canonical implementation IS Phase 118) |
| `schema_preview` | (reserved for future commands) | rule doc design pattern |
| `calibration_distribution_preview` | `/mos:grade` | rule doc 64-66 |
| `paragraph_preview` | `/mos:file-meeting` | rule doc 60-62 |
| `--none (scripting only)` | `/mos:mva-option` (and any future scripting-only command) | rule doc 81 |

Future expansions are canon amendments per the closed-vocabulary principle (rule doc) + Canon Part 7 (reuse before build).

## The 4 named commands' declarations (WARN-5 audit fix)

| Command | Field value | Rule-doc line |
|---------|-------------|---------------|
| `commands/new-project.md` | `instant_brief` (NOT `reframe_question` per WARN-5) | 56-58 |
| `commands/file-meeting.md` | `paragraph_preview` | 60-62 |
| `commands/grade.md` | `calibration_distribution_preview` | 64-66 |
| `commands/onboard.md` | `reframe_question` | 68-70 |

The WARN-5 audit was the plan-checker iteration 2 fix: an earlier draft had `new-project = reframe_question`. Per rule doc lines 56-58 ("first user sentence triggers Instant Brief pipeline"), the prescribed remediation IS the Instant Brief, which is the 30-Second MVA pipeline shipped by Phase 118 itself. Test 10 + Test 11 in `mva-rule-linter.test.cjs` are the regression guards for this audit.

## The CRITICAL-4 hook wire evidence

| Surface | Status |
|---------|--------|
| `grep -q "check-reward-before-investment.cjs" scripts/hooks/pre-commit` | exits 0; literal substring present |
| `node lib/core/mva-rule-linter.test.cjs` Test 8 (grep assertion) | GREEN |
| `node lib/core/mva-rule-linter.test.cjs` Test 9 (scaffold E2E -- temp git repo + staged offender + bash hooks/pre-commit -> non-zero exit + stderr names foo.md) | GREEN |

Test 9 is the teeth: it proves the hook chain blocks a real `commands/*.md` commit that lacks the field, not just that the wire is present.

## The CRITICAL-1+5 LD1-LOCKED wire evidence

| Surface | Status |
|---------|--------|
| `grep -l "LD1\|LOCKED" tests/test-mva-dror-harness.cjs` | 1 match (literal keywords inline) |
| `grep -l "LD1\|LOCKED" .planning/phases/118-30-second-mva-reward-before-investment/118-06-rule-linter-dror-harness-PLAN.md` | 1 match (literal keywords inline in the plan) |
| `readLD1FromContext()` runtime call at harness startup | returns `{ locked: true, english_only_v1_13_0: true, source: 'LD1', context_path: '118-CONTEXT.md' }` |
| Test 3 (Hebrew sentence -> `hebrew_refusal: true` in state file) | GREEN |
| Canon-deletion guard: harness throws `LD1 LOCKED block not found in 118-CONTEXT.md` if the block is removed | engineered (try-block at startup) |

The harness DOES NOT fail loudly on "OQ1 unresolved" -- OQ1 is CLOSED per LD1. The harness reads LD1 once at startup and uses it as a frozen invariant. Future grep for `LD1` + `LOCKED` hits both the plan AND the harness source -- confirming OQ1 is no longer open.

## The Dror 2.0 harness measured wall-clock

3 fixture sentences + concurrency invariant + telemetry sanity, 5 tests total. Wall-clock from a representative run on the dev machine (Linux, Node.js 20+, no network):

| Test | Wall-clock | Budget | Headroom |
|------|------------|--------|----------|
| Test 1 VENTURE_EN classification + state write | 66 ms | 45000 ms (WARN-2 total_duration_ms) | 99.85% |
| Test 2 NON_VENTURE classifier reject | 57 ms | n/a (no state mutation expected) | n/a |
| Test 3 LD1 LOCKED Hebrew refusal | 60 ms | n/a (short-circuit; no agents invoked) | n/a |
| Test 4 concurrency (2nd hook fires while running -> no-double-fire) | 108 ms | n/a (invariant test) | n/a |
| Telemetry sanity (mva_classified event present + no raw-content egress) | 82 ms | n/a (Canon Part 8 grep) | n/a |

Total harness elapsed: 9 seconds (full aggregator). Per-test classifier+hook+state-write phase: under 130 ms in all cases. The source-spec 60-second ceiling (per `the-30-second-mva.md` line 129) is met by a factor of ~700x at the classification surface. The downstream 6-agent fan-out + Vercel deploy is asserted by Plan 118-03 + Plan 118-04 test substrate (mva-orchestrator.test.cjs + mva-vercel-deploy.test.cjs).

These numbers are the v1.13.0 Hooked Action axis re-score evidence base. Per OQ6 lean (settled): synthetic + real-user. The real-user signal is collected outside CI by one of the Wave-2 testers at `/gsd:verify-work` time per the phase verification block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing Phase 122 teaching-field gap**
- **Found during:** Task 2 commit (live pre-commit hook ran `build-command-registry --check`)
- **Issue:** `commands/mva-brief.md` + `commands/mva-option.md` (shipped by Plans 118-04 + 118-05) lacked a `teaching:` field. Phase 122 build-command-registry guard exits non-zero on missing-teaching commands, blocking the Plan 06 commit chain.
- **Fix:** Added one-to-two-sentence Larry-voice teaching strings + `serves_jtbd: ["explore"]` to both files. Regenerated `data/command-registry.json` to satisfy the --check guard.
- **Why auto-fixed (not deferred):** the Phase 122 guard is the blocking surface for `commands/*.md` commits across the whole repo; deferring would have required `--no-verify` on every Plan 06 commit. The fix is in-scope per Rule 3 (auto-fix blocking issues directly tied to the task surface).
- **Files modified:** `commands/mva-brief.md`, `commands/mva-option.md`, `data/command-registry.json`
- **Commits:** included in `5175d33b` (Task 2)
- **Tracked:** `.planning/phases/118-30-second-mva-reward-before-investment/deferred-items.md` (transparent record, not silently absorbed)

### Out-of-Scope Discoveries Logged

**1. Live `.git/hooks/pre-commit` is stale**
- The source-tracked `scripts/hooks/pre-commit` is updated by Plan 06; the live `.git/hooks/pre-commit` (installed via `scripts/install-pre-commit.sh` at an earlier date) is 234 lines while the source is now 272 lines. Per Phase 87-01a + Phase 108-05 + Phase 122 convention, contributors who want the live hook to enforce the Plan 06 linter must re-run `bash scripts/install-pre-commit.sh`. Test 8 + Test 9 in `mva-rule-linter.test.cjs` validate the SOURCE file -- they do NOT depend on the live install state.
- **Resolution path:** a future hardening phase could make the installer idempotent and auto-syncing on every contributor run. Out of scope here.
- **Tracked:** `deferred-items.md`

**2. Remaining ~82 commands missing the `interactive_first_reward` field**
- The linter, when run against the real `commands/` directory, reports 6 compliant (the 4 named + mva-brief + mva-option) and 82 missing. Per binding decision B5 second clause, the follow-up audit phase will classify each missing command as either an enum value or `--none (scripting only)` per the scripting override clause.
- **Resolution path:** a separate follow-up phase scoped to the ~82 commands. The rule-doc registers this as follow-up phase candidate #1.
- **Tracked:** `docs/reward-before-investment-rule.md ## Follow-up phases registered`

## Verification

### Automated
- `node lib/core/mva-rule-linter.test.cjs` -> 11/11 GREEN (T1-T7 baseline + T8-T11 hook/audit)
- `node tests/test-mva-dror-harness.cjs` -> 5/5 GREEN (Tests 1-4 + telemetry sanity)
- `bash tests/run-all-118.sh` -> 16/16 GREEN (Plans 00-06 aggregator)
- `node scripts/check-reward-before-investment.cjs commands/` -> reports 6 compliant + 82 missing (the 4 named commands ARE compliant; remaining missing tracked as follow-up); exit 1 (other commands still missing the field is expected per B5 scope)
- `grep -q "check-reward-before-investment.cjs" scripts/hooks/pre-commit` -> hook wired
- `grep -rn "LD1\|LOCKED" tests/test-mva-dror-harness.cjs .planning/phases/118-30-second-mva-reward-before-investment/118-06-rule-linter-dror-harness-PLAN.md` -> 2 matches (CRITICAL-1+5 future-grep)
- Em-dash audit on all Plan 06 net-new files: 0 hits
- WARN-4 XML entity audit (`2>&amp;1` in shell code): 0 hits

### Manual / Deferred
- Wave-2 tester runs the Dror 2.0 path live (real Vercel deploy, real Brain call) and reports time-to-URL + emotional reaction. Recorded in this SUMMARY at `/gsd:verify-work` time per OQ6 lean.
- `bash scripts/install-pre-commit.sh` re-run on the dogfood machine to sync `.git/hooks/pre-commit` with the new source (one-time post-merge step; tracked in deferred-items.md).

## Canon obligations satisfied

- **Part 6 (Product-as-Venture):** the plugin's own canon is enforced by its own mechanism. The rule lives in `docs/` (visible to every contributor in the repo context), the linter scans the plugin's own `commands/*.md`, the pre-commit hook blocks plugin contributors from regressing.
- **Part 7 (Reuse Before Build):** REWARD_TYPES is a closed vocabulary; the frontmatter parser reuses `scripts/build-command-registry.cjs`'s pattern; no new runtime dependencies; the rule doc cites its source-of-truth in `~/MindrianRooms/` and treats the in-repo copy as the shadow.
- **Part 8 (Graph Boundary):** zero Brain calls; zero network surface in the linter / CLI / hook / harness; the venture sentence stays local in the state file; only sha256 hashes + scalar counts ever cross a process boundary (verified by Canon Part 8 grep in Test "Telemetry sanity").
- **Part 10 sub-claim 3 (room generates as receipt):** the Dror 2.0 harness is the programmatic test that the source-spec's hardest acceptance criterion (one sentence -> reward within 60s) holds. The harness becomes the Hooked Action axis re-score evidence base.

## Follow-up phases registered (per binding decision B5 second clause)

1. Audit + declare `interactive_first_reward` on the remaining ~82 commands (the linter currently reports them as missing; ~80 candidates classify as `--none (scripting only)`, ~2 as enum values).
2. Implement actual remediation on `/mos:file-meeting` (the `paragraph_preview` reward; the FIELD is declared today, the per-command flow remediation is a follow-up).
3. Implement actual remediation on `/mos:grade` (the `calibration_distribution_preview` reward).
4. Implement actual remediation on `/mos:onboard` (the `reframe_question` reward).
5. Phase 121.5 capstone consumes the harness's structured-pass concept (`dror_pass` event) as evidence base for the Hooked re-score gate.
6. Idempotent installer for `scripts/hooks/pre-commit` (the live hook re-sync gap).

## Self-Check: PASSED

| Check | Status |
|-------|--------|
| 7 created files exist on disk (docs/rule + linter + test + CLI + harness + SUMMARY + deferred-items) | PASS |
| 10 modified files exist on disk (4 named commands + 2 MVA helpers + registry + hook + aggregator + Feynman runner) | PASS |
| 3 task commits in `git log` (8e96cf0d Task 1, 5175d33b Task 2, fb8a0cb1 Task 3) | PASS |
| `node lib/core/mva-rule-linter.test.cjs` -> 11/11 GREEN | PASS |
| `node tests/test-mva-dror-harness.cjs` -> 5/5 GREEN | PASS |
| `bash tests/run-all-118.sh` -> 16/16 GREEN | PASS |
| `grep -q "check-reward-before-investment.cjs" scripts/hooks/pre-commit` | PASS (hook wired) |
| `grep "LD1\|LOCKED" tests/test-mva-dror-harness.cjs` | PASS (literal keywords inline) |
| Em-dash audit on Plan 06 net-new files | PASS (0 hits) |
| WARN-4 XML entity audit | PASS (0 hits) |

No missing items. Plan 06 is complete and ready for STATE.md advance.
