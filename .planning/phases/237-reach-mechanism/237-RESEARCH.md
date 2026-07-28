# Phase 237: Reach Mechanism - Research

**Researched:** 2026-07-28
**Domain:** MCP tool seams (chain_run / framework_run), autonomy classification authority, cross-session sensor-signal isolation
**Confidence:** HIGH (all three defects reproduced from source in this session; two of three reproduced by running real repo code)
**Repo version at research time:** v1.15.3-beta.51
**Depends on:** Phase 235 (CLOSED). `lib/core/seam-liveness.cjs` exists and is consumable now.

---

## Summary

All three REACH defects are real, located to exact files and line ranges, and two of the three were reproduced by executing the actual shipped modules during this research session (not inferred from reading).

**REACH-01** is a stub that lies. `lib/mcp/tools/chain.cjs::makeDefaultOnStep` (lines 184-205) is the WIRED default executor for every `chain_run` step. It opens room.db, writes ONE `memory_event` row labelled `chain_step_executed`, and returns `{ chain_output: {...}, quality: 'high' }`. It never resolves the step's command to anything runnable. The fabricated `quality: 'high'` is what makes it a false success rather than an honest no-op: the chain-executor's quality carry sees "high", never halts, and the trace reads green. Approving a Decision Gate today produces a log line and a fabricated success verdict.

**REACH-02** is not "two authorities that drifted"; it is two authorities reading two SEMANTICALLY DIFFERENT FIELDS. `framework_run` reads `data/command-registry.json` `commands[].autonomous_safe` (an autonomy flag, sourced from each command's top-level frontmatter). `chain_run` reads `data/connector-registry.json` `connectors[].posture === 'push_forward'` (a PEDAGOGICAL reach posture from the frozen-3 vocabulary push_forward/hold/pull_back, sourced from each command's `connector:` frontmatter block). Measured live in this session: **48 of 112 registered commands disagree (43%)**, and **12 of those disagree in the DANGEROUS direction** where `chain_run` would auto-run a step `framework_run` gates, including `/mos:new-project`, `/mos:ignite` and `/mos:pipeline`. The ONE shared authority already exists and is already used by every other consumer in the repo: `lib/core/recipe-maps.cjs::postureForCommand`. `chain.cjs` is the single deviant.

**REACH-03** is a room-scoped freshness marker read as a per-session turn signal. `lib/core/insight-sensors.cjs::deriveTurnSignals(ctx)` (lines 249-286) derives `artifact_filed` and `first_material` from `<roomDir>/.mindrian/last-cascade.json` and `<roomDir>/.mindrian/auto-explore-*.json` inside a 30-minute mtime window. Neither file carries a session id, neither writer stamps one, and `ctx` does not even carry `sessionId` to compare against. Any session A action inside 30 minutes surfaces as session B's own turn signal. Four more sensors share the identical shape.

**Primary recommendation:** Three surgical, independently-provable changes, in this order: (1) collapse `chain.cjs`'s local `postureForCommand` into `recipe-maps.postureForCommand` and add a full-registry parity gate (REACH-02 -- smallest change, largest safety delta, unblocks a trustworthy REACH-01 fixture); (2) replace `makeDefaultOnStep` with a real two-tier dispatcher that either genuinely executes or honestly refuses, proven on the `/mos:snapshot` -> `scripts/generate-hub.cjs` -> `<roomDir>/exports/hub.html` fixture, and delete the decorative `decide()` call from `chain-executor.cjs` (REACH-01); (3) thread a session id into `deriveTurnSignals` and session-stamp the two markers, proven by a `child_process.fork` two-process fence (REACH-03).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Autonomy classification (material vs autonomous_safe) | Shared CJS core (`lib/core/recipe-maps.cjs` -> `lib/workflow/command-resolver.cjs`) | Generated data (`data/command-registry.json`) | Already the declared "ONE posture authority" consumed by act, ignite, pipeline, bono, framework-chain-composer. Only `lib/mcp/tools/chain.cjs` deviates. |
| Chain gate predicate (run vs halt) | Shared CJS core (`lib/core/chain-executor.cjs::makeGateFn`) | -- | Already single-sourced. Both MCP tools ride it. No second gate exists. Do NOT touch. |
| Gate mint + render | MCP layer (`lib/mcp/gate-render.cjs`) | HMI renderers (`lib/hmi/shape-f8/f9`) | Single ladder, already shared by gate_render / gate_answer / framework_run / chain_run. |
| Chain step EXECUTION | **Host (Claude Code) for methodology commands; Node child process for script-backed commands** | MCP server (dispatch decision only) | Hard boundary. See "Hard Architectural Constraint" below. The MCP server can decide and refuse; it cannot invoke a Claude Code subagent. |
| Reach candidate production | Shared CJS core (`lib/core/insight-sensors.cjs::dispatchSensors`) | Room filesystem side-channels (`<roomDir>/.mindrian/*.json`) | One registry, two consumers (navigation-engine CLI path + sensors.cjs MCP path). Fix must land in the shared core so both consumers get it. |
| Session identity | Shared CJS core (`lib/core/session-binding.cjs::resolveEffectiveSessionId`) | MCP `extra.sessionId` / `CLAUDE_CODE_SESSION_ID` env | Already the single 3-tier resolver (Canon Part 7 consolidation of 20 call sites). Reuse it; do not add a fourth resolver. |

---

## Project Constraints (from CLAUDE.md)

These are binding on every plan in this phase. They are not advisory.

