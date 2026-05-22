---
status: resolved
kind: rca
trigger: "brain_ask returns a structurally valid but empty DirectiveEnvelope - no framework, no questions, no gate options - on every methodology question"
created: 2026-05-22T19:30:00Z
updated: 2026-05-22T21:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - the deployed Brain server's `brain_ask` handler never
  builds a `directive`/`next_gate`; the plugin-side envelope wrapper therefore
  always falls through to its empty GUIDED scaffold.
test: traced the full code path; reproduced the empty scaffold with the actual
  server payload shape; verified the fix produces a populated envelope.
expecting: (resolved)
next_action: (resolved - fix written, awaits remote redeploy on push)
reasoning_checkpoint: (none)

## Symptoms

- **Expected behavior:** `brain_ask` returns a populated `DirectiveEnvelope` -
  methodology guidance for the question asked (a framework, reframing questions,
  a stage, and/or `next_gate` options). It is the methodology-reasoning tool;
  per its own description it "auto-routes Pinecone/Neo4j server-side."
- **Actual behavior:** `brain_ask` returns a structurally valid but EMPTY
  envelope. `directive.guided = {questions: [], framework: null, stage: null}`
  and `next_gate.options = []`. Zero methodology payload.
- **Error messages:** None. No exception, no error string. The packet is
  well-formed: `packet_version: "1.0"`, `packet_type: "DirectiveEnvelope"`,
  `mode: "GUIDED"`, `mode_rationale: "default_guided_pedagogical_canon"`.
- **Timeline:** Found 2026-05-22 during the `windows-build-brain-python-qa`
  QA sweep (Track B, test B3). When it started is unknown - no prior baseline.
- **Reproduction:** Call `brain_ask` with any methodology question. Confirmed
  on 2 distinct questions, both returned an empty envelope:
  1. "What frameworks chain from SWOT analysis?"
  2. "What framework should I use to evaluate a wicked problem at the discovery
     stage?"

## Scope and Impact

- `brain_ask` is the Brain's methodology-reasoning surface (the "teacher"). The
  retrieval surface (`brain_search`, `brain_stats`, `brain_schema`) works fine -
  `brain_search "SWOT analysis"` returned 3 ranked hits at ~0.84 similarity.
- Affected consumer surfaces (per docs/CAPABILITY-MAP.md row 1): `/mos:act`,
  `/mos:think-hats`, `/mos:pipeline`, and Larry's mid-conversation routing all
  consume the `brain_ask` DirectiveEnvelope. With an empty envelope they get no
  framework recommendation, no reframing questions, and no next-gate options -
  Larry silently degrades to Tier-0 behavior even when the Brain is reachable.
- NOT BUG 1 (no Python involved). NOT BUG 2 (`brain_ask` issues no raw Cypher
  for user content - it is the non-admin methodology path). NOT an env gap.

## Evidence

- timestamp: 2026-05-22T20:05:00Z
  finding: The `DirectiveEnvelope` is NOT built by the Brain server. It is built
    client-side in `lib/core/directive-envelope.cjs` (`wrapDirective`). The
    stdio shim `bin/mindrian-brain-mcp-client.cjs:80` calls
    `brainClient.ask(question)` then `wrapDirective(raw, signals)`.
- timestamp: 2026-05-22T20:12:00Z
  finding: `wrapDirective` -> `buildDirective(brainResponse, mode)`
    (directive-envelope.cjs:86-107) does a PASS-THROUGH only when
    `brainResponse.directive` is a typed object. Otherwise it returns an empty
    scaffold `{guided: {questions: [], framework: null, stage: null}}`.
    `buildNextGate` (lines 115-127) likewise only passes through a
    `brainResponse.next_gate`; otherwise it returns `{sub_shape: 'F.1',
    options: []}`. `selectMode` with no signals returns
    `default_guided_pedagogical_canon`. All three observed symptom fields are
    the documented fall-through defaults.
- timestamp: 2026-05-22T20:20:00Z
  finding: The deployed Brain server's `brain_ask` handler
    (`mcp-server-brain/lib/brain-ask.cjs`, pre-fix) returns
    `{question, keyword, source, count, results}` - raw Pinecone/Neo4j search
    hits ONLY. It has NO `directive` field, NO `next_gate` field, NO
    `mode_signals` field. `brain-client.ask()` is a pure passthrough
    (`callTool('brain_ask', ...)`, brain-client.cjs:462-465) - it does not
    synthesize a directive either.
