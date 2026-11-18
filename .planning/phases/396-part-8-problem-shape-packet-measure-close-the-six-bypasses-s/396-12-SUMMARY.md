---
phase: 396-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 12
subsystem: brain-client, brain shim, brain-router
tags: [part8, shape-packet, wire, capability-probe, recommend_chain, one-type-rule, shim, brainRoute, census, wave7, p4]
requires: ["392-08", "392-09", "392-10", "392-11", "Theo Phase 48 (live sha 3e6946be)"]
provides:
  - "lib/core/brain-client.cjs: brainAcceptsShape(toolName) capability probe (tools/list once per process, cached, re-probed after a transport error; MINDRIAN_BRAIN_SHAPE=0 forces off, =1 forces on); ask() attaches the room-built or caller-built shape so the wire is exactly {question, shape} when the Brain advertises the field and exactly {question} otherwise; an invalid opts.shape is refused with {error: shape_invalid, tool, field} and nothing is sent; op mode never shaped"
  - "lib/core/brain-client.cjs: _composeTheoAsk one-type rule: when the shape rode on the wire the shape's problem_type is the one type (signal / signal), recommend_chain receives {problem_type: shape.problem_type, max_steps, shape}, a disagreeing router rung is recorded as grounding.evidence.rung_conflict {router, shape} and never sent; grounding.shape_source (room | none) and grounding.lexicon_scope stated on the envelope"
  - "lib/core/brain-client.cjs: recommendChain(problemType, maxSteps, opts) sends the shape with its own type when it validates and recommend_chain advertises the field; today's {problem_type, max_steps} otherwise"
  - "scripts/mindrian-brain-mcp-client.cjs: brain_ask inputSchema z.strictObject({question, shape?: z.strictObject(enums, constraint_categories max 5)}); the handler ignores the supplied shape and builds the room shape only when CLAUDE_CODE_SESSION_ID is present and that session owns a bound room (option a); bare call with lexicon_scope machine_global otherwise; grounding.model_shape_ignored true when a shape was supplied"
  - "lib/mcp/brain-router.cjs: brainRoute builds the room shape through the one builder and passes {problem_type: rung, shape}; brainRoute exported"
  - "lib/mcp/brain-composition-census.cjs: the brain-router entry's via names the shape, the probe and the one-type rule"
  - "tests/test-396-wire-shape.cjs (W0 to W16, 18 checks) and the capture server's scripted tools/list and name-keyed replies"
affects: [392-13, 392-15, 392-16, Theo Phase 48]
tech-stack:
  added: []
  patterns:
    - "Capability probe over the server's own tools/list (one request per process through the existing session and fetch chokepoint), with an operator override, so a strict remote schema turns a new optional field on by itself and never breaks an older server"
    - "The shape reaches the composer only when it rode on the wire: a label (signal) is never claimed for a shape the Brain did not see"
    - "One type per call: the shape's type is the wire type; a disagreeing local classification becomes evidence, never a second argument"
    - "Envelope facts added conditionally (only when the wire path provides them) so an offline composer seam keeps its pinned key set"
key-files:
  created:
    - tests/test-396-wire-shape.cjs
  modified:
    - lib/core/brain-client.cjs
    - scripts/mindrian-brain-mcp-client.cjs
    - lib/mcp/brain-router.cjs
    - lib/mcp/brain-composition-census.cjs
    - tests/helpers/brain-capture-server.cjs
    - .planning/phases/396-part-8-problem-shape-packet-measure-close-the-six-bypasses-s/deferred-items.md
decisions:
  - "The shape reaches _composeTheoAsk only when it rode on the wire (opts.shapeOnWire). Under schema A the envelope says structured or heuristic as before, even when a room shape exists, because the Brain never saw it."
  - "On a shaped recommend_chain the problem_type sent is shape.problem_type verbatim (the vocabulary is Theo's), not the origin-keyed alias table's projection; the bare call keeps the alias table."
  - "A transport error on tools/list is not cached (false for this call only) and a transport null on brain_ask clears the probe cache; a positive or negative advertised answer is cached per process."
  - "brainRoute builds the shape in the mindrian-os server process from the roomDir it already resolved (plan Task 2 behaviour); the shim builds it only with a session id (option a). Both use the one builder; the model never does."
  - "The shim does not print a second MINDRIAN_PART8_DEBUG line: brain-client's resolver already prints the presence-and-scope line inside the shim process (W16 reads it from the shim's stderr)."
  - "Pre-existing pins outside this plan (c8j Leg 7, test-339 Arm 3a, both the 392-11 lexicon_scope key on the sentinel) are logged in deferred-items.md, not changed."
