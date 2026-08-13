# MindrianOS Plugin - Claude Code Project Guide

> **Repo:** MindrianOS-Plugin (commercial Claude Code + Cowork plugin)
> **Working directory:** /home/jsagi/dev/MindrianOS-Plugin/ (THE ONLY DEV WORKSPACE)
> **Related:** /home/jsagi/MindrianOS/ (V4 research + Claude Desktop design docs), /home/jsagi/MindrianV2/ (V2 production: 25 bot prompts, mode engine, intelligence pipeline)

---

## WORKSPACE GUARD (READ FIRST)

`~/.claude/plugins/mindrian-os/` is NOT a dev workspace. It is a plugin install cache. Every commit, every git operation, every GSD phase MUST run from `/home/jsagi/dev/MindrianOS-Plugin/`. Running from the plugin cache silently diverges from GitHub and from every user's install.

Before any session: `pwd` (confirm the dev workspace, not `~/.claude/plugins/*`), `git fetch origin main`, then check `git log origin/main..HEAD` (ahead) and `git log HEAD..origin/main` (behind). If the session-start hook trips the workspace guard, `cd ~/dev/MindrianOS-Plugin` and restart. Why this rule exists (the 2026-04-13 wrong-workspace incident): `docs/autopsies/2026-04-13-wrong-workspace-incident.md`.

**Also check for OPEN HANDOFFS before starting.** `.planning/` is `.gitignore`d (`.planning/*`), so GSD STATE.md does NOT travel between machines. A handoff from another machine can only reach you through a tracked file. Run `ls docs/*-HANDOFF-*.md` and read anything dated within the last week; work paused on one machine is invisible here otherwise. Currently open:

| Handoff | Subject |
|---|---|
| `docs/2026-08-11-HANDOFF-enactment-night-and-morning-runbook.md` | **START HERE.** The enactment night: v2.0.0-beta.5 released/verified on every surface (npm, tag, marketplace, cache, npx doctor), constitution enacted on a released build, /register + the honesty loop proven live, the operator morning runbook (7 sends, 2 clicks, the scripted admin sitting, Gate 0), the two-session coordination protocol, the traps paid for, and the langtalks grounding harvest. Supersedes the 2026-08-10 close-out runbook below. **UPDATE 2026-08-13: the admin sitting EXECUTED 2026-08-11** - alias collapse + self-loops + reverse-salient ingest all landed and verified (ENRICH-03 + CONTRACT-04 checked, SWEEP-02 refreshed in .planning/REQUIREMENTS.md; execution record + honest deviations in the brain repo's runbook doc; research trail in rethinking-mindrianos + mindrianOS/research). Still the operator's: 7 sends, dashboard clicks (suspend mindrian-brain, delete dead env var), Gate 0, the 7 index DROPs (needs Bolt/SSH - no DDL seam over HTTPS). |
| `docs/2026-08-10-HANDOFF-v2-close-out-runbook.md` | SUPERSEDED by the 2026-08-11 handoff above. The close-out runbook: all machine work done, the six-step operator ceremony (brain push -> Gate 0 -> v2.0.0-beta.1 cut -> post-release verification -> enrichment ceremony -> odds/ends), TODAY'S CRITICAL FINDING (beta.13's shipped Brain path never worked in production - the release is an outage fix), the paste-ready loop goal for a new session, and the traps already paid for. |
| `docs/brain-audit-2026-08-10/2026-08-10-HANDOFF-brain-service-audit.md` | The Brain SERVICE audit from the Windows machine (verbatim external record, em-dashes preserved). Settles: brain_query is NOT registered over HTTPS (BRAIN_HTTP_ADMIN never set on Render - the admin-KEY assumption in the 246/249 Lane B checkpoints is WRONG); text2cypher is one env var from executing model-authored raw Cypher uncapped; mindrian-brain is confirmed dead spend; four plugin tool descriptions still name the retired Pinecone/Neo4j backend; moat caps have dead config + a double-duty timeout var; the corrected 5-step PASS/FAIL/BLOCKED test prompt (section 12) SUPERSEDES earlier 3-call prompts; procedural memory named as the biggest open architecture gap. Open decisions in section 13 - the brain_query exposure call blocks the atomic-query architecture. |
| `docs/2026-08-10-HANDOFF-build-the-loop-milestone.md` | **THE MOST CRITICAL MILESTONE TO DATE (navigator, 2026-08-10): "Build the Loop" - the step that makes MindrianOS closest to a complete product.** Supersedes the tier0-removal PLAN (its evidence stands). Six phases, navigator-approved, grounded in same-day primary-source probes of BOTH graphs. Read this before any Brain-related work. |
| `docs/2026-08-09-HANDOFF-brain-envelope-and-egress-guard.md` | the Brain-unreadable outage, PR #2 (merged), PR #3 (merged), and `v1.16.0-beta.13` (RELEASED 2026-08-10: npm + tag + marketplace verified; bare `npx` now tracks the newest beta via @latest promotion in release.sh). Contains the `updatedToolOutput` contract verified against the Claude Code binary. |
| `docs/2026-08-09-HANDOFF-tier0-removal-milestone.md` | Tier 0 removal / hard-require the Brain. Evidence and blast-radius measurements still valid; its SEQUENCING is superseded by the build-the-loop handoff above. Section 6 (no always-on skill primitive) remains required reading. |

