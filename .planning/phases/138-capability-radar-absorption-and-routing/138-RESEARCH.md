# Phase 138: Capability Radar Absorption + Routing - Research

**Researched:** 2026-06-09
**Domain:** Claude Code platform-capability adoption + plugin-internal routing (Phase 122 resolver reuse)
**Confidence:** HIGH (every ledger item re-verified against the live Claude Code CHANGELOG through 2.1.169; every reuse anchor verified on disk)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **placement:** v1.14.0 backlog. Do NOT build inside the frozen v1.13.1 chain (128 / 129 / 130 / 130.5 / 130.7 / 131 / 132 / 121.5). Build AFTER v1.13.1 ships. Nothing in the findings is freeze-critical: the Opus model floor resolves automatically because `executor_model='opus'` already points at newest.
- **bucket_c_lands_here:** Phase 121.5 (terminal-coherence-capstone) ALREADY SHIPPED 2026-05-16 (re-verified 2026-05-19). The hook/skill findings (SessionStart session-title, reloadSkills, defaultEnabled:false, disallowed-tools) CANNOT fold into 121.5 - they land in THIS phase.
- **single_ledger_location:** The capability ledger + forward-map live INSIDE 138-CONTEXT (one parked location), NOT scattered as `radar_findings:` frontmatter across near-frozen phases. The radar-router injects findings at `/gsd:plan-phase` time instead.
- **phase_137_collision:** Phase 137 is the Brain<->MindrianOS sync harness (committed c15a7c86). This radar-absorption work is Phase 138.
- **a4_reeval:** Opus 4.8 dynamic workflows (2.1.154) likely SUPERSEDE the manual `CLAUDE_CODE_FORK_SUBAGENT` path (SEED-003 A4). This phase DECIDES adopt-vs-supersede before any fork-subagent harness is built.

### Claude's Discretion
- The exact shape of the `radar_findings:` frontmatter contract (mirror `canon_parts:`), the drift-check implementation (sibling to canon_parts checker), and which existing telemetry JSONL the per-category cost surfaces into - all left to the planner within the reuse constraints below.
- Which optional skill cluster ships `defaultEnabled: false` first (at least one required).

