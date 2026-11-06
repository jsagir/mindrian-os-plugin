---
status: resolved
kind: rca
trigger: "part8-ambiguous-verdict-is-sent-on-own-shim"
issue_id: "E-AMB"
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T10:00:00Z
updated: 2026-11-06T10:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 7f078287a (working tree of /home/jsagi/dev/MindrianOS-Plugin-release, plugin 2.0.0-beta.80), after plans 386-25, 386-28, 386-30 and 386-37.
- **WIRE claims probe against:** none. No Brain call, no network. The wire is a stub: `globalThis.fetch` is replaced by a counter. The guard is wrapped by a spy in `require.cache`; the spy records the verdict and returns it unchanged.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim carries PROVEN (run in this session), UNVERIFIED or ASSUMED. Source of the claim: auditor egress message, section F of AUDITOR-FINDINGS-source.md, as checked in EGRESS-CLAIMS-CHECK.md point 1. The Phase 254 ruling (2026-09-02, Option A) is a navigator ruling.

## Current Focus

hypothesis: an `ambiguous` verdict means "send with a disclosure" on the plugin's own shim (callTool, and the hook for the 2 shim-backed scopes), "block" on the direct connector, and "not inspected" on raw `mcp__theo__` typed names. So the same payload has 3 outcomes by route.
test: a spy on `classify` while every repo-owned wrapper and every repo-owned direct `callTool` caller runs with synthetic handle inputs and a fetch stub; a hook child process per route prefix with `PART8_FORCE_BRAIN_AVAILABLE` 1 and 0.
expecting: after plan 386-25 only a few repo-owned paths are still ambiguous, and none of them carries an edge or body string.
next_action: owner decision recorded 2026-11-06 (decision: option-e, context-based decomposition; see the Owner decision block). Plan 386-27 implements option-e.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: 2.0.0-beta.80
- Reported by: auditor egress message (hypothesis), checked in EGRESS-CLAIMS-CHECK.md point 1
- Date first observed: 2026-11-05
- Related debug sessions: part8-egress-guard-blocks-pws-brain-mcp-unconditionally (plan 386-25, resolved), part8-no-shape-test-for-sprouts-and-bodies (plan 386-37), whitespace-to-brain-brain-write-room-derived-text-ambiguous-proceeds (plan 386-04), part8-guard-fails-open-on-load-or-throw (plan 386-30)

## Problem Statement

The Phase 254 ruling (Option A, 2026-09-02) lets an `ambiguous` verdict proceed with an `egress_disclosure` on the plugin's own shim. The hook allows it for `mcp__mindrian-brain__*` and `mcp__plugin_mos_mindrian-brain__*`. The direct connector `mcp__pws-brain-mcp__*` is blocked by the hook on the same payload. Raw `mcp__theo__` typed names are never inspected. Owners see different outcomes by route, and the own routes send a payload the guard could not prove.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected: one meaning of `ambiguous` on every route, and no unproven body of text leaves the room.
actual: callTool sends an ambiguous call and attaches a disclosure (fetch calls 1 or 2, disclosure disposition `proceeded`). The hook exits 0 on both own scopes. The hook exits 2 on the direct connector when Brain is available, and exits 0 when Brain is not available. Raw theo typed names exit 0.
errors: none. The disclosure is typed and honest; the send is the ruled behavior.
reproduction:
  1. Scratch scripts (not committed): /tmp/claude-1000/-home-jsagi/7d57c6ef-4a06-4170-af16-564c4ba5e1a6/scratchpad/census26.cjs, matrix26.cjs, ct26.cjs.
  2. Census: spy on `classify` through `require.cache`, stub `fetch`, run each wrapper and each direct caller with synthetic handles.
  3. Matrix: spawn scripts/part8-egress-guard-hook.cjs for 4 route prefixes x 4 payloads x `PART8_FORCE_BRAIN_AVAILABLE` 1 and 0, temporary HOME.
