---
status: resolved            # gathering | investigating | fixing | resolved
kind: rca                    # rca | debug-session | qa-sweep
trigger: "part8-egress-guard-blocks-pws-brain-mcp-unconditionally"
issue_id: ""
severity: high                # this blocks ALL pws-brain-mcp reads, not an edge case
surfaces: [cli]                # observed on cli; desktop/cowork not tested
brain_mode: full-loop          # not actually the Brain's own refusal mode -- blocked before reaching it
canon_parts: [8]                # Part 8, Graph Boundary -- the guard this hook is supposed to enforce
created: 2026-08-27T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: `part8-egress-guard-hook.cjs` (a PreToolUse hook) is blocking every
  `pws-brain-mcp` tool call in this session/room unconditionally, independent of
  the actual argument content -- i.e. it is firing as a session-level or
  room-level block rather than doing real content inspection per call.
test: not yet run -- seeded as a todo, not investigated this session.
expecting: if true, reading the hook's own source will show either (a) a
  condition that is trivially always-true for this session/room (a stale flag,
  a misread room-binding state, a config value defaulting to "block" rather
  than "evaluate"), or (b) the content-inspection logic itself is broken and
  always classifies input as "may leak unknown" regardless of what it actually
  contains.
next_action: open via `/gsd:debug` in MindrianOS-Plugin. Read
  `part8-egress-guard-hook.cjs` directly, reproduce with the exact three calls
  below in a fresh session bound to the same room, and determine whether the
  block is genuinely unconditional or narrowly scoped to something these three
  calls all happen to share (e.g. all three touch `operate_framework`/
  `normalize_framework_name` specifically -- check whether OTHER `pws-brain-mcp`
  tools in the same session are also blocked, or only these).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (the hook lives here; the block was
  OBSERVED from a session bound to the `noga-mventures` room, a real venture
  room, not a fresh/unbound session)
- Reported by: a peer Claude Code session (`jsagi-0f`), relayed via
  cross-session message at the request of Jonathan Sagir, who was live-testing
  Theo's newly user-scoped MCP server against `pws-brain-mcp` side by side
- Date first observed: 2026-08-27
- Room: `noga-mventures` (`~/MindrianRooms/noga-mventures`), an existing,
  previously-active venture room (last real content update 2026-08-26), not a
  fresh or ambiguous room
- Related: this was found as a side effect of a deliberate Theo/Brain
  comparison test, not a dedicated audit -- the actual bug is orthogonal to
  what was being tested for

## Problem Statement

`part8-egress-guard-hook.cjs`, a `PreToolUse` hook, blocked every one of three
`pws-brain-mcp` tool calls made in one session, each with the identical
"this may leak unknown" F.1 card (Reformulate / Cancel / Free-Text), even
though the calls used two different framework-name argument strings and one
was a different tool entirely. The block fired before any of the calls
executed, so `pws-brain-mcp` returned zero actual data across the whole test.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `part8-egress-guard-hook.cjs` inspects each tool call's actual
  argument content and blocks only calls that genuinely risk carrying
  user-specific/room-specific bytes across the Brain boundary (Canon Part 8).
  A generic framework-name lookup like `normalize_framework_name("Six Thinking
  Hats")` -- a well-known public methodology name, not room content -- should
  not trip a leak guard.

actual: all three calls were blocked with the identical card:
  1. `normalize_framework_name("Six Thinking Hats")` -- blocked.
  2. `operate_framework("Six Thinking Hats", step 1)` -- blocked.
  3. `operate_framework("Bono", step 1)` -- blocked (different argument string
     than call 2, same block).
  Reformulating the query text between attempts did not change the outcome --
  the reporting session explicitly noted this and read it as evidence of a
  session-level block rather than a content-sensitivity flag.

errors: no exception/crash. The hook fired its own designed refusal card
  (F.1, Reformulate/Cancel/Free-Text) each time -- this is the hook working
  AS DESIGNED for a call it believes is risky, the open question is WHY it
  believes all three of these specific, low-risk calls are risky.

