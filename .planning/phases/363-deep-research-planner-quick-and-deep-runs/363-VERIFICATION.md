---
phase: 363-deep-research-planner-quick-and-deep-runs
verified: 2026-10-01T00:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
gaps: []
recorded_gaps:
  - item: "zone_term missing from production whitespace-results.json (ambient runs on real rooms answer context_insufficient)"
    classification: recorded gap, not a blocker
  - item: "research cards sit flat in opportunity-bank with funder, program and deadline null"
    classification: recorded gap, not a blocker
  - item: "restatement heuristic in pyramid.cjs flags most leaves of a one-domain plan"
    classification: recorded gap, not a blocker (warning only)
  - item: "wish gate applied only to scientific-roadmapping at phase close"
    classification: was a real defect against the letter of DRP363-19 at submission; closed on main during this verification by 6c8821fd4 (see Truth 8)
human_verification: []
---

# Phase 363: Deep Research Planner (quick and deep runs) Verification Report

**Phase Goal:** A deep research planner. It reads the room's own signals, decides the room must reach outside itself, and PLANS the research (question, lens, sources, audited queries, sequence), then runs the plan as a quick run (one bounded pass, an evidence card) or a deep run (decompose, fan out, iterate, counterevidence, report plus ledger). Both return hash-anchored evidence to the card or section that started them, and both route through the Part 8 guard. SEED-097's Whitespace + OpenAlex slice is the first acceptance case, run in both modes.
**Verified:** 2026-10-01
**Status:** passed
**Re-verification:** No, initial verification
**Code state verified:** main at `6c8821fd4` (the wish-gate fix). Other sessions kept committing and editing the shared working tree during this verification (a seed-103 Eureka commit, a quick-bottleneck RED commit, uncommitted edits to `lib/core/research-planner/{plan,planner,quick}.cjs`, `lib/mcp/tools/research.cjs`, `tests/test-363-cli.cjs`). Those are outside Phase 363 and were not verified. Nothing in the working tree was touched by this verification except this file.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A quick run is one bounded, audited pass that returns an evidence card with a code-computed verdict, run only under a grant | VERIFIED | `quick.cjs` `runQuick` calls `grants.validateExecutedQuery` per query (lines 351, 402), fetches through `fetchSourceCached`, appends one audit record per executed query (line 473). `test-363-run-quick` 18/18 and acceptance W1, W2, W3, W4 pass. Live smoke (2026-10-01, one run, keyless): 3 searches, verdict `thin`, exit 0, PASS 11. |
| 2 | A deep run decomposes per lens, iterates, runs a mandatory counterevidence pass, stops typed, and refuses without a run grant | VERIFIED | `deep.cjs` `initDeepState` refuses `no_grant` unless a persisted run grant matches (lines 309-314); `test-363-run-deep` 17/17 (E1 no grant refused, E2 hash outside approved set refuses, E7 synthesis before counterevidence refused, E14 isSR fix). Live smoke deep run: stop `saturation`, 2 unresolved branches. |
| 3 | Grants have two lifetimes (standing F.0, per-run F.6), carry every D-04 re-ask reason, and authorize fetching, never filing | VERIFIED | `grants.cjs` `REASK_REASONS` (13 reasons in fixed order), `STANDING_CAPS`, `GRANT_EXPIRY_DAYS` 30, `RESEARCH_RUNS_PER_HOUR` 1, `FILING_KEY_RE` refuses any grant carrying a file or filing key at write. `validateExecutedQuery` read in full. Grants and audit test legs pass in `run-all-363.sh`. |
| 4 | An append-only audit record is written per executed query with every D-04 field | VERIFIED | `audit-ledger.cjs` `validateRecord`, `appendAudit`, `sliceForRun`; `AUDIT_KEYS` checked; audit-ledger A1-A5 pass; Part 8 sweep S6 confirms every record holds an approved `q` and no marker or key. |
| 5 | Filing happens only on the navigator's yes on the F.8 basket; claims land `proposed` | VERIFIED | `filing.cjs` `checkAuthority` refuses `no_approved_selection`, `grant_not_authority`, `no_items_selected`, `unknown_item`; `fileRunInner` always runs it first. `test-363-filing` 51/51 (run in a pinned archive of `6c8821fd4`) and acceptance W6 (`approved:false` files nothing). |
| 6 | Facade, CLI, ambient runs, the `research_run` MCP tool, `/mos:research` as the single runner, and the five PWS command doors are all wired | VERIFIED | `scripts/research-planner.cjs` exists; `lib/mcp/tools/research.cjs` registers `research_run` with ops planners/plan/grant_request/grant_status/grant_revoke/run_quick/deep_plan/basket/file/pending and `hitl_shape: F.6`; `ambient.cjs` `maybeQuick`; `commands/research.md` Form B hitl_stages with the D-05 exception text; each of map-unknowns, root-cause, think-hats, diffusion, whitespace carries a "Research planner" section calling the CLI; `agents/research-lane-analyst.md` is `tools: [Read]` only. Tests: cli 20/20, mcp-tool 15/15, ambient 18/18, command-contract 8/8, runner-contract 9/9. No command gains Task, Agent or web_scope (command-contract). |
| 7 | Both modes run the Whitespace + OpenAlex slice on the two-section fixture and answer "missing from the literature or only from the room"; Canon Part 8 holds across every door | VERIFIED | Acceptance whitespace 15/15 (W1-W9b, W4b), diffusion 7/7 (F1-F4). `test-363-part8-sweep` 20/20 run directly (setup, D1-D7, S1-S9): marker and fake key in no argv, stdout, stderr, MCP response, telemetry, cache, Theo call argument, audit record, room file or room.db node. The only `brain-client` require in the planner tree is `structure.cjs` `refreshLive`, which passes constant framework names and problem-type handles as Cypher params and falls back to the shipped ledger (S5, D6 confirm handle-only). Every other door module has zero Brain reach. |
| 8 | The planner is a research-perspective builder: a deep plan with no nameable limiter is a wish and does not run (DRP363-19) | VERIFIED (after a mid-verification fix) | See "DRP363-19 and the wish gate" below. |
| 9 | Phase gates and aggregate suite are green with only pre-existing reds | VERIFIED | `bash tests/run-all-363.sh` twice: `PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10`, exit 0 (SKIPPED is the opt-in live smoke; KNOWN are the 10 pre-existing reds with matched signatures). `build-connector-registry --check` OK, `build-orchestration-projection --check` OK, `check-render-coverage --check` OK. `doctor --acceptance`: 21/22, see below. |

