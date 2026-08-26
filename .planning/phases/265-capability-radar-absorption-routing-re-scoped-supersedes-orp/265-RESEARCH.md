# Phase 265: Capability Radar Absorption + Routing - Research

**Researched:** 2026-08-26
**Domain:** Claude Code platform-capability absorption; subagent dispatch mechanics; MCP elicitation schema currency
**Confidence:** HIGH (every load-bearing claim verified against shipped code at file:line, the official Claude Code changelog, official docs, or the vendored MCP SDK)

---

## Summary

The phase brief names three stale facts to correct. Investigation found **two of the three are correct, one is itself wrong, and a fourth stale fact nobody flagged is the most consequential of all.**

Correct: subagent forking IS now the unconditional interactive default (2.1.232), and the capability ledger IS badly stale. Wrong: the brief's claim that "the real destination for native-default-forking adoption is the PWS parallel-fan-out-then-consolidate engines (/mos:eureka, /mos:bono, /mos:find-connections, /mos:whitespace, /mos:find-analogies)" does not survive contact with the code. **Not one of those five commands spawns a Claude Code subagent.** Two of them (`bono`, and `grade-grant` which rides bono's substrate) fan out with Node.js `Promise.all` over in-process async functions; the other three are single-context Brain-query or detached-Node-process flows. Default subagent forking is a complete no-op for all five.

The surfaces that DO instruct Claude to spawn parallel subagents are a different set entirely: `/mos:act --swarm`, `/mos:persona --parallel`, `/mos:grade --full`, and `/mos:trending-to-absurd` (Expert path). And all three of the explicit ones tell Claude to call the Agent tool with `run_in_background: true` -- **a parameter Claude Code now removes from the Agent tool whenever fork mode is on, which is the interactive default.** That is the actual absorption debt this phase exists to pay: shipped instructions naming a parameter the platform deleted.

The fourth, unflagged stale fact: `references/capability-radar/changelog-cache.md` was last written **2026-05-05 and tops out at Claude Code 2.1.128**. Phase 138's CONTEXT.md asserts the cache "already carries the 2.1.148-159 findings as of 2026-06-01" -- it does not, and never did. Those findings only ever existed inside 138-CONTEXT.md's own markdown table, which is precisely the rot pattern this phase was chartered to end. The ledger is 118 versions behind, not 87.

**Primary recommendation:** Phase 265's deliverable is NOT "adopt default forking." It is (a) a real ledger with a machine-checkable drift tripwire, (b) three concrete retrofits where a platform or SDK change has already obsoleted shipped code (`run_in_background`, the deprecated MCP elicitation enum shape, the reversed `resolveModel` call sites), and (c) correcting the radar reference docs that now teach the OPPOSITE of current platform behavior.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capability ledger storage | Repo data / `data/*.json` | `references/capability-radar/*.md` | Must be machine-readable for a drift check; markdown-only is what let 138 rot |
| Ledger refresh (`--fetch`) | Command prose (`commands/radar.md`) | WebFetch | Already the shape; the bug is that it writes a cache, not a ledger |
| Forward-routing into planning | GSD planner input (`.planning/`) | Command registry (`data/command-registry.json`) | The router is a read at plan time, not a runtime dispatcher |
| Parallel subagent dispatch | Claude Code host (Agent tool) | Command prose instructions | The host now owns backgrounding entirely; prose must stop specifying it |
| In-process parallel fan-out | Node.js (`lib/core/bono/cell-fanout.cjs`) | -- | Unrelated to subagents; `Promise.all` + semaphore-equivalent cap |
| Gate rendering rung 1 | MCP SDK elicitation schema | `lib/mcp/gate-render.cjs` | The SDK owns the wire shape; the plugin currently emits a deprecated one |
| Model tier selection | `lib/core/model-profiles.cjs` | `.planning/config.json` (GSD only) | Aliases resolve at the host; no version pinning exists or is needed |

---

## 1. Prior art: the orphaned Phase 138

Files read: `.planning/phases/138-capability-radar-absorption-and-routing/138-CONTEXT.md`, `138-02-PLAN.md`, `138-03-PLAN.md`, `138-04-PLAN.md`. Also `.planning/phases/138/DRIFT.md` (a separate directory) and `.planning/seeds/SEED-003-claude-code-2-1-x-capability-adoption.md`.

### What 138 got RIGHT (carry forward verbatim)

| Element | Where | Why it holds |
|---|---|---|
| The problem framing | `138-CONTEXT.md:37-45` | "Radar findings die in a dormant, stale, one-shot backlog" -- proven true by 138 itself becoming exactly that |
| Reuse-not-rebuild reframe | `138-CONTEXT.md:47-49` | Canon Part 7. Reuse Phase 122's `data/command-registry.json` + resolver rather than mint a dispatcher |
| Single-ledger-location decision | `138-CONTEXT.md:28` | Correct instinct, wrong medium (see below) |
| The four-part mechanism | `138-CONTEXT.md:80-85` | Living ledger + `radar_findings:` frontmatter contract + router at plan time + drift check. Structurally sound |
| `superseded-by`, never delete | `138-04-PLAN.md` truths | The right disposal discipline for SEED-003 |
| The drift-check-as-tripwire idea | `138-04-PLAN.md`, `tests/test-a4-supersede.cjs` | A test asserting a literal's absence is the right shape for a capability tripwire |

### What 138 got WRONG (do NOT carry forward)

| # | Error | Evidence |
|---|---|---|
| E-1 | **`a4_reeval` framed as an open probabilistic question.** `138-CONTEXT.md:30` says Opus dynamic workflows "likely SUPERSEDE" the fork path and "This phase DECIDES adopt-vs-supersede." | Settled by the platform on 2026-xx at Claude Code **2.1.232**: "Subagent forking is now on by default." Nothing to decide. `[VERIFIED: anthropics/claude-code CHANGELOG.md, 2.1.232]` |
| E-2 | **Bucket-F destinations mapped to Phases 133-136.** `138-CONTEXT.md:57,64,78` | Those phases are unrelated and long past; ROADMAP's rolling window moved. The forward-map must be derived at plan time from the ledger, never hardcoded to phase numbers in a markdown table -- hardcoded numbers are exactly what rotted. |
| E-3 | **"The ledger lives INSIDE this CONTEXT."** `138-CONTEXT.md:28` | This is the root cause of the rot. A markdown table inside one phase's CONTEXT.md is invisible to every tool. **Phase 265 must put the ledger in a machine-readable file** (`data/capability-ledger.json` -- note `138-04-PLAN.md` already gestures at this path in its `key_links`, so 138 half-caught its own error). |
| E-4 | **False claim that the cache carries 2.1.148-159.** `138-CONTEXT.md:19,53` | FALSE. See section 4 below. The cache's own header reads `Last fetched: 2026-05-05` and its newest entry is `### 2.1.128`. `[VERIFIED: references/capability-radar/changelog-cache.md:3,8]` |
| E-5 | **`no CLAUDE_CODE_FORK_SUBAGENT env default is set` framed as the win condition.** `138-04-PLAN.md` truths | The variable still exists but its polarity inverted: it is now the opt-OUT. A tripwire asserting the literal's absence is still correct, but for the opposite reason. See section 3. |

**Also noted:** `.planning/phases/138/` (bare number, a second directory) holds only `DRIFT.md` with finding `W007-138`: *"Phase 138 exists on disk but not in ROADMAP.md"*, first seen 2026-08-10, still `open`. The drift detector caught the orphaning sixteen days before a human did. Phase 265 should close W007-138 as part of retiring 138.

---

## 2. THE CENTRAL FINDING: the five named engines do not spawn subagents

This was the brief's single most important question. The answer inverts the phase's premise.

### 2a. Ground truth, per surface

| Surface | Actual dispatch mechanism | Spawns Claude Code subagents? | Already parallel? | Evidence |
|---|---|---|---|---|
| `/mos:eureka` | Fires ONE detached Node process, then polls status up to 3 times over ~15s (D-05 fire-and-return) | **No** | N/A -- single scan | `commands/eureka.md:92-96,102-116`; `scripts/eureka-command.cjs` |
| `/mos:bono` | `Promise.all` over the (subdomain x hat) grid, in-process async | **No** | **Yes**, already | `lib/core/bono/cell-fanout.cjs:251` (`await Promise.all(planned.map(...))`) |
| `/mos:find-connections` | Sequential Brain MCP queries in the main context | **No** | No | `commands/find-connections.md` Flow; `allowed-tools` = Read + 2 brain tools + AskUserQuestion |
| `/mos:whitespace` | 8 subcommands, each ONE `node scripts/whitespace-command.cjs` invocation | **No** | No | `commands/whitespace.md:133,189,248,294,351,402,474` |
| `/mos:find-analogies` | Brain MCP calls + `scripts/analogy-fitness-report.cjs` | **No** | No | `commands/find-analogies.md:140,155,166,190` |

