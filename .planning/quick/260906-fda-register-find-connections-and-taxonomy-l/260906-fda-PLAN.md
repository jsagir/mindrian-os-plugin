---
phase: quick-260906-fda
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/part8-egress-guard.cjs
  - lib/core/refusal-messaging.cjs
  - tests/test-260906-fda-known-tool-shapes.cjs
autonomous: true
requirements: [QUICK-260906-FDA-01, QUICK-260906-FDA-02, QUICK-260906-FDA-03]

must_haves:
  truths:
    - "A find_connections call carrying exactly {from, to} (and optionally maxHops) under a Brain-scoped find_connections tool name classifies as allow, not ambiguous."
    - "A taxonomy_ladder call carrying {rung} from the four-value enum (and optionally question_label) under a Brain-scoped taxonomy_ladder tool name classifies as allow, not ambiguous."
    - "The exact same payload shape arriving under any OTHER tool name (brain_query, find_bottlenecks, Write, empty string) does NOT reach the new allow path and still classifies as ambiguous."
    - "A payload of either shape whose string fields carry Canon FORBIDDEN_PATTERNS content still classifies as block / content_set, because step 1 returns before the new recognizer is ever consulted; the new recognizer's own per-field audit independently returns no-proof for the same payload."
    - "Any key the encoded shape does not name, any missing required key, any wrong-typed value, any multi-line or over-long label, and any off-enum rung all fall through to the UNCHANGED terminal catch-all as ambiguous."
    - "Every verdict the guard shipped before this change is byte-identical after it: {} allow/empty_payload, {a:1} ambiguous/unknown, a brain_ask methodology question allow/move_set, a content-carrying brain_query block/content_set."
    - "The new recognizer sits LAST in classify()'s fallthrough chain, after steps 1, 1b, 2 and 3, so it can only convert a would-be catch-all ambiguous into an allow and can never shadow or preempt an existing block."
  artifacts:
    - path: "lib/core/part8-egress-guard.cjs"
      provides: "_proveKnownToolShape plus its supporting helpers and the step 3b wiring in classify()"
      exports: ["classify", "_proveKnownToolShape", "_isSafeShortLabel", "_hasExactKeys", "TAXONOMY_RUNGS"]
      contains: "_proveKnownToolShape"
    - path: "tests/test-260906-fda-known-tool-shapes.cjs"
      provides: "Unit leg over classify() plus a child-process hook leg, covering the happy path, the wrong-tool-name negative, the step-1-still-wins smuggling negative, the drift negatives, and the no-regression re-assertions"
      min_lines: 200
  key_links:
    - from: "lib/core/part8-egress-guard.cjs classify()"
      to: "_proveKnownToolShape"
      via: "step 3b, placed immediately before the terminal catch-all return"
      pattern: "_proveKnownToolShape\\(payload, toolName\\)"
    - from: "lib/core/part8-egress-guard.cjs _proveKnownToolShape"
      to: "_safeAudit"
      via: "per-field default-deny re-audit of every string field (the _proveMoveSet handleFields precedent)"
      pattern: "_safeAudit"
    - from: "lib/core/refusal-messaging.cjs EGRESS_CLASS_SET"
      to: "the new known_tool_shape class slug"
      via: "closed-vocabulary parity with classify()"
      pattern: "known_tool_shape"
---

<objective>
Close a real gap in the Part 8 runtime gate: classify() today has NO positive recognizer for a
payload that is non-empty, non-packet, and not a brain_ask-family free-form string, no matter how
structurally safe that payload's own tool schema documents it to be. Two live Brain tools sit in
that hole, find_connections and taxonomy_ladder, and both gate as ambiguous the moment they are
called with real arguments. (find_bottlenecks and find_whitespace only appeared to work in live
testing because they happened to be called with a fully empty payload, which trips step 1b's
_isProvablyEmptyPayload. Confirmed live: find_bottlenecks WITH a limit argument gates ambiguous
too. There is no tool-name allowlist anywhere in this file to add an entry to.)

Purpose: a constitutional gate that blocks structurally content-free methodology calls is a false
positive, and a false positive on the Brain path is exactly what the Phase 245-03 contentless fix
and the quick 260807-h5s brain_search widening each existed to remove. This is the third instance
of the same class, closed the same way: a NEW POSITIVE PROOF placed after the default-deny scan,
never a relaxed default.