**Score:** 9/9 truths verified

### DRP363-19 and the wish gate (explicit answer)

**Did the wish-gate gap violate DRP363-19 as ticked? Yes, in the letter, at the commit that was submitted (`80fc98758`).** DRP363-19 says a tension with "no nameable limiter means a wish, and the plan does not run", and that every plan carries a perspective. At submission `planner.assess` enforced that only when `plan.origin.template_id === 'scientific-roadmapping'`. I reproduced it with a scratch script (scratch home, network stubbed to throw): a deep `buildPlan` on the `map-unknowns`, `think-hats` and `root-cause` question sets, in both a founder room and a researcher room, returned `status: ready` with 0 limiters and `errors: []`. Such a plan could be reviewed, granted and run. So the row was ticked on the strength of the scientific-roadmapping path only, and the tick overstated the delivered behavior for six of the eight engine and question-set combinations. The navigator's own ruling (2026-10-01, "Apply it to every deep plan") confirms that reading.

It did not make the phase goal unreachable (the goal does not hinge on the wish gate's universality, and the scientific path, the only one D-18 names as the engine, was correct), so it was a real but narrow defect, not a goal blocker.

**It is now closed on main.** While this verification ran, the scheduled quick task landed: RED `f7c62ea03` (test-363-cli leg C15), GREEN `6c8821fd4`, with docs in `2399b245d`. `planner.assess` now returns `wish` with `no_nameable_limiter` for a deep, non scientific-roadmapping plan with no limiter (`hasNoLimiter` reads the fresh errors, the stored tension and the stored limiter list, so revise and escalate cannot slip past). I re-ran my reproduction against the fixed code: all six limiterless combinations return `wish / no_nameable_limiter`; the limiter-bearing scientific-roadmapping plans stay `ready`. `test-363-cli` 20/20 (C14 and C15), `test-363-acceptance-whitespace` 15/15 (W4b asserts the whitespace wish), `test-363-part8-sweep` 20/20, all also re-run inside a pinned `git archive` of `6c8821fd4`.

Scope limits of the fix, recorded and consistent with the ruling (not gaps): quick mode is deliberately not gated; outside scientific-roadmapping only `no_nameable_limiter` gates, while missing forum roles and an unquantified goal stay advisory; and a deep whitespace plan, including the "run deep on this?" escalation, is now a wish unless the question set names a limiter (the ambient question set carries one, so ambient-originated cards are unaffected).

### Recorded gaps (not blockers; none is on the goal's critical path)

| Item | Why it is not a blocker | Evidence |
|------|-------------------------|----------|
| zone_term gap: ambient runs report `context_insufficient` / `no_zone_term` on real rooms | The goal's ambient door exists and works under a grant (W9), and the limit is pinned by W9b so it cannot go quiet. The room-started path is one of several doors; quick runs started by the navigator work on real rooms. Sidecar design is written and scheduled as a quick task. Do not rely on room-started runs in real rooms until it lands. | `363-ACCEPTANCE.md` Known limitation, `363-FOLLOW-ONS.md` A2, DRP363-15 Limit note. |
| Research cards flat in `opportunity-bank/` with funder, program, deadline null | Filing works and is gated; the risk is to downstream consumers of `listOpportunities` that treat every card as a funding call. No such consumer is in the phase goal. | `363-FOLLOW-ONS.md` A3. |
| Restatement heuristic flags 8 of 11 leaves | A warning only; the D-00 gate is separate and is not affected; the navigator ruled the D-06 review PASS with this disclosed. | `pyramid.cjs` 309-316, `363-D06-REVIEW.md` caveat 3, `363-FOLLOW-ONS.md` A4. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/research-planner/*.cjs` (15 modules, 8795 lines) | plan, pyramid, perspective, families, grants, audit-ledger, structure, evidence-rows, quick, deep, filing, ambient, verdict, planner facade | VERIFIED | Substantive (no stub returns, no TBD, FIXME, XXX, TODO or HACK markers, no em or en dashes); wired (CLI, MCP tool, ambient, command doors all call the facade) |
| `scripts/research-planner.cjs` | JSON-only CLI door | VERIFIED | C9-C12 spawn it end to end on the replay |
| `lib/mcp/tools/research.cjs` | `research_run` MCP tool | VERIFIED | registered with F.6 hitl_shape; M1-M15 pass |
| `agents/research-lane-analyst.md` | Read-only lane analyst | VERIFIED | `tools: [Read]` |
| `commands/{map-unknowns,root-cause,think-hats,diffusion,whitespace,research}.md` | six command doors | VERIFIED | each has the research-planner section; quick-pass line byte-preserved (aggregator leg) |
| `data/research-shape-ledger.json`, `data/floor-ledger.json` rows | shipped structure and disclosed floors | VERIFIED | `build-research-shape-ledger --check` and floor-ledger check pass in the aggregator |

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| CLI and MCP doors | planner facade, one plan-assembly path | WIRED | Part 8 sweep D1-D5 exercises every door through the same facade |
| run engines | grants, then audit ledger | WIRED | `validateExecutedQuery` before each fetch, `appendAudit` after, in both quick and deep |
| filing | F.8 approval | WIRED | `checkAuthority` precedes any write |
| evidence rows | origin card or section (hash-anchored) | WIRED | return_target and row hashes, `test-363-evidence-rows` and filing legs pass |
| ambient | standing grant, throttle ledger, pending door | WIRED | M0-M11, W9; queued card returned once by `pending` |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| quick run evidence card | rows, counts, verdict | OpenAlex via `fetchSourceCached` (replay offline; live once) | Yes: live smoke returned 0, 0 and 5 results with `meta.count` | FLOWING |
| deep run report | lane rows, stop reason | same fetch path plus lane analyst (Claude Code only) | Yes offline and live (3 of 16 searches, saturation) | FLOWING |

### Behavioral Spot-Checks and Commands Run

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase aggregate | `bash tests/run-all-363.sh` (run twice) | `PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10`, exit 0 | PASS |
| Part 8 sweep | `node tests/test-363-part8-sweep.cjs` | 20 PASS, 0 FAIL, exit 0 | PASS |
| Connector registry | `node scripts/build-connector-registry.cjs --check` | OK | PASS |
| Orchestration projection | `node scripts/build-orchestration-projection.cjs --check` | OK | PASS |
| Render coverage | `node scripts/check-render-coverage.cjs --check` | OK | PASS |
| Acceptance roll-up | `node scripts/doctor.cjs --acceptance` | 21/22; the one FAIL is `verify-release-clean-tree` ("tracked-file drift", 1 file on the first run, 4 on the second) | see note |
| Wish gate | scratch repro over 8 engine and question-set combinations | before fix: 6 `ready` with no limiter; at `6c8821fd4`: 6 `wish`, 2 `ready` with limiters | PASS |

**doctor --acceptance note (claimed 22/22, observed 21/22).** The single failing point is the clean-tree check. `git status` showed exactly the tracked files other sessions had modified and not yet committed (first `363-FOLLOW-ONS.md`, later `plan.cjs`, `planner.cjs`, `quick.cjs`, `research.cjs`, `test-363-cli.cjs`). Every other point passes, including `coverage-gate` (connector, orchestration projection, render coverage, skill mirrors) and `harness-policies`. This is working-tree contamination from concurrent sessions, not a Phase 363 defect, and I did not touch or stash those edits. The 22/22 figure is expected to hold on a clean tree; I could not reproduce a clean tree from here, so treat 22/22 as previously recorded, not re-observed by me.

### Probe Execution

No phase-declared probes (`scripts/*/tests/probe-*.sh`). Skipped.

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| DRP363-01..18 | SATISFIED | Each row carries a Measured line naming tests that pass in the aggregator; spot-checked 05 (audit), 10 (filing), 13-17 |
| DRP363-19 | SATISFIED at `6c8821fd4`; the tick was overstated at `80fc98758` | see "DRP363-19 and the wish gate" |
| DRP363-20 | SATISFIED | F1-F4, `test-363-families`, `test-363-structure` D5; diffusion selection never reaches Theo (F4) |
| Orphans | none | REQUIREMENTS.md maps DRP363-01..20 to Phase 363 and all appear in plans |

All 20 rows are ticked. The Traceability stated count (418 versus 429 census) is a known open prose mismatch (FOLLOW-ONS A9), not a phase defect.

### Anti-Patterns Found

None. No TBD, FIXME, XXX, TODO, HACK or placeholder markers and no dash characters in the phase's lib, script, MCP tool or agent files. Empty-literal matches are initial state overwritten by real data paths.

### Human Verification Required

None open. The one human check the phase required, the D-06 `/mos:map-unknowns` plan review, was done: navigator ruled PASS on 2026-10-01 (`363-D06-REVIEW.md`, "363-21 pass", plan level, no per-leaf scores; the four caveats are disclosed there). Live OpenAlex was run once after the navigator approved spend (exit 0, PASS 11, FAIL 0). One run is a contract check and a latency reading, not calibration, so all 14 floor rows stay `disclosed` and `GAP_COUNT_FLOOR` needs a labelled sample (recorded, FOLLOW-ONS A1).

### Gaps Summary

No blocking gaps. The phase goal is delivered in code on main: planning, quick and deep runs, grants with two lifetimes, the audit ledger, filing gated on the F.8 yes, facade and CLI, ambient runs under a standing grant, the `research_run` MCP tool, `/mos:research` as the one runner, and the five PWS command doors. Canon Part 8 held across every door in an independent re-run of the sweep. The one real defect found, the wish gate applying only to scientific-roadmapping against the letter of DRP363-19, was closed on main during this verification and re-proven. The three other known follow-ons are real, recorded, and not on the goal's critical path. Caveats for the next reader: Phase 363 is not live until a release is cut and picked up; do not rely on room-started runs on real rooms until the `zone_term` sidecar lands; later commits by other sessions touching the research-planner files (seed-103, quick-bottleneck) were not verified here.

---

_Verified: 2026-10-01_
_Verifier: Claude (gsd-verifier)_

## Correction, 2026-10-01 (quick 261001-s103)

The aggregate result in Truth 9 and the phase aggregate row, `PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10`, is true for the
code state this report names, main at `6c8821fd4` (a pre-merge commit; `2399b245d`, the last pre-merge main commit and only docs
ahead of it, reproduces that exact line). It is not true of main at the time this report was committed
(`e7259ae91`), nor of HEAD after it. The SEED-103 merge `ebd9090cf` landed on main at 01:16 while this
verification was running, added a seventh planner template (`eureka`) and left three legs red: Y1 in
`test-363-pyramid.cjs`, the structure test (B1, D3, B4) and the "research-shape ledger --check" leg. Running the
aggregator in detached worktrees gave `PASSED=40 FAILED=3 SKIPPED=1 KNOWN=10` at `ebd9090cf` and at `e7259ae91`.
The aggregator was not re-run after the merge, and the report notes that other sessions were committing during the
verification. Repaired by `d321d3f2d` and `3ee0f6a31`; main is back to `PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10`.
See 363-FOLLOW-ONS.md A10. The verdict above is unchanged: the phase goal was delivered in code.