The `runCellFanout` header comment calls itself "a REAL PARALLEL sub-agent fan-out" (`cell-fanout.cjs:4-5`). **That comment is misleading.** The function dispatches JavaScript promises, not agents. Its default per-cell worker (`defaultDispatchCell`, line 126) makes an HTTP call via `research-corpus.fetchCorpus`. Its production worker (`personaDispatchCell`, `lib/core/bono/persona-research.cjs:105`) chains `extractContext -> runSourceLens -> wireAccept` -- all in-process Node. `agents/persona-analyst.md:30` describes itself as "dispatched in parallel by `lib/core/bono/cell-fanout.cjs`", but no code path in `cell-fanout.cjs` reads, spawns, or references that agent file. The agent is a *conceptual* persona the prose invokes, not a spawned process.

**Consequence:** default subagent forking changes **nothing** for any of the five. There is no sequential-Task-call-that-could-be-parallel anywhere in them. `[VERIFIED: codebase grep + full read of cell-fanout.cjs and persona-research.cjs]`

### 2b. Where the real subagent fan-out actually lives

| Surface | Instruction | Line | Status |
|---|---|---|---|
| `/mos:act --swarm` | "Dispatch all N framework-runner agents in parallel using the Agent tool with `run_in_background: true`" | `commands/act.md:432` | **BROKEN** (see 2c) |
| `/mos:persona --parallel` | "Dispatch 6 agents in parallel using the Agent tool with `run_in_background: true`" | `commands/persona.md:136` | **BROKEN** |
| `/mos:grade --full` | "Dispatch agents in parallel using the Agent tool with `run_in_background: true`" | `commands/grade.md:116` | **BROKEN** |
| `/mos:trending-to-absurd` (Expert) | "the `multi_agent` flag dispatches the economic / technological / social / environmental refinement sub-agents" | `commands/trending-to-absurd.md:74` | Prose only, no dispatch shape specified. `PATH_VARIANTS.Expert.multi_agent: true` is "a descriptor the command body dispatches" (`lib/core/trending-to-absurd/variance.cjs:23,69`) |
| `/mos:grade-grant` | Rides `runCellFanout` with `agents/grant-reviewer.md` per category cell | `commands/grade-grant.md:180-184` | Same in-process `Promise.all` as bono, not subagents |

Note: `skills/*/SKILL.md` and `dist/**` carry byte-identical copies. `scripts/build-skill-mirrors.cjs:5,19-22` establishes **`commands/*.md` as the single source of truth**; skills and dist are generated mirrors. Any fix edits `commands/` then regenerates. Editing a mirror directly is a drift bug.

### 2c. Why `run_in_background: true` is now wrong

Official docs, verbatim:

> "Claude Code runs the subagents Claude spawns in the background, forks and non-fork subagents alike, apart from the cases that stay in the foreground. **Claude Code also removes the Agent tool's `run_in_background` parameter, so Claude can't ask for the foreground.**"
> -- `[CITED: code.claude.com/docs/en/sub-agents]`

> "Claude Code turns fork mode on by default in interactive sessions... The interactive default requires Claude Code v2.1.232 or later."
> -- `[CITED: code.claude.com/docs/en/sub-agents]`

Corroborating: the string `run_in_background` appears **zero times** in the entire Claude Code changelog (5,894 lines, all versions). `[VERIFIED: raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md]` It is a **Bash tool** parameter that these command docs mistakenly attached to the Agent tool -- traceable to `docs/research/RESEARCH_11_POWERHOUSE_SESSION.md:292` and `docs/POWERHOUSE-1.6.0-SPEC.md:237`, both 2026-era design specs that were never validated against the tool schema.

So the instruction was probably never correct, and is now definitively removed by the platform in the default configuration. Installed Claude Code here is **2.1.246**. `[VERIFIED: claude --version]`

### 2d. `allowed-tools` is NOT a blocker (a trap I nearly fell into)

No command in this repo lists `Task` in `allowed-tools`. That initially looked like a hard block on all agent dispatch. It is not:

> `allowed-tools` -- "Tools Claude can use **without asking permission** during the turn that invokes this skill. The grant clears when you send your next message."
> `disallowed-tools` -- "Tools **removed from Claude's available pool** while this skill is active."
> -- `[CITED: code.claude.com/docs/en/skills, frontmatter field table]`

`allowed-tools` is a **pre-approval** list, not a restriction list. Omitting `Task` means each agent spawn goes through the normal permission flow rather than failing. Real consequence: `/mos:grade --full` fires up to 8 permission prompts, `/mos:persona --parallel` up to 6. That is a genuine UX defect on a `design-conscious` product, and a correctness risk for any `autonomous_safe: true` surface, but it is friction, not breakage. `[VERIFIED: official docs]`

---

## 3. `CLAUDE_CODE_FORK_SUBAGENT` and the sequential-by-design audit

**Repo-wide grep for `CLAUDE_CODE_FORK_SUBAGENT` returns exactly two hits, both in stale reference docs, zero in code:**

- `references/capability-radar/changelog-cache.md:45` -- describing 2.1.117
- `references/capability-radar/capabilities-index.md:127` -- section heading "Forked Subagents on External Builds (`CLAUDE_CODE_FORK_SUBAGENT=1`)"

No file under `lib/`, `scripts/`, `agents/`, `commands/`, `hooks/`, or `bin/` references it. **Nothing in shipped code ever assumed the old opt-in gate existed.** Adopting default forking is therefore a genuine no-op for executable code. `[VERIFIED: codebase grep]`

**But the two reference docs now teach the opposite of reality and must be corrected, not deleted.** The variable still exists; its meaning inverted:

> "Set the `CLAUDE_CODE_FORK_SUBAGENT` environment variable to override the defaults: `1` turns fork mode on in non-interactive mode and the Agent SDK as well; `0` turns fork mode off in every kind of session."
> -- `[CITED: code.claude.com/docs/en/sub-agents]`

It was an opt-IN for external builds; it is now an opt-OUT (`=0`) plus an opt-in for headless/SDK (`=1`). A reader following `capabilities-index.md:127` today would set a variable believing it enables something already on.

**Sequential-by-design audit:** searched all `commands/*.md`, `skills/*/SKILL.md`, `agents/*.md` for language asserting subagent calls must run one-at-a-time. Found none. The only explicit sequencing claims are *deliberate design*, not platform workarounds:
- `commands/bono.md:135` D-164-S2: "the fan is PARALLEL and is never re-run inside the debate loop" -- the *debate* is intentionally sequential because each hat must read the prior argument. That is methodological, not technical.
- `agents/framework-runner.md:36,252`: "No sub-subagents. You are the execution boundary." Written when nesting depth defaulted to 1. Now the platform default is 3 (2.1.219). This is a *self-imposed* constraint that remains valid as a design choice; no change required, but the planner should note it is now a choice rather than a limit.

---

## 4. Screening Claude Code 2.1.160 -> 2.1.246 against shipped code

All version pins below verified by parsing the official changelog between the `## 2.1.246` and `## 2.1.159` markers. `[VERIFIED: anthropics/claude-code CHANGELOG.md]`

### 4a. MCP interrupted-tool-call explicit error reporting -- **2.1.246** -- verdict: **NO CODE CHANGE, ledger entry only**

Changelog: *"Fixed MCP tool calls interrupted by an incoming message in headless/remote sessions being reported to the model as 'completed with no output' instead of an explicit interrupted error."*

