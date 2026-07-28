# Phase 234: MindrianOS as infrastructure: skills+MCP everywhere, open-core at the network boundary (SEED-068+069 consolidation) - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Source:** Seed Consolidation Express Path (SEED-068 + SEED-069). Both seeds are navigator-decided (2026-07-18, per their own `source` frontmatter) and were promoted to this phase by the 2026-07-28 Critical Pathway scoring pass (SCORE tier 2, CONSULT via langtalks-graph-expert, REUSE-CHECK confirmed orphan scope). No interactive `/gsd-discuss-phase` session was run: the decisions this phase needs are already locked in the seed files themselves (explicit "Do NOT" lists, "THE LINE" commercial boundary, a corrected/verified host matrix) rather than open grey areas needing adaptive questioning, and this orchestrator run has no interactive AskUserQuestion channel to the navigator. This CONTEXT.md is the workflow's own "best-effort context-gathering call" for a phase with no CONTEXT.md, applied the same way the ADR Ingest Express Path (workflow step 3.6) treats a locked-decision source document.

<domain>
## Phase Boundary

Consolidate SEED-068 and SEED-069 into one phase. Two things this phase must decide and plan:

1. **How MindrianOS ships (packaging).** Skills package + MCP server, portable across any host that natively reads Claude-Code-format `.claude/skills/**/SKILL.md`, instead of building or forking a single host runtime. (SEED-068)
2. **Where the commercial/paid boundary is drawn.** A NETWORK boundary (the hosted Brain + scouts + curation), not a license-key boundary on local code. (SEED-069)

**Explicitly OUT of scope — do not re-open:**
- SEED-072 (collaborative editor stack) and SEED-073 (filesystem/CRDT/RxDB) — both EXPLICITLY SHELVED per their own text ("no action implied").
- SEED-063 (OpenCode fork) is demoted by SEED-068 to a Tier-1 host adapter, not the strategy — this phase operates under that demotion, it does not re-litigate it.
- SEED-070, SEED-071 — adjacent evaluations, not part of this phase's mandate.

</domain>

<decisions>
## Implementation Decisions

