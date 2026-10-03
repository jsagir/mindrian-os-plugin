---
phase: 289
slug: seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-03
---

# Phase 289 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `289-RESEARCH.md` "Validation Architecture" (2026-10-03); per-task rows filled by the planner (2026-10-03, 9 plans, 22 tasks); the executor flips statuses (plan 289-09 at close).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node CJS, `node:assert`, PASS/FAIL counters, exit 1 on any FAIL, exit 77 = ENV GAP (house pattern, `tests/run-all-366.sh:6-30`) |
| **Config file** | none |
| **Quick run command** | `export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH" && node tests/test-289-capability-ruling.cjs && node tests/test-238-session-scoped-ledger.cjs` |
| **Full suite command** | `bash tests/run-all-289.sh` |
| **Estimated runtime** | unmeasured until Wave 0 lands the aggregator; the live legs (hermetic stdio spawns and one flag-ON daemon per live test) dominate, the dual-era leg runs last |

Node 22.23.1 via nvm (`/usr/bin/node` is v20, below the floor). A peer session executes Phase 369 on the same tree: every test here is hermetic (no writes outside a temp HOME and ROOMS_HOME), and a live leg exits 77 rather than failing when its daemon cannot start.

Baseline measured at planning (2026-10-03, HEAD d511f4c04, before any Phase 289 edit): green: test-238-session-scoped-ledger (10), test-238-chain-chosen-validation (6), test-267-mcpv2-gate-premise (PASS=5), test-365-floor-notice, test-365-acceptance-floor, test-365-never-do-gate (75), test-265, test-198-gate-renderers, shape-f8-renderer.test (10), test-238-one-ledger, test-c55, test-h27, test-189, test-347, test-363-mcp-tool (15), test-366-mcp-release-route (13), test-276-meeting-gate-wiring, test-198-chain-run-halt, test-210-trailer-relevance, test-help-selector-lanes, test-276 findings closed, `check-tool-honesty --check`, every generator `--check`. `check-shape-declaration --check` is advisory (exit 0 always); its WARN lines naming the touched surfaces were exactly two, both pre-existing (commands/radar.md and skills/radar/SKILL.md declare hitl_shape F.8 AND connector.excluded:true). Red: test-238-chosen-validation (case 1, "expected memory_event count to increase by exactly 1 (before=0, after=2)", healed by 289-05), test-192 (Assertion B, healed by 289-06), test-198-local-only (`lib/mcp/tools/sensors.cjs: forbidden token 'brain-client.cjs'`; green since the peer reworded sensors.cjs at 615e7ac41, so it carries no tolerance), test-237-approve-executes (`MUTATION -- could not build the mutated copy`, pre-existing, not owned). Tool honesty: test-276 was green at d511f4c04, went red when Phase 364-08 (31381c8dc) added a scanned branch the frozen fixture lacked, and is green again after the peer re-froze the fixture at 011baa7e5. The sweep size is measured at execution, never hardcoded; this phase never re-freezes the fixture and declares no tolerance for test-276.

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` command (each listed below)
- **After every plan wave:** `bash tests/run-all-289.sh`, `bash tests/run-all-238.sh`, `bash tests/run-all-198.sh` (required green)
- **Before `/gsd-verify-work`:** the above plus `bash tests/run-all-267.sh` and `bash tests/run-all-354.sh` (both carry flipped files), `node tests/test-276-tool-honesty-findings-closed.cjs`, `node scripts/check-tool-honesty.cjs --check`, the check-shape-declaration WARN-line check for the touched surfaces (the lint is advisory, so its exit code proves nothing), `node scripts/doctor.cjs --acceptance` (plan 289-09)
- **Max feedback latency:** one task command per task; a leg that needs the live daemon reports exit 77 when its environment is absent

---

## Per-Task Verification Map

One row per task (22 tasks across 9 plans). Wave 0 tasks (plans 01-03) write RED-first tests: their command is expected to exit 1 (or 77 for a live leg) until the fix plan named in "Requirement" lands. Threat refs are the T-289-NN-MM ids in each plan's `<threat_model>`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 289-01-01 | 01 | 1 | VAL289-01 | T-289-01-04 | aggregator written once; exit 77 counted SKIPPED, never PASSED; dual-era leg last; 369 probe closing leg; long-dash guard | static | `bash -n tests/run-all-289.sh` | ❌ W0 | ⬜ pending |
| 289-01-02 | 01 | 1 | CARD289-01, CARD289-06 | T-289-01-05 | matrix: Claude surface plus declared gives card; recognized non-Claude host keeps rung (a); five delegates agree (RED at W0) | unit | `node tests/test-289-capability-ruling.cjs` | ❌ W0 | ⬜ pending |
| 289-01-03 | 01 | 1 | CARD289-02 | T-289-01-02, T-289-01-04 | the only test carrying "Normal card on CLI"; stdio 2025 x2 surfaces, stdio 2026, HTTP daemon 2026 (plus legacy); no leaked process (RED at W0) | live, hermetic | `node tests/test-289-cli-card-dual-era.cjs` | ❌ W0 | ⬜ pending |
| 289-02-01 | 02 | 1 | LEDGER289-01, LEDGER289-02, LEDGER289-03 | T-289-02-01..04 | owner-after-stranger; chosen refusal then ratify; unbound then bind then ratify; replay refused; concurrent answers ratify once; 369-07 text rule (RED at W0) | unit + in-process MCP | `node tests/test-289-ledger-consume-after-checks.cjs` | ❌ W0 | ⬜ pending |
| 289-02-02 | 02 | 1 | CONTRACT289-01..04, CARD289-05 | T-289-02-05 | recommended id found BY VALUE at `rendered.contract.recommended`, top-ranked; basket null; real option count; live daemon rehearsal of 369 probe part 1 (RED at W0) | unit + live | `node tests/test-289-contract-recommended.cjs` | ❌ W0 | ⬜ pending |
| 289-03-01 | 03 | 1 | ELICIT289-01, ELICIT289-02 | T-289-03-01, T-289-03-02 | default = recommended id, instruction title, SDK safeParse; live: VS Code client gets one defaulted dialog, unknown client gets the card (RED at W0) | unit + live | `node tests/test-289-elicit-default.cjs` | ❌ W0 | ⬜ pending |
| 289-03-02 | 03 | 1 | MENU289-03 | T-289-03-03, T-289-03-04 | fence over commands/*.md, paragraph rule, two-entry allow-list, stale entry fails, anti-vacuity passes (failures=7 at W0) | static | `node tests/test-289-menu-fence.cjs` | ❌ W0 | ⬜ pending |
| 289-04-01 | 04 | 2 | CARD289-01, CARD289-06 | T-289-04-02, T-289-04-06 | one shared detectGateCapabilities; pickRenderer and test-198:35 unchanged; no Part 8 token | unit | `node tests/test-289-capability-ruling.cjs --arm ruling-matrix && node tests/test-198-gate-renderers.test.cjs` | ✅ after W0 | ⬜ pending |
| 289-04-02 | 04 | 2 | CONTRACT289-01, CONTRACT289-02, CONTRACT289-03, CARD289-05 | T-289-04-01, T-289-04-03, T-289-04-04 | recommended id on rungs (b) and (c), single-select only; F.8 renderer untouched; "0 options" fixed; test-365 D4 re-pinned (plain-b, rich-b) | unit + live | `node tests/test-289-contract-recommended.cjs --arm unit --arm live && node tests/test-365-floor-notice.cjs` | ✅ after W0 | ⬜ pending |
| 289-04-03 | 04 | 2 | ELICIT289-01 | T-289-04-05 | requestedSchema default and instruction title, capped at 120; test-365 D4 re-pinned (plain-a, rich-a) | unit | `node tests/test-289-elicit-default.cjs --arm unit && node tests/test-265-gate-render-elicit-schema.cjs && node tests/test-365-floor-notice.cjs` | ✅ (edit) | ⬜ pending |
| 289-05-01 | 05 | 2 | LEDGER289-01, LEDGER289-02, LEDGER289-05 | T-289-05-01, T-289-05-02 | consumeGate checks the session before its one `_ledger.delete(`; peekGate non-consuming; owner-after-stranger arm | unit | `node tests/test-238-session-scoped-ledger.cjs && node tests/test-289-ledger-consume-after-checks.cjs --arm ledger` | ✅ (edit) | ⬜ pending |
| 289-05-02 | 05 | 2 | LEDGER289-03, LEDGER289-05 | T-289-05-03, T-289-05-04, T-289-05-05 | gate_answer peeks, refuses, consumes before the first write, no await between; case 5 and K3 flipped; case 1 healed with its root cause | in-process + live | `node tests/test-289-ledger-consume-after-checks.cjs --arm gate-answer && node tests/test-238-chosen-validation.cjs && node tests/test-354-concurrency-surfaces.cjs` | ✅ (edit) | ⬜ pending |
| 289-05-03 | 05 | 2 | LEDGER289-04, LEDGER289-05 | T-289-05-01, T-289-05-06 | chain resume peeks, refuses chosen and session, then consumes; Case 5 flipped; residual (throw after consume) stated | in-process | `node tests/test-289-ledger-consume-after-checks.cjs && node tests/test-238-chain-chosen-validation.cjs && bash tests/run-all-238.sh` | ✅ (edit) | ⬜ pending |
| 289-06-01 | 06 | 2 | MENU289-01 | T-289-06-01..05 | /mos:pipeline chain selection and resume are F.1 cards; `--list` floor; "Do not auto-select." kept; chain-select F.1 gate stage; mirror regenerated | static | `node tests/test-289-menu-fence.cjs commands/pipeline.md && node scripts/build-skill-mirrors.cjs --check` plus the WARN-line diff against `/tmp/t289-shape-before-06.txt` (zero new lines) | ✅ (edit) | ⬜ pending |
| 289-06-02 | 06 | 2 | MENU289-01, MENU289-02 | T-289-06-01, T-289-06-02 | find-analogies Step 6 card; test-192 Assertion B on the 3-card contract | static | `node tests/test-192-menu-sweep-live-selectors.cjs && node tests/test-289-menu-fence.cjs commands/pipeline.md commands/find-analogies.md commands/ignite.md commands/systems-thinking.md` | ✅ (edit) | ⬜ pending |
| 289-07-01 | 07 | 3 | CARD289-04 | T-289-07-05 | 267 premise and dual-era arms and 365 acceptance-floor rung a flipped first (premise RED until 289-07-02) | unit + live | `node tests/test-365-acceptance-floor.cjs && node --check tests/test-267-mcpv2-dual-era.cjs` | ✅ (edit) | ⬜ pending |
| 289-07-02 | 07 | 3 | CARD289-01, CARD289-02, CARD289-06, CONTRACT289-04, ELICIT289-02 | T-289-07-01..03, T-289-07-05, T-289-07-06 | five one-line delegates; dual-era green on both eras; research passthrough; no description or schema moved; tool honesty regression green | unit + live | `node tests/test-289-capability-ruling.cjs && node tests/test-289-cli-card-dual-era.cjs && node tests/test-267-mcpv2-dual-era.cjs && node tests/test-267-mcpv2-gate-premise.cjs && node tests/test-276-tool-honesty-findings-closed.cjs && node scripts/check-tool-honesty.cjs --check` | ✅ after W0 | ⬜ pending |
| 289-07-03 | 07 | 3 | CARD289-03 | T-289-07-04 | ruling file carries one `Ruling:` line naming the passing dual-era test, first test path in the file | artifact | `grep -q '^Ruling:.*tests/test-289-cli-card-dual-era\.cjs' .planning/phases/289-*/289-CLI-CARD-RULING.md && node tests/test-289-cli-card-dual-era.cjs` | ❌ (07) | ⬜ pending |
| 289-08-01 | 08 | 3 | MENU289-01 | T-289-08-01, T-289-08-02, T-289-08-04 | radar domain picker and deck room picker cards with the 4-option escape hatch and text floor | static | `node tests/test-289-menu-fence.cjs commands/radar.md commands/deck.md && node scripts/build-skill-mirrors.cjs --check` | ✅ (edit) | ⬜ pending |
| 289-08-02 | 08 | 3 | MENU289-01, MENU289-03 | T-289-08-01, T-289-08-05 | new-project adopt card and skill expert picker; full fence green, no stale entry | static | `node tests/test-289-menu-fence.cjs && node tests/test-192-menu-sweep-live-selectors.cjs` plus the WARN-line diff against `/tmp/t289-shape-before-08.txt` (zero new lines) | ✅ (edit) | ⬜ pending |
| 289-09-01 | 09 | 4 | VAL289-01 | T-289-09-01, T-289-09-02 | phase suite green with the dual-era leg RUN; regression set green or classified (renderer ladder, F.8 canon, one ledger, wire snapshot, tool honesty, shape declarations, doctor acceptance); 369 precondition leg runs once 369-26 lands | integration | `bash tests/run-all-289.sh` (dual-era leg PASSED), `bash tests/run-all-238.sh`, `bash tests/run-all-198.sh` (green), `bash tests/run-all-267.sh`, `bash tests/run-all-354.sh`, test-276, `check-tool-honesty --check`, `doctor --acceptance`, `no-instructions.test.cjs`, WARN lines for the twelve touched surfaces only the two pre-existing radar lines | ✅ after W0 | ⬜ pending |
| 289-09-02 | 09 | 4 | CLOSE289-01 | T-289-09-03..05 | SEED-020 resolved with shipped scope; Theo handoff in the phase dir; requirements close-out block for the orchestrator | artifact | `grep -q '^status: resolved' .planning/seeds/SEED-020-shape-f-is-the-universal-mindrian-ui.md && test -f .planning/phases/289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui/289-THEO-HANDOFF.md` | ❌ (09) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Downstream check (not a task row): `tests/run-all-289.sh` closes with `run_if ... tests/test-369-289-precondition.cjs`, Phase 369's three-part probe (recommended id by value, owner-after-stranger, the ruling artifact). The file exists only once 369 plan 26 lands; until then the leg reports SKIPPED (missing ...). The same suite also runs 369-07's `tests/test-369-sessionful-acceptance.cjs` (its arm 4 flips to the owner-after-stranger ratified line by itself once 289-05 lands) and, when present, 369-21's `tests/test-369-human-only.cjs`.

---

## Wave 0 Requirements

- [ ] `tests/test-289-capability-ruling.cjs` (CARD289-01, CARD289-06) - plan 289-01
- [ ] `tests/test-289-cli-card-dual-era.cjs` containing the literal "Normal card on CLI" (CARD289-02), the only Phase 289 test carrying it; process hygiene copied from `tests/test-267-mcpv2-dual-era.cjs:85-146` and `277-301`; daemon spawn copied from `tests/test-267-mcpv2-flag-on.cjs:106-150`; `hermeticEnv` from `tests/helpers/mcp-wire-267.cjs` (59-80) - plan 289-01
- [ ] `tests/test-289-ledger-consume-after-checks.cjs` (LEDGER289-01..03) - plan 289-02
- [ ] `tests/test-289-contract-recommended.cjs` (CONTRACT289-01..04, CARD289-05) - plan 289-02
- [ ] `tests/test-289-elicit-default.cjs` (ELICIT289-01..02) - plan 289-03
- [ ] `tests/test-289-menu-fence.cjs` and `tests/fixtures/289/menu-fence-allowlist.json` (MENU289-03) - plan 289-03
- [ ] `tests/run-all-289.sh` written once, modeled on `tests/run-all-366.sh`: `run` for existing files, `run_if <label> <file> <cmd>` for not-yet-landed legs, `run_known_if` for the one pre-existing red (test-237), counters PASSED / FAILED / SKIPPED / KNOWN, exit 77 counted as SKIPPED (ENV GAP) never as PASS, final exit 1 on any FAILED; legs in wave order with the live dual-era leg last and a closing `run_if` leg for `tests/test-369-289-precondition.cjs`; a long-dash guard leg - plan 289-01
- [ ] `.planning/phases/289-*/289-CLI-CARD-RULING.md` (`git add -f`), written by plan 289-07 (the plan that turns CARD289-02 green), with its `Ruling:` line naming that test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The card renders on the navigator's own Claude Code (2.1.287 or later) for one real gate | CARD289-02 | the test proves the server's choice; the host's rendering is observed by a person; a main commit is not live until a release is cut and picked up by the installed plugin | after the next release is installed, fire `/mos:suggest-next` or any gated command on the CLI; confirm an AskUserQuestion card and no elicitation dialog; record the build number |
| Theo handoff note delivered | D-08 | a cross-repo note, no code | plan 289-09 files `289-THEO-HANDOFF.md` in this phase dir (orchestrator instruction: not under ~/Theo), naming `gate-render.ts:38, 106` and `289-CLI-CARD-RULING.md`; no Theo edit |
| SEED-020 status reflects shipped scope | D-08 | a judgment of what "shipped" means | read the seed after plan 289-09; confirm it names help 9a18fe81d and 28f95106b, Phase 192 and Phase 289, and records the canon note as an open navigator item |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: a task command per task; environment-gated legs exit 77 instead of blocking
- [ ] `nyquist_compliant: true` set in frontmatter only when the live dual-era leg has RUN (exit 0, not 77)

**Approval:** pending
