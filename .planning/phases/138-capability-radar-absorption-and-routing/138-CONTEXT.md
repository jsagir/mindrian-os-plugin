---
phase: 138
slug: capability-radar-absorption-and-routing
status: superseded by Phase 265 (capability-radar-absorption-routing-re-scoped-supersedes-orp) -- retired as an orphan (W007-138), never built
superseded_by: Phase 265 capability-radar-absorption-routing-re-scoped-supersedes-orp
priority: P2 -- standing mechanism so radar findings get ABSORBED + WEAPONIZED, not logged-and-rotted
created: 2026-06-01
milestone: v1.14.0
sequencing: "v1.14.0 phase #1 -- MUST precede v1.14.0 consumer phases (133 / 134 / 135 / 136 + the deferred research-lens migration remainder) so the radar-router + ledger exist BEFORE any consumer phase is planned. Closes the 'planned-blind' window without touching the frozen v1.13.1 chain."
origin: "/mos:radar --fetch 2026-06-01 surfaced Claude Code 2.1.148 -> 2.1.159 (16 findings). Re-think after the Phase 137 number collision (137 is the Brain<->MindrianOS sync harness)."
canon_parts:
  - Part 6 (dog-fooding -- the plugin absorbs platform capabilities deliberately on a schedule, the same drift discipline it sells)
  - Part 7 (reuse before build -- REPLACES the dormant one-shot SEED-003 backlog pattern with a living router; reuses Phase 122 chain-recommender + command-registry rather than a new dispatcher)
  - Part 8 (graph boundary -- CLAUDE_CODE_SESSION_ID Brain scoping is read-only; no user content to Brain)
  - Part 2 Engine 2 (BONO orchestration -- Opus 4.8 dynamic workflows are the parallel-team substrate the canon has been describing)
depends_on:
  - SEED-003 claude-code-2-1-x-capability-adoption (the dormant one-shot backlog this phase supersedes; A2/A4/A5 carry forward here)
  - Phase 122 workflow-layer (lib/brain/chain-recommender.cjs + data/command-registry.json -- the router hooks into the existing resolver, no new dispatcher)
  - Phase 109 sql-context-memory-navigation-spine (the session-scoping consumer of CLAUDE_CODE_SESSION_ID)
  - references/capability-radar/changelog-cache.md + capabilities-index.md (the ledger source; cache already carries the 2.1.148-159 findings as of 2026-06-01)
brain_impact: NONE (session-id scoping is read-only enumeration; no user data egress -- Canon Part 8)
hotfix_discipline: NO (net-new mechanism + retrofit backlog)
estimated_days: 3-5

# LOCKED DECISIONS (AskUserQuestion 2026-06-01)
decisions:
  placement: "v1.14.0 backlog. Do NOT build inside the frozen v1.13.1 chain (128 / 129 / 130 / 130.5 / 130.7 / 131 / 132 / 121.5). Build after v1.13.1 ships. Nothing in the findings is freeze-critical: Opus 4.8 model floor resolves automatically because executor_model='opus' already points at newest."
  bucket_c_lands_here: "Phase 121.5 (terminal-coherence-capstone) ALREADY SHIPPED 2026-05-16 (re-verified 2026-05-19). So the hook/skill findings (SessionStart session-title, reloadSkills, defaultEnabled:false, disallowed-tools) CANNOT fold into 121.5 -- they land in THIS phase."
  single_ledger_location: "The capability ledger + forward-map live INSIDE this CONTEXT (one parked location), NOT scattered as radar_findings: frontmatter across near-frozen phases. The radar-router injects findings at /gsd:plan-phase time instead."
  phase_137_collision: "Phase 137 is the Brain<->MindrianOS sync harness (committed c15a7c86). This radar-absorption work is Phase 138."
  a4_reeval: "Opus 4.8 dynamic workflows (2.1.154) likely SUPERSEDE the manual CLAUDE_CODE_FORK_SUBAGENT path (SEED-003 A4). This phase DECIDES adopt-vs-supersede before any fork-subagent harness is built."
