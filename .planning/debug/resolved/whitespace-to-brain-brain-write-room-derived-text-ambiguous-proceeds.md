---
status: resolved
kind: rca
trigger: "whitespace-to-brain-brain-write-room-derived-text-ambiguous-proceeds"
issue_id: "B2"
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8, 9]
created: 2026-11-06T12:00:00Z
updated: 2026-11-06T12:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 8bee5f739dff01c2d530987707a7138a7326c2f8, worktree /home/jsagi/dev/MindrianOS-Plugin-release. No code file in the tree had uncommitted edits at read time (only .planning files).
- **WIRE claims probe against:** none. `globalThis.fetch` was replaced by a counter. 0 network calls. 0 Brain calls. Throwaway HOME. No real room bound.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding; otherwise tagged `needs-source-reverify`.
- **Data rule (Canon Part 8):** every string in the reproduction is synthetic. The marker string is a fake token. This file holds counts, byte lengths, verdict names and booleans only. It holds no room content.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: `classify()` has no arm for `brain_write`, so every `brain_write` payload that clears the deny-list falls to the terminal `ambiguous/unknown`. `callTool` sends on `ambiguous`. The hook allows `ambiguous/unknown` on the two shim-backed scopes and never sees the script path. So the whitespace pipeline can put a Cypher write on the wire with no block at any seam.
test: PROVEN in this file (see Evidence E1 to E8). Reproduced on synthetic strings with a fetch counter.
expecting: met. The owner must choose how to close it before plan 386-04 changes guard code.
next_action: owner decision (option A, B or C in plan 386-02, Task 2). Plan 386-04 implements option A only.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta line on main (no release cut in this plan)
- Reported by: external auditor, findings B2 and C1 (`.planning/audits/AUDITOR-FINDINGS-source.md`), checked in `.planning/audits/EGRESS-CLAIMS-CHECK.md`
- Date first observed: 2026-11-05 (audit); reproduced 2026-11-06
- Related debug sessions: part8-egress-guard-blocks-pws-brain-mcp-unconditionally, part8-egress-guard-under-blocks-key-shape-and-spelled-money, 245-part8-contentless-block (resolved), quick 260917-dgf (hook alignment for ambiguous)

## Problem Statement

A room write can start a detached pipeline that ends in `scripts/whitespace-to-brain.cjs`. That script sends `brain_write` Cypher to the remote Brain. The Part 8 guard answers `ambiguous` for this payload, and `brain-client.cjs` `callTool` proceeds on `ambiguous`, so no seam blocks the write. The script also counts a refused write as a success.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: A Cypher write built from data derived from a room never reaches the Brain unless a gate with a positive allow rule says so (PRD rule: never allow on ambiguous). A refused write is reported as refused.
actual: `classify()` returns `ambiguous/unknown` for a brain_write payload. `callTool` sends it and attaches `egress_disclosure` with disposition `proceeded`. `whitespace-to-brain.cjs` counts a write refused with the `egress_blocked` sentinel as written (`zones_written` 1, `errors` 0).
errors: none. The defect is a silent proceed and a false success count.
reproduction:
  1. Run the scratch script `repro.cjs` (session scratchpad, outside the repo) from the repo root. It replaces fetch with a counter and uses a throwaway HOME.
  2. Read the printed JSON: classify verdicts, hook exit codes, callTool fetch counts, whitespace-to-brain summaries.
started: Not dated. `callTool` proceed-on-ambiguous was ruled on 2026-09-02 (Phase 254, D-02 Option A) for read tools. brain_write has had no allow or block arm since the guard was written.

## Scope and Impact