**Cross-repo:** the Brain itself lives in `jsagir/ProblemsWorthSolving-Brain`, whose own `CLAUDE.md` and `docs/2026-08-09-HANDOFF-brain-consumption-surface.md` carry the graph-side state. Changes there do not show up in this repo's history at all, so check both when Brain behaviour is in question.

---

## What Is This?

A commercial Claude Code + Cowork plugin. One command installs it (`claude plugin install mindrian-os@mindrian-marketplace`); the Brain is part of what installs -- a fresh install registers silently and Larry starts talking with graph-grounded methodology, no key ceremony required. A keyless or unreachable session gets an honest refusal, never a silent imitation. Two OPTIONAL and unrelated extras, kept apart here because conflating them has already cost a session: the **user's own room graph** can use Neo4j Aura (free tier, the user's data, their instance), and a **manual Brain key** is the override path for an operator identity, a paid tier, or troubleshooting silent registration. Full description in the Project section below.

## The Three Layers

| Layer | What | Where | Who Owns It |
|-------|------|-------|-------------|
| **Plugin** | Skills, commands, agents, hooks, pipelines | This repo (marketplace) | Open |
| **Brain** | Memgraph teaching graph + e5 vectors (1024-dim, local embed, no egress) + teaching intelligence (live numbers: docs/CORPUS-STATS.generated.md) | pws-brain-mcp.onrender.com (remote MCP) | Jonathan, SECRET IP |
| **Room** | User's workspace, entries, sub-rooms, LazyGraph, exports | User's local folder + their Aura | User owns their work |

## Tri-Polar Design Rule (STRONG DEFAULT)

Evaluate every feature through all three surfaces before it ships - a feature that only works on one leaves a gap on the other two install targets, so treat a skip as a deliberate, stated call, not an oversight.

| Surface | Interaction | What Matters Most |
|---------|-------------|-------------------|
| **Claude Code CLI** | Hooks fire, scripts run, `/mos:*` commands | Hook reliability, script execution, context budget, file output |
| **Claude Desktop** | Conversational: users talk to Larry | Larry personality, natural-language discoverability |
| **Cowork** | Multi-user, persistent agents, shared `00_Context/` | Shared room state, concurrent access, export quality |

---

## Canon Compliance Core

The full constitution is docs/MINDRIAN-CANON.md (load on demand); the phase-to-canon ledger (every phase declares `canon_parts:`) is docs/CANON-PHASE-MAP.md. These are the binding Parts every change must honor. Honor the line; deep-dive the link.

