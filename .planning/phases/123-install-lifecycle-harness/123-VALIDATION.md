---
phase: 123
slug: install-lifecycle-harness
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-12
updated: 2026-05-13
---

# Phase 123 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled by the gsd-planner from `123-RESEARCH.md` § "Validation Architecture" + the per-plan task maps. The Per-Task Verification Map is COMPLETE.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js bare assertions (the existing `tests/test-*.cjs` + `lib/memory/run-feynman-tests.cjs` pattern -- no jest/vitest; `process.exit(0/1)` per file) |
| **Config file** | none -- tests are self-contained `.cjs` files registered in `tests/run-all.sh` and `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` |
| **Quick run command** | `node tests/test-doctor-class-i.cjs && node tests/test-doctor-class-j.cjs && node tests/test-resolve-brain-key.cjs` (the new-class fixtures) |
| **Full suite command** | `bash tests/run-all.sh` |
| **Estimated runtime** | ~10-30 seconds (hermetic `MINDRIAN_PLUGIN_HOME` + `HOME` scratch-dir fixtures; no network -- Part 8) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the plan's class/module.
- **After every plan wave:** Run `bash tests/run-all.sh`.
- **Before `/gsd:verify-work`:** Full suite green + `mindrian-os doctor --acceptance --pre-tag` exits 0.
- **Max feedback latency:** ~30 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 123-01-T1 (Wave 0: semver devDep + bump-algebra test) | 01 | 1 | HARNESS-123-01..04 | unit | `node tests/test-release-bump-algebra.cjs` | W0 (writes) | pending |
| 123-01-T2 (release.sh rewrite: semver inc + two-commit form + dirty-repo guard) | 01 | 1 | HARNESS-123-01, 02, 03 | unit | `node tests/test-release-bump-algebra.cjs` | reads | pending |
| 123-01-T3 (test-release-npm-gate.sh @mindrian_os/install expectations) | 01 | 1 | HARNESS-123-04 | unit | `bash tests/test-release-npm-gate.sh` | reads | pending |
| 123-02-T1 (Wave 0: install-state-record test + active-plugin-root.cjs topology) | 02 | 2 | HARNESS-123-05, 06 | unit | `node tests/test-install-state-record.cjs` | W0 (writes) | pending |
| 123-02-T2 (session-start single-writer + Pitfall-7 fix + reconcile guard) | 02 | 2 | HARNESS-123-05 | unit + integration | `node tests/test-install-state-record.cjs` | reads | pending |
| 123-02-T3 (data/deployment-surfaces.json + data/ROOM.md) | 02 | 2 | HARNESS-123-06 | unit | `node tests/test-install-state-record.cjs` | reads | pending |
| 123-03-T1 (Wave 0: doctor-class-i + doctor-class-j hermetic fixtures) | 03 | 3 | HARNESS-123-07..10 | unit | `node tests/test-doctor-class-i.cjs && node tests/test-doctor-class-j.cjs` | W0 (writes) | pending |
| 123-03-T2 (doctor.cjs class I + class J + --install-state + aggressive --fix + INSTALL_DIR repoint) | 03 | 3 | HARNESS-123-07, 08, 09 | unit | `node tests/test-doctor-class-i.cjs && node tests/test-doctor-class-j.cjs` | reads | pending |
| 123-04-T1 (Wave 0: doctor-acceptance hermetic test) | 04 | 4 | HARNESS-123-11 | unit | `node tests/test-doctor-acceptance.cjs` | W0 (writes) | pending |
| 123-04-T2 (doctor.cjs --acceptance / --pre-tag / --light-npx + checklist runner + 7 points) | 04 | 4 | HARNESS-123-11 | unit + integration | `node tests/test-doctor-acceptance.cjs` | reads | pending |
| 123-04-T3 (release.sh Step 6.6 + Step 9.6 wire-in + retire release-beta-smoke.sh) | 04 | 4 | HARNESS-123-12 | unit | `node tests/test-doctor-acceptance.cjs` | reads | pending |
| 123-05-T1 (Wave 0: cache-prune.cjs + hermetic 6-scenario test) | 05 | 5 | HARNESS-123-13 | unit | `node tests/test-cache-prune.cjs` | W0 (writes) | pending |
| 123-05-T2 (cache-prune wired into session-start on-version-change + doctor --fix unconditional) | 05 | 5 | HARNESS-123-13 | unit | `node tests/test-cache-prune.cjs` | reads | pending |
| 123-05-T3 (@mindrian_os/cli -> @mindrian_os/install sweep + commands/setup.md L145 URL fix) | 05 | 5 | HARNESS-123-14 | manual+grep | `grep -rln "@mindrian_os/cli" docs/install/ commands/ tests/test-*.sh scripts/` returns nothing | reads | pending |
| 123-07-T1 (Wave 0: resolve-brain-key.cjs + hermetic 8-scenario test) | 07 | 6 | HARNESS-123-15 | unit | `node tests/test-resolve-brain-key.cjs` | W0 (writes) | pending |
| 123-07-T2 (brain-client.cjs::getApiKey delegates to resolve-brain-key) | 07 | 6 | HARNESS-123-15 | unit | `node tests/test-resolve-brain-key.cjs` | reads | pending |
| 123-07-T3 (session-start Brain block -> 3-case status line) | 07 | 6 | HARNESS-123-15 | unit + integration | `bash -n scripts/session-start && grep -q "Brain: HTTP client active" scripts/session-start && ! grep -q "no .mindrian-brain. MCP server resolved" scripts/session-start` | reads | pending |
| 123-07-T4 (SKILL.md step 0 + setup.md chmod 600 + install.sh + BRAIN-SETUP.md + .env.brain.template + CHANGELOG) | 07 | 6 | HARNESS-123-16 | grep | `grep -q "resolve-brain-key" skills/brain-connector/SKILL.md && grep -q "chmod 600" commands/setup.md && grep -q "Authentication: Bearer-only" docs/install/BRAIN-SETUP.md` | reads | pending |
| 123-06-T1 (pre-flight + CHANGELOG composition for [Unreleased]) | 06 | 7 | HARNESS-123-17 | unit + integration | `bash tests/run-all.sh && node scripts/doctor.cjs --acceptance --pre-tag` | reads | pending |
| 123-06-T2 (checkpoint: dry-run + operator confirm) | 06 | 7 | HARNESS-123-17 | manual | operator review + dry-run log inspection | n/a (manual) | pending |
| 123-06-T3 (release.sh --prerelease real run -- cut v1.13.0-beta.13) | 06 | 7 | HARNESS-123-17 | integration | `git tag -l v1.13.0-beta.13` returns the tag | n/a (release) | pending |
| 123-06-T4 (docs/CANON-PHASE-MAP.md Part 6 + Part 7 rows) | 06 | 7 | HARNESS-123-17 | grep | `grep -q "Phase 123" docs/CANON-PHASE-MAP.md` | reads | pending |
| 123-06-T5 (checkpoint: Windows operator --acceptance manual gate) | 06 | 7 | HARNESS-123-17 | manual | operator on Windows runs `mindrian-os doctor --acceptance` -- ALL GREEN | n/a (manual) | pending |

