---
phase: 369
slug: ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-02
---

# Phase 369 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `369-RESEARCH.md` section
> "Validation Architecture" (2026-10-02); the planner fills the per-task rows, the executor flips statuses.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | House pattern: plain Node CJS scripts with PASS/FAIL counters and `node:assert/strict` (1,281 of 1,374 `tests/test-*.cjs` files do not use `node:test`); phase aggregator `tests/run-all-<phase>.sh` with `run` / `run_if` legs, exit 77 = SKIPPED (ENV GAP), a long-dash guard leg (models: `tests/run-all-267.sh`, `tests/run-all-357.sh`) |
| **Config file** | none (scripts); UI package tests run under the UI package's own scripts plus Playwright from the spike-local install (Playwright 1.63.0 with Chromium in `.planning/spikes/006-room-pull-checkpoint/`) or a walled-off dev package |
| **Quick run command** | `node tests/test-369-<topic>.cjs` |
| **Full suite command** | `bash tests/run-all-369.sh` |
| **Estimated runtime** | unmeasured until Wave 0 lands the aggregator; the live-daemon legs (sessionful acceptance, cross-process change log) and the Playwright e2e legs dominate |

Node: 22.23.1 via nvm (`/usr/bin/node` is v20, below the floor; PATH order matters in every command). Node 22.18.0 is not installed and Docker's daemon is not running, so the exact-floor and clean-machine legs fall back to a hermetic `$HOME` with a staged install layout, or exit 77.

---

## Sampling Rate

- **After every task commit:** Run the plan's own `node tests/test-369-<topic>.cjs` file(s) plus `node scripts/check-substrate.cjs --diff`
- **After every plan wave:** Run `bash tests/run-all-369.sh`
- **Before `/gsd-verify-work`:** `bash tests/run-all-369.sh`, `bash tests/run-all-267.sh`, `bash tests/run-all-238.sh` (ledger), `bash tests/run-all-198.sh` (MCP-first), `node scripts/build-connector-registry.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance` must all be green
- **Max feedback latency:** one quick run per task; a quick run that needs the live daemon or Playwright is `run_if` and reports exit 77 when its environment is absent rather than blocking the commit

---

## Per-Task Verification Map