This is a **host-side** fix scoped to headless/remote sessions. The affected party is not `lib/core/brain-client.cjs` -- that is an HTTPS client calling the remote Brain, with its own independent failure handling:
- Per-request hard timeout via `AbortSignal.timeout(BRAIN_REQUEST_TIMEOUT_MS)` at `brain-client.cjs:339,438,571` (default 20s), because "Node's global `fetch()` has NO default timeout" (`brain-client.cjs:27`)
- A bounded transport-class retry budget (Phase 250-01 AVAIL-02) that retries only network errors and 5xx, never 401/403 (`brain-client.cjs:35-44`)
- Explicit sentinels: `{error:'invalid_key'}`, `{error:'tier_denied'}`, `{error:'egress_blocked'}` (`brain-client.cjs:465,532,621`)

The plugin's OWN MCP server (`bin/mindrian-mcp-server.cjs`) is the party that benefits: when a user interrupts mid-`gate_render` in a headless session, the model now learns the call was interrupted instead of inferring silent success. **Nothing in this repo hand-rolled a workaround for the old behavior** -- grep for cancel/abort handling in `bin/mindrian-mcp-server.cjs` and `lib/mcp/tool-router.cjs` returns only session-close plumbing (`bin/mindrian-mcp-server.cjs:318,323`). Free improvement; record and move on. `[VERIFIED: code read]`

### 4b. MCP elicitation fixes -- **2.1.238 and 2.1.239** -- verdict: **NOTHING TO REMOVE, but a REAL adjacent retrofit found**

The two fixes:
- 2.1.239: elicitation forms taller than the terminal clipped in fullscreen
- 2.1.238: elicitation dialogs showing nothing for URLs longer than 4,096 characters

Checked `lib/mcp/gate-render.cjs` (the gate_render rung-1 implementation, `renderViaElicitation` at line 216):
- **No hand-rolled workaround for either bug exists.** No option-count truncation, no URL shortening, no form-height clamp.
- The **form-height** bug cannot bite: `buildElicitRequestedSchema` (line 172) emits a schema with exactly **one property** (`choice` or `choices`), so the form is one field tall regardless of option count.
- The **URL-length** bug cannot bite: this is `ElicitRequestURLParamsSchema` (URL-mode elicitation). `renderViaElicitation:219` sends `{requestedSchema, message}` -- form mode only. The plugin never uses URL mode. `[VERIFIED: code read + node_modules/@modelcontextprotocol/sdk/dist/cjs/types.js:1769,1815]`

**However -- the adjacent finding, which IS a genuine radar absorption:**

`gate-render.cjs:9-14` documents its lossiness as an SDK limitation: *"SDK 1.29.0 `ElicitRequestFormParamsSchema` has no per-option description field."* That is true for *descriptions*. It is **not** true for *option titles*, and the code is emitting a **deprecated schema shape**:

| Path | What `gate-render.cjs` emits | SDK schema it matches | Current SDK equivalent |
|---|---|---|---|
| single-select (`:189-200`) | `{type:'string', enum:[...], enumNames:[...]}` | `LegacyTitledEnumSchemaSchema` -- SDK comment: *"Use TitledSingleSelectEnumSchema instead. This interface will be removed in a future version."* | `TitledSingleSelectEnumSchemaSchema`: `{type:'string', oneOf:[{const,title}]}` |
| multi-select (`:173-188`) | `{type:'array', items:{type:'string', enum:[...]}}` -- **no titles at all** | `UntitledMultiSelectEnumSchemaSchema` | `TitledMultiSelectEnumSchemaSchema`: `{type:'array', items:{anyOf:[{const,title}]}}` |

`[VERIFIED: node_modules/@modelcontextprotocol/sdk/dist/cjs/types.js:1685-1757, SDK 1.29.0 installed]`

Two concrete defects follow:
1. **The multi-select rung-1 gate renders raw slugified option IDs to the user instead of labels** (`whats-next-0` rather than "What's next"). Titles are simply dropped. The SDK has supported titled multi-select since before 1.29.0.
2. The single-select path rides a schema the SDK explicitly marks for removal.

This is the exact species of finding the radar is supposed to catch: a capability landed, shipped code kept the old shape, nobody noticed. It is also the highest-value concrete deliverable available to this phase.

### 4c. Agent Tool clear-error instead of silent general-purpose fallback -- **2.1.235** -- verdict: **NO CODE ASSUMED IT, no change**

Changelog: *"Fixed the Agent tool advertising a general-purpose default in sessions where that agent is unavailable: an omitted `subagent_type` there now gets a clear error listing the available agents."*

Docs: *"An Agent tool call that omits `subagent_type` fails with `subagent_type is required` when the session has no `general-purpose` subagent to fall back on."* `[CITED: code.claude.com/docs/en/sub-agents]`

Findings:
- Repo-wide grep for `general-purpose`: **zero hits in `commands/`, `skills/`, `agents/`, `lib/`, `scripts/`.** Only two hits in `docs/`, both unrelated prose. No error-handling code anywhere assumed the silent fallback.
- Repo-wide grep for `subagent_type` / `agent_type` / `agentType`: only `lib/core/model-profiles.cjs` (its own internal `agentType` parameter, unrelated to the Agent tool).
- **The brief's "20+ custom agent types" is wrong: this plugin ships 10.** `agents/` contains exactly: brain-query, framework-runner, grading, grant-reviewer, investor, larry-extended, opportunity-scanner, persona-analyst, research, reverse-salient-agent. `[VERIFIED: ls agents/*.md | wc -l == 10]`

**Adjacent latent issue worth a plan task:** no dispatch instruction anywhere passes an agent *name*. They all say things like "dispatch to `agents/framework-runner.md`" (`commands/act.md:243,276`) or "Instructions from `agents/persona-analyst.md`" (`commands/persona.md:141`) -- a **file path**, leaving Claude to infer the `subagent_type` string. That inference was survivable while a silent `general-purpose` fallback existed. Post-2.1.235 an unresolvable type is a hard error listing available agents. Making the agent names explicit in the dispatch prose is cheap insurance.

### 4d. Additional 2.1.160-246 items materially relevant to this repo

Screened but not in the brief. Each verified against the changelog with its version pin.

| Version | Change | Repo impact | Verdict |
|---|---|---|---|
| 2.1.217 | Concurrency cap on running subagents: default **20**, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`; error `Concurrent subagent limit reached`, model told not to retry | `/mos:act --swarm` sizes N from `dispatch-optimizer.planDispatch`, which caps on *context budget*, not agent count. A large room could in principle exceed 20 | **OPEN** -- add the 20-cap to the swarm sizing note |
| 2.1.224 | Removed the 200-subagent-per-session spawn cap | None (repo never approached it) | Ledger only |
| 2.1.219 | Nesting depth default raised to **3** (was 1 at 2.1.217; was 5 unchangeable at 2.1.172) | `agents/framework-runner.md:36,252` forbids sub-subagents by policy. Still valid as a *choice*, no longer a *limit* | Ledger; optionally re-annotate the agent |
| 2.1.218 | Skills with `context: fork` run in background by default; opt out via `background: false` | **Zero `context: fork` usage in this repo.** An entirely unadopted capability | **OPEN** -- candidate for eureka's fire-and-return flow |
| 2.1.212 | Task tool's `mode` parameter deprecated and ignored | Repo never used it | No action |
| 2.1.208 | Agent tool returns a clear error when a subagent's `tools` list resolves to nothing | `agents/*.md` use `allowed-tools:` (not `tools:`); none resolve empty | No action |
| 2.1.223 | Warning when a requested subagent model is restricted and the parent model runs instead | Relevant to `model-profiles` resolution (see 4e) | Ledger |
| 2.1.232 | Parallel tool calls: a failed Bash command no longer cancels others in the batch | Improves any batched Bash step | Ledger |
| (docs) | **"Custom commands have been merged into skills."** `.claude/commands/x.md` and `.claude/skills/x/SKILL.md` both create `/x` and work the same way | This repo maintains **113 `commands/*.md` + 126 generated `skills/*/SKILL.md` mirrors** via `scripts/build-skill-mirrors.cjs`. The generator's stated rationale (a Windows compositing bug, `build-skill-mirrors.cjs:10`) may now be moot | **OPEN, high-leverage** -- flag for the ledger; do NOT act inside this phase |

### 4e. A bug found while screening: reversed `resolveModel` arguments

Not a changelog item, but discovered by following the dispatch path and worth flagging because it is in the same files the phase must touch.

`lib/core/model-profiles.cjs:119` -- `function resolveModel(roomDir, agentType)`.

Call sites:
- `commands/persona.md:132` -- `resolveModel('persona-analyst', roomPath)`
- `commands/grade.md:112` -- `resolveModel('grading', roomPath)`
- (plus generated mirrors `skills/persona/SKILL.md:129`, `skills/grade/SKILL.md:108`)

**Arguments are reversed.** `'persona-analyst'` is passed as `roomDir` (config load fails, defaults), and `roomPath` as `agentType` (not a key in `MODEL_PROFILES`), so execution falls to Step 5 and **always returns `'sonnet'`** (`model-profiles.cjs:148`). The venture-stage hints, per-agent overrides, and quality/balanced/budget profiles are all silently bypassed on both parallel-dispatch commands.

`commands/act.md:203` gets it right by using the CLI form: `node ".../model-profiles.cjs" resolve <roomDir> framework-runner`. `scripts/huji-run-one.cjs:198,587` also get it right. `[VERIFIED: code read + signature comparison]`

---

## 5. Opus model floor

**Answer: `executor_model`, `planner_model`, and `researcher_model` do not exist in this repo.** They appear only as *prose* in the two stale radar reference docs (`capabilities-index.md:13`, `changelog-cache.md:56`), asserting *"Default `executor_model: 'opus'` resolves to 4.7."* No JSON key, no code reference, anywhere. `[VERIFIED: repo-wide grep]`

Two real model-config surfaces exist, both alias-based:

**(a) Plugin-side -- `lib/core/model-profiles.cjs`.** `MODEL_PROFILES` (lines 18-26) maps 8 agent types x 3 tiers to the bare aliases `'opus' | 'sonnet' | 'haiku'`. `resolveModel` returns a bare alias. `commands/act.md:208`: *"If result is a model alias (opus/sonnet/haiku), include `model: <result>` when dispatching the agent."* No version string is ever constructed. **The alias resolves dynamically at the host to the current model of that family, so Opus 5 applies automatically. No config change needed.**

**(b) GSD-side -- `.planning/config.json`.**
```json
"models": { "planning":"fable", "discuss":"fable", "research":"fable",
            "execution":"sonnet", "verification":"sonnet", "completion":"sonnet" },