| # | Directive | Consequence for this phase |
|---|-----------|---------------------------|
| C1 | **CJS only, no TypeScript.** `lib/core/*.cjs` ships as source. | Every new module is `.cjs` with `module.exports`. No build step. |
| C2 | **No em-dashes anywhere; hyphens only.** | Applies to code comments, test labels, PLAN.md, CHANGELOG. Note: `lib/mcp/tools/sensors.cjs:338` already contains an em-dash inside a card label string (`'Approve -- run '`). Do not copy that idiom. |
| C3 | **Canon Part 7: Reuse Before Build.** Search existing surfaces first; justify any net-new surface. | REACH-02 must reuse `recipe-maps.postureForCommand`, not mint a new authority module. REACH-03 must reuse `resolveEffectiveSessionId`, not add a fourth session resolver. |
| C4 | **Canon Part 9: Memory Locality.** All SQL writes route through `lib/core/navigation.cjs`. | A real dispatcher must not open room.db directly; it goes through `navigation.openRoomDbForCaller` / `logMemoryEvent` exactly as `makeDefaultOnStep` already does. |
| C5 | **Canon Part 8: LOCAL -> BRAIN: NO.** Zero Brain/network tokens in these files. | `chain.cjs`, `sensors.cjs`, `insight-sensors.cjs` all carry a Part-8 clean-surface test today (`tests/test-198-local-only.test.cjs`, `tests/test-sensors-part8-sweep.cjs`). Any new module inherits that floor. |
| C6 | **Canon Part 11 (CIRS).** Every invocable surface is born WIRED or EXCLUDED with a declared `hitl_shape`/`hitl_why`. | Changing `chain_run`'s response shape must keep the `connectors` export at `chain.cjs:483-498` consistent (`hitl_shape: 'F.1'`). Re-run `node scripts/build-connector-registry.cjs --check`. |
| C7 | **Canon Part 3: Tri-Context Decision Gate** (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen). | Do not touch these scalars. `SIGNAL_FRESHNESS_MS = 30*60*1000` in insight-sensors.cjs is NOT a frozen-family scalar and may be changed, but changing it does not fix REACH-03 (it narrows the window, it does not scope it). |
| C8 | **Tri-Polar Design Rule.** CLI + Desktop + Cowork. | REACH-03's fix must land in `lib/core/insight-sensors.cjs` (shared), NOT in `lib/mcp/tools/sensors.cjs` alone -- otherwise the CLI navigation-engine path stays broken. Cowork is explicitly multi-user concurrent, so REACH-03 is a Cowork-critical fix, not a CLI curiosity. |
| C9 | **Mutation-proven gates.** "A gate that cannot fail is not a gate." | Every success criterion needs a demonstrated RED. See "Validation Architecture". |
| C10 | **Dev-Research Compositing.** Findings file in BOTH `.planning/phases/237-.../` AND `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked. | This is architecture work on MindrianOS itself, so the rule applies. The planner should include a room-filing task. |
| C11 | **Verification suites.** `bash tests/run-all-<phase>.sh`; born-wired/projection/render gates; `node scripts/doctor.cjs --acceptance`. | Phase needs a new `tests/run-all-237.sh` following the `tests/run-all-198.sh` run/run_if SKIP-safe pattern. |
| C12 | **RCA reporting standard** (`docs/RCA-TEMPLATE.md`); on resolve move to `.planning/debug/resolved/` + knowledge-base block. | The routed-in RCA (`room-bind-mcp-first-off-...md`) is `status: diagnosed`. Phase 237 closes only its Test 1 leg; the file must NOT be moved to `resolved/` by this phase, because its structural fix lands in v1.17.0. Update its `next_action` instead. |

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REACH-01 | Approving a Decision Gate for a chain step causes that step's actual resolved command to run, not only a log line (R-1); the decorative per-step `decide()` call is removed in the same change (R-3 folds in). | Root cause located at `lib/mcp/tools/chain.cjs:184-205` (`makeDefaultOnStep`). Decorative `decide()` located at `lib/core/chain-executor.cjs:491-505` (sync) and `:743-752` (async), with the shape-mismatch proof and the zero-consumer census below. Executable fixture identified (`/mos:snapshot` -> `scripts/generate-hub.cjs`). Hard architectural constraint on methodology commands documented. |
| REACH-02 | `framework_run` and `chain_run` agree on which commands are material vs autonomous_safe, one authority, not two (R-2). | Both code paths traced; the two data sources and their DIFFERENT semantics identified; 48/112 disagreements measured live, 12 in the dangerous direction. The single shared authority (`recipe-maps.postureForCommand`) identified, with a full call-site census proving `chain.cjs` is the only deviant. |
| REACH-03 | A candidate reach reflects the current session's own turn signals, not another concurrent session's stale marker (R-4). | Root cause located at `lib/core/insight-sensors.cjs:249-286` (`deriveTurnSignals`) plus `:552-580` (`sensorArtifactFiled`). Full inventory of six room-scoped freshness markers. Session-id plumbing path identified end to end. Two-process fence pattern identified (`lib/memory/write-lock-atomic.test.cjs` + `.worker.cjs`). |

---

## Grounding Consultation Record (MANDATORY, per CLAUDE.md + ROADMAP Cross-Cutting Research Rules)

This section is the phase's audit trail. It records what was asked and what came back, including misses.

### 1. langtalks-graph-expert MCP -- CONSULTED, PARTIAL HIT

**Access note (record this):** `mcp__langtalks-graph-expert__*` tools were NOT present on this research agent's tool surface (the known Claude Code behavior where MCP tools are stripped from agents carrying a restricted `tools:` frontmatter, anthropics/claude-code#13898). The server is configured in `~/.claude.json` as a local stdio server (`/home/jsagi/langtalks-graph-expert/.venv/bin/python .../server/mcp_server.py`), so it was driven **directly over JSON-RPC stdio** from this session. The consultation was performed for real; it was not skipped and it was not simulated.

Server: `langtalks-graph-expert` v1.28.x. Tools available: `query_relationship`, `relationship_path`, `multihop_query`, `get_entity`, `add_source`, `graph_stats`.

| Query | Tool | Result |
|-------|------|--------|
| "agent orchestration" <-> "tool authorization" | `relationship_path` | found, 2 hops, via episode "50 - A2A protocol". Edge types are `mentioned_in_episode` (co-occurrence), not a typed design-pattern edge. **Weak signal.** |
| "How should a multi-agent system decide which actions are safe to run autonomously vs which require human approval? Is there a single-authority pattern for autonomy classification?" | `query_relationship` (budget 2500) | `total_found: 890`, truncated. Returns a keyword-node list (Decide / Multi-Agent Systems / Safe / User Approval / Autonomy AI / Classifications / Human), each with a source URL. **No synthesized single-authority pattern in the corpus.** Honest answer: the specific "ONE classification authority" pattern REACH-02 needs is NOT in this corpus. |
| "human in the loop" <-> "autonomous agent" | `relationship_path` | found, 2 hops, both via episode **33 - LangGraph, Eden Marco (2024-07-13)**. |
| "approval" <-> "execution" | `relationship_path` | found, 2 hops, via episode 33. |
| "interrupt" <-> "checkpoint" | `relationship_path` | found, 2 hops, via episode 33. |
| "Human in the loop" + "Execution" | `multihop_query` | `shared_count: 1` -- exactly one episode discusses both: episode 33 (LangGraph, guests Lee Twito + Gal Peretz). |
| "session isolation" <-> "concurrent agents" | `relationship_path` | found, 3 hops, `builds_on` chain Isolation -> Agent -> Memgraph -> Concurrent Edge Rights. Tangential (graph-store concurrency, not agent-session signal isolation). **Effectively a miss for REACH-03.** |
| "MCP" <-> "session state" | `relationship_path` | found, 2 hops, via episode "55 - Context Engineering". Co-occurrence only. **Weak.** |

**What the corpus actually grounds (honest reading):** exactly ONE cluster is relevant, and it is relevant to REACH-01. LangTalks episode 33 (LangGraph) co-locates Interrupt + Checkpoint + Human-in-the-loop + User Approval + Execution + Autonomous Agents. That is the LangGraph interrupt/checkpoint-then-resume pattern: the graph HALTS at an interrupt, the state is checkpointed, a human answers, and execution RESUMES from the checkpoint. **`chain_run`'s existing mint-on-halt / consume-on-resume ledger is already an instance of that pattern, and it is structurally correct.** The corpus therefore validates chain_run's control-flow SHAPE and offers nothing that contradicts it. The defect REACH-01 names is not in the shape; it is that the thing the resume calls (`onStepFn`) does not execute.

**What the corpus does NOT ground (record as a miss, do not paper over):**
- No single-authority autonomy-classification pattern (REACH-02). Training-data analogies exist but are not corpus-grounded; REACH-02's recommendation below rests on **in-repo precedent** (`lib/core/resolve-active-room.cjs`, which already collapsed a "four guessers" bug class, and `recipe-maps.cjs`'s own declared "ONE posture authority" role), not on langtalks.
- No cross-session signal-isolation pattern (REACH-03). The `Isolation -> Memgraph -> Concurrent Edge Rights` path is about graph-store write concurrency, a different problem. REACH-03's recommendation rests on in-repo precedent (`lib/core/session-presence.cjs`'s per-room `<roomDir>/.mindrian/sessions/<sessionId>.json` ledger).

### 2. Claude Code MCP / hooks behavior -- CONSULTED via official docs (claude-api skill and claude-code-guide agent NOT INSTALLED)

**Access note (record this):** the `claude-api` skill and the `claude-code-guide` agent are **not present in this environment** (`~/.claude/skills/` has no `claude-api`; no `claude-code-guide` under `~/.claude/agents/` or `~/.claude/plugins/`). Grounding fell back to the **official Claude Code documentation**, which is at least as authoritative for MCP tool-contract and hook-payload questions. Do not record this as "consulted the skill".

| Question | Source | Answer |
|----------|--------|--------|
| Does the hook stdin payload carry a session id? | `code.claude.com/docs/en/hooks` (fetched 2026-07-28) | **YES.** `session_id` is a documented COMMON input field on every hook event including `PostToolUse`, alongside `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id`. **This is the enabling fact for REACH-03:** `scripts/post-write` already receives `session_id` on stdin and simply does not stamp it into `last-cascade.json`. |
| Can an MCP server invoke or trigger a Claude Code slash command? | `code.claude.com/docs/en/mcp` (fetched 2026-07-28) | **NO.** MCP servers expose *prompts*, which the USER invokes as `/mcp__servername__promptname`. There is no server-initiated slash-command execution. **This is the hard constraint on REACH-01.** |
| Does Claude Code support MCP sampling (`createMessage`)? | `code.claude.com/docs/en/mcp` | **Not documented anywhere on the page.** Elicitation is documented in detail (form mode, URL mode, an `Elicitation` hook for auto-response); sampling is entirely absent. Treat sampling as UNAVAILABLE. An MCP server cannot ask Claude Code to run a model turn to execute a methodology prompt. |
| Does Claude Code support MCP elicitation? | `code.claude.com/docs/en/mcp` | **YES**, automatically, no configuration. This is what `gate-render.cjs`'s rung (a) already targets, and it is why `chain_run`'s gate ladder is sound. |
| MCP tool naming for hook matchers | `code.claude.com/docs/en/mcp` | Bare form `mcp__<server>__<tool>`. **For a PLUGIN-BUNDLED server the full form is `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`, and "a hook matcher written against the bare server key, such as `mcp__database-tools__.*`, never fires for a plugin-bundled server."** MindrianOS ships its MCP server inside the plugin. Flag this to Phase 239 (BRAIN-01); it also means `lib/core/seam-liveness.cjs`'s `checkHookMatcherLiveness` header comment (which cites `mcp__brain_.*`) documents a form that may not fire. Out of scope for 237, but the planner should note it in the SUMMARY so 239 inherits it. |

### 3. Context7 -- NOT CONSULTED, and correctly so

No claim in this phase depends on a third-party library's actual behavior. The MCP SDK is used only through the already-shipped `server.tool()` registration path, unchanged by this phase. `node:sqlite` semantics belong to Phase 236, not 237. Recording this as a deliberate non-consultation rather than an omission.

---

## Hard Architectural Constraint (READ BEFORE PLANNING REACH-01)

This is the single most important planning input in this document.

**The MCP server process cannot execute a `/mos:` methodology command.**

The chain of evidence:

1. `data/command-registry.json` has 112 commands. 49 are `kind: methodology`. Of the 47 commands flagged `autonomous_safe: true`, essentially all are `kind: methodology` with `body_shape: methodology` (33 of them carry that exact body_shape).
2. A methodology command is a MARKDOWN PROMPT (`commands/analyze-needs.md`, etc.). There is no executable behind it.
3. Its designated executor is `agents/framework-runner.md`, a Claude Code SUBAGENT (`allowed-tools: Read, Write, Bash, Glob`, `isolation: worktree`). Its own header states: "You are NOT the selector -- `/mos:act` already chose the framework. You execute it."
4. That subagent is dispatched by the HOST, from a command body. `commands/act.md:243`: "If the navigator selects Run, dispatch to `agents/framework-runner.md`". `commands/pipeline.md:53`: "`onStep` = dispatch the per-stage framework-runner". `scripts/act-command.cjs:174-177` says so explicitly in code: "act does NOT dispatch framework-runner here -- the `/mos:act` command body does that for the greenlit prefix; this helper only PLANS the walk."
5. Claude Code exposes no mechanism for an MCP server to invoke a subagent, a slash command, or a model turn (no sampling; see grounding table above).

**Therefore:** any plan that says "make `chain_run`'s onStep execute the methodology command" is unimplementable, and a plan that claims to have done it will have faked it a second time. The honest design is a **two-tier dispatcher** (below). Do NOT let the SC1 wording ("its output artifact exists afterward") push the plan into fabricating a server-side methodology executor.

**What IS server-executable:** 44 of the 112 commands reference a `node "${CLAUDE_PLUGIN_ROOT}/scripts/*.cjs"` invocation in their body. A subset of those take a room directory and produce a file deterministically with zero npm dependencies. That subset is the honest SC1 fixture.

---

## Defect 1: REACH-01 -- the approve-to-execute seam

### 1a. The log-only executor

`lib/mcp/tools/chain.cjs:184-205`:

```javascript
function makeDefaultOnStep(roomDir) {
  return async function onStep(step, _previousOutput) {
    const db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return { chain_output: null, quality: null };
    try {
      const logged = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
        label: 'chain_step_executed',
        step: step && step.step,
        command: step && step.command,
        framework: step && step.framework,
      });
      return {
        chain_output: { step: ..., command: ..., memory_event: logged },
        quality: 'high',          // <-- FABRICATED. This is the lie.
      };
    } finally { navigation.closeRoomDbForCaller(db); }
  };
}
```

Wired as the default at `chain.cjs:293`: `const onStepFn = (typeof o.onStep === 'function') ? o.onStep : makeDefaultOnStep(roomDir);`. The MCP tool handler at `chain.cjs:470` supplies no `onStep`, so **every real `chain_run` call through MCP uses this stub.** The approve path at `chain.cjs:395` (`stepResult = await entry.onStepFn(entry.haltedStep, entry.previousOutput)`) calls it.

The `quality: 'high'` is the load-bearing defect, not the missing execution. `lib/core/chain-executor.cjs:626` halts the chain on `quality === LOW_QUALITY`, and `makeGateFn` at `:360` halts the NEXT step on a low prior output. A stub returning `quality: null` would at least not propagate a green verdict. Returning `'high'` makes the whole chain read successful.

**Two independently-provable sub-defects, both inside SC1:**
- (i) the step's resolved command never runs;
- (ii) the trace records a fabricated `quality: 'high'` success for a step that did nothing.

The planner should treat (ii) as a separate, easier, and independently-mutable gate leg. Fixing (ii) alone already turns a silent false-success into an honest halt.

### 1b. The decorative `decide()` call -- call-site census

`decide(turn, context)` is defined at `lib/core/navigation-engine.cjs:817`. Its documented contract (`:793-802`):

```
turn    = { userText, sectionPath, sessionId }
context = { quadruple, brainAvailable, userPersona, intentSignal }
```

`lib/core/chain-executor.cjs` calls it at **two sites** with a shape that matches nothing:

| Site | Call | Every field decide() reads |
|------|------|----------------------------|
| `chain-executor.cjs:499` (sync `runChain`) | `decideFn({ step: step, index: i }, { previousOutput: previousOutput })` | `turn.userText` = undefined, `turn.sectionPath` = undefined, `turn.sessionId` = undefined, `context.quadruple` = undefined, `context.brainAvailable` = undefined |
| `chain-executor.cjs:747` (async `_runChainResilient`) | identical | identical |

`decide()` "never throws ... every internal failure falls through to a safe `emptyDecision()`", so both sites reliably receive an empty decision. The return is reduced to `decision.decision_trace` and stored on the trace entry (`:606`, `:820`, `:862`).

**Consumer census for that stored handle (this is the "call-site census" SC1 asks for):**

`grep -rn "decision_trace" lib/ scripts/ --include=*.cjs` returns 27 hits. Every consumer reads a decision_trace produced by a REAL `decide()` call elsewhere (`offer-presenter.cjs:224`, `offer-closer.cjs:85/117`, `f1-pick-consumer.cjs:8/110`, `navigation-invariants.cjs:170`, `navigation-engine.cjs:827`). **Zero consumers read `runChain`'s returned `trace[i].decision_trace`.** It is written and never read.

**Important nuance the planner must not miss:** the `decideFn` SEAM is not decorative -- `scripts/act-command.cjs:250-268` INJECTS a properly adapted `decideFn` that reshapes runChain's `({step,index},{previousOutput})` call onto a real `decide({userText,sectionPath,sessionId}, context)` call, and that injection was a deliberate CIRS R4 fix in Phase 172-08 (the comment says so). So:

- **Remove:** the DEFAULT `_loadDecide()` path in `chain-executor.cjs` (`:104-113`, `:466`, `:687`) and the two unadapted call sites (`:491-505`, `:743-752`).
- **Keep:** the `opts.decideFn` seam itself, so `act-command.cjs`'s adapted injection keeps working.

Removing the default while keeping the seam is the change that satisfies "the decorative per-step `decide()` call is removed" without breaking the one caller that uses it correctly. If the plan removes the seam entirely, `act-command.cjs:250` breaks and CIRS R4's "one selection authority" wiring is lost.

**Watch out:** `scripts/act-command.cjs:262` fabricates `sessionId: 'act-chain-' + idx`. That is a synthetic session id feeding the real `decide()`. It is out of REACH-03's stated scope (which is the sensor-marker leg) but the planner should log it as an observation, not fix it silently.

### 1c. The executable fixture for SC1

Verified in this session:

| Property | Value |
|----------|-------|
| Command | `/mos:snapshot` |
| `command-registry.json` `autonomous_safe` | `false` -> **MATERIAL** under `framework_run`'s authority |
| `connector-registry.json` posture | not `push_forward` -> **MATERIAL** under `chain_run`'s current authority too |
| Backing executable | `scripts/generate-hub.cjs` (`commands/snapshot.md:88`, `:126`) |
| Invocation | `node scripts/generate-hub.cjs <roomDir>` |
| Output artifact | `<roomDir>/exports/hub.html` (`generate-hub.cjs:2522`, `:2540`) |
| Dependencies | **zero npm deps**, node built-ins only (stated in the file header) |
| Determinism | pure filesystem read of the room, single `writeFileSync` |

This is the ideal SC1 fixture because it is material under BOTH authorities (so the parity fix in REACH-02 cannot accidentally reclassify it and invalidate the test), it is genuinely executable server-side, and the artifact's existence is a one-line filesystem assertion.

Secondary candidates if a second fixture is wanted: `/mos:whitespace` -> `scripts/whitespace-command.cjs <roomDir> map`; `/mos:diagnostics` -> `scripts/diagnostics-command.cjs <roomDir>`. Both are `autonomous_safe: true` in command-registry, so they exercise the auto-run prefix rather than the gate.

### 1d. Recommended shape for the real dispatcher

Create `lib/core/chain-step-dispatcher.cjs` (new, shared, CJS). It replaces `makeDefaultOnStep`'s body and becomes the WIRED default for `chain_run`. Two tiers:

```
dispatchStep(step, previousOutput, { roomDir, sessionId })
  -> resolve step.command to an executable via an EXPLICIT registry join
  -> TIER 1 (executable found):
       spawn it (child_process.spawnSync / execFileSync, bounded timeout),
       verify the declared artifact path exists,
       log the memory_event through navigation.cjs (Part 9),
       return { chain_output: { command, executed: true, artifact: <path>, exit_code },
                quality: <'high' on exit 0 + artifact present, 'low' otherwise> }
  -> TIER 2 (no executable -- methodology / prompt-backed):
       log the memory_event,
       return { chain_output: { command, executed: false,
                                requires_host_dispatch: true,
                                dispatch: { agent: 'framework-runner', command,
                                            room_path: roomDir, target_section } },
                quality: null }     // <-- NEVER 'high'