metrics:
  duration: "about 29 min (2026-11-09 21:23Z first read to 21:52Z self-check)"
  tasks: 2
  files: 6
  completed: 2026-11-09
---

# Phase 392 Plan 12: The wire, the shim and the router (P4 second half) Summary

brain-client.ask now sends exactly `{question, shape}` to the Brain when the Brain's own tools/list advertises the `shape` field (Theo Phase 48, live) and exactly `{question}` when it does not; the shape is the closed-vocabulary packet built by the one builder from the room that owns this session (or a packet a caller built with the same builder), never from the model. recommend_chain carries one problem type equal to the shape's, a disagreeing router rung is recorded as `rung_conflict` evidence and never sent, the shim accepts an optional strict enum-only `shape` that it ignores in favour of the room-built one and builds a shape only when it has a session id that owns a bound room, and brainRoute passes the full shape. Replay and Part 8 suites unchanged and green.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | failing wire test; scripted tools/list and name-keyed replies on the capture server | 0146b1e3c | tests/test-396-wire-shape.cjs, tests/helpers/brain-capture-server.cjs |
| 1 GREEN | ask attaches the shape behind the probe; recommend_chain one type; envelope facts | a96692214 | lib/core/brain-client.cjs |
| 2 GREEN | shim schema and session-gated builder; brainRoute shape and export; census via | 31565f0a1 | scripts/mindrian-brain-mcp-client.cjs, lib/mcp/brain-router.cjs, lib/mcp/brain-composition-census.cjs |

STATE.md, ROADMAP.md, REQUIREMENTS.md and 396-WAVES.md were not edited (the orchestrator owns them on this branch; the foreign uncommitted ROADMAP.md and STATE.md edits, the untracked debug file and the untracked 393 directory were never staged or reverted). No `gsd-tools state.*` write was run for the same reason.

## RED failure lines

`node tests/test-396-wire-shape.cjs` on the tree at 471ba202e (exit 1, 6 passed, 12 failed; W8, W9, W13, W16, W9b, W0 passed):

```
FAIL - W1 ... body keys: {"question":"what is jobs to be done"}   (expected ['question','shape'])
FAIL - W2 ... chain body keys: {"problem_type":"IllDefined","max_steps":4}   (expected shape and the shape's type)
FAIL - W3 ... shape_source: + undefined - 'none'
FAIL - W4 brainAcceptsShape exported: + 'undefined' - 'function'
FAIL - W5 forced on: [{"name":"brain_ask","arguments":{"question":"what is jobs to be done"}}, ...]   (no shape under MINDRIAN_BRAIN_SHAPE=1)
FAIL - W6 typed sentinel expected: {"answer_mode":"structured_rows", ... "problem_type_source":"heuristic" ...}   (the invalid shape was ignored and the call went to the wire)
FAIL - W7 ... + ['question'] - ['question','shape']
FAIL - W15 brainRoute exported for the wire test: + 'undefined' - 'function'
FAIL - W10 shim body: {"question":"what is jobs to be done"}
FAIL - W11 tool call ok: Input validation error: Invalid arguments for tool brain_ask: Unrecognized key: "shape"
FAIL - W12 the error names an enum member: ... Unrecognized key: "shape"   (refused for the wrong reason)
FAIL - W14 envelope grounding: {... "directive":{"guided":{"questions":[],"framework":null,"stage":null}} ...}   (no lexicon_scope on the envelope; the shim's pre-warm had consumed the ordered script, which is why the helper gained name-keyed replies before the RED commit)
```

After the Task 1 commit: 14 passed, 4 failed (W11, W12, W14, W15: the Task 2 arms). After the Task 2 commit: 18 passed, 0 failed.

## The probe design (lib/core/brain-client.cjs)