Output: one new tool-name-scoped structural recognizer in lib/core/part8-egress-guard.cjs wired as
step 3b, a docblock carrying the boundary-neutrality argument in the same voice and rigor as the
shipped _isFreeFormTool docblock, a one-line closed-vocabulary parity update in
refusal-messaging.cjs, and a two-leg test file that proves the recognizer cannot be used to smuggle
anything past step 1.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/core/part8-egress-guard.cjs
@tests/test-245-egress-contentless.cjs
@scripts/part8-egress-guard-hook.cjs

Interface facts already established by reading, so the executor does not have to re-derive them:

- classify(payload, {toolName}) returns {verdict, class, reason}. verdict is 'allow' | 'block' |
  'ambiguous'. The current fallthrough order is: non-object early return, step 1 scanForContent
  (block on hit), step 1b _isProvablyEmptyPayload (allow), step 2 _looksLikePacket ->
  _proveMoveSet (allow or ambiguous, always returns), step 3 _isFreeFormTool (may return, may fall
  through when no free-form key is present), step 4 terminal catch-all
  {verdict:'ambiguous', class:'unknown', reason:'neither proven move-set nor content hit'}.
- _safeAudit(str) -> boolean. True when the string clears egress.auditQueryString. False for a
  non-string, an empty string, or any ExternalEgressViolation.
- The Canon FORBIDDEN_PATTERNS set that step 1 enforces (via auditQueryObject's JSON.stringify
  sweep of the WHOLE payload) is defined in lib/core/cross-room-aggregator.cjs and re-exported
  byte-for-byte by lib/core/rs-egress-prompts.cjs. It catches: email, currency magnitude with a
  leading $, bare financial magnitude (2.3M / 140K), percent metric, financial idiom (Series A,
  ARR, MRR, burn rate, runway, Nx growth), quoted-person, "meeting with", SSN-like, phone-like,
  name + degree (two spellings), user-count metric, meeting/verbatim prose (meeting transcript,
  standup, board notes, board meeting, the customer wrote, the investor emailed), venture
  proper-noun (Acme Corp, Nimbus Robotics), and an identifying-location gazetteer.
- _isFreeFormTool scopes by SUBSTRING (toolName.indexOf('brain_ask') !== -1), because the live
  names are plugin-scoped, e.g. mcp__plugin_mos_mindrian-brain__brain_ask. The new recognizer
  follows the same convention.
- scripts/part8-egress-guard-hook.cjs calls sanitizer.isBrainTool(toolName) BEFORE classify(); a
  bare (unscoped) tool name allows vacuously at the hook, so the hook leg of the test must use
  scoped names derived from scripts/check-brain-tool-liveness.cjs, exactly as
  tests/test-245-egress-contentless.cjs does. The hook honors PART8_FORCE_BRAIN_AVAILABLE.
- lib/core/refusal-messaging.cjs holds EGRESS_CLASS_SET, a closed mirror of classify()'s class
  vocabulary (currently content_set, empty_payload, move_set, unproven_packet, freeform_unmatched,
  unknown). Nothing switches on class for control flow; the set exists so an unrecognized class
  coerces to 'unknown' in a refusal reason string.
- There is NO local copy of the find_connections or taxonomy_ladder input schema in this repo.
  data/brain-surface-contract.json lists both as non-contract tools with no args recorded. The arg
  names below come from the live tool schemas. The exact-key-set design makes an arg-name mismatch
  FAIL-CLOSED: the recognizer declines and the call keeps gating as ambiguous, exactly as today.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add the tool-name-scoped structural recognizer as classify() step 3b</name>
  <files>lib/core/part8-egress-guard.cjs, lib/core/refusal-messaging.cjs</files>
  <behavior>
    - classify({from:'Design Thinking', to:'SWOT'}, {toolName:'mcp__plugin_mos_mindrian-brain__find_connections'}) returns verdict 'allow', class 'known_tool_shape'.
    - classify({from:'Design Thinking', to:'SWOT', maxHops:3}, same tool) returns verdict 'allow'.
    - classify({rung:'wicked'}, {toolName:'mcp__plugin_mos_mindrian-brain__taxonomy_ladder'}) returns verdict 'allow', class 'known_tool_shape'.
    - classify({rung:'ill-defined', question_label:'framework sequencing'}, same tool) returns verdict 'allow'.
    - classify({from:'Design Thinking', to:'SWOT'}, {toolName:'mcp__plugin_mos_mindrian-brain__brain_query'}) returns verdict 'ambiguous'.
    - classify({from:'jane@startup.com', to:'SWOT'}, scoped find_connections) returns verdict 'block', class 'content_set'.
    - _proveKnownToolShape({from:'jane@startup.com', to:'SWOT'}, scoped find_connections) returns null on its own, without relying on step 1 having run.
    - classify({from:'a', to:'b', depth:2}, scoped find_connections) returns verdict 'ambiguous', class 'unknown'.
    - classify({rung:'sort-of-wicked'}, scoped taxonomy_ladder) returns verdict 'ambiguous', class 'unknown'.
    - classify({}, anything) still returns allow / empty_payload; classify({a:1}, anything) still returns ambiguous / unknown.
  </behavior>
  <action>