```

Tier 2 returning `quality: null` rather than `'high'` is what makes the honesty structural: the chain no longer propagates a fabricated success, and the caller gets a machine-readable directive naming exactly what the host must dispatch (which is precisely `agents/framework-runner.md`'s documented "Input Contract": framework, room_path, target_section, room_context, previous_output, chain_info).

**Where does the executable registry join come from?** There is no `executable` field in `data/command-registry.json` today. Two options:

| Option | How | Tradeoff |
|--------|-----|----------|
| **A (recommended)** | Add an optional `executable: { script, args, produces }` field to command frontmatter; `scripts/build-command-registry.cjs` picks it up (mirroring how it already picks up `autonomous_safe` at `:248` and `produces` at `:246`); populate it for the small script-backed set. | Declarative, discoverable, one generated source of truth, no parsing of markdown bodies at runtime. Requires a registry rebuild + `--check` re-run. |
| B | Parse `node "${CLAUDE_PLUGIN_ROOT}/scripts/X.cjs"` lines out of the command body at build time. | No frontmatter churn, but brittle (44 files match, most with model-filled parameters like `ROOM_DIR`/`ZONE_ID` that are not machine-resolvable). **Do not do this.** |

Option A also gives the mutation-proof leg a clean target: delete the `executable` join and the artifact stops appearing.

### 1e. Reuse of Phase 235's seam-liveness helper for SC1

`lib/core/seam-liveness.cjs` ships `assertSeamLive` plus four wrappers. Fit assessment for SC1's "prove the approve-to-execute seam live":

| Wrapper | Fit | Verdict |
|---------|-----|---------|
| `checkMintRatifierLiveness(mintedGateTypes, ratifierGateTypes)` | Claims = minted gate types; live = gate types some ratifier can consume. `chain_run` mints via `gate-render.renderGate` and consumes via its OWN `_resumeLedger`. That seam is already provably live (test-198-chain-run-halt exercises mint-then-consume). | **Not the right wrapper.** It proves the gate can be ANSWERED, which already works. It says nothing about whether the answer causes execution. Phase 238 (GATE-01) is the correct home for this wrapper. |
| `checkEnqueueConsumerLiveness(enqueuedQueueNames, registeredConsumerQueueNames)` | Claims = things enqueued; live = things with a registered drainer. | **Not a fit.** There is no queue in this seam. |
| `checkClaimedModuleLiveness([{id, live, reason}])` | Claims = module/surface ids a registry says exist and export something usable; the CALLER probes each one. | **Not a direct fit but the closest.** |
| `assertSeamLive({ name, claims, isLive })` -- the generic primitive | Claims = **every command the chain-step dispatcher's registry says is executable**; `isLive(command)` = the declared script exists on disk AND is a readable file. | **THIS IS THE FIT.** Recommended. |

**Recommended usage (concrete):**

```javascript
const { assertSeamLive } = require('../core/seam-liveness.cjs');

// The approve-to-execute seam: every command the dispatcher CLAIMS it can
// execute must name a script that actually exists.
const verdict = assertSeamLive({
  name: 'chain-step-dispatcher-claims-a-live-executable',
  claims: executableCommands,                 // from the generated registry
  isLive: (cmd) => fs.existsSync(scriptPathFor(cmd)),
});
```

This is a genuine seam in the module's own terms: the registry makes a CLAIM ("`/mos:snapshot` is executable via `scripts/generate-hub.cjs`") and the far end can quietly go away (a renamed or deleted script). Wire it into `tests/run-all-237.sh` and, if the plan wants it load-bearing rather than test-only, into `scripts/build-connector-registry.cjs`'s `coverageReport()` alongside CIRS-02's existing `checkClaimedModuleLiveness` consumption. Note the helper's discipline: **there is no options object and no force flag** -- do not try to pass one.

**Do NOT invent a fifth wrapper.** `assertSeamLive` is the documented generic and the module header explicitly says "Phases 237/238/239 consume the other three wrappers ... without reinventing this logic."

---

## Defect 2: REACH-02 -- two classification authorities

### 2a. The two paths, traced

```
framework_run  (lib/mcp/tools/sensors.cjs:306-366)
  -> composeWorkflow(chain)                     [command-resolver.cjs:110]
  -> validateChainAutonomy(workflow)            [command-resolver.cjs:131-143]
  -> reads data/command-registry.json commands[].autonomous_safe
  -> blocker when `c.autonomous_safe !== true`

chain_run      (lib/mcp/tools/chain.cjs:437-473)
  -> chainResolve(chain) = composeWorkflow      [same resolver, agrees here]
  -> chainRun(workflow, {...})                  [chain.cjs:284]
  -> postureFn defaults to chain.cjs's OWN postureForCommand   [chain.cjs:294]
  -> _loadPostureIndex()                        [chain.cjs:138-156]
  -> reads data/connector-registry.json connectors[].posture
  -> autonomous_safe := (posture === 'push_forward')           [chain.cjs:170]
  -> handed to chainExecutor.runChain as opts.postureFn        [chain.cjs:298]
     ... which OVERRIDES chain-executor's own _defaultPostureFn
         (= recipe-maps.postureForCommand = command-registry)  [chain-executor.cjs:181-187]
