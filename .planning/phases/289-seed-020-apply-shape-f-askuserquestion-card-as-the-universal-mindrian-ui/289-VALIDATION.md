---
phase: 289
slug: seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-03
---

# Phase 289 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `289-RESEARCH.md` "Validation Architecture" (2026-10-03); the planner fills the per-task rows, the executor flips statuses.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node CJS, `node:assert`, PASS/FAIL counters, exit 1 on any FAIL, exit 77 = ENV GAP (house pattern, `tests/run-all-366.sh:6-30`) |
| **Config file** | none |
| **Quick run command** | `export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH" && node tests/test-289-capability-ruling.cjs && node tests/test-238-session-scoped-ledger.cjs` |
| **Full suite command** | `bash tests/run-all-289.sh` |
| **Estimated runtime** | unmeasured until Wave 0 lands the aggregator; the live dual-era leg (hermetic daemon spawn, three eras) dominates |

Node 22.23.1 via nvm (`/usr/bin/node` is v20, below the floor). A peer session executes Phase 369 on the same tree: every test here must be hermetic (no writes outside a temp HOME and ROOMS_HOME), and a live leg exits 77 rather than failing when its daemon cannot start.

---

## Sampling Rate

- **After every task commit:** the quick run command plus the test file the task edits
- **After every plan wave:** `bash tests/run-all-289.sh`, `bash tests/run-all-238.sh`, `bash tests/run-all-198.sh`
- **Before `/gsd-verify-work`:** the above plus `bash tests/run-all-267.sh` and `bash tests/run-all-354.sh` (both carry flipped files), `node tests/test-276-tool-honesty-findings-closed.cjs`, `node scripts/check-tool-honesty.cjs --check`, `node scripts/check-shape-declaration.cjs`, `node scripts/doctor.cjs --acceptance` all green
- **Max feedback latency:** one quick run per task; a leg that needs the live daemon is `run_if` and reports exit 77 when its environment is absent

---

## Per-Task Verification Map