"model_profile_overrides": { "claude": { "sonnet":"claude-sonnet-5", "haiku":"claude-sonnet-5" } }
```
Two observations, neither requiring a change:
- `model_profile_overrides.claude` pins concrete IDs for `sonnet` and `haiku` but has **no `opus` entry**, so `opus` stays alias-resolved and floats to latest. Correct by construction.
- `planning`/`discuss`/`research` route to `fable`, which the standing personal-memory rule forbids; `_models_note` in the same file records an explicit navigator amendment (2026-08-10) scoping fable to this repo's GSD planning/research agents only. **Leave as-is** -- it is a recorded decision, not drift.

**Verdict: no config change. The Opus floor is a non-issue. What IS needed is deleting the two stale prose claims about `executor_model` and "Opus 4.7 is the current top-tier model" from the radar reference docs.**

---

## langtalks-graph-expert grounding

**Tool access note (report honestly):** `mcp__langtalks-graph-expert__*` tools were not present in this agent's tool surface (the known upstream MCP-stripping bug for agents with restricted tool frontmatter, anthropics/claude-code#13898). I did **not** skip the mandatory consultation. I drove the same server in-process via its own Python entry point (`/home/jsagi/langtalks-graph-expert/server/mcp_server.py`, the exact module `.claude.json` registers), calling `query_relationship_tool`, `relationship_path_tool`, and `graph_stats_tool` directly. Identical code path, identical results.

**Corpus state at query time:** 8,543 nodes / 19,765 edges / 46 sources / 147 episodes; 355 communities; clustering coverage 0.9998; last modified 2026-08-26T09:09Z. Fresh, same-day.

### What was asked and what came back

| # | Question | Tool | Result | Covered? |
|---|---|---|---|---|
| Q1 | "parallel agent execution" -> "consolidation" | `relationship_path` | found, 3 hops, but path is generic `mentioned_in_episode` chaining via *Building an Advanced Agentic Harness* | **Weak** -- typed edge exists, semantic content thin |
| Q2 | "subagent" -> "context isolation" | `relationship_path` | found, 4 hops, routes through *Fragmented #307* and *ep71 Claw Architectures* | **Weak** -- co-mention, not a claim |
| Q3 | "multi-agent orchestration" -> "failure modes" | `relationship_path` | found, 3 hops via Lex Fridman #490 | **Weak** |
| Q4 | "fan-out" -> "synthesis" | `relationship_path` | found, 4 hops, INFERRED confidence on the first edge | **Weak** |
| Q5 | "how do multi-agent systems fan out subagents in parallel and consolidate their results" | `query_relationship` (budget 3000) | 82 found, not truncated. Surfaced *Building an Advanced Agentic Harness* (data4sci), *71 - Claw Architectures*, *Fragmented #305: Subagents explained: What they are, when (not) to spawn them*, plus `Multi-Agent Systems --builds_on--> delegation` from *55 - Context Engineering* | **YES, substantively** |
| Q6 | "when should you NOT spawn a subagent -- overhead, context isolation cost, coordination failure" | `query_relationship` | 426 found (truncated). Named *Fragmented #305* by title | **PARTIAL** -- see gap G-1 |
| Q7 | "adversarial debate between agents, critic agent, self-critique versus independent judge" | `query_relationship` | 1,054 found (truncated). Surfaced `Critic` from data4sci harness, *Episode 57: AI Agents and LLM Judges* | **YES** |
| Q8 | "deduplicating and merging results from many parallel agents into one synthesis" | `query_relationship` | 1,033 found (truncated). Surfaced `Synthesis layer`, two Graph-RAG arXiv papers | **PARTIAL** -- retrieval-side, not agent-side |

I then read the underlying source documents rather than stopping at the graph edges.

### What the corpus actually taught (substantive, cited)

**Source: *Building an Advanced Agentic Harness*, data4sci.com, 2026-07-15.** `[CITED: sources/research/markdown/url-https-data4sci-com-blog-building-an-adva.md]`

1. **Level-synchronous DAG walker + hard concurrency cap.** "The executor is a level-synchronous DAG walker: compute the ready set, launch every ready node concurrently with `asyncio.gather`, mark each one done or failed, and repeat until nothing is left or no forward progress is possible. `MAX_CONCURRENT = 5 # cap concurrent tool/LLM calls`... `semaphore = asyncio.Semaphore(MAX_CONCURRENT)`."
   **Bearing on this phase:** `lib/core/bono/cell-fanout.cjs` is a faithful implementation of this pattern -- `Promise.all` over the ready set (line 251), grid clamped to `resolveFanoutCap` whose default `FUTURES_FANOUT_CAP` is **5** (lines 54, 212-216), per-node failure isolated to a `defensiveStub` so one rejection never rejects the batch (lines 103-112, 257-259). The corpus independently validates the shipped design. **No change warranted.** This is the strongest single argument for the "no code changes to bono" recommendation below.

2. **Planner / Worker / Critic separation, and the anti-pattern it exists to prevent.** "We split the work into narrow agents, each with a short system prompt and a single contract... **the Worker produces and the Critic evaluates, so the generator is never grading its own homework.**"
   **Bearing:** BONO's fable-mode layer 1 is a per-cell **self**-critique -- `defaultSelfCritique(cell)` (`cell-fanout.cjs:152`) runs on the cell's own output. By the corpus's framing, that is the generator grading its own homework. Honest caveat: MindrianOS's Wave-5 `runDebate` supplies an independent adversarial layer downstream, so the system as a whole is not purely self-grading. Worth recording as a design observation; **out of scope for Phase 265.**

3. **Two-tier verification gate.** "Zero tokens were spent on judging, and the reason string is actionable... This two-tier gate is a robust pattern behind most production eval pipelines: **cheap filters first, expensive judges on survivors only.**"
   **Bearing:** `defaultSelfCritique` IS the cheap deterministic filter (confidence floor 0.3, no-evidence rejection). Tier 1 is correctly built. Recorded, not actionable here.

4. **The four-class error taxonomy** -- already cross-referenced *by name* in this repo at `lib/core/brain-client.cjs:39-40` ("taxonomy-wrong per the data4sci four-class error taxonomy"). The repo is already consuming this exact source. Pleasant confirmation that the grounding source and the codebase are already in contact.