- Affected surfaces: cli (hooks, scripts), desktop and cowork through the MCP shim proxy tool `brain_write` (by construction, not run).
- Affected commands: detached auto-explore after a room write (`scripts/auto-explore-fire.cjs`), `scripts/discovery-cycle.cjs` step 8, the shim tool `brain_write` in `scripts/mindrian-brain-mcp-client.cjs`.
- Affected users: installs with a Brain key or default Brain URL that run a discovery cycle with at least 1 validated whitespace zone.
- Version range: not bisected.
- Severity: high (a write to the Brain on an open verdict; Part 8 says LOCAL to BRAIN is no).
- Blast radius: every caller of `brainClient.write`. There are 2: the shim proxy tool and `scripts/whitespace-to-brain.cjs`. Census test `tests/test-quick-260910-h32-no-brain-write-from-scripts.cjs` lists the allowed `brain.write(` sites.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The hypothesis text sent to the Brain comes from room artifact titles or section names (the three discover-*-whitespace.py scripts), as the auditor and the plan pre-read state.
  evidence: PARTIAL. Those three scripts do build `hypothesis` from room titles (discover-hsi-whitespace.py `left_title`/`right_title`, discover-rs-whitespace.py `source_section`/`target_section`, discover-analogy-whitespace.py `source_title`/`target_title`). But their zones go to `.mindrian/discovery-*-whitespace.json` and `.mindrian/discovery-cycle-results.json`. `whitespace-to-brain.cjs` reads only `.mindrian/interpretation-results.json`. The only writer of that file is `scripts/interpret-whitespace.cjs`, which reads only `.mindrian/whitespace-results.json`. The only writer of that file is `scripts/compute-whitespace-gaps.py`, whose gap hypothesis is the template "Room has not explored topics related to '<name>'" where `<name>` is a Brain framework name from the Brain baseline (`brain_names`). Verified by grep for writers of both files. No room title reaches the Brain by this path in the shipped pipeline.
  timestamp: 2026-11-06T12:00:00Z
  note: This narrows the data claim only. The seam defect stays (E2 to E6). The send still carries room-derived numbers (density_score, strategic_rank, the zone hash input) and trusts a file in the room folder with no check of its text (E7).

## Evidence
<!-- APPEND only - facts discovered -->

- E1 (classify verdicts). checked: `classify({cypher: <neutral synthetic MERGE with a hypothesis property>}, {toolName, roomDir: null})`. found: PROVEN. `ambiguous / unknown` for all 5 tool names: `brain_write`, `mcp__plugin_mos_mindrian-brain__brain_write`, `mcp__mindrian-brain__brain_write`, `mcp__pws-brain-mcp__brain_write`, `mcp__theo__brain_write`. A plain read-style Cypher (`MATCH (n) RETURN 1`) also gives `ambiguous / unknown`. `_isFreeFormTool('brain_write')` is false. implication: `classify()` has no arm for `brain_write`. It falls to the terminal `ambiguous/unknown` at the last return of `classify()` in `lib/core/part8-egress-guard.cjs`.

- E2 (hook exit codes, PART8_FORCE_BRAIN_AVAILABLE set). checked: child process `scripts/part8-egress-guard-hook.cjs`, PreToolUse JSON on stdin, cwd a throwaway folder. found: PROVEN. See the disposition matrix below. The hook allows `brain_write` on the two shim-backed scopes (exit 0), blocks on `mcp__pws-brain-mcp__` and `mcp__theo__` when the Brain is available (exit 2, 343 bytes on stderr, no payload bytes in stderr), and allows every scope when the Brain is forced unavailable. The bare name `brain_write` (what the script path uses) is not Brain-shaped, so the hook allows it before `classify()` (exit 0). implication: the hook and `callTool` agree only by accident on the shim scopes. On the two direct scopes the hook is stricter than `callTool`.

- E3 (callTool on ambiguous, wire fails). checked: `callTool('brain_write', {cypher})` with fetch replaced by a counter. The counter answers `initialize` with ok and answers `tools/call` with HTTP 400. found: PROVEN. 2 fetch calls (`initialize`, `tools/call`). The `tools/call` request body was 222 bytes and held the synthetic marker (boolean true). The function returned `null` (transport failure), not an `egress_blocked` sentinel. implication: the bytes crossed the guard seam and reached the fetch call. A refused or failed write still put the bytes on the wire.

- E4 (callTool on ambiguous, wire ok). checked: same call, counter answers `tools/call` with a fake success body. found: PROVEN. 1 fetch call (session already cached). The result carried `egress_disclosure` with `disposition: proceeded` and `egress_class: unknown`. implication: callTool treats `ambiguous` as proceed for this tool, as ruled in Phase 254 for read tools. No rule exempts a write.