The planner replaces the family rows with one row per task (`369-NN-TT`) and mints the REQ-IDs from these families (`369-RESEARCH.md` "Phase Requirements"). Threat refs come from each plan's `<threat_model>` (ASVS L1).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | TS369 | - | erasable gate passes on the tree, fails on a forbidden fixture (enum, namespace, parameter property) | unit | `node tests/test-369-ts-erasable-gate.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | TS369 | - | floor is `>=22.18.0` in package.json and CLAUDE.md with the reason stated | unit | `node tests/test-236-engines-floor.cjs` (updated) | ✅ (update) | ⬜ pending |
| TBD | TBD | 0 | TS369 | - | installed layout runs; `.ts` refused under `node_modules` | integration | `node tests/test-369-installed-layout.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | TS369 | - | no hook reaches a TS module; cold-start baseline recorded against the 2000 ms budget | static + measurement | `node tests/test-369-hook-require-graph.cjs`; `node scripts/measure-hook-cold-start.cjs --json` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | TS369 | - | clean machine at exactly 22.18.0 passes install and a hook run | integration | installed-layout test with `NODE_BIN` pinned; exit 77 locally | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | CHG369 | T-369-xx | triggers and epoch installed after migrations, all three schema variants; `room_change_log` and `room_tx_context` registered in `.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml` before any DDL is staged | unit | `node tests/test-369-change-log-ddl.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 1 | CHG369 | T-369-xx | every writer-inventory row logs; rollback logs nothing; `INSERT OR IGNORE` that ignores logs nothing; the inventory regex finds no unlisted mutation site | unit | `node tests/test-369-writer-inventory.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 1 | CHG369 | T-369-xx | another process's write appears in the log; the Python writer (`scripts/rs-engine.py`) fires the triggers | integration | `node tests/test-369-change-log-cross-process.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 1 | FEED369 | T-369-xx | paging, deletes as rows, `checkpoint_expired`, `epoch_changed`, snapshot then tail | integration | `node tests/test-369-room-changes.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 1 | FEED369 | - | SSE vocabulary pinned; `room.changed` published on a cross-process write | unit + integration | `node tests/test-369-sse-room-changed.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 1 | FEED369 | - | baselines refreshed (tool count, connector registry, schema budget) | regression | `node tests/test-267-mcpv2-registration-api.cjs`; `node scripts/build-connector-registry.cjs --check`; `node tests/test-270-tool-schema-budget.cjs` | ✅ | ⬜ pending |
| TBD | TBD | 1 | SESS369 | T-369-xx | bind, mint, cross-client isolation, answer, reconnect on the legacy sessionful path; the modern arm documented | integration (live daemon) | `node tests/test-369-sessionful-acceptance.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 2 | GREC369 | T-369-xx | replay after a lost response; restart; room switch; stale subject; a persistence failure leaves the gate answerable | integration | `node tests/test-369-gate-recovery.cjs` | ❌ (needs Phase 289) | ⬜ pending |
| TBD | TBD | 2 | HUM369 | T-369-xx | agent self-approval refused; a forged `principal` ignored; a browser click ratifies | integration | `node tests/test-369-human-only.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 2 | RXP369 | - | catch-up, live update, 200-write burst with 0 missing, kill and restart converge, hard delete, warm reload 0 docs, multi-tab, compaction rebuild, schema-bump rebuild, removed-room purge | e2e (Playwright) | `node tests/e2e-369/replica.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 2 | CANON369 | T-369-xx | only 127.0.0.1 contacted; bundle has no `rxdb.info` or `fonts.googleapis`; radius 0; ochre never text on paper | e2e + static | `node tests/e2e-369/egress-and-canon.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 3 | SHELL369 | T-369-xx | the one recoverable journey: open the correct room, inspect evidence, decide, see it persisted, restart both servers, recover | e2e | `node tests/e2e-369/journey.cjs` | ❌ | ⬜ pending |
| TBD | TBD | 1 | BAKE369 | - | the nine measures recorded for both candidates | harness | `node ui/bakeoff/measure.cjs --candidate workroom` and `--candidate agent-native` | ❌ | ⬜ pending |
| TBD | TBD | 3 | CM369 | - | counts for gate latency, catch-up time, lost writes emitted (counts only, SEED-074) | unit | inside the replica and journey e2e outputs | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-369.sh` with every leg pre-declared as `run_if` (the 267/357 "written once" rule) and the long-dash guard leg
- [ ] `tests/helpers/mcp-daemon-369.cjs` - hermetic flag-ON daemon spawn and port read, lifted from `tests/test-267-mcpv2-flag-on.cjs` lines 90-166 and `tests/helpers/mcp-wire-267.cjs` `hermeticEnv`
- [ ] `tests/fixtures/369/writer-inventory.json` (the inventory table as data) and a fixture-room builder (the `tests/helpers/fixture-room-*.cjs` pattern) with all three schema variants
- [ ] `tools/ts-check/` walled-off package (typescript 7.0.2, `@types/node@22`) and `tsconfig.core.json`; TypeScript, UI and build packages never enter the root manifest, not even as devDependencies (the loader runs `npm ci --ignore-scripts` with no `--omit`; `tests/test-341-*` requires zero dev entries in the shrinkwrap)
- [ ] SSE vocabulary pin test (none exists today)
- [ ] Playwright entry for e2e (reuse the spike 006 install or add a walled-off dev package)
- [ ] `tests/test-369-ts-erasable-gate.cjs`, `tests/test-369-installed-layout.cjs`, `tests/test-369-hook-require-graph.cjs` stubs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The navigator's own click test on the winning chassis (and spike 007's still-owed click) | SHELL369 | a human press is the thing being proven | open the shell on the fixture room, press Confirm on the preselected recommendation, confirm the decision node and the live view |
| The D-04 co-design session and its signed design note | CANON369 | the statusline co-design rule forbids a solo pick | AskUserQuestion session from the four STATUSLINE-CONTRACT tiers; note filed in the phase directory |
| The D-07 Decision Gate on the bake-off table | BAKE369 | the navigator chooses the chassis | present the nine measures for both candidates as an AskUserQuestion card; record the choice |
| Visual review against Canon v3 | CANON369 | contrast is automated, composition is not | screenshots of the opening screen, the gate button and the evidence view attached to the plan summary |
| Desktop and Cowork show the one plain "runs on your machine from Claude Code" line | SHELL369 (D-03) | MCPV2-13's human Desktop smoke is still owed and is not this phase's gate | open the plugin on Desktop, confirm the line and that nothing simulates execution |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: a quick run per task; environment-gated legs exit 77 instead of blocking
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
