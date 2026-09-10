---
phase: quick/260910-hni
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260910-hni]
canon_parts: [3, 7, 8, 12]
files_modified:
  - lib/core/brain-client.cjs
  - lib/core/directive-envelope.cjs
  - bin/mindrian-brain-mcp-client.cjs
  - lib/mcp/brain-router.cjs
  - lib/core/part8-egress-guard.cjs
  - skills/larry-personality/SKILL.md
  - dist/generic-claude-dir/.claude/skills/larry-personality/SKILL.md
  - dist/zed/.agents/skills/larry-personality/SKILL.md
  - tests/test-339-theo-ask-compose.cjs
  - tests/test-339-theo-ask-e2e-live.cjs
  - tests/run-all-339.sh

must_haves:
  truths:
    - "brain_ask through the shim returns a DirectiveEnvelope whose directive.guided.framework names a real framework off Theo's recommended chain, not null."
    - "next_gate.options carries one entry per chain step, each with a confidence in [0.5, 0.9] and the /mos: command slugs that use that framework."
    - "grounding.rows carries the Theo rows the answer actually stands on, so an EMPTY rows array is a visible thin-footing signal instead of an invisible one."
    - "askOp against a Theo op answer reports the real matched count from coverage.matched with source 'theo', instead of the {count:0, rows:[], degraded:true} sentinel."
    - "brainRoute builds its chain from command slugs when the envelope carries them, so /mos:act routes from a graph-grounded chain instead of silently falling through to the Tier-2 heuristic."
    - "An incumbent-shaped brain_ask response, and every error sentinel (egress_blocked, tier_denied, rate_limited, invalid_key, transport null), pass through byte-unchanged."
    - "The question text never appears anywhere in the composed envelope."
    - "A live Theo session proves the end-to-end path, and an unavailable Brain is recorded as a SKIP, never as a false PASS."
  artifacts:
    - path: "lib/core/brain-client.cjs"
      provides: "Theo-shape recognition in ask() and askOp(), plus the pure rung heuristic and the injectable composer"
      contains: "_inferRungFromQuestion"
    - path: "lib/core/directive-envelope.cjs"
      provides: "Named additive pass-through for grounding, third sibling of egress_disclosure and refusal"
      contains: "grounding"
    - path: "lib/core/part8-egress-guard.cjs"
      provides: "recommend_chain known-tool structural shape prover, exact keys plus closed rung enum"
      contains: "recommend_chain"
    - path: "tests/test-339-theo-ask-compose.cjs"
      provides: "Offline seven-arm fixture suite over the composer and the askOp normalizer"
      min_lines: 200
    - path: "tests/test-339-theo-ask-e2e-live.cjs"
      provides: "Live end-to-end smoke with an honest SKIP line when the Brain is unreachable"
      min_lines: 80
  key_links:
    - from: "lib/core/brain-client.cjs::ask"
      to: "lib/core/brain-client.cjs::_composeTheoAsk"
      via: "answer_mode structured_rows shape guard"
      pattern: "structured_rows"
    - from: "lib/core/brain-client.cjs::_composeTheoAsk"
      to: "recommendChain + query"
      via: "injectable deps parameter defaulting to the module's own wrappers"
      pattern: "USES_FRAMEWORK"
    - from: "lib/core/directive-envelope.cjs::wrapDirective"
      to: "envelope.grounding"
      via: "_copyIfPlainObject named additive attach"
      pattern: "brainResponse\\.grounding"
    - from: "lib/mcp/brain-router.cjs::brainRoute"
      to: "rawChain"
      via: "opt.commands pushed ahead of opt.framework"
      pattern: "opt\\.commands"
    - from: "lib/core/part8-egress-guard.cjs::_proveKnownToolShape"
      to: "recommend_chain payloads"
      via: "exact-keys plus rung enum, fail-closed on any extra key"
      pattern: "recommend_chain"
---

<objective>
Theo's `brain_ask` returns structured rows and nothing else: no `directive`, no `next_gate`, no
`mode_signals`. Every consumer downstream of it therefore degrades silently. `wrapDirective`
emits the empty GUIDED scaffold, the shim hands Larry an envelope with `framework: null`,
`brainRoute` finds no `next_gate` and falls through to the Tier-2 heuristic, `rs-chain-feeder`
finds no framework names and fails open, and larry-personality's thin-grounding clause fires on
every single Theo answer. `askOp` is broken in the same family: Theo op answers carry `coverage`,
never `count`, so the recognizer misses and returns `{count:0, rows:[], degraded:true}` over a
perfectly good three-row answer.

This plan closes the loop CLIENT-SIDE, at the one seam every surface already flows through. It
composes the DirectiveEnvelope's `directive` and `next_gate` from Theo's own graph: the rows Theo
returned, plus a `recommend_chain` call for the framework sequence, plus one label-anchored
`brain_query` for the `/mos:` commands that use those frameworks. It adds a `grounding` block so
thin footing becomes a MEASURED signal (empty `grounding.rows`) instead of a guess, and it makes
`brain_ask`'s own tool description say that honestly instead of promising harmless degradation.

Purpose: Larry stops improvising over a graph-grounded answer he was handed and could not read.
Output: a composed envelope, a fixed askOp, a routable `/mos:act` chain, and a live e2e smoke.

Tri-Polar: the shim serves CLI, Desktop and Cowork through the SAME brain-client, so this lands
on all three at once with zero surface-specific code. `brainRoute` is the CLI `/mos:act` leg only.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@lib/core/brain-client.cjs
@lib/core/directive-envelope.cjs
@bin/mindrian-brain-mcp-client.cjs
@lib/mcp/brain-router.cjs
@lib/core/part8-egress-guard.cjs
@lib/core/enrichment-queue.cjs
@tests/test-339-enrichment-theo-shapes.cjs
@tests/run-all-339.sh
@skills/larry-personality/SKILL.md
@docs/254-NOTE-theo-adaptation-list-additions.md
</context>

