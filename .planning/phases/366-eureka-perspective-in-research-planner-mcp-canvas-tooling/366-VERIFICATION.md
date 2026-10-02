---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
verified: 2026-10-02T16:59:39Z
verified_at_head: 84d90019c
status: human_needed
score: 10/10 roadmap truths verified (EPV366: 29/30 rows closed; EPV366-21 open as a release-lockstep step, not a phase-goal gap)
overrides_applied: 0
release_lockstep:
  - item: "EPV366-21 data half: data/framework-names.json carries no theo_stamp key"
    why_not_a_gap: "The gate, the writer and the docs are built and tested. The stamp must name the version being cut (theo_stamp.mapped_by vs the current plugin version), so it can only be written at release time by `node scripts/refresh-framework-names.cjs --live` after Theo's re-emit. Stamping now would lag again at the next bump. The gate fails closed, so nothing ships silently unstamped."
    consequence: "The next scripts/release.sh cut refuses at RULE 5 place 9 until the refresh runs (or the audited --no-canon-snapshot-check is passed). Phase 366 is on main but not live until that cut."
human_verification:
  - test: "Claude Desktop (and Cowork if available): bind a room with content in two or more sections, ask Larry in plain words to find bottlenecks, then hidden structure, then cross-domain transfers."
    expected: "Larry calls research_run op perspective_recall with perspective rs / hsi / eureka (not the reference-only router stubs), pages with perspective_candidates, runs perspective_judge, and renders the plan card; no ASCII box; nothing leaves the room."
    why_human: "The wire contract is proven over real stdio here, but whether a model on a hookless surface picks the right op from the tool description is model behavior on a live surface."
  - test: "Re-run the mcp-builder evaluation (tests/fixtures/seed103-mcp-eval.xml) against the perspective_* op names, or extend it with one question per non-eureka perspective."
    expected: "An agent answers every question by string match using only research_run."
    why_human: "The eval was authored and run for the wave-1 eureka_* ops (2026-10-01); it needs an LLM agent loop, not a deterministic test, and was not re-run for the six-perspective surface."
---

# Phase 366: Eureka becomes a perspective of the research planner; MCP canvas tooling - Verification Report