started: Phase 254 (2026-09-02) for callTool; quick 260917-dgf and 260917-ild for the hook.

## Scope and Impact

- Affected surfaces: cli (hook plus callTool), desktop (callTool through the shim only; no PreToolUse hook), cowork (follows the CLI hook path).
- Affected users: every install, on a call whose payload the guard cannot prove (a typed handle that is not in the local snapshot, a tool with no allow arm).
- Severity: high in principle (an unproven string leaves), low today in fact: the census finds that every ambiguous repo-owned path carries only sprouts (see the census lines).
- Blast radius if ambiguous becomes a block for everything: the framework-name normalizer, the framework-name refresh and the typed handle reads (see the evidence for option C).

## Eliminated

- The whitespace baseline is not an ambiguous path now: `askOp('list_frameworks')` is allow (typed_read_shape), and its `brain_write` is blocked by plan 386-04 (write_blocked). PROVEN.
- The framework chains are not ambiguous for canonical handles: `recommend_chain`, `feeds_into_chains`, `discover_structure`, `orchestration_readiness`, `framework_neighborhood` are allow with a canonical handle. PROVEN.
- `sendPacket` has no production caller outside brain-client.cjs (grep). It was not run in the census. UNVERIFIED for its verdict; the typed packet path keeps its own class `unproven_packet`.

## Evidence

### Census table (verdict of the guard on every repo-owned Brain call path, spy on classify, fetch stubbed)

Shape column: `classifyShape` of plan 386-37 for each string value (kind and word count). Rows with no string show `-`.

| Wrapper or caller | Tool | Payload keys | Verdict | Class | String shapes |
|---|---|---|---|---|---|
| query | brain_query | cypher | allow | generic_question | sprout:6 |
| search | brain_search | query, namespace, topK | allow | generic_question | sprout:3 |
| smartSearch | brain_search | query, namespace, topK | allow | generic_question | sprout:3 |
| schema | brain_schema | - | allow | empty_payload | - |
| stats | brain_stats | - | allow | empty_payload | - |
| ask | brain_ask | question | allow | generic_question | sprout:11 |
| askOp list_frameworks (whitespace baseline) | brain_ask | op, params | allow | typed_read_shape | sprout:1 |
| askOp framework_edges | brain_ask | op, params | allow | typed_read_shape | sprout:1, sprout:3, sprout:1 |
| askOp framework_chain_slice | brain_ask | op, params | allow | typed_read_shape | sprout:1, sprout:3 |
| write (whitespace-to-brain) | brain_write | cypher | block | write_blocked | sprout:3 |
| normalizeFrameworkName, canonical handle | normalize_framework_name | raw | allow | typed_read_shape | sprout:3 |
| normalizeFrameworkName, non-canonical raw (chain-recommender, canon-release) | normalize_framework_name | raw | **ambiguous** | unknown | sprout:2 |
| loopSearch | search | query, topK | allow | generic_question | sprout:3 |
| discoverStructure | discover_structure | framework_name | allow | typed_read_shape | sprout:3 |
| orchestrationReadiness | orchestration_readiness | framework_name | allow | typed_read_shape | sprout:3 |
| feedsIntoChains | feeds_into_chains | seeds, max_hops | allow | typed_read_shape | sprout:3, sprout:3 |
| recommendChain | recommend_chain | problem_type, max_steps | allow | known_tool_shape | sprout:1 |
| enrichCausalEdges (4 Cypher templates) | brain_query | cypher | allow | generic_question | body:28, body:28, body:47, body:47 |
| suggestValidationSteps (2 raw fields, 4 Cypher templates) | brain_ask, brain_query | question, cypher | allow | generic_question | sprout:1, sprout:3, body:19, body:19, body:36, body:36 |
| hatAwareRecommend (1 question, 2 Cypher templates) | brain_ask, brain_query | question, cypher | allow | typed_question, generic_question | sprout:1, body:70, body:70 |
| framework_step (sr-steps, theo-structure) | framework_step | framework | allow | known_tool_shape | sprout:3 |
| framework_techniques (theo-structure) | framework_techniques | framework | allow | known_tool_shape | sprout:3 |
| case_story (theo-structure) | case_story | framework_name | allow | known_tool_shape | sprout:3 |
| find_connections (verification-stamp, capture-355) | find_connections | from, to | allow | known_tool_shape | sprout:3, sprout:3 |
| theo_health (brain-prewarm, class-m smoke) | theo_health | - | allow | empty_payload | - |
| command_neighborhood (refresh-framework-names) | command_neighborhood | command | **ambiguous** | unknown | sprout:1 |
| taxonomy_ladder (taxonomy-climb), with and without label | taxonomy_ladder | rung, question_label | allow | known_tool_shape | sprout:1 |
| find_frameworks_for_problem_type, commands_for_problem_type, recommend_chain, framework_neighborhood (theo-ask) | same | problem_type, max_steps, framework | allow | known_tool_shape | sprout:1 or sprout:3 |
| framework_concepts | framework_concepts | framework, limit | allow | typed_read_shape | sprout:3 |
| probe-brain-contract (brain_query, brain_search, search, brain_stats) | same | cypher, query, topK | allow | generic_question, empty_payload | sprout:6, sprout:3 |