- timestamp: 2026-05-22T20:28:00Z
  finding: Git history confirms a stale-contract gap.
    `mcp-server-brain/lib/brain-ask.cjs` was last touched by commit `dc363c54`
    ("feat: brain_ask - smart NL tool with automatic Pinecone/Neo4j fallback") -
    the ORIGINAL brain_ask, predating Phase 127. `lib/core/directive-envelope.cjs`
    was created by Phase 127 commit `3826c987` ("feat(127-00): implement
    directive-envelope module"). Phase 127's directory is
    `127-brain-mcp-local-stdio-shim` - its scope was the stdio shim + the
    client-side envelope WRAPPER. The server-side directive synthesis the
    wrapper's pass-through branch expects was never built.
- timestamp: 2026-05-22T20:34:00Z
  finding: `docs/CAPABILITY-MAP.md` (the canonical Brain<->Plugin contract) row 1
    + the `## DirectiveEnvelope` section specify `brain_ask` returns a populated
    `directive` (questions, framework, stage) + `next_gate.options`, marked
    "shipped (v1.13.0-beta.20, Phase 127)". The map's claim is WRONG for the
    server side: the contract was declared shipped when only the consumer
    wrapper shipped. This is exactly the failure mode CAPABILITY-MAP.md row
    "Plugin expects something Brain doesn't build" is meant to kill - the map
    itself drifted.
- timestamp: 2026-05-22T20:40:00Z
  finding: Reproduced the bug deterministically. Feeding the actual pre-fix
    server payload shape (`{question, keyword, source, count, results}`, no
    `directive`) through `wrapDirective` yields exactly the reported symptom:
    `directive.guided.questions.length === 0`, `next_gate.options.length === 0`,
    `mode_rationale === "default_guided_pedagogical_canon"`.

## Eliminated

- timestamp: 2026-05-22T20:10:00Z
  eliminated: "Bug in the envelope wrapper (directive-envelope.cjs)."
  why: The wrapper is correct. Its pass-through + empty-scaffold logic is the
    documented design. 9/9 unit tests pass. The wrapper cannot invent a
    directive the server never sent.
- timestamp: 2026-05-22T20:15:00Z
  eliminated: "Thin stdio relay shim corrupts the payload."
  why: `bin/mindrian-brain-mcp-client.cjs` faithfully forwards `raw` into
    `wrapDirective`. 6/6 shim tests pass. The shim has zero transformation
    logic on the brain_ask path.
- timestamp: 2026-05-22T20:18:00Z
  eliminated: "Brain unreachable / Tier-0 degradation."
  why: A Tier-0 envelope carries `mode_rationale: "brain_unreachable"` and
    `stage: "tier_0_brain_unreachable"`. The symptom shows
    `mode_rationale: "default_guided_pedagogical_canon"` and `stage: null` -
    the Brain WAS reachable; it just returned a directive-less payload.

## Resolution

root_cause: >
  Stale contract. The Phase 127 DirectiveEnvelope contract
  (docs/CAPABILITY-MAP.md) requires `brain_ask` to return a payload carrying a
  populated `directive` + `next_gate` + `mode_signals`. Phase 127 implemented
  only the CONSUMER side - the client-side envelope wrapper
  (lib/core/directive-envelope.cjs) and the stdio shim. The PRODUCER side - the
  deployed Brain server's `brain_ask` handler (mcp-server-brain/lib/brain-ask.cjs)
  - was never updated; it still returns the original raw search-hits payload
  ({question, keyword, source, count, results}) from commit dc363c54. With no
  `directive` key in the server response, the wrapper's `buildDirective`
  pass-through branch never fires and it falls through to its empty GUIDED
  scaffold on every call. The empty envelope is correct-by-design wrapper
  behavior fed a contract-incomplete server payload.

fix: >
  Augmented the server-side handler `mcp-server-brain/lib/brain-ask.cjs` to
  synthesize the typed directive from the Neo4j teaching graph. New
  `buildDirectiveFromGraph(session, keyword, limit)` runs two READ-only Cypher
  queries: (1) the best-matching Framework node for the question keyword;
  (2) that framework's outbound chaining edges
  (FEEDS_INTO/CHAINS_TO/CO_OCCURS/PRECEDES/NEXT). It builds
  `directive.guided.{questions, framework, stage}` - each chain target becomes a
  reframing question, the framework's beautiful_question seeds an opening
  question, and the chained frameworks become `next_gate.options` as F.1 "Run
  Methodology" verbs. New `deriveModeSignals(question)` derives mode_signals
  from generic question phrasing only. The handler now returns the directive +
  next_gate + mode_signals alongside the legacy `results` array (backward
  compatible). Graceful degradation: a graph failure or no-framework-match
  omits the directive, and the wrapper's empty scaffold is then the honest
  "nothing to teach here" signal. Canon Part 7: reuses the existing getNeo4j,
  extractKeyword, selectPattern helpers and the framework/connection Cypher
  pattern style already in the file. Canon Part 8: all sessions are
  defaultAccessMode READ; zero write-Cypher; the question carries only generic
  methodology language and the graph holds only generic teaching methodology -
  no user data enters or leaves. HARD RULE: all em-dashes in the file replaced
  with hyphens.

  IMPORTANT - remote redeploy required: the fixed handler lives in
  `mcp-server-brain/`, which is served from `mindrian-brain.onrender.com`, NOT
  shipped to users. `mcp-server-brain/render.yaml` has `autoDeploy: true` and
  `rootDir: mcp-server-brain`, and the Render service is connected to the
  `jsagir/mindrian-os-plugin` GitHub repo. So the fix takes effect at runtime
  the moment the commit is pushed to `origin/main` (Render auto-deploys). Until
  that push lands, the live Brain continues to return the directive-less
  payload and `brain_ask` envelopes stay empty. No code change in the plugin
  itself is needed - the client-side wrapper already handles a populated
  server payload correctly.

  Follow-up (non-blocking): docs/CAPABILITY-MAP.md row 1 marks the
  DirectiveEnvelope "shipped (v1.13.0-beta.20, Phase 127)" - that claim was
  premature for the server side. After the redeploy verifies live, refresh the
  row's "Last verified" date; if a tracking phase is wanted for the server-side
  synthesis, file it so the map stops asserting a half-shipped contract.

verification: >
  - `node --check mcp-server-brain/lib/brain-ask.cjs` - passes.
  - Contract pass-through test: feeding a post-fix payload shape (with a
    populated `directive` + `next_gate`) through `wrapDirective` yields
    `directive.guided.questions.length > 0`, `directive.guided.framework`
    non-null, `directive.guided.stage` populated, `next_gate.options.length > 0`
    - the empty-envelope symptom is gone.
  - Bug-reproduction control: feeding the PRE-fix payload shape (no `directive`)
    through `wrapDirective` still yields the empty scaffold - confirms the
    diagnosis and that the wrapper itself was never at fault.
  - `buildDirectiveFromGraph` unit-tested with a mock Neo4j session: a framework
    match with 2 chain edges produces framework + 3 questions (1 beautiful-
    question seed + 2 chain prompts) + stage + 2 next_gate options; a
    no-match session returns null (graceful empty signal).
  - `deriveModeSignals` unit-tested: "just tell me" -> user_said_just_tell_me
    true; "run SWOT ..." -> user_explicitly_said_run true; plain question -> all
    false (GUIDED default preserved).
  - Regression: directive-envelope.test.cjs 9/9 pass; mindrian-brain-shim.test.cjs
    6/6 pass.
  - Canon Part 8 scan: zero write-Cypher, zero user-data tokens, READ-only
    sessions confirmed. Em-dash HARD RULE: 0 em-dashes in the file.
  - NOT YET verified against the LIVE Brain: requires the remote redeploy
    (push to origin/main triggers Render autoDeploy). Post-redeploy smoke test:
    call `brain_ask "What frameworks chain from SWOT analysis?"` and confirm a
    non-empty `directive.guided.questions` + `next_gate.options`.

files_changed:
  - mcp-server-brain/lib/brain-ask.cjs (server-side directive synthesis added;
    buildDirectiveFromGraph + deriveModeSignals added; brain_ask handler
    returns directive + next_gate + mode_signals; ALL Cypher converted to
    bound parameters - $keyword / $frameworkName / $limit via neo4j.int() -
    replacing the original string-interpolation pattern on the Step 2 fallback
    path as well; em-dashes stripped; new functions exported for unit testing)

## Specialist Review

Reviewer lens: general Node.js / CJS + neo4j-driver. The fix was reviewed and
one idiomatic improvement was applied before close.

- SUGGEST_CHANGE (applied): the first cut of `buildDirectiveFromGraph` built
  Cypher with inline string literals (`'${kw}'`) guarded by a hand-rolled
  `escLiteral`. That matched the ORIGINAL `brain-ask.cjs` style, but the
  sibling module `mcp-server-brain/lib/neo4j-tools.cjs` already uses the
  idiomatic bound-parameter form (`session.run(cypher, params)`). The fix was
  refactored to bound parameters end-to-end: `$keyword`, `$frameworkName`, and
  `$limit` (the last wrapped with `neo4j.int()` as the driver requires for a
  parameterized LIMIT). `escLiteral` was deleted. This also incidentally
  closed a latent weakness in the pre-existing Step 2 fallback path, which had
  been doing `.replace(/\$keyword/g, ...)` interpolation - it now uses bound
  params too. Blast radius was low (brain_ask is non-admin; the keyword is
  derived from a generic methodology question, not user content), but the
  bound-parameter form is the correct pattern and consistent with the codebase.
- LOOKS_GOOD: graceful-degradation shape (graph failure or no-match -> directive
  omitted -> wrapper's honest empty scaffold), READ-only sessions, sessions
  closed in `finally`, backward-compatible payload (legacy `results` retained),
  and the GUIDED-default preservation in `deriveModeSignals`.

## Addendum -- 2026-05-22: first fix was incomplete (live-graph QA)

The first fix (commit c40afc71) was deployed live (Render dep-d88863647okc7398ofm0,
status live 16:24:28Z) but `brain_ask` STILL returned an empty envelope. A live
post-deploy smoke test plus direct Neo4j forensics (via the `my-neo4j` MCP and a
throwaway `buildDirectiveFromGraph` probe against the production graph) found the
fix never retrieved an anchor node. Two retrieval defects, both invisible to the
mock-session unit tests:

- **Keyword defect.** `extractKeyword("What frameworks chain from SWOT analysis?")`
  returns `"frameworks chain from"` -- it strips the leading question word then
  takes the first three words, dropping the salient noun (SWOT) entirely.
  `buildDirectiveFromGraph` then ran `WHERE toLower(f.name) CONTAINS $keyword` on
  that whole 3-word phrase. No framework name contains the phrase
  "frameworks chain from" -> 0 rows -> `return null` -> empty envelope, every call.
- **Label defect.** The retrieval matched `:Framework` only. "SWOT Analysis" is a
  `:Technique` node (confirmed: 167 `:Framework` nodes, SWOT is not one). Even with
  a correct keyword the match would miss it. Separately, the chain query required
  `type(r) IN ['FEEDS_INTO','CHAINS_TO','CO_OCCURS','PRECEDES','NEXT']`; only
  `FEEDS_INTO` exists between frameworks (176 edges) -- `CO_OCCURS` between
  frameworks is 0, the other three are not in the schema.

The mock unit tests passed because the mock session returned a framework record
regardless of the query -- the mock hid both defects.

**Second fix:** `buildDirectiveFromGraph` rewritten to take the full question and
retrieve in two passes -- (1) named-entity: a node whose own name appears verbatim
in the question, matched across `:Framework|:Technique|:Method|:Tool|:InnovationTool|:ValidationTool`,
preferring `:Framework` then longest name; (2) token fallback: `:Framework` names
ranked by generic content-token hits, with imperative query verbs stopworded so a
short token cannot substring-match an unrelated framework. Chain query delabeled
(match the anchor by name, `FEEDS_INTO` only). Verified against the LIVE graph:
"Six Thinking Hats" -> 5 chains; "wicked problem at discovery stage" -> 4 chains
via fallback; "SWOT analysis" -> names the framework honestly with 0 chains (SWOT
is a genuine dead-end node, 0 out-edges); off-topic question -> null. Client
wrapper regression `directive-envelope.test.cjs` 9/9 green.

**Lesson (for knowledge-base):** a mock-session unit test that returns canned
records regardless of the query proves the directive-BUILDING shape but proves
nothing about RETRIEVAL. Graph-retrieval code needs at least one test against the
real graph (or a fixture seeded from it). Filed against this RCA.

## Final verification -- 2026-05-22 19:57Z: RESOLVED, confirmed live

Second fix 4a7cbfbe; Render deploy dep-d88b7qcm0tmc73901d00 live 19:52:58Z.
Post-deploy live smoke test of the brain_ask MCP tool against the production
Brain (mindrian-brain.onrender.com):
- "What frameworks chain from Six Thinking Hats?" -> populated DirectiveEnvelope:
  framework "Six Thinking Hats", 5 reframing questions (each with a graph-sourced
  rationale), 5 next_gate F.1 options with confidence scores (0.9 / 0.85).
- "What framework ... wicked problem at discovery stage?" -> token-fallback path
  matched "Wicked Problem Detection Framework", 4 chained next_gate options.
The empty-envelope defect is closed. brain_ask is the methodology-reasoning
surface again.

Deploy note (knowledge-base): the FIRST post-deploy smoke test at 19:54:15Z hit a
~30-second 502 window (19:54:15-19:54:44Z). The app logs show NO crash and NO
restart -- only the clean "Brain MCP server listening on port 10000" startup
line. The 502s were the single-instance Render service settling its deploy swap;
/health was 200 again by 19:57Z and both brain_ask smoke tests then succeeded.
Lesson: on a 1-instance Render web service, do not smoke-test within ~90s of the
deploy going "live" -- a transient 502 window during the instance swap is
expected and is not a crash.