**Phase Goal:** Retire Eureka as a standalone engine and finish the Eureka PERSPECTIVE inside the one research planner (Phase 363), with proper MCP tooling for every MOS-CANVAS perspective: recall from the local graph and ICM structure (no embeddings), the room graph as the exclusion set, Jev as a human-routed first-pass judge, research / prose / filing through the planner, and one declared egress policy.
**Verified:** 2026-10-02T16:59:39Z (HEAD 84d90019c, clean tree under lib/ scripts/ tests/ bin/ data/ commands/ skills/ hooks/)
**Status:** human_needed (every automated check passes; two live-surface items remain)
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths (ROADMAP deliverables 1-7 plus the goal clauses)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Wave 1 (SEED-103 branch) is merged and its tests are in the release gate (D1) | VERIFIED | merge `ebd9090cf` is an ancestor of HEAD; `lib/core/claude-routing.cjs`, `scripts/eureka-jev-judge.cjs`, `tests/fixtures/seed103-mcp-eval.xml` present; `bash tests/run-all-seed103.sh` PASSED=20 FAILED=0 (run by verifier); `scripts/release.sh` sources `scripts/release-lib/suite-gate.sh` which shells `tests/run-all-366.sh` |
| 2 | The spike ran with the bar fixed before any arm (D2) | VERIFIED | `tests/fixtures/366-spike/bar.json` committed in `fb8563bf6` (05:04) before the record `c6cf03778` (15:27); `node scripts/spike-366.cjs --check` exit 0, "record.json matches the recomputed record byte for byte" (22,523 bytes). The vector arm is UNMEASURED by the navigator's verbatim ruling "Label the 14 small, rule on vector"; recorded, not hidden |
| 3 | The navigator's rulings are recorded (D3) | VERIFIED | `366-SPIKE-RULINGS.md`: six `<key>: <value>` rulings (judge: stage-a, recall: graph-lexical, engines: keep, runner: retire, jev-runtime: dev-time, haiku: separate-producer) with the verbatim answer "Accept all six (Recommended)" |
| 4 | One declared egress policy read by the audit ledger; `--offline` means none of it; `/mos:eureka` is the quick-run alias with the stale ZERO wording gone (D4) | VERIFIED | `data/egress-policy.json` (7 lines, Jev/citation/entity/vector default off); `lib/core/research-planner/egress-policy.cjs` required by `audit-ledger.cjs`, `quick.cjs`, `deep.cjs`, `theo-lane.cjs`, `canon-release.cjs`; `grep -i "zero network\|zero writes\|--legacy"` on `commands/eureka.md` and `skills/eureka/SKILL.md` finds nothing; the door is `[run\|enable]` and calls `scripts/research-planner.cjs` |
| 5 | Theo readiness: room things carry canon Framework handles (D-10 exact match); `canon_resolved` moves off 0 (D5) | VERIFIED | one resolver `verification-stamp.resolveEndpoint` used by `lib/mcp/tools/views.cjs` (artifact_file), the indexer, recall substrate and `lib/core/doctor/canon-backfill-module.cjs`; the spike's indexed copies of the three 355 fixture rooms report `canon_resolved` 8 / 6 / 6 (`tests/fixtures/366-spike/record.json`), against 0 on the measured room before the phase |
| 6 | MCP canvas tooling for every perspective as planner ops with the same shape, replacing the reference-only stubs (D6) | VERIFIED | Verifier spawned the real `bin/mindrian-mcp-server.cjs` over stdio (JSON-RPC, hermetic HOME) on the fixture room: tools/list = 45 tools, `research_run.perspective` enum = eureka, rs, hsi, whitespace, analogies, connections; `perspective_recall` returned ok with candidates and a validated plan for ALL SIX; `perspective_judge` ok (judge none, human_routed true); `perspective_candidates` paginates (total, has_more); missing perspective refuses `perspective_required`; `eureka_recall` answers `deprecated: true, use_instead: perspective_recall`; router stub `intelligence eureka-run {"legacy":true}` answers the perspective pointer and starts nothing |
| 7 | The standalone runner is retired (D7a) | VERIFIED | `scripts/eureka-command.cjs` and `scripts/eureka-portfolio-report.cjs` deleted in `e5082a9d0` (ancestor of HEAD); `node tests/test-366-runner-retired.cjs` PASS 5 FAIL 0 (RR1-RR5); no `flags.legacy` in `lib/mcp/tool-router.cjs`; remaining mentions are comments, docs, CHANGELOG and stale `dist/` bundles (regenerated at release, F14) |
| 8 | The semantic index moved to `lib/core/semantic-index/` behind a reference-integrity gate (D7b, ADR-E12) | VERIFIED | 13 modules live in `lib/core/semantic-index/` and none remain in `lib/core/eureka/`; `node scripts/check-require-integrity.cjs` OK (2693 files, 6913 references resolve); a grep for `eureka/<moved file>` across lib, scripts, hooks, bin, tests, data, commands, skills finds one comment only (`tests/test-348-validity-window.cjs:38`) |
| 9 | Recall is offline and graph/ICM-only; the room graph is the exclusion set | VERIFIED | `test-366-offline-recall.cjs` PASS 12 (zero sockets across six perspectives, inside run-all-366); live stdio counts show `excluded_known` per perspective (eureka 7, rs 3, hsi 3, analogies 7) |
| 10 | Part 8 guard `navigator_released` arm: release only on a navigator receipt, after the content scan | VERIFIED | Verifier probed `lib/core/part8-egress-guard.cjs classify()`: `{raw}` + receipt `{gate_id: gate-<16hex>, term}` on `normalize_framework_name` -> allow / navigator_released; no receipt, term mismatch, extra key, other tool or off-registry perspective -> ambiguous; an email term with a receipt -> block content_set. The arm sits after `scanForContent` in `classify`. The 366-11 live round trip was navigator-approved ("APPROVED", gate-279684576db21bb1, a MISS) and replays offline |

**Score:** 10/10 truths verified.

### Release-lockstep item (EPV366-21): judged NOT a phase-goal blocker

`data/framework-names.json` has no `theo_stamp` key at all (the handoff says "null"; the key is absent, which the gate reads as NOSTAMP, same effect). Everything the phase owns for EPV366-21 exists and is tested: `scripts/release-lib/canon-snapshot-gate.sh` is sourced by `scripts/release.sh` (refuses on NOSTAMP or a lagging `mapped_by`, `--no-canon-snapshot-check` audited opt-out), `scripts/refresh-framework-names.cjs --live` writes the stamp, RULE 5 place 9 and `.claude/includes/release-process.md` name it, and `test-366-snapshot-gate`, `test-343-theo-stamp-gate`, `test-349-docs-lockstep` are green inside run-all-366.