Tools with no repo caller (only a model-issued call can reach them; they appear by name in lib/core/refusal-messaging.cjs only), run with a synthetic canonical handle. These are NOT counted in the census lines below:

| Tool | Payload keys | Verdict | Class | String shapes |
|---|---|---|---|---|
| load_framework | framework | ambiguous | unknown | sprout:3 |
| intra_framework_flow | framework | ambiguous | unknown | sprout:3 |
| find_bottlenecks | framework | ambiguous | unknown | sprout:3 |
| rank_influence | framework | ambiguous | unknown | sprout:3 |
| find_whitespace | framework | ambiguous | unknown | sprout:3 |
| structural_neighbours | framework | ambiguous | unknown | sprout:3 |

Data-dependent ambiguity (PROVEN with an invented handle `Unknown Handle Xq`): `framework_neighborhood`, `framework_step`, `discover_structure`, `feeds_into_chains`, `taxonomy_ladder` (rung outside the 4 values), `recommend_chain` (problem_type outside the enum) and `normalize_framework_name` all classify ambiguous when the handle is not in the local snapshot (data/framework-names.json). `find_connections` allows a short label. So a Theo-returned name that is newer than the snapshot makes a typed read ambiguous. Its string is a sprout.

census_ambiguous_repo_paths: 2
census_ambiguous_body_paths: 0
census_split_route_callers: 0
census_codepath_body_callers: 0

Definition of the two lines above (added by the option-e decision of 2026-11-06). Both count rows of the census table whose guard verdict is ambiguous and whose payload holds a string that `classifyShape` calls edge or body. Those are the only calls that plan 386-27 answers with the typed outcome sprouts_required, because the shape test reads only the strings of an ambiguous verdict. Caller kind: model means a tool call the host model composes; code means a pipeline, script or refresh with no model. Result from the saved census (54 rows, scratch file census26.json): the ambiguous rows are the 2 repo-owned paths (`normalize_framework_name` from chain-recommender and canon-release, both code callers; `command_neighborhood` from `scripts/refresh-framework-names.cjs`, a code caller) plus 6 tools with no repo caller. Every ambiguous row holds only sprouts (1 to 3 words). So 0 rows carry an edge or body string: census_split_route_callers 0 (no model call needs the split route today; it exists for a model-composed call) and census_codepath_body_callers 0 (no code path would be refused).