- E5 (callTool on a block verdict, control). checked: a payload with a synthetic company-suffix pattern. found: PROVEN. `classify` gives `block / content_set`. 0 fetch calls. The result is the `egress_blocked` sentinel object, not `null`. implication: the deny-list works for brain_write. Only the open arm (`ambiguous`) is the gap.

- E6 (whitespace-to-brain main() on a fixture room). checked: a temporary room with a `.mindrian/interpretation-results.json` of 1 validated gap (fake hypothesis with the marker), `main(room, {})`, fetch counter. found: PROVEN.
  - Neutral hypothesis, wire ok: 4 `tools/call` requests (1 zone node, 2 edges, 1 aggregation). The marker was in at least 1 request body (boolean true). Summary: `zones_written` 1, `edges_created` 2, `aggregation_ran` true, `errors` 0.
  - Neutral hypothesis, wire fails: 4 `tools/call` requests, marker in a body (true). Summary: all counts 0, `errors` 4.
  - Hypothesis that trips the deny-list: the zone node write was refused by `callTool` with the `egress_blocked` sentinel (marker in no body, 3 fetch calls for the 2 edges and the aggregation). Summary: `zones_written` 1, `errors` 0. implication: `brainWrite()` returns `result !== null`, and a sentinel object is not `null`, so a refused write counts as a success. This matches the pre-read. The summary then reports a write that did not happen.

- E7 (caller chain and data source). checked: reading `scripts/auto-explore-fire.cjs`, `lib/core/ambient-trigger.cjs`, `scripts/discovery-cycle.cjs`, `scripts/whitespace-to-brain.cjs`, `scripts/interpret-whitespace.cjs`, `scripts/compute-whitespace-gaps.py`. found: PROVEN by reading, not run end to end.
  - Chain: a room write or an ambient close-out starts the detached `scripts/auto-explore-fire.cjs`. It spawns `node scripts/discovery-cycle.cjs <room> --steps all`. Step 8 of `runDiscoveryCycle` runs `execSync('node scripts/whitespace-to-brain.cjs <room>')` when `opts.dryRun` is false, with a 30000 ms timeout, and swallows every error.
  - Conditions: `.mindrian/whitespace-embeddings.json` must exist (preflight); `.mindrian/interpretation-results.json` must exist with at least 1 gap where `validated === true`; `brain.isAvailable()` is true when a Brain URL string exists (the default URL is always set, so this is always true today); not `--dry-run`. No Brain key is needed for this check.
  - Data in the Cypher: `problem_type` (from Brain classification or the fallback `Un-Defined`), `density_score` and `strategic_rank` (numbers derived from the room embeddings), `hypothesis` capped at 500 characters, framework chain names (generic), and a zone hash of problem type, density and first framework. The hypothesis in the shipped pipeline is the compute-whitespace-gaps.py template with a Brain framework name (see Eliminated).
  - Trust gap: `whitespace-to-brain.cjs` does not check the text it reads. Any other writer of `interpretation-results.json` (a user, a tool, a future script) puts any text into the Cypher, up to 500 characters. No such writer exists in the repo today (grep).
  implication: the room-derived signal is the density and rank numbers and the existence of a zone. The text risk is a trust-boundary risk (a room-folder file read as input), not a proven leak of room titles. Severity stays high because the seam has no block and no positive rule.

- E8 (Theo and the shim tool). checked: `data/brain-surface-contract.json` and `scripts/mindrian-brain-mcp-client.cjs`. found: `brain_write` is not in `data/brain-surface-contract.json` (grep, 0 hits). The shim registers it (`server.registerTool('brain_write', ...)`) as an admin-tier proxy with the description "The remote may refuse writes unconditionally", and it calls `brainClient.write(cypher)`. The only 2 callers of `brainClient.write` are that proxy and `whitespace-to-brain.cjs`. UNVERIFIED: whether the live Theo offers `brain_write` at all. The live Brain was not asked (Part 8, no Brain call). The shim description suggests the remote may refuse it. implication: a refusal at the remote does not undo the egress, since the bytes already crossed (E3).

