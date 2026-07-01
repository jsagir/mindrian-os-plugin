---
phase: 196-part8-runtime-slm-guardrail
plan: 04
type: execute
wave: 2
depends_on: [196-03]
files_modified:
  - lib/core/part8-egress-ontology.cjs
  - lib/core/navigation/memory-events.cjs
  - scripts/part8-egress-guard-hook.cjs
  - hooks/hooks.json
autonomous: true
requirements: [PB8-04, PB8-05, PB8-06, PB8-08]

must_haves:
  truths:
    - "A PreToolUse hook fires on the Brain MCP matcher and blocks a CONTENT-SET packet with exit 2 + stderr before it leaves the machine (PB8-04)"
    - "The hook fails OPEN (exit 0) on an internal parse/resolution error but fails CLOSED (exit 2) on a real content hit (A3 accepted risk)"
    - "Brain-less mode (isAvailable() false) skips any gate, LOCAL-logs, and allows - nothing can leak (PB8-08, D-08a)"
    - "Telemetry writes scalars + category slugs + counts ONLY, via navigation.cjs, never payload bytes, never room.db directly (PB8-06, D-09)"
    - "Three additive EVENT_TYPES strings are accepted by the memory-event Set; a telemetry failure never bricks a Brain call"
  artifacts:
    - path: "scripts/part8-egress-guard-hook.cjs"
      provides: "PreToolUse stdin -> classify -> exit 0/2 hook, cloned from write-scope-check.cjs"
    - path: "lib/core/part8-egress-ontology.cjs"
      provides: "taxonomy node + TAGGED_WITH edge + best-effort record() via navigation.cjs"
    - path: "hooks/hooks.json"
      provides: "PreToolUse entry mirroring the shipped mcp__brain_.* matcher, timeout 2000"
      contains: "part8-egress-guard-hook"
    - path: "lib/core/navigation/memory-events.cjs"
      provides: "3 additive EVENT_TYPES: brain_egress_blocked/allowed/ambiguous"
      contains: "brain_egress_blocked"
  key_links:
    - from: "scripts/part8-egress-guard-hook.cjs"
      to: "lib/core/part8-egress-guard.cjs"
      via: "require + classify(tool_input, {toolName})"
      pattern: "part8-egress-guard"
    - from: "scripts/part8-egress-guard-hook.cjs"
      to: "lib/core/part8-egress-ontology.cjs"
      via: "best-effort record() in try/catch"
      pattern: "part8-egress-ontology"
    - from: "hooks/hooks.json"
      to: "scripts/part8-egress-guard-hook.cjs"
      via: "PreToolUse command entry, matcher mcp__brain_.*"
      pattern: "mcp__brain_"
    - from: "lib/core/part8-egress-ontology.cjs"
      to: "lib/core/navigation.cjs"
      via: "writeDomainNode / writeEdge / logMemoryEvent chokepoint"
      pattern: "navigation"
---

<objective>
Wire the classifier into the CC harness: a PreToolUse hook on the Brain MCP matcher that runs classify()
and blocks on exit 2, plus the LOCAL-only telemetry ontology written through navigation.cjs. This is the
step that makes the boundary runtime-enforceable (D-02) without any custom dispatch runtime.

Purpose: The classifier is inert until the harness fires it before the Brain call and reads its exit code
as the block. Telemetry records the block/allow/ambiguous decision as a typed taxonomy (D-09), scalars
only.
Output: part8-egress-guard-hook.cjs + hooks.json entry + part8-egress-ontology.cjs + 3 EVENT_TYPES.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/196-part8-runtime-slm-guardrail/196-RESEARCH.md
@.planning/phases/196-part8-runtime-slm-guardrail/196-PATTERNS.md
@scripts/write-scope-check.cjs
@lib/core/navigation/memory-events.cjs
</context>

<rules>
RULES (restate every wave, non-negotiable):
- Part 8: the hook runs the LOCAL classify() only. It opens NO Brain wire and makes NO network call at
  classify time (D-01). The block is a harness exit code, not a dispatch protocol (D-02).
- Part 9: every telemetry/typed-edge write routes through lib/core/navigation.cjs (writeDomainNode /
  writeEdge / logMemoryEvent); NEVER open room.db directly.
- Part 7 reuse: clone write-scope-check.cjs stdin/exit contract; clone brain-client.cjs _logEventBestEffort;
  add the 3 EVENT_TYPES additively (mirror the 110-02 idiom); reuse isBrainTool for the in-hook recheck.
- D-09: telemetry carries scalars + category slugs + counts ONLY - never the offending payload bytes.
- Fail-OPEN (exit 0) on hook-internal error; fail-CLOSED (exit 2) on a real content hit (A3 accepted risk).
- The hook references lib/hmi/part8-egress-gate.cjs (lands in 196-05) defensively via try/require so it
  degrades gracefully until Wave 3; this plan does NOT own or create the gate module.
