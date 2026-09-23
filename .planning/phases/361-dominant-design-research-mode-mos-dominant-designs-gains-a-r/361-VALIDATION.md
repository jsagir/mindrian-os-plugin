---
phase: 361
slug: dominant-design-research-mode
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-23
---

# Phase 361 -- Validation Strategy

> Per-phase validation contract. Content split out of `361-RESEARCH.md` "## Validation Architecture" (verbatim below) so the Nyquist gate has its standalone file. Wave 0 gaps are closed by plan 361-01; `wave_0_complete` flips when 361-01 lands.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts (`assert`, no node:test, no deps), bash aggregator |
| Config file | none; aggregator `tests/run-all-361.sh` (Wave 0) |
| Quick run command | `node tests/test-361-<name>.cjs` |
| Full suite command | `bash tests/run-all-361.sh` |

Aggregator shape: copy `tests/run-all-356.sh` (`run` / `run_if` guards, exit 0 PASSED, 77 SKIPPED ENV GAP, else FAILED; written once in the first plan, no later plan edits it; an em-dash guard over every 361 surface).

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DDR361-01 | agent frontmatter: `tools` == `allowed-tools` == {two Tavily names, WebSearch, Read}; no Write/Edit/Bash/Brain; excluded + reason; no hitl_shape; layer loop; body has "verbatim", "never" recompose, "sourced or absent", no score keys | unit (text) | `node tests/test-361-agent-contract.cjs` | no, Wave 0 |
| DDR361-02 | 4 lanes composed; each audited; venture proper-noun / money fails closed with `degrade:'local-only'`; edited query re-audited; zero network | unit | `node tests/test-361-lane-queries.cjs` | no, Wave 0 |
| DDR361-03 | command body: gate sentence precedes `Dispatching`; "no send-anyway path"; unattended rule present; quick pass section unchanged | unit (text) | `node tests/test-361-command-contract.cjs` | no, Wave 0 |
| DDR361-04 | dispatch string `subagent_type: dominant-design-researcher`; cap text (2 per lane, one call per query, fixed params); Tri-Polar table | unit (text) | `node tests/test-361-command-contract.cjs` | no, Wave 0 |
| DDR361-05 | validator drops rows missing any D-06 field, counts drops, rejects `score`/`confidence`/`strength`/`probability`/`rank` keys, requires http(s) URL | unit | `node tests/test-361-evidence-pack.cjs` | no, Wave 0 |
| DDR361-06 | empty lane renders an artifact with zero rows and a "Searched, not found" section; row ids stable | unit | `node tests/test-361-evidence-pack.cjs` | no, Wave 0 |
| DDR361-07 | fixture room.db: one EvidenceClaim per unique URL, per-lane session suffix, tier mapping, readback surfaced; absent room.db returns `no_room_db` | integration (fixture db) | `node tests/test-361-filing.cjs` | no, Wave 0 |
| DDR361-08 | analysis template carries `structure_source`, `evidence_pack`, and row-id citation instruction in the command body | unit (text) | `node tests/test-361-command-contract.cjs` | no, Wave 0 |
| DDR361-09 | injected brainClient: null / egress_blocked / not found / other -32602 / zero steps / steps present -> correct source + reason; every call's args deep-equal `{framework:'Dominant Design'}` | unit | `node tests/test-361-theo-structure.cjs` | no, Wave 0 |
| DDR361-10 | classify allows the three shapes, not under wrong tool names, not with extra keys, ambiguous for off-vocabulary names, block for content; find_connections slice sha256 unchanged; hook leg exit codes | unit + hook | `node tests/test-361-egress-shapes.cjs` | no, Wave 0 |
| DDR361-10 | plugin arm keys equal Theo `inputShape` keys in `framework-step.ts` / `framework-techniques.ts` (read-only) | parity | `node tests/test-361-theo-parity.cjs` (exit 77 without checkout) | no, Wave 0 |
| DDR361-11 | generated artifacts in sync; grant row complete; declaration truth | gates | `node scripts/build-command-registry.cjs --check && node scripts/build-connector-registry.cjs --check && node scripts/build-skill-mirrors.cjs --check && node scripts/build-orchestration-projection.cjs --check && node scripts/build-harness-manifest.cjs --check && node scripts/check-layer-declaration.cjs && node tests/test-265-swarm-task-grant.cjs && node tests/test-265-declaration-truth.cjs` | existing |
| DDR361-12 | registry hash differs from the pre-phase commit | unit | `node tests/test-361-command-contract.cjs` (compares `git show <base>:data/command-registry.json` hash) | no, Wave 0 |
| DDR361-13 | quick-pass section and Setup steps byte-compatible with pre-phase text (section slice compare) | unit (text) | `node tests/test-361-command-contract.cjs` | no, Wave 0 |
| manual | live end-to-end on a scratch room (spends credits, writes room) | manual | human-verify | - |

Existing suites to include as plain `run` legs: `node tests/test-260906-fda-known-tool-shapes.cjs`, `node lib/core/part8-egress-guard.test.cjs`, `node tests/test-209-declared-implies-wired.cjs`, `node tests/test-250-doctrine-fence.cjs`, `node tests/test-344-surface-layer-parity.cjs`, `node tests/test-148-engine-reaches.cjs`, `node tests/test-341-registry-drift.cjs`, `node tests/test-265-threshold-fanouts.cjs`, `node tests/test-fileval-readback.cjs`, `node scripts/check-render-coverage.cjs`.

### Sampling Rate
- **Per task commit:** the task's own `node tests/test-361-*.cjs`
- **Per wave merge:** `bash tests/run-all-361.sh`
- **Phase gate:** full suite green plus `node scripts/doctor.cjs --acceptance` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-361.sh` (aggregator, written once)
- [ ] `tests/test-361-agent-contract.cjs`
- [ ] `tests/test-361-lane-queries.cjs`
- [ ] `tests/test-361-evidence-pack.cjs`
- [ ] `tests/test-361-filing.cjs` (reuse the fixture-room pattern from `tests/test-fileval-readback.cjs`)
- [ ] `tests/test-361-theo-structure.cjs`
- [ ] `tests/test-361-egress-shapes.cjs`
- [ ] `tests/test-361-theo-parity.cjs` (`MINDRIAN_THEO_CHECKOUT` seam, exit 77, precedent `tests/test-354-taxonomy-ladder-casing.cjs:91-110`)
- [ ] `tests/test-361-command-contract.cjs`

---

## Sampling Rate (contract)

- After every task commit: that task's `tests/test-361-*.cjs` file(s).
- After every wave: `bash tests/run-all-361.sh` plus the born-wired / projection / registry `--check` gates the wave touched.
- Before verify: `bash tests/run-all-361.sh` green, `node scripts/doctor.cjs --acceptance` unregressed.

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies (plan-checker pass 2026-09-23)
- [x] No watch-mode flags
- [ ] `wave_0_complete` (flips at 361-01)

**Approval:** approved 2026-09-23 (plan-checker, content already present in RESEARCH.md)