Add to lib/core/part8-egress-guard.cjs, above classify(), a new module-scope constant block and a
new recognizer. Do NOT touch scanForContent, _safeAudit's body, rs-egress-prompts.cjs, or the Canon
FORBIDDEN_PATTERNS set. Do NOT reorder any existing branch inside classify().

Constants to declare:
  TAXONOMY_RUNGS, an Object.freeze'd Set of exactly the four literal strings 'undefined',
  'ill-defined', 'well-defined', 'wicked'. Use a frozen Set built once at module scope.
  KNOWN_LABEL_MAX, the integer 120.

Helper _isSafeShortLabel(v) -> boolean. Returns true only when v is a string, its length is at
least 1 and at most KNOWN_LABEL_MAX, it contains no carriage return and no line feed, and
_safeAudit(v) returns true. Every other input returns false. The length-and-single-line bound is
the "this is a node label, not prose" hygiene constraint; document in a short comment that it is
NOT the content defense (step 1 is), it is what keeps this recognizer from being usable as a bulk
free-text channel by content that happens to dodge every forbidden pattern.

Helper _hasExactKeys(payload, required, optional) -> boolean. Returns true only when every string
in required is an OWN key of payload (Object.prototype.hasOwnProperty.call), and every own key of
payload appears in required or in optional. Anything else returns false. This is what makes the
recognizer fail-closed on tool-schema drift: an argument name this file does not know about means
no proof, which means the call keeps gating as ambiguous exactly as it does today.

Helper _proveKnownToolShape(payload, toolName) -> null | {class, reason}. Guard first: if toolName
is not a string, return null. Then two tool-name-scoped branches, using the same substring
convention _isFreeFormTool uses so plugin-scoped MCP names match:

  Branch A, when toolName.indexOf('find_connections') !== -1. Require
  _hasExactKeys(payload, ['from','to'], ['maxHops']). Require _isSafeShortLabel(payload.from) and
  _isSafeShortLabel(payload.to). If 'maxHops' is an own key, require Number.isInteger(payload.maxHops)
  and payload.maxHops >= 1. On all-pass return
  {class: 'known_tool_shape', reason: 'find_connections from/to label pair'}; otherwise return null.

  Branch B, when toolName.indexOf('taxonomy_ladder') !== -1. Require
  _hasExactKeys(payload, ['rung'], ['question_label']). Require typeof payload.rung === 'string'
  and TAXONOMY_RUNGS.has(payload.rung). If 'question_label' is an own key, require
  _isSafeShortLabel(payload.question_label). On all-pass return
  {class: 'known_tool_shape', reason: 'taxonomy_ladder rung enum'}; otherwise return null.

  Neither branch matched, or a branch matched and failed its shape test: return null. Never throw.

Wire it into classify() as step 3b, placed AFTER the existing step 3 free-form block and
IMMEDIATELY BEFORE the terminal catch-all return, as: if the result of
_proveKnownToolShape(payload, toolName) is truthy, return
{verdict:'allow', class: proof.class, reason: proof.reason}.

Update the classify() header docblock's numbered summary to name the new step 3b in the same terse
style the existing 1 / 1b / 2 / 3 / 4 lines use, and renumber the existing terminal item to stay
last.

Add _proveKnownToolShape, _isSafeShortLabel, _hasExactKeys and TAXONOMY_RUNGS to module.exports
alongside the existing test seams.