---

# Phase 138: Capability Radar Absorption + Routing (v1.14.0)

## Goal

Turn `/mos:radar` from a READER into a ROUTER. Today radar findings die in a dormant, stale, one-shot backlog (SEED-003, last refreshed for 2.1.110-128). This phase makes capability findings get ABSORBED (retrofit the behind-us items the platform now does better) and WEAPONIZED (force every future unshipped phase to consider the relevant findings before it is planned), with the whole mechanism living in one place so it cannot rot.

This is the drift discipline from the 2026-04-13 incident, applied to platform-capability adoption.

## The problem

- `/mos:radar --fetch` surfaces capabilities, but they land in SEED-003, which is `status: dormant`, only covers 2.1.110-128, and is a one-shot backlog (A1 + A3 shipped; A2 + A4 + A5 never moved).
- There is no mechanism to (a) retrofit shipped code when a new capability obsoletes a hand-rolled approach, or (b) force a future phase plan to consider new capabilities.
- Parking everything to v1.14.0 created a NEW risk: a v1.14.0 consumer phase planned BEFORE this phase ships would go out blind. Mitigation = this phase is sequenced FIRST in v1.14.0 (see frontmatter `sequencing`).

## Reframe (mostly reuse, not net-new -- Canon Part 7)

Phase 122 already ships the router substrate: `data/command-registry.json` (generated from command frontmatter), `lib/workflow/command-resolver.cjs` (the one door), and `lib/brain/chain-recommender.cjs` (FEEDS_INTO traversal, framework names + enums only). This phase REPOINTS that machinery: the radar-router is a thin consumer that, at `/gsd:plan-phase` time, reads the ledger below and injects the findings tagged for that phase. The net-new surface is the ledger + the `radar_findings:` frontmatter contract + the drift check; the routing logic is reused. It also DELETES the dormant one-shot SEED-003 pattern rather than adding a parallel one.

## The capability ledger (Claude Code 2.1.148 -> 2.1.159)

Source: `references/capability-radar/changelog-cache.md` (fetched 2026-06-01). Status legend: `dormant | adopting | shipped | superseded`.