<measured_ground>
Verified live 2026-09-10. Do NOT re-derive any of this; it is the plan's factual floor.

| Fact | Value |
|------|-------|
| `ask(question)` raw payload | `{answer_mode:'structured_rows', rows:[8x {chapterId, section, score, snippet}], search_mode:'lexical', query_terms, effective_top_k, diagnostics}`. No `directive`, no `next_gate`, no `mode_signals`. |
| `askOp('list_frameworks',{limit:3})` raw | `{op, rows:[3x {name, category, alias_count}], coverage:{matched:3,total:452,status:'partial'}, diagnostics}`. Theo op answers NEVER carry `count`. |
| `recommend_chain({problem_type:'IllDefined',max_steps:4})` | `{problem_type, chain:[{step, framework, degree}], evidence:{...}, coverage:{matched:1,total:6,status:'partial'}, diagnostics}`. Unknown type -> SUCCESS with `chain:[]` plus `available_problem_types`. |
| Theo rung ids | `UnDefined`, `IllDefined`, `WellDefined`, `Wicked` (matched case-insensitively, and NOTHING more: no trimming, no hyphen folding, no fuzzy fallback). |
| `recommendChain()` wrapper | ALREADY CORRECT. It is a pure pass-through with zero reshaping (`brain-client.cjs:1879`), and `_normalizeBrainProblemType` already selects the Theo alias table by origin. `'IllDefined'` clears `PROBLEM_TYPE_HANDLE_RE`, is not a key in the Theo table, and passes through unchanged, which is exactly what Theo matches on. **Do NOT edit `recommendChain`.** `tests/test-c8j-brain-wire.cjs` Leg 6c pins its success payload byte-identical. |
| `classify_problem_type` | Takes NO parameters. The caller classifies. There is no free-text rung classifier anywhere in the plugin (`brain-derivation.cjs::classifyProblemType` scores MINTO triples, not text). Hence the local keyword heuristic in Task 1. |
| Command edges | 42 `(:MindrianCommand)-[:USES_FRAMEWORK]->(:Framework)` edges covering 40 of 113 commands and 21 frameworks. Command names are slugs like `/mos:find-bottlenecks`. |
| `KNOWN_METHODOLOGIES` | BARE command slugs (`lean-canvas`, `find-bottlenecks`, ...). Theo framework names ("Design Thinking") never normalize into them, which is exactly why `brainRoute` cannot route from framework names alone today. |
| Theo read allow-list | REFUSES `AllNodesScan`, `CartesianProduct`, `VarLengthExpand`, `ShortestPath`, `DirectedRelationshipTypeScan`. Every `brain_query` template MUST anchor on a node label and MUST NOT start from a relationship type. |
| `query()` return shape | Already normalizes Theo's `{rows, diagnostics}` to `{...result, records: rows}` (`brain-client.cjs:948`). Read `.records`. |
| `selectMode({})` | Returns `{mode:'GUIDED', rationale:'default_guided_pedagogical_canon'}`. Never `brain_unreachable` on a non-null response. |
| `callTool` egress belt | Blocks only a `block` verdict; `ambiguous` PROCEEDS with an `egress_disclosure`. The PreToolUse hook path is not in the shim's call path. |
| `run-all-339.sh` SKIP accounting | MEASURED GAP: `run_may_skip` (which honors a leading `SKIP` line) is wired to the `*.sh` glob ONLY. The `*.cjs` glob uses bare `run`, so a `.cjs` printing SKIP is counted **PASSED**. Task 3 closes this in one line. Zero existing `tests/test-339-*.cjs` emits a leading SKIP line, so no other arm's accounting flips. |
| `skills/larry-personality/SKILL.md` | MIRRORED into `dist/generic-claude-dir/` and `dist/zed/`. `run-all-339.sh` runs `build-dist-bundles.cjs --check-stale`, so editing the skill WITHOUT regenerating the bundles fails the runner. |
</measured_ground>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Compose the envelope inside brain-client, and fix askOp's coverage shape</name>
  <files>lib/core/brain-client.cjs</files>
  <behavior>
    - `_inferRungFromQuestion('what is the future of energy storage')` -> `'UnDefined'`
    - `_inferRungFromQuestion('how do we measure activation retention')` -> `'WellDefined'`
    - `_inferRungFromQuestion('our stakeholders disagree on values here')` -> `'Wicked'`
    - `_inferRungFromQuestion('which opportunity should we chase next')` -> `'IllDefined'`
    - `_inferRungFromQuestion('')` / non-string -> `'IllDefined'` (the stated default, never a throw)
    - `_normalizeAskOpResult({op, rows:[3], coverage:{matched:3,total:452}}, 'list_frameworks')` -> `count 3`, `source 'theo'`, `coverage` carried
    - `_normalizeAskOpResult({op, count:2, rows:[2]}, 'x')` -> unchanged incumbent shape, NO `source:'theo'`
    - `_normalizeAskOpResult({error:'tier_denied'}, 'x')` -> `{op:'x', count:0, rows:[], degraded:true}`
    - `_composeTheoAsk(theoPayload, question, deps)` -> `directive.guided.framework` set, `next_gate.options` populated with `commands`, `grounding.rows` present, `query_terms` gone
    - `_composeTheoAsk` with a `recommendChain` stub returning `{chain:[]}` -> `chain_status:'empty'`, `options:[]`, `grounding.rows` STILL present
    - `_composeTheoAsk` with a throwing `recommendChain` stub -> `chain_status:'unreachable'`, never a throw
  </behavior>
  <action>
Edit `lib/core/brain-client.cjs` only. Copy the dual-shape recognizer STRUCTURE from
`lib/core/enrichment-queue.cjs:458-540` (the ratified idiom: one entry point, arms keyed on payload
SHAPE never on key presence alone, a docblock naming every recognized shape).

