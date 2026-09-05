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
| `docs/2026-09-03-HANDOFF-constitution-ratified-tool-honesty-phase-276.md` | **MOST RECENT.** Matches the `-HANDOFF-` glob, read this one first. Constitution is RATIFIED v3.1.2, every ruling resolved. Phase 276 ("MCP Tool Honesty - Triage and Close") is CRITICAL and NOT yet planned -- start there: `/gsd-plan-phase 276`. Names the shared-working-tree collision pattern, the `phase.add` heading bug (caught and hand-corrected for Phase 276 itself), and the "never trust an MCP tool's own success claim without independently checking room.db" discipline this whole session was built on. |
| `docs/2026-09-03-CONSTITUTION-v3.1.0-mos-reasoning-constitution.md` | SUPERSEDED by the row above -- still the canonical constitution text and evidence trail, not the current position pointer. This filename has no `-HANDOFF-` segment, so the `ls docs/*-HANDOFF-*.md` command above misses it entirely - read it anyway, it is the current position. v3.1.1 (superseding v3.1.0), RATIFIED by navigator sign-off 2026-09-03, supersedes v3.0.0; the Ten Laws and most v3.0.0 doctrine carry forward by reference, deliberately not retyped here. SHIPPED on `main`, all verified: `brain_query` silent-empty fix (`f264c843`, `8aca8af7`); R16 (`SOURCED_FROM` added to `ALLOWED_EDGE_TYPES`, `RELATED_TO` soft-deprecated on write, still allowlisted, warns once per process, returns `deprecated:true` - `27109d3a` etc, quick 260903-gct); R17 (`lib/core/node-insert.cjs` is now the single node-write chokepoint, 16+18 sites, fail-closed `epistemic_type` validation live - `30b31b05`/`3195ff79`/`15bd8b29`/`1efca00b`, quick 260903-gdm, two named coverage gaps by design: `memory-events.cjs`, `rs-sqlite-mirror.cjs`); R19 (`/mos:operator set` migrated onto the real gate ledger - `e29a7480`/`a114a4ad`/`17a60439`); R18-revised (epistemic cap now lives on `lib/conversation/operator.cjs`, DECLARED not yet enforced - `2a08122f`/`fba4e0f5`/`8c27496b`, quick 260903-hod); T2's gate-card-schema half (`subjectNodeId`/`evidenceNodeIds` on the normalized gate card, contract version bumped to 1.1.0 - `0446bbab`/`78ae0e53`, quick 260903-h27); T2's skill-prompt half (evidence-provenance filing convention in `skills/room-proactive/SKILL.md` - `9c2250d4`/`b7dd0450`, quick 260903-h58); T2's node-writing half (`USES_FRAMEWORK` minted + `lib/core/navigation/reasoning-write.cjs` shared writer - `492c6b1c`; `gate_answer` approve branch + `artifact_file` wired to it, both additive alongside their unchanged `logMemoryEvent` rows - `2c8dfddf`; `MINTO.md`'s governing thought reads real conclusion/decision nodes with a byte-identical fallback - quick 260903-i2x). Cite commits, never a count - Part 0's own prose and table have disagreed on the number before.

RULED, DESIGN FINAL, implementation explicitly out of this repo's scope: R20 (two-engine contract, Part 3 of the constitution - `compute_graph_metric` belongs to the Brain repo, Jonathan's own IP, consumed by Theo; MindrianOS-Plugin's contribution ends at the filed design and the shipped `brain_query` fix; Theo's own `CLAUDE.md` independently ratified the same analytics-boundary split).

Real remaining traps now that T2's node-writing half has shipped (quick 260903-i2x): (1) the DIKW rungs (`EPISTEMIC_LEVELS` in `operator.cjs`) and `ALLOWED_EPISTEMIC_TYPES`'s 10 members (`node-insert.cjs:113`) are STILL two unbridged vocabularies - nothing maps one onto the other yet, so a T2 consumer cannot compare a written node's `epistemic_type` against the current operator's cap until that mapping gets ruled; this is unchanged by the node-writing half landing. (2) `sensors.cjs`'s `framework_run` halt path mints no gate-ledger entry (it never requires `gate-ledger.cjs`), so a gate it renders is unanswerable through `gate_answer` and its `USES_FRAMEWORK` edge is structurally unreachable (DC-3, named deliberate follow-up, not an oversight); closing it means minting a ledger entry there, which changes the T-198-10 spoofing guard's surface and needs its own task, not a drive-by edit.