| # | Capability (version) | Leverage | Destination | Status |
|---|----------------------|----------|-------------|--------|
| 1 | Opus 4.8 + dynamic workflows orchestrating hundreds of agents (2.1.154) | HIGH | Bucket F: forward-map to 133/134/135/136 + research-lens migration remainder; substrate for Canon Part 2 Engine 2 (BONO). Also retires A4 (see #11). | dormant |
| 2 | `CLAUDE_CODE_SESSION_ID` to plugin MCP servers (2.1.153) | HIGH | Bucket R: per-session Brain scoping; ties to Phase 109 chokepoint + Phase 128.1 session isolation | dormant |
| 3 | SessionStart hook sets session title (2.1.152) | MED | Bucket C (was 121.5, now here): name session after active room | dormant |
| 4 | `reloadSkills` + `/reload-skills` (2.1.152) | MED | Bucket C: hot-swap surfaced skills per room (ties to /mos:surface) | dormant |
| 5 | `defaultEnabled: false` for plugins (2.1.154) | MED | Bucket C: ship optional skill clusters off by default | dormant |
| 6 | `disallowed-tools` in skill frontmatter (2.1.152) | MED | Bucket C: per-skill tool scoping (Part 8 hardening) | dormant |
| 7 | Plugins in `.claude/skills` auto-load + `claude plugin init` (2.1.157) | LOW | release-process.md / install-lifecycle doc note (not a code change) | dormant |
| 8 | `agent` field honored for dispatched sessions (2.1.157) | MED | Bucket F: correct persona on subagent launch -> 133/134/135 + BONO team | dormant |
| 9 | Lean system prompt default + fast-mode price cut (2.1.154) | MED | Bucket R/F: more context budget (136 render-spine, 121-line telemetry) + cheaper background analysis | dormant |
| 10 | Per-category usage cost breakdown (2.1.149) | MED | Bucket R: telemetry + free-vs-paid tier-model instrumentation | dormant |
| 11 | (carry-forward) SEED-003 A4 forked subagents (2.1.117) | -- | RE-EVALUATE vs #1; likely superseded | superseded? |
| 12 | (carry-forward) SEED-003 A2 hooks-as-MCP-callers (2.1.118) | MED | Bucket R: collapse brain-client.cjs proxy layer | dormant |
| 13 | (carry-forward) SEED-003 A5 `.zip` beta channel (2.1.128) | LOW | release-process.md beta side-channel | dormant |
| 14 | Auto mode on Bedrock/Vertex/Foundry (2.1.158) | LOW | enterprise/hosting; defer to hosted-tier work | dormant |

(Minor / no-action: `/simplify` cleanup-only, background shell via `!`, `EnterWorktree` mid-session, GFM task lists, `/diff` scroll -- developer-workflow only.)

## The three buckets

- **Bucket R (Retrofit -- behind us, change now in v1.14.0):** #2, #9, #10, #12 (A2), #13 (A5), plus the #11 (A4) adopt-vs-supersede decision and the Opus 4.8 model-floor note.
- **Bucket C (Capstone items -- 121.5 shipped, so they land HERE):** #3, #4, #5, #6.
- **Bucket F (Forward awareness -- future unshipped phases):** #1, #8, #9. Carried via the radar-router + forward-map, not frontmatter sprinkling.

## The mechanism (the weaponization)

1. **Living ledger.** The table above is the single source of truth. `/mos:radar --fetch` appends new findings here going forward (radar writes the ledger, not just the cache).
2. **`radar_findings:` CONTEXT frontmatter contract.** Mirrors the existing `canon_parts:` discipline. A phase plan declares which findings it considered. Default empty; the router fills the candidate list.
3. **Radar-as-router.** At `/gsd:plan-phase N`, the router reads the ledger's Bucket-F forward-map and surfaces the findings tagged for phase N (or its slug-keywords), so the planner cannot proceed blind. Reuses the Phase 122 resolver path.
4. **Drift check.** A lightweight check (sibling to the canon_parts drift idea) warns if a phase touching a forward-mapped surface omits the relevant `radar_findings:` row.

## A4 decision (must resolve before any fork-subagent build)

Opus 4.8 (2.1.154) ships dynamic workflows that orchestrate hundreds of agents as a first-class capability. SEED-003 A4 proposed a manual `CLAUDE_CODE_FORK_SUBAGENT=1` harness for parallel BONO team members. This phase decides: adopt the platform workflows (likely) and mark A4 `superseded`, OR keep A4 if a gap is found. Do not ship a hand-rolled fork harness the platform already obsoleted.

## Scope

- The ledger (this CONTEXT) promoted to the canonical capability registry; SEED-003 forward-points here.
- Bucket R retrofits: `.mcp.json` session-id scoping, A2 hooks-as-MCP-callers collapse, per-category cost in telemetry, model-floor note, `.zip` beta channel doc.
- Bucket C: SessionStart session-title, reloadSkills wiring, defaultEnabled clusters, disallowed-tools skill scoping.
- The radar-router + `radar_findings:` frontmatter contract + drift check (reusing Phase 122 resolver).
- The A4 adopt-vs-supersede decision, recorded.

## Out of scope (LOCKED)

- Anything inside the frozen v1.13.1 chain. This phase builds AFTER v1.13.1 ships.
- Folding Bucket C into Phase 121.5 (it shipped; cannot be amended here).
- Enterprise Bedrock/Vertex auto-mode wiring (#14) -- defer to hosted-tier work.

## Acceptance criteria (draft -- refine at /gsd:plan-phase 138)

- [ ] The ledger is the single source of truth and `/mos:radar --fetch` appends to it (not just the cache)
- [ ] `/gsd:plan-phase N` surfaces the Bucket-F findings tagged for phase N before planning proceeds (router works)
- [ ] A phase that touches a forward-mapped surface without a `radar_findings:` row is flagged by the drift check
- [ ] Bucket R retrofits land: session-id Brain scoping is read-only (Canon Part 8 scan passes), A2 collapse keeps Phase 89.5 fixtures green, per-category cost surfaces in telemetry
- [ ] Bucket C lands: session title reflects active room; `/reload-skills` hot-swaps surfaced skills; at least one optional cluster ships `defaultEnabled: false`
- [ ] A4 decision recorded (adopt Opus 4.8 dynamic workflows, or justified keep)
- [ ] SEED-003 status flipped to `superseded-by: Phase 138` once this ships

## Cross-references

- `references/capability-radar/changelog-cache.md` (2.1.148-159, fetched 2026-06-01) + `capabilities-index.md`
- `.planning/seeds/SEED-003-claude-code-2-1-x-capability-adoption.md` (the dormant backlog this supersedes; A2/A4/A5 carry forward here)
- Phase 137 (Brain<->MindrianOS sync harness -- sibling v1.14.0 backlog phase; do not confuse numbers)
- Phase 122 workflow-layer (the router substrate reused)
- Phase 109 navigation chokepoint (session-id scoping consumer)

## Superseded by Phase 265

This phase never shipped. It was scaffolded 2026-06-01 and never added to ROADMAP.md; the
drift detector caught the orphaning as finding W007-138 on 2026-08-10, sixteen days before a
human did -- evidence the check works. Phase 265
(capability-radar-absorption-routing-re-scoped-supersedes-orp) retires it by marking, not
deleting, and records the full reasoning in `docs/RADAR-ABSORPTION-265.md`. The corrections,
next to the original errors so a future reader sees both:

- `E-1`: `a4_reeval` above frames A4 (forked subagents) as an open probabilistic question
  ("likely SUPERSEDE... This phase DECIDES adopt-vs-supersede"). Corrected: SETTLED by the
  platform at Claude Code 2.1.232 (subagent forking is on by default). Nothing to decide.
- `E-2`: the Bucket-F destinations above name Phases 133-136 as consumers. Corrected: those
  phases are unrelated and long past; ROADMAP's rolling window moved. A forward-map must be
  derived at plan time from a live ledger, never hardcoded to phase numbers in a markdown
  table -- hardcoded numbers are exactly what rotted here.
- `E-3`: "the ledger (this CONTEXT) promoted to the canonical capability registry" above is the
  root cause of the rot. A markdown table inside one phase's CONTEXT.md is invisible to every
  tool. Corrected: Phase 265 puts the ledger in a machine-readable file,
  `data/capability-ledger.json`, schema-validated and freshness-checked on two independent
  paths.
- `E-4`: the `depends_on` list above claims the changelog cache "already carries the
  2.1.148-159 findings as of 2026-06-01." Corrected: FALSE. The cache's own header reads "Last
  fetched: 2026-05-05" and its newest entry is `### 2.1.128`.
- `E-5`: the acceptance criteria above frame "no `CLAUDE_CODE_FORK_SUBAGENT` env default is set"
  as the A4 win condition. Corrected: the variable still exists but its polarity inverted -- it
  is now the opt-OUT (`=0`), not an opt-in. A tripwire asserting the literal's absence is still
  the right shape, for the opposite reason.

Four elements Phase 265 carried forward verbatim, because they were right:

1. The problem framing -- "radar findings die in a dormant, stale, one-shot backlog," proven
   true by this phase itself becoming exactly that.
2. The reuse-not-rebuild reframe (Canon Part 7) -- reuse Phase 122's `data/command-registry.json`
   + resolver rather than mint a new dispatcher.
3. The four-part mechanism shape -- living ledger + a findings contract + a router at plan time
   + a drift check. Structurally sound; only the medium (a markdown table) was wrong.
4. The supersede-never-delete discipline -- the right disposal shape for a rotted predecessor,
   now applied reflexively to this phase and to SEED-003.
