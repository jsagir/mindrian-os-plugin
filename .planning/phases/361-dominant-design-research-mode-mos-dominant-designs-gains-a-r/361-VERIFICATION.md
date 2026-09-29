---
phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r
verified: 2026-09-29T00:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification: null
follow_ups: # documentation only, not goal gaps
  - item: "DDR361-09 and DDR361-10 rows in .planning/REQUIREMENTS.md still describe the retired case_story {framework} key"
    owner: "next session that can commit REQUIREMENTS.md cleanly (a peer holds an uncommitted Phase 362 diff there)"
    text_source: "361-10-SUMMARY.md, Deviations, owed text for DDR361-09 and DDR361-10"
  - item: "ROADMAP Phase 361 lists 361-09 and 361-10 as [ ] and the Progress line still reads 8/8"
    owner: "orchestrator"
  - item: "commands/dominant-designs.md (and its skills/dominant-designs/SKILL.md mirror) frontmatter comment still says the Task grant row is 'pending' and ratification is 361-08's checkpoint; the row is 'granted' (ratified 2026-09-23)"
    owner: "next plan touching the command (regenerate the skill mirror)"
  - item: "361-09/361-10 are on main, not in a release; the installed beta.51 carries 361-01..08 only"
    owner: "next release cut"
---

# Phase 361: Dominant-design research mode Verification Report

