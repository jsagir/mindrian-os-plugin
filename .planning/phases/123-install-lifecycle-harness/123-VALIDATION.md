---
phase: 123
slug: install-lifecycle-harness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 123 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled by the gsd-planner from `123-RESEARCH.md` § "Validation Architecture" + the per-plan task maps. This draft carries the infrastructure facts the researcher established; the planner completes the Per-Task Verification Map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js bare assertions (the existing `tests/test-*.cjs` + `lib/memory/run-feynman-tests.cjs` pattern — no jest/vitest; `process.exit(0/1)` per file) |
| **Config file** | none — tests are self-contained `.cjs` files registered in `tests/run-all.sh` and `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` |
| **Quick run command** | `node tests/test-doctor-class-i.cjs && node tests/test-doctor-class-j.cjs && node tests/test-resolve-brain-key.cjs` (the new-class fixtures — adjust to the actual filenames the planner chooses) |
| **Full suite command** | `bash tests/run-all.sh` (or the scoped `bash tests/run-all-123.sh` if the planner adds one) |
| **Estimated runtime** | ~10–30 seconds (hermetic `MINDRIAN_PLUGIN_HOME` + `HOME` scratch-dir fixtures; no network — Part 8) |

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
| _planner fills_ | 01 | _ | HARNESS-123-01..04 (`release.sh` pre-release bump / one-commit→**two-commit** form / dirty-repo guard / Step 9.5 rename) | unit | `bash tests/test-release-bump-algebra.cjs` (semver `inc` cases incl. the **`patch` finalizes, `minor` does NOT** correction) + `bash tests/test-release-npm-gate.sh` (updated `@mindrian_os/install` expectations) | ❌ W0 | ⬜ pending |
| _planner fills_ | 02 | _ | HARNESS-123-05..06 (`~/.mindrian/install-state.json` record / `data/deployment-surfaces.json` manifest) | unit | `node tests/test-install-state-record.cjs` (hermetic HOME; assert full-snapshot fields + single-writer + the `~/.mindrian-last-version`-fold-in fixes Pitfall 7's no-room staleness) | ❌ W0 | ⬜ pending |
| _planner fills_ | 03 | _ | HARNESS-123-07..09 (doctor **class I** = install-state+topology+6-way version-of-record incl. **Bug 7** fix; **class J** = manifest reconciliation; aggressive `--fix` guardrails) | unit | `node tests/test-doctor-class-i.cjs` + `node tests/test-doctor-class-j.cjs` (mirror `tests/test-doctor-class-g.cjs`'s `makeTmpHome`/`runDoctor` + `tests/test-doctor-atomic-swap.cjs`'s `MINDRIAN_PLUGIN_HOME` builder; synthesize broken record / missing surface / wrong-version `~/.mindrian-last-version` / fake `legacy` clone / 4-component `1.12.5.1`; assert flag-then-`--fix`-recovers; assert `dev-clone` is NEVER touched) | ❌ W0 | ⬜ pending |
| _planner fills_ | 04 | _ | HARNESS-123-10 (`mindrian-os doctor --acceptance` 5-point + `--pre-tag` sub-mode; `release.sh` wiring as hard gates) | unit + integration | `node tests/test-doctor-acceptance.cjs` (assert the 5-point checklist runs; assert `--pre-tag` skips the tag/npm/npx legs; assert it CALLS `verify-release` not duplicates it) | ❌ W0 | ⬜ pending |
| _planner fills_ | 05 | _ | HARNESS-123-11..12 (cache prune keep-active-plus-N / `@mindrian_os/cli`→`@mindrian_os/install` sweep) | unit | `node tests/test-cache-prune.cjs` (hermetic cache dir with active + 4 stale; assert keep active + N=2, never delete active, skip if `installed_plugins.json` unreadable) + `grep -rn "@mindrian_os/cli\|@mindrian/os" .` returns only historical-CHANGELOG matches | ❌ W0 | ⬜ pending |
| _planner fills_ | 07 | _ | HARNESS-123-13..15 (`lib/core/resolve-brain-key.cjs` resolver / 3 consumer rewirings + WARN→status-line / SEC-02 `chmod 600` + doc fixes) | unit | `node tests/test-resolve-brain-key.cjs` (hermetic HOME; assert order env→`~/.mindrian.env`→CWD `.env`→not-found; assert SEC-02 group/world-bit → `available:false` with an explicit `reason`, POSIX-only; assert `brain-client.cjs::getApiKey()` delegates) + `grep -E "fetch\|http\|curl\|brain.mindrian\|tavily" lib/core/resolve-brain-key.cjs` = 0 | ❌ W0 | ⬜ pending |
| _planner fills_ | 06 | _ | HARNESS-123-16 (`v1.13.0-beta.13` cut via the fixed `release.sh`; Windows `--acceptance` validation) | manual + integration | release action: `MOS_TEST_DRY_RUN=1 bash scripts/release.sh --prerelease` (dry-run the pipeline) then the real cut; `mindrian-os doctor --acceptance` on a Windows box (manual — Lawrence/operator) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-release-bump-algebra.cjs` — semver `inc` cases (Plan-1)
- [ ] `tests/test-install-state-record.cjs` — record fixture + single-writer assertion (Plan-2)
- [ ] `tests/test-doctor-class-i.cjs`, `tests/test-doctor-class-j.cjs` — new-class fixtures (Plan-3) — reuse `tests/test-doctor-class-g.cjs` `makeTmpHome`/`runDoctor` + `tests/test-doctor-atomic-swap.cjs` `MINDRIAN_PLUGIN_HOME` scenario-builder
- [ ] `tests/test-doctor-acceptance.cjs` — `--acceptance`/`--pre-tag` checklist (Plan-4)
- [ ] `tests/test-cache-prune.cjs` — prune retention fixture (Plan-5)
- [ ] `tests/test-resolve-brain-key.cjs` — resolver order + SEC-02 fixture (Plan-7)
- [ ] `tests/test-release-npm-gate.sh` — UPDATE existing: `@mindrian_os/cli` → `@mindrian_os/install` expectations (Plan-1/Plan-5)
- [ ] Register all new `.cjs` tests in `tests/run-all.sh` and `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]`; add `tests/run-all-123.sh` scoped runner (optional)
- [ ] No new test framework — `doctor.cjs` already honors `MINDRIAN_PLUGIN_HOME` for hermetic fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `mindrian-os doctor --acceptance` (full) green on a real Windows box | HARNESS-123-16 | Needs a Windows install + the published npm version + the marketplace ref — can't be exercised in CI here; this is the gate that unblocks promotion to clean `1.13.0` | Lawrence/operator: `claude plugin marketplace update && claude plugin update mos@mindrian-marketplace` → restart Claude Code → `mindrian-os doctor --acceptance` → all green |
| `v1.13.0-beta.13` actually cuts via `bash scripts/release.sh --prerelease` (real push + tag + npm publish + marketplace ref pin) | HARNESS-123-16 | Touches GitHub + npm + the marketplace repo — a one-shot release action, not a repeatable test | Maintainer: dry-run first (`MOS_TEST_DRY_RUN=1 bash scripts/release.sh --prerelease`), then the real run; verify the 5-way version consistency + `npm view @mindrian_os/install@1.13.0-beta.13 version` |
| `brain-connector` skill's new "step 0" actually makes a model on an HTTP-path install detect the live Brain | HARNESS-123-14 | Behavioral — depends on the model reading SKILL.md correctly; structurally testable only that the branch text + Tool Names CLI row exist | `grep -q "resolve-brain-key" skills/brain-connector/SKILL.md` + manual: a session on a `~/.mindrian.env`-only install, no `mindrian-brain` MCP, confirms Larry pulls Brain context |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the new `tests/test-*.cjs` files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