- **Part 8 - Graph Boundary (LOCAL -> BRAIN: NO).** User data NEVER egresses to the Brain; it serves generic methodology only. Writing user-specific bytes to Brain is a constitutional breach. Deep dive: docs/MINDRIAN-CANON.md (Part 8).
- **Part 3 - Tri-Context Decision Gate.** Material choices pass a LOCAL + BRAIN + SIGNAL gate returning APPROVE / REJECT (with reason) / DEFER, rendered through Shape F (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen). Deep dive: docs/MINDRIAN-CANON.md (Part 3).
- **Part 6 - Dog-Fooding Mandate.** The plugin is a venture in its own room; honoring its own canon here is the strong default, since a real violation surfaces as a CONTRADICTS edge against it. Deep dive: docs/MINDRIAN-CANON.md (Part 6).
- **Part 7 - Reuse Before Build.** Search the 25 methodology commands first and justify any net-new surface against them, since duplicating an existing command is the more common failure mode than missing a genuine gap. Deep dive: docs/MINDRIAN-CANON.md (Part 7).
- **Part 9 - Memory Locality.** SQL (room.db) is the local mind; Brain reasons over typed packets, never raw memory; only a human confirms a truth-claim node. Deep dive: docs/MINDRIAN-CANON.md (Part 9).
- **Part 11 - Invocation Constitution (CIRS).** Every invocable surface is born WIRED or EXCLUDED (R1/R2); the born-wired gate fails the build closed; one governed path. Every invocable surface across ALL FOUR classes -- a command, an agent, a pipeline, OR a skill that reaches a genuine Decision-Gate fork -- is ALSO born with a declared HITL shape (hitl_shape/hitl_why or hitl_stages), checked by scripts/check-shape-declaration.cjs at commit + release + doctor --acceptance as an ADVISORY lint signal as of Phase 210 (WARN with every violation enumerated, never a block; --strict restores hard-fail) (R16, the declaration mandate itself unchanged, the shape-plane sibling of R2/R9); a render-only or pure-capability skill is exempt via its existing connector.excluded:true + reason, never via a fork it does not have. The surface count is enumerated from disk at run time (currently 126 declared + 5 skill-exempt), never a frozen literal. Any future GSD discuss/plan/verify session discovers this mandate here because every GSD agent reads project CLAUDE.md as mandatory initial context. Deep dives: docs/MINDRIAN-CANON.md (Part 11), docs/HITL-SHAPE-DECLARATION-CONTRACT.md.
- **Part 12 - Pedagogy (Invisibility).** Larry is measured by how invisible he is when the insight lands; every Larry turn wears a De Stijl color mark; default to withholding grades and compliments, since praise and scores pull attention onto Larry instead of the insight the user just reached. Deep dive: docs/MINDRIAN-CANON.md (Part 12).

## Verification

Run the relevant suite after edits, before declaring a task done. Users never run these commands; Claude runs them.

- **Phase tests:** `bash tests/run-all-<phase>.sh` (for example `bash tests/run-all-187.sh`).
- **Release gate:** `scripts/verify-release`, and `scripts/release.sh <version>` for the five-gate version lockstep (never bump versions by hand).
- **Born-wired / projection / render gates:** `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`.
- **Acceptance roll-up:** `node scripts/doctor.cjs --acceptance`.

## Modular References (@include)

The long-form doctrine is NOT inlined here; these four lean includes load with this file, and each is the door to its deeper doc:

@.claude/includes/architecture.md
@.claude/includes/moat.md
@.claude/includes/decisions.md
@.claude/includes/release-process.md

- moat.md (the moat: WHEN/WHICH/SEQUENCE) deepens into docs/MOAT-MANDATE.md and docs/MWP-SPECIFICATION.md.
- architecture.md (ICM Layers 0-4 + cascade) deepens into docs/research/LIVE_DATA_ROOM_JTBD_PAPER.md.
- Source material: the V2/OS assets (Larry, 25 prompts, mode engine, grading) are ported and shipped; ongoing porting is tracked per phase in .planning/.
- Deep dive (load on demand, NOT pinned): docs/MINDRIAN-CANON.md, docs/CANON-PHASE-MAP.md, docs/ENV-TUNING.md.

<!-- GSD:project-start source:PROJECT.md -->

## Project

**MindrianOS Plugin**

A commercial Claude Code + Cowork plugin delivering Mindrian's PWS (Personal Wisdom System) methodology as installable skills, commands, agents, and hooks. One-command install gives the user Larry (the AI teaching personality) plus a structured Data Room that captures insights and surfaces gaps, contradictions, and convergence; it runs on Claude's native capabilities and connects to the remote Brain by default (silent registration on first use) for methodology -- a keyless or unreachable session refuses honestly instead of improvising.