- `brainAcceptsShape(toolName)`: `MINDRIAN_BRAIN_SHAPE=0` returns false, `=1` returns true, both without a request. Otherwise one `tools/list` per process (`_listTools`, through `_ensureSession` and the same `fetch` chokepoint `callTool` uses; never a second transport), cached as the tools array; the answer per tool is `inputSchema.properties.shape` present (also inside `anyOf` or `oneOf` branches), cached in a Map. A non-OK status or an unparseable body returns false for that call and is NOT cached; a transport null on brain_ask calls `_resetShapeProbe()`.
- `_shapeForWire(callerShape)`: the resolved room (plan 392-11 typed result) gives `lexicon_scope`; override 0 returns no shape; the candidate is the validated caller shape, else `buildShapePacket({roomDir})` when `status === 'bound'` and `lexicon_scope === 'session'` (no shape without a session id); the candidate rides only when `brainAcceptsShape('brain_ask')` is true. Result `{shape, shape_source: 'room' | 'none', lexicon_scope}`.
- `ask()`: an invalid `opts.shape` is refused first with `{error: 'shape_invalid', tool: 'brain_ask', field, reason}` (the field name only, never a value; W6 asserts the bad value is absent), then the 354-06 typed gate, then the wire. The composer receives `shape` only when it rode (`shapeOnWire`), plus `shapeSource` and `lexiconScope`.
- `_composeTheoAsk`: `shapeOnWire` -> `rung = shape.problem_type`, `rung_source 'signal'`, `problem_type_source 'signal'`, `rung_conflict {router, shape}` when `opts.rung` is a THEO_RUNG_SET member that differs; `recommend(rung, 4, {shape})`. Otherwise the 392-10 logic byte for byte. `grounding.evidence` is Theo's evidence block plus `rung_conflict` when present (the catch path carries `{rung_conflict}` alone). `shape_source` and `lexicon_scope` are stamped only when ask() provided them, so tests/test-396-compose-envelope.cjs Arm 8 (exact key set) stays green.
- `recommendChain(problemType, maxSteps, opts)`: with a validating `opts.shape`, override not 0 and `brainAcceptsShape('recommend_chain')` true: `{problem_type: shape.problem_type, max_steps, shape}`; otherwise today's `{problem_type: normalized, max_steps}`.

## Captured bodies under schema B (keys and enum values only, test fixtures)

brain_ask (W1, W10, W15):

```
{ question: <generic question>,
  shape: { schema_version: 1, problem_type: WellDefined, stage: Phase3, role: investor,
           domain_tag: finance, constraint_categories: [regulatory, capital] } }
```

recommend_chain (W2, W15):

```
{ problem_type: WellDefined, max_steps: 4,
  shape: { schema_version: 1, problem_type: WellDefined, stage: Phase3, role: investor,
           domain_tag: finance, constraint_categories: [regulatory, capital] } }
```

Sorted keys asserted: brain_ask `[question, shape]`; recommend_chain `[max_steps, problem_type, shape]`. With the caller rung `IllDefined` (W2) and with the STATE.md classification `ill-defined` in brainRoute (W15) the wire still carries `WellDefined` and the envelope says `grounding.evidence.rung_conflict = {router: IllDefined, shape: WellDefined}` beside Theo's `linked_frameworks_for_type`; with `WellDefined` on both sides `rung_conflict` is absent. Caller-built shape (W7): the wire carries the caller's packet (`problem_type Wicked`) and recommend_chain `problem_type Wicked`.

## Probe behaviour (PROVEN by the test)

| Case | tools/list | brain_ask body | recommend_chain body | envelope |
|------|-----------|----------------|----------------------|----------|
| schema A, session bound, caller rung | 1 request, cached false | `[question]` | `[max_steps, problem_type]`, the router rung | `problem_type_source signal`, `rung_source structured`, `shape_source none`, `lexicon_scope session` |
| schema A, session bound, no rung | cached | `[question]` | the inferred rung | `heuristic`, `inferred`, `shape_source none` |
| schema B, session bound | 1 request for two asks (W4) | `[question, shape]` | `[max_steps, problem_type, shape]` | `signal`, `signal`, `shape_source room`, `lexicon_scope session`, `grounding_order shape_boosted` |
| no list (404) then schema B | the failed list is not cached; the next ask re-probes and the shape rides (W4) | bare, then shaped | | |
| `MINDRIAN_BRAIN_SHAPE=0`, schema B | no request | `[question]` | `[max_steps, problem_type]` | |
| `MINDRIAN_BRAIN_SHAPE=1`, schema A | 0 requests (W5) | `[question, shape]` | `[max_steps, problem_type, shape]` | `shape_source room` |
| unbound session, schema B | | `[question]` (W9b) | | |
| op mode, schema B | | `[op, params]` (W8) | | |