THE DOCBLOCK. Directly above _proveKnownToolShape, write a docblock in the same voice and at the
same rigor as the shipped _isFreeFormTool docblock (which is the precedent this widening must make
for itself, in writing, the same way). It must state, in this order and without hedging:

  1. PLACEMENT IS THE FIRST HALF OF THE ARGUMENT. This runs LAST, after step 1's default-deny scan,
     after step 1b, after step 2's packet branch, and after step 3's free-form branch. It therefore
     has exactly one power: converting a payload that would have hit the terminal catch-all as
     ambiguous into an allow. It cannot shadow, preempt, or reorder any existing verdict, and in
     particular it can never intercept a call on its way to a block. The terminal catch-all itself
     is byte-unchanged; this narrows what is ambiguous, it never widens what is allowed to carry
     content. Same shape of claim as Phase 245-03's step 1b, and the same reason it holds.
  2. STEP 1 IS THE ACTUAL BOUNDARY, AND IT ALREADY RAN. auditQueryObject JSON.stringify-sweeps the
     WHOLE payload against the Canon FORBIDDEN_PATTERNS set before this function is ever consulted.
     Name the categories concretely so a later reader does not have to go look: email, currency and
     bare financial magnitude, percent metric, financial idiom (Series A / ARR / MRR / burn rate /
     runway / Nx growth), quoted-person, meeting fragments and verbatim prose, SSN-like, phone-like,
     name plus degree, user-count metric, venture proper-noun, identifying location. A from / to /
     question_label carrying real user content is blocked at step 1 and never reaches this code.
     Step 1 is byte-unchanged by this task.
  3. DEFENSE IN DEPTH, NOT ORDERING ALONE. Every string field is independently re-run through
     _safeAudit here, mirroring what _proveMoveSet already does for its handleFields. So this
     recognizer returns no-proof for a content-carrying payload even when called directly, out of
     classify()'s ordering. That is asserted by test, not just claimed here.
  4. THE SHAPE CHECK IS PAIRED WITH THE TOOL NAME, DELIBERATELY. Unlike _isProvablyEmptyPayload,
     which is payload-shaped and tool-agnostic on purpose (a zero-key payload has nothing to leak
     under any tool name), a from/to pair IS a pair of strings, so a bare structural match usable by
     any caller would be a general-purpose two-string channel. Scoping to the matching tool name is
     what keeps it a recognizer for two specific known-safe call shapes rather than a new hole.
  5. FAIL-CLOSED ON SCHEMA DRIFT. The key set is EXACT. This repo holds no local copy of either
     tool's input schema (data/brain-surface-contract.json lists both as non-contract with no args),
     so if the live schema ever renames or adds an argument, _hasExactKeys stops matching, the
     recognizer declines, and the call reverts to gating ambiguous. A drift produces a false
     ambiguous, never a false allow.
  6. WHY question_label IS ADMITTED AT ALL, stated honestly. It is a string the user can influence.
     It is admitted only because (a) step 1 already cleared it, and (b) step 3 ALREADY admits an
     entire free-form brain_ask question on exactly that same step-1-cleared basis, behind a
     vocabulary gate the _isFreeFormTool docblock itself proves is defeated by a trailing comment.
     This path is strictly narrower than what already ships: exact key set, single line, 120-char
     cap, and no vocabulary theater. It does not widen the boundary beyond the shipped surface.
  7. maxHops IS A NUMBER AND CARRIES NO FREE TEXT. The integer-and-at-least-one constraint is shape
     hygiene, not a content defense.
  8. THE WARNING, in the same terms the _isFreeFormTool docblock uses: the boundary-neutrality of
     this recognizer is entirely borrowed from step 1 running FIRST and running default-deny, and
     from this branch sitting LAST. Anyone who weakens step 1, or moves this branch earlier in the
     chain, turns this decision into the hole.

Then, in lib/core/refusal-messaging.cjs, add the string 'known_tool_shape' to EGRESS_CLASS_SET with
a trailing comment noting it is an ALLOW-only class that can never reach an egress_blocked refusal,
listed purely to keep that closed vocabulary a true mirror of classify(). Change nothing else in
that file.