*Status: pending = blue circle | green = green check | red = red X | flaky = yellow warning*

---

## Wave 0 Requirements

- [ ] `tests/test-release-bump-algebra.cjs` -- semver `inc` cases incl. the `patch`-finalizes correction + the 1.12.5.1 non-semver case (Plan 01 Task 1)
- [ ] `tests/test-install-state-record.cjs` -- record fixture + single-writer assertion + Pitfall-7 fix verification (Plan 02 Task 1)
- [ ] `tests/test-doctor-class-i.cjs` -- 6 scenarios: absent record / wrong LV / legacy+marketplace-cache migration / dirty legacy refused / dev-clone NEVER touched / 1.12.5.1 string-equality (Plan 03 Task 1)
- [ ] `tests/test-doctor-class-j.cjs` -- 5 scenarios: all-surfaces-present / missing marker re-stamp / wrong settings.json statusLine / dev-clone surface skipped on user box / dev-clone surface checked on dev box (Plan 03 Task 1)
- [ ] `tests/test-doctor-acceptance.cjs` -- 6 scenarios: --pre-tag filters / verify-release called once / sub-check failure -> non-zero / npx sandbox cleanup / release.sh ordering / release-beta-smoke.sh deleted (Plan 04 Task 1)
- [ ] `tests/test-cache-prune.cjs` -- 6 scenarios: 5-version prune / corrupt installed_plugins.json skip / dry-run / only-active no-op / active-protection belt+suspenders / Canon Part 8 grep (Plan 05 Task 1)
- [ ] `tests/test-resolve-brain-key.cjs` -- 8 scenarios: env wins / ~/.mindrian.env wins over CWD .env / CWD .env / not-found / SEC-02 POSIX 0o077 / Canon Part 8 grep / getApiKey delegation / brain-client preconditions (Plan 07 Task 1)
- [ ] `tests/test-release-npm-gate.sh` -- UPDATE existing: `@mindrian_os/cli` -> `@mindrian_os/install` expectations (Plan 01 Task 3; re-confirmed in Plan 05 Task 3)
- [ ] Register all new `.cjs` tests in `tests/run-all.sh` AND `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` (Phase-123 block; each plan registers its own tests)
- [ ] No new test framework -- `doctor.cjs` already honors `MINDRIAN_PLUGIN_HOME` for hermetic fixtures; the makeTmpHome pattern is copied from `tests/test-doctor-class-g.cjs`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator confirms readiness to cut beta.13 (Plan 06 checkpoint 1) | HARNESS-123-17 | High-impact irreversible action -- a release tag + npm publish + push to 2 repos must have human blessing | Plan 06 Task 2 (`checkpoint:human-verify`): operator reviews the dry-run output + the CHANGELOG entry + the commits-ahead state; replies "approved" or describes concerns |
| `mindrian-os doctor --acceptance` (full) green on a real Windows box (Plan 06 checkpoint 2) | HARNESS-123-17 | Needs a Windows install + the published npm version + the marketplace ref -- can't be exercised in CI here; this is the gate that unblocks promotion to clean 1.13.0 | Plan 06 Task 5 (`checkpoint:human-verify`): Lawrence/operator runs `/plugin marketplace update && claude plugin update mos@mindrian-marketplace` -> restart Claude Code -> `mindrian-os doctor --acceptance` -> all green; replies "windows-acceptance green; ready to promote to 1.13.0" or describes failures |
| `brain-connector` skill's new "step 0" actually makes a model on an HTTP-path install detect the live Brain | HARNESS-123-15 | Behavioral -- depends on the model reading SKILL.md correctly; structurally testable only that the branch text + Tool Names CLI row exist | `grep -q "resolve-brain-key" skills/brain-connector/SKILL.md` (structural) + manual: a session on a `~/.mindrian.env`-only install (no `mindrian-brain` MCP) confirms Larry pulls Brain context |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the 2 manual-only checkpoints in Plan 06 are the only exceptions; both are documented above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every plan opens with a Wave 0 task that writes the test)
- [x] Wave 0 covers all MISSING references (the 7 new `tests/test-*.cjs` files are all Wave-0 commitments)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (hermetic fixtures, no network)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-05-13
