# SEED-053 - The run_chain MCP tool: methodology chaining with handoffs, halting at material gates

> Framing (navigator, 2026-07-06): the local MindrianOS MCP server already exposes methodology tools (suggest-next, analyze-room, grade-venture, file-meeting). The navigator's instinct: expose "methodology chaining with HANDOFFS" as a first-class MCP tool - "run these bots in sequence" where one methodology's output hands off to the next, the room as connecting tissue. The machinery exists; the TOOL does not. This seed captures that gap plus the one constraint that makes it non-trivial.
> Part 8 clarification (load-bearing, corrects a mid-conversation overstatement): the MindrianOS MCP server is LOCAL (stdio, runs on the user's machine, reads the local room). Exposing a chain-runner tool there is Part-8-CLEAN - the wall only bites on the eventual REMOTE Brain lift (SEED-014), where only generic framework handles cross. There is no Part 8 obstacle to this seed on the local server.

**Registered:** 2026-07-06 (navigator-directed, live conversation; recon-verified against the shipped engines)
**Class:** ARCH | **Status:** seed
**Grounding:** direct code recon this session - `lib/core/chain-executor.cjs` (`runChain`), `lib/workflow/command-resolver.cjs` (`composeWorkflow`), `lib/brain/chain-recommender.cjs` (`recommendFrameworkChain`), `lib/mcp/pipeline-state.cjs` (pipeline state already in the MCP layer), `commands/pipeline.md` (the `/mos:pipeline` CLI command with `hitl_stages` F.2 build-path -> F.9 ordered-stages, `kind: meta`, "room as the connecting tissue"). The Post-Gate Handoff contract in the larry-extended agent body (Phase 166) is the handoff-with-halt precedent.

## The gap SEED-053 closes

The methodology-chaining-with-handoffs machinery is ~80% shipped but is NOT a first-class MCP tool:

- `runChain` (chain-executor) already auto-runs the `autonomous_safe` prefix of a resolved chain and HALTS at the first material step, returning control - the handoff-with-human-gate behavior.
- `composeWorkflow` (command-resolver) builds the chain and attaches each command from the local command-registry (recipe-maps `postureForCommand` joins the `autonomous_safe` posture).
- `recommendFrameworkChain` (chain-recommender) proposes a FEEDS_INTO chain (generic framework handles - Brain-legitimate).
- `pipeline-state.cjs` already tracks pipeline state in the MCP layer.
- `/mos:pipeline` runs a multi-step methodology pipeline stage-by-stage (F.2 -> F.9), "room as connecting tissue" (Decision #7: pipelines chain through the room; output becomes the next input's structure).

What is missing: a first-class MCP TOOL (e.g. `run_chain`) an MCP client can call to run a methodology chain with handoffs. Today the capability is a CLI command (`/mos:pipeline`) plus internal engines; there is no `server.tool` sibling to suggest-next / analyze-room that says "run this framework chain, hand off between stages, halt at the material gates."

## The one constraint that makes it non-trivial (the whole design)

Handoffs MUST halt at material gates. You cannot wrap `runChain` in a fire-and-forget "run all the bots" tool - that would break the recommend-never-trigger / GUIDED-default constitution (Canon Part 3 Decision Gate; the larry-personality reach rules "ends in a Decision Gate, not a verdict"). The tool must:

1. Take a resolved chain (from `composeWorkflow` / the command-resolver - NEVER a slug typed from memory; the resolver attaches every command and its posture).
2. Auto-run ONLY the `autonomous_safe` prefix underneath as machinery.
3. HALT at the first material (non-autonomous_safe) step and return control to the client at that gate - the navigator decides; the auto-sequence never runs a material step.
4. On the client's approve of the next material step, resume from that gate (the handoff-back protocol - the design's real unknown).

This is exactly the Phase 166 Post-Gate Handoff contract (validated by `tests/test-larry-handoff-seam.cjs` against `runChain`), lifted from an in-conversation seam to an MCP-tool seam.

## Reuse map (Canon Part 7 - thin wrapper, mint no engine)

| Need | Reuse | Notes |
|------|-------|-------|
| Resolve the chain + attach commands/posture | `composeWorkflow` (command-resolver) + recipe-maps `postureForCommand` | never fabricate `autonomous_safe`; join from the local registry |
| Run the safe prefix, halt at material | `runChain` (chain-executor) | already does auto-run-prefix-then-halt |
| Recommend the chain (optional Brain leg) | `recommendFrameworkChain` (chain-recommender) | generic handles only; `isAvailable()` sync degrade; offline-safe |
| Track pipeline state across the handoff | `lib/mcp/pipeline-state.cjs` | already in the MCP layer |
| Declare the tool's HITL shape | mirror `/mos:pipeline` `hitl_stages` (F.2 -> F.9) | Part 11: born WIRED with a declared HITL shape |
| Register on the surface | `registerRouterTools` / `server.tool` on `lib/mcp/tool-router.cjs` | the governed MCP path; the eureka_critic (212-03) registration is the sibling precedent |

## Canon compliance (at a glance)

- **Part 3 (Tri-Context Decision Gate):** each material step is a Decision Gate; the tool halts and returns control there.
- **Part 7 (Reuse):** thin wrapper over runChain/composeWorkflow/pipeline-state; no new engine.
- **Part 8 (Graph Boundary):** LOCAL server, reads local room - clean. The only Brain touch is the OPTIONAL recommendFrameworkChain leg (generic handles), which already honors the boundary. A future SEED-014 Brain lift would keep only the generic chain-recommendation remote.
- **Part 11 (CIRS):** the tool is born WIRED via registerRouterTools with a declared `hitl_stages` (borrow the `/mos:pipeline` F.2 -> F.9 shape); no forcing mechanism (the halt-at-material rule IS the anti-force).

## Open questions for research / plan

1. Does the tool wrap the `/mos:pipeline` command surface, or call the engines (`runChain`/`composeWorkflow`) directly? (Recommendation: engines directly; the command is a CLI presentation of the same engines.)
2. The handoff-back protocol: after the tool halts at a material gate and the client approves, how does the client RESUME the chain from that gate over MCP (stateless request/response vs the pipeline-state.cjs session)? This is the design's real unknown.
3. Relationship to the existing `pipeline` subcommand in the meeting tool group - is that the same surface, a different one, or dead?
4. Does the tool belong in `ALL_TOOL_COMMANDS` (CLI<->MCP parity) or, like eureka_critic, sit outside the parity pin because its consumer is programmatic?

## Cross-references

- `commands/pipeline.md` (the CLI surface this generalizes), `lib/core/chain-executor.cjs` (`runChain`), `lib/workflow/command-resolver.cjs` (`composeWorkflow`), `lib/brain/chain-recommender.cjs`, `lib/mcp/pipeline-state.cjs`, `lib/mcp/tool-router.cjs` (the registration surface)
- `.planning/phases/212-.../212-03-PLAN.md` (the eureka_critic MCP-tool registration precedent - thin wrapper, hitl declaration, 65-pin handling)
- `.planning/phases/213-.../213-04-PLAN.md` (the LarryReacts composer that recommends a chain via composeWorkflow - the recommend-never-trigger sibling)
- SEED-014 (the eventual Brain-repo lift; only generic handles cross), SEED-049/050 (the Eureka two-in-a-box the chain-runner would also orchestrate)
- larry-extended agent body: the Phase 166 Post-Gate Handoff section (the handoff-with-halt contract this lifts to MCP)