### Deferred Ideas (OUT OF SCOPE)
- Anything inside the frozen v1.13.1 chain (build AFTER v1.13.1 ships).
- Folding Bucket C into Phase 121.5 (it shipped; cannot be amended here).
- Enterprise Bedrock/Vertex/Foundry auto-mode wiring (ledger #14) - defer to hosted-tier work.
- Minor / no-action developer-workflow items: `/simplify`, background shell via `!`, `EnterWorktree`, GFM task lists, `/diff` scroll.
</user_constraints>

<phase_requirements>
## Phase Requirements (from ROADMAP.md v1.14.0, Phase 138 acceptance criteria)

| ID | Description | Research Support |
|----|-------------|------------------|
| RAD-01 | The 138-CONTEXT ledger is the single source of truth; `/mos:radar --fetch` appends new findings TO the ledger (not just the cache). | `commands/radar.md` Step 3 today writes only `changelog-cache.md`; extend to also append a ledger row. Reuse anchor confirmed. |
| RAD-02 | At `/gsd:plan-phase N`, the radar-router reads the Bucket-F forward-map and surfaces findings tagged for phase N (or slug-keywords) before planning proceeds, reusing the Phase 122 resolver path. | `lib/workflow/command-resolver.cjs` is the reuse model (read-only, generated artifact, degrade-not-fabricate). The router is a sibling read-only lookup module against the ledger. Confirmed. |
| RAD-03 | A `radar_findings:` CONTEXT frontmatter contract (mirroring `canon_parts:`) exists; a lightweight drift check flags a phase that touches a forward-mapped surface without the relevant row. | Drift-check precedent = `scripts/frontmatter-schema-validator.cjs` (advisory PostToolUse, JSONL offense log, always exit 0) + `build-command-registry.cjs --check` tripwire. Both confirmed. |
| RAD-04 | Bucket R retrofits land: `CLAUDE_CODE_SESSION_ID` read-only Brain scoping, A2 hooks-as-MCP-callers collapse (89.5 fixtures green), per-category cost in telemetry, Opus model-floor note, `.zip` beta channel doc. | See per-item guidance below. A2 needs re-scoping (no hook currently spawns brain-client). |
| RAD-05 | Bucket C lands: SessionStart session-title reflects active room; `reloadSkills` / `/reload-skills` hot-swaps surfaced skills; >=1 optional cluster `defaultEnabled: false`; `disallowed-tools` per-skill scoping wired. | All four verified present in Claude Code (versions corrected below). Injection point = `scripts/sessionstart-coordinator.cjs`. Confirmed. |
| RAD-06 | The A4 adopt-vs-supersede decision is recorded; no hand-rolled fork-subagent harness ships if superseded. | See A4 Recommendation. Recommend SUPERSEDE. |
| RAD-07 | SEED-003 status flipped to `superseded-by: Phase 138` and forward-points to the ledger. | `superseded_by:` field already present in SEED-003 frontmatter (pending-ship); flip `status: dormant` -> `superseded` on ship. Confirmed. |
| RAD-08 | Part 8 boundary holds: session-id scoping is read-only enumeration; brain-boundary scan passes; zero user-content egress on any new path. | See Pitfall 5 + Security Domain. The proof method is the Phase 90 forbidden-substring tripwire pattern + `check-brain-boundary.cjs`. Confirmed. |
</phase_requirements>

## Summary

Phase 138 is ~85% REPOINT, ~15% net-new. The router substrate (Phase 122: generated registry + `command-resolver.cjs` the-one-door + `chain-recommender.cjs` FEEDS_INTO traversal) already exists and is the model the radar-router copies, not a thing to rebuild. The net-new surface is exactly three things: (1) the living ledger as a machine-readable artifact, (2) the `radar_findings:` frontmatter contract, and (3) the drift check. Every Bucket R/C retrofit wires into an existing chokepoint (`.mcp.json`, `sessionstart-coordinator.cjs`, the `~/.mindrian/telemetry/*.jsonl` writers, the skills/ dir).

The capability-currency check (the phase's whole premise) came back clean with one correction and zero regressions. All Bucket C items (#3/#4/#5/#6) and the model-floor item are confirmed in the live CHANGELOG and are STABLE through 2.1.169 (the latest version as of 2026-06-09). The single correction: `CLAUDE_CODE_SESSION_ID` to MCP servers is 2.1.154 (stdio MCP subprocesses) reaffirmed at 2.1.157 and 2.1.163, NOT 2.1.153 as the ledger states. The A4 decision resolves clearly: Opus 4.8 dynamic workflows (a JS-script background-runtime orchestrating up to 1,000 subagents, 16 concurrent) are a strict superset of the manual `CLAUDE_CODE_FORK_SUBAGENT` harness SEED-003 A4 proposed - SUPERSEDE A4, ship no hand-rolled fork harness.

One Bucket R item needs re-scoping before planning: **A2 (hooks-as-MCP-callers collapse) has no live target.** No entry in `hooks/hooks.json` spawns `node lib/core/brain-client.cjs`; every hook uses `type: "command"` and routes through `run-hook.cmd`. The "collapse the proxy layer" framing from SEED-003 A2 was written against a hooks topology that the Phase 121.5 SessionStart-coordinator consolidation already changed. The planner must re-scope A2 to "audit whether any hook's command path still does a brain round-trip that a `type: mcp_tool` entry would replace" and likely close it as already-addressed, not build a refactor against a non-existent target.

**Primary recommendation:** Build the router as a read-only sibling of `command-resolver.cjs` (same degrade-not-fabricate contract); wire Bucket R into `.mcp.json` + the existing telemetry JSONL writers; wire Bucket C into `sessionstart-coordinator.cjs` + the skills/ frontmatter; record A4 as SUPERSEDED; re-scope A2 to an audit-and-likely-close. Correct the SESSION_ID version to 2.1.154 in the ledger on first `--fetch`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Radar-router (ledger -> phase findings) | CLI plugin lib (`lib/workflow/`) | - | Read-only deterministic lookup at `/gsd:plan-phase` time; sibling to the Phase 122 resolver. No Desktop/Cowork surface (planning is a CLI/GSD activity). |
| `radar_findings:` frontmatter contract | CLI plugin (CONTEXT.md schema) | - | A documentation/schema contract consumed by the drift check; mirrors `canon_parts:`. |
| Drift check | CLI hook (`scripts/`, PostToolUse) | - | Advisory, JSONL offense log, exit 0. Same lifecycle as `frontmatter-schema-validator.cjs`. CLI-only (hooks do not fire on Desktop/Cowork the same way). |
| CLAUDE_CODE_SESSION_ID Brain scoping | MCP server config (`.mcp.json`) + nav spine consumer | CLI hooks | Env var is injected by the platform into stdio MCP subprocesses (and hooks). Read-only enumeration consumer lives behind the `navigation.cjs` chokepoint. |
| Per-category cost telemetry | CLI hook (telemetry JSONL writer) | - | Extends the LOCAL `~/.mindrian/telemetry/*.jsonl` pattern. CLI-only (hooks). |
| SessionStart session-title | CLI hook (`sessionstart-coordinator.cjs`) | - | `hookSpecificOutput.sessionTitle` is a SessionStart-hook capability; CLI-only. |
| reloadSkills / `/reload-skills` | CLI hook + skills | - | SessionStart `reloadSkills: true` + the `/reload-skills` command; CLI-only. |
| defaultEnabled / disallowed-tools | Plugin manifest + skill frontmatter | Desktop/Cowork (skills load there too) | Static frontmatter the platform reads on all three surfaces; the toggle UX is CLI `/plugin`. |

## Standard Stack

**No external packages.** This phase is config + plugin-internal CJS + docs only. Every dependency is a Claude Code platform feature (verified below) or an existing in-repo module. The repo hard rule is "no new deps" (CLAUDE.md); honored.

| Component | Source | Purpose |
|-----------|--------|---------|
| Claude Code platform (>= 2.1.154) | Anthropic | Provides SESSION_ID-to-MCP, sessionTitle, reloadSkills, defaultEnabled, disallowed-tools, dynamic workflows. All verified in CHANGELOG. |
| Node CJS (built-ins only) | in-repo convention | Router + drift check + ledger writer. Mirrors `command-resolver.cjs`. |
| Existing `lib/workflow/command-resolver.cjs` pattern | Phase 122 | The read-only, generated-artifact, degrade-not-fabricate contract the router copies. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sibling-of-resolver router | A brand-new dispatcher | REJECTED by Canon Part 7 + the CONTEXT reframe. The resolver path exists; a new dispatcher is parallel surface area (technical debt). |
| Manual `CLAUDE_CODE_FORK_SUBAGENT` harness (A4) | Opus 4.8 dynamic workflows | Platform dynamic workflows supersede the manual harness (see A4 Recommendation). |

## Package Legitimacy Audit

**N/A - this phase installs zero external packages.** It is config (`.mcp.json`, skill frontmatter), plugin-internal CJS (router, drift check, ledger writer), and docs (`release-process.md` beta-channel note, model-floor note). No npm/PyPI/crates surface. slopcheck not applicable.

## Capability Currency Check (load-bearing)

> Re-verified against the live Claude Code CHANGELOG (`raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`) on 2026-06-09. **Latest version listed: 2.1.169.** The ledger findings were fetched 2026-06-01 at 2.1.159; the 2.1.160-169 window was checked specifically for changes/renames/removals to every ledger item.

| # / Req | Ledger claim (2026-06-01) | Verified status (2026-06-09) | Source | Verdict |
|---------|---------------------------|------------------------------|--------|---------|
| #1 / RAD-06 | Opus 4.8 + dynamic workflows orchestrating "hundreds" of agents (2.1.154) | CONFIRMED. 2.1.154: "Opus 4.8 is here!" + "Introducing dynamic workflows: ask Claude to create a workflow." Cap is **1,000 total subagents / 16 concurrent** per run; runtime executes a Claude-authored JS orchestration script in the background. `/workflows` run browser added. Stable through 2.1.169. | [CITED: code.claude.com/docs whats-new 2026-w22] + [CITED: anthropic.com/news/claude-opus-4-8] + CHANGELOG 2.1.154 | NO CHANGE (detail sharpened: "hundreds" -> capped 1,000/16-concurrent) |
| #2 / RAD-04 | `CLAUDE_CODE_SESSION_ID` to plugin MCP servers (2.1.153) | **CORRECTED.** Real version is **2.1.154** ("Stdio MCP server subprocesses now receive `CLAUDE_CODE_SESSION_ID` and `CLAUDECODE=1`"), reaffirmed 2.1.157 ("same `CLAUDE_CODE_SESSION_ID` as hooks/Bash") and 2.1.163 ("stdio MCP servers now receive the same `CLAUDE_CODE_SESSION_ID` as hooks"). NOT 2.1.153. Applies to **stdio** MCP servers - both MindrianOS MCP servers are stdio (`.mcp.json` uses `command: node`). | CHANGELOG 2.1.154 / 2.1.157 / 2.1.163 [VERIFIED: changelog] | **CHANGED vs ledger (version 2.1.153 -> 2.1.154).** Capability itself confirmed; tri-polar note: stdio-only, so CLI + Desktop (both spawn stdio); Cowork MCP transport must be confirmed at plan time. |
| #3 / RAD-05 | SessionStart hook sets session title (2.1.152) | CONFIRMED. 2.1.152: "`SessionStart` hooks can now set the session title via `hookSpecificOutput.sessionTitle`." Stable through 2.1.169. | CHANGELOG 2.1.152 [VERIFIED: changelog] | NO CHANGE |
| #4 / RAD-05 | `reloadSkills` + `/reload-skills` (2.1.152) | CONFIRMED. 2.1.152: "`SessionStart` hooks can now return `reloadSkills: true`" + "Added `/reload-skills` command." Stable. | CHANGELOG 2.1.152 [VERIFIED: changelog] | NO CHANGE |
| #5 / RAD-05 | `defaultEnabled: false` for plugins (2.1.154) | CONFIRMED. 2.1.154: "Plugins can now declare `defaultEnabled: false`; enable them with `/plugin`." Stable. | CHANGELOG 2.1.154 [VERIFIED: changelog] | NO CHANGE |
| #6 / RAD-05 | `disallowed-tools` in skill frontmatter (2.1.152) | CONFIRMED. 2.1.152: "Skills and slash commands can now set `disallowed-tools` in frontmatter to remove tools." Stable. 2.1.163 added `$`-escape syntax in skills (unrelated, additive). | CHANGELOG 2.1.152 [VERIFIED: changelog] | NO CHANGE |
| #7 | Plugins in `.claude/skills` auto-load + `claude plugin init` (2.1.157) | CONFIRMED. 2.1.157: "Plugins in `.claude/skills` directories are now automatically loaded" + "Added `claude plugin init`." Stable. | CHANGELOG 2.1.157 [VERIFIED: changelog] | NO CHANGE (LOW leverage; doc note only) |
| #8 | `agent` field honored for dispatched sessions (2.1.157) | CONFIRMED. 2.1.157: "`claude agents`: the `agent` field in `settings.json` is now honored for dispatched sessions." Stable. | CHANGELOG 2.1.157 [VERIFIED: changelog] | NO CHANGE |
| #9 | Lean system prompt default + fast-mode price cut (2.1.154) | CONFIRMED. 2.1.154: "The lean system prompt is now the default" + "Fast mode on Opus 4.8 now available at a fraction of previous cost." Stable. | CHANGELOG 2.1.154 [VERIFIED: changelog] | NO CHANGE |
| #10 / RAD-04 | Per-category usage cost breakdown (2.1.149) | CONFIRMED. 2.1.149: "Updated `/usage` now shows a per-category breakdown of what's driving your limits." 2.1.152 added "large session files" to the breakdown. Stable. | CHANGELOG 2.1.149 / 2.1.152 [VERIFIED: changelog] | NO CHANGE |
| #11 / RAD-06 | SEED-003 A4 forked subagents (2.1.117) - re-evaluate vs #1 | CONFIRMED present (2.1.117 "Forked subagents enabled on external builds with `CLAUDE_CODE_FORK_SUBAGENT=1`"). Superseded by #1 (see A4 Recommendation). | CHANGELOG 2.1.117 (cached) + #1 verification | SUPERSEDE |
| #12 / RAD-04 | SEED-003 A2 hooks-as-MCP-callers (2.1.118) | Capability CONFIRMED present (2.1.118 "Hooks can invoke MCP tools via `type: mcp_tool`"). BUT **no live target in this repo** (see Pitfall 1). Re-scope, do not build a refactor. | CHANGELOG 2.1.118 (cached) + on-disk grep | RE-SCOPE |
| #13 / RAD-04 | SEED-003 A5 `.zip` beta channel (2.1.128) | CONFIRMED (2.1.128 "`--plugin-dir` accepts `.zip` archives"). Doc-only change to `release-process.md`. | CHANGELOG 2.1.128 (cached) | NO CHANGE (doc note) |
| #14 | Auto mode on Bedrock/Vertex/Foundry (2.1.158) | Out of scope (LOCKED defer to hosted-tier). Not re-verified in depth. | - | DEFERRED (per CONTEXT) |

**Net change summary:** Exactly ONE ledger correction (#2 version 2.1.153 -> 2.1.154). Zero deprecations, renames, or removals across 2.1.148-169. The premise holds: the findings are current and actionable. The `/mos:radar --fetch` that lands RAD-01 should re-fetch to capture 2.1.160-169 and correct the #2 version row in the ledger as its first act.

## Reuse-Surface Map (Canon Part 7)

Every path below was verified on disk (2026-06-09). The CONTEXT shorthand matched reality except where noted.

| Anchor file (verified) | Symbol / surface | How Phase 138 reuses it | Net-new? |
|------------------------|------------------|--------------------------|----------|
| `lib/workflow/command-resolver.cjs` | `commandsForFramework`, `composeWorkflow`; the per-process `_load()` cache; `EMPTY_REGISTRY` degrade shape; `MINDRIAN_COMMAND_REGISTRY` test override | **Copy the contract, not the code.** The radar-router is a NEW sibling module (`lib/workflow/radar-router.cjs` candidate) with the SAME shape: read-only, reads one generated artifact, degrades to empty on missing/malformed, never fabricates, makes zero Brain calls. | sibling module (small net-new) |
| `data/command-registry.json` (60KB, generated) | `commands[]`, `framework_index{}`, `curated_chains[]` | The LEDGER becomes the analogous generated artifact. Candidate: `data/capability-ledger.json` generated from the 138-CONTEXT table by a generator script. The router reads it the way the resolver reads the registry. | net-new artifact + generator |
| `scripts/build-command-registry.cjs` | `--check` tripwire (regenerate in memory, exit 1 on stale on-disk JSON), `--refresh-names` read-only Brain query, the hand-rolled frontmatter line-walk | **Model for the ledger generator + drift tripwire.** A `build-capability-ledger.cjs --check` regenerates the ledger from the CONTEXT table and exits non-zero if `data/capability-ledger.json` is stale. Same pre-commit + Feynman-runner CI surface. | net-new generator (modeled on this) |
| `scripts/frontmatter-schema-validator.cjs` | Advisory PostToolUse hook; parses YAML frontmatter; JSONL offense log at `${CLAUDE_PLUGIN_DATA}/schema-violations.jsonl`; ALWAYS exit 0; `hookSpecificOutput.additionalContext` one-line advisory | **The drift-check precedent (RAD-03).** The `radar_findings:` drift check mirrors this exactly: advisory, never blocks, logs to JSONL, warns when a phase touches a forward-mapped surface without the relevant `radar_findings:` row. | net-new hook (modeled on this) |
| `lib/brain/chain-recommender.cjs` | `recommendFrameworkChain` (FEEDS_INTO traversal, framework names + enums only; degrades to `[seed]`); the "resolver attaches commands, recommender never names a command" discipline | The forward-map traversal (ledger Bucket-F -> phase N findings) follows the same "names + enums only, degrade to empty, never fabricate" discipline. Confirms the Part 8 posture for the router. | reference pattern |
| `lib/core/navigation.cjs` (Phase 109 chokepoint, 13 functions) | The single SQL navigation chokepoint; `memory_event` first-class node; instrumented "zero non-SQLite reads" acceptance test | The `CLAUDE_CODE_SESSION_ID` read-only Brain-scoping consumer (RAD-04) reads/writes ONLY through this chokepoint. SESSION_ID becomes a scoping key for per-session enumeration; the nav spine is where it lands. `lib/core/navigation/` has 22 sub-modules (room-context.cjs, packet.cjs, focus.cjs, etc.) - the scoping consumer is a small addition behind the chokepoint, not a new reader. | small addition behind chokepoint |
| `.mcp.json` (verified, 14 lines) | `mcpServers.mindrian-os` + `mcpServers.mindrian-brain`, both `command: node` (stdio), both `alwaysLoad: true` | SESSION_ID arrives automatically because both servers are stdio (the platform injects it into stdio subprocesses per 2.1.154). **No `.mcp.json` edit is strictly required to RECEIVE the var**; the wiring is on the consumer side (the MCP server reads `process.env.CLAUDE_CODE_SESSION_ID`). The "session-id scoping wires here" CONTEXT shorthand is slightly off: it wires in the MCP server code, not the JSON. | consumer-side code |
| `~/.mindrian/telemetry/*.jsonl` writers (e.g. `scripts/query-efficiency-telemetry.cjs`) | LOCAL JSONL append; scalar integer counts + LOCAL slug + ISO timestamp ONLY; zero network surface; advisory PostToolUse | The per-category cost telemetry (RAD-04 #10) extends this LOCAL JSONL pattern - a new `~/.mindrian/telemetry/usage-by-category.jsonl` with scalar cost-by-category rows. Same Part 8 "only scalar counts, no egress" rule. | net-new JSONL stream (modeled on this) |
| `scripts/sessionstart-coordinator.cjs` (verified, the single SessionStart owner) | Composes ONE `additionalContext` body; emits the Claude Code SessionStart envelope; `DEFAULT_CONTRIBUTOR_MAP` of lazy-required `contribute*()` fragments; 2000-char budget | **The session-title injection point (RAD-05 #3).** Add `sessionTitle` to the emitted `hookSpecificOutput`, sourced from a new `room-title` contributor that reads the active room slug. This is THE reuse anchor - do NOT add a second SessionStart hook entry (121.5 consolidated them into this one owner). | small contributor addition |
| `commands/radar.md` (verified, the radar command today) | Step 3 `--fetch`: WebFetch the CHANGELOG -> write `references/capability-radar/changelog-cache.md` | RAD-01 extends Step 3 to ALSO append a ledger row (router-writes-the-ledger). The reader->router transformation is authored here. | command edit |
| `references/capability-radar/changelog-cache.md` + `capabilities-index.md` (both verified) | The ledger source (cache last fetched 2026-05-05 for the index; CONTEXT ledger fetched 2026-06-01) | Source of truth for the initial ledger seed. The generator reads the 138-CONTEXT table (authoritative) not the cache. | read-only source |
| `.planning/seeds/SEED-003-*.md` (verified) | `status: dormant`, `superseded_by: Phase 138` (already present, pending-ship) | RAD-07: flip `status` to `superseded` and add forward-pointer to the ledger on ship. The frontmatter already anticipates this. | one-line status flip |
| `lib/core/brain-client.cjs` (verified, 56KB, 76 requirers) | The Brain HTTP chokepoint | **A2 target investigation (Pitfall 1).** 76 modules require it, but NO hook spawns it directly. A2 "collapse the proxy" has no live hook target. | audit, likely close |

**canon_parts drift-check precedent (how is it validated today?):** Grep shows `canon_parts` is consumed in `scripts/disposition-render-v2.cjs` and `lib/hmi/across-session-memory.cjs`, and the enforcement narrative is in CANON-PHASE-MAP.md ("Every phase MUST declare `canon_parts:` before plan approval"). The drift-detection ENGINE (CANON-PHASE-MAP names it "Phase 92") was **never built** - the map itself flags this as a "Phase-number collision (Part 6 fragility)." So the `radar_findings:` drift check has NO heavy precedent to inherit; its real precedent is the lightweight advisory pattern of `frontmatter-schema-validator.cjs` + the `--check` tripwire. Plan RAD-03 against THOSE, not against a non-existent canon_parts engine.

## Architecture Patterns

### System Architecture Diagram

```
  /mos:radar --fetch                         /gsd:plan-phase N
        |                                            |
        v                                            v
  WebFetch CHANGELOG                        radar-router (read-only)
        |                                            |
        v                                            | reads
  append row -->  data/capability-ledger.json  <-----+
        |              ^   (generated artifact,       |
        v              |    sibling of registry)      v
  changelog-cache.md   |                       findings tagged for phase N
                       |                       (Bucket-F forward-map)
        build-capability-ledger.cjs --check           |
        (regenerate in memory, exit 1 if stale)       v
                                              injected into planner context
                                                       |
   PostToolUse on CONTEXT.md write                     v
        |                                       planner declares radar_findings:
        v                                              |
   radar-findings drift check  <----------------------+
   (advisory, JSONL offense log, exit 0)
        |
        v
   ${CLAUDE_PLUGIN_DATA}/radar-drift.jsonl

  --- Bucket R retrofits (independent wiring) ---
   .mcp.json stdio servers --(platform injects)--> CLAUDE_CODE_SESSION_ID
        |                                                  |
        v                                                  v
   MCP server code reads process.env          navigation.cjs chokepoint
                                              (read-only per-session enumeration)
   PostToolUse usage hook --> ~/.mindrian/telemetry/usage-by-category.jsonl
        (scalar counts only, zero egress)

  --- Bucket C retrofits (independent wiring) ---
   sessionstart-coordinator.cjs --> hookSpecificOutput.sessionTitle (active room)
                                 --> reloadSkills: true (hot-swap surfaced skills)
   skills/*/SKILL.md frontmatter --> disallowed-tools: [...] (per-skill scoping)
   plugin manifest --> defaultEnabled: false (>=1 optional cluster)
```

### Recommended Project Structure (net-new files only)
```
data/capability-ledger.json            # generated from 138-CONTEXT table
lib/workflow/radar-router.cjs          # sibling of command-resolver.cjs
scripts/build-capability-ledger.cjs    # generator + --check tripwire
scripts/radar-findings-drift.cjs       # advisory PostToolUse hook
docs/RADAR-FINDINGS.md                 # the radar_findings: contract (mirror canon_parts)
```

### Pattern 1: Read-only sibling resolver (the router)
**What:** A new module with the exact contract of `command-resolver.cjs`: reads one generated artifact, per-process cache, `EMPTY_REGISTRY`-style degrade, zero Brain calls, env-var override for test fixtures.
**When to use:** The radar-router (RAD-02).
```javascript
// Source: lib/workflow/command-resolver.cjs (verified in-repo) - mirror this contract
const EMPTY_LEDGER = Object.freeze({ findings: [], forward_map: {} });
function _load() { /* try readFileSync+JSON.parse; catch -> EMPTY_LEDGER */ }
function findingsForPhase(phaseNumberOrSlug) {
  // forward_map[phase] or slug-keyword match; degrade to [] - never fabricate
}
```

### Pattern 2: Generator + `--check` tripwire
**What:** Regenerate the artifact in memory from the authoritative source (the CONTEXT table), diff against the on-disk JSON, exit 1 on drift, print a one-line recovery command.
**When to use:** `build-capability-ledger.cjs` (keeps the ledger JSON in sync with the CONTEXT table, RAD-01).
```javascript
// Source: scripts/build-command-registry.cjs (verified) - --check pattern
// node scripts/build-capability-ledger.cjs --check
//   -> regenerate in memory; exit 1 if data/capability-ledger.json is stale
```

### Pattern 3: Advisory PostToolUse drift hook
**What:** Fires after Write/Edit on a CONTEXT.md; parses frontmatter; if the phase touches a forward-mapped surface but omits the `radar_findings:` row, emit a one-line `additionalContext` advisory and append a JSONL offense row; ALWAYS exit 0.
**When to use:** The radar-findings drift check (RAD-03).
```javascript
// Source: scripts/frontmatter-schema-validator.cjs (verified) - advisory, never blocks
//   stdout: { hookSpecificOutput: { hookEventName: "PostToolUse",
//                                   additionalContext: "<one-line advisory>" } }
```

### Anti-Patterns to Avoid
- **Building a new dispatcher** instead of a read-only sibling of the resolver. Canon Part 7 violation; the CONTEXT reframe explicitly rejects it.
- **Adding a second SessionStart hook entry** for the session-title. 121.5 consolidated SessionStart into ONE coordinator owner; a second entry breaks the budget/precedence discipline. Add a contributor.
- **Editing `.mcp.json` to "receive" SESSION_ID.** The platform injects it into stdio subprocesses automatically; the work is consumer-side (read `process.env`).
- **Building an A2 refactor.** No hook spawns brain-client; there is nothing to collapse (Pitfall 1).
- **A blocking drift check.** The precedent is advisory-only (exit 0). A blocking check creates user friction, the documented anti-pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel subagent orchestration (A4 / BONO team) | A `CLAUDE_CODE_FORK_SUBAGENT` harness | Opus 4.8 dynamic workflows (`/workflows`) | Platform ships a background JS-runtime orchestrating 1,000 subagents/16-concurrent with a run browser. A manual harness is a strict subset and obsolete on arrival. |
| Framework/finding -> destination routing | A new dispatcher | `command-resolver.cjs` contract (copy it) | The one-door resolver pattern exists and is CI-enforced; a parallel router is debt. |
| Ledger/registry sync | Manual hand-editing of `data/*.json` | A generator + `--check` tripwire | Hand-edited generated artifacts drift; the `--check` pattern is the existing drift-class eliminator. |
| Drift detection | A blocking validator | Advisory PostToolUse + JSONL offense log | Friction is the anti-pattern for schema enforcement (per 88.1-07 rationale). |
| Session-scoped Brain enumeration | A new SQL reader | `lib/core/navigation.cjs` chokepoint | Phase 109 proved-by-instrumentation that SQL access goes through ONE chokepoint; a new reader breaks the invariant. |

**Key insight:** This phase's whole value is that the platform now does, as first-class capabilities, several things the plugin would otherwise hand-roll (parallel orchestration, session-scoping, session-title, per-skill tool scoping). The router/ledger/drift-check are the only genuinely net-new surfaces, and even those copy existing in-repo contracts.

## Runtime State Inventory

> Phase 138 is a routing/config/retrofit phase, not a rename. But SEED-003 status + the ledger are stateful artifacts, so the relevant categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/capability-ledger.json` (net-new generated artifact) is the new stateful store. The 138-CONTEXT table is its authoritative source. `references/capability-radar/changelog-cache.md` (last fetched 2026-06-01, 2.1.159) is stale by 10 versions. | Generate ledger from CONTEXT; re-fetch cache to 2.1.169 on RAD-01; correct #2 version row. |
| Live service config | None - no external service stores Phase-138 state. The Brain graph is untouched (RAD-08: read-only scoping only). | None. |
| OS-registered state | None - no Task Scheduler / pm2 / launchd entries reference radar. | None - verified by grep (no radar references in scripts that register OS tasks). |
| Secrets/env vars | `CLAUDE_CODE_SESSION_ID` is platform-injected (not a stored secret). No new secret keys. The consumer reads `process.env.CLAUDE_CODE_SESSION_ID` - no SOPS/`.env` change. | None - code reads the platform-injected var. |
| Build artifacts | `data/capability-ledger.json` must be regenerated by the generator and committed (like `data/command-registry.json`). `data/connector-registry.json` precedent: generated + committed. The `--check` tripwire guards staleness. | Generate + `git add` the ledger; wire `--check` into pre-commit + Feynman runner (the existing CI surface). |

## Common Pitfalls

### Pitfall 1: A2 has no live target (the proxy layer is already gone)
**What goes wrong:** A plan reads SEED-003 A2 literally ("rewrite hook entries that spawn `node lib/core/brain-client.cjs` to use `type: mcp_tool`") and tries to refactor hooks that do not exist in that shape.
**Why it happens:** SEED-003 A2 was written 2026-05-05 against a hooks topology that Phase 121.5's SessionStart-coordinator consolidation changed. Grep (2026-06-09): `hooks/hooks.json` references brain-client ZERO times; every hook is `type: "command"` routed through `run-hook.cmd`. 76 modules `require` brain-client, but those are lib/script callers, not hook-spawn entries. `type: mcp_tool` appears nowhere.
**How to avoid:** Re-scope RAD-04's A2 clause from "collapse the proxy" to "AUDIT: does any hook's command path still do a Brain round-trip a `type: mcp_tool` entry would replace? If not (likely), mark A2 superseded-by-architecture and document why." Do not ship a refactor against a non-existent target. The "Phase 89.5 fixtures green" acceptance criterion then degrades to "fixtures stay green because nothing changed" - confirm, do not refactor.
**Warning signs:** A plan task titled "rewrite hook X to mcp_tool" with no named hook X.

### Pitfall 2: SESSION_ID version drift in the ledger
**What goes wrong:** The ledger ships asserting 2.1.153 for SESSION_ID-to-MCP; the real version is 2.1.154. A downstream consumer (or a tester) checks "do I have 2.1.153?" and gets confused.
**Why it happens:** The 2026-06-01 fetch recorded 2.1.153; the CHANGELOG shows 2.1.154 (stdio subprocesses) / 2.1.157 / 2.1.163.
**How to avoid:** The RAD-01 `--fetch` that lands the ledger must correct row #2 to 2.1.154 as its first act. Cite all three reaffirming versions.
**Warning signs:** Any "since 2.1.153" string in the shipped ledger.

### Pitfall 3: SESSION_ID is stdio-only (tri-polar gap)
**What goes wrong:** The session-scoping retrofit is assumed to work identically on all three surfaces; it silently no-ops where the MCP transport is not stdio.
**Why it happens:** The CHANGELOG says "stdio MCP server subprocesses." Both MindrianOS servers are stdio on CLI/Desktop. Cowork's MCP transport must be confirmed.
**How to avoid:** Gate the scoping consumer on `process.env.CLAUDE_CODE_SESSION_ID` being present; degrade gracefully (fall back to non-scoped enumeration) when absent. Document: CLI yes, Desktop yes (stdio), Cowork = confirm-at-plan-time. Never assume the var is set.
**Warning signs:** Code that reads `CLAUDE_CODE_SESSION_ID` without a presence guard.

### Pitfall 4: Adding a second SessionStart hook for the title
**What goes wrong:** A plan adds a new `SessionStart` entry to `hooks.json` to emit `sessionTitle`, colliding with the single-owner coordinator (D-13 precedence, D-14 2000-char budget).
**Why it happens:** The naive read of "SessionStart hook sets the title" is "add a SessionStart hook."
**How to avoid:** Add a `room-title` contributor to `sessionstart-coordinator.cjs`'s `DEFAULT_CONTRIBUTOR_MAP` and have the coordinator attach `sessionTitle` to its single emitted envelope.
**Warning signs:** A new top-level `SessionStart` array entry in `hooks.json`.

### Pitfall 5: Part 8 breach via session-scoping (RAD-08, load-bearing)
**What goes wrong:** Per-session Brain scoping is built such that a session-id keyed query carries user-specific strings to the Brain, breaching the LOCAL->BRAIN: NO boundary.
**Why it happens:** "Per-session Brain scoping" sounds like it sends session context to the Brain. It must NOT. SESSION_ID scoping is **read-only LOCAL enumeration** - it scopes which LOCAL records a session sees, never an egress key.
**How to avoid (and how to PROVE it):**
1. The consumer reads `process.env.CLAUDE_CODE_SESSION_ID` and uses it ONLY as a LOCAL filter key in `navigation.cjs` SQL - never as a Brain query parameter.
2. Prove by the Phase 90 tripwire pattern: a forbidden-substring scan asserting `CLAUDE_CODE_SESSION_ID` never appears in any Brain query payload, registered in the test runner (mirror `tests/test-navigation-packet-part8-leak.cjs`).
3. Run `check-brain-boundary.cjs` (the shipped PR gate, Phase 117-04) over every new path.
4. The acceptance test asserts zero non-SQLite reads for the scoping path (Phase 109 instrumentation precedent).
**Warning signs:** SESSION_ID appearing anywhere near `brain-client.query`, a packet builder, or a Cypher `$`-param.

### Pitfall 6: Dynamic-workflows mechanism mismatch (A4)
**What goes wrong:** A plan treats "adopt dynamic workflows" as a config flag like A4's `CLAUDE_CODE_FORK_SUBAGENT=1`. It is not - it is a Claude-authored JS orchestration script run by a background runtime, invoked conversationally ("ask Claude to create a workflow") + browsed via `/workflows`.
**Why it happens:** Both are "parallel subagents," but the mechanisms differ fundamentally.
**How to avoid:** RAD-06 records a DECISION (supersede A4) + a doc note on how BONO team parallelism maps onto dynamic workflows. It does NOT ship a harness or a flag. Adoption here is "stop planning the fork harness; document the dynamic-workflows path for Engine 2 BONO."
**Warning signs:** Any task that sets `CLAUDE_CODE_FORK_SUBAGENT` or writes a fork-orchestration script.

## A4 Decision Input + Recommendation

**The question (RAD-06):** Adopt Opus 4.8 dynamic workflows and mark SEED-003 A4 (`CLAUDE_CODE_FORK_SUBAGENT` harness) `superseded`, OR keep A4 if a gap exists.

**Evidence gathered:**
- **What A4 proposed (SEED-003):** Set `CLAUDE_CODE_FORK_SUBAGENT=1` as a documented opt-in + add per-agent `mcpServers:` frontmatter, to enable parallel BONO hat-team members (Canon Part 2 Engine 2). Manual, external-build-only, undocumented blast radius.
- **What dynamic workflows ship (2.1.154, verified):** Claude writes a JS orchestration script for a task you describe; a background runtime executes it while the session stays responsive. Orchestrator/sub-agent/tool three-layer structure. Capped 1,000 total / 16 concurrent. `/workflows` run browser shows phases, stages, per-agent tool calls + token spend. Intermediate results live in script variables (not the context window), so only the final answer returns to Claude. [CITED: code.claude.com/docs whats-new 2026-w22; anthropic.com/news/claude-opus-4-8; marktechpost.com 2026-05-28]
- **Gap analysis:** Dynamic workflows are a strict superset of the A4 harness. They provide (a) parallelism A4 wanted, (b) a token-budget win A4 never offered (orchestration moves to script variables), (c) observability (`/workflows` browser) A4 had none of, (d) a supported, documented, GA path vs A4's "external-build, document expectations, don't default." The ONE thing A4 carried that dynamic workflows do NOT subsume is the per-agent `mcpServers:` frontmatter scoping (#8 `agent` field, separate item) - but that is independently shipped (2.1.157) and is a Bucket-F item, not a reason to keep the fork harness.

**Recommendation: SUPERSEDE A4.** Mark SEED-003 A4 `superseded-by: Phase 138 (Opus 4.8 dynamic workflows)`. Ship NO hand-rolled fork-subagent harness, set NO `CLAUDE_CODE_FORK_SUBAGENT` env default. Record in the phase the mapping of Canon Part 2 Engine 2 (BONO hat-team parallelism) onto the dynamic-workflows substrate as the forward path. Keep the per-agent `mcpServers:` scoping idea alive ONLY as the separate #8 Bucket-F item (correct persona on dispatched subagents via the `agent` field), not as part of A4.
**Rationale:** Canon Part 7 (reuse > build) + the Don't-Hand-Roll table: the platform obsoleted the harness before it was built. Building it now is pure debt. Tri-polar note: dynamic workflows are a CLI/agentic-build capability; Desktop/Cowork BONO parallelism follows the platform's surfacing of `/workflows` there (confirm at the consumer phases 133/134/135/136, which are downstream).

## Code Examples

### Router degrade contract (copy from the resolver)
```javascript
// Source: lib/workflow/command-resolver.cjs (verified in-repo 2026-06-09)
const EMPTY_REGISTRY = Object.freeze({ commands: [], framework_index: {}, curated_chains: [] });
function _load() {
  if (_cache) return _cache;
  try { _cache = JSON.parse(fs.readFileSync(_registryPath(), 'utf8')); }
  catch (_e) { _cache = EMPTY_REGISTRY; } // degrade: never fabricate
  return _cache;
}
```

### Advisory PostToolUse envelope (copy from the validator)
```javascript
// Source: scripts/frontmatter-schema-validator.cjs (verified in-repo 2026-06-09)
// Claude Code 2.x PostToolUse output schema requires hookSpecificOutput wrapping:
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: advisory }
}));
process.exit(0); // ALWAYS exit 0 - advisory, never blocks
```

### SessionStart sessionTitle (platform contract, verified)
```javascript
// Source: Claude Code CHANGELOG 2.1.152 [VERIFIED]
// sessionstart-coordinator.cjs adds this to its single emitted envelope:
{ hookSpecificOutput: { hookEventName: "SessionStart",
                        additionalContext: composedBody,
                        sessionTitle: activeRoomSlug,   // 2.1.152
                        reloadSkills: true } }           // 2.1.152
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `CLAUDE_CODE_FORK_SUBAGENT` harness for parallel agents | Opus 4.8 dynamic workflows (`/workflows`) | 2.1.154 (2026-05-28) | A4 obsolete before build. |
| SESSION_ID only to hooks/Bash | SESSION_ID also to stdio MCP subprocesses | 2.1.154 (reaffirmed .157/.163) | Per-session LOCAL scoping now possible for both MindrianOS MCP servers. |
| Session title fixed / auto | SessionStart hook sets `sessionTitle` | 2.1.152 | Title can reflect active room. |
| Skills always-on, all tools | `defaultEnabled: false` + `disallowed-tools` frontmatter | 2.1.154 / 2.1.152 | Optional clusters + per-skill tool scoping (Part 8 hardening). |

**Deprecated/outdated:**
- SEED-003 ledger version 2.1.153 for SESSION_ID -> corrected to 2.1.154.
- SEED-003 A2 hook topology assumption (brain-client-spawning hooks) -> no longer exists post-121.5.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cowork's MCP transport is stdio (so SESSION_ID arrives there too). NOT verified - the CHANGELOG specifies "stdio MCP server subprocesses" and both MindrianOS servers are stdio on CLI/Desktop, but Cowork's runtime transport was not confirmed in this session. | Capability Currency #2; Pitfall 3 | If Cowork uses a non-stdio transport, the session-scoping retrofit no-ops there. Mitigated by the presence-guard (degrade gracefully). Confirm at plan time. |
| A2 | The ledger should become a generated `data/capability-ledger.json` (sibling of command-registry.json). This is the reuse-consistent design, but the CONTEXT leaves the artifact shape to discretion - the planner may choose to keep the ledger as the CONTEXT table only and have the router parse the markdown table directly. | Reuse-Surface Map; Architecture | Low. Either design honors Part 7; the JSON+generator path matches the registry precedent more closely. |

## Open Questions

1. **Does Cowork receive `CLAUDE_CODE_SESSION_ID`?** (See Assumption A1.)
   - What we know: stdio MCP subprocesses receive it (2.1.154); both MindrianOS servers are stdio on CLI/Desktop.
   - What's unclear: Cowork's MCP runtime transport.
   - Recommendation: presence-guard the consumer; confirm Cowork transport at plan time; degrade to non-scoped enumeration when the var is absent.

2. **Should the ledger be JSON-generated or markdown-table-parsed?** (See Assumption A2.)
   - Recommendation: JSON + generator + `--check` (matches the registry/connector-registry precedent; eliminates drift). Left to planner discretion per CONTEXT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Claude Code platform | All RAD-04/05 retrofits + dynamic workflows | Yes | 2.1.169 (latest; all features land >= 2.1.154) | Features degrade-guard; older installs simply do not get the retrofit (the plugin must not assume the var/feature is present). |
| Node.js (built-ins) | Router, generator, drift check | Yes (repo baseline >= 18) | - | - |
| WebFetch (radar --fetch) | RAD-01 ledger append | Yes (radar.md `allowed-tools`) | - | If offline, ledger seeds from the CONTEXT table; cache stays stale. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Older Claude Code installs lack the >=2.1.154 features; every consumer must presence-guard and degrade (no hard dependency on a minimum version - the plugin ships to stale users by design per release-process.md).

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash test runners (`tests/run-all-*.sh`) + CJS assertion files (`tests/test-*.cjs`), node built-in `assert`. No external test framework (repo "no new deps"). |
| Config file | none - per-phase `tests/run-all-{N}.sh` aggregator (precedent: `run-all-122.sh`, `run-all-144.sh`) |
| Quick run command | `node tests/test-radar-router.cjs` (per-module) |
| Full suite command | `bash tests/run-all-138.sh` (net-new, Wave 0) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RAD-01 | `--fetch` appends a ledger row; `--check` rejects stale ledger | unit | `node scripts/build-capability-ledger.cjs --check` | Wave 0 |
| RAD-02 | router returns findings for phase N; degrades to [] | unit | `node tests/test-radar-router.cjs` | Wave 0 |
| RAD-03 | drift hook warns on missing `radar_findings:`; exits 0 | unit | `node tests/test-radar-findings-drift.cjs` | Wave 0 |
| RAD-04 | SESSION_ID scoping is LOCAL-only; per-category JSONL has scalar-only rows | unit + tripwire | `node tests/test-radar-part8-leak.cjs` | Wave 0 |
| RAD-05 | coordinator emits `sessionTitle`; >=1 cluster `defaultEnabled:false`; disallowed-tools present | unit | `node tests/test-sessionstart-title.cjs` | Wave 0 |
| RAD-06 | SEED-003 A4 marked superseded; no `FORK_SUBAGENT` literal ships | grep tripwire | `grep -r FORK_SUBAGENT lib/ scripts/ agents/` (expect 0 outside docs/refs) | Wave 0 |
| RAD-07 | SEED-003 `status: superseded` | grep | `grep "status: superseded" .planning/seeds/SEED-003-*.md` | Wave 0 |
| RAD-08 | brain-boundary scan passes on all new paths | tripwire | `node scripts/check-brain-boundary.cjs` (shipped) | exists |

### Sampling Rate
- **Per task commit:** the relevant `node tests/test-*.cjs` + `check-brain-boundary.cjs` on any Brain-adjacent path
- **Per wave merge:** `bash tests/run-all-138.sh`
- **Phase gate:** full 138 suite green + `build-capability-ledger.cjs --check` clean + brain-boundary scan clean before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-138.sh` - aggregator (modeled on run-all-122.sh)
- [ ] `tests/test-radar-router.cjs` - covers RAD-02 (degrade-not-fabricate)
- [ ] `tests/test-radar-findings-drift.cjs` - covers RAD-03 (advisory, exit 0)
- [ ] `tests/test-radar-part8-leak.cjs` - covers RAD-04/RAD-08 (SESSION_ID never in Brain payload; mirror `test-navigation-packet-part8-leak.cjs`)
- [ ] `tests/test-sessionstart-title.cjs` - covers RAD-05 (coordinator sessionTitle)
- [ ] No framework install needed (node built-in assert).

## Security Domain

> security_enforcement is enabled (no `false` in config). RAD-08 is the load-bearing security requirement; Canon Part 8 is the governing constitution.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase. |
| V3 Session Management | yes | `CLAUDE_CODE_SESSION_ID` used as a LOCAL filter key ONLY, never an egress key or auth token. Presence-guarded. |
| V4 Access Control | yes | Brain boundary (Part 8): LOCAL->BRAIN: NO. Enforced by `check-brain-boundary.cjs` PR gate + the Phase 90 forbidden-substring tripwire pattern. |
| V5 Input Validation | yes | Ledger generator parses the CONTEXT table + WebFetch'd CHANGELOG - validate/sanitize before writing the JSON artifact. Drift hook parses YAML frontmatter (reuse the validator's parser). |
| V6 Cryptography | no | No crypto. (SESSION_ID is platform-issued; not hashed/stored by the plugin.) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SESSION_ID leaked into a Brain query payload | Information Disclosure | Read-only LOCAL filter-key usage; forbidden-substring tripwire asserting SESSION_ID never appears in any packet/Cypher; `check-brain-boundary.cjs`. |
| Per-category cost telemetry egressing user content | Information Disclosure | LOCAL `~/.mindrian/telemetry/*.jsonl` ONLY; scalar integer counts + enum category labels; zero network surface (grep-asserted, mirror query-efficiency-telemetry.cjs). |
| WebFetch'd CHANGELOG injecting malformed/hostile content into the ledger JSON | Tampering | Validate the fetched payload shape before writing; the generator's `--check` catches drift; the ledger is plugin-local + committed (reviewable). |
| Drift hook blocking user work | Denial of Service (self-inflicted) | Advisory-only, ALWAYS exit 0 (the 88.1-07 anti-friction rule). |

## Sources

### Primary (HIGH confidence)
- Claude Code CHANGELOG (`raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`) - re-fetched 2026-06-09, verified versions 2.1.148-2.1.169 for all 14 ledger items + the 2.1.160-169 no-regression window.
- In-repo files (all verified on disk 2026-06-09): `lib/workflow/command-resolver.cjs`, `scripts/build-command-registry.cjs`, `scripts/frontmatter-schema-validator.cjs`, `lib/brain/chain-recommender.cjs`, `lib/core/navigation.cjs` + `lib/core/navigation/` (22 modules), `.mcp.json`, `commands/radar.md`, `scripts/sessionstart-coordinator.cjs`, `scripts/query-efficiency-telemetry.cjs`, `references/capability-radar/{changelog-cache,capabilities-index}.md`, `.planning/seeds/SEED-003-*.md`, `hooks/hooks.json`.
- `.planning/ROADMAP.md` Phase 138 acceptance criteria (RAD-01..08, lines 2353-2470).

### Secondary (MEDIUM confidence)
- [code.claude.com/docs whats-new 2026-w22](https://code.claude.com/docs/en/whats-new/2026-w22) - dynamic workflows official docs.
- [anthropic.com/news/claude-opus-4-8](https://www.anthropic.com/news/claude-opus-4-8) - Opus 4.8 + dynamic workflows announcement.
- [marktechpost.com 2026-05-28](https://www.marktechpost.com/2026/05/28/anthropic-ships-claude-opus-4-8-alongside-dynamic-workflows-and-cheaper-fast-mode-with-workflows-capped-at-1000-subagents/) - 1,000-subagent / 16-concurrent cap.

### Tertiary (LOW confidence)
- Community explainers (MindStudio, claudefa.st, Medium) on dynamic-workflows mechanism - cross-checked against the official docs above; used only for the three-layer orchestrator/subagent/tool description.

## Metadata

**Confidence breakdown:**
- Capability currency: HIGH - every item re-verified against the live CHANGELOG through 2.1.169; one correction (#2 version), zero regressions.
- Reuse-surface map: HIGH - every anchor path verified on disk; A2-no-target finding grep-confirmed.
- A4 recommendation: HIGH - dynamic-workflows mechanism confirmed via official docs; supersession reasoning is a strict-superset argument.
- Pitfalls: HIGH (A2/SESSION_ID/SessionStart from direct grep + changelog); MEDIUM on the Cowork-transport tri-polar gap (Assumption A1).

**Research date:** 2026-06-09
**Valid until:** 2026-06-23 (14 days - Claude Code ships ~weekly; re-run `/mos:radar --fetch` before plan execution to catch >2.1.169).

## Blocker the planner must resolve
- **Re-scope A2 (RAD-04).** SEED-003 A2's "collapse the brain-client proxy layer" has NO live hook target (no hook spawns brain-client; `type: mcp_tool` is used nowhere). The planner must convert A2 from a refactor task into an audit-and-document task (likely "superseded-by-architecture, 89.5 fixtures stay green untouched"). Shipping a refactor against a non-existent target is the one trap that will waste a wave.