NO em-dashes and no en-dashes anywhere in either edit (CLAUDE.md HARD RULE); hyphens only, matching
this file's own existing convention.
  </action>
  <verify>
    <automated>node -e "const g=require('./lib/core/part8-egress-guard.cjs');const F='mcp__plugin_mos_mindrian-brain__find_connections';const T='mcp__plugin_mos_mindrian-brain__taxonomy_ladder';const r={a:g.classify({from:'Design Thinking',to:'SWOT'},{toolName:F}),b:g.classify({from:'Design Thinking',to:'SWOT'},{toolName:'mcp__plugin_mos_mindrian-brain__brain_query'}),c:g.classify({from:'jane@startup.com',to:'SWOT'},{toolName:F}),d:g.classify({rung:'wicked'},{toolName:T}),e:g.classify({from:'a',to:'b',depth:2},{toolName:F}),f:g.classify({},{toolName:F}),h:g.classify({a:1},{toolName:F})};const bad=r.a.verdict!=='allow'||r.a.class!=='known_tool_shape'||r.b.verdict==='allow'||r.c.verdict!=='block'||r.c.class!=='content_set'||r.d.verdict!=='allow'||r.e.verdict!=='ambiguous'||r.f.class!=='empty_payload'||r.h.class!=='unknown'||g._proveKnownToolShape({from:'jane@startup.com',to:'SWOT'},F)!==null;if(bad)throw new Error(JSON.stringify(r,null,1));console.log('OK step-3b recognizer');" && node -e "const m=require('./lib/core/refusal-messaging.cjs');const s=require('fs').readFileSync('lib/core/refusal-messaging.cjs','utf8');if(!/known_tool_shape/.test(s))throw new Error('EGRESS_CLASS_SET parity not updated');console.log('OK class parity');" && node -e "const s=require('fs').readFileSync('lib/core/part8-egress-guard.cjs','utf8');if(/[\u2013\u2014]/.test(s))throw new Error('em-dash or en-dash present');console.log('OK no long dashes');"</automated>
  </verify>
  <done>classify() gains a step 3b that allows the two named tool shapes and only those, placed last in the fallthrough chain; _proveKnownToolShape independently returns null for a content-carrying payload; every pre-existing verdict is unchanged; the recognizer carries the eight-point boundary-neutrality docblock; EGRESS_CLASS_SET mirrors the new class; no long dashes anywhere.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write the two-leg proof test</name>
  <files>tests/test-260906-fda-known-tool-shapes.cjs</files>
  <behavior>
    - Happy path: both shapes, with and without their optional argument, classify allow / known_tool_shape under their own scoped tool name.
    - Wrong tool name: the identical find_connections payload under scoped brain_query, scoped brain_ask, scoped find_bottlenecks, bare 'find_connections' with no scope prefix removed from consideration only at the hook leg, 'Write', and '' must NOT return verdict 'allow' and must NOT carry class 'known_tool_shape'. The identical taxonomy_ladder payload under scoped find_connections likewise.
    - Smuggling negative: a payload of either shape whose string field carries forbidden content classifies block / content_set, AND _proveKnownToolShape returns null for that same payload when called directly.
    - Drift negatives: extra key, missing required key, wrong-typed value, non-integer maxHops, maxHops of 0, off-enum rung, multi-line label, 121-character label, empty-string label all classify ambiguous / unknown.
    - No-regression: the four shipped verdicts named in the must_haves still hold byte-identically.
    - Hook leg: a scoped find_connections call with a clean {from,to} exits 0 with no Part 8 gate text; the same call with forbidden content exits 2; the same payload under scoped brain_query exits 2.
  </behavior>
  <action>
Create tests/test-260906-fda-known-tool-shapes.cjs, modeled structurally on
tests/test-245-egress-contentless.cjs (read it first; reuse its ok() counter, its
expectVerdict(payload, toolName, wantVerdict, wantClass, label) helper, its runHook() spawnSync
helper, and its async main() with the process.exit(0) / catch process.exit(1) tail). Zero deps
beyond node assert, fs, path and child_process. CJS. Executable header line and 'use strict'.

File docblock, in the voice of the 245 test's own docblock: state WHY two legs (a unit-only test on
classify() is mutation-blind, because the hook is what translates a verdict into an exit code), and
state the three claims the constraints require this file to settle, in one line each: a genuinely
safe call of each shape is allowed; the same shape under the wrong tool name is not allowed by this
path; a call that step 1 catches never reaches the new allow path, proven both through classify()
ordering AND by calling _proveKnownToolShape directly.