reproduction: not yet independently reproduced by this RCA (relayed secondhand
  from the peer session's own live test, not verified by re-running it here).
  Steps as reported:
  1. In a session bound to the `noga-mventures` room, call
     `mcp__pws-brain-mcp__normalize_framework_name` with argument
     `"Six Thinking Hats"`.
  2. Call `mcp__pws-brain-mcp__operate_framework` with `"Six Thinking Hats"`,
     step 1.
  3. Call `mcp__pws-brain-mcp__operate_framework` with `"Bono"`, step 1.
  Observed: all three blocked by `part8-egress-guard-hook.cjs`'s F.1 card,
  identical wording each time. Untested: whether a DIFFERENT `pws-brain-mcp`
  tool (e.g. `brain_search`, `find_frameworks_for_problem_type`) is also
  blocked in the same session, which would confirm "unconditional for this
  session" versus "specific to `operate_framework`/`normalize_framework_name`".

started: first noticed 2026-08-27, this session. Unknown whether pre-existing
  or a recent regression -- no prior debug session in this repo's
  `.planning/debug/` references `part8-egress-guard-hook.cjs` by name (not
  independently verified by grep in this seed; check when investigating).

## Scope and Impact

- Affected surfaces: cli (only surface observed; desktop/cowork not tested)
- Affected commands: any Larry interaction that calls
  `normalize_framework_name` or `operate_framework` on `pws-brain-mcp`, at
  minimum; possibly all `pws-brain-mcp` tools in an affected session
- Affected users: unknown scope -- one venture room (`noga-mventures`),
  one session, three calls. Not yet known whether this is room-specific,
  session-specific, or a broader regression affecting all `pws-brain-mcp`
  traffic
- Version range: not captured in this seed -- get the plugin version from the
  reporting session's own `claude mcp get` or startup banner when
  investigating
- Severity: high if confirmed broad -- a guard that blocks 100% of
  `pws-brain-mcp` reads regardless of content makes the Brain effectively
  unusable in the affected session/room, which is a much larger functional
  regression than a false positive on one genuinely ambiguous query
- Blast radius: unknown until scoped; could be this room only, this session
  only, or a real regression in the Part 8 guard's classification logic
  affecting every room

## Eliminated
<!-- APPEND only - prevents re-investigating -->

(none yet -- not investigated)

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-27T00:00:00Z
  checked: peer session `jsagi-0f`'s own live test, relayed via cross-session
    message (not independently re-run by this RCA)
  found: three `pws-brain-mcp` calls, two distinct argument strings, one
    different tool, all blocked identically by `part8-egress-guard-hook.cjs`'s
    F.1 card; reformulating the query text did not change the outcome
  implication: consistent with an unconditional or near-unconditional block
    for this session, inconsistent with the guard performing real per-call
    content classification -- but not yet confirmed against the hook's actual
    source or reproduced independently

- timestamp: 2026-08-27T00:00:00Z
  checked: the SAME session's equivalent Theo calls
    (`search_theo_chunks_fulltext`, `theo_neighborhood`) for the same
    underlying question
  found: both succeeded with no block and returned real structured content
  implication: rules out a session-wide MCP-call block of any kind -- the
    block is specific to `pws-brain-mcp` (or specific to this hook), not a
    general tool-call failure in that session

## Source-of-Truth Preamble (plan 386-25, 2026-11-06, HEAD f0df97036)

Claims re-checked against the code at HEAD. The 2026-08-27 seed was second-hand; every row below was reproduced here.
- `scripts/part8-egress-guard-hook.cjs` takes its verdict from `classify()` in `lib/core/part8-egress-guard.cjs`. PROVEN by reading.
- `classify()` has allow arms for these tool shapes only: empty payload, MOVE-SET packet, free-form string (brain_ask, brain_query, brain_search with a `question`, `cypher`, `query` or `ask` string), and `_proveKnownToolShape` (find_connections, taxonomy_ladder, recommend_chain, framework_step, framework_techniques, case_story, find_frameworks_for_problem_type, commands_for_problem_type, framework_neighborhood). PROVEN.
- The 2026-08-27 symptom named `operate_framework`. That tool is not in the Theo repo at HEAD (`/home/jsagi/Theo/src/mcp/content` has no operate-framework file). UNVERIFIED for the Brain that served the report in August. The mechanism below applies to every typed tool without an arm.

## Reproduction (counts and words only, synthetic canonical handles, roomDir null)

classify() verdict for each tool under 3 prefixes (`mcp__plugin_mos_mindrian-brain__`, `mcp__pws-brain-mcp__`, `mcp__theo__`). The verdict does not depend on the prefix.

| Tool | Payload shape | Verdict | Class |
|------|---------------|---------|-------|
| normalize_framework_name | {raw: handle} | ambiguous | unknown |
| discover_structure | {framework_name: handle} | ambiguous | unknown |
| orchestration_readiness | {framework_name: handle} | ambiguous | unknown |
| feeds_into_chains | {seeds: 2 handles, max_hops: 2} | ambiguous | unknown |
| framework_concepts | {framework: handle} | ambiguous | unknown |
| search | {query, topK} | ambiguous | unknown |
| brain_ask | {op, params} | ambiguous | unknown |
| classify_problem_type | {} | allow | empty_payload |
| theo_health | {} | allow | empty_payload |

Result: 7 of 9 rows are ambiguous. The 2 allow rows carry zero bytes.

Route matrix, hook run in a child process with PART8_FORCE_BRAIN_AVAILABLE=1, payload {raw: "Six Thinking Hats"} (a canonical handle):

| Prefix | Hook inspects it | Hook exit code | Why |
|--------|------------------|----------------|-----|
| mcp__plugin_mos_mindrian-brain__ | yes | 0 (allow) | shim-backed route; class unknown is on the ambiguous pass list |
| mcp__mindrian-brain__ | yes | 0 (allow) | shim-backed route, same rule |
| mcp__pws-brain-mcp__ | yes | 2 (block) | direct connector; not shim-backed; Brain available so the F.1 card renders; content is never read |
| mcp__theo__ | no | 0 (allow) | `isBrainShapedTool` is false for raw theo names, so no inspection happens |

## Typed-tool table (contract for Task 3)

Sources: every `callTool(` site in `lib/core/brain-client.cjs`, `data/brain-surface-contract.json` (loop_tools, non_contract_note, feyminto_reads), and Theo's own schemas read-only from `/home/jsagi/Theo/src/mcp/content` (all tools are `z.strictObject`).

| Tool | Argument names and types | Kind | Rule for the arm |
|------|--------------------------|------|------------------|
| normalize_framework_name | raw: string (max 256) | handle | exact keys {raw}; value a canonical handle. A non-canonical term keeps the navigator release arm. |
| discover_structure | framework_name: string (max 128) | handle | exact keys; canonical handle |
| orchestration_readiness | framework_name: string (max 128) | handle | exact keys; canonical handle |
| feeds_into_chains | seeds: string[1..10], max_hops: int 1..3 | handle | exact keys; each seed a canonical handle; max_hops integer 1..3 |
| framework_concepts | framework: string, limit: int 1..10 optional | handle | keys {framework} plus optional {limit}; canonical handle; integer limit |
| search | query: string (max 256), topK: int 1..20 optional | freeform | exact keys {query} plus optional {topK}; query decided by theoVerdict exactly as brain_ask decides it |
| classify_problem_type | no parameters at Theo (strictObject, empty) | freeform by plan wording | `{}` already allows (empty_payload). A payload with a `statement` string is decided by theoVerdict (parity). Theo itself refuses the key, so this adds no live channel. |
| brain_ask op mode | op: enum of 3, params: sealed object, topK | handle | op in {list_frameworks, framework_edges, framework_chain_slice}; params keys within {framework, edge_type, seeds, max_hops, limit}; framework and seeds canonical handles; edge_type matches ^[A-Z][A-Z0-9_]{0,63}$; numbers integers |
| theo_health | none | none | empty payload; already allow |

Tools with no arm after this plan (still ambiguous, by design, no schema read in this plan): load_framework, intra_framework_flow, find_bottlenecks, rank_influence, find_whitespace, structural_neighbours, find_frameworks that already have arms. A new typed tool needs a row and a test.

## Plan 386-37 shape facts (copied)

negatives_sprout_count: 6
negatives_sprout_ids: X3,X4,X6,X7,X8,X10

Plan 386-33 may let those short private claims leave if the owner approves option A or B in plan 386-32. Typed free-text tools are decided as brain_ask decides them, so this plan adds no new leak.

## Technical Root Cause

`classify()` ends at the terminal `ambiguous` / `unknown` for every typed Theo read tool that has no arm. Only 9 tool shapes have an allow arm, and the Brain's own loop tools (normalize_framework_name, discover_structure, orchestration_readiness, feeds_into_chains, framework_concepts, search, brain_ask op mode) are not among them. The hook then decides by route:
- shim-backed scopes pass `unknown` (so the plugin's own calls are not blocked, but they also earn no proof);
- the direct connector `mcp__pws-brain-mcp__*` is not shim-backed, so the hook renders the F.1 card and exits 2 for any ambiguous verdict, whatever the payload says.

That is the "unconditional" symptom of 2026-08-27: the block is not a session flag. It is a missing positive rule. Reformulating the text did not help because the verdict never read the text. PROVEN by the table above: the same payload gets exit 0 on the shim scope and exit 2 on the direct scope, and the classify() verdict (ambiguous, unknown) is the same on both.

The Part 8 side of the fix: the new arms prove a typed read call by shape (exact key set, canonical handles, integers). They sit after step 1 (default-deny scan) and step 1b and only turn `ambiguous` into `allow`. A free-text value (search query) is decided by `theoVerdict`, the same call that decides a brain_ask question, so it is allow or block, never ambiguous.

## Required Code Changes

1. `lib/core/part8-egress-guard.cjs`: add a frozen `TYPED_READ_TOOLS` table (tool-name suffix rule, kind, key rule) and `_proveTypedReadShape(payload, toolName)`; call it in `classify()` right after `_proveKnownToolShape` and before the navigator release arm.
2. Route a freeform typed tool (search, classify_problem_type with a statement) to `theoVerdict` right after the existing free-form branch. Add a credential shape check on the string (one long opaque token), because a credential-shaped token is a sprout by shape and must still block (owner principle: credentials always block). The closure of this gap for brain_ask is plan 386-31.
3. Export `_proveTypedReadShape` on the test seam.
4. No change to the hook. Making ambiguous a block is plan 386-27.

## Tests to Add

`tests/test-386-typed-theo-allow-arms.cjs`: TA1 to TA10 (allow per arm, parity of search with brain_ask for a sprout, an edge and a body), TB1 to TB7 (negative pins: name in a handle value, extra key, email, body, first-person edge, find_connections unchanged, credential-shaped token).

##

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the target version, once fixed.
- knowledge-base.md: on resolve, add the summary block.
- Canon: this touches Part 8 directly (canon_parts: [8] above) -- if the fix
  changes classification logic, update `docs/CANON-PHASE-MAP.md` in the same
  commit per this repo's own standing rule.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "classify() had allow arms for 9 tool shapes only. Every other typed Theo read tool fell to the terminal ambiguous/unknown, and the hook blocks any ambiguous verdict on the direct connector mcp__pws-brain-mcp__* whatever the payload says (shim-backed scopes pass class unknown, so they were not blocked but earned no proof)."
fix: "Plan 386-25: frozen TYPED_READ_TOOLS table and _proveTypedReadShape (handle arms: exact keys, canonical handles or command slugs, integer ranges; brain_ask op mode: closed op, handle params) placed after _proveKnownToolShape; freeform typed tools (search, classify_problem_type statement) go to theoVerdict as brain_ask does, with a credential-shaped opaque token block first. Step 1, 1b and the terminal ambiguous return are unchanged."
verification: "tests/test-386-typed-theo-allow-arms.cjs (RED then GREEN, 18 checks); run-all-196, test-260906-fda, test-361-egress-shapes, test-354, test-223, test-355, test-247 pass; corpus gate DELTA lines identical to the pre-plan run (baseline unchanged); hook child process: pws-brain-mcp normalize_framework_name {Six Thinking Hats} exit 2 before, exit 0 after. run-all-386 shows 1 failure, test-386-semantic-scholar-approval (RED test of plan 386-05, not part of this plan)."
files_changed: [lib/core/part8-egress-guard.cjs, tests/test-386-typed-theo-allow-arms.cjs, .planning/debug/part8-egress-guard-blocks-pws-brain-mcp-unconditionally.md]
commits: [244423288 (RCA), a4c934e67 (RED test), fix commit in git log as fix(386-25)]