**Phase Goal:** In `/mos:dominant-designs`, the deep dive can open with a navigator-gated, sourced research pass: Larry composes four audited evidence-lane queries (variant census, convergence signals, S-curve limits, discontinuity signals), nothing is searched until the navigator approves them, up to four read-only dominant-design-researcher agents return claim rows that are each sourced or dropped, the lanes are filed with provenance through fileEvidenceWithReadback only after the navigator says yes, and Larry runs the six Utterback-Abernathy phases on top citing row ids, with the framework structure read from Theo by generic handle when served and from the local reference otherwise. The quick pass stays byte-identical to today.
**Verified:** 2026-09-29
**Status:** passed
**Re-verification:** No - initial verification (after UAT gap closure 361-09/361-10)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Quick pass is unchanged (DDR361-13) | VERIFIED | Independent diff of `## Setup` .. `## When Complete` in `commands/dominant-designs.md` at base `c1c948bf0` (from `tests/fixtures/361-pre-phase.json`) vs HEAD: additions only, zero deleted or changed pre-existing lines. `test-361-baseline` and `test-361-command-contract` PASS. |
| 2 | Nothing is dispatched before the navigator approves; unattended runs take the quick pass (DDR361-03) | VERIFIED | Command body: "Unattended runs take the quick pass", gate card with "Run these lanes / Edit or drop a lane / Deep dive without web research", and "No agent is dispatched before the navigator approves the research pass." Pinned by `test-361-command-contract` (20/20). Enforcement is prose-level (Larry follows the command); the code backstop is `validate-lane` refusing any lane whose echoed queries differ from `gate.json`. |
| 3 | Four audited lane queries, composer is the only source, edits re-audited, local-only degrade with no send-anyway (DDR361-02) | VERIFIED | Spot-check: `compose-queries` on a generic domain returned 4 lanes in D-05 order, 1 query each, fixed Tavily params, `max_queries_per_lane: 2`. `audit-query` on "Acme Robotics arms ..." and on an email string both returned `{ok:false, reason:"egress_violation"}` without echoing the text. |
| 4 | Read-only dominant-design-researcher agent, one lane per invocation, host-enforced tools (DDR361-01) | VERIFIED | `agents/dominant-design-researcher.md` (162 lines): `tools:` and `allowed-tools:` identical (two Tavily search names, WebSearch, Read; no Write/Edit/Bash/Task/Brain), `connector.excluded: true` with reason, no `hitl_shape`, return schema enforces D-06 fields plus `source_type`. Shipped in installed cache `mos/2.0.0-beta.51/agents/`. `test-361-agent-contract` PASS. |
| 5 | Up to four lanes fan out in parallel, at most 2 queries per lane, fixed params, WebSearch only as fallback, no tavily-extract (DDR361-04) | VERIFIED | Command PHASE 1 text (one Agent dispatch per approved lane, clamped by `resolveFanoutCap`, `search_depth: basic`, `topic: general`, `max_results: 10`, no `tavily-extract`); grant row `data/subagent-dispatch-grants.json` status `granted`, `fan_bound` 4, `ratified_in: 361-08`; `test-265-swarm-task-grant` PASS. UAT test 4 observed a live 2-lane parallel dispatch. |
| 6 | Every claim row is sourced or dropped; scored rows dropped; changed queries refused (DDR361-05) | VERIFIED | Spot-check `validate-lane` with 4 planted rows: kept 1 (id `E-VC-1`, `evidence_tier: Operational` from `company_primary`), `dropped_unsourced: 2` (empty URL, `ftp://` URL), `dropped_scored: 1` (`confidence` key). Tampered query -> `{ok:false, reason:"query_mismatch"}`. |
| 7 | Lanes file only after the navigator's yes, one artifact per lane with "Searched, not found", claims through fileEvidenceWithReadback with provenance (DDR361-06, DDR361-07) | VERIFIED | Spot-check `file-pack` into a throwaway room with a seeded room.db: wrote `competitive-analysis/dominant-designs/solid-state-batteries-2026-09-29-evidence-variant_census.md` (claim table, tier column, `## Searched, not found`), room.db `nodes` got one `EvidenceClaim` (`review_status: proposed`, url, retrieved_at, evidence_tier, artifact_path, per-lane session suffix `dd-variant_census`), 4-zone report with `/mos:find-bottlenecks` first. Filing only after "File this to competitive-analysis?" is prose-level in the command. `test-361-filing` PASS (includes no-room.db leg). |
| 8 | Larry's six phases cite row ids, no unsourced scores, `structure_source` and reason recorded (DDR361-08) | VERIFIED | Command PHASE 2 and filing text: every factual statement ends with its row id, no score unless a row states it, analysis frontmatter adds `depth`, `evidence_pack`, `structure_source`, `structure_source_reason`, `lanes_not_run`. Contract-level (LLM behavior); pinned by `test-361-command-contract`. |
| 9 | Framework structure from Theo by generic handle when served, local reference otherwise, reason named (DDR361-09, as amended by 361-10) | VERIFIED | Live `theo-structure` run today: `framework_step` and `framework_techniques` sent exactly `{framework:"Dominant Design"}`, `case_story` sent exactly `{framework_name:"Dominant Design"}`; all `egress_disclosure:false`; `source: reference`, `reason: no_steps_in_canon`, 6 reference steps, `cases: []` (case_story `not_served`). `lib/core/dominant-design/theo-structure.cjs` carries the frozen `CALL_ARG_KEY` map and the `no_case_in_canon` outcome. `test-361-theo-structure` and `test-361-cli` PASS. |
| 10 | Part 8 arms for framework_step, framework_techniques, case_story; find_connections arm untouched; Theo parity pinned (DDR361-10, as amended by 361-09) | VERIFIED | Spot-check `classify()`: all three generic-handle shapes `allow / known_tool_shape`; retired `case_story {framework}` and both-keys shape `ambiguous`; off-vocabulary handle `ambiguous`; email handle `block`. `git diff 68111c594^ HEAD -- lib/core/part8-egress-guard.cjs` touches find_connections only in new comments; the 361-01 baseline slice test PASS. `test-361-theo-parity` 8/8 PASS (Leg 4a-4d). |
| 11 | Frontmatter truth, registry hash moved, born-wired ledgers regenerated and green (DDR361-11, DDR361-12) | VERIFIED | `connector.web_scope: white`, `Task` in `allowed-tools` with pre-approval comment, `teaching` names research mode, `autonomous_safe: true`; registry row teaching updated (hash moved per 361-07, rode the beta.51 cut which contains 361-07 `9c739dcf9`). Gates run today: `build-connector-registry --check` OK, `build-orchestration-projection --check` OK, `check-render-coverage` 17 covered / 0 gap, 202 wired / 0 unwired. Agent present in `data/connector-coverage-ledger.json` and `data/brain-orchestration-projection.json`. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `commands/dominant-designs.md` | Upgraded command, quick pass preserved, research mode | VERIFIED | 187 lines, research mode PHASE 0/1/2 plus filing, Tri-Polar table |
| `agents/dominant-design-researcher.md` | Read-only per-lane fetcher | VERIFIED | 162 lines, host-enforced tools, JSON return shape |
| `lib/core/dominant-design/lane-queries.cjs` | Composer plus audit | VERIFIED | 204 lines, reuses shipped `auditQueryString` |
| `lib/core/dominant-design/evidence-pack.cjs` | D-06 validator, D-13 tiers, lane artifact renderer | VERIFIED | 383 lines, exercised by spot-check |
| `lib/core/dominant-design/theo-structure.cjs` | Theo-or-reference structure reader | VERIFIED | 328 lines, exercised live |
| `scripts/dominant-design-research.cjs` | CLI (compose-queries, audit-query, theo-structure, validate-lane, file-pack) | VERIFIED | 587 lines, all five subcommands exercised |
| `lib/core/part8-egress-guard.cjs` | Three known-shape arms | VERIFIED | exercised via `classify()` |
| `references/methodology/dominant-designs.md` | Research mode note | VERIFIED | line 213 |
| `skills/dominant-designs/SKILL.md` | Mirror of the command | VERIFIED | skill-mirrors `--check` PASS |
| `data/subagent-dispatch-grants.json` | Task grant row | VERIFIED | `granted`, ratified 2026-09-23 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| command PHASE 0 | `lane-queries.cjs` | `dominant-design-research.cjs compose-queries` / `audit-query` | WIRED | spot-checked |
| command PHASE 1 | `agents/dominant-design-researcher.md` | Agent tool `subagent_type: dominant-design-researcher` | WIRED | UAT test 4 live dispatch; agent in installed beta.51 cache |
| command PHASE 1 | Theo | `theo-structure` -> brain-client with generic handle | WIRED | live call today |
| Theo calls | Part 8 guard | `_proveKnownToolShape` arms | WIRED | `egress_disclosure:false` on all three live calls |
| command PHASE 2 | `evidence-pack.cjs` | `validate-lane --approved gate.json` | WIRED | spot-checked, query_mismatch path included |
| command filing | room.db | `file-pack` -> `navigation.fileEvidenceWithReadback` | WIRED | EvidenceClaim landed `proposed` in a temp room |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| lane evidence artifact | kept rows | agent JSON -> validate-lane -> file-pack | Yes (row rendered, node written) | FLOWING |
| analysis structure | `steps` / `structure_source` | live Theo, fallback reference parse | Yes (6 reference phases, reason named) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Compose four lanes | `compose-queries domain.json` | 4 lanes, D-05 order, fixed params | PASS |
| Refuse identifying edits | `audit-query` (company phrase, email) | `egress_violation`, text not echoed | PASS |
| Drop unsourced and scored rows | `validate-lane` on 4 planted rows | kept 1, unsourced 2, scored 1 | PASS |
| Refuse changed queries | `validate-lane` on tampered echo | `query_mismatch` | PASS |
| File with provenance | `file-pack` into temp room | lane artifact plus 1 EvidenceClaim `proposed` | PASS |
| Theo read, generic handle only | `theo-structure` (live) | per-tool args exact, reference fallback, reason named | PASS |
| Part 8 arms | `classify()` on 7 shapes | allow x3, ambiguous x3, block x1 as designed | PASS |