Why it is release-lockstep and not a gap: the stamp is compared to the version being cut, so a stamp written today would lag again after the next bump; it can only be correct when written during the release ceremony after Theo's re-emit. The phase goal (Eureka as a perspective, MCP canvas tooling) does not depend on it. The consequence is real, though: the next `release.sh` cut refuses at place 9 until the refresh runs, and Phase 366 is not live for users until that cut. The automatic leading edge (F2) is not wired.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/research-planner/perspectives/index.cjs` | frozen registry, six ids, COUNTER_METRICS | VERIFIED | six modules load; each exports all 12 interface names (verifier checked) |
| `lib/core/research-planner/perspectives/{eureka,rs,hsi,whitespace,analogies,connections}-recall.cjs`, `eureka-judge.cjs`, `shared.cjs` | real recall per perspective | VERIFIED | 2,493 lines total; no TODO / placeholder markers; each returned real candidates over the wire |
| `lib/mcp/tools/research.cjs` | perspective_recall / candidates / judge plus deprecated aliases | VERIFIED | ops wired to `mod.runRecall`, `planner.buildPlan`, `eurekaJudge.runJudge`, `mod.readCandidates`; annotations present |
| `scripts/research-planner.cjs` | CLI perspective-recall / perspective-judge | VERIFIED | `--perspective rs` returned 20 candidates; no perspective -> `perspective_required`; off-enum -> exit 2 |
| `data/egress-policy.json` + `egress-policy.cjs` | one policy read by the ledger | VERIFIED | required by the audit ledger and every egress site |
| `lib/core/semantic-index/` | moved index | VERIFIED | require integrity OK |
| `lib/core/part8-egress-guard.cjs` `_proveNavigatorRelease` | receipt-bound arm | VERIFIED | behavior probed above |
| `lib/core/doctor/canon-backfill-module.cjs` | doctor --fix backfill | VERIFIED | test-366-canon-backfill PASS 25 in run-all-366 |
| `tests/fixtures/366-spike/` (bar, arms, record) | committed spike record | VERIFIED | --check byte-for-byte |
| `366-SPIKE-RULINGS.md`, `366-HANDOFF.md`, `.planning/todos/pending/2026-10-01-theo-intent-led-canon-resolver.md` | rulings, handoff, Theo request | VERIFIED | present and specific |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| MCP `research_run` | perspective modules | `perspectives.getPerspective(id)` -> `runRecall` | WIRED (live stdio, six of six) |
| perspective recall | research planner | `planner.buildPlan(question_set)` -> plan card | WIRED (plan_ok true for all six) |
| router stubs (find-bottlenecks, whitespace, scout-hsi, eureka-run) | `research_run perspective_recall` | pointer text | WIRED (eureka-run probed live; others by test-366-router-redirects PASS 29) |
| ambient eureka producer | perspective recall | `lib/core/ambient-run.cjs _eurekaAdapter` -> `eureka-recall.buildSubstrate/recallCandidates`; `research-planner/ambient.cjs eurekaOfferInner` | WIRED (offer only) |
| audit ledger / quick / deep / theo-lane / canon-release | `data/egress-policy.json` | `require('./egress-policy.cjs')` | WIRED |
| `canon-release.releaseTerm` | guard `navigator_released` | `classify(payload, {release})` checked twice (built and wire verdict) | WIRED |
| `release.sh` | canon snapshot gate, suite gate | sourced `release-lib/*.sh` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `perspective_recall` response | `counts`, `top`, `plan` | room.db through `buildSubstrate` | yes: things 16, sections 4, per-lane counts differ per perspective | FLOWING |
| `perspective_candidates` | `items` | the run folder candidates.jsonl written by recall | yes: total 2, judged true after judge | FLOWING |
| spike record | Wilson intervals | committed arms and gold labels | recomputed byte for byte | FLOWING |

### Behavioral Spot-Checks (run by the verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase aggregator | `bash tests/run-all-366.sh` (hermetic temp HOME/USERPROFILE/MINDRIAN_ROOMS_HOME, session vars unset, node 22.23.1) | exit 0, PASSED=69 FAILED=0 SKIPPED=1 (spike preparer ENV GAP: no local embedding model) KNOWN=1 (355 direction-agreement leg H) | PASS |
| Wave 1 aggregator | `bash tests/run-all-seed103.sh` | PASSED=20 FAILED=0 | PASS |
| Runner retirement gate | `node tests/test-366-runner-retired.cjs` | PASS 5 FAIL 0 | PASS |
| Require integrity | `node scripts/check-require-integrity.cjs` | OK (2693 files, 6913 references, 276 unchecked dynamic) | PASS |
| Six perspectives over real MCP stdio | scratch driver over `tests/helpers/mcp-wire-267.cjs` + `fixture-366` | all six ok with plans; judge, candidates, alias, refusal, legacy pointer as expected | PASS |
| Guard arm | direct `classify()` probes (7 cases) | allow only with matching receipt; block on content | PASS |
| Born-wired / projection / render / floors / mirrors / drift | `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`, `check-floor-ledger --check` (62 rows, 0 unresolved), `build-skill-mirrors --check`, `check-registry-drift --check` | all exit 0 | PASS |
| Runner-slice aggregators | `run-all-215` 6/0, `218` 17/0, `219` 13/0, `226` 4/0, `363.1` all green | exit 0 | PASS |
| Pre-existing reds unchanged | `run-all-216` 8/1 (strict shape leg; eureka not among the violators), `223` 16/3, `343` 9/2, `355` 67/4, `3551` 62/6, `363` 45/3 | counts match the declared pre-existing reds. `part8-egress-guard.test.cjs` PB8-03 (inside 355/3551) also fails on the pre-366 base `f41d956e8` (verifier ran it from `git archive`), so 366-11's guard edit did not cause it. The 3551 `dependency-diff` red traces to 267's package.json edits; no 366 commit touched a dependency manifest | PASS (not counted against 366) |