LEG 1, unit, over guard.classify() and the exported seams:

  Arm A, happy path. Scoped names as local constants:
  FIND = 'mcp__plugin_mos_mindrian-brain__find_connections',
  TAX = 'mcp__plugin_mos_mindrian-brain__taxonomy_ladder'.
  Assert allow / known_tool_shape for {from:'Design Thinking', to:'SWOT'};
  {from:'Design Thinking', to:'SWOT', maxHops:3}; {rung:'wicked'}; {rung:'undefined'};
  {rung:'ill-defined', question_label:'framework sequencing'}; {rung:'well-defined'}.
  Also assert the reason scalar is the expected literal for one case of each branch, so a future
  refactor that collapses the two branches into one reason is caught.

  Arm B, the wrong-tool-name negative. For each of
  'mcp__plugin_mos_mindrian-brain__brain_query', 'mcp__plugin_mos_mindrian-brain__brain_ask',
  'mcp__plugin_mos_mindrian-brain__find_bottlenecks', 'mcp__plugin_mos_mindrian-brain__brain_search',
  'Write', and the empty string, assert that classify({from:'Design Thinking', to:'SWOT'}, ...)
  returns a verdict that is NOT 'allow' and a class that is NOT 'known_tool_shape'. Assert the same
  for classify({rung:'wicked'}, ...) under FIND, and for
  classify({from:'Design Thinking', to:'SWOT'}, ...) under TAX. Assert
  guard._proveKnownToolShape({from:'a', to:'b'}, 'Write') === null and
  guard._proveKnownToolShape({from:'a', to:'b'}, null) === null.

  Arm C, the smuggling negative, the load-bearing one. Two payloads:
  {from:'jane@startup.com', to:'SWOT'} under FIND, and
  {rung:'wicked', question_label:'board meeting notes re 2.3M ARR'} under TAX. For each assert
  classify returns block / content_set (step 1 wins, the new path is never reached), AND assert
  guard._proveKnownToolShape(samePayload, sameToolName) === null (the recognizer refuses on its own,
  so the safety does not rest on ordering alone). Add a third: a from value that is clean by pattern
  but carries a newline, {from:'Design Thinking\nsecond line', to:'SWOT'} under FIND, must be
  ambiguous.

  Arm D, drift and shape negatives, each expecting ambiguous / unknown under its own correct scoped
  tool name: {from:'a', to:'b', depth:2}; {from:'a'}; {to:'b'}; {from:'a', to:5};
  {from:'a', to:'b', maxHops:'3'}; {from:'a', to:'b', maxHops:2.5}; {from:'a', to:'b', maxHops:0};
  {from:'', to:'b'}; {from:'x'.repeat(121), to:'b'}; {rung:'sort-of-wicked'};
  {rung:'wicked', label:'x'}; {rung:5}; {question_label:'framework'}; {rung:'wicked', question_label:''}.
  Also assert an array payload [] under FIND stays ambiguous / unknown.

  Arm E, no-regression. Re-assert, verbatim from the shipped behavior: classify({}, FIND) is
  allow / empty_payload; classify({a:1}, FIND) is ambiguous / unknown;
  classify({question:'lean startup methodology'}, 'mcp__plugin_mos_mindrian-brain__brain_ask') is
  allow / move_set; classify({cypher:"note from jane@startup.com re: 2.3M ARR model"},
  'mcp__plugin_mos_mindrian-brain__brain_query') is block / content_set;
  classify(undefined, FIND).reason === 'non-object payload'.

  Arm F, seams. Assert typeof guard._proveKnownToolShape, guard._isSafeShortLabel and
  guard._hasExactKeys are all 'function', and that guard.TAXONOMY_RUNGS.size === 4 with all four
  literals present, so the enum cannot silently grow.

LEG 2, hook, child process, guarded exactly the way the 245 test guards it:

  Skip the whole leg with a printed SKIP if scripts/part8-egress-guard-hook.cjs is absent.
  Derive scoped names at run time from require('../scripts/check-brain-tool-liveness.cjs') using
  enumerateLiveBrainTools() plus composeScopedNames(names, resolvePluginName(), resolveServerName()),
  the same authority the 245 test uses, because the hook calls isBrainTool() before classify() and a
  bare name would allow vacuously. Find the scoped name containing 'find_connections'. If the live
  enumeration does not contain it, print a SKIP line naming that fact and return without failing:
  the liveness enumeration is the authority on what is registered, and this quick task must not
  hard-couple the suite to a remote registry snapshot.

  Case A: tool_name = scoped find_connections, tool_input = {from:'Design Thinking', to:'SWOT'},
  PART8_FORCE_BRAIN_AVAILABLE=1. Assert exit status 0 and that stderr carries no /part 8/i text.
  This is the defect being fixed; before this change it exited 2.
  Case B: same tool, tool_input = {from:'jane@startup.com', to:'SWOT'},
  PART8_FORCE_BRAIN_AVAILABLE=1. Assert exit status 2 and non-empty stderr. Print the verbatim first
  stderr line as evidence, the way the 245 test prints its A1 EVIDENCE lines.
  Case C: tool_name = the scoped brain_query name, tool_input = {from:'Design Thinking', to:'SWOT'},
  PART8_FORCE_BRAIN_AVAILABLE=1. Assert exit status 2: the shape alone does not travel across tool
  names at the hook either.
  Case D: Case A repeated with PART8_FORCE_BRAIN_AVAILABLE=0. Assert exit status 0.