The planner replaces the family rows with one row per task (`289-NN-TT`) and mints the REQ-IDs from `289-RESEARCH.md` "Phase Requirements" (CARD289-01..06, LEDGER289-01..05, CONTRACT289-01..04, ELICIT289-01..02, MENU289-01..03). Threat refs come from each plan's `<threat_model>`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | CARD289-01 | - | five delegates agree; Claude surface gives `elicitation:false, elicitation_declared:true, claudeCode:true`; null surface plus declared gives elicitation (non-Claude host, D-02) | unit | `node tests/test-289-capability-ruling.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | CARD289-02 | - | "Normal card on CLI": stdio era 2025 plus declared elicitation gives 0 elicitation requests and renderer askuserquestion; stdio era 2026 the same; HTTP daemon (surface cowork) with a 2026 client declaring elicitation gives 0 requests | live, hermetic | `node tests/test-289-cli-card-dual-era.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | CARD289-03 | - | ruling file carries a `Ruling:` line and names CARD289-02's test, which exits 0 | artifact | `grep -q '^Ruling:' .planning/phases/289-*/289-CLI-CARD-RULING.md` | ❌ | ⬜ pending |
| TBD | TBD | 1 | CARD289-04 | - | the two 267 arms flipped; the premise arm keeps "2.1.280" | live + unit | `node tests/test-267-mcpv2-dual-era.cjs && node tests/test-267-mcpv2-gate-premise.cjs` | ✅ (edit) | ⬜ pending |
| TBD | TBD | 1 | CARD289-05 | - | the rung (b) imperative names the real option count | unit | `node tests/test-289-contract-recommended.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | CARD289-06 | - | a recognized non-Claude host that declares elicitation keeps rung (a); a Claude host never does | unit | `node tests/test-289-capability-ruling.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | LEDGER289-01..03 | T-289-xx | owner-after-stranger; a chosen-option refusal then the correct answer ratifies; an unbound-room refusal then bind then answer ratifies; replay after success refused; two concurrent answers ratify once | unit + in-process MCP | `node tests/test-238-session-scoped-ledger.cjs && node tests/test-238-chosen-validation.cjs && node tests/test-289-ledger-consume-after-checks.cjs` | partly (edit + W0) | ⬜ pending |
| TBD | TBD | 1 | LEDGER289-04 | T-289-xx | a chain resume refusal does not burn the gate | in-process | `node tests/test-238-chain-chosen-validation.cjs` | ✅ (edit) | ⬜ pending |
| TBD | TBD | 1 | LEDGER289-05 | - | K3 flipped in the concurrency surfaces | live | `node tests/test-354-concurrency-surfaces.cjs` | ✅ (edit) | ⬜ pending |
| TBD | TBD | 2 | CONTRACT289-01..04 | - | the recommended id by VALUE equals the top-ranked option on rungs (b) and (c); null with no rank or flag; multi-select stays null; the research grant card carries the planner's recommended id; the live daemon leg (legacy client, bound room, gate_render with ranks) finds the id by value outside `superset_options` and prints its JSON path | unit + live | `node tests/test-289-contract-recommended.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | ELICIT289-01..02 | - | `default` equals the recommended option and passes SDK 2.1.0 safeParse; the field title starts with an instruction; the surviving-rung arm proves where elicitation fires (non-Claude host only) | unit (+ live arm) | `node tests/test-289-elicit-default.cjs && node tests/test-265-gate-render-elicit-schema.cjs` | partly | ⬜ pending |
| TBD | TBD | 2 | MENU289-01..03 | - | `/mos:pipeline` chain selection is an F.1 card with a text floor; the fence finds no unlisted bare-text chooser; test-192 green | static | `node tests/test-289-menu-fence.cjs && node tests/test-192-menu-sweep-live-selectors.cjs` | partly | ⬜ pending |
| TBD | TBD | all | regression | - | renderer ladder, F.8 canon, one ledger, wire snapshot, tool honesty, shape declarations | unit/static | `node tests/test-198-gate-renderers.test.cjs && node lib/hmi/shape-f8-renderer.test.cjs && node tests/test-238-one-ledger.cjs && node tests/test-276-tool-honesty-findings-closed.cjs && node scripts/check-tool-honesty.cjs --check && node scripts/check-shape-declaration.cjs` | ✅ | ⬜ pending |
| TBD | TBD | close | downstream | - | Phase 369's probe passes against this phase's output (recommended id by value, owner-after-stranger, the ruling artifact) | integration | `run_if tests/test-369-289-precondition.cjs` (exists only once 369 plan 26 lands; SKIPPED (missing) until then) | ❌ (369) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-289-capability-ruling.cjs` (CARD289-01, CARD289-06)
- [ ] `tests/test-289-cli-card-dual-era.cjs` containing the literal "Normal card on CLI" (CARD289-02); process hygiene copied from `tests/test-267-mcpv2-dual-era.cjs:85-146` and `277-301`; daemon spawn from `tests/test-267-mcpv2-flag-on.cjs:106-150` and `tests/helpers/mcp-wire-267.cjs` `hermeticEnv` (59-80)
- [ ] `tests/test-289-ledger-consume-after-checks.cjs` (LEDGER289-01..03)
- [ ] `tests/test-289-contract-recommended.cjs` (CONTRACT289, CARD289-05)
- [ ] `tests/test-289-elicit-default.cjs` (ELICIT289)
- [ ] `tests/test-289-menu-fence.cjs` (MENU289-03)
- [ ] `tests/run-all-289.sh` written once, modeled on `tests/run-all-366.sh`: `run` for existing files, `run_if <label> <file> <cmd>` for not-yet-landed legs, counters PASSED / FAILED / SKIPPED, exit 77 counted as SKIPPED (ENV GAP) never as PASS, final exit 1 on any FAILED; legs in wave order with the live dual-era leg last and a closing `run_if` leg for `tests/test-369-289-precondition.cjs`; a long-dash guard leg
- [ ] `.planning/phases/289-*/289-CLI-CARD-RULING.md` (`git add -f`), written by the plan that lands CARD289-02, with its `Ruling:` line naming that test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The card renders on the navigator's own Claude Code (2.1.287 or later) for one real gate | CARD289-02 | the test proves the server's choice; the host's rendering is observed by a person | fire `/mos:suggest-next` or any gated command on the CLI; confirm an AskUserQuestion card and no elicitation dialog; record the build number |
| Theo handoff note delivered | D-08 | a cross-repo note, no code | file the note under `~/Theo/.planning/` naming `gate-render.ts:38, 106` and this phase's ruling file; no Theo edit |
| SEED-020 status reflects shipped scope | D-08 | a judgment of what "shipped" means | read the seed after the closing plan; confirm it names help 9a18fe81d and 28f95106b, Phase 192 and Phase 289 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: a quick run per task; environment-gated legs exit 77 instead of blocking
- [ ] `nyquist_compliant: true` set in frontmatter only when the live dual-era leg has RUN (not exit 77)

**Approval:** pending