### Probe Execution

Step 7c: no `scripts/*/tests/probe-*.sh` declared by any 366 plan or summary. SKIPPED.

### Requirements Coverage

All 30 EPV366 IDs are claimed by at least one plan's `requirements:` (no orphans). 29 rows are `[x]` with Measured lines; the verifier re-ran their aggregate evidence (run-all-366, seed103, runner-retired, require-integrity, spike --check, the gates above) and they hold. EPV366-21 is `[ ]` with its stated reason: release-lockstep, see above.

| Requirement | Status | Evidence |
|-------------|--------|----------|
| EPV366-01..20, 22..30 | SATISFIED | legs inside run-all-366 (69/0) plus the independent probes above |
| EPV366-21 | OPEN by design (release ceremony) | gate, writer, docs green; stamp absent |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 224 files touched by the 127 `(366-` commits | - | TBD / FIXME / XXX | none found | - |
| perspective modules, research.cjs, canon-release, egress-policy, semantic-index, spike scripts | - | TODO / placeholder / not implemented | none found | - |
| `.planning/ROADMAP.md` Phase 366 block | Plans list | progress reads "18/27 plans executed" and plans 19-27 are `[ ]` although all 27 SUMMARYs exist and the work is on main | WARNING (bookkeeping) | the roadmap misstates phase state until the phase-complete step updates it |
| `366-VALIDATION.md` | frontmatter | `status: draft` while every row reads green | INFO | bookkeeping |
| `commands/eureka.md` | 73, 81 | the door calls the CLI aliases `eureka-recall` / `eureka-judge`, not `perspective-recall --perspective eureka` | INFO | works (aliases kept by EPV366-04); swap when the aliases retire |
| `dist/zed/...`, `dist/generic-claude-dir/...` eureka SKILL.md | - | old `--legacy` door text | INFO | regenerated at release (F14) |

### Human Verification Required

### 1. Live-surface smoke of the perspective ops

**Test:** On Claude Desktop (Cowork if available), bind a room with content in two or more sections; ask Larry in plain words to find bottlenecks, hidden structure, and cross-domain transfers.
**Expected:** Larry calls `research_run` `perspective_recall` with rs / hsi / eureka, pages with `perspective_candidates`, runs `perspective_judge`, and the plan card renders; nothing leaves the room.
**Why human:** The wire contract is proven over real stdio; whether a model on a hookless surface chooses the right op from the description is live model behavior.

### 2. MCP evaluation re-run on the six-perspective surface

**Test:** Re-run `tests/fixtures/seed103-mcp-eval.xml` against the `perspective_*` op names, or add one question per non-eureka perspective.
**Expected:** An agent answers every question by string match using only `research_run`.
**Why human:** Needs an LLM agent loop; it was run for the wave-1 `eureka_*` ops only.

### Gaps Summary

No blocking gaps. The phase goal holds in the codebase: Eureka is one of six registered perspectives sharing one interface, substrate, offline recall contract and filer; every perspective is reachable over a real MCP stdio wire with recall, paginated candidates, a Stage A judge, honest refusals and deprecated eureka aliases; the standalone runner is deleted with no dangling require; the semantic index moved behind a passing integrity gate; the Part 8 `navigator_released` arm allows only on a matching navigator receipt and still blocks content; the spike record recomputes byte for byte with the bar committed first and six rulings recorded verbatim.

Open, not blocking: EPV366-21's stamp (release-lockstep: the next cut refuses at place 9 until `refresh-framework-names --live` runs after Theo's re-emit), the stale ROADMAP progress block (warning), and the follow-ons F1-F17 already named in `366-HANDOFF.md` (notably F16, the generic-Theo false block, still unfixed and pre-existing).

---

_Verified: 2026-10-02T16:59:39Z_
_Verifier: Claude (gsd-verifier)_
