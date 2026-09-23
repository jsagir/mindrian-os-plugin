# Phase 361: Dominant-design research mode - Research

**Researched:** 2026-09-23
**Domain:** Plugin surface upgrade (command + read-only fetcher agent + Part 8 recognizer + local evidence filing + Theo read-with-degrade)
**Confidence:** HIGH on the repo contracts (read at file:line this session); MEDIUM on two host behaviors (agent `tools:` enforcement, subagent name scoping) that are documented but not exercised live here; LOW only on `case_story`'s input shape (the tool does not exist yet).

## Summary

Everything Phase 361 needs already has a precedent in this repo, and the job is to compose those precedents, not invent. The approved-query-only fetcher (`agents/analogy-query-fetcher.md`), the gate-before-dispatch body pattern (`commands/find-analogies.md:191-251`), the composer-plus-audit query fence (`lib/core/eureka/online-pattern-query.cjs:101-135` over `lib/core/rs-egress-prompts.cjs:52-70`), the Part 8 known-shape recognizer (`lib/core/part8-egress-guard.cjs:454-494`), the local filing chokepoint (`lib/core/navigation/file-evidence-readback.cjs:72`), and the Theo-read-with-local-fallback module shape (`lib/core/strategy/taxonomy-climb.cjs`) are all shipped and tested. The phase is: one new excluded agent, one upgraded command body, two small pure CJS modules plus one CLI, three new recognizer arms, one grant row, and regenerated registries.

Four findings change how the plan must be written. (1) There is no CLI door to `fileEvidenceWithReadback` today: the only runtime callers are `lib/workflow/dial-close-reach.cjs:169` and `lib/core/recovery/controller.cjs:417`, and the comments in `scripts/on-file-changed:63-66` and `scripts/on-agent-complete:108` that say post-write routes through it are not borne out (grep of `scripts/post-write` and `lib/core/intelligence-cascade.cjs` finds no call). D-07 therefore needs a small script that opens the room through `navigation.openRoomDbForCaller` and calls it. (2) Claude Code subagents honor `tools:`, not `allowed-tools:`; every agent in this repo declares `allowed-tools:` only, so the "structurally cannot write" claim in the two fetcher agents is not host-enforced. The new agent must declare `tools:`. (3) Live Theo, probed this session with the generic handle only: `framework_step` IS served and returns Dominant Design with `orchestrationStatus: "draft"` and `steps: []`; `framework_techniques` and `case_story` both return `MCP error -32602: Tool ... not found`. So today's real runtime path is the D-09 fallback, and "served but zero steps" must be a fallback trigger, not just "tool absent". (4) The command-registry row carries no `web_scope` and no agent field; it is generated from command frontmatter (`scripts/build-command-registry.cjs`, `generated_note`), and `web_scope` lives in the connector registry. The row changes only through `teaching` / `produces` / `autonomous_safe`, which is what moves the `registryHash` Theo diffs at the next release's Step 5.6 notify.

**Primary recommendation:** Build it as five small, independently testable pieces (recognizer arms, lane-query composer, evidence-pack validator/renderer/filer, Theo-structure reader, read-only agent), then wire the command body last, copying `find-analogies.md`'s PHASE 0 / PHASE 1 / PHASE 2 structure verbatim in shape, with requirement family `DDR361`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Shape (navigator, 2026-09-23)
- **D-01:** Upgrade the existing `/mos:dominant-designs`. No new command, no duplicate registry row. The registry row `data/command-registry.json` (`/mos:dominant-designs`, around line 545) is updated in place (`web_scope`, the agent it dispatches, `produces`), and the theo-resync dispatch fires per `docs/THEO-NOTIFY-CONTRACT.md`.
- **D-02:** Planned now, in parallel with Theo Phase 20's execution. Different repo, no file overlap.

#### Entry and spend guard
- **D-03:** Entry is the existing "Quick pass or deep dive?" question. Deep dive leads to a **query gate**: Larry composes the planned research question(s) per lane from the navigator's domain answer (methodology Phase 1, Domain Selection) and shows them as a gate card. The navigator approves or edits, and only then do the agents fan out. No silent web spend. The pattern to copy is `agents/analogy-query-fetcher.md` (it fetches exactly the navigator-approved query string and never rephrases or supplements it).
- **D-04:** The researcher agent never composes, rephrases or expands a query. It runs exactly what the gate approved, the same contract as analogy-query-fetcher.

#### Evidence lanes (all four, navigator multi-select)
- **D-05:** Four lanes, one agent invocation per lane, dispatched in parallel:
  1. **Variant census:** competing designs in the domain, first-appearance dates, backers.
  2. **Convergence signals:** standards, market-share shifts, exits, consolidation dates.
  3. **S-curve limits:** physical, market and economic ceilings of the current dominant design.
  4. **Discontinuity signals:** new entrants, substitutes, patent and funding bursts.
- **D-06:** Every claim row carries `{claim, source_url, source_title, retrieved_at, quote_or_locator}`. A claim without a source is dropped, not hedged (Canon Part 12 sourced-claims rule). No scores, no confidence floats, no "dominance strength" number unless a source states it.

#### Output
- **D-07:** **Evidence pack plus Larry.** One filed evidence artifact per lane in the room, through the existing `fileEvidenceWithReadback` filing path with provenance. Larry then runs the six phases, and the final analysis artifact (the existing template in `references/methodology/dominant-designs.md`) links each statement back to its evidence rows. A lane that found nothing files an explicit empty result ("searched X, found no sourced evidence"), never a silent gap.
- **D-08:** Nothing files without the navigator's approval, following the existing command's "File this to competitive-analysis?" confirm step and the nugget-routing rule.