- E9 (typed read tools on each scope, extra check for the PENDING debug file). checked: classify and the hook for `normalize_framework_name {raw}`, `operate_framework {framework}`, `discover_structure {query}`, each under the 3 prefixes, Brain forced available. found: PROVEN. All 9 rows are `ambiguous / unknown` from `classify()`. Hook exit: 0 for `mcp__plugin_mos_mindrian-brain__` and `mcp__theo__`; 2 for `mcp__pws-brain-mcp__`. The `mcp__theo__` non-brain-verb names exit 0 because they are not Brain-shaped (the hook allows before `classify()`). implication: see the paragraph on the PENDING files below.

### Disposition matrix (brain_write, neutral synthetic Cypher, Brain available)

| Scope (tool name prefix) | classify verdict | Hook exit | callTool disposition |
|---|---|---|---|
| `mcp__plugin_mos_mindrian-brain__brain_write` | ambiguous / unknown | 0 (shim-backed, `unknown` is in the allow set) | proceed, disclosure attached (E4) |
| `mcp__mindrian-brain__brain_write` | ambiguous / unknown | 0 (shim-backed) | proceed, same |
| `mcp__pws-brain-mcp__brain_write` | ambiguous / unknown | 2 (not shim-backed, gate text) | not on this path (direct connector) |
| `mcp__theo__brain_write` | ambiguous / unknown | 2 | not on this path (raw Theo, no `callTool`) |
| bare `brain_write` (script path) | ambiguous / unknown | 0 (not Brain-shaped, no hook run) | proceed (E3, E6) |

With the Brain forced unavailable (`PART8_FORCE_BRAIN_AVAILABLE=0`) every row exits 0 in the hook. The script path never passes the hook in any case.

### The 2 PENDING debug files (not changed)

- `part8-egress-guard-blocks-pws-brain-mcp-unconditionally`: E9 explains the symptom. On `mcp__pws-brain-mcp__`, every typed tool without an allow arm classifies `ambiguous/unknown`. The scope is Brain-shaped but not shim-backed, so the hook falls past the allow set and exits 2 when the Brain is available. 3 of 3 probed tools blocked, independent of the argument. The earlier session saw 3 of 3 calls blocked with the same card. The match is strong, but the original session was not replayed here, so the root cause there stays recorded as probable, not final. The fix order in the PRD (typed allow arms first, then ambiguous as a block on the routes that send it) addresses it. This plan does not change that file.
- `part8-egress-guard-under-blocks-key-shape-and-spelled-money` (GAP1 and GAP2, key shapes and spelled money): out of scope here. They stay open in the corpus baseline. This RCA does not test or widen those patterns.

## Technical Root Cause

Site: `lib/core/part8-egress-guard.cjs` function `classify` (terminal return), `lib/core/brain-client.cjs` function `callTool` (ambiguous branch), `scripts/part8-egress-guard-hook.cjs` function `main` (ambiguous branch and shim-backed allow set), `scripts/whitespace-to-brain.cjs` functions `brainWrite` and `main`.

Cause, in fact order:
1. `classify()` has no arm for `brain_write`, so a payload that clears the deny-list reaches the terminal `ambiguous / unknown` (E1).
2. `callTool` treats `ambiguous` as proceed on every tool, including a write, and attaches a disclosure (E3, E4). The 2026-09-02 ruling covers read tools. No rule exempts or covers a write.
3. The hook allows `ambiguous / unknown` on the two shim-backed scopes (E2), so the hook and `callTool` agree there by accident. On `mcp__pws-brain-mcp__` and `mcp__theo__` the hook blocks, so the two seams diverge for those scopes.
4. The script path calls `brainClient.write` with the bare tool name. It never passes the PreToolUse hook (E2, bare row).
5. `whitespace-to-brain.cjs` builds the Cypher from a room-folder file with no text check, caps the text at 500 characters only, and counts a returned sentinel object as a success because `brainWrite` returns `result !== null` (E6, E7).

Why it surfaces now: not a new regression. The write path predates the Part 8 guard. The audit (B2, C1) found it while checking that `callTool` proceeds on `ambiguous`.

## Required Code Changes
<!-- Explicit, imperative, one block per change. Option A in prose; plan 386-04 implements it only after the owner decision. -->

Option A, in prose:

- In `lib/core/part8-egress-guard.cjs`, add an arm to `classify()` for the tool name `brain_write` (bare name and the suffix of every scoped name). The arm runs after the deny-list scan and before the final return. It returns `block` with class `write_blocked` and a constant reason that holds no payload bytes, for every payload. It adds no allow rule for `brain_write`. Update the verdict-class docblock. The hook then exits 2 on the shim-backed scopes and `callTool` returns the `egress_blocked` sentinel, so both seams agree for this tool. Check that the hook's block text for an unknown class names the class only.
- In `scripts/whitespace-to-brain.cjs`, change `brainWrite` so it treats a result with `error: 'egress_blocked'` as blocked, not as a success. Add a `blocked` count to the summary. Stop sending the hypothesis text (send a fixed placeholder or omit the property), so a text from the room folder never goes into the Cypher. Keep the fire-and-forget exit 0 rule. Keep `--dry-run` behavior.
- In `scripts/discovery-cycle.cjs` step 8, log one honest line when the summary shows blocked writes, for example that the Brain write was refused by the Part 8 guard. Do not change the swallow-all-errors rule for the exec itself.
- The Phase 254 rule for read tools stays as ruled on 2026-09-02: `ambiguous` discloses and proceeds in `callTool`. This RCA records the remaining read-tool divergence: the hook blocks `ambiguous/unknown` on `mcp__pws-brain-mcp__` (and on `mcp__theo__` Brain-verb names) when the Brain is available, and `callTool` proceeds. Option B would close that divergence for all tools.
- Cost of option A: the shim proxy tool `brain_write` always answers `egress_blocked`. The documented admin write path (`scripts/admin-brain-write.cjs`, direct driver) does not use `callTool` and is not affected (UNVERIFIED here: read only through the census test text, not run).
- Update the census test allowlist only if a `brain.write(` site changes. It does not change under option A.

Cross-checks to clear before the fix is called done (RCA gates): Part 8 (no user bytes reach the Brain: option A removes the only sender and blocks the tool at both seams), Tri-Polar (CLI hook and script verified by construction, Desktop and Cowork through the shim proxy by construction, not run), cross-platform (no process spawning or path change; Linux-run only), reuse before build (extends `classify()` and `brainWrite`; adds no surface), no em dashes.

## Tests to Add or Update

- Test 1 (red first):
  - Type: unit
  - Location: new `tests/test-386-brain-write-blocked.cjs`
  - Given: neutral synthetic Cypher payloads, a fake marker string, fetch replaced by a counter
  - When: `classify({cypher}, {toolName})` runs for the 5 tool names, and `callTool('brain_write', ...)` runs
  - Then: verdict `block`, class `write_blocked`, fetch count 0, result is the `egress_blocked` sentinel. Today it fails with `ambiguous` and 1 or 2 fetch calls.
- Test 2:
  - Type: integration
  - Location: same file or `tests/test-386-whitespace-to-brain-blocked.cjs`
  - Given: a temporary fixture room with 1 validated gap, fake key env, fetch counter
  - When: `main(room, {})` runs
  - Then: fetch count 0, summary shows `zones_written` 0, `errors` or `blocked` greater than 0, marker in no body. Today the summary shows `zones_written` 1.
- Test 3:
  - Type: unit (hook)
  - Location: same file
  - Given: PreToolUse JSON for the two shim-backed scopes, Brain forced available
  - When: the hook child process runs
  - Then: exit 2 for `brain_write`, no payload bytes on stderr.