**Core Value:** Run the full PWS methodology (25 methodology bots, structured pipelines, and an intelligent Data Room) inside Claude Code with zero infrastructure to host or manage yourself -- the plugin runs serverless, and the remote Brain is required for methodology, registering silently on first use, guided by the same teaching intelligence that powers the classroom.

### Constraints

- **Plugin format**: conform to Claude Code plugin structure (commands/, skills/, agents/, hooks/, .mcp.json, settings.json, plugin.json).
- **No server infrastructure**: runs entirely in Claude's environment; only the optional Brain MCP is remote.
- **Brain IP protection**: the teaching graph, grading intelligence, and mode-engine calibration are proprietary, served via MCP, never distributed.
- **Three surfaces**: every feature works across CLI, Desktop, and Cowork without surface-specific code.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Existing Stack (v1.0/v2.0 - stable)

| Technology | Role |
|------------|------|
| Markdown + YAML frontmatter | Skills, agents, commands, pipelines, references |
| JSON | plugin.json, hooks.json, .mcp.json, settings.json, STATE.md frontmatter |
| Bash scripts (scripts/) | Room analysis, state, meeting intelligence, PDF, transcription |
| Memgraph + Brain MCP | Remote teaching graph (Streamable HTTP) at pws-brain-mcp.onrender.com. Cutover from Neo4j Aura landed 2026-07-22; lib/core/brain-client.cjs:24 is the single source of the default URL |
| e5 (multilingual-e5-large) | Brain semantic-search vectors, 1024-dim, embedded LOCALLY (passage:/query: prefixes, no network egress). Pinecone is RETIRED |
| Cytoscape.js (CDN) | De Stijl knowledge-graph visualization |
| sentence-transformers + LSA (Python) | HSI computation scripts |

## v3.0 Additions (MCP delivery)

| Technology | Version | Role |
|------------|---------|------|
| `@modelcontextprotocol/sdk` | ^1.29.0 | MindrianOS MCP server (stdio + Streamable HTTP on one McpServer instance) |
| `zod` | ^3.25.76 | Schema validation for MCP tools; required by the MCP SDK |
| Node.js CJS shared core | Node >=22.16.0 | `lib/core/*.cjs` called by both the CLI and the MCP server. The floor is v22.16.0 because that is where `node:sqlite`'s `timeout` constructor option (the room.db write-safety option) starts working. The lower v22.13.0 floor, where the module stopped needing `--experimental-sqlite`, is NOT sufficient: on 22.13-22.15 the module loads but `timeout` is silently ignored, so the write-safety fix ships and does nothing. Source: Context7 against the Node.js v22.x API docs, the `timeout` option version-history entry. |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Code

- CJS only, no TypeScript: `lib/core/*.cjs` ships as source; every output is an inspectable edit surface.
- CLI entry points parse `process.argv` with a switch-case router (the gsd-tools.cjs pattern); no Commander or yargs.
- Bash scripts in `scripts/` stay authoritative; CJS wraps them.

## Writing and Structure

- No em-dashes anywhere; use hyphens. Feynman-simplified, JTBD-oriented prose.
- Every directory gets a `ROOM.md` identity file (ICM Layer 0); the filesystem is the source of truth (no DB for room state).
- Reuse before build: search the 25 methodology commands first; every feature works on all three surfaces.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Connector Spine

- One governed reach path: `dispatchSensors` -> `decide()` -> resolver; no second selection brain.
- `lib/core/navigation.cjs` is the single SQL navigation chokepoint; typed edges and `memory_event` nodes are written only through it.
- The Brain boundary holds: LOCAL data never egresses; only generic framework handles and enums cross the wire.

## Sentinel-Source Generation

<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## QA and RCA Reporting

When QA-ing a feature or investigating a defect, write findings to the MindrianOS RCA standard (`docs/RCA-TEMPLATE.md`); do not improvise a bug report.