R21 **SATISFIED 2026-09-03**: the navigator supplied a real transcript (IRIS investor-intro call, `iris2026` room) and named BONO Six Hats; certified, run, and traced for real -- one insight (Jonathan Sagir, timestamp 33:48) verified against the actual quote, trace holds. Constitution bumped to v3.1.2. Record: `sessions/2026-09-03-think-hats-ido-gur-iris-fit-t9-certification.md` in `iris2026`. Every write this involved (the transcript filing and the certification filing) was independently verified against `room.db`'s own mtime before/after, not trusted from the MCP tool's response text alone -- the first `file-meeting` call this session claimed success but wrote nothing; `artifact_file` is the real write path. `/mos:operator reset` has R19's identical ungated disease, a named deliberate follow-up, still untouched. |
| `docs/2026-09-03-HANDOFF-RESPONSE-reasoning-constitution-v3-assessment.md` | SUPERSEDED by the row above. The trap: this file DOES match the `-HANDOFF-` glob and IS dated today, so the documented discovery command surfaces it as if it were current - it is not. What stays useful: its T1-T10 evidence (six parallel investigation agents, live Brain/Theo reads) is the cited investigation record behind v3.1.0's corrections, but its conclusions are already folded into v3.1.0. Read the constitution above for the current position; treat this as the evidence trail only. |
| `docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md` | Phases 272 (CJS Python-elimination port), 273 (SQLite chokepoint hardening), 274 (script-invocation path anchoring) all CLOSED; Phase 275 registered from SEED-084, gated, not planned. The only incomplete-execution phase anywhere is still 261 (operator-gated, unchanged). Read this in full before touching Theo-adjacent work: Theo's own Phase 9 is at 10/12 plans (far more current than the 08-27 snapshot below suggests) but a NEW blocker emerged (Theo has no remote hosting story, Phase 08.4 not started) that makes Phase 269-05's existing 6-item checklist dangerously stale -- it would now falsely read 6/6 PASS. Also names a verified, high-risk bug: `lib/core/brain-client.cjs`'s `brain_query` normalization will silently return `{records: []}` for Theo's actual response shape after the flip, with zero error signal. A message with these findings was sent to the parallel Theo-working session; check for a reply before assuming the open question there is unanswered. STATE.md resync-clobber is now 20+ confirmed occurrences (up from 9+) -- worth its own `/gsd-debug` session rather than more manual patching. |
| `docs/2026-08-27-HANDOFF-goal-directed-phase-sweep-265-271.md` | A standing `/goal`-directed sweep drove Phases 265-271 through a heavily shared working tree. 265 (COMPLETE, adversarial review caught 2 real bugs green tests missed), 266 (COMPLETE), 267.1 (COMPLETE), 269 (01-04 done, 05 blocked on Theo's own roadmap) all landed; 267 stays BLOCKED (ext-apps pin); 270 (Memory/Context Operator MCP) was mid-execution at handoff time -- check its actual final status before assuming done; 268/271 are scoped but not yet planned. Read this in full before touching any of 265-271 again -- it names the recurring GSD tooling bugs hit (STATE.md resync-clobber, 9+ occurrences; room-bind gate bleed; `phase.add` heading bug) and an explicit do-not list (no `release.sh` without go-ahead, don't re-fix file-meeting's already-fixed bare-path bug, don't rebuild Phase 270's explicitly-rejected mega-tool design). |
| `docs/2026-08-20-HANDOFF-brain-devs-gate0-diagnostic.md` | **UPDATE 2026-08-20 later same day: `main` fast-forward-merged to `b3725cd5` (was stuck at `f566310c` for hours, see prior warning text below, now resolved).** The v2.1.0 roadmap (phases 253-263), both 258/259 discuss sessions, and this Gate 0 diagnostic handoff (+ companions `.planning/debug/brain-gate0-diagnostic-260820.md`, `SEED-079`, `260`/`261-RESEARCH.md`) are now ON `main`, not just the feature branch. **Still true and worth knowing:** two Claude Code sessions (this machine + a Windows session) are actively sharing ONE working tree, currently still checked out on `fix/part8-guard-in-mcp-handlers` (not `main` itself yet -- switching branches locally while background GSD agents are mid-run risks a git index-lock race, so the local checkout stays put until they finish; `main` is kept current via a direct fast-forward push after each commit instead of a local branch switch). If you're a fresh session reading this: `git fetch origin main` will have everything; you do not need the feature branch. Also the Gate 0 handoff itself: `:Framework` = 186 against an expected ~750, root cause is one contiguous archived batch (ids 28000-29000, ~95-100 nodes), now folded into Phase 258 RECON-01's task breakdown (`258-RESEARCH.md` Finding F-12), and the root-cause hunt itself is a confirmed dead end (neither local Brain-repo history reaches back to 2026-02-05). |
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
| **Brain** | Theo, the graph-native teaching backend (Phase 339 cutover, 2026-09-03) + e5 vectors (1024-dim, local embed, no egress) + teaching intelligence (docs/CORPUS-STATS.generated.md describes the prior Memgraph-backed incumbent's corpus, not yet regenerated against Theo) | theo-mcp.onrender.com (remote MCP) | Jonathan, SECRET IP |
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
- **Part 7 - Reuse Before Build.** Search the methodology surface enumerated from disk first (commands/*.md, plus agents/*.md, pipelines/*/CHAIN.md, skills/*/SKILL.md where the work spans surface classes) and justify any net-new surface against it, since duplicating an existing surface is the more common failure mode than missing a genuine gap. Deep dive: docs/MINDRIAN-CANON.md (Part 7).
- **Part 9 - Memory Locality.** SQL (room.db) is the local mind; Brain reasons over typed packets, never raw memory; only a human confirms a truth-claim node. Deep dive: docs/MINDRIAN-CANON.md (Part 9).
- **Part 11 - Invocation Constitution (CIRS).** Every invocable surface is born WIRED or EXCLUDED (R1/R2); the born-wired gate fails the build closed; one governed path. Every invocable surface across ALL FOUR classes -- a command, an agent, a pipeline, OR a skill that reaches a genuine Decision-Gate fork -- is ALSO born with a declared HITL shape (hitl_shape/hitl_why or hitl_stages), checked by scripts/check-shape-declaration.cjs at commit + release + doctor --acceptance as an ADVISORY lint signal as of Phase 210 (WARN with every violation enumerated, never a block; --strict restores hard-fail) (R16, the declaration mandate itself unchanged, the shape-plane sibling of R2/R9); a render-only or pure-capability skill is exempt via its existing connector.excluded:true + reason, never via a fork it does not have. The surface count is enumerated from disk at run time (249 declaring as of Appendix D entry 40, per 340-LIVE-VERIFICATION.md - the declaring/excluded splits are no longer disjoint, 53 advisory WARN-level conflicts open), never a frozen literal. Any future GSD discuss/plan/verify session discovers this mandate here because every GSD agent reads project CLAUDE.md as mandatory initial context. Deep dives: docs/MINDRIAN-CANON.md (Part 11), docs/HITL-SHAPE-DECLARATION-CONTRACT.md.
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

**Core Value:** Run the full PWS methodology (a growing methodology-command surface enumerated from disk, structured pipelines, and an intelligent Data Room) inside Claude Code with zero infrastructure to host or manage yourself -- the plugin runs serverless, and the remote Brain is required for methodology, registering silently on first use, guided by the same teaching intelligence that powers the classroom.

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
| Theo + Brain MCP | Remote teaching graph (Streamable HTTP) at theo-mcp.onrender.com. Cutover from Neo4j Aura to Memgraph (pws-brain-mcp.onrender.com) landed 2026-07-22; cutover from Memgraph to Theo landed 2026-09-03 (Phase 339). lib/core/brain-client.cjs:24 is the single source of the default URL |
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
- Reuse before build: search the methodology surface enumerated from disk first (commands/*.md, agents/*.md, pipelines/*/CHAIN.md, skills/*/SKILL.md); every feature works on all three surfaces.

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
- **icm-architect skill** (`~/.claude/skills/icm-architect/`): any work touching room
  structure, ICM/MWP architecture, or the local graph (SQLite substrate, room schema, section
  scaffolding, walk-test/reference-integrity questions). Bind it to this class of work as a
  standing consult, not a one-off -- it is a community reference implementation of the same
  paper this repo's own `docs/MWP-SPECIFICATION.md` already cites (Van Clief & McDermott 2026,
  arXiv 2603.16021), and it has already independently validated real findings this repo's own
  tooling had not surfaced (see `rethinking-mindrianos/research/2026-08-28-icm-architect-
  room-structure/` and SEED-076). Use its ten invariants, six-forms taxonomy, and walk test as
  a checklist before shipping new room-scaffold, `room-db.cjs`/`navigation.cjs`, or
  section-metadata work -- not just when explicitly asked to "audit."
- **Theo** (`/home/jsagi/Theo`, esp. `notes/graph-rulebook.md`, `notes/knowledge-graph.md`, and
  `.planning/ROADMAP.md` Phase 9 "Brain-Contract Cutover"): standing consult (navigator ruling,
  2026-09-02) for ANY phase whose research touches the Brain graph, framework resolution,
  readiness scoring, or anything `check-flagship-floor.cjs`-adjacent. Theo is the pre-scoped
  successor that `pws-brain-mcp` cuts over to (Phase 9); it is not deployable yet (no remote
  hosting story, its own Phase 8.4 not started), so a phase should still plan and ship against
  the CURRENT Brain -- but its research must state explicitly whether the finding/fix has a
  Theo-side analog, and if so what it is, so cutover is a smaller diff instead of a rediscovery.
  Concrete precedent: Phase 262 found a hop-depth-1 `ALIAS_OF` defect in the current Brain's
  `NORMALIZE_NAME_CYPHER` (a fork silently returns 2 "canonical" matches); Theo's own
  `resolveFramework` (`src/mcp/content/normalize-framework-name.ts`) already treats the identical
  shape as `ALIAS_FORK` and refuses honestly instead of guessing -- worth knowing before writing a
  new guard for the old Brain that Theo's design already solved differently. Check Theo's own
  `{phase}-MOS-LEARNING.md` files (one per Theo phase, `## Schema and contract changes for the
  local room graph` section) before assuming a gap is unaddressed there.

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

No project skills currently registered.
<!-- GSD:skills-end -->