- Test 4: read-tool control. `callTool` still proceeds with a disclosure on `ambiguous` for a read tool (existing `tests/test-254-ambiguous-disclosure.cjs` stays green).
- Runner registration: add to the phase 386 `tests/run-all-386.sh` (created by the plan that owns it) and keep `tests/run-all-196.sh` and the census test green.

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the target version when the fix ships (not in this plan).
- Release lockstep: applies only if the fix ships. See `.claude/includes/release-process.md`.
- Canon: if the guard behavior is stated in `docs/MINDRIAN-CANON.md` Part 8, update it in the same commit as the code fix. Declare canon_parts in the plan.
- knowledge-base.md: on resolve, add the summary block (not in this plan).
- Owner follow-up: the shim `brain_write` proxy tool description says "Generic methodology framework writes only". After option A it should say it is refused. Plan 386-04 decides the wording.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Confirmed, see Technical Root Cause. classify() had no arm for brain_write, so a payload that cleared the deny-list fell to the terminal ambiguous/unknown, and callTool proceeds on ambiguous. The data claim of the auditor is PARTIAL (text is a Brain framework name in the shipped pipeline; room-derived values are density and rank numbers). The seam claim is CONFIRMED.
fix: Implemented by plan 386-04, option A. (1) lib/core/part8-egress-guard.cjs: new private predicate _isBrainWriteTool(toolName) and one arm in classify() after step 1 and step 1b, before the packet check: verdict block, class write_blocked, a constant reason with no payload bytes, no allow rule. Step 1 is unchanged. (2) scripts/part8-egress-guard-hook.cjs: the block branch gives a distinct message for write_blocked. (3) scripts/whitespace-to-brain.cjs: the wz.hypothesis assignment is removed, brainWriteOutcome() separates ok, blocked and failed, a result with an own error property is never a success, and the summary has a new blocked field. (4) scripts/discovery-cycle.cjs step 8: captures the script stdout and logs one line when blocked is above 0. (5) tests/test-brain-client-params.cjs: the brain.write case now pins the refusal (egress_blocked, 0 requests on the wire) instead of the wire shape, because the guard now refuses before the wire.
verification: (all on synthetic strings, fixture room, fake key, fetch replaced by a counter, 0 network calls)
  - RED proof: tests/test-386-b2-brain-write-blocked.cjs at commit 38df8b772 failed exactly A1, A3, A4, A5, A6 (18 failing checks) and passed A2 and A7.
  - GREEN proof: the same test passes all 7 arms after commit 4cb862239.
  - bash tests/run-all-196.sh: 7 passed, 0 failed (baseline 6 passed, 0 failed; the 7th leg is the new 386-04 leg). One earlier run showed a transient room_check_unavailable in the 260917-dgf leg while peer processes ran in the same tree; the rerun and a direct run were green. UNVERIFIED root of that flake (not caused by this plan: the same test passed on a copy of HEAD with and without the 386-04 files).
  - bash tests/run-all-245.sh: PASS=19 FAIL=0 (baseline PASS=19 FAIL=0).
  - bash tests/run-all-3692.sh: PASSED=70 FAILED=3, all 3 unrelated to brain_write (see the list below); the corpus gate DELTA lines are identical before and after (pos26 blocked_no_room 0, ext blocked_no_room 37, negatives.leaks empty; the catalog NOTE line, baseline 522 vs measured 535, is the same in both runs), XFAIL for the 3 alias rows unchanged, and tests/fixtures/3692/guard-survey-baseline.json has an empty git diff.
  - bash tests/run-all-252.sh: PASS=1 FAIL=1. The failure is tests/test-252-guard-census.cjs census.1 and census.5b, the same 2 failures as before this plan (PROVEN at the clean copy of the RED commit). No arm about whitespace-to-brain fails.
  - bash tests/run-all-386.sh: PASS=12 FAIL=1. The 1 failure is tests/test-386-framework-run-halt-gate-minted.cjs, the RED test of plan 386-19 (a peer plan in progress). It is unrelated to this plan.
  - node tests/test-quick-260910-h32-no-brain-write-from-scripts.cjs: pass. node tests/test-257-brain-tool-egress-invariant.cjs and test-257-shim-honest-refusal.cjs: pass. node tests/test-brain-client-params.cjs: pass after the update.
  - scripts/check-pending-breakthrough.test.cjs: 4 pass, 1 fail (Test 12), the same known failure as before this plan.
  - tests/test-257-strict-input-shapes.cjs Arm B fails (a theo_health call was captured). It fails at the clean copy of the RED commit too (PROVEN), so it predates this plan.
  - The 3 failures of run-all-3692 that are not from this plan: (a) test-mux-card-before-answer S3 (gateLedger.mintGate renderer census, peer area); (b) test-muy-real-room-rule G4, G6 to G8, G11 to G15 (the real-room receipt is tied to the HEAD sha and HEAD moves as peer plans commit); (c) the no-new-dependency check (flexsearch removed by commit 45713ce56, plan 385-02). None of the 3 test files mention brain_write, whitespace-to-brain or write_blocked.