**(a) Extract and widen the askOp recognizer.**
Add a pure helper `_normalizeAskOpResult(result, operation)` immediately above `askOp` (:1165), and
reduce `askOp`'s body to `return _normalizeAskOpResult(await callTool('brain_ask', {op: operation,
params: params || {}}), operation)` inside the existing try/catch. The helper's arms, in this order:

  1. INCUMBENT: `typeof result.count === 'number' && Array.isArray(result.rows)` -> the exact object
     `askOp` builds today (`op`, `source`, `count`, `rows`, conditional `degraded`). Byte-unchanged.
  2. THEO: `Array.isArray(result.rows)` -> `{op: result.op || operation, source: 'theo', count:
     <coverage.matched when it is a finite number, else result.rows.length>, rows: result.rows,
     coverage: <result.coverage when it is a plain object, else omitted>}`.
  3. Everything else (null, an `{error:...}` sentinel, a `{text:...}` passthrough, a non-array
     `rows`) -> the existing `{op: operation, count: 0, rows: [], degraded: true}` sentinel.

Arm 1 MUST stay first so an incumbent payload can never take arm 2. Degrade ONLY when `rows` is not
an array. Docblock the pair with the reason: Theo op answers carry `coverage`, never `count`, so a
`count`-keyed recognizer reads a live three-row answer as a degraded zero.

**(b) Add the pure rung heuristic.**
Add `_inferRungFromQuestion(question)` near the other pure helpers and add it to `module.exports`
(a NAMED export, per the locked design, not a `_test` member). Lowercase the trimmed question once,
then evaluate markers in this FIXED precedence and return the first hit:

  1. `Wicked`: `stakeholder`, `disagree`, `values`, `political`
  2. `UnDefined`: `future of`, `no boundary`, `unbounded`
  3. `WellDefined`: `measure`, `spec`, `test`, `kpi`, `how do we`
  4. `IllDefined`: `next big thing`, `which`, `should we`, `opportunity`
  5. default -> `IllDefined`

Precedence is load-bearing and must be commented as such: Wicked is the orthogonal
stakeholder-conflict axis and wins outright; UnDefined's markers are the least ambiguous of the
remaining three; IllDefined's markers are the broadest and are also the default, so they run last
and cost nothing when they lose. Multi-word markers match as substrings; single-word markers match
on a word boundary so `which` does not fire inside `whichever`. Non-string or empty input returns
`'IllDefined'` and NEVER throws. The function is PURE and LOCAL: it never sends the question
anywhere, which is the whole reason it exists (Theo's `classify_problem_type` takes no parameters,
so the caller has to classify, and there is no free-text classifier in this repo).

**(c) Add the composer.**
Add `async function _composeTheoAsk(payload, question, deps)` with
`deps = deps || {}; const recommend = deps.recommendChain || recommendChain; const runQuery =
deps.query || query;`. This deps seam is the injectable wire boundary Task 3 drives; it must default
to the module's own wrappers so production behaviour needs no injection. Do NOT duplicate
`recommendChain`, `query`, `feedsIntoChains` or `normalizeFrameworkName` (Canon Part 7, reuse before
build) and do NOT edit `recommendChain` (see `<measured_ground>`: it is already correct).

Steps, all inside one outer try/catch that returns a composed object rather than throwing:

  - `const rung = _inferRungFromQuestion(question);`
  - `const chainRes = await recommend(rung, 4);` wrapped in its own try/catch. Derive
    `chainStatus`: `'unreachable'` when `chainRes` is null, carries an `error` key, or its `chain`
    is not an array (also the catch branch); `'empty'` when `chain.length === 0`; else `'ok'`.
    `const steps = chainStatus === 'ok' ? chainRes.chain : [];`
  - COMMANDS, exactly ONE `runQuery` call, and only when `steps.length > 0`, in its own try/catch
    (on any failure every option gets `commands: []`):
    cypher `MATCH (f:Framework) WHERE f.name IN $names OPTIONAL MATCH (c:MindrianCommand)-[:USES_FRAMEWORK]->(f) RETURN f.name AS framework, collect(DISTINCT c.name) AS commands`
    params `{names: <the step framework names>}`. LABEL-ANCHORED and never relationship-first:
    Theo's read allow-list refuses `DirectedRelationshipTypeScan` and `AllNodesScan`, so a template
    that starts from `[:USES_FRAMEWORK]` is refused outright. Read `.records` (query() already
    normalizes Theo's `{rows}` to `records`). Build a Map framework -> slugs; each slug is the raw
    command name with a leading `/mos:` stripped; drop non-strings and empties (an OPTIONAL MATCH
    with no hit collects to `[]`, but guard anyway).
  - CONFIDENCE: `const top = <the maximum finite degree across steps>` (for Theo's descending
    output this equals `steps[0].degree`). Per step, when `top > 0` and `degree` is finite:
    `Math.round((0.5 + 0.4 * (degree / top)) * 100) / 100`, clamped into `[0.5, 0.9]`. A missing or
    non-finite degree -> `0.5`. The top step therefore reads exactly `0.9`.
  - RESULT: `const out = Object.assign({}, payload); delete out.query_terms;` then attach, in this
    order, `out.directive`, `out.next_gate`, `out.grounding`:
      - `directive: {guided: {questions: [], framework: (steps[0] && steps[0].framework) || null, stage: rung}}`
      - `next_gate: {sub_shape: 'F.1', options: steps.map(s => ({framework: s.framework, confidence: <computed>, commands: <from the Map, default []>}))}`
      - `grounding: {source: 'theo', answer_mode: payload.answer_mode, rows: <payload.rows projected to the FOUR named keys chapterId/section/score/snippet, non-object rows filtered out>, problem_type: rung, problem_type_source: 'heuristic', chain_coverage: <chainRes.coverage when a plain object, else null>, chain_status: chainStatus, confidence_source: 'theo_degree_normalized'}`
    `query_terms` is the ONLY key removed, and it is removed because it is the question's own words:
    the question is never echoed back into the envelope (Canon Part 8, and Task 3 arm 5 is the
    standing tripwire for any other echo path a future Theo payload might open). The row projection
    is by NAMED KEY, never a blind row copy, for the same reason plus shape stability. Any
    top-level `egress_disclosure` the Part 8 belt attached survives the `Object.assign` untouched.
    The outer catch returns the same object shape with `options: []` and `chain_status:
    'unreachable'`, so a rows response with a failed chain STILL returns `grounding`. NEVER throw.

**(d) Wire ask().**
In `ask(question)` (:1130), after `const raw = await callTool('brain_ask', {question: question});`,
return through this ladder and add nothing else:

  1. `raw == null` -> `return raw` (the transport-null contract, byte-locked across ~82 degradation
     tests; do not widen).
  2. `typeof raw !== 'object' || Array.isArray(raw)` -> `return raw`.
  3. `raw.error` present -> `return raw` UNCHANGED (`egress_blocked`, `tier_denied`,
     `rate_limited`, `invalid_key`). The shim's own `egress_blocked` branch at
     `bin/mindrian-brain-mcp-client.cjs:199` depends on this sentinel arriving intact.
  4. `raw.directive` present -> `return raw` BYTE-UNCHANGED, the SAME object reference, no copy.
     Presence of `directive` is the incumbent proof, per the locked design.
  5. `raw.answer_mode === 'structured_rows' && Array.isArray(raw.rows)` -> `return
     _composeTheoAsk(raw, question)`.
  6. anything else -> `return raw`.

Update `ask`'s docblock to name both shapes and the composition. Export `_inferRungFromQuestion`
publicly; add `_composeTheoAsk` and `_normalizeAskOpResult` to the existing `_test` block (:2340)
alongside `_parseBrainResult` and friends. Change no other export.

The extra wire calls carry ONLY a closed rung enum and framework names Theo itself returned (Canon
Part 8). No em-dashes; hyphens only.
  </action>
  <verify>
    <automated>node -e "const b=require('./lib/core/brain-client.cjs');const a=require('node:assert/strict');a.equal(b._inferRungFromQuestion('what is the future of energy storage'),'UnDefined');a.equal(b._inferRungFromQuestion('how do we measure activation retention'),'WellDefined');a.equal(b._inferRungFromQuestion('our stakeholders disagree on values here'),'Wicked');a.equal(b._inferRungFromQuestion('which opportunity should we chase next'),'IllDefined');a.equal(b._inferRungFromQuestion(''),'IllDefined');const n=b._test._normalizeAskOpResult;a.equal(n({op:'list_frameworks',rows:[{},{},{}],coverage:{matched:3,total:452,status:'partial'}},'list_frameworks').count,3);a.equal(n({op:'list_frameworks',rows:[{},{},{}],coverage:{matched:3}},'list_frameworks').source,'theo');a.equal(n({op:'x',count:2,rows:[{},{}]},'x').source,undefined);a.equal(n({error:'tier_denied'},'x').degraded,true);b._test._composeTheoAsk({answer_mode:'structured_rows',rows:[{chapterId:'c1',section:'s',score:1,snippet:'x'}],query_terms:['CANARYWORD'],search_mode:'lexical'},'which opportunity should we chase',{recommendChain:async()=>({problem_type:'IllDefined',chain:[{step:1,framework:'Design Thinking',degree:291},{step:2,framework:'Red Teaming',degree:189}],coverage:{matched:1,total:6,status:'partial'}}),query:async()=>({records:[{framework:'Design Thinking',commands:['/mos:diagnose']}]})}).then(o=>{a.equal(o.directive.guided.framework,'Design Thinking');a.equal(o.directive.guided.stage,'IllDefined');a.equal(o.next_gate.sub_shape,'F.1');a.equal(o.next_gate.options.length,2);a.deepEqual(o.next_gate.options[0].commands,['diagnose']);a.equal(o.next_gate.options[0].confidence,0.9);a.equal(o.next_gate.options[1].confidence,0.76);a.deepEqual(o.next_gate.options[1].commands,[]);a.equal(o.grounding.chain_status,'ok');a.equal(o.grounding.source,'theo');a.equal(o.grounding.rows.length,1);a.equal('query_terms' in o,false);a.equal(JSON.stringify(o).includes('CANARYWORD'),false);console.log('TASK1 OK')});"</automated>
  </verify>
  <done>`_inferRungFromQuestion` is a named export returning the four exact Theo rung ids with `IllDefined` as the default; `_normalizeAskOpResult` reports `count 3` / `source 'theo'` from `coverage.matched` while leaving the incumbent shape byte-identical; `_composeTheoAsk` emits `directive` + `next_gate` + `grounding` from injected stubs with zero network, drops `query_terms`, never echoes the question, and never throws; `ask()` passes incumbent and sentinel responses through unchanged. The verify command prints `TASK1 OK`.</done>
</task>

<task type="auto">
  <name>Task 2: Carry grounding through the envelope, route commands, prove the recommend_chain shape, and tell the truth in the description</name>
  <files>lib/core/directive-envelope.cjs, bin/mindrian-brain-mcp-client.cjs, lib/mcp/brain-router.cjs, lib/core/part8-egress-guard.cjs, skills/larry-personality/SKILL.md, dist/generic-claude-dir/.claude/skills/larry-personality/SKILL.md, dist/zed/.agents/skills/larry-personality/SKILL.md</files>
  <action>
Five consumer edits plus one regeneration. Each is small and independent; none re-opens Task 1.

**(a) `lib/core/directive-envelope.cjs` -- the third additive field.**
Directly after the `refusal` attach block (:207-211) in `wrapDirective`, add the exact same
two-line shape for `grounding`: `const grounding = _copyIfPlainObject(brainResponse.grounding); if
(grounding !== null) { envelope.grounding = grounding; }`. Extend the Phase 257 D-04 docblock
(:186-199) to name `grounding` as the third named additive field and to state WHY it is named and
never a generic top-level copy (an untyped copy would let arbitrary Brain-returned keys reach the
model, the leakage class `lib/mcp/no-instructions.test.cjs` exists to prevent). Note in the same
docblock that `_copyIfPlainObject` is a SHALLOW copy, so `grounding.rows` stays the same array
reference, exactly as `refusal.next_moves` already behaves. Absence must leave the seven keys and
their insertion order untouched: `tests/test-257-envelope-passthrough.cjs` Arm 3 pins that and must
stay green. This module keeps ZERO network surface: no require of brain-client, no fetch.

**(b) `bin/mindrian-brain-mcp-client.cjs` -- honest description.**
In the `brain_ask` `description` string (:168), delete the sentence "the envelope degrades
harmlessly to an empty signals set when the upstream response carries none" and replace it with
wording that matches what the envelope now actually does. Use exactly: "Returns a DirectiveEnvelope
whose directive and next_gate are composed from the graph-grounded rows behind the answer plus a
recommended framework chain; grounding.rows names the rows the answer stands on, and an empty
grounding.rows means thin footing, not a clean answer." Leave the first and last sentences of the
description untouched. This is safe: the file's own header comment (:110-114) records that release
gate 19 checks tool NAMES against hooks.json matchers and agent allowed-tools, never descriptions.
Change nothing else in the handler; the `egress_blocked` and `raw == null` branches stay as they
are, and `signals` still reads `raw.mode_signals` (Theo emits none, so `selectMode({})` yields
`default_guided_pedagogical_canon`, which is the correct non-outage rationale).

**(c) `lib/mcp/brain-router.cjs` -- route from command slugs.**
Inside `brainRoute`'s options loop (:355-359), before the existing `opt.framework` push, add: when
`Array.isArray(opt.commands)`, push each string slug that is non-empty and not already in
`rawChain`. Then push `opt.framework` exactly as today. Everything else in `brainRoute` is
unchanged, including the anchor-first push, the `_lastBrainRouteMissNote` handling, the
`.slice(0, 4)` cap and the `topConf` derivation. Comment the reason with the measured fact:
`KNOWN_METHODOLOGIES` holds BARE command slugs, so a Theo framework name like "Design Thinking"
normalizes to `designthinking` and matches nothing, while a slug like `find-bottlenecks` matches
itself exactly. Add a second comment noting that the Phase 339 D-03b `BRAIN_ROUTE_NOTE_NO_NEXT_GATE`
disclosure now stops firing on the Theo path because the envelope carries `next_gate` again: that is
the INTENDED outcome of this quick task, not a regression, and the disclosure stays in place for
any origin that still returns no `next_gate`.

**(d) `lib/core/part8-egress-guard.cjs` -- prove the recommend_chain shape.**
Add a frozen `RECOMMEND_CHAIN_PROBLEM_TYPES` Set next to `TAXONOMY_RUNGS` (:328) holding the UNION
of the incumbent canonical rung strings (`Undefined Problem`, `Ill-Defined Problem`, `Well-Defined
Problem`) and Theo's ids (`UnDefined`, `IllDefined`, `WellDefined`, `Wicked`). Add a
`recommend_chain` arm to `_proveKnownToolShape`, after the `taxonomy_ladder` arm: require
`_hasExactKeys(payload, ['problem_type', 'max_steps'], [])` (BOTH required, ZERO optional -- the
`recommendChain` wrapper always sends both, and an empty optional list is what makes this
fail-closed on any extra key), then `typeof payload.problem_type === 'string' &&
RECOMMEND_CHAIN_PROBLEM_TYPES.has(payload.problem_type)`, then `Number.isInteger(payload.max_steps)
&& max_steps >= 1 && max_steps <= 6`. Return `{class: 'known_tool_shape', reason: 'recommend_chain
problem_type enum'}`. Note in the arm's comment that `_normalizeBrainProblemType` passes any
well-shaped unmapped token THROUGH unchanged, so an off-enum value (say `Trinity`) falls out of this
arm to the terminal catch-all as `ambiguous`, which PROCEEDS with a disclosure rather than blocking:
this change strictly NARROWS what is ambiguous and never widens what may carry content. Do not
touch step 1's default-deny scan and do not move this branch earlier in `classify` -- the arm's own
docblock (:410-416) states that both are what make it boundary-neutral.

**(e) `skills/larry-personality/SKILL.md` -- one added sentence, and one stale quote repaired.**
In the "Honest about thin grounding" clause (:390-416), the trigger paragraph currently QUOTES the
old `brain_ask` description verbatim ("the tool's own description says the envelope 'degrades
harmlessly to an empty signals set when the upstream response carries none'"). Step (b) deletes that
string, so leaving the quote turns it into a second source of truth pointing at text that no longer
exists. Repoint it to the new description, and add ONE sentence naming an empty `grounding.rows` as
a thin signal, in the existing register: capability honesty, no backend noun, no architecture
disclosure. The clause's signal-driven framing (not a hardcoded roster of tool names) stays intact,
and the existing `normalize_framework_name` and `orchestration_readiness` signals stay listed.
Then regenerate the mirrors with `node scripts/build-dist-bundles.cjs` (no flags) so
`--check-stale` passes: `run-all-339.sh` runs that check and the skill is mirrored into
`dist/generic-claude-dir/` and `dist/zed/`.

No em-dashes in any of the five files; hyphens only.
  </action>
  <verify>
    <automated>node tests/test-257-envelope-passthrough.cjs && node -e "const {wrapDirective}=require('./lib/core/directive-envelope.cjs');const a=require('node:assert/strict');const e=wrapDirective({directive:{guided:{questions:[],framework:'Design Thinking',stage:'IllDefined'}},next_gate:{sub_shape:'F.1',options:[{framework:'Design Thinking',confidence:0.9,commands:['diagnose']}]},grounding:{source:'theo',rows:[{chapterId:'c1'}],chain_status:'ok'}},{});a.equal(e.grounding.source,'theo');a.equal(e.grounding.rows.length,1);a.equal(Object.keys(wrapDirective({},{})).length,7);const g=require('./lib/core/part8-egress-guard.cjs');a.equal(g.classify({problem_type:'IllDefined',max_steps:4},{toolName:'recommend_chain'}).verdict,'allow');a.equal(g.classify({problem_type:'Undefined Problem',max_steps:6},{toolName:'recommend_chain'}).verdict,'allow');a.equal(g.classify({problem_type:'IllDefined',max_steps:4,note:'x'},{toolName:'recommend_chain'}).verdict,'ambiguous');a.equal(g.classify({problem_type:'Trinity',max_steps:4},{toolName:'recommend_chain'}).verdict,'ambiguous');a.equal(g.classify({problem_type:'IllDefined',max_steps:9},{toolName:'recommend_chain'}).verdict,'ambiguous');const src=require('node:fs').readFileSync('lib/mcp/brain-router.cjs','utf8');a.ok(src.includes('opt.commands'));a.equal(require('node:fs').readFileSync('bin/mindrian-brain-mcp-client.cjs','utf8').includes('degrades harmlessly'),false);a.equal(require('node:fs').readFileSync('skills/larry-personality/SKILL.md','utf8').includes('grounding.rows'),true);console.log('TASK2 OK');" && node scripts/build-dist-bundles.cjs --check-stale && node tests/test-254-normalize-roundtrip-probe.cjs && node lib/core/rs-chain-feeder.test.cjs 2>/dev/null || true</automated>
  </verify>
  <done>`wrapDirective` carries `grounding` additively while an absent `grounding` still yields exactly seven keys in order (test-257 Arm 3 green); `classify` returns `allow` for both vocabularies' well-formed `recommend_chain` payloads and `ambiguous` for an extra key, an off-enum rung, or an out-of-range `max_steps`; `brainRoute` reads `opt.commands`; the `brain_ask` description no longer contains "degrades harmlessly"; the larry-personality clause names `grounding.rows` and no longer quotes the deleted sentence; `build-dist-bundles.cjs --check-stale` exits 0. The verify command prints `TASK2 OK`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Offline fixture suite, live e2e smoke, and honest SKIP accounting</name>
  <files>tests/test-339-theo-ask-compose.cjs, tests/test-339-theo-ask-e2e-live.cjs, tests/run-all-339.sh</files>
  <behavior>
    - Arm 1: Theo rows + stubbed `recommendChain`/`query` -> `directive.guided.framework` set, `next_gate.options[].commands` populated, `grounding.rows` present
    - Arm 2: an incumbent-shaped response through `ask()` passes through byte-unchanged (same reference)
    - Arm 3: `{error:'egress_blocked'}` and a transport `null` pass through unchanged
    - Arm 4: `recommend_chain` returning `{chain:[]}` -> `chain_status:'empty'`, `options:[]`, `grounding.rows` still present
    - Arm 5 (Part 8): the question string appears nowhere in `JSON.stringify(composed)`
    - Arm 6: askOp Theo shape -> `count` from `coverage.matched`, `source:'theo'`
    - Arm 7: askOp incumbent shape -> unchanged, no `source:'theo'`
    - Live: `isAvailable()` false -> a leading `SKIP` line and exit 0; true -> the full end-to-end assertion set
  </behavior>
  <action>
Write the fixtures from the CONTRACT stated in Tasks 1 and 2, NOT by reading the shipped
implementation. Copy the file idiom from `tests/test-339-enrichment-theo-shapes.cjs`: `node:test`,
CJS, `node:assert/strict` and node built-ins only, zero new deps, a header docblock that states each
arm's property in one sentence, and the standing rule that a fixture keys on PAYLOAD SHAPE and
closed enum values, never on prose text.

**(a) `tests/test-339-theo-ask-compose.cjs` -- seven offline arms, zero network.**
Drive `brainClient._test._composeTheoAsk`, `brainClient.ask`, and
`brainClient._test._normalizeAskOpResult` directly. The wire seam is the `deps` parameter from Task
1(c) (`{recommendChain, query}`); NEVER open a socket and never require a live key.

  - Arm 1: payload `{answer_mode:'structured_rows', rows:[3 rows of {chapterId, section, score,
    snippet}], search_mode:'lexical', query_terms:[...], effective_top_k, diagnostics}`, stub
    `recommendChain` with Theo's real four-step shape (Design Thinking 291, Disruptive Innovation
    255, Red Teaming 239, Creative Destruction 189) and `query` with `records` carrying `/mos:`
    prefixed command names for two of the four. Assert: `directive.guided.framework === 'Design
    Thinking'`, `directive.guided.stage` is one of the four rung ids, `next_gate.sub_shape ===
    'F.1'`, four options, the leading option's `commands` are slugs with `/mos:` STRIPPED, options
    with no edges carry `[]`, every `confidence` is within `[0.5, 0.9]` and non-increasing, the top
    option is exactly `0.9`, `grounding.rows.length === 3` with only the four named keys per row,
    `grounding.problem_type_source === 'heuristic'`, `grounding.confidence_source ===
    'theo_degree_normalized'`, `grounding.chain_status === 'ok'`. Also assert the `query` stub was
    called EXACTLY ONCE (one wire call for commands, per the locked design) and that its cypher
    starts with `MATCH (f:Framework)` and never contains `[:USES_FRAMEWORK]` before a node label
    (Theo's read allow-list refuses a relationship-first scan).
  - Arm 2: `ask()` against an incumbent-shaped response (carrying `directive`). Stub the wire
    through the `_test` seam or by monkey-patching the module's `callTool` export before the call,
    whichever the repo idiom supports without a network; assert the returned value is the SAME
    object reference, deep-equal to the input, and gained no `grounding` key.
  - Arm 3: `{error:'egress_blocked', tool:'brain_ask', egress_class:'content_set'}` and a `null`
    both return unchanged. Assert the sentinel object still deep-equals its input, since
    `bin/mindrian-brain-mcp-client.cjs:199` keys on `raw.error === 'egress_blocked'`.
  - Arm 4: `recommendChain` stub returns `{problem_type, chain:[], available_problem_types:[...],
    coverage:{matched:0,total:6,status:'empty'}}`. Assert `grounding.chain_status === 'empty'`,
    `next_gate.options` is `[]`, `directive.guided.framework` is `null`, and `grounding.rows` is
    STILL populated. Add a second leg where the stub THROWS: assert `chain_status ===
    'unreachable'`, no exception escapes, and `grounding.rows` is still populated.
  - Arm 5 (Canon Part 8): use a distinctive multi-word question containing a canary token, run
    Arm 1's composition with a payload whose `query_terms` AND `diagnostics` both carry the canary,
    and assert `JSON.stringify(composed)` does not contain the question string OR the canary. This
    arm is the standing tripwire: `_composeTheoAsk` strips `query_terms` and nothing else, so if a
    future Theo payload echoes the question through any other key this arm fails instead of
    shipping. State that intent in the arm's comment.
  - Arms 6 and 7: `_normalizeAskOpResult` against Theo's `{op, rows:[3], coverage:{matched:3,
    total:452, status:'partial'}}` (assert `count === 3`, `source === 'theo'`, `coverage` carried,
    NO `degraded`) and against the incumbent `{op, count, rows, source}` (assert byte-identical to
    today's output and NO `source:'theo'` overwrite). Add a third leg: `rows` present but not an
    array -> the degraded sentinel.

Prove NON-VACUITY before committing: for arms 1, 4, 5 and 6, temporarily break the corresponding
production branch in a scratch edit, confirm the assertion FAILS, then revert. An assertion that
cannot fail is the false-success shape this repo already has an open watch on. Record in the summary
which four mutations were run and that each failed as expected.

**(b) `tests/test-339-theo-ask-e2e-live.cjs` -- the live smoke.**
First statement after the requires: if `brainClient.isAvailable()` is false, `console.log('SKIP:
Brain not available (no key or unreachable); live e2e not run')` and `process.exit(0)`. The SKIP
line must be the FIRST line of stdout so the runner's `run_may_skip` recognizes it. Otherwise call
`ask()` LIVE with a generic methodology question (framework handles only, never user content -- Canon
Part 8), wrap the result with `wrapDirective(raw, raw.mode_signals || {})`, and assert:
`directive.guided.framework` is a non-empty string, `next_gate.options.length > 0`,
`grounding.rows.length > 0`, `mode_rationale !== 'brain_unreachable'`, and that the brainRoute-
equivalent slug mapping (lowercase, strip to `[a-z-]`, match against `brain-router.cjs`'s
`KNOWN_METHODOLOGIES`) yields at least one KNOWN_METHODOLOGIES slug OR, when it does not, prints an
explicit coverage line naming how many of the returned frameworks had zero command edges. Honest
coverage reporting, never a silent pass. Import `KNOWN_METHODOLOGIES` if it is exported; if it is
not, re-derive the mapping locally and say so in a comment rather than adding a new export.

**(c) `tests/run-all-339.sh` -- one line, so SKIP is real.**
In the `*.cjs` discovery loop, change `run "$(basename "$t")" node "$t"` to
`run_may_skip "$(basename "$t")" node "$t"`. MEASURED REASON, put it in a comment above the loop:
`run_may_skip` was wired to the `*.sh` glob only, so a `.cjs` test printing a leading SKIP line was
counted PASSED -- a green report over a gate that never ran, which is exactly the false-success
disease this runner's own header says it exists to close. Zero existing `tests/test-339-*.cjs`
emits a leading SKIP line (verified by grep at authoring time), so no other arm's accounting flips.
Change nothing else in the runner: discovery stays glob-based, the `found -eq 0` guard stays, and
the em-dash fence picks up both new files automatically through `DISCOVERED_TEST_FILES`.

No em-dashes in any of the three files; hyphens only.
  </action>
  <verify>
    <automated>node tests/test-339-theo-ask-compose.cjs && bash tests/run-all-339.sh && bash tests/run-all-127.sh && node tests/test-257-envelope-passthrough.cjs && node tests/test-254-normalize-roundtrip-probe.cjs && node scripts/doctor.cjs --acceptance</automated>
    <human-check>Run `bash tests/run-all-257.sh` and record its result in the SUMMARY. ONE pre-existing unrelated failure is expected (Plan 08 strict input shapes): record it, do NOT fix it. Any SECOND failure is caused by this task and must be fixed. Also confirm `tests/test-339-theo-ask-e2e-live.cjs` reported PASSED (live Theo reachable) or SKIPPED (not reachable) in the run-all-339 output, and never PASSED-while-skipped.</human-check>
  </verify>
  <done>`tests/test-339-theo-ask-compose.cjs` passes all seven arms offline with zero network, and four of them were proven non-vacuous by scratch mutation; `tests/test-339-theo-ask-e2e-live.cjs` either passes live or emits a leading SKIP line that `run-all-339.sh` now counts as SKIPPED; `bash tests/run-all-339.sh`, `bash tests/run-all-127.sh`, `node tests/test-257-envelope-passthrough.cjs`, `node tests/test-254-normalize-roundtrip-probe.cjs` and `node scripts/doctor.cjs --acceptance` all pass; `bash tests/run-all-257.sh` shows exactly the one pre-existing Plan 08 failure and nothing new.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin -> Brain (Theo) | Canon Part 8 LOCAL-to-BRAIN egress. This task ADDS two wire calls per `brain_ask` (`recommend_chain` and one `brain_query`), so the boundary widens by two payloads and must be proven for both. |
| Theo -> DirectiveEnvelope -> model | Brain-returned bytes reaching Larry. `wrapDirective` gains a third named additive field; an untyped copy here would let arbitrary Brain keys reach the model. |
| question string -> composed envelope | The user's own question is LOCAL data. It must never round-trip back into an artifact the model or a room consumes. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-hni-01 | Information Disclosure | `_composeTheoAsk` -> `recommend_chain` | mitigate | Only `_inferRungFromQuestion`'s output crosses: a closed four-value enum derived locally, never the question. Task 2(d) adds the exact-keys plus enum shape prover so an off-shape payload cannot ride this path as `allow`. |
| T-hni-02 | Information Disclosure | `_composeTheoAsk` -> `brain_query` | mitigate | The cypher is a frozen literal; `$names` carries only framework names Theo itself just returned. `query()`'s own Part 8 backstop plus `callTool`'s belt both classify it; an `ambiguous` verdict proceeds with a disclosure that now survives into the envelope. |
| T-hni-03 | Information Disclosure | composed envelope | mitigate | `query_terms` (the question's own words) is deleted, rows are projected by four NAMED keys never blind-copied, and Task 3 arm 5 asserts the question and a canary appear nowhere in `JSON.stringify(composed)`. |
| T-hni-04 | Tampering | `wrapDirective` additive field | mitigate | `grounding` is attached BY NAME through `_copyIfPlainObject`, never by a generic top-level-field copy. Absence keeps the exact seven-key insertion order (test-257 Arm 3). |
| T-hni-05 | Spoofing | `askOp` shape recognizer | mitigate | The incumbent arm runs FIRST and the Theo arm requires `Array.isArray(rows)`, so a malformed or hostile payload without an array `rows` falls to the degraded sentinel rather than minting a fake count. |
| T-hni-06 | Repudiation | thin-grounding honesty | mitigate | `grounding.rows` makes footing MEASURED rather than inferred; the `brain_ask` description and the larry-personality clause are updated together so no surface promises harmless degradation the code no longer performs (Decision #8). |
| T-hni-07 | Denial of Service | two extra wire calls per ask | accept | Both reuse `callTool`'s existing retry, rate-limit and session-cache machinery. `recommend_chain` is capped at 4 steps and the command query is a single call over at most 4 names. No new unbounded loop. |
| T-hni-08 | Tampering | test suite green over a gate that never ran | mitigate | Task 3(c) makes `run_may_skip` cover the `.cjs` glob so a skipped live e2e reports SKIPPED, not PASSED; arms 1/4/5/6 are proven non-vacuous by scratch mutation. |
| T-hni-SC | Tampering | npm/pip/cargo installs | mitigate | NOT APPLICABLE: this task installs zero packages. Node built-ins and existing repo modules only, per the CJS/no-new-deps convention. |
</threat_model>

<verification>
Run in this order after the last task:

1. `node tests/test-339-theo-ask-compose.cjs` -- the seven offline arms.
2. `bash tests/run-all-339.sh` -- discovers both new files by glob, runs the em-dash fence over
   them, runs the skill-mirror and dist-bundle staleness gates, and now reports the live e2e as
   SKIPPED rather than PASSED when the Brain is unreachable.
3. `bash tests/run-all-127.sh` -- the DirectiveEnvelope's own runner, including its no-em-dash arm.
4. `node tests/test-257-envelope-passthrough.cjs` -- Arm 3 pins the exact seven-key insertion order.
5. `node tests/test-254-normalize-roundtrip-probe.cjs` -- Arms 4-5 pin the two alias tables. The
   aliases are ALREADY re-pointed; this task does no alias work and this run only proves it.
6. `bash tests/run-all-257.sh` -- ONE pre-existing unrelated failure expected (Plan 08 strict input
   shapes). Record it in the SUMMARY, do not fix it. A second failure belongs to this task.
7. `node scripts/doctor.cjs --acceptance` -- the acceptance roll-up.

Do NOT touch: the two alias tables, `THEO_ORIGINS`, the origin-keyed selector, `recommendChain`,
`callTool`'s egress belt, or `hooks/hooks.json` matchers. `lib/core/rs-chain-feeder.cjs:194-240`
is a second consumer of `next_gate.options[].framework` and must keep working UNCHANGED: it now
receives real framework names instead of an empty list, which is a strict improvement, and no edit
to that file is in scope.
</verification>

<success_criteria>
- A live `brain_ask` through the shim returns an envelope with a non-null
  `directive.guided.framework`, at least one `next_gate.options` entry, and non-empty
  `grounding.rows`, with `mode_rationale` reading `default_guided_pedagogical_canon`.
- `askOp('list_frameworks', {limit:3})` reports `count: 3` with `source: 'theo'` and a carried
  `coverage`, instead of the degraded zero.
- `brainRoute` builds a chain from command slugs when the envelope carries them.
- Incumbent responses and every error sentinel are byte-unchanged; `wrapDirective` with no
  additive field still returns exactly seven keys in order.
- The question text appears nowhere in the composed envelope.
- All seven verification commands above pass, with the single recorded pre-existing 257 failure.
- Zero em-dashes across every touched file.
</success_criteria>

<output>
Create `.planning/quick/260910-hni-theo-e2e-compose-brain-ask-directiveenve/260910-hni-SUMMARY.md` when done.

Every commit message ends with these two lines:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HBgMttGjUp3zcYdCJkn3Zv
```
</output>