#### Theo dependency
- **D-09:** **Use Theo if it is served, degrade otherwise.** When the Theo catalog lists `framework_step` / `framework_techniques` (Theo Phase 20) or `case_story` (Theo Phase 20.1), read the Dominant Design framework structure and worked cases from Theo with generic handles only (the framework name). When a tool is absent, fall back to `references/methodology/dominant-designs.md` and state which source the structure came from in the artifact. Ship does not wait on Theo's deploy.
- **D-10:** Part 8: Theo calls carry ONLY the generic handle `"Dominant Design"` (and case/framework names), never room content or the navigator's domain text. Add known-shape entries for `framework_step`, `framework_techniques` and `case_story` to `lib/core/part8-egress-guard.cjs` `_proveKnownToolShape` (around lines 455-465) as **separate entries**. Do not edit Phase 355's `find_connections` entry, so the two phases do not collide on that block (jsagi-d9's request, 2026-09-23). Tavily queries are web egress, not Brain egress. They carry the navigator-approved query text and are the navigator's explicit spend (D-03).

### Claude's Discretion
- Agent file naming, JSON schema field names beyond D-06's minimum, how many Tavily calls each lane may make (set a small fixed cap and state it), and whether lanes run as `Agent` fan-out or a chain (the `chain_run` autonomous_safe prefix is acceptable if it halts at the query gate).

### Deferred Ideas (OUT OF SCOPE)
- A Jev-judged "does this evidence support convergence" classifier: waits on the Theo rule-1 amendment (SEED-015) and Phase 355's policy work.
- A scheduled re-scan of a domain's discontinuity lane (a scout-style watch). This would be its own phase.
- Card rendering for Theo's `visualize_framework_map` output of the Dominant Design framework: waits on the Theo card-rendering phase.

Also out of scope per CONTEXT `<domain>`: a new `/mos:` command, any scoring or dominance number the evidence does not source, Jev/TypeSafe judgment, and Theo-side code.
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs exist yet for Phase 361. Recommended family: **`DDR361`** (Dominant-Design Research), following the per-phase convention of the three most recent registered families (`GATE357`, `FORK359`, `BIND360` at `.planning/REQUIREMENTS.md:2998, 3047, 3108`). Collision check this session: `grep -rnoE "\bDDR361\b|\bDD361\b" .planning docs lib tests` returns nothing [VERIFIED: grep]. The only near-miss in the tree is `DDD-02` (a different family). Mint these at plan time as `- [ ]` rows under a new `### Phase 361 - Dominant-design research mode (DDR361 family)` heading placed after the Phase 360 block and before `## Traceability` (`.planning/REQUIREMENTS.md:3173`).

| ID | Description | Research Support |
|----|-------------|------------------|
| DDR361-01 | A new read-only agent `agents/dominant-design-researcher.md` answers ONE lane per invocation, fetches exactly the approved query string(s), returns structured JSON only, and is host-restricted by a `tools:` list with no Write/Edit/Bash/Brain tool | Agent contract section; `tools:` finding (Pitfall 1) |
| DDR361-02 | A deterministic lane-query composer produces the four lane queries from the navigator's domain answer and audits every string (and every navigator edit) through `auditQueryString` before it can reach the gate card | Pattern 2; `online-pattern-query.cjs:101-135` |
| DDR361-03 | No researcher agent is dispatched before the navigator approves the gate card; the navigator can edit or drop lanes; an unattended caller never enters the research path | Pattern 3; `find-analogies.md:203-208`; autonomous_safe section |
| DDR361-04 | Approved lanes fan out in parallel, one agent per lane, at most 4 agents and at most 2 approved queries per lane, one search call per query; Desktop/Cowork degrade honestly | Pattern 4; Tavily cap; Tri-Polar table |
| DDR361-05 | Every returned claim row is validated to the D-06 minimum; rows missing any of the five fields are dropped (counted, never hedged); score/confidence keys are rejected | Evidence-pack validator; Canon Part 12 |
| DDR361-06 | One evidence artifact per approved lane is written after approval, including an explicit empty-lane artifact with a "Searched, not found" list | Artifact layout |
| DDR361-07 | Each lane's sourced rows file through `navigation.fileEvidenceWithReadback` with the four locked provenance fields, and the readback result is surfaced (landed or not) | Filing section; `file-evidence-readback.cjs:72-160` |
| DDR361-08 | Larry's six-phase analysis artifact (existing template) cites evidence rows by id for every factual statement, and names its structure source | Analysis artifact section |
| DDR361-09 | The Dominant Design structure is read from Theo (`framework_step`, `framework_techniques`, `case_story`) with ONLY `{framework: "Dominant Design"}`, and degrades to the local reference on unreachable / not served / shape refused / zero steps, naming the source and reason | Theo section; live probe |
| DDR361-10 | `_proveKnownToolShape` gains three separate arms (framework_step, framework_techniques, case_story); the find_connections arm is byte-unchanged; parity with Theo's input shapes is tested read-only against the Theo checkout | Part 8 section |
| DDR361-11 | Frontmatter truth: `connector.web_scope` becomes non-null, `Task` pre-approval plus a reviewed grant row, `teaching` names research mode, `autonomous_safe` stays truthful; command registry, connector registry, skill mirror, harness manifest and orchestration projection regenerate and every `--check` is green | Registry section |
| DDR361-12 | The command-registry change moves `registryHash`, so the next real release's Step 5.6 `theo-resync` dispatch carries it; the phase records this as release-time, not phase-time | Theo notify section |
| DDR361-13 | The quick pass behaves exactly as today (no agent, no web, no Theo call required) | Anti-pattern: quick-pass regression |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives with the same authority as locked decisions [VERIFIED: /home/jsagi/dev/MindrianOS-Plugin/CLAUDE.md]:

- **GSD-only.** All edits run inside a GSD workflow (`/gsd-execute-phase`). No direct repo edits outside it.
- **Workspace guard.** Work only in `/home/jsagi/dev/MindrianOS-Plugin/`; read version with `node lib/core/repo-version.cjs` (currently `2.0.0-beta.48` [VERIFIED: run this session]).
- **Canon Part 8.** User data never egresses to the Brain; only generic framework handles cross the wire.
- **Canon Part 3.** Material choices pass a Decision Gate rendered through Shape F (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen).
- **Canon Part 7.** Reuse before build; search commands/agents/pipelines/skills from disk first and justify any net-new surface.
- **Canon Part 9.** SQL (room.db) is the local mind; a truth-claim node lands `proposed`, only a human confirms.
- **Canon Part 11 (CIRS).** Every invocable surface is born WIRED or EXCLUDED-with-reason; HITL shape declared or exempted via `connector.excluded:true` + reason. Plans touching `commands/`, `skills/` or `agents/` must carry a `cirs_relationship:` block and `11` in `canon_parts` (`scripts/check-cirs-declaration.cjs:23-29, 96-135`).
- **Canon Part 12.** Every claim stated as fact is "sourced or absent"; "A hedge word is not a source." (`docs/MINDRIAN-CANON.md:667-681`).
- **Tri-Polar.** Evaluate CLI, Desktop, Cowork; a skipped surface is a stated call.
- **Conventions.** CJS only, no TypeScript, no new npm deps; `process.argv` switch-case CLIs; no em-dashes anywhere (hyphens only); Feynman-simplified JTBD prose.
- **Verification.** Run `bash tests/run-all-<phase>.sh`, `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance` before declaring done.
- **Repo hygiene with peers.** Three other sessions are active (355, 358, 359, 360 per CONTEXT). Commit with `git commit --only <paths>`; `.planning/` files need `git add -f`. Working tree already shows peer-owned modifications (`scripts/doctor.cjs`, `tests/test-353-*.cjs`, others) [VERIFIED: git status]; never touch or revert them.
- **Dev-research compositing.** CLAUDE.md asks that MindrianOS-architecture phases file reasoning in both the phase dir and `~/MindrianRooms/rethinking-mindrianos/research/`. This phase is user-facing feature work, so compositing is optional; if the planner includes it, it is a close-out task.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Quick-pass / deep-dive fork, gate card, six-phase analysis | Conversation (Larry, command body) | - | Pedagogy and Decision Gates are Larry's job (Part 3, Part 12) |
| Lane query composition + Part 8 audit | Local CJS (`lib/core/dominant-design/lane-queries.cjs`) | CLI script | Deterministic, testable, one source of outbound strings (D-04) |
| Web fetch per lane | Subagent (`agents/dominant-design-researcher.md`) | Web tool (Tavily MCP or WebSearch) | Parallel, tool-scoped, read-only worker (D-05) |
| Claim-row validation, artifact rendering, tier mapping | Local CJS (`lib/core/dominant-design/evidence-pack.cjs`) | - | D-06 must be enforced by code, not by agent goodwill |
| Evidence filing to room.db | Local navigation chokepoint (`navigation.fileEvidenceWithReadback`) | CLI script | Part 9 single door; readback honesty |
| Framework structure (steps, techniques, cases) | Theo (remote, via `brainClient.callTool`) | Local reference file | D-09: Theo when served, reference otherwise |
| Egress proof for Theo calls | `lib/core/part8-egress-guard.cjs` | brain-client in-process belt | D-10 |
| Registry, connector, grant, skill mirror | Generated data (`scripts/build-*.cjs`) | - | Generated from frontmatter, never hand-edited |
| Theo command-layer resync | Release script Step 5.6 | - | Fires at release, not in the phase (THEO-NOTIFY-CONTRACT) |

## Standard Stack

No new libraries. Everything is in-repo CJS plus host tools.

### Core (in-repo, reuse)
| Module | Location | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `auditQueryString` | `lib/core/rs-egress-prompts.cjs:52-70` | Throws `ExternalEgressViolation` on any Canon FORBIDDEN_PATTERNS hit | The shared Part 8 chokepoint "every fetcher MUST call before any fetch" [VERIFIED: file] |
| `composePatternQueries` shape | `lib/core/eureka/online-pattern-query.cjs:94-135` | Compose-then-audit envelope `{ok, queries, audited}` / `{ok:false, degrade:'local-only', reason}` | The exact envelope find-analogies uses; copy the shape, not the templates [VERIFIED: file] |
| `navigation.fileEvidenceWithReadback` | `lib/core/navigation.cjs:689` -> `lib/core/navigation/file-evidence-readback.cjs:72` | Writes EvidenceClaim + optional INFORMS edge in one txn, reads back, asserts provenance | D-07 names it; Part 9 single door [VERIFIED: file] |
| `navigation.surfaceFileEvidenceResult` | `file-evidence-readback.cjs:195-240` | Turns ok/fail into a Larry-facing message | FILEVAL honesty rule [VERIFIED: file] |
| `navigation.openRoomDbForCaller` / `closeRoomDbForCaller` | `lib/core/navigation/spine-events.cjs:454-472` | Allow-listed room.db open; returns `null` when `room.db` is absent | Scripts already use it (`scripts/hedge-refit-pipeline.cjs:112`) [VERIFIED: file] |
| `stripInjectionSpans` | `lib/core/navigation/evidence-claim.cjs:186` (exported) | Removes instruction/exfiltrate/email/URL spans from prose | Reuse for lane markdown rendering of web quotes [VERIFIED: file] |
| `brainClient.callTool` | `lib/core/brain-client.cjs:595` | The single Theo wire door; runs the in-process Part 8 belt at 657-676 | `taxonomy-climb.cjs` precedent: one wire door only [VERIFIED: file] |
| `_looksLikeUnknownToolError` | `lib/core/brain-client.cjs:2476-2488` (internal, exposed via `_test`) | Detects unknown-tool text | Usable, but see Pitfall 4 (-32602 ambiguity) [VERIFIED: file] |

### Host tools
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Tavily MCP `tavily-search` | user-level `tavily-mcp@0.1.3` on this machine | Web search per approved query | Input schema: `query` (required), `search_depth` basic/advanced, `topic` general/news, `time_range`, `max_results` 5-20 default 10, `include_raw_content`, `include_domains`, `exclude_domains` [VERIFIED: npm pack tavily-mcp@0.1.3, build/index.js:59-135]. Not bundled by the plugin (`.mcp.json` has only `mindrian-os` and `mindrian-brain`) |
| `WebSearch` | Claude Code built-in | Fallback with the identical string | Same fallback as both fetcher precedents |
| Agent tool | Claude Code | Parallel subagent dispatch | Precedent strings at `commands/find-analogies.md:218`, `commands/scout.md:166` |
| AskUserQuestion | Claude Code | Gate card | Firing-block v2 contract in command body |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent fan-out | `chain_run` autonomous_safe prefix (CONTEXT discretion) | chain_run halts at material steps and routes through the MCP gate ledger, but there is no chain recipe for lanes today and the fetcher precedents all use the Agent tool. Use Agent fan-out. |
| Reusing `agents/research.md` | - | It carries Write plus two Brain tools and composes its own queries (`agents/research.md:7-13, 59`); both precedents minted a narrow sibling instead. Do not reuse. |
| Reusing `analogy-query-fetcher` | - | Its return shape is SAPPhIRE-specific; a lane agent needs claim rows. Mint a sibling. |
| `tavily-extract` | - | Pulls full pages (bigger prompt-injection surface, more spend). Not needed: `tavily-search` result `content` snippets carry the quote. Do not grant. |

**Installation:** none. **Version verification:** not applicable (no packages). Tavily is the user's own MCP; its absence degrades to `WebSearch`.

## Package Legitimacy Audit

This phase installs **no external packages** (no npm, pip or cargo additions; CLAUDE.md forbids new deps). slopcheck was not run because there is nothing to check. `tavily-mcp` is referenced only as a tool the user may already have configured; the phase does not install it.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | No installs |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
navigator: /mos:dominant-designs
        |
        v
[Larry] "Quick pass or deep dive?" (AskUserQuestion, F.1)
   |                         |
 quick                     deep
   |                         |
   v                         v
(today's flow,       [Larry] Phase 1 Domain Selection -> domain answer
 unchanged)                  |
                             v
            node scripts/dominant-design-research.cjs compose-queries <domain.json>
                 lane templates x4  -> auditQueryString (Part 8 fence)
                 |                     |
             {ok:true, lanes[]}    {ok:false, degrade:'local-only'} -> say so, offer quick pass
                 |
                 v
        GATE CARD (AskUserQuestion): run all / edit or drop lanes / quick pass instead
                 |  (edits -> audit-query -> back to card)       |
              approve                                        decline -> quick pass
                 |
   (parallel, CLI only)  theo-structure (generic handle only) ---> Theo framework_step /
                 |                                                  framework_techniques / case_story
                 v                                                  | not served / 0 steps / unreachable
   Agent x N (N<=4): dominant-design-researcher                     v
     tavily-search(approved string) -> WebSearch(same string)   references/methodology/dominant-designs.md
     returns {lane, query, claims[], searched_not_found[], error}          |
                 |                                                         |
                 v                                                         |
   validate-lane (drop unsourced rows, reject score keys) <----------------+
                 |
                 v
   [Larry] six phases ON TOP of the evidence rows (cites E-<lane>-<n>)
                 |
                 v
   CONFIRM CARD "File this to competitive-analysis?" (D-08)
                 |yes                                  |no -> nothing written
                 v
   Write lane artifacts x N + analysis artifact (room/competitive-analysis/dominant-designs/)
                 |
                 v
   node scripts/dominant-design-research.cjs file-lane <lane.json> --room <dir>
     -> openRoomDbForCaller -> fileEvidenceWithReadback per unique URL -> surfaceFileEvidenceResult
                 |
                 v
   Larry shows readback (landed / not landed) per lane
```

### Recommended Project Structure

```
agents/
  dominant-design-researcher.md        # NEW read-only lane worker (excluded connector)
commands/
  dominant-designs.md                  # UPGRADED body + frontmatter
skills/dominant-designs/SKILL.md       # REGENERATED by scripts/build-skill-mirrors.cjs, never hand-edited
lib/core/dominant-design/
  lane-queries.cjs                     # NEW pure: LANES, composeLaneQueries, auditEditedQuery
  evidence-pack.cjs                    # NEW pure: validateLaneResult, renderLaneArtifact, toEvidenceClaimParams, tierFor
  theo-structure.cjs                   # NEW: readDominantDesignStructure({brainClient}) with degrade
scripts/
  dominant-design-research.cjs         # NEW CLI router: compose-queries | audit-query | theo-structure | validate-lane | file-lane
lib/core/part8-egress-guard.cjs        # EDIT: three new arms after recommend_chain
data/subagent-dispatch-grants.json     # EDIT: one row for commands/dominant-designs.md
data/command-registry.json, data/connector-registry.json, data/connector-coverage-ledger.json,
data/harness-manifest.json, data/brain-orchestration-projection.json   # REGENERATED
tests/test-361-*.cjs, tests/run-all-361.sh                            # NEW
```

### Pattern 1: The agent contract (what a new agent must declare to pass existing audits)

Evidence from the two precedents and the audits that walk `agents/`:

| Requirement | Evidence | What 361's agent declares |
|---|---|---|
| Frontmatter present (starts with `---`) | `scripts/verify-release:131-140` | yes |
| `name`, `description`, `model: inherit` | `agents/analogy-query-fetcher.md:1-5`, `agents/competitor-watch-fetcher.md:1-5` | `name: dominant-design-researcher`, `model: inherit` |
| Tool allow-list the HOST honors is `tools:` | Claude Code docs: plugin agents support `name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, omitClaudeMd, isolation, color, experimental`; `hooks`, `mcpServers`, `permissionMode` are ignored for plugin agents; omitting `tools` inherits every tool [CITED: code.claude.com/docs/en/sub-agents, code.claude.com/docs/en/plugins-reference] | `tools:` list (see below) |
| Repo convention and audits read `allowed-tools:` | `scripts/verify-release:146-159` (plain-string entries, no inline comments), `scripts/check-brain-tool-liveness.cjs:287-312` (Brain names in agent `allowed-tools` must be live) | mirror the identical list under `allowed-tools:`; it names no Brain tool so the liveness gate has nothing to check |
| R1 born wired or excluded-with-reason | `docs/CONNECTOR-CONTRACT.md:34-35`; precedents `analogy-query-fetcher.md:23-25` | `connector: { excluded: true, reason: "..." }` (machinery sentence, no user content) |
| NO `hitl_shape` when excluded | `tests/test-209-declared-implies-wired.cjs:137-160`: hasShape plus `connector.excluded:true` is a contradiction, and only a frozen KNOWN list may carry it | omit `hitl_shape`/`hitl_why` entirely |
| `layer` + `layer_why` in closed vocab | `scripts/check-layer-declaration.cjs` (fail closed), precedents use `layer: "loop"` | `layer: "loop"`, `layer_why:` one sentence naming the fan-out |
| No banned doctrine phrases | `tests/test-250-doctrine-fence.cjs:81-89` bans `/silent fallback/i`, `/never mention (failures|this bookkeeping)/i`, `/graceful degradation everywhere/i`, `/never tell (the )?user about degradation/i` in `skills/ commands/ agents/ dist/` | avoid the words "silent fallback" even in a negation |
| `color` | documented colors: red, blue, green, yellow, purple, orange, pink, cyan [CITED: sub-agents docs] | `cyan` (the precedents' `teal` is not in the documented list) |

Recommended frontmatter:

```yaml
---
name: dominant-design-researcher
description: Fetch the navigator-approved query string(s) for ONE Dominant Design evidence lane (variant census, convergence signals, S-curve limits, discontinuity signals) via Tavily, falling back to WebSearch with the identical string, and return sourced claim rows as JSON. Never composes, rephrases, expands, or supplements a query; never writes; never calls Brain.
model: inherit
color: cyan
# The HOST enforces `tools:` (code.claude.com/docs/en/sub-agents). `allowed-tools:` below is the
# repo-convention mirror that scripts/verify-release and scripts/check-brain-tool-liveness.cjs
# read. The two lists must stay identical (asserted by tests/test-361-agent-contract.cjs).
tools:
  - mcp__tavily__tavily-search
  - mcp__tavily-mcp__tavily-search
  - WebSearch
  - Read
allowed-tools:
  - mcp__tavily__tavily-search
  - mcp__tavily-mcp__tavily-search
  - WebSearch
  - Read
connector:
  excluded: true
  reason: "Invoked BY commands/dominant-designs.md's deep-dive research fan-out as one of up to four parallel per-lane fetch workers, strictly AFTER the navigator's gate-card approval; it is never a problem-state-triggered reach itself and never reaches a Decision-Gate fork (it returns structured data only), so it is exempt from an hitl_shape declaration by construction."
layer: "loop"
layer_why: "Fetches ONE lane's approved queries and returns sourced claim rows in a single bounded pass; a worker's own cycle invoked by dominant-designs.md's fan-out, not the graph that dispatches it."
---
```

Why both Tavily spellings: this repo names `mcp__tavily__tavily-search` in 16 places and `mcp__tavily-mcp__tavily-search` in 6 [VERIFIED: grep], and this machine's user-level server key is `tavily-mcp` [VERIFIED: ~/.claude.json mcpServers key, value redacted], so its live tool is `mcp__tavily-mcp__tavily-search`. The host refuses to launch an agent only when NOTHING in `tools` resolves [CITED: sub-agents docs, "Agent would be spawned with zero tools"], so listing both plus `WebSearch` is safe.

**Return shape (D-06 minimum plus discretionary fields):**

```
{
  lane: "variant_census" | "convergence_signals" | "s_curve_limits" | "discontinuity_signals",
  queries: [string],                 // the approved strings, echoed back byte-identical
  searched_via: "tavily" | "websearch" | null,
  claims: [
    {
      claim: string,                 // one factual sentence, no hedge words standing in for a source
      source_url: string,            // http(s) URL of the page the quote came from
      source_title: string,
      retrieved_at: string,          // ISO-8601, the time of THIS fetch
      quote_or_locator: string,      // verbatim snippet from the result, or a locator (section / page)
      source_type: "peer_reviewed" | "standards_or_regulatory" | "company_primary" | "market_data" | "press" | "other",
      stated_date: string | null,    // a date ONLY when the source states it (first appearance, exit, standard ratified)
      entities: [string]             // named designs, backers, companies, standards, only as the source names them
    }
  ],
  searched_not_found: [string],      // what the lane looked for and found no sourced evidence of
  error: string | null               // set only when both Tavily and WebSearch failed, or the assigned query was empty
}
```

No `score`, `confidence`, `strength`, `probability`, or `rank` field anywhere; the Tavily result `score` must not be passed through.

### Pattern 2: Lane-query composer (the ONLY source of outbound strings)

Copy `composePatternQueries`'s envelope and fail-closed audit loop (`online-pattern-query.cjs:101-135`), with lane templates instead of analogy families.

```javascript
// lib/core/dominant-design/lane-queries.cjs (shape; templates are Claude's discretion)
'use strict';
const { auditQueryString } = require('../rs-egress-prompts.cjs');
const SURFACE = 'dominant-design';
const LANES = Object.freeze([
  { id: 'variant_census',        template: (d) => d + ' competing designs history first introduced' },
  { id: 'convergence_signals',   template: (d) => d + ' industry standard adoption market share consolidation' },
  { id: 's_curve_limits',        template: (d) => d + ' performance limits diminishing returns cost ceiling' },
  { id: 'discontinuity_signals', template: (d) => d + ' new entrants substitute technology patents funding' },
]);
// composeLaneQueries({domain}) -> {ok:true, lanes:[{id, queries:[q]}], audited}
//                              | {ok:false, degrade:'local-only', reason:'empty_domain'|'egress_violation', lane}
// auditEditedQuery(q)          -> {ok:true, q} | {ok:false, reason:'egress_violation'}  (navigator edits re-enter here)
```

Notes: `domain` is the navigator's generic domain phrase (for example "lithium-ion battery cells"). A venture name matching the Canon "venture proper-noun" pattern (`/\b[A-Z][a-z]+\s+(?:Corp|Inc|Ltd|LLC|Robotics|Ventures|Fintech)\b/`, `lib/core/cross-room-aggregator.cjs`) or a money figure fails the audit; the honest response is "name the domain, not the venture", never a send-anyway path [VERIFIED: file]. D-10 rules web egress of the approved text is the navigator's explicit spend; the audit is the PII fence on top, same as find-analogies.

### Pattern 3: Gate before dispatch (copy find-analogies PHASE 0 verbatim in shape)

`commands/find-analogies.md:191-208` is the template: (1) compose via the script, never hand-write; (2) `{ok:false}` is an honest local-only degrade with "There is no send-anyway path"; (3) "Ask the navigator before any fetch ... Do not fetch until they approve"; then the load-bearing sentence "No agent is dispatched before the navigator approves the web pass" placed BEFORE the `Dispatching` status block. `tests/test-265-threshold-fanouts.cjs:139-150` pins exactly that ordering by `indexOf`; 361's command test should pin the same property on `commands/dominant-designs.md`.

Gate card recommendation (keeps `hitl_shape: "F.1"` truthful, one next-move pick): options "Run these lanes (Recommended)", "Edit or drop a lane", "Quick pass instead"; the card body lists each lane's query. Edits arrive through AskUserQuestion's free-text answer and go back through `audit-query` before the card re-renders. Dropping a lane removes it from the fan-out and from the pack (no artifact for a lane the navigator dropped; the analysis says which lanes were not run).

### Pattern 4: Fan-out (CLI)

Copy `find-analogies.md:210-251`: explicit `subagent_type: dominant-design-researcher`, no manual background parameter, clamp through `lib/core/futures/orchestrator.cjs` `resolveFanoutCap` (default 5, `orchestrator.cjs:76`) which is above 4 so all lanes run, print a `[DOMINANT-DESIGN] Dispatching N lane agents` status block after approval. Each dispatch prompt carries: the lane id, the approved query string(s) labeled LITERAL, the lane's evidence question in plain words (what counts as a row), the fixed search parameters, and the return schema. The agent never sees room content or the navigator's venture context.

**Tavily cap (Claude's discretion, recommended and stated):** one approved query per lane by default, the navigator may add a second at the gate, hard cap 2 per lane; exactly one `tavily-search` call per approved query with fixed parameters `search_depth: "basic"`, `topic: "general"`, `max_results: 10`; `WebSearch` with the identical string only when Tavily errors or is absent; no `tavily-extract`. Worst case 8 searches per run, normal case 4. The agent may not change parameters; the command fixes them in the dispatch prompt.

### Pattern 5: Theo structure read with degrade (D-09)

Mirror `lib/core/strategy/taxonomy-climb.cjs`: one wire door (`brainClient.callTool`), a local fallback that makes Theo decoration rather than dependency, and a module header stating the Part 8 line.

```javascript
// lib/core/dominant-design/theo-structure.cjs (shape)
const HANDLE = 'Dominant Design';          // the ONLY value ever sent; never the navigator's domain
async function readDominantDesignStructure(opts) {
  const bc = (opts && opts.brainClient) || require('../brain-client.cjs');
  const out = { source: 'reference', reasons: {}, steps: [], techniques: [], cases: [] };
  // framework_step {framework}, framework_techniques {framework}, case_story {framework}
  // classify each result: null -> 'brain_unavailable'; {error:'egress_blocked'} -> 'egress_blocked';
  //   text matches /tool \S+ not found/i -> 'not_served'; other -32602 -> 'shape_refused';
  //   framework_step rows[0].steps.length === 0 -> 'no_steps_in_canon'; refusals key -> 'refused'
  // source becomes 'theo' only when framework_step returned >= 1 runnable step
  return out;
}
```

Live state measured 2026-09-23 with `callTool(name, {framework:'Dominant Design'})` [VERIFIED: live probe this session]:

| Tool | Live answer | D-09 outcome today |
|---|---|---|
| `framework_step` | `{"rows":[{"name":"Dominant Design","orchestrationStatus":"draft","steps":[]}], diagnostics, egress_disclosure:{verdict:"ambiguous", egress_class:"unknown"}}` | served, zero steps -> reference |
| `framework_techniques` | `{"text":"MCP error -32602: Tool framework_techniques not found", egress_disclosure:{ambiguous}}` | not served (waits on Theo 20-09 deploy) -> skip |
| `case_story` | `{"text":"MCP error -32602: Tool case_story not found", ...}` | not served (Theo 20.1) -> skip |

The `egress_disclosure: ambiguous` on all three is exactly what the D-10 recognizer arms remove.

### Pattern 6: Filing (D-07) through a CLI door

```javascript
// scripts/dominant-design-research.cjs file-lane <validated-lane.json> --room <roomDir> --session <id>
const navigation = require('../lib/core/navigation.cjs');
const db = navigation.openRoomDbForCaller(roomDir);          // null when room.db is absent
if (!db) { print({ ok:false, reason:'no_room_db', filed:0 }); return; }   // markdown already written; say so
try {
  for (const p of evidencePack.toEvidenceClaimParams(lane, { sessionId, artifactPath })) {
    const res = navigation.fileEvidenceWithReadback(db, p);   // {topic, source, url, retrieved_at, evidence_tier, summary, sessionId, artifact_path}
    results.push(navigation.surfaceFileEvidenceResult(res));
  }
} finally { navigation.closeRoomDbForCaller(db); }
```

Signature and behavior [VERIFIED: `file-evidence-readback.cjs:54-72, 110-160`; `evidence-claim.cjs:102-186`]:
- params `{ topic, source, url, retrieved_at, evidence_tier, summary, sessionId, artifact_path?, informsTargetId? }`.
- `url` and `source` must be non-empty strings; `evidence_tier` must be one of `Academic | Operational | Practitioner | None` (`invalid_evidence_tier` otherwise).
- Node id is `EvidenceClaim:<sessionId>:<hash(url)>`, an UPSERT: the same URL in the same session collapses to one node (see Pitfall 3).
- Lands `review_status: 'proposed'`, never confirmed (Part 9 role 5); readback asserts the four locked fields round-trip.
- `topic`/`summary` pass through `stripInjectionSpans`, which also strips any `https?://` text inside them.
- Returns `{ok:true, node_id, readback}` or `{ok:false, reason}`; never throws.

Tier mapping (deterministic, in code, never chosen by the agent): `peer_reviewed -> Academic`; `standards_or_regulatory`, `company_primary`, `market_data -> Operational`; `press`, `other -> Practitioner`. Canon Part 5 definitions at `docs/MINDRIAN-CANON.md:226-229` [VERIFIED]. The mapping is a judgment call: flag it for navigator confirmation (Assumption A5).

`informsTargetId`: leave empty. No shipped function resolves a just-written markdown artifact to a node id at write time, and the edge is optional in the wrapper (`file-evidence-readback.cjs:95-110`). `artifact_path` carries the link to the lane file instead.

### Pattern 7: Artifact layout

- Lane evidence: `room/competitive-analysis/dominant-designs/<domain-slug>-<YYYY-MM-DD>-evidence-<lane>.md`, frontmatter `{methodology: dominant-designs, artifact_kind: evidence-lane, lane, queries, searched_via, retrieved_at, claim_count, dropped_unsourced_count, room_section: competitive-analysis}`, a table of rows with ids `E-<lane-abbrev>-<n>` (for example `E-VC-3`), and a closing `## Searched, not found` list. An empty lane still writes this file with zero rows and the list.
- Analysis: `room/competitive-analysis/dominant-designs/<domain-slug>-<YYYY-MM-DD>.md`, the existing template (`references/methodology/dominant-designs.md` Artifact Template) plus `depth: deep`, `evidence_pack: [paths]`, `structure_source: theo | reference` and `structure_source_reason`, and every factual statement ending in `[E-XX-n]`. The `Evidence` column in the template's Discontinuities table holds row ids. Statements with no row are Larry's reasoning and are phrased as questions or labeled opinion, never as sourced fact.
- Both paths match the existing `produces: "room/**/dominant-designs/*"` glob, so `produces` need not change for truthfulness. Today the command asks "File this to competitive-analysis?" and names no subfolder; putting files under `dominant-designs/` makes the glob true for the first time.

### Anti-Patterns to Avoid
- **Letting the agent build queries.** An agent told "research the dominant design of X" reinvents query composition and bypasses the audit; pass the approved strings through verbatim (`find-analogies.md:236-246`).
- **Agent-assigned evidence tier or any score.** Tiers come from code over `source_type`; no numbers the source does not state (D-06).
- **Writing before the confirm card.** Agents return data; nothing touches the room until "File this to competitive-analysis?" (D-08).
- **Quick-pass regression.** The quick pass must not call the composer, Theo, or any agent (DDR361-13).
- **Sending the domain to Theo.** Theo calls carry only `"Dominant Design"`; the domain goes only to the web, only after approval (D-10).
- **Editing the find_connections arm** or reordering `_proveKnownToolShape` (Phase 355 owns that block; D-10).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PII/venture fence on outbound web strings | a new regex set | `auditQueryString(q, 'dominant-design')` | Re-exports Canon FORBIDDEN_PATTERNS byte-for-byte; one update site |
| room.db access | `new DatabaseSync(...)` or `openRoomDb` direct | `navigation.openRoomDbForCaller` | `scripts/check-substrate.cjs` allow-list; `room-db.cjs` logs bypasses to telemetry |
| Evidence node insert | an INSERT | `navigation.fileEvidenceWithReadback` | Txn, readback, injection strip, Part 9 status |
| Theo HTTP | fetch/MCP client | `brainClient.callTool` | Session reuse, retry, the Part 8 belt |
| Registry rows | hand-editing JSON | `node scripts/build-command-registry.cjs` / `build-connector-registry.cjs` / `build-skill-mirrors.cjs` | `generated_note: "do not edit by hand"`; `--check` drift gates |
| Fan-out cap | a literal | `resolveFanoutCap` | Shared env-tunable clamp |
| Prompt-injection stripping in lane markdown | a new sanitizer | `stripInjectionSpans` | Already the EvidenceClaim door's pass |

**Key insight:** every hard part here (egress fence, filing honesty, generated registries) already failed once in this repo and was fixed in a shared module; a local copy re-opens the old failure.

## Common Pitfalls

### Pitfall 1: `allowed-tools:` in an agent file is not a host restriction
**What goes wrong:** The agent inherits every tool (Write, Bash, Brain MCP), so "cannot file" is only a promise.
**Why it happens:** Claude Code reads `tools:` for subagents; `allowed-tools` is not in the documented plugin-agent field list [CITED: plugins-reference]. Every agent in this repo uses `allowed-tools:` only [VERIFIED: grep, 13 agents].
**How to avoid:** Declare `tools:` (enforced) and mirror it under `allowed-tools:` (repo audits); assert equality in a test.
**Warning signs:** a test that only checks `allowed-tools`. Pre-existing and out of scope: `analogy-query-fetcher.md` and `competitor-watch-fetcher.md` carry the same gap; recommend a separate `/gsd-quick`, do not fix inside 361.

### Pitfall 2: The recognizer arm order and substring matching
**What goes wrong:** An arm inserted before `find_connections` collides with Phase 355's edits; `indexOf` substring matching can shadow.
**How to avoid:** Insert the three arms after the `recommend_chain` arm (ends `part8-egress-guard.cjs:492`) and before `return null` (`:493`). Names `framework_step`, `framework_techniques`, `case_story` share no substring with existing arms. Pin the find_connections arm with a sha256 of its source slice taken at plan time.
**Exact arm shape:** `_hasExactKeys(payload, ['framework'], [])` (framework_step also admits optional `step_id` matching Theo's `PROCESS_STEP_ID_PATTERN`, `~/Theo/src/mcp/content/vocabulary.ts:286-287`); `_isSafeShortLabel(framework)`; Theo's `FRAMEWORK_NAME_PATTERN = /^[A-Za-z0-9 '(),.\/-]{1,128}$/` (`vocabulary.ts:224`); and membership in the plugin's closed vocabulary `CANONICAL_PHRASES` (lowercased `data/framework-names.json`, which contains "Dominant Design" [VERIFIED]). A name outside the snapshot falls through to ambiguous (disclose-and-proceed), never allow and never block. That is stricter than find_connections' label-only proof on purpose: D-10 says generic handles only.
**Warning signs:** `egress_disclosure` still present on a `framework_step` call after the edit.

### Pitfall 3: EvidenceClaim UPSERT collapses rows that share a URL
**What goes wrong:** Two claim rows from one page, or the same page cited by two lanes, overwrite each other's `topic`/`summary`.
**Why:** id = `EvidenceClaim:<sessionId>:<hash(url)>` (`evidence-claim.cjs:102-104, 166`).
**How to avoid:** Group rows by URL inside a lane (one EvidenceClaim per unique URL, summary = the joined claims) and suffix the session per lane (`sessionId = <session>:dd-<lane>`). Test both.

### Pitfall 4: -32602 means two different things
**What goes wrong:** `_looksLikeUnknownToolError` treats any `-32602` as unknown tool, but -32602 is also JSON-RPC "invalid params", which Theo's strict input seal returns for an extra key.
**How to avoid:** Classify "not served" only on `/tool \S+ not found/i`; any other -32602 is `shape_refused` (a plugin bug worth surfacing). Both fall back to the reference; the artifact records which.

### Pitfall 5: "served" is not "useful"
**What goes wrong:** Treating a served `framework_step` as the structure source when Dominant Design has `steps: []` in canon today.
**How to avoid:** Use Theo as the structure source only with at least one runnable step; otherwise `structure_source: reference`, reason `no_steps_in_canon`.

### Pitfall 6: Registry fields D-01 names do not exist on the row
**What goes wrong:** Hand-adding `web_scope` or `dispatches` to `data/command-registry.json` fails `build-command-registry.cjs --check` (generated file) and would change the schema Theo's `scripts/build-command-layer.ts` parses (it reads `frameworks, autonomous_safe, teaching, serves_jtbd`, lines 226-232, 1069-1080) [VERIFIED: Theo source, read-only].
**How to avoid:** `web_scope` goes in `connector.web_scope` (lands in `data/connector-registry.json`, which Theo also reads, `build-command-layer.ts:148`); the dispatched agent is recorded by the grant row and the command body; the row itself changes via `teaching`. Confirm this mapping with the navigator (Open Question 1).

### Pitfall 7: Adding `Task` without a grant row fails ARM 1
**What goes wrong:** `tests/test-265-swarm-task-grant.cjs` ARM 1 fails when a command declares `Task`/`Agent` with no row in `data/subagent-dispatch-grants.json`; ARM 3 needs `command, token, status, dispatch_shape, fan_bound, reason, reviewed_by (a human), reviewed_date, evidence`; ARM 4 needs an adjacent "pre-approval" comment near `allowed-tools`.
**How to avoid:** Land the row as `status: "pending"` with the command edit (reports `unratified`, passes non-strict), then a `checkpoint:human-verify` where the navigator reviews and the row flips to `granted`. `reviewed_by` must be the navigator, never an agent identity.

### Pitfall 8: Doctrine-fence and em-dash traps in prose
**What goes wrong:** Writing "never a silent fallback" in the command body trips `test-250-doctrine-fence.cjs` (`/silent fallback/i`). Em-dashes fail the house rule.
**How to avoid:** Say "falls back to the local reference and says so". Run an em-dash guard in `run-all-361.sh`.

### Pitfall 9: Skill mirror drift
**What goes wrong:** Editing `commands/dominant-designs.md` leaves `skills/dominant-designs/SKILL.md` stale.
**How to avoid:** Regenerate with `node scripts/build-skill-mirrors.cjs`; never hand-edit the skill (the generator desensitizes `sensor_triggers` to `[]` and normalizes `allowed-tools` to a single line and `${MINDRIAN_OS_ROOT:-...}` paths; `scripts/build-skill-mirrors.cjs:18-60`).

### Pitfall 10: Subagent name resolution
**What goes wrong:** Plugin agents load as `<plugin>:<file>`, so this one is `mos:dominant-design-researcher` [CITED: plugins-reference]; repo precedent passes the bare name (`find-analogies.md:218`) and notes an unresolvable `subagent_type` is a hard error listing available agents (`commands/act.md:447-449`).
**How to avoid:** Keep the bare-name precedent and add one line: if the Agent tool rejects it, use the scoped name shown in the error. [ASSUMED that bare names resolve; precedents ship this way.]

### Pitfall 11: Peer sessions in the same tree
**What goes wrong:** A regenerator run (`build-connector-registry`, `build-harness-manifest`, `build-orchestration-projection`) rewrites whole generated files that peers may also be regenerating.
**How to avoid:** Regenerate in one late task, stage only the generated files that actually changed, `git commit --only <paths>`, and re-run each `--check` right before commit.

## Code Examples

### Known-shape arm (to add after the recommend_chain arm)
```javascript
// Source pattern: lib/core/part8-egress-guard.cjs:457-492 (existing arms), exact-keys + label proof.
if (toolName.indexOf('framework_step') !== -1) {
  if (!_hasExactKeys(payload, ['framework'], ['step_id'])) return null;
  if (!_isKnownFrameworkHandle(payload.framework)) return null;       // label + Theo pattern + CANONICAL_PHRASES
  if (Object.prototype.hasOwnProperty.call(payload, 'step_id')
      && !(typeof payload.step_id === 'string' && PROCESS_STEP_ID_RE.test(payload.step_id))) return null;
  return { class: 'known_tool_shape', reason: 'framework_step canonical framework handle' };
}
if (toolName.indexOf('framework_techniques') !== -1) {
  if (!_hasExactKeys(payload, ['framework'], [])) return null;
  if (!_isKnownFrameworkHandle(payload.framework)) return null;
  return { class: 'known_tool_shape', reason: 'framework_techniques canonical framework handle' };
}
if (toolName.indexOf('case_story') !== -1) {
  if (!_hasExactKeys(payload, ['framework'], [])) return null;        // ASSUMED shape; fails closed to ambiguous on drift
  if (!_isKnownFrameworkHandle(payload.framework)) return null;
  return { class: 'known_tool_shape', reason: 'case_story canonical framework handle' };
}
```
`CANONICAL_PHRASES` is defined at `part8-egress-guard.cjs:595-603`, below `_proveKnownToolShape`; that is fine at call time (module-level consts are initialized before any call), but the helper should read it lazily and fail closed when it is empty, like `_TYPED_QUESTION_DATA_LOADED` (`:608`).

### Hook-leg test shape (copy)
```javascript
// Source: tests/test-260906-fda-known-tool-shapes.cjs:184-265
const res = spawnSync(process.execPath, ['scripts/part8-egress-guard-hook.cjs'], {
  input: JSON.stringify({ tool_name: 'mcp__plugin_mos_mindrian-brain__framework_step',
                          tool_input: { framework: 'Dominant Design' } }),
  encoding: 'utf8' });
// expect status 0 and no Part 8 gate text; a content-carrying framework value expects status 2
```
Note: the plugin shim registers only the six `brain_*` tools (`bin/mindrian-brain-mcp-client.cjs:163-297`), so no host MCP call named `framework_step` exists today; the real protection for 361 is the in-process belt in `callTool` (`brain-client.cjs:657-676`). The hook leg is still worth one case because a future shim tool or a raw Theo server would route through it.

## Runtime State Inventory

Not a rename or migration phase. One runtime item worth naming: Theo's command layer holds a stamp of `data/command-registry.json` (per `docs/THEO-NOTIFY-CONTRACT.md`). After the registry changes, Theo is stale until the next release's Step 5.6 `repository_dispatch` (`theo-resync`) and Theo's own re-emit. That is release-time work, not a phase task. All other categories: none (no stored data rename, no OS registrations, no secrets, no installed artifacts) [VERIFIED: phase scope].

## Theo Notify (D-01) - what "fires per the contract" means

- The dispatch is `scripts/release-lib/theo-notify-gate.sh` at `release.sh` Step 5.6, post-tag, payload `{version, commit, registryHash, command_registry_path}` where `registryHash` is SHA-256 of `data/command-registry.json` at the tagged commit (`docs/THEO-NOTIFY-CONTRACT.md` Rulings 1-2, R1 table) [VERIFIED: doc].
- The phase cannot and should not fire it (a write to another repo's CI; `--dry-run` never sends, Ruling 3). The phase's job: make sure the registry row actually changes (so the hash moves) and record in the close-out that the next release carries it. Per the user memory rule, a `main` commit is not live until released.
- Verification the phase can run: `git show HEAD:data/command-registry.json | sha256sum` before and after the regenerate, asserting a difference.

## `autonomous_safe` semantics

- Meaning: "may `/mos:act` run it unattended" (`docs/COMMAND-FRONTMATTER.md:25`); consumed by `lib/workflow/command-resolver.cjs:233-243` `validateChainAutonomy` and `lib/core/recipe-maps.cjs` [VERIFIED].
- Precedent for a command whose optional path spends on the web behind a gate: `find-analogies` keeps `autonomous_safe: true` with `web_scope: green` and the approval card inside the body [VERIFIED: `commands/find-analogies.md:21, 60`]. `research` keeps `true` with `plan_gated: true`. `bono`, `futures`, `intel-pipeline` declare `false`.
- Recommendation: keep `autonomous_safe: true` (the quick pass is genuinely unattended-safe, and `dominant-designs` is a `far_horizon` partner in `lib/core/futures/orchestrator.cjs:943` and sits in the Dominant Design framework index, so flipping it would pull it out of recon chains), and add one hard body rule: "When this command runs without a navigator present (inside `/mos:act`, `chain_run`, or any caller that cannot answer the gate card), take the quick pass. The research path starts only from a navigator's answer to the gate card." Pin the sentence in `tests/test-361-command-contract.cjs`. Alternative on record: `false` if the navigator prefers the chain to halt at this command every time (Open Question 2).

## `web_scope` value

`docs/CONNECTOR-CONTRACT.md:32`: `null` or one of `white | green | black | yellow | red | blue`, "the hat-scoped web access". Canon Part 2: "White: Tavily + arxiv for data and research. Green: patents + arxiv + deep-research for innovation." (`docs/MINDRIAN-CANON.md:100`) [VERIFIED]. Evidence gathering is White-hat work, so recommend `web_scope: white`. No code branches on the value (grep of `lib/` finds only `methodology-ingest.cjs` defaults) [VERIFIED], and `white` is legal though no surface uses it yet (15 `green`, 165 `null`). If the navigator prefers matching the precedent, `green` is harmless.

## Tri-Polar

| Surface | Behavior |
|---|---|
| CLI | Full flow: composer via Bash, gate card, parallel Agent fan-out, Theo read via Bash, lane + analysis artifacts, `file-lane` readback |
| Desktop | Desktop reaches this methodology through the `mindrian-os` MCP `run-methodology` prompt, which loads `references/methodology/dominant-designs.md`, not the command body (`lib/mcp/prompts.cjs:1-45`) [VERIFIED]. No Agent tool, and the `mindrian-brain` shim exposes no `framework_step`. Behavior: the conversational deep dive stays; Larry says plainly that the sourced research pass runs in Claude Code. Recommend adding one short "Research mode" paragraph to the reference's "Quick Pass vs Deep Dive" section so Desktop Larry can say it. |
| Cowork | Same as Desktop for the fetch; lane artifacts written by a CLI run are visible to the team under the room, and their `artifact_path` + EvidenceClaim nodes are shared room state |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agent tool allow-list under `allowed-tools:` (repo habit) | `tools:` / `disallowedTools:` are the plugin-agent fields | Current Claude Code docs | New agent must use `tools:` |
| Incumbent Brain `load_framework` / `intra_framework_flow` | Theo `framework_neighborhood` / `discover_structure`; plugin composes `operate_framework` from `framework_step` + `framework_techniques` + `case_story` | Theo Phase 20 (2026-09-23, not deployed) | 361's Theo reader is a narrow precursor of the plugin-owned composer (handoff item 1d); keep it narrow |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `case_story` input is exactly `{framework}` | Part 8 arm | Low: exact-keys fails closed to ambiguous (disclose-and-proceed); fix when Theo 20.1 publishes `20.1-MOS-LEARNING.md` |
| A2 | Bare `subagent_type: dominant-design-researcher` resolves for a plugin agent | Pitfall 10 | Low: the error lists the scoped name; body tells Larry to retry with it |
| A3 | `allowed-tools:` is ignored for plugin agents (not merely undocumented) | Pitfall 1 | Low either way: declaring both keys is correct in both worlds |
| A4 | Tavily `basic` depth with 10 results gives enough quote text per lane | Tavily cap | Medium: thin lanes; the navigator can add a second query at the gate |
| A5 | The `source_type -> evidence_tier` mapping (market data and company primaries as Operational) | Filing | Medium: tier inflation; navigator should confirm the mapping |
| A6 | Lane query templates (wording) | Composer | Low: navigator sees and edits every query at the gate |
| A7 | Keeping `hitl_shape: "F.1"` (gate card as a single next-move pick) is acceptable over declaring `hitl_stages` | Pattern 3 | Low: `check-shape-declaration` is advisory; can be revised later |

## Open Questions (RESOLVED)

All five resolved by the navigator on 2026-09-23 as `361-CONTEXT.md` D-11 (OQ-1), D-12 (OQ-2), D-14 (OQ-3), D-13 (OQ-4), D-15 (OQ-5).

1. **What does "update the registry row in place (web_scope, the agent it dispatches, produces)" map to?**
   - Known: the row has no `web_scope` or agent field; it is generated.
   - Recommendation: `connector.web_scope` (connector registry), the grant row + body for the agent, `teaching` updated to mention the sourced research mode, `produces` unchanged (already true once files go under `dominant-designs/`). Confirm with the navigator at plan review; do not change the generator schema in this phase.
2. **`autonomous_safe` true with an unattended rule, or false?** Recommendation: true plus the rule (above).
3. **Does Phase 361 or the "item 1a" quick task own the `framework_techniques` arm?** The Theo-20 handoff (`docs/2026-09-23-HANDOFF-theo-phase-20-and-phase-361-m-side-work.md` section 1a, 5) says "do them once, not twice". Recommendation: 361 adds its three arms; the execute task first greps for an existing arm and skips a duplicate if a peer landed it.
4. **Grant ratification timing.** The row needs a human reviewer; schedule a `checkpoint:human-verify` in the last wave.
5. **Live smoke.** A real end-to-end run spends Tavily credits and writes to a room; make it a human-verify step on a scratch room, not an automated test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22.16 | all CJS, `node:sqlite` timeout | yes | v22.23.1 | - |
| Theo (`theo-mcp.onrender.com`) | D-09 reads | yes (probed) | `framework_step` served; `framework_techniques`, `case_story` not served | local reference |
| Tavily MCP | lane search | yes on this machine (user-level `tavily-mcp@0.1.3`) | 0.1.3 (npm latest 0.2.22) | `WebSearch` |
| `WebSearch` | fallback | host built-in | - | lane returns `error`, artifact says so |
| Theo checkout `/home/jsagi/Theo` | parity test (read-only) | yes | commit `4055f11` | test exits 77 ENV GAP (`MINDRIAN_THEO_CHECKOUT` seam) |
| `gh` | release-time notify only | yes | 2.45.0 | not needed in phase |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `framework_techniques`, `case_story` (reference file).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts (`assert`, no node:test, no deps), bash aggregator |
| Config file | none; aggregator `tests/run-all-361.sh` (Wave 0) |
| Quick run command | `node tests/test-361-<name>.cjs` |
| Full suite command | `bash tests/run-all-361.sh` |

Aggregator shape: copy `tests/run-all-356.sh` (`run` / `run_if` guards, exit 0 PASSED, 77 SKIPPED ENV GAP, else FAILED; written once in the first plan, no later plan edits it; an em-dash guard over every 361 surface).

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DDR361-01 | agent frontmatter: `tools` == `allowed-tools` == {two Tavily names, WebSearch, Read}; no Write/Edit/Bash/Brain; excluded + reason; no hitl_shape; layer loop; body has "verbatim", "never" recompose, "sourced or absent", no score keys | unit (text) | `node tests/test-361-agent-contract.cjs` | no, Wave 0 |
| DDR361-02 | 4 lanes composed; each audited; venture proper-noun / money fails closed with `degrade:'local-only'`; edited query re-audited; zero network | unit | `node tests/test-361-lane-queries.cjs` | no, Wave 0 |
| DDR361-03 | command body: gate sentence precedes `Dispatching`; "no send-anyway path"; unattended rule present; quick pass section unchanged | unit (text) | `node tests/test-361-command-contract.cjs` | no, Wave 0 |
| DDR361-04 | dispatch string `subagent_type: dominant-design-researcher`; cap text (2 per lane, one call per query, fixed params); Tri-Polar table | unit (text) | `node tests/test-361-command-contract.cjs` | no, Wave 0 |
| DDR361-05 | validator drops rows missing any D-06 field, counts drops, rejects `score`/`confidence`/`strength`/`probability`/`rank` keys, requires http(s) URL | unit | `node tests/test-361-evidence-pack.cjs` | no, Wave 0 |
| DDR361-06 | empty lane renders an artifact with zero rows and a "Searched, not found" section; row ids stable | unit | `node tests/test-361-evidence-pack.cjs` | no, Wave 0 |
| DDR361-07 | fixture room.db: one EvidenceClaim per unique URL, per-lane session suffix, tier mapping, readback surfaced; absent room.db returns `no_room_db` | integration (fixture db) | `node tests/test-361-filing.cjs` | no, Wave 0 |
| DDR361-08 | analysis template carries `structure_source`, `evidence_pack`, and row-id citation instruction in the command body | unit (text) | `node tests/test-361-command-contract.cjs` | no, Wave 0 |
| DDR361-09 | injected brainClient: null / egress_blocked / not found / other -32602 / zero steps / steps present -> correct source + reason; every call's args deep-equal `{framework:'Dominant Design'}` | unit | `node tests/test-361-theo-structure.cjs` | no, Wave 0 |
| DDR361-10 | classify allows the three shapes, not under wrong tool names, not with extra keys, ambiguous for off-vocabulary names, block for content; find_connections slice sha256 unchanged; hook leg exit codes | unit + hook | `node tests/test-361-egress-shapes.cjs` | no, Wave 0 |
| DDR361-10 | plugin arm keys equal Theo `inputShape` keys in `framework-step.ts` / `framework-techniques.ts` (read-only) | parity | `node tests/test-361-theo-parity.cjs` (exit 77 without checkout) | no, Wave 0 |
| DDR361-11 | generated artifacts in sync; grant row complete; declaration truth | gates | `node scripts/build-command-registry.cjs --check && node scripts/build-connector-registry.cjs --check && node scripts/build-skill-mirrors.cjs --check && node scripts/build-orchestration-projection.cjs --check && node scripts/build-harness-manifest.cjs --check && node scripts/check-layer-declaration.cjs && node tests/test-265-swarm-task-grant.cjs && node tests/test-265-declaration-truth.cjs` | existing |
| DDR361-12 | registry hash differs from the pre-phase commit | unit | `node tests/test-361-command-contract.cjs` (compares `git show <base>:data/command-registry.json` hash) | no, Wave 0 |
| DDR361-13 | quick-pass section and Setup steps byte-compatible with pre-phase text (section slice compare) | unit (text) | `node tests/test-361-command-contract.cjs` | no, Wave 0 |
| manual | live end-to-end on a scratch room (spends credits, writes room) | manual | human-verify | - |

Existing suites to include as plain `run` legs: `node tests/test-260906-fda-known-tool-shapes.cjs`, `node lib/core/part8-egress-guard.test.cjs`, `node tests/test-209-declared-implies-wired.cjs`, `node tests/test-250-doctrine-fence.cjs`, `node tests/test-344-surface-layer-parity.cjs`, `node tests/test-148-engine-reaches.cjs`, `node tests/test-341-registry-drift.cjs`, `node tests/test-265-threshold-fanouts.cjs`, `node tests/test-fileval-readback.cjs`, `node scripts/check-render-coverage.cjs`.

### Sampling Rate
- **Per task commit:** the task's own `node tests/test-361-*.cjs`
- **Per wave merge:** `bash tests/run-all-361.sh`
- **Phase gate:** full suite green plus `node scripts/doctor.cjs --acceptance` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-361.sh` (aggregator, written once)
- [ ] `tests/test-361-agent-contract.cjs`
- [ ] `tests/test-361-lane-queries.cjs`
- [ ] `tests/test-361-evidence-pack.cjs`
- [ ] `tests/test-361-filing.cjs` (reuse the fixture-room pattern from `tests/test-fileval-readback.cjs`)
- [ ] `tests/test-361-theo-structure.cjs`
- [ ] `tests/test-361-egress-shapes.cjs`
- [ ] `tests/test-361-theo-parity.cjs` (`MINDRIAN_THEO_CHECKOUT` seam, exit 77, precedent `tests/test-354-taxonomy-ladder-casing.cjs:91-110`)
- [ ] `tests/test-361-command-contract.cjs`

## Recommended Plan / Wave Outline

Every plan touching `commands/`, `skills/` or `agents/` carries `cirs_relationship:` (five fields plus `explanation`) and `11` in `canon_parts`. Suggested `canon_parts` for the phase: `[3, 5, 7, 8, 9, 11, 12]`.

| Plan | Wave | Content | Depends |
|---|---|---|---|
| 361-01 | 0 | Test scaffolding: `run-all-361.sh` + all RED `test-361-*.cjs` files; mint `DDR361-01..13` in REQUIREMENTS.md | - |
| 361-02 | 1 | Part 8: three separate arms + helper `_isKnownFrameworkHandle`, find_connections slice pinned; `test-361-egress-shapes`, `test-361-theo-parity` GREEN | 01 |
| 361-03 | 1 | `lib/core/dominant-design/lane-queries.cjs` + `evidence-pack.cjs` (pure); tests GREEN | 01 |
| 361-04 | 1 | `agents/dominant-design-researcher.md`; `test-361-agent-contract` GREEN | 01 |
| 361-05 | 2 | `lib/core/dominant-design/theo-structure.cjs` + `scripts/dominant-design-research.cjs` (compose-queries, audit-query, theo-structure, validate-lane, file-lane); `test-361-theo-structure`, `test-361-filing` GREEN | 02, 03 |
| 361-06 | 3 | Command upgrade: body (gate, fan-out, validation, six phases citing rows, confirm, filing, Tri-Polar, unattended rule), frontmatter (`web_scope: white`, `Task` + pre-approval comment, `teaching`), grant row `pending`, reference-file research note; regenerate skill mirror, command registry, connector registry + ledger, harness manifest, orchestration projection; all `--check` green | 04, 05 |
| 361-07 | 4 | `checkpoint:human-verify`: navigator ratifies grant row (-> `granted`), confirms Open Questions 1, 2, A5; optional live smoke on a scratch room; close-out (REQUIREMENTS rows, OPEN-HANDOFFS line that the next release carries the resync, note on the pre-existing fetcher `allowed-tools` gap as a follow-up quick task) | 06 |

Plans 02, 03, 04 touch disjoint files and can run in parallel. Keep 361-06 as the only plan that runs regenerators.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so enabled [VERIFIED].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Theo key handling is brain-client's, unchanged |
| V3 Session Management | no | - |
| V4 Access Control | yes | Agent `tools:` allow-list (read-only worker); reviewed subagent grant row; nothing writes before the confirm card |
| V5 Input Validation | yes | `auditQueryString` on every outbound string; lane JSON validated by `evidence-pack.cjs`; Part 8 exact-key recognizer for Theo payloads |
| V6 Cryptography | no | (sha256 only for pin/hash comparisons, via `node:crypto`) |
| V8 Data Protection | yes | Canon Part 8: domain text to the web only after approval, never to Theo; EvidenceClaim stays local |
| V12/V13 (external content) | yes | Untrusted web text is data: `stripInjectionSpans` on lane markdown and EvidenceClaim prose; agent has no write tools |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection in fetched page text steering Larry or the agent | Tampering / Elevation | Read-only agent (`tools:`), JSON-only return, `stripInjectionSpans`, Larry treats quotes as quoted data |
| Room content or venture name leaking into Theo payload | Information disclosure | Fixed `HANDLE` constant; test asserts args deep-equal `{framework:'Dominant Design'}`; recognizer requires canonical vocabulary |
| Venture/PII text in a web query | Information disclosure | Composer + edit re-audit through Canon FORBIDDEN_PATTERNS; no send-anyway path |
| Silent spend without consent | Repudiation / DoS (cost) | Gate card before dispatch; cap 2 queries per lane, 1 call per query; unattended callers take the quick pass |
| Fabricated or hedged claims entering the room as evidence | Tampering (integrity) | D-06 validator drops unsourced rows; tiers from code; EvidenceClaim lands `proposed` only |
| Agent inheriting write/Brain tools | Elevation | `tools:` declared (Pitfall 1) |

## Sources

### Primary (HIGH confidence)
- Repo files read this session with line evidence: `commands/dominant-designs.md`, `skills/dominant-designs/SKILL.md`, `references/methodology/dominant-designs.md`, `agents/analogy-query-fetcher.md`, `agents/competitor-watch-fetcher.md`, `agents/research.md`, `commands/find-analogies.md:1-60, 180-300`, `lib/core/part8-egress-guard.cjs:300-505, 570-765`, `lib/core/brain-client.cjs:595-676, 2470-2790`, `lib/core/navigation/file-evidence-readback.cjs`, `lib/core/navigation/evidence-claim.cjs`, `lib/core/navigation/spine-events.cjs:454-472`, `lib/core/rs-egress-prompts.cjs`, `lib/core/cross-room-aggregator.cjs:86-120`, `lib/core/eureka/online-pattern-query.cjs:90-140`, `lib/core/strategy/taxonomy-climb.cjs:1-120`, `scripts/build-command-registry.cjs`, `scripts/build-connector-registry.cjs`, `scripts/build-skill-mirrors.cjs`, `scripts/check-cirs-declaration.cjs`, `scripts/check-layer-declaration.cjs`, `scripts/verify-release:110-160`, `tests/test-265-swarm-task-grant.cjs`, `tests/test-265-declaration-truth.cjs`, `tests/test-209-declared-implies-wired.cjs`, `tests/test-250-doctrine-fence.cjs`, `tests/test-260906-fda-known-tool-shapes.cjs`, `tests/run-all-356.sh`, `docs/THEO-NOTIFY-CONTRACT.md`, `docs/CONNECTOR-CONTRACT.md`, `docs/MINDRIAN-CANON.md` (Parts 2, 5, 12), `docs/2026-09-23-HANDOFF-theo-phase-20-and-phase-361-m-side-work.md`, `docs/2026-09-23-HANDOFF-theo-phase-355-seams.md`, `data/subagent-dispatch-grants.json`, `data/framework-names.json`, `data/command-registry.json`.
- Theo (read-only): `/home/jsagi/Theo/src/mcp/content/framework-step.ts:320-429`, `framework-techniques.ts:1-40, 185-222`, `vocabulary.ts:224, 286-287`, `scripts/build-command-layer.ts`, `.planning/phases/20-*/20-CONTEXT.md`, `20-RESEARCH.md`, `12-*/parity/direct-mcp-surface-map.json`.
- Live Theo probe via `brainClient.callTool` with `{framework:'Dominant Design'}` only, 2026-09-23.
- `tavily-mcp@0.1.3` package source (`npm pack`, `build/index.js:55-135`).
- [CITED] code.claude.com/docs/en/sub-agents (subagent frontmatter, `tools`, colors, zero-tools error); code.claude.com/docs/en/plugins-reference (plugin agent naming `plugin:agent`, supported fields).

### Secondary (MEDIUM confidence)
- Inference that `allowed-tools` in agent files is not enforced (docs list omits it; not exercised live).

### Tertiary (LOW confidence)
- `case_story` input shape (tool not built; only its output remap `{title, summary, outcome, lesson, domain, framework}` is known, `20-CONTEXT.md` R5).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - every module read at file:line; no packages.
- Architecture: HIGH - direct precedents for each piece; the only new glue is the `file-lane` CLI.
- Pitfalls: HIGH for repo pitfalls (tests read), MEDIUM for host behavior (docs, not live).
- Theo: HIGH for today's live state (probed), LOW for `case_story`.

**Research date:** 2026-09-23
**Valid until:** 2026-09-30 for Theo state (Phase 20 deploy 20-09 and 20.1 will change the served catalog); 30 days for repo contracts.
**Graph note:** `.planning/graphs/graph.json` last built 2026-07-23 (two months stale); not queried, direct file evidence used instead.