```

The override at `chain.cjs:298` is the entire defect. Without it, `chain_run` would already agree with `framework_run`.

### 2b. Why they disagree: two different frontmatter fields, two different meanings

Both fields live in the SAME command markdown file, and they mean different things:

| Field | Location in frontmatter | Vocabulary | Meaning | Built by |
|-------|------------------------|------------|---------|----------|
| `autonomous_safe` | top level | boolean | "may this command run unattended?" -- an **autonomy** flag | `scripts/build-command-registry.cjs:248` -> `data/command-registry.json` |
| `connector.posture` | inside the `connector:` block | frozen 3: `push_forward` / `hold` / `pull_back` | which way this REACH moves the navigator -- a **pedagogical** dial | `scripts/build-connector-registry.cjs:580` -> `data/connector-registry.json` |

Worked examples read from the real files:

| Command | `autonomous_safe` | `connector.posture` | Reading |
|---------|------------------|---------------------|---------|
| `commands/new-project.md` | ABSENT (-> false) | `push_forward` (`:28`) | Pedagogically it pushes the navigator forward. It is NOT safe to run unattended (it creates a project). `chain_run` auto-runs it today. |
| `commands/ignite.md` | ABSENT (-> false) | `push_forward` (`:28`) | Its own body at `:43` says "The three birth gates ... every birth step is forced-material -- birth is all human decisions. Nothing auto-runs." **`chain_run` classifies it autonomous_safe.** The file contradicts the classification. |
| `commands/build-thesis.md` | `true` (`:15`) | `hold` (`:27`) | Safe to run unattended; pedagogically a standing offer. `chain_run` gates it unnecessarily. |
| `commands/causal.md` | `true` (`:16`) | `context_block` reach, non-push posture | Same shape. |

Reading `posture === 'push_forward'` as `autonomous_safe` is a **category error**, not a data drift. This matters for the plan: no amount of re-syncing the two data files fixes it, because they are not supposed to agree. One of them must stop being consulted for this question.

Note that `chain.cjs`'s own header comment (`:11`, `:130-132`) asserts it is honoring "T-166-02 discipline" and "never re-derives posture". It is honoring the withhold-default half of that discipline (an unknown command -> `halt`) while violating the authority half.

### 2c. Measured disagreement (live, this session)

Run against the real `data/command-registry.json` (112 commands) and `data/connector-registry.json` (198 connectors):

```
agree: 64      DISAGREE: 48      (43% of the registry)
```

Split by direction:

| Direction | Count | Risk |
|-----------|-------|------|
| `chain_run` says autonomous_safe, `framework_run` says material | **12** | **SAFETY-CRITICAL.** `chain_run` auto-runs, unattended, a step the other entry point gates. |
| `chain_run` says material, `framework_run` says autonomous_safe | 36 | Friction only (over-gating). |

The 12 dangerous commands, in full:

```
/mos:auto-explore      /mos:discover          /mos:ignite            /mos:ingest-methodology
/mos:memory-cortex-reach  /mos:mva-brief      /mos:mva-option        /mos:new-project
/mos:new-surface       /mos:opportunities     /mos:pipeline          /mos:skill
```

Additional finding: **30 of the 112 registered commands have NO posture entry at all in `connector-registry.json`** (`/mos:admin`, `/mos:agentshield`, `/mos:brain-derive`, `/mos:correct-reference-now`, `/mos:doctor`, `/mos:dogfood-flush`, `/mos:export`, `/mos:feynman-timeline-refresh`, `/mos:heal`, `/mos:help`, and 20 more). Those all fall to `chain.cjs`'s withhold-default (`halt`), which is safe, but it means `chain_run` gates 30 commands purely because it is looking in the wrong index.

Posture distribution in `connector-registry.json`: `hold: 110`, `push_forward: 49`, `pull_back: 18`.

### 2d. The ONE shared authority already exists

Call-site census of `postureForCommand` across `lib/`, `scripts/`, `tests/`:

| Consumer | Which authority | Verdict |
|----------|----------------|---------|
| `lib/core/chain-executor.cjs:183` (`_defaultPostureFn`) | `recipe-maps.postureForCommand` | correct |
| `scripts/act-command.cjs:240` | `recipeMaps.postureForCommand` | correct |
| `lib/core/framework-chain-composer.cjs:511` | `recipeMaps.postureForCommand` | correct |
| `lib/core/bono/debate-composition.cjs:25` | recipe-maps manifest | correct |
| `lib/core/eureka/explore-chain.cjs:85` | via the loop -> recipe-maps | correct |
| `tests/test-205-pipelining.cjs:89`, `tests/test-recipe-maps-authority.cjs:42`, `tests/test-201-harness-manifest.cjs:211` | recipe-maps | correct |
| **`lib/mcp/tools/chain.cjs:164`** | **connector-registry posture** | **THE DEVIANT** |

And `recipe-maps.postureForCommand` (`lib/core/recipe-maps.cjs:177-190`) delegates straight to `resolver.validateChainAutonomy([{step:1, command}])` -- i.e. **exactly what `framework_run` calls.** The module's own header (`:14-22`) already names itself "posture / autonomy authority ... the ONE posture authority".

**So the shared authority module is `lib/core/recipe-maps.cjs::postureForCommand`, and it is already wired everywhere except one file.** Canon Part 7 (Reuse Before Build) makes this a delete-and-point, not a build.

### 2e. Recommended fix (prescriptive)

1. **Delete** `lib/mcp/tools/chain.cjs:134-176`: `CONNECTOR_REGISTRY_PATH`, `PUSH_FORWARD`, `_postureIndexCache`, `_loadPostureIndex`, `postureForCommand`, `__resetPostureCache`.
2. **Delete** the `postureFn` default override at `chain.cjs:294` so `chainExecutor.runChain`'s own `_defaultPostureFn` (= recipe-maps) applies. Keep `opts.postureFn` as an injectable test seam (test-198-chain-run-halt uses it via `onStep`; other callers may inject).
   - *Alternative if the plan prefers an explicit named reference over an implicit default:* `const postureFn = o.postureFn || require('../../core/recipe-maps.cjs').postureForCommand;`. Either is acceptable; the implicit-default form is one fewer require and one fewer thing to drift.
3. **Update** `chain.cjs`'s module header (`:11`, `:128-133`) which currently documents the connector-registry join as intentional. Leaving that comment in place would invite a future re-introduction.
4. **Update** `lib/mcp/tools/chain.cjs`'s `module.exports` (`:505`) which currently exports `postureForCommand`. **This is a breaking export change**: `tests/test-198-chain-run-halt.test.cjs:68-75` asserts on it, and those three assertions currently encode the WRONG authority (they assert a `push_forward` connector command is `autonomous_safe: true`). Those assertions must be retargeted to the command-registry authority in the same change, or the fix will read as a test regression.
5. **Build** the parity gate (SC2). See "Validation Architecture" below.
6. **Re-run** `node scripts/build-connector-registry.cjs --check` and `node scripts/build-orchestration-projection.cjs --check` (Canon Part 11 gates).

### 2f. Preventing reintroduction of a second path (SC2's second clause)

SC2 requires the gate to fail "on reintroduction of a second classification path". Two complementary mechanisms; the plan should ship both:

| Mechanism | What it catches | How |
|-----------|-----------------|-----|
| **Parity walk** (behavioral) | any divergence in the ANSWER | walk all 112 registry commands through both entry points, assert identical `autonomous_safe`. Fails on drift regardless of cause. |
| **Source fence** (structural) | a NEW reader of the wrong field | grep fence over `lib/mcp/tools/*.cjs` + `lib/core/chain-executor.cjs` for `connector-registry` + `push_forward` co-occurring in an autonomy context. Precedent for this fence style already exists in-repo: `tests/test-recipe-maps-authority.cjs` runs a forbidden-token scan, and `tests/test-198-local-only.test.cjs` is a source-grep floor. |

The behavioral walk alone is insufficient because a second path that happens to agree today would pass while sitting there waiting to drift.

---

## Defect 3: REACH-03 -- cross-session signal bleed

### 3a. Root cause, exact

`lib/core/insight-sensors.cjs:249-286`:

```javascript
function deriveTurnSignals(ctx) {
  const roomDir = ctx.roomDir;                                   // <-- ONLY roomDir
  const sideDir = path.join(roomDir, '.mindrian');

  // (a) artifact_filed
  const cascadePath = path.join(sideDir, 'last-cascade.json');
  if (fs.existsSync(cascadePath) && isFreshFile(cascadePath)) {  // <-- mtime only
    const payload = readJsonSafe(cascadePath);
    if (payload?.proactive_intelligence?.newFindings?.length > 0) out.push('artifact_filed');
  }

  // (b) first_material
  for (const name of fs.readdirSync(sideDir)) {
    if (name.startsWith('auto-explore-') && name.endsWith('.json')
        && isFreshFile(path.join(sideDir, name))) { out.push('first_material'); break; }
  }
}
```

Freshness window: `SIGNAL_FRESHNESS_MS = 30 * 60 * 1000` (`:209`). `isFreshFile` (`:220-228`) is a pure mtime check with a future-date guard.

**The bug in one sentence:** freshness is being used as a proxy for ownership, and it is not one.

Three independent failures stack:
1. Neither marker file's PATH carries a session id (`last-cascade.json` is a single fixed filename per room; `auto-explore-<material_id>.json` keys on a content sha8, not a session).
2. Neither marker file's CONTENT carries a session id. `scripts/post-write:105-118` builds the cascade payload with `timestamp`, `file_path`, `section`, `cascade_status`, `classification`, `git_commit`, `graph_index`, `proactive_intelligence` -- **and nothing else.** `scripts/auto-explore-fire.cjs:271` writes the finding JSON with no session field (`grep -n "session" scripts/auto-explore-fire.cjs` returns one comment, zero code).
3. `deriveTurnSignals` receives only `ctx`, and `ctx` has no `sessionId` to compare against even if the file had one.

**Reproduction (deterministic, no race needed):** session A files an artifact -> `post-write` writes `last-cascade.json` -> within 30 minutes session B calls `suggest_next` -> `deriveTurnSignals` returns `['artifact_filed']` -> `sensorArtifactFiled` fires -> B's candidate reach is A's signal. The RCA's own live evidence confirms the downstream half of this: once the room resolved correctly, `suggest_next` produced `reach_id: context_block, signal: jtbd_changed` from room state, proving the dispatch machinery consumes these signals for real.

### 3b. Second reader of the same file

`lib/core/insight-sensors.cjs:552-580`, `sensorArtifactFiled`, independently re-reads `<roomDir>/.mindrian/last-cascade.json` (`:575`). The header comment at `:236-237` states the gate is deliberately duplicated "so signal and sensor agree". **Both readers must get the session scoping**, or the sensor will fire on A's marker even when the derived signal is correctly suppressed.

### 3c. Full inventory of room-scoped freshness markers (the blast radius)

| Marker file | Read by | Produces | Session-scoped today? |
|-------------|---------|----------|----------------------|
| `<roomDir>/.mindrian/last-cascade.json` | `deriveTurnSignals` (a) AND `sensorArtifactFiled` (`:575`) | signal `artifact_filed` | NO |
| `<roomDir>/.mindrian/auto-explore-*.json` | `deriveTurnSignals` (b) | signal `first_material` | NO |
| `<roomDir>/.mindrian/last-eureka.json` | `sensor-eureka.cjs:151` | eureka reach | NO |
| `<roomDir>/.mindrian/last-opportunity-harvest.json` | `sensor-opportunity-harvest.cjs:139` | `context_block` reach | NO |
| `<roomDir>/.mindrian/url-ingest-ledger.json` | `sensor-url-ingest.cjs` | `deep_research` dedup ledger | NO |
| `<roomDir>/.mindrian/` (diffusion marker scan) | `sensor-diffusion-adoption.cjs:125` | `brain_consult` reach | NO |

**Scoping recommendation:** SC3 requires only that "a stale marker seeded by session A never surfaces in B's reach" -- one marker, one leg, one mutation. Fix the **two `deriveTurnSignals` markers plus `sensorArtifactFiled`** in this phase (they are the two named in the module's own doctrine header at `:31-33`, and they are the ones SC3's wording targets). Design the session-scope helper so the other four can adopt it later without a second mechanism, and **record the remaining four explicitly in the SUMMARY as known-unscoped**, so a future reader cannot mistake silence for coverage. Do not silently fix all six and blow the phase's blast radius.

### 3d. The session-id plumbing path (end to end, all links verified)

| Link | Status | Evidence |
|------|--------|----------|
| Claude Code gives hooks a `session_id` on stdin | **AVAILABLE** | official docs, common input field on every hook event including PostToolUse |
| `scripts/post-write` can read it | **AVAILABLE** | it already parses hook stdin JSON (`HOOK_INPUT=$(cat)` at `:130-135`); `grep -n "session" scripts/post-write` returns zero hits today, so it is discarded |
| `scripts/post-write` can stamp it | **TRIVIAL** | add one `--arg sid` to the `jq -nc` payload builder at `:105-118` |
| `scripts/auto-explore-fire.cjs` can stamp it | **NEEDS CHECK** | it is spawned detached by `auto-explore-fingerprint.cjs`; the planner must confirm a session id reaches that spawn, or accept a degrade (see below) |
| MCP path has a session id at dispatch time | **AVAILABLE** | `lib/mcp/tools/sensors.cjs:196/225` already computes `resolveEffectiveSessionId(undefined, extra)` and passes it into `buildSensorInputs(sessionId, roomDir, ...)` (`:83-92`), which puts it on `turn.sessionId` |
| CLI path has a session id at dispatch time | **AVAILABLE ON `turn`, ABSENT ON `ctx`** | `navigation-engine.cjs:842-844` builds `sensorCtx = { roomDir, lowFillSections }` with no sessionId; but `decide(turn, ...)`'s `turn` carries `sessionId` per the contract at `:796`, and `normalizeTurn(turn, ctx, tuple)` (`:312`) has BOTH in scope when it calls `deriveTurnSignals(ctx)` at `:328` |

**Recommended change:** widen the signature to `deriveTurnSignals(ctx, sessionId)` and call it as `deriveTurnSignals(ctx, base.sessionId || (ctx && ctx.sessionId) || null)` from `normalizeTurn:328`. This requires **no change to either caller of `dispatchSensors`**, because `normalizeTurn` already receives the turn. That is the smallest correct seam.

**The degrade rule (critical, get this right):**

| Marker state | Caller state | Verdict |
|--------------|-------------|---------|
| marker has `session_id`, matches caller | session id known | **fire** |
| marker has `session_id`, differs from caller | session id known | **suppress** -- this is the bug being fixed |
| marker has NO `session_id` (legacy / pre-fix file) | session id known | **fire** (backward compatible; do not break every existing room on upgrade) |
| marker has `session_id` | caller session id is null/unknown | **fire** (an unknown caller cannot prove ownership either way; suppressing would silently kill the signal on every surface where the session id does not resolve, which per the `resolveEffectiveSessionId` RCA is a real and common state on stdio) |

Suppress ONLY on a **positive mismatch** -- both sides present AND different. Anything else fires. This is the conservative direction: a fix that over-suppresses would be a second silent-failure bug of exactly the kind this milestone exists to remove, and it would be much harder to notice than the bleed it replaces.

**Prior art for the per-session file shape**, if the plan prefers a path-scoped approach over content-stamping: `lib/core/session-presence.cjs` already establishes `<roomDir>/.mindrian/sessions/<sessionId>.json` as the per-room per-session convention, with atomic writes, a `STALE_MS = 300000` window, and pid-liveness probing. Content-stamping is recommended over path-scoping here because `last-cascade.json`'s single-fixed-filename contract is read by several other consumers (`skills/room-proactive/SKILL.md`, `scripts/memory-completion-detector.cjs:41`, `lib/core/unknowns/orchestrator.cjs`), and moving the file would break them.

### 3e. Scope fence (from the routed-in RCA)

`.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`, "Tests to Add or Update":

- **Test 1** (`MINDRIAN_MCP_FIRST` unset, `room_bind` then a read tool, assert `room_dir` matches the bound room) -- this is a ROOM-BINDING test.
- **Test 2** (session A seeds a stale marker, session B pulls a candidate reach, assert B sees only its own signals) -- this is the SIGNAL-STALENESS test.

**The task brief for this research states Phase 237/REACH-03 takes "ONLY the session-scoping acceptance test described in this RCA's Test 1 section".** Read literally against the RCA file, Test 1 is the room-binding leg and Test 2 is the signal leg -- but Phase 237's own SC3 ("a stale marker seeded by session A never surfaces in B's reach") is verbatim Test 2, and REQUIREMENTS.md REACH-03 says "another concurrent session's stale marker". The ROADMAP's carried-in-defect note resolves it: "v1.16.0 Phase 237 keeps only the session-scoping acceptance test (REACH-03); it must NOT attempt the resolver collapse."

**Resolution for the planner:** build to **SC3 as written in ROADMAP.md** (the stale-marker / signal-staleness leg, which is the RCA's Test 2 text). Flag the numbering discrepancy in the PLAN so it is a recorded decision rather than a silent reinterpretation. Either way, the fence that actually matters is unambiguous and binding:

**OUT OF SCOPE for Phase 237 (v1.17.0 "MCP-First" milestone owns it):**
- Collapsing the eight copies of the gate-then-fallthrough room resolver (`lib/mcp/tools/{sensors,room,graph,gate,chain,status,views}.cjs` + `lib/mcp/tool-router.cjs:116-132` `resolveWriteTargetDir`).
- Making `room_bind` authoritative regardless of `MINDRIAN_MCP_FIRST`.
- Changing `room_bind`'s response contract (`tool-router.cjs:1611-1621`) to disclose `effective: bool`.
- Any change to `lib/mcp/mcp-first-flag.cjs`.

Note that `lib/mcp/tools/chain.cjs:83-96` contains one of those eight resolver copies. **Do not "clean it up" while you are in the file for REACH-01/REACH-02.** That is the exact trap the split routing exists to prevent.

---

## Recommended Implementation Order

| Wave | Requirement | Why this order |
|------|-------------|----------------|
| 1 | **REACH-02** | Smallest diff (delete ~45 lines, repoint one default), largest immediate safety delta (closes 12 unattended-auto-run holes), and it makes REACH-01's fixture trustworthy: with two authorities live, "is `/mos:snapshot` material?" has two answers and the SC1 test rests on sand. Touches `chain.cjs` and `tests/test-198-chain-run-halt.test.cjs` only. |
| 2 | **REACH-01** | Depends on Wave 1's settled classification. Two sub-legs: (a) delete the decorative `decide()` default from `chain-executor.cjs` (independent, no dependency on the dispatcher, can land first); (b) the real dispatcher + registry `executable` field + `chain.cjs` rewire. Touches `chain-executor.cjs`, `chain.cjs`, new `lib/core/chain-step-dispatcher.cjs`, `scripts/build-command-registry.cjs`, command frontmatter. |
| 3 | **REACH-03** | Fully independent of 1 and 2 -- **different files entirely** (`lib/core/insight-sensors.cjs`, `scripts/post-write`, `scripts/auto-explore-fire.cjs`). **Safe to run in PARALLEL with waves 1-2.** Zero file overlap with the other two. |

**Zero-overlap check (do this before parallelizing):**

| File | REACH-01 | REACH-02 | REACH-03 |
|------|:--------:|:--------:|:--------:|
| `lib/mcp/tools/chain.cjs` | YES | YES | -- |
| `lib/core/chain-executor.cjs` | YES | -- | -- |
| `lib/core/chain-step-dispatcher.cjs` (new) | YES | -- | -- |
| `scripts/build-command-registry.cjs` | YES | -- | -- |
| `tests/test-198-chain-run-halt.test.cjs` | YES | YES | -- |
| `lib/core/insight-sensors.cjs` | -- | -- | YES |
| `scripts/post-write` | -- | -- | YES |
| `scripts/auto-explore-fire.cjs` | -- | -- | YES |

REACH-01 and REACH-02 both write `chain.cjs` and `test-198-chain-run-halt.test.cjs`, so they must be **sequential**. REACH-03 is disjoint and can be a parallel wave.

---

## Architecture Patterns

### System Architecture Diagram

```
                    NAVIGATOR / HOST (Claude Code CLI, Desktop, Cowork)
                              |                        |
             MCP tool call    |                        |  slash command
                              v                        v
              +-------------------------+   +--------------------------+
              |  lib/mcp/tool-router.cjs |   |  commands/*.md bodies    |
              |  registers tool modules  |   |  (act, pipeline, ignite) |
              +-------------------------+   +--------------------------+
                    |            |                     |
        framework_run|            |chain_run            | dispatches Agent tool
       (sensors.cjs) |            |(chain.cjs)          v
                    |            |            +---------------------------+
                    |            |            | agents/framework-runner.md|
                    |            |            | (SUBAGENT -- the ONLY     |
                    |            |            |  executor of methodology  |
                    |            |            |  commands. Files artifact)|
                    |            |            +---------------------------+
                    v            v                     ^
        +---------------------------------+            |
        | AUTONOMY CLASSIFICATION          |            | REACH-01: MCP server
        | REACH-02 DEFECT: two answers     |            | CANNOT reach here.
        |                                  |            | Tier-2 must emit a
        |  framework_run --> validateChain |            | host-dispatch directive
        |                    Autonomy      |            | instead of faking it.
        |                      |           |            |
        |  chain_run ------> chain.cjs's   |            |
        |                    own posture   |            |
        |                    index (WRONG) |            |
        |                      |           |            |
        |    FIX: both -> recipe-maps      |            |
        |         .postureForCommand       |            |
        +---------------------------------+            |
                    |                                   |
                    v                                   |
        +---------------------------------+             |
        | lib/core/chain-executor.cjs      |             |
        |   runChain loop                  |             |
        |   makeGateFn (run|halt)          |             |
        |   [decorative decide() -- REMOVE]|             |
        +---------------------------------+             |
              |  halt at material step                   |
              v                                          |
        +---------------------------------+              |
        | lib/mcp/gate-render.cjs          |              |
        |  renderGate -> gate_id           |              |
        |  3 rungs: elicitation / AskUser  |              |
        |           Question / text        |              |
        +---------------------------------+              |
              |  mint into chain.cjs _resumeLedger        |
              |  (single-use, 30min TTL)                  |
              v                                          |
        [ NAVIGATOR ANSWERS: approve / reject / defer ]   |
              |                                          |
              v  approve -> _resumeFromGateAnswer         |
        +---------------------------------+              |
        | onStepFn  <-- REACH-01 DEFECT    |              |
        |   today: makeDefaultOnStep       |              |
        |     logs memory_event,           |              |
        |     returns quality:'high' (LIE) |              |
        |                                  |              |
        |   FIX: chain-step-dispatcher     |              |
        |     TIER 1 script-backed ------> spawn -> artifact on disk
        |     TIER 2 methodology --------> host-dispatch directive ---+
        |              (quality: null)     |
        +---------------------------------+
                    |
                    v  (Part 9: all writes)
        +---------------------------------+
        | lib/core/navigation.cjs          |
        |   THE SQL chokepoint -> room.db  |
        +---------------------------------+


        ---- REACH SIGNAL PRODUCTION (independent subsystem) ----

  session A                                        session B
      |                                                |
      | files artifact                                 | calls suggest_next
      v                                                v
  scripts/post-write                          lib/mcp/tools/sensors.cjs
      |  writes (NO session id)                        |  buildSensorInputs
      v                                                v
  <roomDir>/.mindrian/last-cascade.json ------> lib/core/insight-sensors.cjs
  <roomDir>/.mindrian/auto-explore-*.json        normalizeTurn
      ^                                                |
      |  30-min mtime window is the ONLY gate          v
      |                                          deriveTurnSignals(ctx)
      +----- REACH-03 DEFECT: B reads A's -------------+   <-- ctx has NO sessionId
             marker as its own turn signal             |
                                                       v
                                              SENSOR_REGISTRY (16 sensors)
                                                       |
                                                       v
                                              candidate reaches -> reach card
```

### Component Responsibilities

| File | Owns | Changes in this phase |
|------|------|----------------------|
| `lib/mcp/tools/chain.cjs` | `chain_resolve` + `chain_run` MCP registration; resume ledger; material-step card | REACH-01 (rewire onStep default), REACH-02 (delete local posture authority) |
| `lib/mcp/tools/sensors.cjs` | 4 sensor pulls + `framework_run` | none required (already reads the correct authority) |
| `lib/core/chain-executor.cjs` | `runChain` loop, gate predicate, retry/journal | REACH-01 (remove decorative decide() default; KEEP the `decideFn` opts seam) |
| `lib/core/recipe-maps.cjs` | THE posture/autonomy authority | none (becomes the sole authority by subtraction elsewhere) |
| `lib/workflow/command-resolver.cjs` | framework -> command resolution + `validateChainAutonomy` | none |
| `lib/core/chain-step-dispatcher.cjs` | **NEW** -- two-tier step execution | created |
| `lib/core/insight-sensors.cjs` | sensor registry, `dispatchSensors`, `normalizeTurn`, `deriveTurnSignals` | REACH-03 (session-scope the two derived signals + `sensorArtifactFiled`) |
| `scripts/post-write` | cascade side-channel writer | REACH-03 (stamp `session_id`) |
| `scripts/auto-explore-fire.cjs` | auto-explore fire marker writer | REACH-03 (stamp `session_id` if reachable) |
| `scripts/build-command-registry.cjs` | generates `data/command-registry.json` | REACH-01 (emit optional `executable` field) |
| `lib/core/seam-liveness.cjs` | generic seam-liveness primitive | consumed, never modified |

### Pattern 1: Withhold-default (T-166-02)

**What:** an unknown/unreadable input degrades to the SAFE verdict (`autonomous_safe: false, posture: 'halt'`), never a fabricated safe.
**Where it already lives:** `chain-executor.cjs:186`, `recipe-maps.cjs:179`, `chain.cjs:166` (the one thing `chain.cjs` gets right).
**Apply in this phase:** the new dispatcher's Tier-2 returns `quality: null`, never `'high'`. An unresolvable command halts.

```javascript
// Source: lib/core/chain-executor.cjs:181-187 (shipped)
function _defaultPostureFn(command) {
  const rm = _loadRecipeMaps();
  if (rm && typeof rm.postureForCommand === 'function') return rm.postureForCommand(command);
  return { command: command || null, autonomous_safe: false, posture: 'halt' };
}
```

### Pattern 2: Fail-OPEN on a filter, fail-CLOSED on a gate

**What:** a GATE (may this run?) fails closed. A FILTER (should this signal surface?) fails open.
**Where it already lives:** `session-binding.cjs:120-124` (`isRoomInWriteScope` fails open: "a false block is worse than a false allow"); `chain-executor.cjs:517` (a gate fault -> `'halt'`, fail closed).
**Apply in this phase:** REACH-03's session-scope check is a FILTER. Suppress only on a positive mismatch (both ids present and different). Every other state fires. Getting this backwards trades a visible bug for an invisible one.

### Pattern 3: Atomic write (Phase 87-02)

**What:** `openSync(path, 'wx')` (or `mktemp` + `mv -f` in bash) + fsync + rename. Never `existsSync` -> `writeFileSync` (TOCTOU).
**Where it already lives:** `lib/core/write-lock.cjs:15-25`, `lib/core/session-binding.cjs:175-202`, `scripts/post-write:120-125`.
**Apply in this phase:** the marker writers already use it. Preserve it when adding the `session_id` field.

### Pattern 4: Two-process fence via `fork` + sibling worker

**What:** true OS-level concurrency for a concurrency test, not `Promise.all` inside one event loop.
**Where it already lives:** `lib/memory/write-lock-atomic.test.cjs` (20 forked children) + `lib/memory/write-lock-atomic.worker.cjs`. Comment at `:13-14`: "The test uses `child_process.fork` to get true OS-level concurrency, not mocked 'parallel' promises inside one event loop."
**Apply in this phase:** SC3 requires "two concurrent sessions live on one machine (two-process test)". Use this pattern with a `tests/test-237-session-scope.worker.cjs` sibling.

### Pattern 5: Hermetic MCP fixture with an isolated rooms home

**Where it already lives:** `tests/test-198-concurrency-mcp.test.cjs:36-56`. Creates `mkdtempSync` home, sets `MINDRIAN_ROOMS_HOME`, explicitly `delete process.env.CLAUDE_ACTIVE_ROOM` ("hermetic: leg-1 override must not leak from the host env"), saves/restores `MINDRIAN_MCP_FIRST`.
**Apply in this phase:** clone verbatim for the REACH-03 fixture. Note the env-leak deletions -- they are load-bearing, not decoration.

### Anti-Patterns to Avoid

- **Reading a semantic sibling field as if it were the field you want.** `posture === 'push_forward'` is not `autonomous_safe`. This defect existed for multiple phases behind a comment claiming the opposite.
- **Fabricating a success verdict when you cannot do the work.** `quality: 'high'` from a stub is the milestone's signature failure shape (the "silently skipped gates / false-success" bug class already tracked in the navigator's own memory).
- **Using freshness as a proxy for ownership.** A 30-minute mtime window says when, not who.
- **Cleaning up an adjacent copy-paste while you are in the file.** `chain.cjs:83-96` is one of the eight resolver copies. It is v1.17.0's. Leave it.
- **Removing an injection seam because its default is broken.** `chain-executor.cjs`'s `opts.decideFn` seam has one correct consumer (`act-command.cjs`). Remove the default; keep the seam.
- **Suppressing a signal on an unknown session id.** Fails the wrong way.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autonomy classification | a new `lib/core/autonomy-authority.cjs` | `lib/core/recipe-maps.cjs::postureForCommand` | It IS the declared "ONE posture authority" and is already the sole reader for 7 of 8 consumers. Canon Part 7. A new module would be a THIRD path while you are removing the second. |
| Session id resolution | a fourth resolver | `lib/core/session-binding.cjs::resolveEffectiveSessionId` | It already consolidates 20 call sites into the explicit > `extra.sessionId` > env > null ladder. Its own header cites SEED-034 "the four-guessers lesson". |
| Seam-liveness assertion | a bespoke reachability check | `lib/core/seam-liveness.cjs::assertSeamLive` | Phase 235 built it for exactly this; its header names Phase 237 as an intended consumer. Frozen behavior in `lib/core/seam-liveness.test.cjs` (10/10). |
| Gate render / answer normalization | a second card renderer | `lib/mcp/gate-render.cjs::renderGate` / `normalizeGateAnswer` | Already the shared 3-rung ladder for gate_render, gate_answer, framework_run, chain_run. |
| Chain loop | a second walk | `lib/core/chain-executor.cjs::runChain` | act, ignite, pipeline and chain_run all ride it. Adding a second loop is the exact D-166-04 violation. |
| Atomic file write | `existsSync` + `writeFileSync` | the Phase 87-02 `wx`/mktemp+rename pattern | TOCTOU race documented in `write-lock.cjs:20-24`. |
| Two-process concurrency test | `Promise.all` | `child_process.fork` + `*.worker.cjs` | `write-lock-atomic.test.cjs:13-14` names this explicitly. |
| Room resolution inside a tool module | a ninth copy, or a collapse | leave the existing copy alone | v1.17.0 owns the collapse. Touching it here creates a merge conflict with a milestone that has not started. |

**Key insight:** every single one of REACH-01/02/03 is a case of a second implementation quietly replacing a shared one. The correct instinct in this codebase is almost always *delete and point at the existing authority*, not *build a better one*.

---

## Common Pitfalls

### Pitfall 1: Fixing REACH-01 by writing a server-side methodology executor
**What goes wrong:** the plan produces a module that "runs" `/mos:analyze-needs` by writing a placeholder file or by logging harder. The gate goes green on a second lie.
**Why it happens:** SC1 says "its output artifact exists afterward", which reads like it demands artifact production for every command.
**How to avoid:** read the Hard Architectural Constraint section. Prove SC1 on a genuinely script-backed material command (`/mos:snapshot`); make methodology commands return an honest `requires_host_dispatch` directive with `quality: null`.
**Warning signs:** a new file under `lib/` that contains a prompt template; any code path that writes to `room/**/` without spawning a real script.

### Pitfall 2: Making chain_run's classification LAXER instead of stricter
**What goes wrong:** the parity fix is implemented by making `framework_run` read connector posture (the "make them agree" reflex), which newly auto-runs `/mos:new-project`, `/mos:ignite` and `/mos:pipeline` unattended.
**Why it happens:** "one authority" reads as symmetric; either direction satisfies the letter of SC2.
**How to avoid:** the direction is fixed. `command-registry.autonomous_safe` (via `recipe-maps`) is the authority; `connector.posture` is a pedagogy dial and must stop being consulted for autonomy. Assert the direction in the plan.
**Warning signs:** the parity gate goes green but the count of `autonomous_safe: true` commands INCREASES. Add an explicit assertion that `/mos:ignite`, `/mos:new-project` and `/mos:pipeline` classify MATERIAL after the fix.

### Pitfall 3: Removing the `decideFn` seam along with its default
**What goes wrong:** `scripts/act-command.cjs:250-268` breaks, and the Phase 172-08 CIRS R4 "one selection authority" wiring is silently reverted.
**How to avoid:** remove `_loadDecide()` and the two unadapted call sites; keep `opts.decideFn` honored where supplied.
**Warning signs:** `tests/test-act-on-runchain.cjs`, `tests/test-135-decide-wiring-e2e.cjs`, `tests/test-spine-navigates-decide.cjs` turn red.

### Pitfall 4: Session-scoping that suppresses everything
**What goes wrong:** `deriveTurnSignals` returns `[]` for every caller because the session id does not resolve on the surface under test, and the reach layer goes quiet. This is a WORSE bug than the bleed, and much harder to notice.
**Why it happens:** `resolveEffectiveSessionId` genuinely returns null on stdio when `extra.sessionId` is unpopulated and `CLAUDE_CODE_SESSION_ID` is unset -- this is the documented root cause of the already-resolved `registry-active-room-concurrent-session-collision` RCA.
**How to avoid:** suppress only on positive mismatch. Add an explicit GREEN test leg: "unknown caller session id -> the signal still fires."
**Warning signs:** `suggest_next` returns `candidates: []` on a room where it previously returned candidates.

### Pitfall 5: Fixing only the MCP half of REACH-03
**What goes wrong:** the fix lands in `lib/mcp/tools/sensors.cjs` and the CLI navigation-engine path (`navigation-engine.cjs:923`) stays broken. Tri-Polar violation (C8): CLI and Cowork keep bleeding.
**How to avoid:** the fix goes in `lib/core/insight-sensors.cjs`, the shared module both consumers call.
**Warning signs:** the diff touches `lib/mcp/` but not `lib/core/insight-sensors.cjs`.

### Pitfall 6: Forgetting the second reader of last-cascade.json
**What goes wrong:** `deriveTurnSignals` correctly suppresses, but `sensorArtifactFiled` (`insight-sensors.cjs:552-580`) re-reads the same file independently and fires anyway.
**How to avoid:** the module's own header at `:236-237` documents the duplication deliberately ("so signal and sensor agree"). Both readers get the scoping, or neither.
**Warning signs:** the two-process test's assertion on `signals` passes while the assertion on `candidates` fails.

### Pitfall 7: The existing chain_run test encodes the wrong authority
**What goes wrong:** the REACH-02 fix looks like a regression because `tests/test-198-chain-run-halt.test.cjs:68-75` asserts a `push_forward` connector command is `autonomous_safe: true`.
**How to avoid:** retarget those three assertions in the same commit as the fix, and say so in the commit message. Its fixture at `:44-50` selects steps by `c.posture === 'push_forward'` / `'hold'` from the connector registry and must be re-derived from `command-registry.autonomous_safe`.
**Warning signs:** a "test update" commit separated from the fix commit -- that reads as moving the goalposts unless it is one atomic change with the reason stated.

### Pitfall 8: Registry rebuild drift
**What goes wrong:** adding an `executable` field to command frontmatter without regenerating `data/command-registry.json`, or regenerating without re-running the `--check` gates.
**How to avoid:** `node scripts/build-command-registry.cjs`, then `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`.
**Warning signs:** the born-wired gate fails at commit time (Phase 235 made that gate actually fire in every worktree, so it will).

### Pitfall 9: Scope creep into v1.17.0
**What goes wrong:** while editing `chain.cjs` for two requirements, the eighth resolver copy at `:83-96` looks obviously wrong and gets fixed.
**How to avoid:** the ROADMAP fence is explicit and was navigator-confirmed (commit `9cd0f627`). Put it in the PLAN's Out-of-Scope section verbatim.
**Warning signs:** any diff touching `isMcpFirst`, `resolveWriteRoom`, `resolveActiveRoom`, `fallbackRoomDir`, or `mcp-first-flag.cjs`.

---

## Code Examples

### Verified: the current log-only executor (the thing to replace)

```javascript
// Source: lib/mcp/tools/chain.cjs:184-205 (READ FROM DISK 2026-07-28)
function makeDefaultOnStep(roomDir) {
  return async function onStep(step, _previousOutput) {
    const db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return { chain_output: null, quality: null };
    try {
      const logged = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
        label: 'chain_step_executed',
        step: step && step.step,
        command: step && step.command,
        framework: step && step.framework,
      });
      return {
        chain_output: { step: step && step.step, command: step && step.command, memory_event: logged },
        quality: 'high',
      };
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  };
}
```

### Verified: the second classification authority (the thing to delete)

```javascript
// Source: lib/mcp/tools/chain.cjs:164-176 (READ FROM DISK 2026-07-28)
function postureForCommand(command) {
  if (typeof command !== 'string' || command.length === 0) {
    return { command: command || null, autonomous_safe: false, posture: 'halt' };
  }
  const idx = _loadPostureIndex();            // reads data/connector-registry.json
  const posture = idx[command];
  const autonomousSafe = posture === PUSH_FORWARD;   // 'push_forward' -- WRONG FIELD
  return { command: command, autonomous_safe: autonomousSafe, posture: autonomousSafe ? 'run' : 'halt' };
}
```

### Verified: the correct authority (the thing to point at)

```javascript
// Source: lib/core/recipe-maps.cjs:177-190 (READ FROM DISK 2026-07-28)
function postureForCommand(command) {
  if (typeof command !== 'string' || command.length === 0) {
    return { command: null, autonomous_safe: false, posture: 'halt' };
  }
  const wf = [{ step: 1, command: command }];
  const verdict = resolver.validateChainAutonomy(wf);   // <-- SAME call framework_run makes
  const autonomousSafe = verdict.runnable === true && verdict.blockers.length === 0;
  // ...
}
```

### Verified: the decorative decide() call (the thing to remove)

```javascript
// Source: lib/core/chain-executor.cjs:491-505 (READ FROM DISK 2026-07-28)
let decisionTrace = null;
if (typeof decideFn === 'function') {
  try {
    // decide()'s contract is (turn={userText,sectionPath,sessionId}, context={quadruple,...}).
    // This passes {step,index} and {previousOutput}: every field decide() reads is undefined.
    const decision = decideFn({ step: step, index: i }, { previousOutput: previousOutput });
    decisionTrace = (decision && decision.decision_trace) ? decision.decision_trace : null;
  } catch (_e) {
    decisionTrace = null;
  }
}
// ... decisionTrace is stored at :606 and read by ZERO consumers.
```

### Verified: the correctly-adapted decide() injection (the thing to keep working)

```javascript
// Source: scripts/act-command.cjs:250-268 (READ FROM DISK 2026-07-28)
decideFn: (function () {
  const realDecide = loadRealDecide();
  if (typeof realDecide !== 'function') {
    return function degradeNoDecision() { return null; };
  }
  return function (turn, context) {
    const idx = (turn && typeof turn.index === 'number') ? turn.index : 0;
    return realDecide(
      { userText: '', sectionPath: null, sessionId: 'act-chain-' + idx },   // ADAPTED
      context || {}
    );
  };
})(),
```

### Verified: the unscoped signal derivation (the REACH-03 defect)

```javascript
// Source: lib/core/insight-sensors.cjs:249-286 (READ FROM DISK 2026-07-28)
function deriveTurnSignals(ctx) {                    // <-- no sessionId parameter
  const roomDir = ctx.roomDir;
  const sideDir = path.join(roomDir, '.mindrian');
  const out = [];
  const cascadePath = path.join(sideDir, 'last-cascade.json');
  if (fs.existsSync(cascadePath) && isFreshFile(cascadePath)) {   // mtime only
    const payload = readJsonSafe(cascadePath);
    const pi = payload && payload.proactive_intelligence;
    if (pi && Array.isArray(pi.newFindings) && pi.newFindings.length > 0) out.push('artifact_filed');
  }
  for (const name of fs.readdirSync(sideDir)) {
    if (name.indexOf('auto-explore-') === 0 && name.slice(-5) === '.json'
        && isFreshFile(path.join(sideDir, name))) { out.push('first_material'); break; }
  }
  return out;
}
```

### Verified: the seam-liveness primitive (the thing to consume)

```javascript
// Source: lib/core/seam-liveness.cjs:58-87 (READ FROM DISK 2026-07-28)
// "There is deliberately no second parameter. No caller can weaken this verdict."
function assertSeamLive(seam) { /* -> { name, ok, claimedCount, liveCount, dead } */ }
```

---

## Runtime State Inventory

This is a code-change phase, not a rename or migration, so most categories are empty. Two are not, and they matter.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `room.db` `memory_event` rows already written by the log-only executor carry `label: 'chain_step_executed'` for steps that never executed. These are historical false records in every dogfood room. | **No data migration.** Do not rewrite history. The new dispatcher should use a DISTINCT label (e.g. `chain_step_dispatched` with an `executed: true/false` field) so old and new rows are distinguishable by inspection. Record this decision in the SUMMARY. |
| **Live service config** | None. No external service holds reach or posture config. | None. |
| **OS-registered state** | None. No scheduled task, pm2 process, or systemd unit references these surfaces. | None. |
| **Secrets / env vars** | `MINDRIAN_MCP_FIRST` (read by `chain.cjs:86` and `sensors.cjs:61`) -- **read but NOT changed by this phase.** `CLAUDE_CODE_SESSION_ID` -- read by `resolveEffectiveSessionId`; REACH-03 depends on it resolving, and it frequently does not on stdio (documented in the resolved `registry-active-room-concurrent-session-collision` RCA). | None changed. The REACH-03 degrade rule must tolerate `CLAUDE_CODE_SESSION_ID` being unset. |
| **Build artifacts** | `data/command-registry.json`, `data/connector-registry.json`, `data/mcp-tool-connectors.json`, `data/brain-orchestration-projection.json`, `data/harness-manifest.json` are all GENERATED and COMMITTED. REACH-01's `executable` field requires regenerating `command-registry.json`. | **Regenerate + re-run all `--check` gates** (see Pitfall 8). Never hand-edit a generated file. |
| **Stale marker files (REACH-03 specific)** | Every existing room has `last-cascade.json` and possibly `auto-explore-*.json` with NO `session_id` field. | **None -- and this is why the degrade rule matters.** A marker without a `session_id` must keep firing, or upgrading the plugin silently kills the reach layer in every existing room until the next write. |

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **Node built-in `node:assert` only.** No jest, no vitest, no mocha. Confirmed across `tests/*.cjs` and `lib/**/*.test.cjs`. |
| Config file | none -- each test is a standalone executable `.cjs` that exits 0/1 |
| Aggregator pattern | `tests/run-all-<phase>.sh` with `run` / `run_if` helpers (canonical source: `tests/run-all-198.sh:34-57`, itself cloned byte-identical from `tests/run-all-194.sh`) |
| Quick run command | `node tests/test-237-<leg>.cjs` |
| Full suite command | `bash tests/run-all-237.sh` |
| Phase gate | `bash tests/run-all-237.sh` green + `node scripts/doctor.cjs --acceptance` |

**SKIP-safe Wave 0 contract:** `run_if` gates each leg on the net-new artifact its wave introduces, so the aggregator can be authored BEFORE any code lands and exits cleanly with SKIPs. Follow this; it is how 198 and 194 were built and it is what lets the aggregator be a Wave-0 deliverable.

### Phase Requirements -> Test Map

| Req | SC | Behavior | Type | Automated Command | Exists? |
|-----|----|----------|------|-------------------|---------|
| REACH-01 | 1 | Approving a material step's gate causes the resolved command to run; `<roomDir>/exports/hub.html` exists afterward | integration | `node tests/test-237-approve-executes.cjs` | ❌ Wave 0 |
| REACH-01 | 1 | The chain trace records real execution (`executed: true`, exit code, artifact path), not only a log line | integration | same file | ❌ Wave 0 |
| REACH-01 | 1 | **MUTATION:** restoring the log-only `onStep` turns the gate RED (artifact absent) | mutation | same file, mutation harness | ❌ Wave 0 |
| REACH-01 | 1 | A methodology (Tier 2) step returns `quality: null` + `requires_host_dispatch: true`, NEVER `quality: 'high'` | unit | `node tests/test-237-dispatcher-tiers.cjs` | ❌ Wave 0 |
| REACH-01 | 1 | **Call-site census:** zero unadapted `decideFn(...)` calls remain in `chain-executor.cjs`; `opts.decideFn` seam still honored | source-fence + unit | `node tests/test-237-decide-census.cjs` | ❌ Wave 0 |
| REACH-01 | 1 | Regression: `act-command.cjs`'s adapted `decideFn` injection still reaches the real `decide()` | integration | `node tests/test-act-on-runchain.cjs` (existing) | ✅ exists |
| REACH-01 | 1 | Seam-liveness: every command the dispatcher claims executable names a script that exists on disk | unit | `node tests/test-237-executable-seam.cjs` via `assertSeamLive` | ❌ Wave 0 |
| REACH-02 | 2 | **Parity walk:** all 112 registry commands classify identically through `framework_run` and `chain_run` | integration | `node tests/test-237-autonomy-parity.cjs` | ❌ Wave 0 |
| REACH-02 | 2 | Direction assertion: `/mos:ignite`, `/mos:new-project`, `/mos:pipeline` are MATERIAL after the fix | unit | same file | ❌ Wave 0 |
| REACH-02 | 2 | **MUTATION:** re-pointing `chain_run` at connector posture turns the parity gate RED (expect ~48 disagreements) | mutation | same file, mutation harness | ❌ Wave 0 |
| REACH-02 | 2 | **Source fence:** no second classification path (`connector-registry` + `push_forward` in an autonomy context) in `lib/mcp/tools/*.cjs` or `lib/core/chain-executor.cjs` | source-fence | `node tests/test-237-one-authority-fence.cjs` | ❌ Wave 0 |
| REACH-02 | 2 | Retargeted: the three existing `postureForCommand` assertions now assert the command-registry authority | unit | `node tests/test-198-chain-run-halt.test.cjs` (**MODIFY**) | ⚠️ exists, wrong authority |
| REACH-03 | 3 | **Two-process:** session A seeds `last-cascade.json`; session B's `dispatchSensors` does NOT surface `artifact_filed` | integration, `fork` | `node tests/test-237-session-scope.cjs` + `tests/test-237-session-scope.worker.cjs` | ❌ Wave 0 |
| REACH-03 | 3 | Session B's OWN fresh marker DOES surface (the fix does not just suppress everything) | integration | same file | ❌ Wave 0 |
| REACH-03 | 3 | **Degrade GREEN:** a legacy marker with no `session_id` still fires | unit | `node tests/test-237-session-scope-degrade.cjs` | ❌ Wave 0 |
| REACH-03 | 3 | **Degrade GREEN:** an unknown caller session id still fires | unit | same file | ❌ Wave 0 |
| REACH-03 | 3 | `sensorArtifactFiled` (the second reader) is scoped too | unit | same file | ❌ Wave 0 |
| REACH-03 | 3 | **MUTATION:** removing the session scoping turns the two-process leg RED | mutation | `tests/test-237-session-scope.cjs` mutation harness | ❌ Wave 0 |
| REACH-03 | 3 | `scripts/post-write` stamps `session_id` from hook stdin | integration (bash) | `node tests/test-237-post-write-session-stamp.cjs` | ❌ Wave 0 |
| ALL | -- | Canon Part 8: zero Brain/network tokens in every touched file | source-fence | extend `tests/test-198-local-only.test.cjs` + `tests/test-sensors-part8-sweep.cjs` | ✅ exists, extend |
| ALL | -- | No em-dashes in any new or modified file | source-fence | em-dash sweep leg in `tests/run-all-237.sh` (pattern from `run-all-164`) | ❌ Wave 0 |
| ALL | -- | Born-wired / projection / render gates still green | gate | `node scripts/build-connector-registry.cjs --check` etc. | ✅ exists |

### Sampling Rate

- **Per task commit:** the single leg for that task (`node tests/test-237-<leg>.cjs`) plus the commit-time born-wired gate (Phase 235 made it fire in every worktree; it will run whether you invoke it or not).
- **Per wave merge:** `bash tests/run-all-237.sh`.
- **Phase gate:** `bash tests/run-all-237.sh` green + `node scripts/doctor.cjs --acceptance` + the three `--check` gates + full suite before `/gsd-verify-work`.

### Mutation-Proof Requirement (Canon: "a gate that cannot fail is not a gate")

Every success criterion carries an explicit mutation leg. All three SCs name it in their own wording ("a mutation restoring log-only execution turns the gate red", "fails on any disagreement or on reintroduction of a second classification path", "removing the session scoping turns that leg red"). Follow the Phase 241/242 precedent: the mutation is DEMONSTRATED (run it, capture the RED, revert), not asserted in prose.

**Suggested mutation harness shape** (matches how 241/242 did it): a test that copies the target module to a temp path, applies a textual mutation, requires the mutated copy through a cleared `require.cache`, asserts the gate goes red, and restores. Do not mutate the working tree.

### Wave 0 Gaps

- [ ] `tests/run-all-237.sh` -- SKIP-safe aggregator (clone `tests/run-all-198.sh`'s run/run_if helpers)
- [ ] `tests/test-237-approve-executes.cjs` -- REACH-01 SC1 + mutation
- [ ] `tests/test-237-dispatcher-tiers.cjs` -- REACH-01 tier-2 honesty
- [ ] `tests/test-237-decide-census.cjs` -- REACH-01 call-site census + seam preservation
- [ ] `tests/test-237-executable-seam.cjs` -- REACH-01 seam-liveness consumption
- [ ] `tests/test-237-autonomy-parity.cjs` -- REACH-02 SC2 parity walk + mutation
- [ ] `tests/test-237-one-authority-fence.cjs` -- REACH-02 source fence
- [ ] `tests/test-237-session-scope.cjs` + `tests/test-237-session-scope.worker.cjs` -- REACH-03 SC3 two-process + mutation
- [ ] `tests/test-237-session-scope-degrade.cjs` -- REACH-03 fail-open legs
- [ ] `tests/test-237-post-write-session-stamp.cjs` -- REACH-03 writer leg
- [ ] `tests/fixtures/237-seeded-room/` -- a seeded room fixture (or `mkdtempSync` builder) with enough content for `generate-hub.cjs` to produce a non-trivial `hub.html`
- [ ] **MODIFY** `tests/test-198-chain-run-halt.test.cjs` -- retarget the three `postureForCommand` assertions and re-derive the fixture from `command-registry.autonomous_safe`
- [ ] Framework install: **none.** `node:assert` is built in.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | `engines` floor per `package.json`; `>=22.5.0` per CLAUDE.md stack table | -- |
| `node:assert`, `node:child_process`, `node:fs`, `node:sqlite` | tests, dispatcher, room.db | ✓ | built in | -- |
| `scripts/generate-hub.cjs` | REACH-01 SC1 fixture | ✓ | in-repo, zero npm deps | `scripts/whitespace-command.cjs` or `scripts/diagnostics-command.cjs` |
| `data/command-registry.json` | REACH-02 parity walk | ✓ | 112 commands | -- |
| `data/connector-registry.json` | REACH-02 mutation leg | ✓ | 198 connectors | -- |
| `lib/core/seam-liveness.cjs` | REACH-01 seam proof | ✓ | Phase 235-02, shipped | -- |
| `jq` | `scripts/post-write` session stamp | ✓ (already a hard dependency of post-write) | -- | post-write already soft-fails without it |
| langtalks-graph-expert MCP | grounding | ✓ (via direct stdio; MCP tools stripped from restricted-tool agents) | v1.28.x | direct JSON-RPC over stdio, as done here |
| Context7 MCP / `ctx7` CLI | not needed this phase | ✗ (`ctx7` not installed) | -- | not required; no third-party library claim in scope |
| `claude-api` skill | Claude Code grounding | ✗ NOT INSTALLED | -- | **official docs at code.claude.com** (used; more authoritative for tool contracts) |
| `claude-code-guide` agent | Claude Code grounding | ✗ NOT INSTALLED | -- | same |

**Missing dependencies with no fallback:** none. Nothing blocks execution.

**Missing dependencies with fallback:** the `claude-api` skill and `claude-code-guide` agent are absent; official Claude Code documentation was used instead and is at least as authoritative for the two questions asked (hook payload fields, MCP server capabilities). The planner should NOT record these as "consulted the skill".

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth surface in this phase |
| V3 Session Management | **YES** | REACH-03 is literally a session-scoping defect. Control: `lib/core/session-binding.cjs::resolveEffectiveSessionId` as the single session-identity source; positive-mismatch-only suppression; no session id is ever used as a filesystem path segment without `isSafeSlug` (already enforced at `session-binding.cjs:45-53`). |
| V4 Access Control | **YES** | REACH-02's 12 dangerous commands are an authorization defect: `chain_run` grants unattended execution to 12 commands the other entry point requires human approval for. Control: one authority, fail-closed withhold-default. |
| V5 Input Validation | **YES** | REACH-01's dispatcher will spawn a child process from a registry-derived path. Control: the executable path must come from the GENERATED registry (build-time validated), never from a command string, never from user input, and must be invoked via `execFileSync`/`spawnSync` with an argv ARRAY -- never a shell string. `zod` already validates the MCP tool inputs at `chain.cjs:440-449`. |
| V6 Cryptography | no | `gate-render.cjs` uses `node:crypto` for gate ids; unchanged by this phase |
| V12 File Operations | **YES** | Marker files and artifact paths. Control: existing `isSafeSlug` traversal guard (`session-binding.cjs:45`), atomic writes, and the artifact path must be derived from `roomDir` + a registry-declared relative path, never concatenated from a step field. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **Command injection via the new dispatcher** | Elevation of Privilege | `execFileSync(node, [scriptPath, roomDir], {...})` with an argv array. **Never** `exec()` with an interpolated string. Never let `step.command` reach a shell. |
| **Path traversal via a session id used as a filename** | Tampering | Reuse `session-binding.cjs::isSafeSlug` (rejects any `..` segment). REACH-03's content-stamping approach avoids this entirely by never putting the session id in a path. |
| **Path traversal via a registry-declared artifact path** | Tampering | Resolve and assert the artifact path stays under `roomDir` (`path.resolve(...).startsWith(path.resolve(roomDir))`). Precedent: `write-scope-check.cjs::targetRoomUnderRoot`. |
| **Unbounded child process** | Denial of Service | `timeout` option on `spawnSync`; the EXEC-06 `maxSteps` budget brake (`chain-executor.cjs:159`, default 25) already bounds the chain. |
| **Gate spoofing / replay** | Spoofing | Already mitigated: `chain.cjs`'s single-use resume ledger with 30-minute TTL (`:215-228`, T-198-12). Do NOT weaken it. The new dispatcher runs strictly INSIDE `_resumeFromGateAnswer`'s post-consume path. |
| **Cross-session gate consumption** | Spoofing | Phase 238's GATE-03, not this phase. Note that `chain.cjs`'s `_resumeLedger` is a **process-global `Map`, not session-keyed** (`:215`), so two sessions on one MCP server process share it. Out of scope here; **flag it to Phase 238** in the SUMMARY. |
| **Silent authorization downgrade** | Repudiation | The REACH-02 direction assertion (autonomous_safe count must not increase) is the control. |
| **Canon Part 8 egress** | Information Disclosure | Existing source-grep floors (`test-198-local-only.test.cjs`, `test-sensors-part8-sweep.cjs`) must be extended to cover `lib/core/chain-step-dispatcher.cjs`. |

**One new attack surface is introduced by this phase:** the dispatcher spawns child processes. That is a genuine privilege increase for the MCP server and must be reviewed as such, not waved through as "it just runs our own scripts". The gating facts that make it acceptable: the executable set is a **closed, build-time-generated allowlist**; the argv is an array; the invocation happens only after a human approve verdict consumed from a single-use ledger.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Each consumer owned its own chain walk (`act-command.cjs:131-147`) | ONE shared `runChain` spine | Phase 166 | Already done. `chain_run` correctly wraps it. Do not add a second loop. |
| Four independent room "guessers" | `lib/core/resolve-active-room.cjs` collapse | pre-194 | **The precedent REACH-02 should cite.** Same bug class, same fix shape. |
| 20 ad-hoc `extra.sessionId` reads | `resolveEffectiveSessionId` (3-tier ladder) | RCA `registry-active-room-concurrent-session-collision`, commit `0bec81b9` | REACH-03 must reuse it. Its header names "SEED-034, the four-guessers lesson". |
| Per-call-site reachability checks | `lib/core/seam-liveness.cjs` | Phase 235-02 | Phase 237 is a named intended consumer. |
| Registration-time write gate on MCP tools | call-time gate (`isWritePathEnabled`) | Phase 234-05 | `chain.cjs:25-43` documents at length why `chain_run` deliberately does NOT adopt it. **Do not "fix" that.** |
| `check-shape-declaration.cjs` hard-fail | ADVISORY WARN (`--strict` opt-in) | Phase 210 | A shape-declaration warning during this phase is expected and non-blocking. |

**Deprecated / outdated:**
- `lib/mcp/tools/chain.cjs::postureForCommand` -- being removed by REACH-02.
- `lib/core/chain-executor.cjs`'s DEFAULT `decideFn` (`_loadDecide`) -- being removed by REACH-01. The `opts.decideFn` seam itself is NOT deprecated.
- `recipe-maps.rankedNextReach` -- contract-only reader, explicitly deferred with Phase 157 (`recipe-maps.cjs:34-43`: "Do NOT wire it into the loop"). It is NOT a substitute for the removed `decide()` default.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Code does not support MCP sampling (`createMessage`). Basis: the official MCP page documents elicitation in detail and never mentions sampling. This is an absence-of-evidence inference, not a positive statement in the docs. | Hard Architectural Constraint | LOW. If sampling were supported, a richer REACH-01 option would exist. It would not invalidate the two-tier design; it would add a Tier 3. Verify with the navigator or a live probe before relying on the negative. |
| A2 | `scripts/auto-explore-fire.cjs` can obtain a session id. It is spawned detached by `auto-explore-fingerprint.cjs`; not traced end to end in this session. | REACH-03 plumbing table | MEDIUM. If unreachable, the `first_material` leg cannot be session-stamped and must stay unscoped (degrade rule keeps it firing). SC3 is still satisfiable on the `artifact_filed` leg alone. **Plan should verify this early.** |
| A3 | Adding an optional `executable` field to command frontmatter will not trip the born-wired / shape-declaration / projection `--check` gates. Not tested. | REACH-01 Option A | MEDIUM. If a gate rejects the unknown field, `build-command-registry.cjs`'s parser and the gate's schema both need a small additive change. Verify with a scratch commit before committing to Option A. |
| A4 | Phase 238 will own the `chain.cjs` process-global `_resumeLedger` session-keying. Inferred from GATE-03's wording ("gate minting and consumption are session-scoped"), not stated for this specific Map. | Security Domain | LOW. Worst case it lands in v1.17.0. Flag it in the SUMMARY either way so it is not lost. |
| A5 | The 30-minute `SIGNAL_FRESHNESS_MS` is not a frozen-family scalar and may be changed. Basis: CLAUDE.md's frozen list is MAX_K=3 / DIAL_REACH_K=6 / 0.70 / 0.15, and `session-presence.cjs:26-30` explicitly reasons about which windows are frozen. | Project Constraints C7 | LOW. The recommended fix does not change it anyway. |
| A6 | `/mos:snapshot` will stay MATERIAL under the unified authority after REACH-02 lands. Verified true today under BOTH authorities, so the parity fix cannot flip it. | REACH-01 fixture | LOW. Re-assert in the test rather than assuming. |
| A7 | The SC3 / RCA "Test 1 vs Test 2" numbering discrepancy resolves in favor of ROADMAP.md's SC3 wording (the stale-marker leg). | REACH-03 scope fence | MEDIUM. If the navigator intended the RCA's literal Test 1 (room-binding), the phase builds the wrong test. **Recommend the planner surface this as an explicit confirm-before-build question.** The out-of-scope fence (no resolver collapse) is unambiguous either way. |

---

## Open Questions

1. **Which SC3 does the navigator want -- ROADMAP's stale-marker leg or the RCA's literal Test 1 (room-binding)?**
   - What we know: ROADMAP SC3, REQUIREMENTS REACH-03, and the RCA's Test 2 all describe the SAME thing (session A's stale marker must not surface in B's reach). The task brief for this research says "Test 1".
   - What is unclear: whether "Test 1" was a reference slip or a deliberate narrowing to the room-binding leg.
   - Recommendation: build to ROADMAP SC3 (the marker leg) -- it is the version that appears in three of four sources and is the only one that matches "REACH". Surface the discrepancy as a one-line confirm in the PLAN. Both readings share the same out-of-scope fence.

2. **Option A (frontmatter `executable` field) vs a narrower alternative for REACH-01?**
   - What we know: no `executable` field exists; `build-command-registry.cjs` already parses frontmatter and emits `autonomous_safe`, `produces`, `inputs`, `body_shape`.
   - What is unclear: whether the born-wired / shape-declaration gates tolerate a new frontmatter key (A3).
   - Recommendation: Option A, with an early scratch-commit probe against the gates as the first task. Fall back to a small hand-maintained map in the dispatcher module only if a gate rejects the field, and say so explicitly rather than quietly.

3. **Should the four unfixed sensor markers (eureka, opportunity-harvest, url-ingest, diffusion) be fixed now or recorded?**
   - What we know: all four share the identical unscoped-freshness shape. SC3 requires only one leg.
   - Recommendation: fix the two `deriveTurnSignals` markers + `sensorArtifactFiled`; design the helper so the other four adopt it trivially; **record all four in the SUMMARY as known-unscoped**. Do not silently expand the blast radius, and do not silently leave them undocumented.

4. **Distinct memory_event label for real vs stub execution?**
   - What we know: existing rooms carry `label: 'chain_step_executed'` rows for steps that never executed.
   - Recommendation: use a new label (`chain_step_dispatched`) with an `executed` boolean so old false records stay distinguishable by inspection. No data migration; record the decision.

5. **Does the `chain.cjs` process-global `_resumeLedger` belong to 237 or 238?**
   - What we know: it is a module-level `Map` (`chain.cjs:215`), not session-keyed. Two sessions sharing one MCP server process share it. GATE-03 says "gate minting and consumption are session-scoped".
   - Recommendation: **Phase 238.** Flag it in this phase's SUMMARY so it is not lost between phases.

---

## Sources

### Primary (HIGH confidence -- read from disk or executed in this session)

- `lib/mcp/tools/chain.cjs` (full read, 517 lines) -- REACH-01 and REACH-02 root causes
- `lib/mcp/tools/sensors.cjs` (full read, 430 lines) -- `framework_run` classification path, `buildSensorInputs`
- `lib/core/chain-executor.cjs` (full read, 912 lines) -- decorative `decide()`, `makeGateFn`, `_defaultPostureFn`
- `lib/workflow/command-resolver.cjs` (full read, 156 lines) -- `validateChainAutonomy`
- `lib/core/recipe-maps.cjs` (targeted read, lines 14-54, 164-190) -- the ONE posture authority
- `lib/core/insight-sensors.cjs` (targeted read, lines 1-100, 209-290, 312-370, 552-580, 659-720) -- REACH-03 root cause
- `lib/core/session-binding.cjs` (full read, 209 lines) -- `resolveEffectiveSessionId`, `isSafeSlug`
- `lib/core/session-presence.cjs` (targeted read, lines 1-60, 391-403) -- per-room per-session precedent
- `lib/core/seam-liveness.cjs` (full read, 179 lines) -- Phase 235 helper
- `lib/mcp/gate-render.cjs` (header + exports) -- the 3-rung ladder
- `lib/core/navigation-engine.cjs` (targeted read, lines 787-850, 900-930) -- `decide()` contract, `sensorCtx` build
- `scripts/act-command.cjs` (targeted read, lines 150-300) -- the correctly-adapted `decideFn`, the donor loop
- `scripts/post-write` (targeted read, lines 55-135) -- cascade side-channel writer
- `scripts/build-command-registry.cjs` (targeted read, lines 240-300) -- `autonomous_safe` derivation
- `scripts/build-connector-registry.cjs` (grep) -- `posture` derivation
- `scripts/generate-hub.cjs` (header + output path) -- REACH-01 fixture
- `agents/framework-runner.md` (header + role) -- the real executor, and why it is host-only
- `commands/{new-project,ignite,build-thesis,causal,snapshot,whitespace,diagnostics}.md` -- frontmatter field semantics
- `tests/test-198-chain-run-halt.test.cjs`, `tests/test-198-concurrency-mcp.test.cjs`, `lib/memory/write-lock-atomic.test.cjs`, `tests/run-all-198.sh` -- test patterns
- **Live execution** against real repo modules: the 112-command parity walk (48 disagreements, 12 dangerous), the connector-registry posture distribution, the 30-command posture-absence count, the candidate-fixture classification check
- **langtalks-graph-expert MCP v1.28.x** driven over direct JSON-RPC stdio -- 8 queries, results tabulated in the Grounding Consultation Record

### Secondary (HIGH confidence -- official vendor documentation)

- `https://code.claude.com/docs/en/hooks` (fetched 2026-07-28) -- hook common input fields, `session_id` confirmed
- `https://code.claude.com/docs/en/mcp` (fetched 2026-07-28) -- MCP tool naming (incl. the plugin-bundled `mcp__plugin_<plugin>_<server>__<tool>` form), elicitation support, absence of sampling, no server-initiated slash commands

### Planning inputs (authoritative for scope, not for facts)

- `.planning/REQUIREMENTS.md` (v1.16.0), `.planning/ROADMAP.md` (Phase 237 + Next Milestone carried-in defect), `.planning/STATE.md` (SESSION OWNERSHIP LOCK; Phase 235 closure at line 102-114)
- `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` (full read) -- split routing, out-of-scope fence, live before/after evidence
- `CLAUDE.md` + `.claude/includes/{architecture,moat,decisions,release-process}.md`

### Not consulted, with reason

- Context7 / `ctx7` CLI -- no third-party library behavior claim in this phase's scope (`ctx7` is also not installed)
- `claude-api` skill, `claude-code-guide` agent -- **NOT INSTALLED** in this environment; official docs used instead

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| REACH-01 root cause | **HIGH** | Read from disk; the stub and its `quality: 'high'` fabrication are unambiguous in source |
| REACH-01 decide() census | **HIGH** | 27-hit grep across `lib/` + `scripts/`; zero consumers of runChain's trace `decision_trace`; the shape mismatch is provable against `decide()`'s own documented contract |
| REACH-01 architectural constraint | **HIGH** | Four independent in-repo confirmations (framework-runner agent header, act.md:243, pipeline.md:53, act-command.cjs:174-177) plus official docs on MCP capabilities |
| REACH-01 recommended dispatcher shape | **MEDIUM** | The two-tier design is sound and constraint-respecting, but the `executable` registry-field mechanism is unverified against the `--check` gates (A3) |
| REACH-02 root cause | **HIGH** | **Measured by executing the real modules**: 48/112 disagreements, 12 dangerous, direction split confirmed. Not inferred. |
| REACH-02 recommended fix | **HIGH** | The target authority already exists and is already used by 7 of 8 consumers; the fix is deletion plus a default |
| REACH-03 root cause | **HIGH** | Read from disk; three independent missing links (path, content, ctx) each confirmed by direct file read or grep returning zero hits |
| REACH-03 fix plumbing | **MEDIUM-HIGH** | Every link verified except the `auto-explore-fire.cjs` session-id reachability (A2). The `artifact_filed` leg is fully verified end to end. |
| REACH-03 scope boundary | **MEDIUM** | The Test 1 / Test 2 numbering discrepancy is a genuine ambiguity (A7, Open Question 1). The out-of-scope fence is HIGH confidence and unambiguous. |
| langtalks grounding | **HIGH** (that the consultation happened and what it returned) / **LOW** (that the corpus grounds REACH-02 or REACH-03) | Consultation executed and transcribed. Honest result: one relevant cluster (LangGraph interrupt/checkpoint, episode 33) validating REACH-01's control-flow shape; explicit misses on the other two. |
| Claude Code grounding | **HIGH** for the positive claims (session_id present, elicitation supported, plugin tool-name form) / **MEDIUM** for the negative claim about sampling (A1) | Official docs, fetched this session. The sampling negative is absence-of-documentation, stated as such. |

**Research date:** 2026-07-28
**Valid until:** 2026-08-27 (30 days) for the in-repo findings, which are pinned to specific file:line and a specific working tree. **Re-verify before planning if any of `lib/mcp/tools/chain.cjs`, `lib/core/chain-executor.cjs`, `lib/core/insight-sensors.cjs`, `data/command-registry.json`, or `data/connector-registry.json` changes.** The 48/112 parity number in particular is a live measurement against the current generated registries and will shift if either registry is rebuilt.