## Shim behaviour (PROVEN through StdioClientTransport against scripts/mindrian-brain-mcp-client.cjs)

| Child env | Call | Wire | Envelope |
|-----------|------|------|----------|
| `CLAUDE_CODE_SESSION_ID` S1 (bound to room A) | `{question}` | `{question, shape}` with the room-built packet | `shape_source room`, `lexicon_scope session`, `problem_type_source signal` (W10) |
| S1 | `{question, shape: <valid Wicked packet>}` | the room-built packet, not the model's; recommend_chain `WellDefined` | `shape_source room`, `model_shape_ignored true` (W11) |
| S1 | `{question, shape: {problem_type: "wicked", ...}}` | nothing sent | zod refusal names `problem_type` and the members UnDefined, IllDefined, WellDefined, Wicked (W12) |
| S1 | `{question, context: "x"}` | nothing sent | strictObject refusal as today (W13) |
| no session id | `{question}` | bare `{question}` | `lexicon_scope machine_global`, `shape_source none`; room A's word blocked (egress_blocked, nothing sent), room B's word allowed (reached the wire); a model-supplied valid shape still yields a bare body with `model_shape_ignored true`; stderr `part8 session: absent; lexicon_scope: machine_global` (W14) |
| S1, `MINDRIAN_PART8_DEBUG=1` | | | stderr `part8 session: present; lexicon_scope: session`, the id never printed (W16) |

The shim's start-up pre-warm (`theo_health` through callTool) is visible on the capture server; it is content-free and is why the helper's replies are keyed by tool name.

## Census

- `lib/mcp/brain-composition-census.cjs`: the brain-router entry's `via` now reads "brainClient.ask(question, {problem_type, shape}) ... the closed-vocabulary shape packet built from the room by lib/core/brain-shape-packet.cjs (enum members only, never room text); the shape rides only when the Brain advertises the field (brainAcceptsShape), and one problem type per call ...". No entry added: the router's new lazy `require('../core/brain-shape-packet.cjs')` is not a REACH_RE match (brain-client | chain-recommender), and the shim lives under scripts/, outside the scan. `node tests/test-254-composition-census.cjs`: 10 passed, 0 failed (every reach site declared; the build does not fail on an undeclared one).
- `data/brain-census.generated.json`: `node scripts/build-brain-census.cjs --render-only` (zero network) re-rendered both artifacts byte-identical (`git status` clean for data/ and docs/). The file is the Brain graph census, not the composition census; nothing to regenerate for this change (deferred-items.md row).

## Live probe reading against theo-mcp.onrender.com (PROVEN, read only)

