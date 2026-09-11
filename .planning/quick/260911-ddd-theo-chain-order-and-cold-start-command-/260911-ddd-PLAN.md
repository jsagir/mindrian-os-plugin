---
phase: quick-260911-ddd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/brain-client.cjs
  - lib/core/brain-prewarm.cjs
  - bin/mindrian-brain-mcp-client.cjs
  - scripts/session-start
  - lib/mcp/brain-route-bound.cjs
  - lib/mcp/brain-router.cjs
  - lib/mcp/brain-composition-census.cjs
  - tests/test-339-theo-ask-compose.cjs
  - tests/test-339-theo-ask-e2e-live.cjs
  - tests/test-339-brain-prewarm-cold-start.cjs
  - tests/test-254-composition-census.cjs
  - tests/run-all-339.sh
  - docs/ENV-TUNING.md
autonomous: true
requirements: [DDD-01, DDD-02, DDD-03]
canon_parts: [3, 7, 8, 9]

must_haves:
  truths:
    - "A Theo chain whose top-ranked framework carries no /mos: command surfaces a command-bearing framework as next_gate.options[0] and as directive.guided.framework."
    - "Theo's own ranking stays readable on every option as theo_rank; Theo's ranking is never altered at the source."
    - "A chain where every option carries a command, or no option does, comes back in Theo's original order."
    - "grounding.option_order names the applied ordering on every composed Theo envelope, including the degraded catch path."
    - "The Brain MCP shim fires exactly one content-free theo_health probe at startup on CLI, Desktop and Cowork, and no tool handler ever awaits it."
    - "The pre-warm marker holds only {at, ok, origin_host}; no Brain response body is ever persisted (Canon Part 8)."
    - "brain-router's Tier 3 bound is one named constant with an env override, read by both the router and the composition census, with no second literal anywhere."
    - "/mos:act still resolves when Theo is genuinely down: the race rejects at the bound and Tier 2's already-computed local heuristic answers."
  artifacts:
    - path: "lib/core/brain-client.cjs"
      provides: "command-bearing-first stable partition, theo_rank, grounding.option_order in _composeTheoAsk"
      contains: "command_bearing_first"
    - path: "lib/core/brain-prewarm.cjs"
      provides: "content-free theo_health pre-warm with an injectable probe seam and a {at, ok, origin_host} marker"
      exports: ["prewarm", "markerPath"]
      min_lines: 60
    - path: "lib/mcp/brain-route-bound.cjs"
      provides: "the single source of the Tier 3 bound plus its env-override resolver"
      exports: ["BRAIN_ROUTE_TIMEOUT_MS", "resolveBrainRouteTimeoutMs"]
    - path: "tests/test-339-brain-prewarm-cold-start.cjs"
      provides: "RED-first arms for the pre-warm marker, its non-blocking contract, and the bound constant"
      min_lines: 80
  key_links:
    - from: "bin/mindrian-brain-mcp-client.cjs"
      to: "lib/core/brain-prewarm.cjs"
      via: "non-awaited prewarm() call inside main() after server.connect"
      pattern: "brain-prewarm"
    - from: "lib/core/brain-prewarm.cjs"
      to: "lib/core/brain-client.cjs"
      via: "callTool('theo_health', {}) default probe"
      pattern: "theo_health"
    - from: "lib/mcp/brain-router.cjs"
      to: "lib/mcp/brain-route-bound.cjs"
      via: "resolveBrainRouteTimeoutMs() in the Tier 3 Promise.race"
      pattern: "resolveBrainRouteTimeoutMs"
    - from: "lib/mcp/brain-composition-census.cjs"
      to: "lib/mcp/brain-route-bound.cjs"
      via: "bound_ms reads BRAIN_ROUTE_TIMEOUT_MS"
      pattern: "BRAIN_ROUTE_TIMEOUT_MS"
    - from: "scripts/session-start"
      to: "lib/core/brain-prewarm.cjs"
      via: "detached CLI spawn, the existing ( node ... >/dev/null 2>&1 || true ) & idiom"
      pattern: "brain-prewarm"