### Suite and Gate Execution (run by the verifier)

| Gate | Result | Status |
|------|--------|--------|
| `bash tests/run-all-361.sh` | `PASSED=26 FAILED=3 SKIPPED=0` | PASS (3 failures proven non-361 below) |
| `node scripts/build-connector-registry.cjs --check` | `connector-registry: OK` | PASS |
| `node scripts/build-orchestration-projection.cjs --check` | `orchestration-projection: OK` | PASS |
| `node scripts/check-render-coverage.cjs` | 17 covered, 0 gap; 202 wired, 0 unwired | PASS |

**The three failing legs, attributed by measurement, not by SUMMARY claim.** A full `git archive` of `68111c594^` (the commit before the first 361 code change to the Part 8 guard) was run with the repo's node_modules:

| Leg | Message at HEAD | At pre-361 snapshot | Cause |
|-----|-----------------|---------------------|-------|
| `lib/core/part8-egress-guard.test.cjs` | `PB8-03: generic framework question must ALLOW` | identical failure | pre-existing, not 361 |
| `tests/test-209-declared-implies-wired.cjs` | allowlist diff `-   'commands/brain-derive.md'`, `-   'skills/brain-derive/SKILL.md'` | identical failure | pre-existing (peer fixed brain-derive, allowlist stale) |
| `tests/test-260906-fda-known-tool-shapes.cjs` | `brain_ask methodology question ... expected "ambiguous", got allow / typed_question` | PASSES at pre-361 | NOT pre-361, but NOT caused by 361: root cause is `f55f004f6` (355-08, "regenerate framework-names from live Theo list_frameworks"), which added `"Lean Startup"` to `data/framework-names.json` (count 0 before, 1 after), so the 354-06 typed-question proof now proves the fixture "lean startup methodology" closed-vocabulary. No 361 commit touches `data/framework-names.json` or the typed-question proof. Owner: Phase 355 / the FDA fixture. |