- `tools/list` (one request, no question sent): 48 tools; `brain_ask.inputSchema.properties` keys `[question, op, params, topK, shape]`, `recommend_chain.inputSchema.properties` keys `[problem_type, max_steps, nest, shape]`; both `shape` schemas: `schema_version const 1`, `problem_type enum [UnDefined, IllDefined, WellDefined, Wicked]`, `stage enum Phase0..Phase5`, the 7 roles, the 11 domain tags, `constraint_categories maxItems 5` of the 9 categories; `additionalProperties false`; no `anyOf`.
- Through the shipped code, default origin: `brainAcceptsShape('brain_ask') === true`, `brainAcceptsShape('recommend_chain') === true`, 1,166 ms for the one list. So on this machine the shaped wire is ON against the current Theo by the probe alone (the plan's verification text expected "pending"; Theo Phase 48 deployed on 2026-11-08, before this plan ran).
- Not run: a live shaped `brain_ask` or `recommend_chain` (plan 392-13, the acceptance leg). The live effect of a shaped call is therefore UNVERIFIED here; the contract is proven offline against schema B and the advertised live schema equals the vocabulary file (392-02 drift test V7).

## The session-id reading from 392-11

PROVEN on this machine (plan 392-11, /proc/<pid>/environ of five live shim processes): Claude Code exports `CLAUDE_CODE_SESSION_ID` to its MCP children, so the shim under Claude Code CLI is session-scoped and builds the shape (option a, W10 and W16). Desktop and Cowork export no id: the shim sends a bare call, the lexicon check runs against the machine-global active room and the envelope and the telemetry say `lexicon_scope machine_global` (W14). The mindrian-os server's own tools never build the shape in this phase; brainRoute (the act* Tier 3 leg inside that server) builds it from the room it already resolved, as the plan's Task 2 directs.

## Verification (final tree 31565f0a1, PROVEN unless marked)

- `node tests/test-396-wire-shape.cjs`: 18 passed, 0 failed.
- `bash tests/run-all-396.sh`: discovered 17, PASS=17 FAIL=0 SKIP=0.
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0; LZ5 guard 172 to 11, hook 175 to 14, statusline 182 to 18 (unchanged from 392-11: the hook graph is flat; brain-shape-packet stays a lazy require in brain-client and brain-router).
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed.
- `node tests/test-387-eureka-egress.cjs`: 22 passed, 0 failed.
- `node tests/test-254-composition-census.cjs`: 10 passed, 0 failed.
- `node tests/test-339-theo-ask-compose.cjs`: 11 passed, 1 failed (Arm 3a, pre-existing, see Deviations); `node tests/test-396-compose-envelope.cjs`: 8 passed, 0 failed.
- `bash tests/run-all-339.sh`: PASS=14 FAIL=2; the two FAILs are the pre-existing dist bundle staleness (392-10 deferred item) and test-339-theo-ask-compose Arm 3a (pre-existing, below); the live e2e arm ran against theo-mcp and PASSED.
- `node tests/test-c8j-brain-wire.cjs`: 10 passed, 1 failed (Leg 7, pre-existing, below). `node tests/test-239-query-egress-canary.cjs`: PASS (0 failures). `node tests/test-247-contract-client.cjs`: 4 passed. `node tests/test-brain-client-params.cjs`: PASS. (The four capture-server consumers after the helper change.)
- `node tests/test-354-theo-router-contract.cjs`: 36 passed, 0 failed. `node tests/test-354-egress-typed-question.cjs`: 50 passed, 0 failed.
- `bash scripts/verify-release`: 36 passed, 0 failed, 2 warnings (38 checks); gate 19 (shim tool names) PASS.
- tests/test-389-seed-egress.cjs: ABSENT on this branch (rebase onto the release session's commits pending, D-07); not run.
- `node scripts/doctor.cjs --acceptance`: NOT RUN (UNVERIFIED; its version point runs `npm view`; 392-06 recorded 24 of 25 with the one FAIL being the foreign uncommitted ROADMAP.md and STATE.md edits, still present and untouched).
- Dash scan (em dash, en dash) on the six code, test and helper files: 0 each. Part 8 scan: W9 and W9b assert no lexicon word of either synthetic room and no room file line in any captured byte across every leg; no room slug, person, URL or Brain identifier in any committed file (fixture rooms and values invented; the live reading records schema keys only).
- Post-commit deletion check on 0146b1e3c, a96692214, 31565f0a1: no deletions. `git status --short` after the last commit: only the foreign ` M .planning/ROADMAP.md`, ` M .planning/STATE.md`, the untracked `.planning/debug/379-1-1-10-large-room-drain-clock-breach.md` and `.planning/phases/393-*` (never staged, never reverted).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, Part 7] tests/helpers/brain-capture-server.cjs extended (outside files_modified)**
- **Found during:** Task 1 RED design
- **Issue:** the plan's behaviour needs "a capture server with two scripted tools/list replies"; the shared helper answered tools/list with 404 and had no name-keyed reply (the shim's start-up pre-warm consumed the first ordered reply, so the shim arms read the wrong body).
- **Fix:** additive exports `setToolList`, `getToolListCount`, `resetToolList`, `setToolReplies`; defaults byte-identical to today (null list = 404, no name map); the four existing consumers re-run green. A second server would have violated Part 7.
- **Commit:** 0146b1e3c

