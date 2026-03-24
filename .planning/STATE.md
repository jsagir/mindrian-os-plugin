---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: MCP Platform & Intelligence Expansion
status: planning
stopped_at: null
last_updated: "2026-03-24T18:30:00.000Z"
last_activity: 2026-03-24 -- Milestone v3.0 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Users can run the full PWS methodology inside Claude Code with zero infrastructure, where Larry guides them through venture innovation.
**Current focus:** v3.0 — Dual-surface delivery (CLI plugin + MCP server) + Opportunity Bank, Funding Room, AI Team Personas

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-24 — Milestone v3.0 started

## Performance Metrics

**Velocity:**
- Total plans completed: 16 (v1.0)
- Average duration: 4min
- Total execution time: ~1 hour

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Install and Larry Talks | 3/3 | 10min | 3min |
| 02 Core Methodologies | 5/5 | 26min | 5min |
| 03 Pipeline Chaining | 2/2 | 5min | 3min |
| 03.1 Dashboard | 2/2 | 5min | 3min |
| 03.2 Document Gen | 2/2 | 16min | 8min |
| 04 Brain MCP | 3/3 | 8min | 3min |
| 05 Plugin Intelligence | 3/3 | 8min | 3min |

**Recent Trend:**
- Last 5 plans: 4min, 2min, 2min, 3min, 2min
- Trend: Stable
| Phase 06 P04 | 5min | 2 tasks | 4 files |
| Phase 06 P03 | 7min | 3 tasks | 4 files |
| Phase 07 P01 | 4min | 2 tasks | 5 files |
| Phase 07 P03 | 8min | 2 tasks | 3 files |
| Phase 07 P02 | 2min | 2 tasks | 2 files |
| Phase 08 P01 | 2min | 2 tasks | 2 files |
| Phase 08 P02 | 3min | 2 tasks | 3 files |
| Phase 08 P03 | 3min | 2 tasks | 2 files |
| Phase 09 P03 | 3min | 2 tasks | 4 files |
| Phase 09 P01 | 3min | 2 tasks | 1 files |
| Phase 09 P02 | 4min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 Roadmap]: 4 phases (6-9) -- Core Capability, Team Room, Cross-Meeting Intelligence, Knowledge Graph
- [v2.0 Roadmap]: Phase 6 bundles all MEET requirements (transcript filing + Velma transcription + speaker ID + classification + provenance + summary)
- [v2.0 Roadmap]: Phase 7 combines TEAM + ARCH requirements (team directory structure + meeting archive + cross-linking)
- [v2.0 Roadmap]: Phase 8 combines XMTG + RDAI requirements (cross-meeting intelligence + Read AI integration)
- [v2.0 Roadmap]: Phase 9 combines GRAP + DASH + DOCS requirements (graph nodes + dashboard + exports)
- [Phase 6 Decision]: Modulate Velma replaces Whisper for audio transcription (3 cents/hr, REST API, native diarization + emotions, no local Python/PyTorch)
- [06-02]: Velma API URL configurable via env var; full JSON to stderr temp file for downstream emotion parsing; API key resolves env var then .mcp.json
- [Phase 06]: Wicked problem fields (assumptions, perspective, cascade_sections) are required in all meeting artifacts
- [Phase 06]: Dual-storage meeting summary pattern: full narrative in meetings/ dir, compact reference at room root
- [Phase 06]: Speaker profiles use research_status: pending -- web research runs post-pipeline via scripts/research-speaker
- [Phase 06]: Presentation priority: INVALIDATES > CONTRADICTS > CONVERGES > ENABLES > INFORMS
- [Phase 06]: file-meeting is a thin command orchestrating 6 pipeline steps conversationally; speaker research runs post-pipeline only
- [Phase 07]: Phase 7 profiles add roles (list) + primary_role alongside backward-compat role (singular)
- [Phase 07]: Contributions section computed by compute-team, not filed manually to subfolders
- [Phase 07]: Nested attribution block replaces flat speaker/speaker_role fields in artifact frontmatter
- [Phase 07]: metadata.yaml created LAST in archive so counts reflect completed processing
- [Phase 07]: Past meeting lookup uses grep across metadata.yaml -- no indexing needed at Tier 0
- [Phase 07]: set -e without pipefail for grep-heavy extraction scripts (pipefail kills grep no-match)
- [Phase 08]: Only one meeting source active at a time (read-ai OR vexa OR recall-ai)
- [Phase 08]: Three-script computation chain: compute-state -> compute-team -> compute-meetings-intelligence
- [Phase 08]: Action item lifecycle is simple open/done with 70% confidence threshold for cross-reference matching
- [Phase 09]: Executive summary and logical claim in meeting-report are data-driven, not AI-generated
- [Phase 09]: Concept nodes only for 2+ file references; unresolved concepts get separate CSS class; source_type on all edges
- [Phase 09]: Edge labels use HTML tooltip on hover rather than Cytoscape label property
- [Phase 09]: Timeline animations use setInterval with sin/cos oscillation for edge pulsing

### Architectural Evolution (from Live Data Room Paper)

The paper (docs/research/LIVE_DATA_ROOM_JTBD_PAPER.md) revealed 7 gaps in v1.0 that v2.0 must address:

1. **Wicked Problem Management** — ventures are wicked problems (Rittel & Webber 1973). The Data Room is NOT a document repository. It is a wicked problem management system where the problem co-evolves with the solution. The plugin must treat every venture as exhibiting all 10 wicked characteristics.

2. **Nested System Cascade** — changes in one room section cascade to others (Simon 1962). When a meeting insight changes solution-design, the system must detect impacts on financial-model, legal-ip, team-execution. Phase 6 filing must include cascade detection after each filed segment.