Rows with an edge or body string and an allow verdict (info, PROVEN): 10 of 54 rows, all code callers, all tool `brain_query`, key `cypher`: `enrichCausalEdges` (4 templates, 28 or 47 words), `suggestValidationSteps` (4 templates, 19 or 36 words) and `hatAwareRecommend` (2 templates, 70 words). They are repo-built Cypher templates, the guard allows them (generic_question), and option-e does not touch an allow verdict. They carry no room text. Constraint for plan 386-33: a new body class must not apply to the `cypher` key of `brain_query`, or these 10 code paths would be refused with no model to split them.

The 2 repo-owned paths are: `normalize_framework_name` with a non-canonical raw term (the call exists to map a non-canonical term to the canonical one), and `command_neighborhood` with `/mos:act` (the framework-name refresh, `scripts/refresh-framework-names.cjs`). Both carry only sprouts (1 and 2 words). The 6 unwired tools add 6 ambiguous sprouts that no repo code sends.

Observation for plan 386-27 (PROVEN): the Cypher templates built by `enrichCausalEdges`, `suggestValidationSteps` and `hatAwareRecommend` are 19 to 70 words and `classifyShape` calls them body, but the guard verdict is allow. A shape test in plan 386-27 must read only the strings of a payload whose verdict is `ambiguous`. It must not read an assembled Cypher template, or it would block the repo's own allowed reads.

### Disposition matrix (hook child process, `PART8_FORCE_BRAIN_AVAILABLE` 1 and 0; callTool in process)

All 3 payloads below classify ambiguous (an ambiguous typed read with only sprouts).

| Route prefix | normalize_framework_name {raw: 2 words} | command_neighborhood {command} | find_bottlenecks {framework} |
|---|---|---|---|
| own shim, plugin scope `mcp__plugin_mos_mindrian-brain__` | exit 0 / exit 0 | exit 0 / exit 0 | exit 0 / exit 0 |
| own shim, project scope `mcp__mindrian-brain__` | exit 0 / exit 0 | exit 0 / exit 0 | exit 0 / exit 0 |
| direct connector `mcp__pws-brain-mcp__` | exit 2 (Shape F.1 card) / exit 0 | exit 2 / exit 0 | exit 2 / exit 0 |
| raw theo name `mcp__theo__` | exit 0 / exit 0 (not inspected) | exit 0 / exit 0 | exit 0 / exit 0 |
| callTool in process (every route that reaches the shim) | sends, fetch 2, disclosure `proceeded` | sends, fetch 1, disclosure `proceeded` | sends, fetch 1, disclosure `proceeded` |

Each cell reads "Brain available (force 1) / Brain not available (force 0)".

Known gaps in prose:

- The direct connector route has no second enforcement point. The hook is its only guard. With Brain "not available" the hook allows, because no wire is assumed.
- Raw `mcp__theo__` typed names without the `brain_` prefix are not Brain-shaped to the hook, so the hook never classifies them (PROVEN: `isBrainShapedTool('mcp__theo__normalize_framework_name')` is false, `isBrainShapedTool('mcp__theo__brain_ask')` is true). The matrix row for raw theo names uses the typed names, so it shows exit 0 for that reason.
- Brain-less (force 0) allows an ambiguous call on the direct connector. That is the D-08a ruling and is out of this plan.

Named tests that must keep passing for any change (all PASS at 7f078287a, run in this session):

- Whitespace baseline: tests/test-auto-explore-fire.cjs, tests/test_interpret_whitespace.cjs, tests/test-366-recall-whitespace.cjs, tests/test-355-producer-whitespace-hsi.cjs
- Framework chains: tests/test-254-one-chain-source.cjs, tests/test-254-projection-chain-source.cjs, tests/test-264-sensor-to-chain-resolve.cjs
- Framework-name refresh: tests/test-355-framework-names.cjs, tests/test-254-normalize-roundtrip-probe.cjs, tests/test-247-contract-client.cjs

### What each option does to the 2 repo-owned paths (derived from the census; the options are not implemented)