**Source: *ep71 - Claw Architectures*, Gavriel Cohen (NanoClaw).** `[CITED: sources/langtalks/transcripts/ep71.txt]` Hebrew transcript. Substance: isolation between concurrent agents achieved at the **OS/container** level, not the process level, with an external orchestrator routing messages and lifecycling containers; credentials injected *outside* the agent's environment and never exposed to it; a human-in-the-loop approval policy that freezes a sensitive egress in flight until the operator approves. Structurally the same shape as MindrianOS's Canon Part 8 egress guard plus Part 3 decision gates. Useful as convergent-design evidence; **not** about Claude Code subagent context isolation.

**Source: *Fragmented #307: Harness Engineering*.** `[CITED: sources/research/markdown/url-https-fragmentedpodcast-com-episodes-307.md]` Only shownotes were ingested, no transcript. Yields the five harness pillars -- agent legibility, closed feedback loops, persistent memory, entropy control, blast radius controls -- and a title-only reference to episode 305.

**Source: two Anthropic blog posts already in the corpus** (`claude.com/blog/the-new-rules-of-context-engineering...`, `claude.com/blog/building-verification-loops-in-claude-code-with-skills`). Searched both for `subagent`, `sub-agent`, `parallel`, `fork`, `isolat`, `orchestr`: **zero hits in either.** One relevant line from the first: Task tools are 'deferred loading', discovered via ToolSearch so they "don't take up context until they're needed."

### Gaps -- explicitly reported, not papered over

| ID | Question the corpus did NOT answer | Consequence |
|---|---|---|
| G-1 | **When NOT to spawn a subagent.** *Fragmented #305: "Subagents explained: What they are, when (not) to spawn them"* is in the graph **by title only** -- ingested via #307's shownotes link list. No transcript, no body. The graph knows the episode exists; it does not know what it says. | The single most on-point source in the corpus is an empty node. Do not cite it as if it argued anything. |
| G-2 | **Claude Code subagent forking, background defaults, concurrency caps.** Zero coverage. Both Anthropic sources in the corpus predate or omit it. | Correctly answered by the official changelog and docs instead, per CLAUDE.md's rule that langtalks is one leg, not the stool. |
| G-3 | **Result dedup/merge across parallel agents.** Q8's 1,033 hits were dominated by Graph-RAG *retrieval* dedup (arXiv 2603.14828, 2603.14045), not agent-output consolidation. | Not-in-corpus for the agent-side question. |
| G-4 | **MCP elicitation schema shapes.** Not an agent-engineering concept; correctly answered from the vendored SDK source. | Right source used. |

**Honest summary:** the corpus meaningfully covered Q5 and Q7 and gave one genuinely load-bearing finding (the DAG-walker + semaphore + isolated-failure pattern that independently validates `cell-fanout.cjs`). It did not cover the Claude Code platform mechanics at the heart of this phase, and its most promising source on subagent spawn discipline is an unpopulated title node. Suggested follow-up outside this phase: ingest Fragmented #305 and #309 (Background Agents) via `add_source`.

---

## Project Constraints (from CLAUDE.md)

Directives extracted; the planner must verify compliance.

| Constraint | Bearing on Phase 265 |
|---|---|
| **Workspace guard** | All work in `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/`. |
| **Canon Part 7 (reuse before build)** | The router reuses the Phase 122 `data/command-registry.json` + resolver. No new dispatcher. |
| **Canon Part 6 (dog-fooding)** | This phase IS the drift discipline applied to the plugin itself. |
| **Canon Part 8 (graph boundary)** | Zero user data toward the Brain. Nothing in this phase touches egress. |
| **Canon Part 11 (CIRS)** | Any new invocable surface is born WIRED or EXCLUDED with a declared `hitl_shape`. Run `node scripts/build-connector-registry.cjs --check`. |
| **Tri-polar rule** | Evaluate every change against CLI / Desktop / Cowork. The elicitation retrofit (4b) is *Desktop/Cowork-critical* -- rung 1 fires on elicitation-declaring hosts, which is exactly where Claude Code's AskUserQuestion rung does not apply. |
| **No em-dashes** | Both radar reference docs currently contain em-dashes (`changelog-cache.md:67-81`). A rewrite must strip them. |
| **GSD workflow enforcement** | No direct edits outside a GSD workflow. |
| **Dev-research compositing** | This phase touches MindrianOS's own architecture, so findings file in BOTH `.planning/phases/265-.../` and `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked. **This is a required deliverable, not optional.** |
| **Grounding sources** | langtalks for agent/LLM concepts; Context7 for library APIs; claude-api skill / claude-code-guide for Claude Code internals; WebSearch/WebFetch for release notes. All four legs used here. |
| **`commands/` is the single source of truth** | `skills/` and `dist/` are generated. Edit `commands/`, then run `scripts/build-skill-mirrors.cjs` and `scripts/build-dist-bundles.cjs`. |
| **Release lockstep** | Five gates via `scripts/release.sh <version>`; never bump by hand. |
| **Project skill** | `.claude/skills/agentshield/SKILL.md` present; no `.agents/skills/`. |

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Parallel subagent backgrounding | Any `run_in_background` flag or backgrounding wrapper | Nothing -- the Agent tool backgrounds by default and *removes* the parameter | Verified: the parameter no longer exists in fork mode |
| Fork-subagent opt-in harness | A `CLAUDE_CODE_FORK_SUBAGENT=1` setter | Nothing -- it is now the opt-OUT | 138-04's "no FORK_SUBAGENT literal" tripwire stays correct, for the opposite reason |
| Concurrency limiting for subagents | A hand-rolled semaphore over Agent calls | Platform cap (20, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); error tells the model not to retry | 2.1.217 |
| Elicitation option titles | A parallel title map or a text preamble listing labels | `TitledSingleSelectEnumSchemaSchema` / `TitledMultiSelectEnumSchemaSchema` | Already in the vendored SDK 1.29.0 |
| A second command registry for the router | A new ledger-to-phase dispatcher | Phase 122 `data/command-registry.json` + `lib/workflow/command-resolver.cjs` | Canon Part 7; 138's own reframe |
| A markdown-table ledger | Another CONTEXT.md table | `data/*.json` + a check script sibling to `build-connector-registry.cjs --check` | The markdown table is the documented root cause of the rot |

**Key insight:** every item this phase might "adopt" is either already default (needs deletion of stale prose, not new code) or already vendored (needs a shape swap, not a wrapper). The absorption work is *subtractive*.

---

## Common Pitfalls

### Pitfall 1: Trusting `cell-fanout.cjs`'s own header comment
**What goes wrong:** Line 4 says "a REAL PARALLEL sub-agent fan-out." A planner reading only the comment concludes BONO spawns subagents and writes tasks to "convert BONO to native forking."
**Why:** The comment uses "sub-agent" conceptually (personas), not mechanically.
**Avoid:** Read line 251 (`Promise.all`) and `personaDispatchCell`. Both are pure in-process Node.
**Warning sign:** Any task whose action is "make BONO use forked subagents."

### Pitfall 2: Reading `allowed-tools` as a restriction list
**What goes wrong:** Concluding that omitting `Task` blocks all agent dispatch, then writing tasks to add `Task` to a dozen frontmatters as a "fix."
**Why:** `allowed-tools` is a **pre-approval** list; `disallowed-tools` is the restriction list. I made this error mid-research and caught it only against official docs.
**Avoid:** Adding `Task` is a legitimate UX improvement (removes N permission prompts), but frame it as UX, never as a bug fix.

### Pitfall 3: Fixing a generated mirror
**What goes wrong:** Editing `skills/act/SKILL.md` or `dist/zed/.agents/skills/act/SKILL.md`. The next `build-skill-mirrors.cjs` run silently reverts it.
**Avoid:** Edit `commands/*.md` only, then regenerate. The same string appears in **9 files** across `commands/`, `skills/`, and three `dist/` trees.

### Pitfall 4: Treating the 138 ledger table as a starting point
**What goes wrong:** Copying `138-CONTEXT.md`'s 14-row table forward. Rows 1-14 describe 2.1.148-159 against phase numbers 133-136 that no longer exist, and the table's own source claim is false (see E-4).
**Avoid:** Rebuild the ledger from the actual changelog (2.1.128 -> 2.1.246, ~118 versions) into a JSON file. Reuse 138's *schema thinking* (capability / version / leverage / destination / status), not its *rows*.

