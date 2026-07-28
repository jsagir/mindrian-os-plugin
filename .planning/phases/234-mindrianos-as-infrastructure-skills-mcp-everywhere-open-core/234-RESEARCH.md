# Phase 234: MindrianOS as infrastructure: skills+MCP everywhere, open-core at the network boundary - Research

**Researched:** 2026-07-28
**Domain:** Cross-harness agent-skill distribution (Agent Skills open standard) + MCP server boundary design + open-core commercial boundary
**Confidence:** HIGH on codebase baseline and spec compliance (measured directly). HIGH on host-ecosystem state (primary sources, same-day). MEDIUM on commercial precedent (thin corpus, secondary sources). LOW on pricing model (deliberately unresolved by SEED-069; corpus returned empty).

## Summary

The headline finding is that **Phase 234 is far closer to done than SEED-068 and SEED-069 assume.** Both seeds were written on 2026-07-18 as strategy documents, before anyone diffed them against the actual repo. Diffing them now: the MCP server already exposes 33 tools (SEED-068's Tier-0 target was "~30"); persona already ships as a SKILL (`skills/larry-personality/SKILL.md`), which is D-03's binding architectural decision; `InitializeResult.instructions` is verifiably absent from the wire, so D-03's "NEVER route persona through instructions" is already satisfied by construction rather than being a thing to undo; the free/paid network boundary already exists as the two-server split in `.mcp.json` (`mindrian-os` local + `mindrian-brain` remote); and the entitlement mechanism SEED-069 marks OPEN is already built and running in production at `mcp-server-brain/lib/auth.cjs` (Bearer token, Supabase-backed `brain_api_keys` table, per-key `plan` field, full trial to grace to expired lifecycle, usage logging). SEED-069's D-09/D-13 "what is the entitlement mechanism" is not a design question. It is a documentation-and-completion question.

The genuinely open work is portability hygiene, and it is measurable and small. Against the formal Agent Skills specification, 9 of 125 skills fail hard validation (7 missing the required `name` field, `MOSDeckEngine` violates the lowercase-hyphen charset rule, `value-proposition/SKILL.md` declares `name: validate-proposition` which breaks the must-match-parent-directory rule) and 112 of 125 encode `allowed-tools` as a YAML list when the spec defines it as a space-separated string. Separately, 51 of 125 skills hardcode `${CLAUDE_PLUGIN_ROOT}` in their body and all 125 reference `/mos:` slash commands, neither of which exists on any host except Claude Code. And the single biggest functional gap: the three graph-write tools (`graph_write`, `memory_event`, `artifact_file`) are gated behind `MINDRIAN_MCP_FIRST` and default OFF, so a foreign host gets 33 read-and-orchestrate tools and zero write path into the room graph. On Claude Code that is fine because slash commands and hooks do the writing. On VS Code, Cursor, Goose or Zed it means the product reads but cannot record.

Two facts materially update SEED-068 and the planner must not plan against the stale version. First, SEED-068's 11-host matrix is now roughly 45 hosts: agentskills.io's client showcase lists Gemini CLI, OpenAI Codex, JetBrains Junie, Amp, Roo Code, Factory, Kiro, Letta, OpenHands, Snowflake Cortex Code, Databricks Genie Code, Spring AI, Mistral Vibe, Tabnine and more, which closes out the "vendor-CLI pass still outstanding" gap SEED-068 flagged as unresolved. Second, the Zed 50KB catalog budget that SEED-068 called a "hard constraint, MEASURE BEFORE SHIPPING" has now been measured: MindrianOS's 125 skills total **12,966 bytes of name+description, 25% of the 50KB budget, 3.9x headroom.** SEED-068 estimated ~400 bytes/skill; the real mean is 104. Zed is not a risk. It is a copy-the-directory task.

**Primary recommendation:** Scope this phase as *portability hardening plus boundary documentation of an architecture that already exists*, not as a build. Wave 1 fixes the 9 hard spec failures and normalizes `allowed-tools` (mechanical, verifiable with the official `skills-ref` validator). Wave 2 closes the Tier-0 write-path hole and adds host detection via the MCP SDK's `getClientVersion()` into the existing `lib/mcp/surface-detect.cjs` chokepoint, extending it from a one-axis surface map to D-05's two-axis (surface x host-tier) capability floor. Wave 3 de-`CLAUDE_PLUGIN_ROOT`s the 51 affected skills onto the existing `MINDRIAN_OS_ROOT` seam in `lib/core/active-plugin-root.cjs`. Defer pricing entirely: the langtalks corpus has zero coverage and SEED-069 marks it OPEN and non-blocking.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Methodology content (124 SKILL.md) | Host / client filesystem | - | Skills are read by the host's own skill loader before any MindrianOS process exists. Nothing server-side can gate them. D-06 and D-08 both follow from this. |
| Persona (Larry) | Host / client filesystem (as a SKILL) | - | D-03. `InitializeResult.instructions` is host-optional and provably dropped by some hosts; the SKILL channel is universal. Already implemented at `skills/larry-personality/SKILL.md`. |
| Room graph read/write (room.db) | Local MCP server (`mindrian-os`) | - | Local `.cjs` + local SQLite. Runs on the user's machine, is the user's own data (D-08), never crosses the network. Canon Part 8. |
| Gate ladder / navigation engine / memory layers | Local MCP server | - | Same. `lib/core/navigation.cjs` is the single SQL chokepoint; it is local and free. |
| Governance / HITL gating | Local MCP server tool handlers | Client hooks (Tier 1 only) | D-04. Hooks are per-host-shaped and absent on Zed; the server handler is the only portable enforcement point. |
| Host + model capability detection | Local MCP server (`surface-detect.cjs`) | - | D-05. The server is the one component that sees `clientInfo` on every host. Client-side detection would need N adapters. |
| Entitlement / plan enforcement | Remote Brain server (`mcp-server-brain/lib/auth.cjs`) | - | D-07. Enforcement lives where the code was never shipped to the user. Already implemented. |
| Teaching graph, scouts, curation, cross-org intelligence | Remote Brain server | - | D-09. The only capabilities that fail the copy test. Matches `docs/MOAT-MANDATE.md`'s existing "What CANNOT Be Copied" table. |
| Brain transport / Tier-0 degradation | Local shim (`bin/mindrian-brain-mcp-client.cjs`) | - | Local shim proxies to remote and returns `DIRECTOR_NOT_AVAILABLE` without a key. This is the honest-degradation boundary, already built. |

**Tier-boundary check against D-12:** the rows above are the *architectural* tiers. They are orthogonal to both SEED-068's host tiers (Tier 0 universal / Tier 1 hook-capable) and SEED-069's commercial tiers (free / paid). All three axes are independent. The planner must not let a task collapse any two of them.

## Project Constraints (from CLAUDE.md)

Binding directives extracted from `./CLAUDE.md` and its `@include` files. Plans that contradict these are non-compliant regardless of what this research recommends.

| Directive | Source | Effect on this phase |
|-----------|--------|---------------------|
| Workspace guard: all work in `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/` | CLAUDE.md, WORKSPACE GUARD | Any packaging/install task must not test against the install cache. |
| Canon Part 8: LOCAL -> BRAIN is NO. User data never egresses. | CLAUDE.md Canon core | D-11. Constrains the entitlement design: seat counting cannot use MindrianOS telemetry. Confirmed already honored (no local tool requires `brain-client`). |
| Canon Part 7: Reuse Before Build. Search 25 methodology commands and `lib/core/*.cjs` first. | CLAUDE.md Canon core | This phase must extend `surface-detect.cjs`, `active-plugin-root.cjs`, `resolve-brain-key.cjs`, `tier0-messaging.cjs` rather than add parallel resolvers. Concrete reuse targets listed below. |
| Canon Part 11 (CIRS): every invocable surface born WIRED or EXCLUDED, with a declared `hitl_shape`/`hitl_why`. Gate: `scripts/check-shape-declaration.cjs` (ADVISORY WARN since Phase 210; `--strict` hard-fails). | CLAUDE.md Canon core | Any new MCP tool this phase adds must export a `connectors` array. Surface count is enumerated from disk at runtime, never a frozen literal. |
| Tri-Polar Design Rule: evaluate every feature across CLI / Desktop / Cowork. A skip is a stated call, not an oversight. | CLAUDE.md | Interacts with D-05: the phase now has FOUR relevant axes (surface, host, host-tier, commercial-tier). Do not let the new host axis silently replace the existing surface axis. |
| No em-dashes anywhere. Hyphens only. | CLAUDE.md Conventions | Applies to all SKILL.md description rewrites in this phase. |
| CJS only, no TypeScript. `lib/core/*.cjs` ships as source. | CLAUDE.md Conventions | Rules out any TypeScript tooling, including the npm `skills-ref` package (see Package Legitimacy Audit). |
| Release lockstep: five gates via `scripts/release.sh <version>`. Never bump versions by hand. | `.claude/includes/release-process.md` | If this phase ships a new distribution artifact (e.g. a `.agents/skills/` bundle), it becomes a sixth surface that must stay in lockstep. Flag explicitly. |
| Dev-Research Compositing: phases touching MindrianOS's own architecture file findings in BOTH the phase dir AND `~/MindrianRooms/rethinking-mindrianos/research/`. | CLAUDE.md | This phase qualifies. The planner should include a filing task. |
| Consult `langtalks-graph-expert` during dev research (MANDATORY). | CLAUDE.md | Done. Results in the Corpus Consult section below, including honest empty results. |
| GSD Workflow Enforcement: no direct repo edits outside a GSD workflow. | CLAUDE.md | Procedural; applies to execution not planning. |

## User Constraints (from CONTEXT.md)

Copied verbatim from `234-CONTEXT.md`. These are locked. Research does not re-open them.

### Locked Decisions

**Distribution architecture (SEED-068)**
- **D-01:** Ship as a skills package (SKILL.md files) + MCP server that installs into any Claude-Code-skill-format-compatible host. No fork of a host runtime (OpenCode, Grok Build, etc.) as the primary strategy.
- **D-02:** Two-tier honest degradation model:
  - **TIER 0 (universal):** skills (124 SKILL.md) + MCP server (~30 tools) - works on every compliant host (Claude Code, OpenCode, Grok Build, VS Code/Copilot, Cursor, Goose, Cline, Windsurf/Devin, Continue, Zed [skills only, `.agents/` not `.claude/`], next-thing).
  - **TIER 1 (hook-capable):** + proactive surfacing, Stop gate, contradiction push - Claude Code (84 hook entries today), Grok Build (17 events, exit-code-2, native), OpenCode (via SEED-063's plugin, now explicitly a Tier-1 ENHANCEMENT, not the strategy).
- **D-03:** NEVER route persona through MCP `InitializeResult.instructions` - it is the least portable channel surveyed (confirmed only on Goose + listed VS Code; provably dropped by Zed; unimplemented on Cline/Continue). Persona ships as a SKILL - the one channel with universal support and documented semantics. Tool descriptions are load-bearing product copy and must be written as instructions, not labels. (This supersedes SEED-065's earlier guidance to lean on `instructions` + tool descriptions - tool descriptions remain valid, `instructions` does not.)
- **D-04:** Enforce governance SERVER-SIDE, in MCP tool handlers - not via client hooks. Client hooks exist on most hosts but are Preview-status on VS Code, differently shaped per host, and entirely absent on Zed. Only `.claude/settings.json` is portable, and only to VS Code.

**Capability floor and degradation (SEED-068)**
- **D-05:** Capability floor is two-dimensional: model capability AND host tier. Detect both; state both; degrade honestly on both axes - same no-silent-skip discipline the gate ladder's `renderViaText` already encodes, consistent with this repo's existing gates discipline and SEED-059's fallback-disclosure convention.
- **D-06:** Never put anything genuinely proprietary in a SKILL.md - it is a copyable text file on the user's disk, on every host, forever.

**Commercial boundary / open-core (SEED-069)**
- **D-07:** The boundary is a NETWORK boundary, not a license-key boundary. Licensed-server / open-core model - chosen (2026-07-18) over Brain-as-a-service, institutional licensing, and methodology-as-curriculum. Those remain live alternatives if this fails; not re-litigated here.
- **D-08:** FREE CORE (local, copyable, and that's fine - it's the adoption engine): all 124 SKILL.md (the methodology), the local MCP server, room.db and the room graph (the user's own data), the gate ladder, navigation engine, memory layers.
- **D-09:** PAID (hosted; nothing to patch because it was never on the user's disk): the Brain (curated teaching graph), scouts/sentinels (grants, deadlines, competitors, opportunity scans), cross-room and cross-org intelligence, curation and updates (a static copy of the methodology rots), support/indemnity/SLA.
- **D-10:** Do NOT gate a `/mos:` methodology run behind a paid check - that inverts the adoption engine. The failure mode to actively watch for is the free core being too thin (nobody adopts), which is the OPPOSITE risk from piracy.
- **D-11:** Canon Part 8 (Brain is a READ service, never sees user content) holds UNCHANGED and is a FEATURE of this model, not a constraint fought against - it's what makes the paid tier sellable to institutions that would refuse a data play.
- **D-12:** Host-capability tiers (SEED-068's Tier 0/Tier 1) and commercial tiers (SEED-069's free/paid) are DIFFERENT AXES - do not conflate them. A Tier-0 host (e.g. Zed) can have a paying user; a Tier-1 host can have a free one.

**The four SEED-068 commercial questions, per SEED-069**
- **D-13:** Which methodology content lives behind the server? ANSWERED: none of it. Methodology is the adoption engine and ships free in SKILL.md. What lives behind the server is *knowledge* (the Brain) and *currency* (scouts, updates), not *method*.
- **Still OPEN (planner's discretion how much this phase resolves vs. defers):** the entitlement mechanism and whether it works offline/self-hosted; per-seat/per-org/per-room pricing. Note: seat-counting cannot rely on MindrianOS's own telemetry (Part 8 forbids the obvious workaround, since the host runs the conversation) - likely resolves to per-org against Brain API credentials.

### Claude's Discretion

- Exact build-order sequencing within the phase's plans. SEED-068 suggests: VS Code/Copilot + Cursor first (the market, both keep Larry intact); Goose second (full-channel reference); Cline third (PR #11131 already open, needs only a rebase - see "Corrections" below); Grok Build/OpenCode fourth; Zed fifth (cheap, ~a day, not for revenue - 50KB total catalog budget, MEASURE before shipping); Continue package-only, do not invest; Aider skip entirely (no MCP client). The planner may resequence based on what's actually buildable first in THIS codebase.
- Whether this phase's plans fully resolve the entitlement mechanism and pricing model, or scope a narrower first cut and defer the rest to a follow-up phase/seed - SEED-069 itself marks these OPEN, not blocking.
- The exact list of which existing `lib/core/*.cjs` logic needs to move behind an entitlement check vs. stays free - this phase's research step should surface a concrete list against the actual codebase rather than the planner assuming it from the seeds alone.
- Corrections SEED-068 records that the planner should treat as current fact, not stale: Cline did NOT "explicitly decline" `instructions` (a stale bot closed the issue `not_planned`, no human position taken; PR #11131 closed by its own author for refactor drift, remains open, zero recorded opposition - upstreaming is viable). Windsurf is now Devin Desktop (Cognition-owned; verify install base before spending roadmap on it - no substantiable seat/ARR figure).

### Deferred Ideas (OUT OF SCOPE)

- SEED-072 (collaborative editor stack) and SEED-073 (filesystem/CRDT/RxDB) - both explicitly shelved by their own "no action implied" text. Out of scope for Phase 234; do not fold in.
- SEED-070 (Eureka live-test lesson) and SEED-071 (Markitdown/LangExtract evaluation) - adjacent evaluations, not part of this phase's mandate; leave as standalone seeds.
- Full resolution of SEED-069's still-OPEN entitlement mechanism (offline/self-hosted Brain for enterprise) and pricing model (per-seat/org/room) - SEED-069 marks these OPEN, not blocking. The planner may scope a narrower first cut and defer the rest to a follow-up seed/phase.
- Full host-adapter build-out beyond what's needed to prove the Tier-0/Tier-1 architecture (SEED-068's "Build order" items 3-7: Cline PR upstreaming, Grok Build/OpenCode plugin work, Zed port, Continue packaging, Aider skip) - SEED-068's own stated sequencing, not necessarily all in Phase 234's first plan wave. Planner's discretion which subset ships now vs. a follow-up phase.

## Phase Requirements

This project maintains no `.planning/REQUIREMENTS.md` (confirmed absent on disk). No requirement IDs were supplied by the orchestrator. Phase scope is fully defined by `234-CONTEXT.md` and SEED-068 + SEED-069. The decision IDs D-01 through D-13 above serve as the de facto requirement set, and the Validation Architecture section maps tests against them.

## Current Codebase Baseline

Everything in this section was measured directly on 2026-07-28 against the working tree at `1.15.3-beta.51`. This is the concrete "current state" the planner diffs SEED-068 and SEED-069 against.

### Invocable surface counts

| Surface | Count | Source | vs. seed assumption |
|---------|-------|--------|---------------------|
| `SKILL.md` files under `skills/` | **125** | `find skills -name SKILL.md` [VERIFIED: codebase] | Seeds say 124. Off by one. |
| Additional `SKILL.md` under `.claude/skills/` | 1 (`docu-optimizer`) | [VERIFIED: codebase] | Not counted by the seeds. Project-local dev skill, not shipped product. |
| Commands (`commands/*.md`) | **112** | [VERIFIED: codebase] | Seeds say 111. |
| Agents (`agents/*.md`) | **9** | [VERIFIED: codebase] | Matches. |
| MCP tools, live on the wire, default config | **33** | `tools/list` against `bin/mindrian-mcp-server.cjs` [VERIFIED: codebase] | SEED-068's Tier-0 target was "~30 tools". **Already met.** |
| MCP tools with `MINDRIAN_MCP_FIRST=<surface>` | **36** | [VERIFIED: codebase] | +`graph_write`, `memory_event`, `artifact_file`. See the write-path gap below. |
| Brain (remote) MCP tools | **6** | `bin/mindrian-brain-mcp-client.cjs` [VERIFIED: codebase] | `brain_ask`, `brain_query`, `brain_schema`, `brain_search`, `brain_stats`, `brain_write` |
| Born-wired connector registry total | **198** (83 command, 87 skill, 21 mcp_tool, 7 agent) | `data/connector-registry.json` [VERIFIED: codebase] | CLAUDE.md Part 11 says "currently 126 declared + 5 skill-exempt"; the registry is the runtime enumeration. |

### The live 33-tool Tier-0 surface

```
room_state  room_content  room_graph  methodology  analysis  intelligence  meeting
export  orchestration  room_bind  eureka_critic  contract_version  chain_resolve
chain_run  gate_render  gate_answer  graph_query  room_list  room_state_bound
room_search  suggest_next  reach_candidates  contradiction_check  whitespace_scan
framework_run  status_read  stop_gate_check  view_compile  detect_dual_path
extract_shallow  room-dashboard  room-wiki  room-graph
```

Total tool-description payload: **6,858 characters across 33 tools, mean 208 chars.** [VERIFIED: codebase]

### `.mcp.json` shape (the existing network boundary)

```json
{
  "mcpServers": {
    "mindrian-os":    { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/bin/mindrian-mcp-server.cjs"],      "alwaysLoad": true },
    "mindrian-brain": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/bin/mindrian-brain-mcp-client.cjs"], "alwaysLoad": true }
  }
}
```

**This two-server split IS SEED-069's network boundary, already shipped.** `mindrian-os` is the free local core (33 tools, zero network surface). `mindrian-brain` is a thin stdio shim that proxies 6 tools to `mindrian-brain.onrender.com` and returns a `DIRECTOR_NOT_AVAILABLE` sentinel when no key resolves. [VERIFIED: codebase]

Two portability problems in this file, both Tier-0 blockers:
1. `${CLAUDE_PLUGIN_ROOT}` is a Claude-Code-only expansion. No other host defines it.
2. `alwaysLoad` is a Claude-Code plugin-manifest key, not part of any cross-host MCP config convention.

### The existing entitlement mechanism (SEED-069 D-09/D-13 "OPEN" -- it is not)

`mcp-server-brain/lib/auth.cjs` (376 lines, production, Render-hosted) already implements the whole thing:

- **Transport auth:** `Authorization: Bearer <key>` Express middleware in front of every Brain MCP call.
- **Key store:** Supabase `brain_api_keys` table, columns `id, user_id, email, plan, status, expires_at, grace_ends_at, trial_expired_at, total_requests, last_request_at`. Two key formats supported (`mbr_` prefixed text keys and UUID keys).
- **Plan field:** every key carries a `plan` (`trial`, `pro`, `env`). Already passed downstream: `registerNeo4jTools(server, { plan: req.brainPlan })` in `server.cjs:38`.
- **Lifecycle:** `active` -> (past `expires_at`) -> `grace` (24h, `X-Brain-Trial-Status` response header + warning in body) -> `expired` (403 with upgrade URL). `revoked` is a hard 403.
- **Caching:** 5-minute key cache, 60s for grace/trial keys.
- **Usage tracking:** `total_requests` / `last_request_at` on the key row, plus a `brain_usage_log` row per call carrying `api_key` and `tool_name`. Fire-and-forget, never blocks the request.
- **Degraded mode:** if Supabase is unreachable, falls back to a comma-separated `BRAIN_API_KEYS` env var.

Client side, `lib/core/resolve-brain-key.cjs` is the single key resolver with a documented precedence chain (env var -> `~/.mindrian.env` -> `<cwd>/.env` -> not-found), a POSIX 0600 permission gate, and normalization that strips a stray `Authorization:` / `Bearer ` prefix. `lib/core/tier0-messaging.cjs` is the single chokepoint for the no-key sentinel shape.

**Implication for the planner:** D-09's entitlement question reduces to one genuinely new decision -- *what does `plan` actually gate?* Today `plan` is threaded into `registerNeo4jTools` but no per-plan capability differentiation exists in the tool set. Everything else (identity, transport, lifecycle, metering, offline behavior) is built. "Offline / self-hosted" is likewise already answered in practice: offline means no key resolves, which means `DIRECTOR_NOT_AVAILABLE`, which means the free core, which still works. That is exactly SEED-069's stated intent.

### Licensing reality: BSL-1.1, not open source

`LICENSE`, `package.json`, and `.claude-plugin/plugin.json` all declare **BSL-1.1** (Business Source License 1.1), Licensor Jonathan Sagir, Change Date **2030-04-16**, Change License Apache-2.0. The Additional Use Grant expressly permits personal, academic, and internal business use, and prohibits a "Commercial Offering" (hosted/managed service or marketplace product substantially deriving value from the Licensed Work). [VERIFIED: codebase]

This matters and the seeds do not mention it. SEED-069 says "open core," but BSL-1.1 is **source-available, not open source**. The practical effect is that MindrianOS already has *two* boundaries, not one:

- a **legal** boundary (BSL-1.1: copy and use freely, do not resell), which is what actually protects the copyable SKILL.md layer, and
- a **network** boundary (Brain auth), which is what SEED-069 D-07 describes.

They are complementary, and together they answer SEED-069's objection-and-rebuttal better than the network boundary does alone. The planner should NOT plan a task that relicenses anything -- but should plan a task that makes the license *legible at the skill level*, because right now **0 of 125 skills carry the spec's optional `license:` field.** The Agent Skills spec explicitly recommends this pattern and even uses a proprietary example: `license: Proprietary. LICENSE.txt has complete terms`. A skill file that travels to Zed or Gemini CLI with no license line is a BSL work with no notice attached. [CITED: agentskills.io/specification]

### Consistency check: D-07/D-08/D-09 against the existing moat framing

CONTEXT.md asked for this check. `docs/MOAT-MANDATE.md` has a "What CAN Be Copied (and that is fine)" table listing the 25 methodology prompts, the plugin structure, and the ICM stage contracts, and a "What CANNOT Be Copied" table listing the Teaching Graph (Brain), Grading Intelligence, and Mode Engine Calibration. **This is the same line SEED-069 draws, written earlier and independently.** No contradiction. SEED-069 sharpens it by naming the *mechanism* (network boundary) for a line the moat doc had only named by *content*. The planner can treat D-07/D-08/D-09 as an amendment that adds a mechanism column to an existing table, not as a new position needing reconciliation. [VERIFIED: codebase]

## Concrete Gap List: Tier-0 Portability

This is the answer to CONTEXT.md's research ask #2. Every row measured, not spot-checked -- the full 125 were validated programmatically against the formal spec.

### A. Hard spec failures (9 skills, will fail `skills-ref validate`)

| Failure | Count | Skills | Fix |
|---------|-------|--------|-----|
| Missing required `name` field | **7** | `auto-explore`, `brain-derive`, `dial-memory-refresh`, `dogfood-flush`, `explain-decision`, `feynman-timeline-refresh`, `mva-report` | Add `name: <dirname>`. Mechanical. |
| `name` violates charset rule (lowercase alphanumeric + single hyphens only) | **1** | `MOSDeckEngine` (name AND directory are CamelCase) | Rename skill directory to `mos-deck-engine` and set matching `name`. Requires a grep-and-update of every reference. |
| `name` does not match parent directory | **1** | `skills/value-proposition/SKILL.md` declares `name: validate-proposition` | Decide which is canonical, then align both. |

**Why this is not cosmetic:** the spec states `name` is required and "must match the parent directory name." Claude Code is tolerant and falls back to the directory name. Other hosts are not required to be, and Zed's loader is documented as flat-only and strict. These 9 skills are the ones most likely to silently vanish from a foreign host's catalog. [CITED: agentskills.io/specification]

### B. Spec deviations (portable but out-of-spec)

| Deviation | Count | Detail |
|-----------|-------|--------|
| `allowed-tools` encoded as a YAML list or comma-separated string | **112 / 125** | The spec defines `allowed-tools` as "a space-separated string" and marks it **Experimental** with support that "may vary between agent implementations." MindrianOS uses `allowed-tools: [Bash, Read, ...]`. Claude Code accepts this; a strict parser need not. [CITED: agentskills.io/specification] |
| Non-spec top-level frontmatter keys | **63 distinct keys** | The spec defines exactly six: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. MindrianOS adds 63 more at top level, led by `connector` (125), `hitl_why` (120), `help_jtbd`/`body_shape`/`serves_jtbd`/`teaching` (111 each), `hitl_shape` (108), `kind` (58), `frameworks` (57). The spec provides `metadata:` as the sanctioned home for exactly this. |
| `license` field absent | **125 / 125** | See BSL section above. |
| `compatibility` field absent | **125 / 125** | This is the spec-native channel for D-05's honest capability declaration. See recommendation below. |
| `SKILL.md` body over the 500-line advisory | **5** | `file-meeting` (897), `rooms` (621), `setup` (626), `new-project` (601), `whitespace` (506). Median across all 125 is 93 lines, so this is a tail problem not a systemic one. |

**Important caution on the `metadata:` migration.** The spec says `metadata` is "a map from string keys to **string** values." MindrianOS's non-spec keys include arrays and nested maps (`hitl_stages`, `frameworks`, `inputs`, `produces`, `connector` which is a nested object with `excluded`/`reason`). A naive "move everything under `metadata:`" task will produce spec-invalid output. The planner must treat this as a *typed* migration with a serialization decision per key, or scope it to string-valued keys only and leave structured keys at top level with a documented rationale. Do not plan this as a mechanical move.

### C. Claude-Code-only runtime mechanics in skill bodies

| Mechanic | Skills affected | Why it breaks Tier 0 |
|----------|----------------|----------------------|
| `${CLAUDE_PLUGIN_ROOT}` hardcoded in body | **51 / 125** (plus **51 / 112 commands**) | Undefined on every host except Claude Code. The 51 skills reference it to shell out to `scripts/room-registry` (19), `scripts/resolve-room` (12), `mcp-server-brain/brain-admin.cjs` (9), `scripts/git-ops` (8), `scripts/whitespace-command.cjs` (7), `scripts/publish-ops` (7), `scripts/eureka-command.cjs` (7), and others. On a foreign host these expand to the empty string and the command runs against a bogus path. |
| `/mos:` slash-command references | **125 / 125** | Slash commands are a Claude Code plugin concept. No other host resolves `/mos:whitespace`. Every skill mentions at least one. |
| `AskUserQuestion` invoked in body | **109 / 125** | A Claude Code tool. Not part of any cross-host standard. Where a skill's flow *depends* on it (as opposed to merely listing it), the interaction degrades to prose on a foreign host. |
| `disable-model-invocation: true` frontmatter | **15** | Claude-Code-only key. On other hosts it is an unrecognized key, so these 15 skills become model-invocable where they were deliberately not. Named skills: `dial-memory-refresh`, `export`, `brain-derive`, `explain-decision`, `dogfood-flush`, `feynman-timeline-refresh`, `publish`, `memory`, `jtbd`, `mva-report`, `ingest-methodology`, `pws-brain`, `operator`, `vault`, `snapshot`. |
| Hook mechanics referenced in body | **16** | Tier-1-only per D-02. These need a `compatibility:` declaration. |

**The good news on `${CLAUDE_PLUGIN_ROOT}`:** the abstraction seam already exists. `lib/core/active-plugin-root.cjs` is the single resolver for "where is the active MindrianOS install," with `MINDRIAN_OS_ROOT` as precedence #1 (explicitly documented as the "tests, dev boxes, hand clones" escape hatch), then Claude Code's `installed_plugins.json`, then the plugin cache, then a legacy path. **Currently 0 of 125 skills and 0 of 112 commands reference `MINDRIAN_OS_ROOT`.** The de-Claude-ification task is: make the host-agnostic installer export `MINDRIAN_OS_ROOT`, and rewrite the 51+51 references to prefer it. This is Canon Part 7 reuse, not new surface.

### D. The Tier-0 write-path hole (highest-severity functional gap)

`graph_write`, `memory_event`, and `artifact_file` are registered only when `isMcpFirst(ctx.surface)` returns true, i.e. when `MINDRIAN_MCP_FIRST` names the detected surface. **The flag defaults to unset.** Measured: 33 tools default, 36 tools with the flag on. [VERIFIED: codebase]

On Claude Code this is invisible, because slash commands and the 42 hook matcher groups in `hooks/hooks.json` perform the writes. On any Tier-0 host there are no slash commands and no hooks, so a user gets a product that reads their room graph, runs frameworks, and renders gates -- and cannot record a single thing. That is not "honest degradation," it is a silent one-way mirror, and it contradicts D-05's no-silent-skip discipline.

The planner must decide explicitly: either (a) make MCP-first the default on non-Claude-Code hosts once host detection exists, or (b) declare the write path Tier-1-only and surface that in the capability floor. Option (a) is strongly indicated -- otherwise D-08's "room.db and the room graph (the user's own data)" is free but unreachable, and the free core becomes exactly the too-thin thing D-10 warns about.

### E. Minor: MCP tool-name inconsistency

30 of 33 tools use `snake_case`; three use `kebab-case` (`room-dashboard`, `room-wiki`, `room-graph`). Also note `room_graph` and `room-graph` coexist as distinct tools, which is a discoverability hazard for a model choosing between them. Cheap to fix; worth folding into whatever wave touches tool descriptions.

### F. Tool descriptions that are labels, not instructions

D-03 requires tool descriptions be "written as instructions, not labels" because on Tier-0 hosts they are the only universally honored persona channel. Measured: mean 208 chars, but the following sit at label length and should be rewritten:

| Tool | Description length |
|------|-------------------|
| `meeting` | 66 |
| `room_graph` | 68 |
| `room_list` | 76 |
| `analysis` | 77 |
| `room_content` | 78 |
| `room_search` | 85 |
| `export` | 86 |
| `orchestration` | 91 |

Contrast with the well-written end: `chain_run` (552), `stop_gate_check` (460), `framework_run` (424). Those are the in-repo model to follow.

## Standard Stack

This phase adds essentially no new runtime dependencies. Its "stack" is a specification, an existing SDK, and one validator.

### Core

| Library / spec | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| Agent Skills specification | Current as of 2026-07-28 | The SKILL.md format contract this phase conforms to | "Originally developed by Anthropic, released as an open standard." Repo `agentskills/agentskills`, Apache-2.0, 23,548 stars, last updated 2026-07-28. [CITED: agentskills.io] [VERIFIED: GitHub API] |
| `@modelcontextprotocol/sdk` | **1.29.0 installed; 1.30.0 latest** | MCP server (stdio + Streamable HTTP) | Already a dependency. [VERIFIED: npm registry] |
| `zod` | ^3.25.76 | MCP tool schema validation | Already a dependency, required by the SDK. |
| `gray-matter` | ^4.0.3 | YAML frontmatter parsing | Already a dependency. This is the tool to build an in-repo skill validator with, avoiding a new dependency entirely. |

### Supporting

| Tool | Version | Purpose | When to use |
|------|---------|---------|-------------|
| `skills-ref` (**PyPI**, official) | 0.1.1 | `skills-ref validate ./my-skill` -- the reference validator named by the spec | Only if a Python toolchain is acceptable. **Not currently in this repo's stack.** See Package Legitimacy Audit -- the npm package of the same name is a different, unaffiliated project. |
| In-repo validator via `gray-matter` | n/a | Same validation, zero new deps, CJS | **Recommended.** Matches CLAUDE.md's "CJS only, no TypeScript" and the existing `scripts/check-*.cjs` gate family. |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| In-repo CJS validator | PyPI `skills-ref` | Official and authoritative, but introduces a Python dependency into a Node-only project and a second toolchain into the release gate. |
| In-repo CJS validator | npm `skills-ref` | **Do not.** Unaffiliated reimplementation. See audit below. |
| Extending `surface-detect.cjs` | New `host-detect.cjs` module | Rejected on Canon Part 7. `surface-detect.cjs` is already the one place capability flags are derived; a second detector recreates the exact three-guessers failure mode that `resolve-brain-key.cjs` and `active-plugin-root.cjs` were both written to kill. |
| `metadata:` for the 63 non-spec keys | Leave them top-level | Leaving them is what ships today and nothing has broken. The spec does not forbid extra keys, it just does not define them. This is a "correctness now vs. risk later" call for the navigator, not a forced move. |

**Installation:** No new packages required for the recommended path.

## Package Legitimacy Audit

Only one candidate package surfaced during research: `skills-ref`, the validator named by the Agent Skills specification.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `skills-ref` | **PyPI** 0.1.1 | 2 releases | not measured | `github.com/anthropics/agentskills` (declared in `project_urls`, matches the official repo which contains `skills-ref/pyproject.toml`) | not run (PyPI) | **Approved, but out-of-stack** -- authoritative, yet requires Python in a Node-only project |
| `skills-ref` | **npm** 0.1.5 | published 2025-12-26, last touched 2025-12-27 (~7 months stale) | not measured | **none declared** | `[OK]` with warning: "No source repository linked. Harder to verify what this code actually does." | **REMOVED from recommendations** |

**Findings on the npm package.** It is authored by `YanchaoMa <crazyyanchao@gmail.com>`, MIT-licensed, TypeScript/ESM, with a `skills-ref` bin. It is *not* the official validator. The official one is the Python package whose `project_urls` resolve to `agentskills.io` and `github.com/anthropics/agentskills`; the official monorepo's `skills-ref/` directory contains `pyproject.toml` and `uv.lock`, confirming Python. The npm package declares no repository, had all six releases inside a 32-hour window in December 2025, and has not been touched since.

This is a textbook **cross-ecosystem name-collision hazard**: an agent working in this Node-only repo, reading the spec's `skills-ref validate ./my-skill` instruction, would reach for `npm install skills-ref` and install an unaffiliated package. slopcheck rates it `[OK]` on registry heuristics, which is exactly why registry existence alone is not sufficient evidence -- the failure here is *identity*, not *existence*.

**Instruction to the planner: do not add either `skills-ref` package as a dependency.** Build the validator in-repo with `gray-matter` (already vendored), as a `scripts/check-skill-spec.cjs` sibling to the existing `scripts/check-shape-declaration.cjs` / `check-render-coverage.cjs` gate family. If independent cross-validation against the official implementation is wanted, run PyPI `skills-ref` once manually as a research/QA step and record the diff, without wiring it into the build.

**Packages removed due to identity mismatch:** npm `skills-ref`.
**Packages flagged as suspicious:** npm `skills-ref` (no source repo, stale, unaffiliated).

## Architecture Patterns

### System Architecture Diagram

```
                 THE HOST (Claude Code | VS Code/Copilot | Cursor | Goose |
                            OpenCode | Zed | Gemini CLI | Codex | ~45 more)
                 the host owns the agent loop, the model calls, and the API key
                                          |
        +---------------------------------+---------------------------------+
        |                                 |                                 |
        v                                 v                                 v
 [1] SKILL LOADER                  [2] MCP CLIENT                    [3] HOOK RUNNER
 reads SKILL.md from the           spawns configured MCP             fires on lifecycle
 host's own skills dir:            servers over stdio                events
   .claude/skills/  (most)                                           TIER 1 ONLY
   .agents/skills/  (Zed)                                            absent on Zed,
                                                                     shaped differently
 progressive disclosure:                                             on each host
   1. name+desc at startup
   2. full body on activation
   3. references/ on demand
        |                                 |                                 |
        |                                 |                                 |
        v                                 v                                 v
 ===================== FREE CORE, LOCAL, BSL-1.1 SOURCE-AVAILABLE =====================
        |                                 |
 125 SKILL.md                      mindrian-os MCP server
  - larry-personality  <-- PERSONA  bin/mindrian-mcp-server.cjs
    ships HERE, not via                  |
    InitializeResult.instructions        +--> surface-detect.cjs   [D-05 SEAM]
    (D-03, already true)                 |      today: cli|desktop|cowork
  - 124 methodology skills               |      needed: + host + host-tier
    (D-08, the adoption engine)          |      via SDK getClientVersion()
                                         |
                                         +--> capability-registry.cjs
                                         |      {hooks, apps, tasks, scripts}
                                         |
                                         +--> tool-router.cjs  --> 33 tools live
                                         |         (36 with MINDRIAN_MCP_FIRST)
                                         |         governance enforced HERE (D-04)
                                         |
                                         +--> lib/core/navigation.cjs
                                         |      SINGLE SQL chokepoint
                                         |      typed edges + memory_event
                                         v
                                   room.db + room graph
                                   THE USER'S OWN DATA (D-08)
                                   never leaves this box (Canon Part 8)

 ================================= THE NETWORK BOUNDARY =================================
        the paid line. nothing below this line was ever on the user's disk (D-07)
                                         |
                          bin/mindrian-brain-mcp-client.cjs
                          local stdio SHIM, zero network code of its own
                                         |
                          lib/core/resolve-brain-key.cjs
                            env -> ~/.mindrian.env -> ./.env -> not-found
                                         |
                       key found? ------NO------> lib/core/tier0-messaging.cjs
                            |                     DIRECTOR_NOT_AVAILABLE
                           YES                    "Larry can still talk with you"
                            |                     ^ honest degradation, already built
                            v
                  lib/core/brain-client.cjs
                  Authorization: Bearer <key>   -- typed packets only, generic
                            |                      framework handles, never user content
                            v
 =================== PAID, HOSTED: mindrian-brain.onrender.com ===================
                            |
                  mcp-server-brain/lib/auth.cjs   [ENTITLEMENT, ALREADY BUILT]
                    Supabase brain_api_keys
                    plan: trial | pro | env
                    active -> grace(24h) -> expired -> revoked
                    brain_usage_log per call
                            |
                    req.brainPlan --> registerNeo4jTools(server, {plan})
                            |         ^ the ONE seam where per-plan capability
                            v           differentiation would attach (D-09)
              6 tools: brain_ask query schema search stats write
                            |
              Neo4j teaching graph + Pinecone vectors
              scouts / sentinels / curation  (D-09, not yet built)
              READ SERVICE ONLY -- never ingests user content (D-11, Canon Part 8)
```

Trace the primary Tier-0 use case: a user on Cursor types a question -> Cursor's skill loader has already surfaced `larry-personality`'s name+description at startup and now activates its body -> Larry's methodology reasoning calls `framework_run` on the local MCP server -> the tool handler enforces governance server-side and writes through `navigation.cjs` into room.db -> if the user has a Brain key, an enrichment call crosses the network boundary and hits `auth.cjs`, which validates the plan and meters the call; if not, `tier0-messaging.cjs` returns the honest sentinel and Larry continues without enrichment.

### Recommended distribution structure

```
skills/                     # canonical source of truth, 125 skills, stays put
  <skill-name>/
    SKILL.md                # spec-conformant frontmatter
    references/             # spec-sanctioned, progressive-disclosure tier 3
    scripts/                # spec-sanctioned
    assets/                 # spec-sanctioned

dist/                       # NEW: generated per-host bundles, never hand-edited
  claude-code/              # current plugin layout (skills/ + commands/ + hooks/ + .mcp.json)
  generic-claude-dir/       # .claude/skills/**  -- VS Code, Cursor, Goose, OpenCode,
                            #   Copilot, Codex, Gemini CLI, Roo Code, Amp, ...
  zed/                      # .agents/skills/**  -- FLAT ONLY, no nesting
```

Generate `dist/` from `skills/` with a build script. Do not maintain parallel copies -- that is the "N thin adapters over one core, forever" cost SEED-068 names, and the only way it stays cheap is if the adapters are *generated*.

### Pattern 1: Host detection through the MCP initialize handshake

**What:** Read the client's self-declared identity from the MCP `initialize` request instead of sniffing environment variables per host.
**When to use:** D-05's host axis. This is the one channel every MCP host must populate, because it is part of the protocol handshake.
**Status:** the SDK exposes it; MindrianOS does not currently call it. [VERIFIED: codebase]

```javascript
// node_modules/@modelcontextprotocol/sdk/dist/cjs/server/index.d.ts:125
//   getClientVersion(): Implementation | undefined;
// Implementation is { name, version } -- the clientInfo the host sent at initialize.
//
// Extension point: lib/mcp/surface-detect.cjs already owns capability derivation.
// Today it returns { surface, transport, capabilities } from env sniffing.
// D-05 needs it to also return { host, hostTier }.
//
// NOTE: getClientVersion() is on the low-level Server, reachable as
// mcpServer.server from the McpServer facade, and is only populated AFTER the
// initialize handshake completes. Boot-time ctx (built once, before any
// connection exists) cannot carry it -- same constraint register-core-tools.cjs
// already documents for sessionId, which arrives per-call via extra.sessionId.
```

**The planner must treat that timing note as a design constraint.** `registerCoreTools(server, ctx)` builds `ctx` once at boot. Host identity is not knowable then. Either derive host-tier lazily inside handlers, or register on the `initialize` completion, but do not plan a task that reads `getClientVersion()` at boot -- it will return `undefined` and the capability floor will silently claim Tier 0 for everyone.

### Pattern 2: Declare the capability floor in the spec's own `compatibility` field

**What:** Use the spec-defined optional `compatibility` field (max 500 chars) to declare per-skill host requirements, rather than inventing a MindrianOS-specific frontmatter key.
**When to use:** D-05 and D-02. The 16 hook-referencing skills and the 15 `disable-model-invocation` skills are the obvious first candidates.

```yaml
# Source: agentskills.io/specification -- the spec's own examples
compatibility: Designed for Claude Code (or similar products)
compatibility: Requires git, docker, jq, and access to the internet
```

This is a genuine find: the standard already provides the channel D-05 needs, and MindrianOS uses it on 0 of 125 skills. Reusing it beats adding a 64th non-spec key, and it is the only capability declaration a foreign host has any chance of reading.

### Pattern 3: Server-side governance in the tool handler (D-04)

**What:** Enforce gates, HITL shapes, and entitlement inside the MCP tool handler, never in a client hook.
**Status:** already the pattern. `lib/mcp/tools/*.cjs` handlers call through `lib/core/navigation.cjs`, and `lib/mcp/gate-render.cjs` owns the gate ladder including `renderViaText`. The CIRS `connectors` export on every tool module is the born-wired declaration Part 11 requires.
**What this phase adds:** nothing structural. The gap is only that three write handlers are flag-gated off (Gap D).

### Anti-Patterns to Avoid

- **Building a second host/capability detector.** `surface-detect.cjs` exists and is already the chokepoint. A parallel `host-detect.cjs` recreates the exact three-independent-guessers bug that both `resolve-brain-key.cjs` and `active-plugin-root.cjs` were written to eliminate, and both files document that history in their headers. Extend, do not add.
- **Local license-key enforcement.** SEED-069 forbids it explicitly, and BSL-1.1 already does the legal work. Any plan task proposing a local check is out of bounds.
- **Gating a `/mos:` methodology run on a paid check.** D-10. The tell that a plan has gone wrong.
- **Mechanically moving all 63 non-spec keys under `metadata:`.** The spec requires string values; several MindrianOS keys are arrays or nested objects. This produces invalid output.
- **Treating SEED-068's 11-host matrix as current.** It is 10 days old and the ecosystem roughly quadrupled. Plan against the ~45-client list.
- **Reading Zed's 50KB budget as a risk.** Measured at 25% consumption. Do not spend a task on optimizing it; spend a task on a regression check that keeps it under budget as skills are added.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Locating the plugin install on a foreign host | A new per-host root resolver | `lib/core/active-plugin-root.cjs` with `MINDRIAN_OS_ROOT` (precedence #1, already the documented escape hatch) | Four-level precedence chain, pre-release-tolerant version sorting, env-aware HOME. Written after a real wrong-version incident. |
| Finding the Brain key | Any new key lookup | `lib/core/resolve-brain-key.cjs` | Single resolver, three-source precedence, POSIX 0600 permission gate, `Authorization:`/`Bearer ` prefix normalization added after a live 401 incident. |
| The no-key / degraded response shape | A new sentinel | `lib/core/tier0-messaging.cjs` | The `DIRECTOR_NOT_AVAILABLE` wire shape is byte-locked and consumed by the shim, Larry's prose surface, and the doctor's Class-M smoke check. |
| Capability derivation per host | A new capability map | `lib/mcp/surface-detect.cjs` + `lib/mcp/capability-registry.cjs` | `CAPABILITY_MAP` already exists and already gates `{hooks, apps, tasks, scripts}`. D-05 adds an axis to it. |
| Honest degradation UX | A new fallback convention | `lib/mcp/gate-render.cjs::renderViaText` | D-05 names it directly. It is the existing no-silent-skip precedent. |
| SKILL.md frontmatter parsing | A regex | `gray-matter` (already a dependency) | Handles folded scalars (`description: >`), which several skills use, and multiline blocks a regex will truncate. I hit exactly this bug mid-research: a naive regex undercounted the catalog by 33%. |
| Skill spec validation | npm `skills-ref` | An in-repo `scripts/check-skill-spec.cjs` using `gray-matter` | See Package Legitimacy Audit. The npm package is unaffiliated; the official one is Python and off-stack. |
| Entitlement, key lifecycle, metering | Anything new | `mcp-server-brain/lib/auth.cjs` | Trial-to-grace-to-expired lifecycle, caching, usage logging, and Supabase-outage fallback are all built and running. |
| Born-wired tool declaration | A new registry | The `connectors` export + `scripts/build-connector-registry.cjs` | Canon Part 11. `data/mcp-tool-connectors.json` is generated, never hand-edited. |

**Key insight:** the reason this phase looks large and is actually small is that MindrianOS has already been building toward it for ~100 phases without naming it. Every chokepoint D-01 through D-13 needs -- one root resolver, one key resolver, one capability map, one degradation renderer, one navigation chokepoint, one auth middleware -- exists, is documented, and was usually written in response to a real incident. The work is connecting them to a host axis, not creating them.

## Corpus Consult: langtalks-graph-expert

Mandatory per CLAUDE.md. MCP tools were stripped from this agent's toolset (the documented upstream bug), so the server at `/home/jsagi/langtalks-graph-expert/server/mcp_server.py` was driven directly over stdio JSON-RPC. Corpus state at query time: 4,628 nodes / 11,113 edges / 36 sources, `graph.json` last modified 2026-07-27T23:59Z, clustering coverage 99.98%.

### Questions the corpus ANSWERED

| Question | Result | Evidence |
|----------|--------|----------|
| Is SKILL.md progressive disclosure a real cross-harness pattern, or a MindrianOS workaround? (prior finding, re-verified) | **Confirmed, independently.** `Skills --builds_on--> Progressive Disclosure` (1 hop, EXTRACTED). | `get_entity("Progressive Disclosure")` cites *"Agent Skills, Explained: An Open Standard Meets Graph Engineering in Memgraph"* (Memgraph, 2026-02-16) and LangTalks ep. 69. |
| Is Agent Skills genuinely an open standard, per a source independent of Anthropic and agentskills.io? | **Yes.** The corpus's own `agent_skills` entity resolves to a Memgraph-authored source whose *title* asserts it: "An Open Standard Meets Graph Engineering in Memgraph" (2026-02-16), plus a second Memgraph source (2026-02-18). | This is a **third independent corroboration** of SEED-068's premise upgrade: Anthropic (originator), agentskills.io (spec site), and Memgraph (unrelated vendor building on it). |
| Is MCP's documented weakness context overload rather than proactivity? (prior finding, re-verified) | **Confirmed.** `MCP --critiques--> Context Overload` (1 hop, EXTRACTED). | And the remedy edge is explicit: `MCP --critiques--> Context Overload <--alternative_to-- Lazy loading` (2 hops). Lazy loading is the corpus's named answer, which is exactly what progressive disclosure is. |
| How do Agent Skills and MCP relate as distribution channels? | `Agent skills --compares_to--> MCP` (1 hop, EXTRACTED). The corpus models them as **alternatives being weighed against each other**, not as layers of one stack. | Relevant to D-01/D-02: the corpus's framing supports the two-tier split (skills as one channel, MCP as another) rather than a single unified pipe. |
| Are tool descriptions treated as a context-engineering surface? | Yes, weakly. `MCP` and `tool description` co-occur in LangTalks ep. 55 "Context Engineering" (2 hops via shared episode). | Supports D-03's "tool descriptions are load-bearing product copy," but the corpus does not go further than co-occurrence. Treat as supporting, not decisive. |
| Is skill portability / interoperability discussed? | Weakly. `SKILL.md --part_of--> Files --mentioned_in_episode--> "50 - A2A protocol" <--mentioned_in_episode-- Interoperability` (3 hops, episode-mediated). | A 3-hop episode-mediated path is a co-occurrence signal, not a claim. Do not cite this as evidence for anything specific. |

### Questions the corpus did NOT answer (honest gaps)

These came back empty. Stating them plainly rather than papering over them, per the CLAUDE.md rule.

| Question | Result |
|----------|--------|
| What "open core" / "network boundary as moat" patterns exist for agent tooling or MCP servers specifically? | **`get_entity("Open Core")` -> found: False, 0 citations.** Also empty: `Business Model`, `Moat`, `Monetization`, `Licensing`, `Entitlement`. The corpus has **no commercial-strategy coverage at all.** D-07 gets zero corpus grounding. |
| Are there server-side governance / entitlement enforcement patterns for MCP tool handlers? | **Effectively no.** `Authentication` exists (5 citations) but `relationship_path(MCP, Authentication)` returns `found: false` -- the API surfaced only a reverse `compares_to` edge with no forward path. `OAuth` is absent entirely. D-04 and D-09's server-side enforcement question is **not in the corpus.** |
| Is there corpus evidence on MCP `instructions` field adoption across hosts, corroborating or contradicting SEED-068's matrix? | **Nothing.** No `instructions`-field entity, no host-comparison edges. `relationship_path("Claude Code", "OpenCode")` -> `found: false`. The corpus does not model the harness landscape. SEED-068's host matrix stands or falls on its own primary-source research; the corpus neither supports nor contradicts it. |
| How do cross-harness distributions structure client-side vs server-side? | The open-ended `query_relationship` returned 977 hits, truncated, dominated by generic `MCP`/`Client`/`Server` nodes from unrelated episodes. **No usable signal.** This confirms CLAUDE.md's guidance that `relationship_path` is the reliable tool and `query_relationship` is breadth-only. |

**Net corpus verdict:** the langtalks corpus is a strong, independent source for the *technical* half of this phase (skills, progressive disclosure, MCP's context-overload weakness, lazy loading as the remedy) and has **zero coverage of the commercial half.** SEED-069's D-07 through D-13 are navigator judgment calls that the corpus can neither validate nor challenge. The planner should not read that silence as either endorsement or objection.

## Ecosystem State: SEED-068's Host Matrix Is Materially Stale

SEED-068's matrix was verified 2026-07-18 across 11 hosts, and it explicitly flagged the vendor-CLI pass (Gemini CLI, Codex CLI, Qwen Code) as "still outstanding at time of writing." That gap is now closed, and the ecosystem is roughly 4x larger.

**agentskills.io's client showcase now lists approximately 45 products** shipping Agent Skills support, each with a documentation link. [CITED: agentskills.io]

| Category | Clients |
|----------|---------|
| **In SEED-068's matrix, confirmed still listed** | Claude Code, VS Code, GitHub Copilot, Cursor, Goose, OpenCode |
| **Closes SEED-068's outstanding vendor-CLI pass** | **Gemini CLI** (Google), **OpenAI Codex**, Mistral AI Vibe |
| **Not in SEED-068's matrix at all (new reach)** | JetBrains Junie, Amp, Roo Code, Letta, OpenHands, Factory, Kiro (AWS), Snowflake Cortex Code, Databricks Genie Code, Spring AI, Tabnine, Firebender, TRAE (ByteDance), Ona, Emdash, Mux (Coder), Piebald, Superconductor, Workshop, fast-agent, nanobot, pi, VT Code, Deep Code, ZeroClaw, Autohand, Laravel Boost, Pulumi Neo, Qodo, Command Code, Agentman, Vita, Google AI Edge Gallery |
| **In SEED-068's matrix, NOT on the showcase** | Zed (ships skills, documented at zed.dev/docs/ai/skills, just not listed on agentskills.io), Cline, Grok Build, Windsurf/Devin, Continue, Aider (Aider correctly so -- no MCP client) |

**Strategic read for the planner:** SEED-068's "whoever wins the harness war, MindrianOS wins, because it is not in the war" got materially stronger in 10 days. The bet is no longer on ~11 hosts; it is on a standard that Google, OpenAI, Microsoft, JetBrains, ByteDance, AWS, Snowflake, Databricks and Mistral have all independently shipped. **The build-order sequencing question is now less about which host and more about which *host families* one generated bundle covers.** The `dist/generic-claude-dir/` bundle in the structure above likely serves 30+ of these with a single artifact, which is a materially better return than SEED-068's per-host adapter sequencing implies.

### Corrections and confirmations to SEED-068's specific claims

| SEED-068 claim | Status 2026-07-28 | Evidence |
|----------------|-------------------|----------|
| "SKILL.md is an open standard, originally developed by Anthropic, released as an open standard" | **CONFIRMED verbatim** | agentskills.io/overview, exact phrasing. Repo `agentskills/agentskills`, Apache-2.0, 23.5K stars. [CITED] |
| "Cline PR #11131 implements `instructions` and is still OPEN, needing only a rebase" | **CONFIRMED, with a caveat** | `gh api repos/cline/cline/pulls/11131`: `state: open`, `merged: false`, `draft: false`, `closed_at: null`, created 2026-05-29, **last updated 2026-06-01**. Open, yes -- but untouched for ~2 months. Upstreaming remains viable; expect no momentum from upstream. [VERIFIED: GitHub API] |
| "Zed: 50KB total catalog budget, overflow silently dropped, ~400 bytes/skill at 124 skills, MEASURE BEFORE SHIPPING" | **MEASURED. Passes with 3.9x headroom. One factual correction.** | MindrianOS total name+description = **12,966 bytes = 25% of budget**. Mean **104 bytes/skill**, not ~400. Largest single skill 920 bytes (`trending-to-absurd`). Correction: Zed's docs say overflow skills are "dropped from the catalog **with a warning in the UI**," not silently. [VERIFIED: codebase measurement] [CITED: zed.dev/docs/ai/skills] |
| "Zed: skills only, `.agents/` not `.claude/`, and NO hooks" | **CONFIRMED on paths and hooks; CORRECTED on MCP** | Zed loads from `~/.agents/skills/` and `<worktree>/.agents/skills/`, flat only, no nested folders, no remote/custom search paths. No hooks documented. **But Zed does support MCP servers** (Settings -> AI -> MCP Servers; also forwarded to External Agents via ACP), so Tier 0 = skills + MCP holds on Zed. [CITED: zed.dev/docs/ai/skills; zed.dev/docs/assistant/model-context-protocol] |
| "MindrianOS's 132,000 lines of methodology / 124 SKILL.md + 111 commands + 9 subagents" | **Off by one on two counts** | 125 skills, 112 commands, 9 agents. Total SKILL.md bytes on disk: 1,173,273. |
| "Tier 0 = skills + MCP server (~30 tools)" | **Already met: 33 live tools** | See baseline. |

### Formal spec facts the planner needs

From agentskills.io/specification, current as of 2026-07-28. [CITED]

| Field | Required | Constraint |
|-------|----------|------------|
| `name` | **Yes** | 1-64 chars. Lowercase alphanumeric + hyphens only. No leading/trailing hyphen, no consecutive hyphens. **Must match the parent directory name.** |
| `description` | **Yes** | 1-1024 chars, non-empty. Should state both what the skill does and when to use it. |
| `license` | No | License name or reference to a bundled license file. Spec's own example includes `Proprietary. LICENSE.txt has complete terms`. |
| `compatibility` | No | Max 500 chars. Environment requirements: intended product, system packages, network access. |
| `metadata` | No | Map from string keys to **string** values. The sanctioned home for client-specific extensions. |
| `allowed-tools` | No | **Space-separated string.** Marked **Experimental**; support may vary between implementations. |

Progressive-disclosure budgets: metadata ~100 tokens per skill loaded at startup for all skills; instructions **under 5,000 tokens recommended** when activated; resources loaded on demand. Keep `SKILL.md` under **500 lines**; move detail to `references/`. Keep file references one level deep. Body content has no format restrictions.

## Common Pitfalls

### Pitfall 1: Planning against SEED-068's 11-host matrix

**What goes wrong:** the plan sequences per-host adapters for a 2026-07-18 world that no longer exists, and misses that one generated `.claude/skills/` bundle now covers 30+ clients.
**Why it happens:** the seed reads like a spec (it says so itself), and it is only 10 days old.
**How to avoid:** plan bundle *families*, not hosts. Treat the ~45-client showcase as the reach number.
**Warning sign:** a PLAN.md task named after a single vendor that produces an artifact no other vendor consumes.

### Pitfall 2: Treating the entitlement mechanism as unbuilt

**What goes wrong:** the plan spends a wave designing auth, key storage, and metering that already run in production, and risks producing a second, drifting implementation.
**Why it happens:** SEED-069 genuinely marks it OPEN, and SEED-069 never looked at `mcp-server-brain/`.
**How to avoid:** read `mcp-server-brain/lib/auth.cjs` before writing any entitlement task. The only genuinely open question is what `plan` gates.
**Warning sign:** a task that introduces a new key format, a new table, or a new auth header.

### Pitfall 3: Reading `getClientVersion()` at boot time

**What goes wrong:** host detection silently returns `undefined`, every host is classified Tier 0, and the capability floor lies -- which is the exact failure D-05 exists to prevent.
**Why it happens:** `registerCoreTools(server, ctx)` builds `ctx` once at boot, and it is the natural place to put detection. But `clientInfo` only exists after the initialize handshake.
**How to avoid:** derive host-tier lazily per call, mirroring the `extra.sessionId` precedent that `register-core-tools.cjs` already documents in its header for exactly this reason.
**Warning sign:** a task that adds `host` to the boot-time `ctx` object.

### Pitfall 4: Shipping Tier 0 with no write path

**What goes wrong:** foreign-host users get a read-only product, decide MindrianOS does not work, and never reach the paid tier. This is D-10's "free core too thin" failure arriving through an unexpected door.
**Why it happens:** `MINDRIAN_MCP_FIRST` defaults off and the gap is invisible on Claude Code, where hooks and slash commands do the writing.
**How to avoid:** make MCP-first the default once host detection can identify a non-Claude-Code host, or declare the write path Tier-1-only and say so loudly in the capability floor.
**Warning sign:** a Tier-0 acceptance test that only exercises reads.

### Pitfall 5: The `metadata:` migration producing invalid frontmatter

**What goes wrong:** 63 non-spec keys get moved under `metadata:`, several of which are arrays or nested objects, and the result fails validation on a stricter host than the one it was tested against.
**Why it happens:** "move the extra keys where the spec says extra keys go" reads as mechanical.
**How to avoid:** `metadata` values must be strings. Decide per key: serialize, keep top-level, or drop. Or scope the wave to string-valued keys only.
**Warning sign:** a task described as "move non-spec frontmatter under metadata" with no per-key inventory.

### Pitfall 6: Installing npm `skills-ref`

**What goes wrong:** an unaffiliated, source-repo-less, 7-month-stale TypeScript package enters a CJS-only repo and is trusted to gate skill validity.
**Why it happens:** the spec says `skills-ref validate ./my-skill`; the repo is Node; `npm install skills-ref` resolves.
**How to avoid:** the official validator is on **PyPI**. Build the in-repo CJS check with `gray-matter`.
**Warning sign:** `skills-ref` appearing in `package.json`.

### Pitfall 7: Parsing SKILL.md frontmatter with a regex

**What goes wrong:** folded scalars (`description: >`) and multiline blocks get truncated, and every downstream measurement is wrong.
**Why it happens:** it looks like simple YAML.
**How to avoid:** `gray-matter`, already vendored.
**Evidence:** this bit me during this research. A naive regex measured the Zed catalog at 8,752 bytes; `gray-matter` measured 12,966. A 33% undercount on the exact number SEED-068 called a hard constraint.

### Pitfall 8: Conflating the four axes

**What goes wrong:** a plan says "Tier 1 users get X," which is ambiguous across host-capability tier, commercial tier, Tri-Polar surface, and model capability.
**Why it happens:** D-12 warns about two axes. There are actually four in play in this repo.
**How to avoid:** require every plan task touching tiers to name which axis it means.
**Warning sign:** the bare words "tier 1" with no qualifier.

## Code Examples

### Measuring the Zed catalog budget (the SEED-068 "MEASURE BEFORE SHIPPING" gate)

```javascript
// Verified working 2026-07-28. Result: 12,966 bytes = 25% of Zed's 50KB budget.
// Source of the 50KB figure: https://zed.dev/docs/ai/skills
const fs = require('fs'), cp = require('child_process'), matter = require('gray-matter');
const files = cp.execSync('find skills -name SKILL.md').toString().trim().split('\n');
let total = 0;
for (const f of files) {
  const fm = matter(fs.readFileSync(f, 'utf8')).data || {};
  total += Buffer.byteLength(String(fm.name || '') + String(fm.description || ''), 'utf8');
}
console.log(total, 'bytes /', 51200, '=', Math.round(total / 51200 * 100) + '%');
```

### Validating the spec's hard rules

```javascript
// The three hard failures found: 7 missing name, 1 bad charset, 1 name != dirname.
// Constraints from https://agentskills.io/specification
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;   // no leading/trailing/consecutive hyphens
function validateSkill(skillMdPath) {
  const path = require('path');
  const fm = matter(fs.readFileSync(skillMdPath, 'utf8')).data || {};
  const dir = path.basename(path.dirname(skillMdPath));
  const errs = [];
  if (!fm.name) errs.push('missing required `name`');
  else {
    if (!NAME_RE.test(String(fm.name)) || String(fm.name).length > 64) errs.push('`name` charset/length');
    if (String(fm.name) !== dir) errs.push('`name` must match parent directory');
  }
  if (!fm.description) errs.push('missing required `description`');
  else if (String(fm.description).length > 1024) errs.push('`description` over 1024 chars');
  const at = fm['allowed-tools'];
  if (at !== undefined && typeof at !== 'string') errs.push('`allowed-tools` must be a space-separated string');
  return errs;
}
```

### Enumerating the live MCP tool surface (the Tier-0 count)

```bash
# Definitive, protocol-level. Beats grepping registration calls, which misses
# conditionally-registered tools. This is how the 33-vs-36 gap was found.
#   default                        -> 33 tools
#   MINDRIAN_MCP_FIRST=desktop     -> 36 tools (+graph_write, memory_event, artifact_file)
node bin/mindrian-mcp-server.cjs   # then speak JSON-RPC: initialize -> notifications/initialized -> tools/list
```

### The existing entitlement seam (do not rebuild)

```javascript
// mcp-server-brain/lib/auth.cjs -- what validateApiKey() attaches to every request:
//   req.brainPlan    'trial' | 'pro' | 'env'
//   req.brainEmail
//   req.brainKeyId   for brain_usage_log
//   req.brainStatus  'active' | 'grace'
//
// mcp-server-brain/server.cjs:38 -- the ONE place plan currently reaches a tool:
registerNeo4jTools(server, { plan: req.brainPlan });
//
// D-09's per-plan capability differentiation attaches HERE. Nothing upstream
// of this line needs to change.
```

## Runtime State Inventory

This is not a rename or migration phase, but it does change how an already-deployed artifact is packaged and distributed, so the same discipline applies. Each category answered explicitly.

| Category | Items found | Action required |
|----------|-------------|------------------|
| **Stored data** | Supabase `brain_api_keys` (live, ~10+ active keys per the autopsy note in `auth.cjs`) and `brain_usage_log`. Local `room.db` per user room. **Neither changes shape in this phase** -- no new columns are needed unless the planner chooses to resolve per-plan gating now. | None, unless D-09 per-plan gating is scoped into this phase, in which case: a `plan`-to-capability mapping, most likely as config on the Brain server rather than a schema change. |
| **Live service config** | `mindrian-brain.onrender.com` (Render, `mcp-server-brain/render.yaml`). Env vars `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `BRAIN_API_KEYS` fallback, Neo4j and Pinecone credentials -- all set in the Render dashboard, **not in git**. | None for Tier-0 packaging work. If per-plan gating ships, the mapping must be deployed to Render, and that deploy is not covered by `scripts/release.sh`'s five gates. Flag as a sixth surface. |
| **OS-registered state** | None. MindrianOS registers no OS-level tasks, services, or daemons. `.claude/daemon.lock` and `daemon.status.json` exist under `~/.claude/` but belong to the GSD tooling, not to MindrianOS. | None -- verified by inspection of `hooks/`, `scripts/`, and the absence of any systemd/launchd/Task Scheduler artifacts. |
| **Secrets / env vars** | `MINDRIAN_BRAIN_KEY` (user-side, resolved from env -> `~/.mindrian.env` -> `./.env`). `MINDRIAN_OS_ROOT`, `MINDRIAN_TRANSPORT`, `MINDRIAN_MCP_FIRST`, `CLAUDE_SURFACE`, `COWORK_SESSION_ID`. **`MINDRIAN_MCP_FIRST` changes semantics if this phase makes MCP-first the default on foreign hosts** -- existing users who set it explicitly must not regress. | Do not rename `MINDRIAN_BRAIN_KEY`; `resolve-brain-key.cjs` and users' `~/.mindrian.env` files both depend on the exact string. If MCP-first defaults change, preserve explicit-set behavior and document the new default. |
| **Build artifacts / installed packages** | `~/.claude/plugins/cache/<marketplace>/mos/<version>/` per installed version, plus `~/.claude/plugins/installed_plugins.json`. Vendored `node_modules` ships with the plugin. A new `dist/` bundle would be a **new** artifact class with no existing update path. | If `dist/` bundles ship, they need an install and update story per host family. Zed and VS Code have no `claude plugin update` equivalent, so a stale foreign-host install has no self-heal path. This is a genuine new-surface risk the planner must address, not assume. |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything (`engines: >=22.5.0`) | yes | present, meets floor | - |
| `@modelcontextprotocol/sdk` | MCP server, host detection via `getClientVersion()` | yes | 1.29.0 installed, 1.30.0 latest | Current version is sufficient; no upgrade required for this phase |
| `gray-matter` | Skill frontmatter validation | yes | ^4.0.3, vendored | - |
| `zod` | MCP tool schemas | yes | ^3.25.76 | - |
| `gh` CLI | Verifying Cline PR #11131 and upstream state | yes | authenticated, GitHub API reachable | Manual web check |
| Python 3 + `pip` | Official PyPI `skills-ref` validator, if used | yes (system python3, `pip install` works) | - | **In-repo CJS validator (recommended)** -- avoids adding a toolchain |
| `slopcheck` | Package legitimacy gate | yes (installed during research) | CLI has no `install --json`; use bare `slopcheck install <pkg>` | - |
| `langtalks-graph-expert` MCP | Mandatory corpus consult | yes, **but MCP tools stripped from this agent** | server at `/home/jsagi/langtalks-graph-expert/server/mcp_server.py` | **Used:** direct stdio JSON-RPC via the venv python. Works; the planner and executor should use the same fallback. |
| Live Brain (`mindrian-brain.onrender.com`) | End-to-end entitlement testing | **not verified in this session** | - | Local `DIRECTOR_NOT_AVAILABLE` path is testable without it; `BRAIN_API_KEYS` env fallback exists for local server runs |
| Foreign hosts (VS Code, Cursor, Goose, Zed) | Actually validating Tier 0 | **not verified -- none installed on this machine** | - | **No fallback.** See below. |

**Missing dependencies with no fallback:**
- **No foreign host is installed on this machine.** Every Tier-0 portability claim in this research is derived from specifications and from static analysis of the repo, not from a live run on VS Code, Cursor, Goose, or Zed. The planner must include at least one `checkpoint:human-verify` task where a human installs one non-Claude-Code host and confirms the skill catalog loads and the MCP server connects. Without it, this phase can ship a plausible-looking bundle that no one has ever seen work.
- **Live Brain entitlement path unverified this session.** If per-plan gating is scoped in, it needs a human-verified end-to-end check against the deployed Render service.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. Section required.

### Test framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` + `node:assert` (`lib/**/*.test.cjs`), plus bash harnesses `tests/run-all-<phase>.sh` |
| Config file | None -- convention-based. Test files sit beside their subject as `*.test.cjs`. |
| Quick run command | `node lib/<area>/<file>.test.cjs` (single file, seconds) |
| Full suite command | `bash tests/run-all-234.sh` (to be created by this phase, per repo convention) |
| Existing gates to extend | `node scripts/build-connector-registry.cjs --check`, `node scripts/check-shape-declaration.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`, `scripts/verify-release` |

### Phase requirements to test map

| Decision | Behavior | Test type | Automated command | File exists? |
|----------|----------|-----------|-------------------|--------------|
| D-01/D-02 | All 125 skills pass Agent Skills spec hard validation | unit | `node scripts/check-skill-spec.cjs --check` | Wave 0 -- new gate |
| D-02 | Zed catalog stays under 50KB | unit | `node scripts/check-skill-spec.cjs --catalog-budget` | Wave 0 -- fold into the same gate |
| D-03 | `InitializeResult.instructions` is never populated | integration | `node lib/mcp/no-instructions.test.cjs` -- assert `initialize` result has no `instructions` key | Wave 0 -- new. Currently passing by accident; this locks it. |
| D-03 | Persona ships as a skill, not via MCP | unit | assert `skills/larry-personality/SKILL.md` exists and is spec-valid | Wave 0 -- fold into spec gate |
| D-03 | No tool description is a bare label | unit | assert every `tools/list` description >= a floor (suggest 120 chars) | Wave 0 -- new |
| D-04 | Governance enforced in tool handlers, not hooks | unit | existing `connectors` export + `check-shape-declaration.cjs` | exists |
| D-05 | Host detected and stated; capability floor honest on both axes | integration | `node lib/mcp/host-tier.test.cjs` -- drive `initialize` with distinct `clientInfo.name` values, assert the reported floor differs | Wave 0 -- new |
| D-05 | Tier-0 write path present (Gap D) | integration | assert `tools/list` on a non-Claude-Code `clientInfo` includes `graph_write`, `memory_event`, `artifact_file` | Wave 0 -- new |
| D-06 | No proprietary content in any SKILL.md | manual-only | human review; not mechanically decidable | n/a -- `checkpoint:human-verify` |
| D-08/D-09 | Free core has zero network surface | unit | adversarial grep: no network tokens in `lib/mcp/tools/*.cjs`, `lib/core/navigation.cjs`, `resolve-brain-key.cjs`. **This pattern already exists** (Canon Part 8 scans documented in `bin/mindrian-brain-mcp-client.cjs`). | pattern exists, needs a 234 instance |
| D-09 | Brain tools return `DIRECTOR_NOT_AVAILABLE` with no key | unit | existing `lib/core/tier0-messaging` tests | exists |
| D-10 | No `/mos:` run gated on a paid check | unit | grep: no `resolve-brain-key` / `brainPlan` reference in any methodology command or skill execution path | Wave 0 -- new, cheap, high-value |
| D-11 | Canon Part 8 holds | unit | existing Part 8 adversarial scans | exists |
| D-12 | Axes not conflated | manual-only | plan-checker review | n/a |
| Portability | 51 skills no longer hardcode `${CLAUDE_PLUGIN_ROOT}` | unit | grep count against a declining allowlist | Wave 0 -- new |

### Sampling rate

- **Per task commit:** `node scripts/check-skill-spec.cjs --check` plus the single `*.test.cjs` for the touched area.
- **Per wave merge:** `bash tests/run-all-234.sh` plus `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs --check`.
- **Phase gate:** `node scripts/doctor.cjs --acceptance` green, plus the human-verify checkpoint on at least one foreign host, before `/gsd-verify-work`.

### Wave 0 gaps

- [ ] `scripts/check-skill-spec.cjs` -- spec validation + Zed catalog budget + `${CLAUDE_PLUGIN_ROOT}` census. Covers D-01, D-02, portability. Build with `gray-matter`, no new deps.
- [ ] `lib/mcp/no-instructions.test.cjs` -- locks D-03's currently-accidental compliance.
- [ ] `lib/mcp/host-tier.test.cjs` -- D-05 two-axis floor + Gap D write-path assertion.
- [ ] `lib/mcp/tool-description-floor.test.cjs` -- D-03 tool-descriptions-as-instructions.
- [ ] `tests/run-all-234.sh` -- phase harness, per repo convention.
- [ ] No framework install needed. `node:test` is built in.

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, therefore treated as enabled.

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** | Bearer token against Supabase `brain_api_keys`, already implemented in `mcp-server-brain/lib/auth.cjs`. Do not reimplement. |
| V3 Session Management | partial | MCP `sessionId` arrives per-call via `extra.sessionId`; `lib/mcp/session-registry.cjs` exists. No browser sessions, no cookies. |
| V4 Access Control | **yes** | This is the heart of D-04 and D-09. Today: binary valid/invalid at the Brain edge. `req.brainPlan` is threaded but not enforced per capability. **If this phase adds per-plan gating, it must be enforced server-side in the tool handler, never client-side** -- otherwise it is exactly the patchable local check SEED-069 forbids. |
| V5 Input Validation | **yes** | `zod` schemas on every MCP tool. Already the pattern. Any new tool inherits it. |
| V6 Cryptography | no | No crypto operations in scope. Key material is opaque bearer tokens; TLS is handled by Render. |
| V7 Error Handling / Logging | **yes** | `brain_usage_log` records `api_key` and `tool_name`. Canon Part 8 requires that no user content reach the log. The existing `auth.cjs` autopsy note (`docs/autopsies/2026-04-28-install-cache-drift-incident.md`) documents a prior silent-logging failure -- a fire-and-forget `.catch()` swallowed a `PGRST204` column error and 452 requests logged nothing. Any logging change in this phase must not restore that silent-failure shape. |
| V8 Data Protection | **yes** | `resolve-brain-key.cjs` enforces 0600 on key files (POSIX; documented no-op on Windows). If `dist/` bundles carry any config, they must not carry keys. |
| V14 Configuration | **yes** | Distributing to N hosts multiplies config surface. Each `dist/` bundle is a new place a secret could accidentally land. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Secret leaking into a shipped `dist/` bundle or a SKILL.md | Information Disclosure | D-06 already forbids proprietary content in SKILL.md. Extend to a build-time scan of every generated bundle for key-shaped strings before it ships. |
| Client-side entitlement check that is trivially patched | Elevation of Privilege | Explicitly forbidden by SEED-069 and by D-07. Enforce at the Brain edge only. |
| Cross-ecosystem package confusion (npm vs PyPI `skills-ref`) | Tampering / Supply Chain | Documented above. Do not add either. In-repo CJS validator. |
| Skill body instructing a shell-out to an unresolved `${CLAUDE_PLUGIN_ROOT}` path | Tampering | On a foreign host the variable expands empty, so `${CLAUDE_PLUGIN_ROOT}/scripts/x` becomes `/scripts/x` -- an absolute path an attacker could plant. **This is a real security consequence of the 51-skill portability gap, not just a functional one.** Resolve to `MINDRIAN_OS_ROOT` and fail closed when unset. |
| Usage-log write failure swallowed by fire-and-forget | Repudiation | Prior incident on record. Any change to `logUsage` must surface failures. |
| Brain ingesting user content to justify pricing | Information Disclosure | Canon Part 8 + D-11. Existing adversarial network-token scans are the control. |

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| Pick a host runtime to fork or build on | Ship to an open skill standard that ~45 clients read | Standard released by Anthropic; ecosystem passed critical mass through H1 2026 | This is SEED-068's whole thesis, and it got stronger between 2026-07-18 and 2026-07-28. |
| SKILL.md as a Claude Code convention | SKILL.md as a published spec with hard validation rules and a reference validator | agentskills.io spec + `agentskills/agentskills` (Apache-2.0, 23.5K stars) | Turns "portability" from a judgment call into a checkable gate. This is why the gap list above is exact rather than a sample. |
| MCP `InitializeResult.instructions` as the persona channel (SEED-065) | Persona as a SKILL; `instructions` as a per-host enhancement only | SEED-068 supersedes SEED-065, 2026-07-18 | D-03. **Already the implemented state** -- MindrianOS never populated `instructions`. |
| Client hooks for governance | Server-side enforcement in MCP tool handlers | SEED-068 D-04 | Already the implemented state. |
| Open core enforced by license key in shipped code | Open core enforced at the network boundary, with a source-available license doing the legal work | SEED-069, 2026-07-18; BSL-1.1 adopted earlier in this repo | The two-server `.mcp.json` split already implements the network half; BSL-1.1 already implements the legal half. |
| Freemium MCP servers gating pro tools behind a local license key | Local stdio server free + hosted remote server with expanded tools | Emerging ecosystem pattern | [MEDIUM confidence] Secondary sources describe both patterns coexisting. SEED-069's variant is the hosted-split one, which is the more defensible of the two. |

**Deprecated / outdated in this repo's own thinking:**
- SEED-068's 11-host matrix -- superseded by the ~45-client showcase.
- SEED-068's "~400 bytes per skill" Zed estimate -- measured at 104.
- SEED-068's "overflow silently dropped" on Zed -- Zed warns in the UI.
- SEED-069's "entitlement mechanism is OPEN" -- built and in production.
- SEED-065's "lean on `instructions` + tool descriptions" -- half superseded by D-03; tool descriptions survive, `instructions` does not.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The ~45-client agentskills.io showcase implies most of those clients read `.claude/skills/`, so one generated bundle serves many | Ecosystem State | **Medium-high.** Only VS Code, Cursor, Goose, OpenCode and Claude Code were path-verified. Zed provably differs (`.agents/`). If more clients use custom paths, the "one bundle, many hosts" economics weaken and SEED-068's per-host adapter cost returns. **The planner should verify paths for the top 3 target hosts before committing to a bundle strategy.** |
| A2 | The three flag-gated write tools are the only significant Tier-0 functional hole | Gap D | Medium. Derived from `tools/list` diffing, which is authoritative for tool *presence*, but a tool can be present and still depend on a Claude-Code-only path at call time. Only a live foreign-host run settles this. |
| A3 | Freemium/open-core MCP precedent generalizes to MindrianOS's model | State of the Art | Low. It is corroborative color, not load-bearing. The langtalks corpus returned nothing, and the web sources are marketplace blogs, not primary research. D-07 is a navigator decision either way. |
| A4 | `getClientVersion()` reliably returns a distinguishable host identity across hosts | Pattern 1 | **Medium-high.** The SDK type exists and the protocol requires `clientInfo`, but nothing guarantees hosts send *distinguishable* or *stable* names, and some may send a generic SDK name. If unreliable, D-05's host axis needs a secondary signal (env sniffing per host, as `surface-detect.cjs` already does for surfaces). **Verify against at least two real hosts before building the tier map on it.** |
| A5 | Zed supports MCP servers, so Tier 0 (skills + MCP) holds there | Corrections table | Low-medium. Confirmed from Zed's MCP docs, but Zed's *skills* page does not mention MCP, and the two features may not compose the way Tier 0 assumes. |
| A6 | No local MCP tool reaches the Brain, so the free/paid separation is clean today | Baseline | Low. Verified by grep -- zero `lib/mcp/tools/*.cjs` require `brain-client`. But `lib/mcp/tool-router.cjs` does require `brain-router.cjs` for act-family commands, so the *router* has a Brain path even though the tool modules do not. The planner should confirm that path degrades correctly with no key. |
| A7 | `plan` is currently threaded but not enforced per capability | Baseline | Low. `registerNeo4jTools(server, {plan})` is the only downstream consumer found; whether `neo4j-tools.cjs` branches on it was not read in full. |
| A8 | 125 vs the seeds' 124 skills is a simple off-by-one, not a mis-scoped catalog | Baseline | Very low. Cosmetic. |

## Open Questions

1. **Does the phase resolve per-plan capability gating, or defer it?**
   - What we know: the entitlement substrate is complete; `req.brainPlan` reaches exactly one call site.
   - What is unclear: whether `trial` and `pro` should expose different Brain tool sets at all, or whether the free/paid line is purely key-vs-no-key.
   - Recommendation: **defer.** SEED-069 marks pricing OPEN and non-blocking, and the corpus has zero coverage. Ship the portability work; open a follow-up seed for tiered plans. Note that "key or no key" is already a complete two-tier commercial model and may be sufficient indefinitely.

2. **Should `MINDRIAN_MCP_FIRST` default on for non-Claude-Code hosts?**
   - What we know: without it, Tier 0 has no write path (Gap D).
   - What is unclear: whether the MCP-first write handlers were ever exercised outside Claude Code, and whether the flag's per-surface list semantics extend cleanly to a per-host list.
   - Recommendation: yes, gated on host detection landing first. Treat it as a D-05 consequence, not an independent decision. Preserve explicit user settings.

3. **What is the update path for a `dist/` bundle on a foreign host?**
   - What we know: Claude Code has `claude plugin update`; the release process has five lockstep gates around it.
   - What is unclear: VS Code, Cursor, Zed and Gemini CLI have no equivalent. A stale foreign install has no self-heal, and SEED-069 D-09 sells "curation and updates" as a paid capability -- which requires an update channel to exist.
   - Recommendation: resolve before shipping any bundle. This is the one place where the infrastructure play has a genuine structural weakness, and it sits directly on the paid value proposition.

4. **Does the 63-key non-spec frontmatter actually cause a failure anywhere?**
   - What we know: the spec defines six keys and does not forbid others; Claude Code tolerates all 63.
   - What is unclear: whether any target host rejects, warns on, or mis-parses unknown keys. No host was observed doing so.
   - Recommendation: **do not spend a wave on the `metadata:` migration until a real host is observed complaining.** Fix the 9 hard failures and normalize `allowed-tools` -- those are defensible on spec text alone. Treat the rest as speculative work.

5. **Is `${CLAUDE_PLUGIN_ROOT}` even reachable on foreign hosts?**
   - What we know: 51 skills and 51 commands use it; it is Claude-Code-only.
   - What is unclear: on hosts where the *command* layer does not exist at all, do those skill bodies ever execute their shell-out branches? If the shell-out is only reachable via a `/mos:` command that does not exist there, the exposure may be smaller than 51.
   - Recommendation: audit reachability before sizing the fix. It could be a 51-file job or a 10-file job. **This materially affects wave sizing and should be resolved during planning, not during execution.**

## Sources

### Primary (HIGH confidence)

- **Codebase, measured directly 2026-07-28** at `1.15.3-beta.51` -- skill/command/agent counts, spec validation of all 125 skills, Zed catalog byte measurement, live `tools/list` enumeration (33 default / 36 with flag), `InitializeResult` inspection, `.mcp.json`, `LICENSE`, `mcp-server-brain/lib/auth.cjs`, `lib/core/resolve-brain-key.cjs`, `lib/core/active-plugin-root.cjs`, `lib/core/tier0-messaging.cjs`, `lib/mcp/surface-detect.cjs`, `lib/mcp/capability-registry.cjs`, `lib/mcp/register-core-tools.cjs`, `lib/mcp/gate-render.cjs`, `data/connector-registry.json`, `docs/MOAT-MANDATE.md`, `hooks/hooks.json`
- **https://agentskills.io** -- overview, open-standard provenance, client showcase (~45 products), progressive-disclosure model
- **https://agentskills.io/specification** -- complete frontmatter contract, field constraints, progressive-disclosure budgets, `skills-ref` reference
- **https://zed.dev/docs/ai/skills** -- `.agents/skills/` paths, flat-only loading, 50KB catalog budget, drop-with-warning behavior, 1024-byte description advisory
- **GitHub API** (`gh api`) -- `agentskills/agentskills` repo metadata (Apache-2.0, 23,548 stars, updated 2026-07-28); `cline/cline` PR #11131 state (open, unmerged, created 2026-05-29, last updated 2026-06-01)
- **langtalks-graph-expert MCP corpus** (4,628 nodes / 11,113 edges / 36 sources, graph modified 2026-07-27) via direct stdio JSON-RPC -- `graph_stats`, `relationship_path`, `get_entity`. Positive and negative results both recorded above.
- **npm and PyPI registries** -- `@modelcontextprotocol/sdk` 1.30.0 latest / 1.29.0 installed; `skills-ref` PyPI 0.1.1 (official, `project_urls` -> `anthropics/agentskills`) vs npm 0.1.5 (unaffiliated)
- **`.planning/seeds/SEED-068`, `SEED-069`** and `234-CONTEXT.md` -- the locked decision set
- **`./CLAUDE.md`** and `.claude/includes/{architecture,moat,decisions,release-process}.md`

### Secondary (MEDIUM confidence)

- **https://zed.dev/docs/assistant/model-context-protocol** and Zed MCP extension docs -- Zed MCP server support, ACP forwarding to External Agents (corrects the implication that Zed is skills-only)
- **slopcheck** -- `[OK]` on npm `skills-ref` with a "no source repository linked" warning; the identity finding came from registry metadata comparison, not from slopcheck

### Tertiary (LOW confidence -- flagged, not relied upon)

- **mcp-marketplace.io/blog/free-vs-pro-mcp-server** and adjacent MCP-directory blogs -- freemium MCP patterns, local-stdio-plus-hosted-remote split, indicative price bands. Marketplace marketing content, not primary research. Used only as weak corroboration for A3; no decision rests on it.

## Metadata

**Confidence breakdown:**
- **Codebase baseline: HIGH.** Every count measured programmatically against the working tree. The tool count came from the MCP protocol itself, not from grepping registration calls, which is why the flag-gated write-tool gap surfaced at all.
- **Spec compliance gap list: HIGH.** All 125 skills validated against the published spec, not sampled. The one methodological correction (regex vs `gray-matter`) was caught and re-run.
- **Host ecosystem state: HIGH for the standard and the showcase, MEDIUM for per-host behavior.** agentskills.io and zed.dev are primary. But no foreign host is installed on this machine, so every portability claim is spec-derived and static-analysis-derived, never observed. This is the single largest caveat in the document.
- **Architecture / reuse targets: HIGH.** Read the actual chokepoint files, including their headers, which document the incidents that produced them.
- **Entitlement mechanism: HIGH.** Read `auth.cjs` end to end.
- **Pitfalls: HIGH.** Four of the eight are derived from things that already went wrong in this repo (documented in file headers and autopsies) or that went wrong during this research session.
- **Commercial precedent: LOW.** Corpus empty, web sources are marketplace blogs. Honestly thin. D-07 is a navigator judgment call and this research neither strengthens nor weakens it.
- **Pricing model: NOT RESEARCHED.** Deliberately. SEED-069 marks it OPEN and non-blocking; the corpus has zero coverage.

**Research date:** 2026-07-28
**Valid until:** ~2026-08-11 (14 days). The Agent Skills ecosystem is moving fast enough that SEED-068's matrix went materially stale in 10 days. Re-check the agentskills.io client showcase and Cline PR #11131 before executing any host-specific task. The codebase baseline is stable until the next phase touches `lib/mcp/` or `skills/`.