Print a final PASS line carrying the cumulative assertion count. NO em-dashes or en-dashes anywhere
in the file.
  </action>
  <verify>
    <automated>node tests/test-260906-fda-known-tool-shapes.cjs && node -e "const s=require('fs').readFileSync('tests/test-260906-fda-known-tool-shapes.cjs','utf8');if(/[\u2013\u2014]/.test(s))throw new Error('em-dash or en-dash present');if(!/_proveKnownToolShape/.test(s))throw new Error('direct-seam smuggling assertion missing');if(!/PART8_FORCE_BRAIN_AVAILABLE/.test(s))throw new Error('hook leg missing');console.log('OK test file shape');"</automated>
  </verify>
  <done>tests/test-260906-fda-known-tool-shapes.cjs exits 0 and prints a PASS line; it contains all six unit arms and the four hook cases; its Arm C asserts both the classify()-ordering block and the direct _proveKnownToolShape null, so the "cannot smuggle content past step 1" claim is proven two independent ways.</done>
</task>

<task type="auto">
  <name>Task 3: Run the Part 8 regression sweep and confirm no gate drifted</name>
  <files>(no edits expected; fix only what the sweep proves broken)</files>
  <action>
Run every shipped suite that touches classify(), its class vocabulary, or the hook, and confirm each
is green. Run them individually so a failure names itself:

  node tests/test-245-egress-contentless.cjs
  node tests/test-245-brain-envelope-shape.cjs
  node tests/part8-egress-guard-hook.test.cjs
  node tests/part8-egress-e2e-smoke.test.cjs
  node tests/test-246-census-guard.cjs
  node tests/test-254-ambiguous-disclosure.cjs
  node tests/test-257-refusal-egress-kind.cjs
  node tests/test-257-shim-honest-refusal.cjs
  node tests/test-257-envelope-passthrough.cjs
  bash tests/run-all-196.sh
  bash tests/run-all-245.sh

Two suites deserve a specific read rather than a glance at the exit code. test-246-census-guard.cjs
asserts census entries do not fall back to class 'freeform_unmatched'; if any entry now returns
'known_tool_shape' instead, that is a legitimate improvement, and the assertion should keep passing
untouched because it tests the negative, not an equality. Do not loosen it. test-257-refusal-egress-kind.cjs
Arm 4 asserts an UNRECOGNIZED class coerces to 'unknown' using the literal 'not_a_real_class'; adding
'known_tool_shape' to EGRESS_CLASS_SET must not affect it.

If any suite fails, the default assumption is that THIS change broke it, not that the suite is
stale. Trace the failing assertion to the branch it exercises and state the root cause before
touching anything. Do not adjust an existing assertion to accommodate the new recognizer without
naming, in the SUMMARY, exactly which invariant moved and why that move is boundary-neutral. If a
suite fails for a reason demonstrably unrelated to this change (a pre-existing red), record it as a
pre-existing red with its verbatim first failure line rather than fixing it in this quick task.

Record in the SUMMARY: the pass/fail line for each suite, the hook-leg A1 EVIDENCE stderr lines from
task 2, and a one-line statement of what a live find_connections call now does that it could not do
before.
  </action>
  <verify>
    <automated>for t in tests/test-245-egress-contentless.cjs tests/test-245-brain-envelope-shape.cjs tests/part8-egress-guard-hook.test.cjs tests/part8-egress-e2e-smoke.test.cjs tests/test-246-census-guard.cjs tests/test-254-ambiguous-disclosure.cjs tests/test-257-refusal-egress-kind.cjs tests/test-257-shim-honest-refusal.cjs tests/test-257-envelope-passthrough.cjs tests/test-260906-fda-known-tool-shapes.cjs; do echo "== $t"; node "$t" > /dev/null 2>&1 && echo PASS || { echo "FAIL $t"; exit 1; }; done; echo ALL GREEN</automated>
  </verify>
  <done>Every listed Part 8 suite plus the new one exits 0, or any failure is traced to a named root cause and recorded in the SUMMARY as either fixed-with-rationale or a documented pre-existing red.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LOCAL room / session -> Brain MCP | The Canon Part 8 boundary. Every outbound Brain tool payload crosses it. classify() is the runtime judge on this edge and this plan edits that judge. |