Correction to the record: the 361-09/361-10 SUMMARYs and the UAT pre-check call the FDA leg "pre-existing"; it is newer than 361-02 but its cause is Phase 355-08's vocabulary regeneration, so the "non-361" classification holds.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| DDR361-01 | 361-04 | SATISFIED | Truth 4 |
| DDR361-02 | 361-03, 361-06 | SATISFIED | Truth 3 |
| DDR361-03 | 361-07 | SATISFIED | Truth 2 |
| DDR361-04 | 361-03, 361-07 | SATISFIED | Truth 5 |
| DDR361-05 | 361-03, 361-06 | SATISFIED | Truth 6 |
| DDR361-06 | 361-03, 361-06, 361-07 | SATISFIED | Truth 7 |
| DDR361-07 | 361-03, 361-06, 361-07 | SATISFIED | Truth 7 |
| DDR361-08 | 361-07 | SATISFIED | Truth 8 |
| DDR361-09 | 361-05, 361-06, 361-08, 361-10 | SATISFIED (row wording stale) | Truth 9; row text still says ONLY `{framework: ...}` for all three tools, code correctly sends `{framework_name}` to case_story per Theo 20.1-04. Owed amendment text is in 361-10-SUMMARY.md. |
| DDR361-10 | 361-02, 361-08, 361-09 | SATISFIED (row wording stale) | Truth 10; same owed amendment. |
| DDR361-11 | 361-04, 361-07, 361-08 | SATISFIED | Truth 11, grant `granted` |
| DDR361-12 | 361-07, 361-08 | SATISFIED | Truth 11; 361-07 is an ancestor of the beta.51 release commit `d2ebe2144`, so the hash rode a real cut |
| DDR361-13 | 361-01, 361-07 | SATISFIED | Truth 1 |

No orphaned requirements: REQUIREMENTS.md maps exactly DDR361-01..13 to Phase 361.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all 361 code and agent files) | - | TBD / FIXME / XXX | none found | - |
| (all 361 code and agent files) | - | em-dash | none found | run-all-361 em-dash guard PASS |
| `commands/dominant-designs.md` (and SKILL.md mirror) | ~21-28 | stale comment: grant row "pending", ratification "is plan 361-08's checkpoint" | Info | comment only; the data row is `granted` |
| `lib/core/dominant-design/lane-queries.cjs` | - | audit reuses the shipped `auditQueryString` pattern fence | Info | catches emails and some multi-word entity phrases; a single famous brand ("Tesla battery plans") passes. UAT test 3's "a company or person name is refused" is broader than the fence. The navigator still sees the exact string on the gate card before any send, and Tavily is web egress, not Brain egress (D-10). Not a goal gap. |

### Human Verification Required

None beyond what the 2026-09-29 UAT (8/8, navigator-directed Claude-driven run) already covered. Residual note for the record: the gate-before-dispatch order, the filing-only-after-yes step, the row-id citations, and the Desktop/Cowork degrade line are LLM-followed command prose (pinned by contract tests, observed in the UAT for CLI; Desktop was contract-level only).

### Gaps Summary

No goal gaps. The research mode exists, is substantive, is wired end to end (compose -> audit -> gate -> fan-out -> validate -> Theo-or-reference structure -> file with readback), and every piece was exercised by the verifier rather than taken from SUMMARY text. Both UAT gaps are closed in code: the case_story Part 8 arm and call now match Theo 20.1-04's exactly-one-of shape (live call sends `{framework_name:"Dominant Design"}`), and the SENS-09 pin passes.

Documentation follow-ups (not gaps, listed in frontmatter): the DDR361-09/10 row amendment owed to REQUIREMENTS.md, the ROADMAP 361-09/10 checkboxes and Progress line, the stale "pending" grant comment in the command and skill mirror, and a release to make 361-09/10 live (latent until Theo registers case_story anyway).

---

_Verified: 2026-09-29_
_Verifier: Claude (gsd-verifier)_