- **Where reports go:** `.planning/debug/<slug>.md` so `/gsd:debug <slug>` can resume it (`.planning/` is gitignored, so `git add -f`). One defect uses `kind: rca`; a multi-component sweep uses `kind: qa-sweep`.
- **Classify before reporting:** default every finding to WORKING, a known tracked bug, ENV GAP, or NEW FAILURE, since an unclassified finding leaves the reader guessing whether it needs action; only a NEW FAILURE warrants a fresh `/gsd:debug` session.
- **Clear the gates before calling a fix done:** Canon Part 8 Brain-boundary, Tri-Polar three-surface, cross-platform, release lockstep, no em-dashes, reuse-before-build.
- **On resolve:** move the file to `.planning/debug/resolved/` and add a summary block to `.planning/debug/knowledge-base.md`.

## Dev-Research Compositing (Rethinking Room)

Every GSD phase or seed that touches MindrianOS's own architecture (not user-facing feature
work) composites with the `rethinking-mindrianos` Data Room -- the standing MindrianOS-dev
consultant room at `~/MindrianRooms/rethinking-mindrianos/`. Research and findings get filed
in BOTH places, never just one:

- The phase's own `.planning/phases/<N>-.../<N>-CONTEXT.md` (or the seed file) -- the
  actionable plan the executor actually reads.
- `rethinking-mindrianos/research/<dated-entry>/` -- the durable reasoning trail (audits,
  web-researched diligence, cross-domain checks), mirrored to `mindrianOS/research/` as
  source-of-record and cross-referenced back to the phase/seed it informs.

Same finding, two homes, cross-linked. The dev repo gets the executable decision; the room
gets the evidence and reasoning behind it. Neither substitutes for the other -- a phase
CONTEXT.md that only says "per the room's research" without the citation, or a room entry
that reaches a verdict and never lands in a phase/seed, both count as incomplete.

## Consult ALL Relevant Grounding Sources During Dev Work (MANDATORY)

"Grounding" means every source that is actually authoritative for the claim being made, not
langtalks-graph-expert alone. langtalks is one leg of this, not the whole stool -- picking it
by default for every question, including ones a different source answers more authoritatively,
is itself a research gap, not rigor.

- **langtalks-graph-expert** (`mcp__langtalks-graph-expert__*`): agent/LLM engineering CONCEPTS
  covered by its podcast-and-source corpus (memory, RAG, knowledge graphs, GraphRAG, context
  engineering, reranking, agent protocols, multi-agent dispatch/orchestration patterns).
  `relationship_path` for point-to-point relationship questions (typed edges, reliable);
  `query_relationship` only for open-ended breadth. "Not in the corpus yet" is a valid,
  expected answer for THIS source -- never paper over a gap with an ungrounded guess, and
  never treat a langtalks miss as proof no grounding exists anywhere.
- **Context7** (`mcp__*Context7__resolve-library-id` / `query-docs`): any claim about a named
  library, runtime, or API's actual behavior (e.g. `node:sqlite` transaction semantics, WAL
  visibility, version floors -- see the room.db/Moat Cross-Cutting Research Rule elsewhere in
  this file). This is more authoritative than a podcast transcript for a specific API contract;
  do not substitute langtalks for it.
- **claude-api skill + claude-code-guide agent**: any claim about Claude Code's own
  hooks/matchers, MCP tool registration, subagent-registry behavior, or Claude API mechanics.
  These are Claude-Code-internal questions a general podcast corpus was never built to answer.
- **WebSearch/WebFetch**: anything time-sensitive or outside all of the above (release notes,
  a specific GitHub issue, a vendor's current docs page) -- per the standing MCP-stack-awareness
  rule, check the stack and ask before firing search silently.

Pick the source(s) that actually cover the claim; use more than one when a finding spans
domains (e.g. a hook-matcher bug is a Claude Code question AND may also have an agent-pipeline-
design analog worth checking in langtalks). Source of truth for the langtalks-specific leg:
`feedback_mindrianos_dev_consult_langtalks.md` in personal memory
(`~/.claude/projects/-home-jsagi/memory/`) -- a short pointer to that ONE leg, not the full rule.

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| docu-optimizer | Optimize CLAUDE.md and docs/ ecosystem following Boris Cherny and Thariq Shihipar's best practices | `.claude/skills/docu-optimizer/SKILL.md` |
<!-- GSD:skills-end -->