**2. [Rule 1 - Plan wording] The census command and the generated file**
- The plan's `node scripts/build-brain-census.cjs --check` does not exist (392-10 deferred item); the gate run is `node tests/test-254-composition-census.cjs` (10 of 10). `data/brain-census.generated.json` is the graph census; `--render-only` left it byte-identical, so it is not in any commit of this plan. Row added to deferred-items.md.

**3. [Reading] "Under schema A the envelope says heuristic or structured as before"**
- 392-10 threaded any `opts.shape` to the composer for the signal label. To keep the schema A promise honest, ask() now passes the shape to the composer only when it rode on the wire; a shape the Brain did not see never earns `signal`. The 392-10 composer seam (tests/test-396-compose-envelope.cjs Arm 4) is unchanged because it drives the composer directly.

**4. [Reading] The shim's MINDRIAN_PART8_DEBUG line**
- brain-client's resolver already prints "part8 session: present|absent; lexicon_scope: ..." inside the shim process (plan 392-11); a second line in the shim would duplicate it. W14 and W16 read the line from the shim's stderr.

**5. [Scope] brainRoute exported**
- The plan's test drives brainRoute against the capture server; the function was module-private. Exported as a named export beside recommend (lib/mcp/brain-router.cjs is in files_modified).

### Not changed, by rule (logged in deferred-items.md)

- tests/test-c8j-brain-wire.cjs Leg 7 and tests/test-339-theo-ask-compose.cjs Arm 3a fail on the egress_blocked sentinel's `lexicon_scope` key (plan 392-11). PROVEN pre-existing: with the brain-client of the branch base 471ba202e checked out for the run, both fail the same way. Neither file is in this plan's files_modified and the plan does not name them, so they were left alone.

## Known Stubs

None. The shape is wired end to end: built from the bound room (brain-client with a session, the shim with a session, brainRoute from its room), validated three times (zod enums in the shim, validateShapePacket in brain-client, the 392-09 guard arm on the belt), attached behind the probe, and carried on both tools with one type.

## Threat Flags

None new. T-392-34 mitigated (W11, W14: the model-supplied shape never reaches the wire; the room-built one or none does). T-392-35 mitigated (three independent membership checks; W6, W12). T-392-36 mitigated (probe plus override; op mode unshaped, W8; one type per recommend_chain, W2 and W15, so Theo's conflict refusal cannot fire). T-392-37 mitigated (census declaration updated, test-254 green; the generated file untouched by hand or script). One new local read, not a new surface: `tools/list` is read once per process from the Brain already being called, through the same session and chokepoint; a hostile reply can only add the closed shape (enum members from the room) or keep the bare wire, never free text.

## TDD Gate Compliance

RED 0146b1e3c (test) precedes GREEN a96692214 (feat, Task 1) and 31565f0a1 (feat, Task 2). No refactor commit.

## Next Phase Readiness

- 392-13 (acceptance leg, bare vs shaped): `MINDRIAN_BRAIN_SHAPE=1` forces the shaped wire for the run; the live probe already answers true on this machine. Assert `grounding.problem_type_source`, `grounding.shape_source`, `grounding.lexicon_scope`, `grounding.evidence.rung_conflict`, `grounding.grounding_order`, `grounding.chain_coverage` from this envelope. Record keys only.
- After the rebase (D-07): run tests/test-389-seed-egress.cjs; the Seed's brain_search form is untouched by this plan (search() is not shaped).
- The two pre-existing pins (c8j Leg 7, test-339 Arm 3a) need a one-line re-pin each (`lexicon_scope` on the sentinel) in a quick task.

## Self-Check: PASSED

Files exist: lib/core/brain-client.cjs, scripts/mindrian-brain-mcp-client.cjs, lib/mcp/brain-router.cjs, lib/mcp/brain-composition-census.cjs, tests/test-396-wire-shape.cjs, tests/helpers/brain-capture-server.cjs. Commits 0146b1e3c, a96692214, 31565f0a1 exist on work/part8-shape-packet. This SUMMARY is under `.planning/*` (force-tracked), added with `git add -f`.