- Option A (block only an edge or body string): both repo-owned paths are sprouts, so both proceed with the disclosure. 0 repo-owned paths stop. A hypothetical ambiguous call that carries a body or edge string stops.
- Option B: nothing changes.
- Option C (block every ambiguous call): `normalize_framework_name` with a non-canonical raw term stops, so the chain-recommender can no longer map a non-canonical name (that is the call's only purpose), and `command_neighborhood` stops, so `scripts/refresh-framework-names.cjs` loses its one read (the release lockstep needs that refresh). Every typed read with a handle newer than the local snapshot also stops.
- Option D: option A plus the hook inspects raw `mcp__theo__` typed names (a hook matcher change in hooks/hooks.json and `isBrainShapedTool`).

## Technical Root Cause

- Site 1: scripts/part8-egress-guard-hook.cjs, function `main`, branch `verdict === 'ambiguous'`: `shimBacked && SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES.has(klass)` returns `allow()`. The direct connector and untrusted keys reach `brainAvailable()` and block.
- Site 2: lib/core/brain-client.cjs, function `callTool`: `ambiguousDisclosure` is set for `verdict === 'ambiguous'` and the call goes on to `_ensureSession` and the wire.
- Site 3: scripts/part8-egress-guard-hook.cjs matcher in hooks/hooks.json plus `isBrainShapedTool` in lib/core/brain-response-sanitize.cjs: raw `mcp__theo__` typed names are outside the matcher.
- Cause: `ambiguous` was defined as "the guard has no proof either way". Phase 254 chose to disclose and proceed on the own shim because a PreToolUse hook cannot render the card and because the typed read tools had no allow rows, so almost every legitimate methodology call was ambiguous. Plan 386-25 added the allow rows for the typed tools, so the reason for the broad proceed is mostly gone: 2 repo-owned paths remain, both sprouts. What is left is a policy gap: an ambiguous string of body or edge shape can still leave on the own shim, and the 3 routes disagree.
- Why it matters now: the owner principle of 2026-11-06 says sprouts go out and bodies stay. The right test for "ambiguous" is the shape of its strings, which plan 386-37 now provides. A block on every ambiguous call is the wrong tool, because the 2 repo-owned ambiguous paths are sprouts the principle protects.

## Required Code Changes

<!-- Only after the owner decision. None in this plan. -->

- Change 1 (option A, plan 386-27), described in prose only:
  - callTool: on an ambiguous verdict, read the strings of the payload with `classifyShape`. If any string is edge or body, return `{ error: 'egress_blocked', tool, egress_class: 'ambiguous_blocked' }` with 0 network calls. If all strings are sprouts or there are none, keep today's disclose and proceed.
  - Hook: for the 2 shim-backed scopes, exit 2 with a plain message for an ambiguous payload that holds an edge or body string; keep exit 0 for all-sprout payloads.
  - Apply the shape test only to an ambiguous verdict, never to an assembled Cypher template (see the observation above).
  - Keep plan 386-04 (every brain_write blocked).
- Change 2 (option B): none. Record the divergence from the Phase 254 text. Plan 386-27 is skipped.
- Change 3 (option C): block every ambiguous call. Needs a plan revision; breaks the 2 repo paths above.
- Change 4 (option D): Change 1 plus a hook matcher change for raw theo typed names. Needs a plan revision.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: a new tests/test-386-ambiguous-shape-block.cjs (plan 386-27)
  - Given: an ambiguous typed payload with an edge string, with a body string, with only sprouts, and with only numbers
  - When: callTool runs with a fetch counter, and the hook child process runs on both shim-backed scopes
  - Then (option A): edge and body payloads return `egress_blocked` and the hook exits 2 with 0 fetch calls; sprout and number payloads still proceed with the disclosure
- Test 2: tests/test-254-ambiguous-disclosure.cjs and tests/test-260917-dgf-part8-hook-disposition.cjs keep passing for sprout payloads, and flip only the arm that sends an edge or body payload.
- Test 3: the 10 named tests above keep passing.

## Non-Code Follow-ups

- CHANGELOG.md: plan 386-21 owns it.
- Release lockstep: applies only if a fix ships.
- Canon: Part 8. Fixture and synthetic strings only. No room content in this file.
- Tri-Polar: Desktop has no PreToolUse hook, so on Desktop only the callTool belt applies. Cowork follows the CLI hook path.
- Phase 254 ruling: option A changes it for the own shim only for edge and body strings. A navigator note is needed if the owner picks A.
- Fixture note: scratch files lived under the session scratchpad. No repo product file was edited.

## Owner decision

decision: option-e
date: 2026-11-06

Owner's words, verbatim, spelling as typed: "block ? i dont think a block will wor it need to be context based, like the file-a meeting style where it braeks it up to claims, facts hypthtesesys ect ..."

carrier_note: The sprouts travel as ordinary typed read calls (brain_ask and brain_search), not as a job of data/brain-packet-schema.json, which deviates from the PRD wording typed packet because no packet job carries a free sprout without a room-derived string.

The carrier_note is a deviation the owner sees on the plan 386-32 checkpoint.

Reading (the main session's reading, to be checked by the owner), in 5 short lines:

1. A bare block does not work for contextualised work.
2. A long text or an ambiguous-shape call is answered with the typed outcome sprouts_required, which carries a plain split guide and names the sprout route. It is never silent, never sends, and never echoes the text.
3. The host model breaks the text into typed claims like the meeting filing, keeps the room claims local as proposed claims, sends only generic sprouts, and assembles the answer locally.
4. Credentials, emails, phone-like and ID-like strings and room-lexicon terms never leave.
5. A call whose strings are all sprouts proceeds as today, and brain_write of room text stays blocked.

Gate checks made before this block was written: census_codepath_body_callers is 0 (census lines above), and the plan 386-42 RCA says design_can_work: yes. Plan 386-27 implements option-e only. Options a, b, c and d of the earlier draft are not chosen.

## Resolution

root_cause: the disposition of `ambiguous` differs by route (send on the own shim, block on the direct connector, not inspected on raw theo names) and the own shim sends it without a shape test. After plan 386-25 only 2 repo-owned paths are still ambiguous and both are sprouts.
fix: plan 386-27 (option-e). callTool, query(), ask() and search() return the typed sentinel of lib/core/part8-split-route.cjs (error egress_blocked, class and outcome sprouts_required, route, 5 line split guide, 0 fetch, no payload byte) for the guard class sprouts_required and for an ambiguous call whose payload carries an edge or body string by shape (new helper carriesEdgeOrBody, any depth, the cypher key of brain_query not read). The hook exits 2 with the same constant message for the class (every scope) and for the same ambiguous call on a shim-backed scope with Brain available. A sprout-only ambiguous call still proceeds with the egress_disclosure. Other block classes keep their own message with no guide. Direct connector still blocks, Brain-less hook path still allows, empty payload still allows.
verification: tests/test-386-sprouts-required-outcome.cjs arms SP1 to SP8 (RED at 10536cca0, GREEN at 5992a1f65). Corpus gate before and after with no stamp: MEASURED_SHA256 685f11b8... unchanged. run-all-196, run-all-245, run-all-386 pass; the named whitespace, chain and framework-name tests pass; the 4 egress suites named by the plan (254 ambiguous disclosure, 260917 dgf, 245 contentless, 260906 fda) pass with no assertion flipped, because their ambiguous fixtures hold only sprouts. The host honouring the hook exit on the direct connector end to end is UNVERIFIED.
files_changed: lib/core/brain-client.cjs, lib/core/part8-split-route.cjs, scripts/part8-egress-guard-hook.cjs, tests/test-386-sprouts-required-outcome.cjs
commits: 10536cca0 (RED), 5992a1f65 (GREEN)
disposition: sprouts_required