- CJS only. NO em-dashes anywhere. Hook timeout 2000ms. Mint no new frozen scalar.
- Resumable: this plan owns ONLY the four files in files_modified.
</rules>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: part8-egress-ontology.cjs + 3 additive EVENT_TYPES</name>
  <files>lib/core/part8-egress-ontology.cjs, lib/core/navigation/memory-events.cjs</files>
  <read_first>
    - 196-PATTERNS.md "lib/core/part8-egress-ontology.cjs" section (_logEventBestEffort clone at
      brain-client.cjs:1086-1094; additive EVENT_TYPES at memory-events.cjs:60-70; writeDomainNode
      taxonomy carve-out at typed-domain.cjs:85-90; TAGGED_WITH edge at edges.cjs:350-369)
    - lib/core/navigation/memory-events.cjs (the Object.freeze(new Set([ opens at :10; add strings inside)
  </read_first>
  <behavior>
    - The memory-event Set accepts 'brain_egress_blocked', 'brain_egress_allowed', 'brain_egress_ambiguous'.
    - record({verdict, class, reason}, {toolName}) writes a taxonomy category node + one TAGGED_WITH edge +
      a memory_event via navigation.cjs, carrying scalars/slugs/counts only.
    - The logged payload contains NO offending byte string (assert no raw sample text).
    - A navigation write failure inside record() is swallowed (best-effort) and never throws.
  </behavior>
  <action>
    Add the three additive EVENT_TYPES strings to the frozen Set in navigation/memory-events.cjs, mirroring
    the 110-02 3-string block verbatim (a short comment then the three literals). Do NOT reorder or remove
    existing members.
    Create lib/core/part8-egress-ontology.cjs: define the block/move category slug vocabulary
    (personal_identifier|proprietary_number|meeting_content|room_metric|location|verbatim_quote for block;
    framework_handle|reach_id|slug|methodology_tier|phase_id|problem_type_enum for move). Export record(v, ctx)
    that, wrapped in the _logEventBestEffort try/catch idiom: writes the category node via
    navigation.writeDomainNode with taxonomy:true (system-bookkeeping carve-out so it is not a truth-claim),
    links the memory_event to the class node via navigation.writeEdge('TAGGED_WITH') with ENUM/scalar props
    only, and logs the matching brain_egress_* event via navigation.logMemoryEvent with scalars + slug + a
    count. NEVER pass the offending bytes. All writes route through navigation.cjs; never open room.db.
    No em-dashes.
  </action>
  <acceptance_criteria>
    <automated>node lib/core/part8-egress-ontology.test.cjs</automated>
    Passes when: PB8-06 assertions green (scalars-only, via navigation.cjs, 3 EVENT_TYPES accepted, best-effort).
  </acceptance_criteria>
  <done>Ontology writes scalar-only taxonomy telemetry through navigation.cjs; EVENT_TYPES additive; never bricks.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: part8-egress-guard-hook.cjs PreToolUse hook</name>
  <files>scripts/part8-egress-guard-hook.cjs</files>
  <read_first>
    - 196-PATTERNS.md "scripts/part8-egress-guard-hook.cjs" section (readStdinSync + fail-open outer wrap
      at write-scope-check.cjs:144-150,260-265; block() stderr+exit2 at :174-179; isBrainTool at
      brain-response-sanitize.cjs:83-85; isAvailable at brain-client.cjs:177-179; stdin envelope
      {tool_name, tool_input, tool_response, session_id} at brain-response-sanitize-hook.cjs:11)
    - 196-RESEARCH.md "The hook skeleton" code example (the exact contract)
  </read_first>
  <behavior>
    - non-Brain tool_name -> exit 0 passthrough.
    - CONTENT-SET tool_input on a Brain tool -> stderr Part 8 message + exit 2.
    - clean MOVE-SET -> exit 0.
    - ambiguous + isAvailable() true -> render F.1 gate (via the defensively-required gate module) + exit 2.
    - ambiguous + isAvailable() false -> LOCAL-log brain_egress_ambiguous + exit 0 (D-08a).
    - malformed/garbage stdin -> exit 0 fail-OPEN.
  </behavior>
  <action>
    Clone the write-scope-check.cjs contract: readStdinSync (JSON.parse(readFileSync(0)) in try/catch),
    an outer try{main()}catch{process.exit(0)} fail-OPEN wrap, and a process.on('uncaughtException', exit 0).
    In main(): read tool_name + tool_input from the stdin envelope. Defense-in-depth: if
    !sanitizer.isBrainTool(tool_name) exit 0 (backstop for the matcher). Call
    guard.classify(tool_input, {toolName}). Best-effort record the verdict via the ontology module in a
    try/catch (never brick a Brain call). Branch:
      verdict 'block' -> stderr "Canon Part 8: outbound Brain payload carries CONTENT-SET (<class>). Blocked. <reason>"
        then process.exit(2).
      verdict 'ambiguous' -> if brainClient.isAvailable(): try-require lib/hmi/part8-egress-gate.cjs and write
        its rendered F.1 gate to stderr, then exit 2; if the gate module is absent (Wave 3 not landed) fall
        back to a minimal stderr Part 8 ambiguous notice + exit 2. If NOT isAvailable(): best-effort log
        brain_egress_ambiguous and exit 0 (D-08a - no wire, nothing leaks).
      verdict 'allow' -> exit 0.
    classify is sub-millisecond; the hook does no network. No em-dashes.
  </action>
  <acceptance_criteria>
    <automated>node tests/part8-egress-guard-hook.test.cjs</automated>
    Passes when: PB8-04/05/08 assertions green (exit 2 on block, 0 on allow, 0 on non-Brain, 0 fail-open on
    garbage stdin, 0 on Brain-less ambiguous).
  </acceptance_criteria>
  <done>The hook blocks CONTENT-SET via exit 2, fails open on infra error, and honors the Brain-less degrade.</done>
</task>

<task type="auto">
  <name>Task 3: register the PreToolUse hook in hooks.json</name>
  <files>hooks/hooks.json</files>
  <read_first>
    - 196-PATTERNS.md "hooks/hooks.json" section (mirror the shipped mcp__brain_.* PostToolUse block at
      hooks.json:284-293; add to the PreToolUse array at :183-276)
    - OQ-1 disposition (matcher CONFIRMED = mcp__brain_.*; the in-hook isBrainTool recheck is the backstop)
  </read_first>
  <action>
    Add ONE PreToolUse entry to the existing PreToolUse array with matcher "mcp__brain_.*" (the IDENTICAL
    string the shipped PostToolUse Brain hook uses, so both fire on the same tool set), a single command hook
    running node "${CLAUDE_PLUGIN_ROOT}/scripts/part8-egress-guard-hook.cjs" with "timeout": 2000. Do not
    disturb the existing PreToolUse or PostToolUse entries. Keep JSON valid (no trailing commas). Before
    trusting the matcher, confirm the live composed Brain tool name against the shipped PostToolUse hook
    (OQ-1 backstop); the in-hook isBrainTool recheck covers any residual drift. No em-dashes.
  </action>
  <acceptance_criteria>
    <automated>node -e "const h=require('./hooks/hooks.json'); const s=JSON.stringify(h); if(!s.includes('part8-egress-guard-hook')||!s.includes('mcp__brain_')){process.exit(1)} console.log('hook registered')" && bash tests/run-all-196.sh</automated>
    Passes when: hooks.json parses, carries the PreToolUse part8-egress-guard-hook entry on the Brain matcher,
    and run-all-196 reports FAIL=0 with the hook + ontology legs now PASSING.
  </acceptance_criteria>
  <done>The PreToolUse hook is registered on the Brain matcher with a 2000ms timeout; run-all-196 FAIL=0.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| CC harness -> Brain MCP call | the PreToolUse hook intercepts the outbound tool call before it leaves the machine |
| hook -> room.db (telemetry) | only scalars/slugs cross, only through navigation.cjs |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-196-04-01 | Elevation / Bypass | a differently-named Brain tool dodges the matcher | mitigate | mirror the shipped mcp__brain_.* matcher + in-hook isBrainTool recheck (OQ-1) |
| T-196-04-02 | Information Disclosure | telemetry leaks the payload it was blocking | mitigate | scalar+slug+count-only ontology (D-09); best-effort non-blocking write |
| T-196-04-03 | Denial of Service | a telemetry throw bricks every Brain call | mitigate | _logEventBestEffort try/catch wrap; record() never throws |
| T-196-04-04 | Tampering | fail-open error window passes a leaky packet | accept | matches shipped write-scope-check posture (A3); documented, hook-test covered |
| T-196-04-SC | Tampering | npm/pip/cargo installs | accept | zero installs; zero-dep CJS + one hooks.json entry |
</threat_model>

<verification>
- node tests/part8-egress-guard-hook.test.cjs passes (PB8-04/05/08).
- node lib/core/part8-egress-ontology.test.cjs passes (PB8-06).
- hooks.json parses and registers the PreToolUse hook on mcp__brain_.*, timeout 2000.
- bash tests/run-all-196.sh: hook + ontology legs flip to PASS; FAIL=0.
- Tri-Polar: the hook fires on CLI; the same matcher covers the Desktop/Cowork MCP tool-call path.
</verification>

<success_criteria>
The Brain-egress chokepoint is guarded at runtime: a CONTENT-SET packet is blocked by the harness via
exit 2 before it leaves the machine, the Brain-less degrade allows safely, and every decision is logged
as scalar-only typed telemetry through navigation.cjs.
</success_criteria>

## Artifacts this phase produces
- scripts/part8-egress-guard-hook.cjs - PreToolUse block-on-exit-2 hook (clone of write-scope-check.cjs)
- hooks/hooks.json - PreToolUse entry on the mcp__brain_.* matcher, timeout 2000
- lib/core/part8-egress-ontology.cjs - LOCAL-only taxonomy telemetry via navigation.cjs
- lib/core/navigation/memory-events.cjs - 3 additive EVENT_TYPES (brain_egress_blocked/allowed/ambiguous)

<output>
Create `.planning/phases/196-part8-runtime-slm-guardrail/196-04-SUMMARY.md` when done.
</output>