---

<objective>
Two independent Theo defects, one plan.

1. CHAIN ORDER (DDD-01). Theo ranks frameworks by graph degree, not by what the plugin can actually run. Live for IllDefined today: Design Thinking (291, no command), Disruptive Innovation (255, none), Red Teaming (239, challenge-assumptions), Creative Destruction (189, none). Larry therefore leads with a framework that has no executable command behind it. The fix is a stable partition applied in the plugin only: command-bearing frameworks first, Theo's relative order preserved inside each group, Theo's own rank carried on every option as theo_rank so nothing is lost.

2. COLD START (DDD-02). brain-router's Tier 3 races Theo against a 2000 ms bound. The raced call is brainClient.ask(), which since quick 260910-hni makes THREE sequential Theo calls (brain_ask, then recommend_chain, then brain_query). A Render instance waking from spin-down was measured at 2.034 s on the FIRST call alone, and Theo redeploys on every push to its main, opening a fresh cold window each time. So the bound cannot cover even a warm three-call composition on a slow link, and every cold window silently degrades /mos:act to the local heuristic. The fix has two halves: a content-free pre-warm fired at MCP shim startup (surface-neutral: .mcp.json registers the shim with alwaysLoad: true, so it boots on CLI, Desktop and Cowork alike, which is what makes this a Tri-Polar fix rather than a CLI-only one), and one named bound constant with an env override, raised to 6000.

Purpose: Larry leads with a framework the user can actually run, and the Brain is warm by the time the first question arrives.
Output: a stable partition plus theo_rank/option_order in brain-client, a new pre-warm module wired at shim startup, a single-source Tier 3 bound, and RED-first coverage for all three.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/core/brain-client.cjs
@lib/mcp/brain-router.cjs
@lib/mcp/brain-composition-census.cjs
@bin/mindrian-brain-mcp-client.cjs
@tests/test-339-theo-ask-compose.cjs
@tests/test-254-composition-census.cjs

## Interfaces this plan consumes (measured at 5ce0dd3a, do not re-derive)

- `lib/core/brain-client.cjs:1199` `_composeTheoAsk(payload, question, deps)`; exported for tests as `brainClient._test._composeTheoAsk`. The options build sits at roughly :1250-1275: `top` is the max finite `degree`; `confidence = max(0.5, min(0.9, round((0.5 + 0.4 * (degree / top)) * 100) / 100))`; each option is `{framework, confidence, commands}`; `directive.guided.framework = steps[0].framework`; `grounding` follows with `source/answer_mode/rows/problem_type/problem_type_source/chain_coverage/chain_status/confidence_source`. A second, degraded copy of the same envelope lives in the function's own `catch` at the end.
- `lib/core/brain-client.cjs:560` `callTool(toolName, args)`; two positional args only, NO timeout option. `getBrainUrl()` and `callTool` are both named exports.
- `lib/core/doctor/class-m-brain-smoke.cjs:225` is the shipped probe call shape to reuse verbatim: `require('../brain-client.cjs').callTool('theo_health', {})`.
- `lib/mcp/brain-router.cjs:460-466` the Tier 3 `Promise.race`, with the `2000` literal at :464. `localRec` is computed at :458, BEFORE the race, so the Tier 2 fallback is instant once the race loses. `:398` derives `topConf` from `options[0].confidence`. `:9`, `:290` and `:425` all carry stale "2s"/"bound_ms: 2000" prose. `module.exports` is `{ recommend, validateChain }` only.
- `lib/core/directive-envelope.cjs::buildNextGate` passes `next_gate.options` through as-is, and `brainRoute` iterates `options` in array order. Array order therefore survives to every consumer with no edit to directive-envelope.cjs (which this plan does not touch).
- Local state dir convention: `process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian')` (see `lib/core/card-fire-sidechannel.cjs:124`).
- `scripts/session-start:376` detached spawn idiom: `node "${SCRIPT_DIR}/sync-rooms-graph" "$ROOMS_HOME" >/dev/null 2>&1 &`, and the guarded form at :1202: `( node "${PLUGIN_ROOT}/scripts/..." >/dev/null 2>&1 || true ) &`.
- `tests/run-all-339.sh` auto-globs `tests/test-339-*` for discovery (no runner edit needed to RUN a new file), but `EMDASH_TARGETS` at :196-219 is a hand-maintained list of production targets and a MISSING entry FAILS the fence.
- `tests/test-254-composition-census.cjs` scans `lib/mcp/` with `REACH_RE = /require\(\s*['"][^'"]*(?:brain-client|chain-recommender)\.cjs['"]\s*\)/` and a wire-pattern scan. A require of a new pure-data leaf under `lib/mcp/` matches neither, so the census arms stay green.