| Tool-name string -> recognizer branch selection | The tool name arrives from the PreToolUse hook envelope. It is caller-supplied data that now selects which shape branch runs. |
| Tool input object -> exact-key-set matcher | Attacker-shaped payloads can be crafted to imitate a known-safe shape. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fda-01 | Information disclosure | New step 3b allow path used to carry user content out on `from` / `to` / `question_label` | mitigate | Step 3b runs strictly after step 1's default-deny scan of the whole payload, and every string field is independently re-run through `_safeAudit` inside the recognizer. Proven twice in Arm C of task 2: once through `classify()` ordering, once by calling `_proveKnownToolShape` directly. |
| T-fda-02 | Spoofing | A caller sends a `{from, to}` payload under an unrelated tool name to borrow the new allow | mitigate | The shape check is PAIRED with a tool-name substring match, never a bare structural match. Task 2 Arm B asserts non-allow for six wrong tool names plus `null`. |
| T-fda-03 | Elevation of privilege | The new branch placed early enough to preempt or shadow an existing block verdict | mitigate | Wired LAST, immediately before the terminal catch-all, after steps 1 / 1b / 2 / 3. It can only convert a would-be catch-all ambiguous into an allow. Asserted by the no-regression Arm E, which re-checks every shipped verdict. |
| T-fda-04 | Tampering | Live tool schema drifts (arg renamed or added) and the recognizer over-allows a shape it no longer understands | mitigate | `_hasExactKeys` requires an exact key set, so drift produces a false AMBIGUOUS (the status quo), never a false allow. Task 2 Arm D asserts the extra-key, missing-key and wrong-type cases. |
| T-fda-05 | Information disclosure | `question_label` used as a bulk free-text channel by prose that dodges every FORBIDDEN_PATTERN | mitigate | Single-line only, 120-character cap, exact key set, plus the per-field `_safeAudit`. Documented honestly as strictly narrower than the already-shipped step 3 brain_ask path rather than claimed as airtight. |
| T-fda-06 | Repudiation | The allow is indistinguishable in telemetry from the pre-existing move_set allows | mitigate | Its own class slug `known_tool_shape` and its own per-branch reason scalar, mirrored into `EGRESS_CLASS_SET` so the closed vocabulary stays a true mirror of `classify()`. |
| T-fda-SC | Tampering | npm / pip / cargo installs | accept | This plan installs ZERO packages and adds ZERO dependencies. All three edited files are existing repo files using node built-ins only. No package legitimacy gate applies. |
</threat_model>

<verification>
1. `node tests/test-260906-fda-known-tool-shapes.cjs` exits 0 with a PASS line.
2. The full Part 8 regression sweep in task 3 is green.
3. `grep -n "_proveKnownToolShape" lib/core/part8-egress-guard.cjs` shows the call site sitting
   BELOW the step 3 free-form block and ABOVE the terminal catch-all return. Confirm the ordering by
   reading, not by grep count alone.
4. `grep -c -P "[\x{2013}\x{2014}]" lib/core/part8-egress-guard.cjs lib/core/refusal-messaging.cjs tests/test-260906-fda-known-tool-shapes.cjs`
   returns 0 for each file.
5. `scanForContent`, `_safeAudit`'s body, `lib/core/rs-egress-prompts.cjs`, and
   `lib/core/cross-room-aggregator.cjs`'s FORBIDDEN_PATTERNS are unchanged: confirm with
   `git diff --stat`, which must list exactly the three files in `files_modified` and nothing else.
</verification>

<success_criteria>
- A live `find_connections` call with real `from` / `to` arguments no longer gates as ambiguous; it
  classifies allow / known_tool_shape and the hook exits 0.
- A live `taxonomy_ladder` call with a real `rung` (and optional `question_label`) does the same.
- The same payload shapes under any other tool name still gate, proven for six names plus `null`.
- A content-carrying payload of either shape still blocks as content_set, and the recognizer
  independently refuses it, so the new code cannot be used to smuggle content past step 1.
- Every verdict the guard shipped before this change is byte-identical after it.
- The new recognizer carries a docblock making the boundary-neutrality argument for itself in
  writing, in the same voice and rigor as the shipped `_isFreeFormTool` docblock, including the
  explicit warning that the argument is borrowed from step 1 running first and this branch running
  last.
- `git diff --stat` lists exactly three files.
</success_criteria>

<output>
Create `.planning/quick/260906-fda-register-find-connections-and-taxonomy-l/260906-fda-SUMMARY.md` when done.
</output>
