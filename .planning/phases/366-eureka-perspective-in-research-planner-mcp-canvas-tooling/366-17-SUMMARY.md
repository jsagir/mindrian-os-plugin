---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 17
subsystem: research-planner
tags: [egress, policy, audit-ledger, offline, adr-e16, canon-part-8]
requires:
  - 366-12 (CLI perspective-recall / perspective-judge, research_run perspective ops)
  - 366-15 (Theo lateral-path lane under a run grant, runTheoLane)
provides:
  - data/egress-policy.json: the seven egress lines, declared once
  - lib/core/research-planner/egress-policy.cjs: loadEgressPolicy, lineAllowed, lineForProvider
  - audit ledger refusal egress_line_off (record for an off or unknown line is never written)
  - runQuick status plan_only (needed line off or --offline: nothing sent, plan card intact)
  - CLI --offline on run-quick, perspective-recall, perspective-judge
affects:
  - 366-20 (spike sitting records the navigator's rulings on the gray-area lines)
tech-stack:
  added: []
  patterns:
    - one policy file is the only provider-to-line map (lineForProvider reads providers[], no second table)
    - room override is AND-merged: it can only turn lines off
    - fail closed on an unknown provider, an unreadable plugin policy, an override that escapes the room
key-files:
  created:
    - data/egress-policy.json
    - lib/core/research-planner/egress-policy.cjs
    - tests/test-366-egress-policy.cjs
  modified:
    - lib/core/research-planner/audit-ledger.cjs
    - lib/core/research-planner/quick.cjs
    - lib/core/research-planner/theo-lane.cjs
    - lib/core/research-planner/deep.cjs
    - scripts/research-planner.cjs
decisions:
  - "Policy path is data/egress-policy.json (plugin default) plus an optional <room>/.mindrian/egress-policy.json that can only turn lines off (research A3, navigator ruling 2026-10-01 confirmed); the design doc's _config/ path is not used"
  - "Planning defaults per Claude's Discretion: research, prose, theo on; vector_model_download, judge_jev, citation_check, entity_extraction off; the navigator can overturn any line at the plan review card (366-20 records the rulings)"
  - "A line that is off is decided before the grant question: a grant would change nothing, so no grant card is raised"
  - "plan_only is a new runQuick status beside done, reask and refused: no existing outcome fits (reask asks for a grant, refused exits 2 on the CLI and offline must exit 0)"
  - "A theo line that is off with research on does not stop the run: OpenAlex runs, the lane reports egress_line_off per leaf and needs no Theo grant cover"
metrics:
  tasks: 2
  files: 8
  completed: 2026-10-02
---

# Phase 366 Plan 17: Egress policy Summary

Egress is declared once in `data/egress-policy.json`, the planner's audit ledger refuses a record for any line that is off, and `--offline` turns every line off while a run still completes (judge Stage A only, research plan only, not sent).

## Commits

| Step | Commit | Subject |
|------|--------|---------|
| Task 1 RED | c99301b4f | test(366-17): add failing egress policy legs E1-E6 and E4b |
| Task 1 GREEN | 4dbbc7993 | feat(366-17): one declared egress policy, enforced by the audit ledger |
| Task 2 RED | d45201208 | test(366-17): add failing quick-run and CLI offline legs E7-E10 |
| Task 2 GREEN | 43fe93f08 | feat(366-17): quick run, Theo lane and deep fetch honor the egress policy; CLI --offline |

## What was built

- **Policy file.** `schema mos.egress-policy/1`, seven lines each `{ endpoint, default, scope, providers[] }`: `vector_model_download` (off), `judge_jev` (off, dev-time only per 355 D-44), `research` (on, per grant), `citation_check` (off), `prose` (on, host), `theo` (on, canon handles and released terms only), `entity_extraction` (off inside this pipeline). Endpoints only, never keys (T-366-74).
- **Reader.** `loadEgressPolicy(roomDir, { offline })` reads fresh every call and returns `{ schema, offline, lines, ignored }` with `lines[name].allowed`. The room override (`.mindrian/egress-policy.json`, `lines.<name>` as a boolean or `{default: bool}`) is AND-merged: it can turn a line off, a `true` over an off line is refused and named in `ignored` (`override_cannot_widen:judge_jev`), an unknown line, a malformed file, a bad value, or a file whose realpath leaves `.mindrian/` (symlink) is ignored and named. An unreadable plugin file fails closed (every line off). It never throws. `lineAllowed` is true only for a known line that is on; `lineForProvider` is derived from the file's `providers[]` and returns null for an unknown provider, which `lineAllowed` treats as off.
- **Ledger.** `appendAudit(roomDir, record, { policy }?)` validates the record shape first (its own reasons win), then maps `record.provider` to a line and refuses with `egress_line_off` before any write. The closed 23-key set is unchanged.
- **Quick run.** `runQuick` loads the policy once (`offline: o.offline === true`) right after plan soundness and before the grant check. A plan with OpenAlex searches needs the research line; a plan with only Theo leaves needs the theo line. Off returns `{ status: 'plan_only', reason: 'egress_line_off', line, offline, sent: false, outcome: 'plan_only_not_sent', answer_line, card (the plan review card), run_id }` with zero fetches, zero calls, no run state and no audit row. `coverFor` answers `{ covered: false, reason: 'egress_line_off', line }` so the ambient path stops before it spends a throttle slot. The policy is passed to every `appendAudit` and to `runTheoLane`.
- **Theo lane.** With the theo line off `runTheoLane` makes zero calls and each leaf reports `skipped / egress_line_off` (verdict unresolved); the evidence card words it as "the Theo egress line is off, so nothing was sent".
- **Deep fetch.** `executeQueries` (the one deep fetch door, also used by counterevidence) refuses `egress_line_off` before any fetch.
- **CLI.** A valueless `--offline` flag on `run-quick`, `perspective-recall`, `perspective-judge` (refused elsewhere, refused with a value). `run-quick` returns `ok:true status:plan_only sent:false` and exits 0; recall and judge echo `offline:true`.

## Provider inventory (E4b input)

Every provider string the planner can write to the audit ledger: `openalex` (`PROVIDER` in quick.cjs and deep.cjs; the only entry of `grants.STANDING_SCOPE.providers`) and `theo` (`grants.THEO_PROVIDER`, written by theo-lane.cjs). Both map to a line (`research`, `theo`). The sweep leg scans every `PROVIDER = '...'` and literal `provider: '...'` under `lib/core/research-planner/` plus the grants lists and fails naming the provider and file when a new adapter has no policy entry.

## Verification

- `node tests/test-366-egress-policy.cjs`: PASS 24, FAIL 0 (E0-E10 including E1b, E2b, E4b, E5b/c, E6b/c, E7b, E8b/c, E9b/c; zero network attempts in-process; the CLI legs run spawned with no vendor keys)
- Regression, all green: `test-366-cli-perspective` 7/0, `test-366-theo-lateral-lane` 23/0, `test-seed104-grant-family-loop` 19/0, `test-363-run-quick` 19/0, `test-353-tripwires` PASS=5, `test-366-eureka-filing` 20/0, `test-366-ambient-offer` 13/0, `test-363-grants` 13/0, `test-363-cli` 22/0, `test-363-mcp-tool` 15/0, `test-363-ambient` 18/0, `test-366-mcp-perspective-ops` 9/0, `test-seed103-eureka-perspective` 39/0, `test-365-never-do-ambient` 18/0.
- `bash tests/run-all-366.sh` (temp HOME and MINDRIAN_ROOMS_HOME): PASSED=62 FAILED=0 SKIPPED=6 KNOWN=1; the egress leg ran inside it.
- `bash tests/run-all-363.sh` (temp HOME and MINDRIAN_ROOMS_HOME): PASSED=43 FAILED=2 SKIPPED=1 KNOWN=8. The two failures are not from this plan and are identical before and after Task 2: `run-all-3551` (PASS=62 FAIL=6, the known env drift) and "no new dependency" (a peer's `@modelcontextprotocol/ext-apps` and `node` additions in package.json and the shrinkwrap).
- Acceptance greps: policy lines 7; `egress_line_off` in audit-ledger 2; `lineAllowed` in quick.cjs 4; `'--offline'` in research-planner.cjs 7; no em-dash or en-dash in any touched file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] theo-lane.cjs honors the policy (file not in files_modified)**
- **Found during:** Task 2 (E9 requires `runTheoLane` itself to make zero calls and report the off line).
- **Fix:** `runTheoLane` takes an optional `policy` on its run argument (loads it from the room when absent) and reports `egress_line_off` per leaf; passes `{ policy }` to `appendAudit`.
- **Files modified:** lib/core/research-planner/theo-lane.cjs
- **Commit:** 43fe93f08

**2. [Rule 2 - Missing critical] deep.cjs refuses an off research line before the fetch (file not in files_modified)**
- **Found during:** Task 2. The ledger refuses an off line, but quick and deep write the audit row AFTER the fetch, so on its own the ledger refusal would let the egress happen unaudited (E7 showed this: one fetch, then `audit_write_failed`). Quick got the pre-check the plan asked for; deep has the same shape and the same 363 `PROVIDER = 'openalex'`.
- **Fix:** one check at the top of `executeQueries`, the single deep fetch door.
- **Files modified:** lib/core/research-planner/deep.cjs
- **Commit:** 43fe93f08

**3. [Rule 3 - Scope] The "run header" for --offline is the CLI output, not the candidates.jsonl header**
- Recall and judge are offline already and the flag is accepted for ergonomics; recording it in `candidates.jsonl` would mean threading an option through every perspective module (some owned by plan 366-18). `perspective-recall` and `perspective-judge` echo `offline: true` in their JSON header instead.

**4. [Closed list] New runQuick status `plan_only`**
- No existing outcome fits: `reask` asks for a grant and `refused` exits 2 on the CLI while `--offline` must exit 0. The runQuick statuses are now done, reask, plan_only, refused. The audit OUTCOMES list is unchanged (nothing is written for a plan-only run).

## Known follow-ups (not in this plan)

- **MCP door (lib/mcp/tools/research.cjs, peer-owned, not edited).** `opRunQuick` has no branch for `plan_only`, so a room whose override turns research off gets `refuse('run_refused', {detail: 'egress_line_off'})`. Honest and zero egress, but not a typed plan-only answer. The MCP tool cannot pass `offline` either. A small branch there is owed once the lib/mcp swap settles.
- **Plan review card.** `planner.cardFor` returns `next: 'revise', reason: 'egress_line_off', card: null` for a quick plan whose line is off. The navigator-facing "overturn a line at the plan review card" affordance is not built here; the policy file and the room override are the levers today. 366-20 records the rulings.
- `reaskCard` still builds a Theo run proposal for a plan with Theo leaves even when the theo line is off for the room (only reachable with research on and a mixed plan).

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or trust boundary: the only new file read is the room override, contained by realpath under `.mindrian/` (T-366-70), and every threat in the register is covered (T-366-71 unknown provider null/off, T-366-72 `egress_line_off` returned with no partial row, T-366-73 judge_jev and citation_check default off and `test-353-tripwires` green, T-366-74 endpoints only).

## Self-Check: PASSED

- FOUND: data/egress-policy.json, lib/core/research-planner/egress-policy.cjs, tests/test-366-egress-policy.cjs
- FOUND commits: c99301b4f, 4dbbc7993, d45201208, 43fe93f08