### Pitfall 5: Assuming the radar cache reflects what radar last fetched
**What goes wrong:** Trusting `changelog-cache.md`'s currency because a `--fetch` was reportedly run in June.
**Why:** `commands/radar.md:64` instructs a cache write, but the file's mtime is **2026-05-05** and git shows its last touch as `f1459b44 docs(radar): file Claude Code 2.1.110-128 capability findings`. The June fetch's findings went into a phase CONTEXT.md instead. **The write-back step is the broken link in the whole radar loop** and is arguably the single most important thing for Phase 265 to make mechanical.

### Pitfall 6: Believing the brief's "20+ custom agent types"
**Avoid:** It is 10. `ls agents/*.md | wc -l`.

---

## Code Examples

### The elicitation schema retrofit (4b) -- current vs. SDK-current
```javascript
// CURRENT -- lib/mcp/gate-render.cjs:189-200. Matches LegacyTitledEnumSchemaSchema,
// which the SDK marks: "Use TitledSingleSelectEnumSchema instead. This interface
// will be removed in a future version."
return {
  type: 'object',
  properties: { choice: {
    type: 'string', title: card.header || 'Choose an option',
    enum:      card.options.map((o) => o.id),
    enumNames: card.options.map((o) => o.label),
  } },
  required: ['choice'],
};

// SDK-CURRENT shape -- TitledSingleSelectEnumSchemaSchema
// Source: node_modules/@modelcontextprotocol/sdk/dist/cjs/types.js:1697-1707
//   { type:'string', title?, description?, oneOf:[{const,title}], default? }
properties: { choice: {
  type: 'string', title: card.header || 'Choose an option',
  oneOf: card.options.map((o) => ({ const: o.id, title: o.label })),
} }

// CURRENT multi-select -- gate-render.cjs:173-188. Matches
// UntitledMultiSelectEnumSchemaSchema: LABELS ARE DROPPED ENTIRELY.
items: { type: 'string', enum: card.options.map((o) => o.id) }

// SDK-CURRENT -- TitledMultiSelectEnumSchemaSchema, types.js:1740-1753
//   { type:'array', items:{ anyOf:[{const,title}] }, minItems?, maxItems? }
items: { anyOf: card.options.map((o) => ({ const: o.id, title: o.label })) }
```

### The `run_in_background` retrofit (2c)
```markdown
<!-- CURRENT -- commands/act.md:432 (also persona.md:136, grade.md:116) -->
1. Dispatch all N framework-runner agents in parallel using the Agent tool with `run_in_background: true`:

<!-- CORRECTED. Claude Code removes run_in_background when fork mode is on
     (the interactive default since 2.1.232) and backgrounds every spawn itself.
     Source: code.claude.com/docs/en/sub-agents -->
1. Dispatch all N agents in one message using the Agent tool with `subagent_type: framework-runner`.
   Claude Code runs spawned subagents in the background by default (fork mode, the interactive
   default since 2.1.232) -- do NOT pass `run_in_background`, that parameter is removed in
   fork mode. The platform caps concurrent subagents at 20
   (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); clamp N accordingly.
```

### The `resolveModel` argument fix (4e)
```javascript
// lib/core/model-profiles.cjs:119
function resolveModel(roomDir, agentType) { ... }

// WRONG -- commands/persona.md:132, commands/grade.md:112
const model = resolveModel('persona-analyst', roomPath);   // always returns 'sonnet'

// RIGHT
const model = resolveModel(roomPath, 'persona-analyst');
```

### The already-correct in-process fan-out (do not touch)
```javascript
// lib/core/bono/cell-fanout.cjs:251-260 -- Promise.all over a cap-clamped grid,
// per-node failure isolated so one rejection never rejects the batch.
// Independently validated by the langtalks corpus's DAG-walker + semaphore pattern.
const readings = await Promise.all(planned.map(async (cell) => {
  try {
    const raw = dispatchCell ? await dispatchCell(cell, ctx) : await defaultDispatchCell(cell, ctx);
    return normalizeReading(raw, cell.subdomain, cell.hat);
  } catch (e) {
    return defensiveStub(cell.subdomain, cell.hat, e && e.message);
  }
}));
```

---

## State of the Art

| Old (as shipped / as documented in this repo) | Current | Since | Impact here |
|---|---|---|---|
| Forked subagents are an opt-in on external builds via `CLAUDE_CODE_FORK_SUBAGENT=1` | Fork mode ON by default in interactive; the env var is now the opt-OUT (`=0`) or headless opt-in (`=1`) | 2.1.232 | `capabilities-index.md:127` teaches the inverse. Must be rewritten. |
| Agent tool accepts `run_in_background` | Parameter **removed** when fork mode is on | 2.1.232 | 3 commands + 6 generated mirrors instruct Claude to pass it |
| Subagents nest 1 level (or 5, unchangeable) | Default depth 3, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | 2.1.219 | `framework-runner.md`'s no-nesting rule is now a choice, not a limit |
| Unbounded fan-out; 200-per-session cap | Concurrency cap 20; 200-per-session cap removed | 2.1.217 / 2.1.224 | Swarm sizing should clamp to 20 |
| Agent tool silently falls back to `general-purpose` | Clear error listing available agents | 2.1.235 | No repo code assumed the fallback, but dispatch prose names file paths, not agent types |
| MCP interrupted tool call reported as "completed with no output" | Explicit interrupted error (headless/remote) | 2.1.246 | Free diagnostic improvement for the plugin's own MCP server |
| Elicitation form clipped when taller than terminal | Fixed, scrollable, Accept/Decline pinned | 2.1.239 | Cannot bite: the plugin emits a single-property form |
| Elicitation URL-mode blank above 4,096 chars | Fixed | 2.1.238 | Cannot bite: the plugin uses form mode only |
| `enum` + `enumNames` enum schema | `TitledSingleSelectEnumSchemaSchema` (`oneOf:[{const,title}]`); legacy shape marked for removal | SDK <= 1.29.0 | **Shipped code emits the deprecated shape; multi-select drops labels entirely** |
| Skills `context: fork` runs foreground | Runs in background by default; `background: false` opts out | 2.1.218 | Unadopted (zero usage) |
| Custom commands and skills are distinct surfaces | Merged: both create `/name` and behave the same | (docs, current) | The 113-command + 126-mirror duplication may be re-examinable |
| "Opus 4.7 is the current top-tier model" | Opus 5 | -- | Stale prose in both reference docs; alias resolution means no code impact |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Claude Code | Everything | Yes | **2.1.246** | -- |
| Node.js | `lib/core/*.cjs` | Yes | >= 22.16.0 floor | -- |
| `@modelcontextprotocol/sdk` | Elicitation retrofit | Yes, vendored | **1.29.0** | -- |
| langtalks-graph-expert MCP | Mandatory grounding | Server yes; MCP tool surface **no** in this agent | graph 2026-08-26 | Driven in-process via its own Python entry point -- same code path |
| Brain MCP (pws-brain-mcp) | Runtime, not this phase | Yes, connected | -- | -- |
| Context7 MCP | Library API claims | Registered and connected in the session | -- | Vendored SDK source read directly, which is strictly more authoritative for a pinned version |
| `scripts/build-skill-mirrors.cjs` | Propagating `commands/` fixes | Yes | -- | none; mandatory |
| `scripts/build-dist-bundles.cjs` | Propagating to `dist/` | Yes | -- | none; mandatory |

No missing dependency blocks this phase.

---

## Validation Architecture

`workflow.nyquist_validation: true` in `.planning/config.json`.

### Test framework
| Property | Value |
|---|---|
| Framework | Plain Node scripts under `tests/`, orchestrated by `tests/run-all-<phase>.sh` (CLAUDE.md Verification section) |
| Config file | none -- convention-based |
| Quick run | `node tests/test-<name>.cjs` |
| Full suite | `bash tests/run-all-265.sh` (**does not exist -- Wave 0**) |
| Gate roll-up | `node scripts/doctor.cjs --acceptance` |