### Distribution architecture (SEED-068)
- **D-01:** Ship as a skills package (SKILL.md files) + MCP server that installs into any Claude-Code-skill-format-compatible host. No fork of a host runtime (OpenCode, Grok Build, etc.) as the primary strategy.
- **D-02:** Two-tier honest degradation model:
  - **TIER 0 (universal):** skills (124 SKILL.md) + MCP server (~30 tools) — works on every compliant host (Claude Code, OpenCode, Grok Build, VS Code/Copilot, Cursor, Goose, Cline, Windsurf/Devin, Continue, Zed [skills only, `.agents/` not `.claude/`], next-thing).
  - **TIER 1 (hook-capable):** + proactive surfacing, Stop gate, contradiction push — Claude Code (84 hook entries today), Grok Build (17 events, exit-code-2, native), OpenCode (via SEED-063's plugin, now explicitly a Tier-1 ENHANCEMENT, not the strategy).
- **D-03:** NEVER route persona through MCP `InitializeResult.instructions` — it is the least portable channel surveyed (confirmed only on Goose + listed VS Code; provably dropped by Zed; unimplemented on Cline/Continue). Persona ships as a SKILL — the one channel with universal support and documented semantics. Tool descriptions are load-bearing product copy and must be written as instructions, not labels. (This supersedes SEED-065's earlier guidance to lean on `instructions` + tool descriptions — tool descriptions remain valid, `instructions` does not.)
- **D-04:** Enforce governance SERVER-SIDE, in MCP tool handlers — not via client hooks. Client hooks exist on most hosts but are Preview-status on VS Code, differently shaped per host, and entirely absent on Zed. Only `.claude/settings.json` is portable, and only to VS Code.

### Capability floor and degradation (SEED-068)
- **D-05:** Capability floor is two-dimensional: model capability AND host tier. Detect both; state both; degrade honestly on both axes — same no-silent-skip discipline the gate ladder's `renderViaText` already encodes, consistent with this repo's existing gates discipline and SEED-059's fallback-disclosure convention.
- **D-06:** Never put anything genuinely proprietary in a SKILL.md — it is a copyable text file on the user's disk, on every host, forever.

### Commercial boundary / open-core (SEED-069)
- **D-07:** The boundary is a NETWORK boundary, not a license-key boundary. Licensed-server / open-core model — chosen (2026-07-18) over Brain-as-a-service, institutional licensing, and methodology-as-curriculum. Those remain live alternatives if this fails; not re-litigated here.
- **D-08:** FREE CORE (local, copyable, and that's fine — it's the adoption engine): all 124 SKILL.md (the methodology), the local MCP server, room.db and the room graph (the user's own data), the gate ladder, navigation engine, memory layers.
- **D-09:** PAID (hosted; nothing to patch because it was never on the user's disk): the Brain (curated teaching graph), scouts/sentinels (grants, deadlines, competitors, opportunity scans), cross-room and cross-org intelligence, curation and updates (a static copy of the methodology rots), support/indemnity/SLA.
- **D-10:** Do NOT gate a `/mos:` methodology run behind a paid check — that inverts the adoption engine. The failure mode to actively watch for is the free core being too thin (nobody adopts), which is the OPPOSITE risk from piracy.
- **D-11:** Canon Part 8 (Brain is a READ service, never sees user content) holds UNCHANGED and is a FEATURE of this model, not a constraint fought against — it's what makes the paid tier sellable to institutions that would refuse a data play.
- **D-12:** Host-capability tiers (SEED-068's Tier 0/Tier 1) and commercial tiers (SEED-069's free/paid) are DIFFERENT AXES — do not conflate them. A Tier-0 host (e.g. Zed) can have a paying user; a Tier-1 host can have a free one.

### The four SEED-068 commercial questions, per SEED-069
- **D-13:** Which methodology content lives behind the server? ANSWERED: none of it. Methodology is the adoption engine and ships free in SKILL.md. What lives behind the server is *knowledge* (the Brain) and *currency* (scouts, updates), not *method*.
- **Still OPEN (planner's discretion how much this phase resolves vs. defers):** the entitlement mechanism and whether it works offline/self-hosted; per-seat/per-org/per-room pricing. Note: seat-counting cannot rely on MindrianOS's own telemetry (Part 8 forbids the obvious workaround, since the host runs the conversation) — likely resolves to per-org against Brain API credentials.

### Claude's Discretion
- Exact build-order sequencing within the phase's plans. SEED-068 suggests: VS Code/Copilot + Cursor first (the market, both keep Larry intact); Goose second (full-channel reference); Cline third (PR #11131 already open, needs only a rebase — see "Corrections" below); Grok Build/OpenCode fourth; Zed fifth (cheap, ~a day, not for revenue — 50KB total catalog budget, MEASURE before shipping); Continue package-only, do not invest; Aider skip entirely (no MCP client). The planner may resequence based on what's actually buildable first in THIS codebase.
- Whether this phase's plans fully resolve the entitlement mechanism and pricing model, or scope a narrower first cut and defer the rest to a follow-up phase/seed — SEED-069 itself marks these OPEN, not blocking.
- The exact list of which existing `lib/core/*.cjs` logic needs to move behind an entitlement check vs. stays free — this phase's research step should surface a concrete list against the actual codebase rather than the planner assuming it from the seeds alone.
- Corrections SEED-068 records that the planner should treat as current fact, not stale: Cline did NOT "explicitly decline" `instructions` (a stale bot closed the issue `not_planned`, no human position taken; PR #11131 closed by its own author for refactor drift, remains open, zero recorded opposition — upstreaming is viable). Windsurf is now Devin Desktop (Cognition-owned; verify install base before spending roadmap on it — no substantiable seat/ARR figure).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary seeds (this phase's mandate — read BOTH in full)
- `.planning/seeds/SEED-068-be-infrastructure-not-an-application-host-agnostic-distribution.md` — distribution architecture, 11-host verified matrix, two-tier degradation model, the commercial sub-questions this phase answers
- `.planning/seeds/SEED-069-open-core-the-boundary-is-a-network-boundary.md` — the commercial/licensing decision, THE LINE (free core vs. paid), answers to SEED-068's four open questions

### The wider 062-073 cluster (context — do not re-litigate; SEED-072/073 explicitly out of scope)
- `.planning/seeds/SEED-062-the-engine-gap-no-agentic-runtime-in-this-codebase.md` — the original finding this cluster answers: no agentic runtime in this codebase (236K lines of `lib/` is a portable substrate; no caller supplies real cognitive work to `chain-executor.cjs::runChain`)
- `.planning/seeds/SEED-063-opencode-as-host-runtime-fork-target.md` — OpenCode fork target, demoted by SEED-068 to a Tier-1 adapter
- `.planning/seeds/SEED-064-grok-build-host-runtime-runner-up-governance-fail.md` — Grok Build evaluation
- `.planning/seeds/SEED-065-mcp-ceiling-persona-and-proactivity-cannot-ship-over-mcp.md` — the MCP ceiling constraint SEED-068 tiers around (SEP-2260 forbids unsolicited server-to-client requests; persona/proactivity cannot ship over MCP alone)
- `.planning/seeds/SEED-066-collaborative-shell-licence-findings-affine-and-docmost-disqualified.md` — collaborative-shell licensing findings
- `.planning/seeds/SEED-067-subscription-passthrough-is-contractually-forbidden.md` — BYO-sub forbidden by Anthropic specifically (not universally); largely dissolved by SEED-068's "the host runs the conversation" framing
- `.planning/seeds/SEED-070-eureka-live-test-2026-07-19-and-the-stale-bytes-lesson.md`, `.planning/seeds/SEED-071-markitdown-and-langextract-evaluation.md` — adjacent evaluations, not this phase's mandate

### Explicitly shelved — do NOT re-open in this phase
- `.planning/seeds/SEED-072-collaborative-editor-stack-handoff-defers-to-066-and-071.md` — "no action implied" per its own text
- `.planning/seeds/SEED-073-filesystem-canonical-crdt-and-rxdb-are-disposable-projections.md` — "no action implied" per its own text

### Canon and process
- `docs/MINDRIAN-CANON.md` Part 8 (Graph Boundary) — the constraint SEED-069 explicitly holds unchanged and leans on as a commercial asset
- `docs/MINDRIAN-CANON.md` Part 11 (Invocation Constitution / CIRS) — born-wired mandate; any new MCP tool boundary this phase creates must be born WIRED or EXCLUDED (`scripts/check-shape-declaration.cjs`)
- `.claude/includes/moat.md` → `docs/MOAT-MANDATE.md`, `docs/MWP-SPECIFICATION.md` — existing moat framing (the graph that knows WHEN/WHICH/SEQUENCE); this phase's D-07/D-08/D-09 boundary should be checked against it since it sharpens WHAT counts as "the moat" by adding "network boundary" as the concrete mechanism
- `.planning/SESSION-HANDOFF-2026-07-28-critical-pathway-rooms-open-phase-233-release.md` — documents the 2026-07-28 Critical Pathway scoring pass that promoted this phase; item 7 confirms "SEED-062 through SEED-073 ... navigator already chose a direction (2026-07-21) but it is still not scoped into a phase" as of session start

</canonical_refs>

<specifics>
## Specific Ideas

- The 11-host matrix in SEED-068 (verified 2026-07-18) is close to a spec, not a mood board. VS Code/Copilot and Cursor are both TIER 1 and constitute "the market" (75.9% of developers per Stack Overflow 2025, n=26,143, 180M+ GitHub accounts; Cursor ~$2B ARR / 64% of the Fortune 500). Goose is the reference implementation for full channel fidelity (skills + hooks + `instructions` + elicitation, all confirmed). Zed is skills-only (`.agents/skills/`, NOT `.claude/`, and NO hooks) — ship it because it's cheap (~a day), not because it moves revenue, and MEASURE the 50KB total-catalog budget before shipping (124 skills ≈ 400 bytes each for names+descriptions, overflow silently dropped).
- "Whoever wins the harness war, MindrianOS wins, because it is not in the war" — SEED-068's own framing; useful language for how this phase's PLAN.md objectives should be worded.
- SEED-069's ASCII "FREE CORE / PAID" diagram is the exact list the planner should map against the real codebase: which specific `lib/core/*.cjs` files and MCP tools are "local" today vs. what a genuinely new hosted-only Brain-side capability would require.
- SEED-069's objection-and-rebuttal ("the MCP server is local `.cjs`, a licence check is patchable" / "enforcement was never the moat — Redis, Elastic, GitLab all ship code a determined user could patch. People who patch licences were never customers.") is directly relevant to any PLAN.md task touching entitlement/licensing: the plan must NOT propose local licence-key enforcement machinery.

</specifics>

<code_context>
## Existing Code Insights

### Reusable assets (per CLAUDE.md and existing architecture docs — researcher should confirm current state against SEED-068's specific host-adapter needs)
- `lib/core/navigation.cjs` — the single SQL navigation chokepoint (typed edges + `memory_event` nodes written only through it); directly relevant to D-04's "enforce governance server-side" decision.
- `lib/workflow/command-resolver.cjs::composeWorkflow` and `lib/core/chain-executor.cjs::runChain` — the "engine block with no combustion" SEED-062 identified; the baseline for what the MCP server already does vs. what this phase's packaging work adds.
- The existing MCP server surface (`.mcp.json`, `lib/mcp/tools/*`) — ~132,000 lines of methodology already in commands/skills/agents per SEED-062's proving_case. Researcher should establish current tool count vs. SEED-068's "~30 tools" Tier-0 target.
- 124 existing `skills/*/SKILL.md` files — the catalog SEED-068 says is already in a de facto (per SEED-068, now confirmed an open standard per agentskills.io) cross-harness format. Researcher should check whether any currently rely on Claude-Code-only mechanics that would break Tier-0 portability.

### Established patterns
- Part 11 CIRS born-wired/excluded gate (`scripts/check-shape-declaration.cjs`) — any new MCP tool boundary this phase creates is subject to this EXISTING enforcement mechanism, not a new one.
- The gate ladder's `renderViaText` no-silent-skip discipline (referenced directly in SEED-068 D-05) — existing precedent for "degrade honestly" the planner should reuse rather than invent a new degradation convention.

### Integration points
- Wherever the current MCP tool handlers live (`lib/mcp/tools/`) is the concrete integration point for D-04 (server-side governance enforcement) and D-09 (paid capabilities living behind an authenticated call to the hosted Brain).
- The existing Brain MCP wire (`mindrian-brain.onrender.com`, per CLAUDE.md's "Brain" layer table) is the existing network boundary this phase's entitlement mechanism extends, not invents from scratch.

</code_context>

<deferred>
## Deferred Ideas

- SEED-072 (collaborative editor stack) and SEED-073 (filesystem/CRDT/RxDB) — both explicitly shelved by their own "no action implied" text. Out of scope for Phase 234; do not fold in.
- SEED-070 (Eureka live-test lesson) and SEED-071 (Markitdown/LangExtract evaluation) — adjacent evaluations, not part of this phase's mandate; leave as standalone seeds.
- Full resolution of SEED-069's still-OPEN entitlement mechanism (offline/self-hosted Brain for enterprise) and pricing model (per-seat/org/room) — SEED-069 marks these OPEN, not blocking. The planner may scope a narrower first cut and defer the rest to a follow-up seed/phase.
- Full host-adapter build-out beyond what's needed to prove the Tier-0/Tier-1 architecture (SEED-068's "Build order" items 3-7: Cline PR upstreaming, Grok Build/OpenCode plugin work, Zed port, Continue packaging, Aider skip) — SEED-068's own stated sequencing, not necessarily all in Phase 234's first plan wave. Planner's discretion which subset ships now vs. a follow-up phase.

</deferred>

---

*Phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core*
*Context gathered: 2026-07-28 via Seed Consolidation Express Path (no interactive discuss-phase session — navigator decisions already locked in SEED-068 + SEED-069 source text)*