files_changed: lib/core/part8-egress-guard.cjs, scripts/part8-egress-guard-hook.cjs, scripts/whitespace-to-brain.cjs, scripts/discovery-cycle.cjs, tests/run-all-196.sh, tests/test-brain-client-params.cjs, tests/test-386-b2-brain-write-blocked.cjs (new)
commits: 38df8b772 (test, RED), 4cb862239 (fix, GREEN)

### Final disposition matrix (brain_write, neutral synthetic Cypher, Brain available, after plan 386-04)

| Scope (tool name prefix) | classify verdict | Hook exit | callTool disposition |
|---|---|---|---|
| `mcp__plugin_mos_mindrian-brain__brain_write` | block / write_blocked | 2 | block, egress_blocked sentinel, 0 fetch calls (same classify) |
| `mcp__mindrian-brain__brain_write` | block / write_blocked | 2 | block, same |
| `mcp__pws-brain-mcp__brain_write` | block / write_blocked | 2 | not on this path (direct connector); the hook blocks |
| `mcp__theo__brain_write` | block / write_blocked | 2 | not on this path (raw Theo); the hook blocks |
| bare `brain_write` (script path) | block / write_blocked | 0 (not Brain-shaped, the hook never runs for it) | block, egress_blocked sentinel, 0 fetch calls |

Brain forced unavailable (PART8_FORCE_BRAIN_AVAILABLE=0): hook exit 2 on the 4 scoped rows, because a block verdict does not depend on Brain availability (PROVEN by the probe). The bare name still exits 0 in the hook, but callTool blocks it, and the script path only ever goes through callTool. whitespace-to-brain on a fixture room with a validated gap now makes 0 fetch calls and reports zones_written 0, edges_created 0, aggregation_ran false, errors 0, blocked 4.

The read-tool ambiguous divergence stays as ruled by Phase 254 (2026-09-02): callTool discloses and proceeds on ambiguous for read tools, and the hook still blocks ambiguous/unknown on mcp__pws-brain-mcp__ and on mcp__theo__ Brain-verb names. This plan does not change it.

### Cross-note for the 2 PENDING debug files (not changed)

- `part8-egress-guard-blocks-pws-brain-mcp-unconditionally`: the matrix above does not explain that symptom. brain_write is now blocked by name on every scope, which is a new, deliberate block. The pws-brain-mcp symptom concerns typed READ tools that classify ambiguous/unknown (E9) and stay so after this plan. The explanation in the earlier cross-note (typed tools without an allow arm) still stands and is untouched.
- `part8-egress-guard-under-blocks-key-shape-and-spelled-money` (GAP1 and GAP2): not touched. Both remain open in the corpus baseline, which is unchanged.

### Follow-ups left open by this plan

- The shim tool description for brain_write (scripts/mindrian-brain-mcp-client.cjs) still says "Generic methodology framework writes only". It is now always refused. The file is outside this plan's file list, and the shim contract tests may pin the text. Change the wording in a later plan that owns the shim.
- Plan 386-21 moves this file to resolved and writes the knowledge-base entry.

## Owner decision

decision: option-a
date: 2026-11-06
reason: Option A is the smallest change that meets the PRD rule (a Brain write sits behind a closed gate and is never allowed on ambiguous), and it leaves the 2026-09-02 read-tool ruling and the 16 callTool wrappers untouched.
scope: Plan 386-04 implements option A only: classify() blocks every brain_write payload with class write_blocked and no allow rule; scripts/whitespace-to-brain.cjs sends no hypothesis text and counts a blocked write as blocked, not as a success; scripts/discovery-cycle.cjs step 8 logs one honest line. Options B and C are not chosen. Plan 386-04 needs no revision.
evidence_note: The data claim of B2 is PARTIAL (the shipped hypothesis text is the framework-name phrase from compute-whitespace-gaps.py, and the room-derived values are density and rank scores, not room titles). The seam defect is CONFIRMED. See Eliminated and Evidence E6, E7.
recorded_by: plan 386-02 executor, from the owner answer relayed by the coordinator on 2026-11-06.