### Requirements -> test map (requirement IDs are TBD; ROADMAP line 456 says "TBD")
| Behavior | Type | Automated command | Exists? |
|---|---|---|---|
| Ledger JSON parses and every row carries capability/version/leverage/destination/status | unit | `node tests/test-capability-ledger-schema.cjs` | Wave 0 |
| No `run_in_background` string in `commands/`, `skills/`, `dist/` | tripwire | `node tests/test-no-run-in-background.cjs` | Wave 0 |
| No `CLAUDE_CODE_FORK_SUBAGENT` in `lib/ scripts/ agents/ commands/` outside the ledger | tripwire | `node tests/test-no-fork-subagent-literal.cjs` | Wave 0 (adapt `138-04`'s design) |
| Elicitation single-select emits `oneOf:[{const,title}]`, multi-select emits `items.anyOf` | unit | `node tests/test-gate-render-elicit-schema.cjs` | Wave 0 |
| `resolveModel` call sites in `commands/` use `(roomDir, agentType)` order | lint | `node tests/test-resolve-model-argorder.cjs` | Wave 0 |
| Ledger age tripwire fails when newest ledger version trails installed `claude --version` by > N | drift | `node tests/test-ledger-freshness.cjs` | Wave 0 |
| Generated mirrors match `commands/` after regeneration | regression | `node scripts/build-skill-mirrors.cjs --check` | **verify flag exists** |
| Born-wired / projection / render gates stay clean | gate | `node scripts/build-connector-registry.cjs --check` | Exists |

### Sampling rate
- Per task commit: the specific `tests/test-*.cjs` touched
- Per wave merge: `bash tests/run-all-265.sh`
- Phase gate: full suite green + `node scripts/doctor.cjs --acceptance` before `/gsd-verify-work`

### Wave 0 gaps
- [ ] `tests/run-all-265.sh`
- [ ] The six new test files above
- [ ] Confirm `build-skill-mirrors.cjs` supports `--check`; if not, that is a Wave 0 task in its own right

---

## Security Domain

`security_enforcement` not set in `.planning/config.json` -- treat as enabled.

### Applicable ASVS categories
| Category | Applies | Control |
|---|---|---|
| V2 Authentication | no | Phase touches no auth surface |
| V3 Session Management | no | -- |
| V4 Access Control | **yes, indirectly** | `allowed-tools` pre-approval. Adding `Task` to a command's `allowed-tools` **removes the permission prompt for spawning arbitrary subagents** in that turn. Treat as a privilege grant requiring an explicit decision, not a convenience edit. |
| V5 Input Validation | **yes** | The ledger JSON is read by a check script. Validate shape; never `eval`. Zod is already a dependency (`^3.25.76`). |
| V6 Cryptography | no | -- |
| V10 Malicious Code | **yes** | `commands/radar.md --fetch` WebFetches a remote changelog and writes it into the repo. Untrusted content reaching a file Claude later reads is an indirect-prompt-injection surface. |

### Threat patterns
| Pattern | STRIDE | Mitigation |
|---|---|---|
| Injection via fetched changelog text landing in the ledger | Tampering / Elevation | Extract only structured fields (version, date, bullet text) into typed JSON; never write raw fetched markdown into a file loaded as instructions. Note Claude Code 2.1.x already "Hardened the Agent tool against indirect prompt injection via content a subagent read" -- the platform treats this as a real class. |
| Silent privilege widening via `allowed-tools: Task` | Elevation | Any such addition is its own reviewed task with a stated reason; never bundled into a docs edit |
| Unbounded subagent fan-out | Denial of Service | Platform cap 20 (2.1.217). Repo-side, clamp N in swarm sizing; mirrors the existing `FUTURES_FANOUT_CAP` discipline |
| Stale ledger presenting false assurance | Repudiation | The freshness tripwire is the control. A ledger that cannot go stale silently is the phase's core security-adjacent property |
| Canon Part 8 | -- | No egress change in this phase. Unaffected. |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Node's `Promise.all` fan-out in `cell-fanout.cjs` is the intended long-term design for BONO, not a placeholder awaiting real subagents | 2a | If it was always meant to become subagent-based, "no change" is the wrong call. **Mitigation: ask the navigator.** Note `agents/persona-analyst.md:30` and the `cell-fanout.cjs:4` comment both *describe* subagent dispatch, so intent is genuinely ambiguous in the source. |
| A2 | Swapping to `TitledSingleSelectEnumSchemaSchema` is safe with hosts currently consuming the legacy shape | 4b | A host validating strictly against the legacy union could reject. `EnumSchemaSchema` is a union including both, so both should validate; not empirically tested against a live elicitation-declaring host. |
| A3 | The June 2026 `/mos:radar --fetch` genuinely ran and its output was hand-copied into 138-CONTEXT.md rather than the fetch silently failing | 4 / E-4 | Only affects the *narrative* of why the cache is stale; the staleness itself is verified fact either way. |
| A4 | `commands/radar.md`'s cache-write step is the broken link, rather than the operator choosing not to write it | Pitfall 5 | If deliberate, the fix is a policy change rather than a mechanism change. Either way the mechanism should be automatic. |
| A5 | `scripts/build-skill-mirrors.cjs` supports a `--check` flag | Validation | If absent, one extra Wave 0 task. Low. |
| A6 | Requirement IDs for Phase 265 do not yet exist and will be minted at plan time | throughout | ROADMAP line 456 says "TBD"; `.planning/REQUIREMENTS.md` has no radar/265 rows. Verified absent. |

---

## Open Questions

1. **Ledger file location and format.**
   Known: it must be machine-readable, and `138-04-PLAN.md` already gestures at `data/capability-ledger.json`.
   Unclear: whether it lives in `data/` (shipped to users, joining `command-registry.json`) or `.planning/` (dev-only, gitignored).
   **Recommendation: `data/capability-ledger.json`.** `.planning/` is gitignored, so a ledger there cannot travel between machines -- precisely the failure mode CLAUDE.md's open-handoffs section warns about.

2. **How far back does the ledger backfill?**
   The gap is 2.1.128 -> 2.1.246, roughly 118 versions.
   **Recommendation:** backfill only *relevant* entries, screened as in section 4. Do not mirror the changelog. Record `ledger_covers: {from, to}` so the freshness tripwire has an unambiguous anchor.

3. **Does the router run at `/gsd-plan-phase` time, or as a pre-commit drift check, or both?**
   138 wanted both. Both is more surface than one phase needs.
   **Recommendation: ship the drift check first** (mechanical, testable, cannot rot) and the plan-time injection second. A router nobody invokes is another 138.

4. **Should `Task` be added to `allowed-tools` on the three swarm commands?**
   This is a genuine privilege decision (V4 above), not a mechanical fix. **Recommendation: surface it as a gate, do not decide it in research.**

5. **A1's ambiguity: is BONO's in-process fan-out final?**
   **Recommendation: confirm with the navigator before the plan locks.** The whole "no code changes to the five engines" recommendation hinges on it.

---

## Recommendation for the planner

### What Phase 265's deliverable is NOT

**Do not write tasks that convert `/mos:eureka`, `/mos:bono`, `/mos:find-connections`, `/mos:whitespace`, or `/mos:find-analogies` to native subagent forking.** None of them spawns a subagent. `bono` is already parallel via `Promise.all` with a cost cap, a pattern the langtalks corpus independently validates as the production shape. The other four are single-context or single-detached-process flows with nothing to parallelize. **The ROADMAP goal's stale-fact #2 is itself a stale fact; correcting it is one of this phase's outputs.**

### What Phase 265's deliverable IS

Four workstreams. Roughly wave-ordered; W1 and W2 are independent.

---

**W1 -- Build the ledger that cannot rot. (The point of the phase.)**

| Do | Files |
|---|---|
| Create the machine-readable ledger, backfilled 2.1.128 -> 2.1.246 with only screened-relevant entries. Schema: `{capability, version, date, leverage, destination, status, evidence}` where `status` in `dormant \| adopting \| shipped \| superseded \| no-op`. Seed from section 4's tables. | `data/capability-ledger.json` (new) |
| Make `--fetch` write the LEDGER, not just a prose cache. This is the broken link in the whole loop. | `commands/radar.md` (then regenerate mirrors) |
| Freshness tripwire: fail when the ledger's newest version trails installed `claude --version` beyond a threshold. This is what makes rot impossible rather than merely discouraged. | `tests/test-ledger-freshness.cjs`, wired into `scripts/doctor.cjs --acceptance` |
| Rewrite both radar reference docs. They currently teach the INVERSE of platform reality (`CLAUDE_CODE_FORK_SUBAGENT` polarity at `capabilities-index.md:127`) and stale model facts ("Opus 4.7 is the current top-tier model", `executor_model` which does not exist). Strip em-dashes while in there. | `references/capability-radar/capabilities-index.md`, `changelog-cache.md` |
| Retire the predecessors without deleting: SEED-003 -> `superseded_by: Phase 265`; Phase 138 -> superseded, forward-pointing to 265; close drift finding **W007-138**. | `.planning/seeds/SEED-003-*.md`, `.planning/phases/138*/`, `docs/CANON-PHASE-MAP.md` |

---

**W2 -- The three real retrofits. (Proof the ledger produces action, not just rows.)**

| # | Retrofit | Files (edit `commands/` only, then regenerate) |
|---|---|---|
| R1 | **Remove `run_in_background: true`** from all Agent-tool dispatch instructions. The parameter is removed by the platform in fork mode (the interactive default since 2.1.232). Replace with the corrected block in Code Examples. Add the 20-concurrency cap to swarm sizing. | `commands/act.md:432`, `commands/persona.md:136`, `commands/grade.md:116` + `scripts/build-skill-mirrors.cjs` + `scripts/build-dist-bundles.cjs` |
| R2 | **Elicitation schema currency.** Single-select: legacy `enum`+`enumNames` -> `oneOf:[{const,title}]`. Multi-select: `items.enum` -> `items.anyOf:[{const,title}]`, which **fixes users currently seeing raw slugs instead of labels on rung 1**. Update the stale header comment at lines 9-14 (it is right about descriptions, wrong about titles). **Tri-polar note: rung 1 is the Desktop/Cowork path, so this is a real user-facing UX fix, not housekeeping.** | `lib/mcp/gate-render.cjs:172-201`, comment block 9-14 |
| R3 | **Fix reversed `resolveModel` arguments.** `resolveModel('persona-analyst', roomPath)` -> `resolveModel(roomPath, 'persona-analyst')`. Currently both parallel-dispatch commands silently always resolve to `'sonnet'`, bypassing stage hints and overrides. | `commands/persona.md:132`, `commands/grade.md:112` |

Each retrofit ships with the tripwire test that keeps it fixed (see Validation Architecture). R2 is the strongest single deliverable: a shipped-code obsolescence caught by exactly the discipline this phase institutes.

---

**W3 -- Record the settled decisions.**

- **A4 is SETTLED, not open.** Record: platform default forking (2.1.232) supersedes SEED-003 A4. No hand-rolled harness ships. Keep 138-04's no-literal tripwire, with the polarity correction noted in section 3.
- Record the **corrected destination mapping**: the fan-out surfaces are `act --swarm` / `persona --parallel` / `grade --full` / `trending-to-absurd` (Expert), **not** the five PWS engines. Preserve the reasoning so the next reader does not re-derive it.
- Record `bono`'s in-process fan-out as **deliberate and validated**, citing both `cell-fanout.cjs:251` and the langtalks DAG-walker grounding, so no future phase "fixes" it.
- Suggested location: `docs/RADAR-ABSORPTION-265.md`, cross-referenced from the ledger.

---

**W4 -- Dev-research compositing. (CLAUDE.md-mandatory, not optional.)**

File the durable reasoning trail at `~/MindrianRooms/rethinking-mindrianos/research/2026-08-26-capability-radar-265/`, mirrored to `mindrianOS/research/`, cross-linked back to this phase. Per CLAUDE.md, a phase artifact citing "per the room's research" without the citation, or a room entry that never lands in a phase, both count as incomplete.

---

### Gate before planning locks

Two items need the navigator, not the planner:
1. **A1** -- is BONO's in-process `Promise.all` the intended final design? The entire "no changes to the five engines" recommendation rests on yes.
2. **Open Question 4** -- add `Task` to the three swarm commands' `allowed-tools`? Real UX win (removes up to 8 permission prompts on `/mos:grade --full`), real privilege grant. Surface as a decision gate, do not fold it into a docs task.

### Scope discipline

Explicitly **out of scope**, recorded to the ledger as `dormant` and left alone:
- The `context: fork` skill capability (2.1.218) -- zero current usage, a design conversation of its own
- The commands-merged-into-skills consolidation -- touches 239 files and the Windows rationale in `build-skill-mirrors.cjs:10`; a phase in its own right
- Ingesting Fragmented #305 / #309 into the langtalks corpus (gap G-1) -- cross-repo, worth doing, not here

---

## Sources

### Primary (HIGH confidence)
- **Shipped code, read directly:** `lib/core/bono/cell-fanout.cjs`, `lib/core/bono/persona-research.cjs`, `lib/core/dispatch-optimizer.cjs`, `lib/core/model-profiles.cjs`, `lib/core/brain-client.cjs`, `lib/mcp/gate-render.cjs`, `commands/{act,persona,grade,grade-grant,trending-to-absurd,radar,eureka,bono,find-connections,whitespace,find-analogies}.md`, `agents/*.md`, `scripts/build-skill-mirrors.cjs`
- **Vendored SDK source:** `node_modules/@modelcontextprotocol/sdk/dist/cjs/types.js:1685-1815` (v1.29.0) -- enum schema shapes, `ElicitRequestFormParamsSchema` / `ElicitRequestURLParamsSchema`
- **Official changelog:** `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`, full file (5,894 lines), segment 2.1.159 -> 2.1.246 parsed with version pinning
- **Official docs:** `code.claude.com/docs/en/sub-agents` (fork defaults, `run_in_background` removal, `CLAUDE_CODE_FORK_SUBAGENT` semantics, concurrency cap, spawn depth, missing-`subagent_type` error); `code.claude.com/docs/en/skills` (`allowed-tools` vs `disallowed-tools` frontmatter table, commands-merged-into-skills)
- **Installed binary:** `claude --version` -> 2.1.246
- **langtalks-graph-expert corpus, source documents read in full:** `sources/research/markdown/url-https-data4sci-com-blog-building-an-adva.md`, `sources/langtalks/transcripts/ep71.txt`, `sources/research/markdown/url-https-fragmentedpodcast-com-episodes-307.md`, both `claude.com/blog/*` sources
- **Repo prior art:** `138-CONTEXT.md`, `138-0{2,3,4}-PLAN.md`, `.planning/phases/138/DRIFT.md`, `SEED-003-*.md`, `.planning/ROADMAP.md:447-456`, `.planning/config.json`, `CLAUDE.md` + its four `@include`s

### Secondary (MEDIUM confidence)
- langtalks graph traversals (`query_relationship`, `relationship_path`, `graph_stats`) -- used for discovery; every finding traced to its underlying source document before being asserted
- Historical design specs `docs/POWERHOUSE-1.6.0-SPEC.md:237`, `docs/research/RESEARCH_11_POWERHOUSE_SESSION.md:292,134` -- cited only as the *origin* of the `run_in_background` error, not as authority

### Tertiary (LOW confidence)
- None. Every claim in this document traces to code, official docs, the changelog, the vendored SDK, or a named corpus source.

---

## Metadata

**Confidence breakdown:**
- Section 2 (the five engines do not spawn subagents): **HIGH** -- full read of every dispatch path, not grep alone
- Section 2c (`run_in_background` removed): **HIGH** -- official docs verbatim + zero changelog occurrences ever
- Section 2d (`allowed-tools` is pre-approval): **HIGH** -- official frontmatter table; I held the opposite belief mid-research and corrected against source
- Section 3 (no code assumed the fork gate): **HIGH** -- exhaustive grep, 2 hits, both in docs
- Section 4a/4c (interrupted-call, agent fallback): **HIGH** -- verified absence of any assuming code
- Section 4b (elicitation): **HIGH** on the current shape being deprecated (SDK source); **MEDIUM** on host-side migration safety (A2, untested live)
- Section 4e (`resolveModel` reversed): **HIGH** -- signature vs. call site, direct comparison
- Section 5 (Opus floor): **HIGH** -- the config keys simply do not exist
- langtalks grounding: **MEDIUM** -- corpus covered the general pattern well, does not cover Claude Code platform mechanics (gaps G-1..G-4 reported explicitly)
- Recommendation: **HIGH** on what NOT to do; **MEDIUM** on ledger file placement (Open Question 1)

**Research date:** 2026-08-26
**Valid until:** 2026-09-09 (14 days). Claude Code ships multiple versions per week; the 2.1.246 baseline will move. The ledger freshness tripwire proposed in W1 exists precisely so this expiry stops mattering.