3. **Assumption Tracking** — every claim is a node with validity status. "TAM is $190M" is an assumption that can become stale. The #1 underserved outcome: "Minimize time to detect invalid assumptions." Room artifacts should include `assumptions:` in frontmatter.

4. **Rejection as Data** — when user REJECTs a suggested filing in confirm-then-file, the reason becomes graph data. Phase 6 must capture rejection reasons during meeting filing.

5. **Bidirectional Stage Progression** — the venture stage can REGRESS. Well-Defined → Ill-Defined after market feedback. compute-state should support regression, not just forward progression.

6. **Multi-Stakeholder Views** — the SAME data means different things to mentor vs investor vs researcher vs team member. Phase 6 speaker role classification is the foundation for multi-stakeholder intelligence.

7. **Meeting as Primary Knowledge Source** — institutional knowledge lives in conversations. The meeting filing feature is not just a feature — it is the gateway to wicked problem management. Conversations produce the highest-quality venture intelligence.

**Impact on Phase 6:** The file-meeting command must be designed as a WICKED PROBLEM MANAGEMENT tool, not just a transcript processor. Each filed segment should:
- Track the assumption it implies
- Note the speaker's role-specific perspective
- Detect cross-subsystem cascade impacts
- Capture rejection reasons when user skips a segment
- Support the claim that "conversations are the primary knowledge source"

### v2.0 Milestone: HSI & Reverse Salient Integration

The HSI (Hybrid Similarity Index) and Reverse Salient Discovery tools are the COMPUTATIONAL ENGINE for auto-relationship building in the Data Room graph. They are integrated into the v2.0 milestone as follows:

| Phase | HSI/RS Integration |
|-------|-------------------|
| **Phase 6 (Stage 1)** | Plan 06-03 builds the cross-relationship discovery loop. Tier 0 = keyword matching (analyze-room). Tier 1 = LSA + lightweight embeddings (MiniLM). Tier 2 = LSA + Pinecone + Neo4j (Brain). |
| **Phase 7 (Team Room)** | HSI runs across speaker contributions — finds hidden connections between what different team members/mentors/advisors said across meetings. |
| **Phase 8 (Cross-Meeting)** | Full Reverse Salient pipeline: LSA similarity matrix + semantic similarity matrix → differential → top pairs = hidden cross-meeting connections. |
| **Phase 9 (Knowledge Graph)** | HSI-discovered edges (ENABLES, INFORMS, CONTRADICTS, CONVERGES, INVALIDATES) become first-class graph edges in dashboard. Timeline view shows when connections were discovered. |

**Reference files:**
- `references/hsi/HSI-TOOLS-REFERENCE.md` — adapted tools with plugin integration patterns
- `docs/research/LIVE_DATA_ROOM_JTBD_PAPER.md` — theoretical backbone (wicked problems + nested systems)
- Original HSI codebase: lsa.py, sts_bert.py, comparison.py, hybrid_index.py, lsa_bert_similarity.py

**The tiered approach (Tier 0/1/2) matches plugin's graceful degradation:**
- Tier 0 (no deps): keyword-based cross-references (already works in v1.0 analyze-room)
- Tier 1 (lightweight): LSA + sentence-transformers MiniLM (~80MB, CPU-friendly) — auto-discovers hidden connections
- Tier 2 (Brain): Full HSI with Pinecone embeddings + Neo4j storage — quantitative reverse salient detection

### Pending Todos

- **Trained Lawrence model (PAID TIER)**: Fine-tune on real teaching transcripts
- **Website needs update**: mindrianos-jsagirs-projects.vercel.app content refresh
- **Brain MCP server hosting**: No remote brain.mindrian.ai yet — Option B (shared read-only Brain) is the moat
- **Pivot Simulator**: "What-if" command that shows cascade impact across rooms (from paper Section 4.2)
- **Continuous Scouting Agents**: Grant Scout, Investor Scout, Advisor Scout on schedules (from paper Section 4.2)
- **Assumption validity UI**: Track staleness of claims across room sections
- **Live output connections**: Exports that update when room changes (not one-way snapshots)

### Blockers/Concerns

- Read AI MCP availability and API stability (RDAI-01/02/03) -- Phase 8 dependency
- Nested room structure migration: v1 users have flat 8-section rooms. v2 adds team/ and meetings/. Migration must be non-breaking.
- Assumption tracking adds frontmatter complexity to every artifact. Must be optional/progressive — don't break existing room artifacts.
- sentence-transformers MiniLM (~80MB) needs to be installed for Tier 1 HSI. Add to setup command or lazy-install on first use.

## Session Continuity

Last session: 2026-03-24T10:03:21.055Z
Stopped at: Completed 09-02-PLAN.md
Resume command: /gsd:execute-phase 6
Resume file: None

### Key Files for Next Session
- `.planning/phases/06-stage1-core-capability/06-01-PLAN.md` (Wave 1: meeting reference library + tests)
- `.planning/phases/06-stage1-core-capability/06-02-PLAN.md` (Wave 1: Velma audio transcription)
- `.planning/phases/06-stage1-core-capability/06-03-PLAN.md` (Wave 3: file-meeting command + research-speaker)
- `.planning/phases/06-stage1-core-capability/06-04-PLAN.md` (Wave 2: cross-relationship patterns + room intelligence)
- `.planning/phases/06-stage1-core-capability/06-RESEARCH.md` (Phase 6 research)
- `CLAUDE.md` (ICM x Wicked Problem Management architecture)
- `references/hsi/HSI-TOOLS-REFERENCE.md` (HSI tools for auto-relationship builder)
- `docs/research/LIVE_DATA_ROOM_JTBD_PAPER.md` (theoretical backbone)