## Pinned decisions carried into this plan

- D-01 Theo's ranking is NEVER altered at the source. The partition is plugin-side only.
- D-02 The pre-warm sends only a content-free call (theo_health, no arguments) and writes only `{at, ok, origin_host}`. Never a response body. Canon Part 8.
- D-03 The shim is the surface-neutral pre-warm point. session-start is a CLI-only extra, never the only path.
- D-04 Do NOT touch: hooks/hooks.json, the alias tables, the Part 8 guard, lib/core/directive-envelope.cjs, the doctor layer from 260911-axz. D-03b's `BRAIN_ROUTE_NOTE_NO_NEXT_GATE` disclosure behavior is unchanged.
- D-05 Never `git stash` in this repo (a prior session popped another session's stash). Capture baselines by running, not by stashing.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Command-bearing-first stable partition, theo_rank and option_order in _composeTheoAsk (DDD-01)</name>
  <files>lib/core/brain-client.cjs, tests/test-339-theo-ask-compose.cjs, tests/test-339-theo-ask-e2e-live.cjs</files>
  <behavior>
    RED first. Write or update these arms in tests/test-339-theo-ask-compose.cjs and confirm they fail before editing brain-client.cjs.

    - Mixed chain, top step has NO command (the live IllDefined shape): steps Design Thinking (step 1, degree 291, no command), Disruptive Innovation (2, 255, none), Red Teaming (3, 239, ['/mos:challenge-assumptions']), Creative Destruction (4, 189, none). After compose: options map to frameworks [Red Teaming, Design Thinking, Disruptive Innovation, Creative Destruction]; `directive.guided.framework === 'Red Teaming'`; `options[0].theo_rank === 3`; the three command-less options keep Theo order with theo_rank 1, 2, 4; the count of command-less options is unchanged at 3.
    - Mixed chain, top step HAS a command (the shipped Arm 1 fixture): post-sort order is Design Thinking, Red Teaming, Disruptive Innovation, Creative Destruction. The EXISTING order-pinned assertions at :155-157 are now wrong and must be UPDATED, not deleted: `options[0].commands` stays `['diagnose','build-mvp']`, `options[1].commands` becomes `['challenge-assumptions']`, `options[2].commands` and `options[3].commands` are `[]`.
    - Confidence is unchanged by the sort. Assert per framework, not per index: Design Thinking 0.9, Disruptive Innovation 0.85, Red Teaming 0.83, Creative Destruction 0.76. The shipped global "confidence must be non-increasing" loop at :160-162 is now FALSE by design (post-sort the series reads 0.9, 0.83, 0.85, 0.76) and must be replaced by non-increasing WITHIN each partition plus `confidences[0] === 0.9` only on the fixture whose first sorted option is also the top-degree step.
    - All-command chain (every step has at least one command) and no-command chain (no step has any) both come back in Theo order; theo_rank is strictly ascending in both.
    - `theo_rank` is present on EVERY option and equals the step's `step` value; when `step` is absent it falls back to the 1-based index of the step in Theo's chain, never to the post-sort index.
    - `grounding.option_order === 'command_bearing_first'` on the success path AND on the degraded catch path (chain unreachable, options []), so a consumer never branches on the key's presence.
    - Canon Part 8 tripwire (Arm 5) still holds: no canary from `query_terms` or the query() `diagnostics` field reaches the composed envelope.
    - Incumbent-shaped responses are untouched (Arm 2 stays byte-equal, gains no grounding key).
  </behavior>
  <action>
    BASELINE FIRST, before any edit (D-05, never stash): run the four legs the source artifact names as known-red and save the raw output to `.planning/quick/260911-ddd-theo-chain-order-and-cold-start-command-/baseline-reds.txt` at HEAD 5ce0dd3a: `node tests/test-339-update-path-single-source.cjs`, `bash tests/run-all-127.sh`, `bash tests/run-all-257.sh`, `node tests/test-262-unrecognized-shape-voids.cjs`. Task 3 may only call a leg pre-existing if it appears red in that file.

    Then write the RED arms above, run them, confirm red, then implement in `lib/core/brain-client.cjs::_composeTheoAsk`:

    Keep the `top`/confidence computation and the `commandsByFramework` lookup exactly as they are; the sort must not change a single confidence value. Build the options array as today but add `theo_rank` at build time: Theo's `s.step` when it is a finite number, otherwise the 1-based index of that step within `steps`. Then partition in ONE forward pass into two arrays, command-bearing (`Array.isArray(o.commands) && o.commands.length > 0`) and command-less, and concatenate command-bearing first. Use the two-queue pass rather than `Array.prototype.sort` with a comparator: a single forward pass is stable by construction and does not rest on engine sort-stability semantics. When every option or no option carries a command, one queue is empty and the concatenation is the identity, so the order is unchanged for free.

    Set `directive.guided.framework` from the FIRST SORTED option (`sorted[0] && sorted[0].framework) || null`) instead of `steps[0].framework`. Assign the sorted array to `next_gate.options`. Add `option_order: 'command_bearing_first'` to the `grounding` object on BOTH the success path and the function's trailing catch path.

    Do not touch `ask()`'s branch selection at :1337, so an incumbent-shaped response never enters this composer. Do not touch lib/core/directive-envelope.cjs: `buildNextGate` already passes the array through in order.

    STATE THE DOWNSTREAM CONSEQUENCE in the code comment and in the SUMMARY, do not compensate for it here: `lib/mcp/brain-router.cjs:398` derives `topConf` from `options[0].confidence`, so on a chain whose top-ranked framework has no command the routed confidence now reads the first command-bearing option's confidence (0.83 on the live IllDefined shape, previously 0.9). That is the intended meaning of the change (confidence describes the option actually surfaced), not a regression. Do NOT add a compensating `max()` in brain-router; brain-router is otherwise untouched by this task. The same reorder also improves `brainRoute`'s `rawChain`, which pushes `opt.commands` slugs before framework names in array order, so the routable slugs now lead the chain.

    Finally extend `tests/test-339-theo-ask-e2e-live.cjs` with three live checks, leaving the SKIP contract untouched (the `SKIP:` line must stay the first line of stdout): when any option carries a command then `options[0].commands.length > 0`; `options[0].theo_rank` is a finite number; `grounding.option_order === 'command_bearing_first'`. No em-dashes in any edited file.
  </action>
  <verify>
    <automated>node tests/test-339-theo-ask-compose.cjs</automated>
  </verify>
  <done>All compose arms pass; a chain whose top step has no command surfaces a command-bearing framework at options[0] and in directive.guided.framework; every option carries theo_rank equal to Theo's step; all-command and no-command chains keep Theo order; confidence values are identical to pre-change values per framework; grounding.option_order is present on both the success and the catch path; baseline-reds.txt exists.</done>
</task>

<task type="auto">
  <name>Task 2: Shim-startup Brain pre-warm and a single-source Tier 3 bound (DDD-02)</name>
  <files>lib/core/brain-prewarm.cjs, bin/mindrian-brain-mcp-client.cjs, scripts/session-start, lib/mcp/brain-route-bound.cjs, lib/mcp/brain-router.cjs, lib/mcp/brain-composition-census.cjs, tests/test-254-composition-census.cjs, docs/ENV-TUNING.md</files>
  <action>
    (a) NEW `lib/core/brain-prewarm.cjs`. Exports `prewarm(deps)` and `markerPath(homeDir)`. The deps seam (the same injectable-seam discipline `class-m-brain-smoke.cjs` uses for its own probe) is `{ probe, originHost, now, homeDir, timeoutMs }`, all optional. Defaults: `probe` is `() => require('./brain-client.cjs').callTool('theo_health', {})`, the exact call shape `class-m-brain-smoke.cjs:225` already ships; `originHost` is derived from `require('./brain-client.cjs').getBrainUrl()` and reduced to the URL host only; `homeDir` is `process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian')`; `timeoutMs` reads `MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS`, default 15000. Require brain-client LAZILY inside the default probe so importing this module costs nothing.

    Behavior: race the probe against the timeout; `ok` is true only when the probe resolved a non-null object before the bound. Write the marker to `<homeDir>/brain-prewarm.json` with EXACTLY three keys and nothing else: `{ at, ok, origin_host }` (`at` is an ISO string from `now`). Never persist any part of the response body, never the key, never a question (Canon Part 8, D-02). `mkdir` the directory recursively; swallow every fs and network failure; the function NEVER throws and NEVER rejects. Write NOTHING to stdout ever, because this runs inside an MCP stdio process where a stray stdout byte corrupts the JSON-RPC channel; a single stderr line only when `MINDRIAN_DEBUG` is set. Add `if (require.main === module) { prewarm().catch(() => {}); }` so the file is directly spawnable.

    Reasoning to record in the file header: the timeout does NOT bound the wake itself. The request reaching Render is what wakes the instance; aborting our own wait does not cancel that. The timeout only bounds how long we hold the marker write open, which is why 15000 is generous without costing anyone anything.

    (b) `bin/mindrian-brain-mcp-client.cjs`: inside `main()`, AFTER `await server.connect(transport)` and after the existing `[mindrian-brain] MCP server ... started` stderr line, lazily `require('../lib/core/brain-prewarm.cjs')` in a try/catch and call `prewarm()` WITHOUT `await`, voiding the promise with `.catch(() => {})`. No tool handler references it. Comment the Tri-Polar point explicitly: `.mcp.json` registers this shim with `alwaysLoad: true`, so it starts on Claude Code CLI, Claude Desktop and Cowork alike, which makes this the one surface-neutral pre-warm point; the session-start spawn below is a CLI-only extra, never the only path.

    (c) `scripts/session-start`: add ONE detached spawn using the guarded idiom already in the file (`( node "${PLUGIN_ROOT}/lib/core/brain-prewarm.cjs" >/dev/null 2>&1 || true ) &`). Place it in the Brain-status block near :1900, NOT inside the `if [ -d "$ROOM_DIR" ]` guard, because the pre-warm has nothing to do with a room. Comment it so the next reader does not mistake it for the egress quick 260910-h32 removed: that was a `brain_write` of room data, this is a content-free `theo_health` READ with no arguments and no room bytes. It reintroduces no Brain write.

    (d) NEW `lib/mcp/brain-route-bound.cjs`, a pure-data leaf that requires nothing and opens no wire. Exports `BRAIN_ROUTE_TIMEOUT_MS = 6000` and `resolveBrainRouteTimeoutMs(env)` (defaults to `process.env`), which honors `MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS` only when it parses to a finite integer greater than 0 and otherwise returns the default. It is a leaf and not a brain-router export so the DECLARATION (the census) can depend on a constant instead of on the implementation; that direction is what keeps the census honest. Justify 6000 in the file header from the measured ground: the raced call is `brainClient.ask()`, which since quick 260910-hni makes THREE sequential Theo calls (brain_ask, recommend_chain, brain_query); the measured Render cold wake is 2.034 s on the first call alone, so 2000 could not cover even a warm three-call composition on a slow link. 6000 is the measured 2.034 s wake plus two warm follow-on calls (about 1 s) with roughly 2x headroom. Also state the cost that was accepted: when Theo is genuinely down the race now rejects at 6 s instead of 2 s, but `localRec` is already computed at :458 BEFORE the race, so the Tier 2 answer is instant once the race loses and /mos:act still resolves. The trade is a rarer 6 s worst case against a silently degraded recommendation on every cold window.

    (e) `lib/mcp/brain-router.cjs`: require the leaf at the top and replace the `2000` literal at :464 with `resolveBrainRouteTimeoutMs()` evaluated at call time, so the env override is honored per call and is testable. Correct the stale prose at :9 ("2s hard timeout"), :290 ("bound_ms: 2000") and :425 ("(2s timeout)") to name the constant, the env var and the 6000 default instead of a number. Re-export `BRAIN_ROUTE_TIMEOUT_MS` and `resolveBrainRouteTimeoutMs` alongside `{ recommend, validateChain }` so the pin is readable from either side. Change nothing else: D-03b's `BRAIN_ROUTE_NOTE_NO_NEXT_GATE` disclosure and the SWEEP-01 refusal leg are untouched.

    (f) `lib/mcp/brain-composition-census.cjs`: the brain-router entry's `bound_ms` reads `require('./brain-route-bound.cjs').BRAIN_ROUTE_TIMEOUT_MS`; no literal survives. Say in the entry prose that the number is the DEFAULT and that `MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS` can move the applied bound at runtime. Correct the file header's "requires nothing, executes nothing, opens no wire" claim to "requires exactly one pure-data leaf (brain-route-bound.cjs) and nothing else; still executes nothing and opens no wire", so the header does not become a lie. Verify the header's own scan-safety property still holds: the new require names `brain-route-bound.cjs`, which matches neither `REACH_RE` nor the wire-pattern scan.

    (g) `tests/test-254-composition-census.cjs`: add one arm pinning the single source. The brain-router entry's `bound_ms` is strictly equal to `require('../lib/mcp/brain-route-bound.cjs').BRAIN_ROUTE_TIMEOUT_MS`, AND a comment-stripped scan of `lib/mcp/brain-router.cjs` (reuse the file's own `codeOf` helper) finds zero occurrences of the old raced literal.

    (h) `docs/ENV-TUNING.md`: two entries in the established What/Default/Why format, `MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS` (default 6000) and `MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS` (default 15000).

    No em-dashes in any file. Hyphens only.
  </action>
  <verify>
    <automated>node tests/test-254-composition-census.cjs && test "$(grep -v "^\s*\(//\|\*\|/\*\)" lib/mcp/brain-router.cjs | grep -c "new Error('timeout')), 2000")" -eq 0 && node -e "const b=require('./lib/mcp/brain-route-bound.cjs');const a=require('node:assert/strict');a.equal(b.BRAIN_ROUTE_TIMEOUT_MS,6000);a.equal(b.resolveBrainRouteTimeoutMs({MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS:'9000'}),9000);a.equal(b.resolveBrainRouteTimeoutMs({MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS:'abc'}),6000);console.log('bound ok')"</automated>
  </verify>
  <done>lib/core/brain-prewarm.cjs and lib/mcp/brain-route-bound.cjs exist; the shim calls prewarm() without awaiting it after server.connect; session-start spawns the same probe detached with no Brain write; brain-router's race reads the resolver and no raced 2000 literal survives; the census bound_ms reads the leaf constant and the census test pins them equal; both env vars are documented.</done>
</task>

<task type="auto">
  <name>Task 3: RED-first cold-start arms, harness registration, and the full verification run (DDD-03)</name>
  <files>tests/test-339-brain-prewarm-cold-start.cjs, tests/run-all-339.sh</files>
  <action>
    NEW `tests/test-339-brain-prewarm-cold-start.cjs`, node:test + node built-ins only, zero network, zero server spawn. Every arm drives the injectable seams, never a real Brain. Write the arms first, confirm red where the behavior is new, then close them against Task 2's implementation.

    - Marker shape and Part 8 body tripwire: inject a probe resolving `{ ok: true, mode: 'x', build_stamp: { sha: 'deadbeef' }, secret: 'CANARY-260911-ddd' }`, an `originHost` stub and a tmpdir `homeDir`. After `await prewarm(deps)`, the marker file parses to exactly `['at','ok','origin_host']` (sorted `Object.keys` deep-equal) and the raw file TEXT contains no `CANARY`, no `build_stamp` and no `sha`.
    - Failure and timeout: a probe that rejects, and a probe that never settles with `timeoutMs: 20`, both write `ok: false`, both resolve rather than throw, and both still write only the three keys.
    - Non-blocking contract: prove ordering, not wall clock. With a probe that resolves only after an externally released deferred, call `prewarm(deps)` without awaiting, push a sentinel onto an ordering array immediately after the call returns, then release the probe and await. The sentinel must sit BEFORE the probe's own ordering push.
    - Bound constant and env override: `resolveBrainRouteTimeoutMs({})` is 6000; `'9000'` gives 9000; `'abc'`, `'0'`, `'-1'` and `''` all fall back to 6000.
    - Shim seam, source-shape scan only (no spawn): read `bin/mindrian-brain-mcp-client.cjs`, strip full-line comments with the `codeOf` idiom, assert it contains a `brain-prewarm` require and a `prewarm(` call, and assert that call is NOT preceded by `await` on the same line. This is the gate that stops a future edit from making shim startup block on the probe.

    Then register the new production targets in `tests/run-all-339.sh`'s hand-maintained `EMDASH_TARGETS` list (a MISSING entry FAILS the fence): `lib/core/brain-prewarm.cjs`, `lib/mcp/brain-route-bound.cjs`, `lib/mcp/brain-composition-census.cjs`, `docs/ENV-TUNING.md`. The new test file needs NO runner edit for discovery; the `tests/test-339-*` glob picks it up.

    FULL RUN, in this order, recording each result in the SUMMARY: `bash tests/run-all-339.sh`; `bash tests/run-all-252.sh`; `bash tests/run-all-254.sh`; `node scripts/doctor.cjs --acceptance` (must stay 20/20 on a clean tree); `node tests/test-339-theo-ask-e2e-live.cjs` (a Brain origin is reachable on this machine, so this must PASS, not SKIP; a SKIP line is a FAIL for this plan and must be investigated, not accepted).

    Known pre-existing red legs may be recorded as pre-existing ONLY if they appear in `baseline-reds.txt` captured at 5ce0dd3a in Task 1: test-339-update-path-single-source, run-all-127 127.1 fixtures, run-all-257 Plan 08, test-262-unrecognized-shape-voids. Anything red that is NOT in that file is a regression this plan caused and must be fixed, never annotated away. Never `git stash` (D-05).

    Commit messages end with the two required trailers: the executing model's own `Co-Authored-By` trailer as given by its attribution instruction and `Claude-Session: https://claude.ai/code/session_01HBgMttGjUp3zcYdCJkn3Zv`.
  </action>
  <verify>
    <automated>node tests/test-339-brain-prewarm-cold-start.cjs && bash tests/run-all-339.sh && bash tests/run-all-254.sh</automated>
  </verify>
  <done>The new 339 arms pass; run-all-339, run-all-252 and run-all-254 are green apart from legs present in baseline-reds.txt; doctor --acceptance reports 20/20; the live e2e smoke PASSES (not SKIP) and shows a command-bearing framework at options[0]; every new production file is in the em-dash fence list.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin -> Theo (Brain) | Outbound methodology-only egress. Canon Part 8: no room bytes may cross. |
| Brain response -> local disk | The pre-warm marker is the only new persistence of anything derived from a Brain call. |
| MCP stdio channel | The shim's stdout IS the JSON-RPC transport; any stray byte corrupts the session. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ddd-01 | Information disclosure | lib/core/brain-prewarm.cjs marker write | mitigate | Marker holds exactly {at, ok, origin_host}; the Part 8 body tripwire arm in Task 3 plants a canary in the probe response and asserts it never reaches the file text. |
| T-ddd-02 | Information disclosure | pre-warm probe payload | mitigate | theo_health is called with `{}`, no arguments, per D-02; it carries no question, no room content, no user bytes, and still passes through callTool's existing Part 8 classify belt. |
| T-ddd-03 | Denial of service | shim startup | mitigate | prewarm() is never awaited and never throws; the Task 3 source-shape arm fails the build if an `await` is ever added in front of the call. |
| T-ddd-04 | Denial of service | brain-router Tier 3 at 6000 ms | accept | The bound rose from 2 s to 6 s worst case on a down Brain, but localRec is computed before the race so the Tier 2 answer is instant on loss and the race always resolves. Rationale recorded in brain-route-bound.cjs. |
| T-ddd-05 | Tampering | MCP stdio channel | mitigate | brain-prewarm.cjs writes nothing to stdout under any condition; stderr only, and only under MINDRIAN_DEBUG. |
| T-ddd-06 | Repudiation | brain-router / census bound drift | mitigate | One leaf constant, required by both; the new census-test arm fails if they ever diverge or if the raced literal returns. |
| T-ddd-SC | Tampering | npm/pip/cargo installs | n/a | This plan installs no packages. Node built-ins and existing repo modules only, so no legitimacy gate is triggered. |
</threat_model>

<verification>
- `node tests/test-339-theo-ask-compose.cjs` green, including the updated order-pinned assertions.
- `node tests/test-339-brain-prewarm-cold-start.cjs` green.
- `bash tests/run-all-339.sh`, `bash tests/run-all-252.sh`, `bash tests/run-all-254.sh` green apart from legs recorded in baseline-reds.txt.
- `node scripts/doctor.cjs --acceptance` reports 20/20.
- `node tests/test-339-theo-ask-e2e-live.cjs` PASSES against the live Brain and prints a command-bearing framework at options[0].
- No U+2014 anywhere in the touched files (the run-all-339 em-dash fence covers every one of them after Task 3's registration).
</verification>

<success_criteria>
- Larry leads IllDefined with Red Teaming (a framework with a real /mos: command) instead of Design Thinking, and Theo's original rank is still visible as theo_rank on all four options.
- An all-command or no-command chain is byte-identical in order to what Theo returned.
- grounding.option_order reads `command_bearing_first` on every composed Theo envelope.
- The Brain MCP shim fires one content-free theo_health probe at startup on all three surfaces and never blocks a tool handler on it; the marker on disk holds only {at, ok, origin_host}.
- The Tier 3 bound is 6000 by default, overridable by MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS, and lives in exactly one place that both brain-router and the composition census read.
</success_criteria>

<output>
Create `.planning/quick/260911-ddd-theo-chain-order-and-cold-start-command-/260911-ddd-SUMMARY.md` when done. Record: the post-sort live IllDefined order, the confidence values proving the sort did not move them, the brain-router topConf consequence, the 6000 justification, the full verification results, and the baseline-reds.txt comparison.
</output>
