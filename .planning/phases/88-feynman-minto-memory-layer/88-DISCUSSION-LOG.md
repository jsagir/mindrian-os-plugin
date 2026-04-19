# Phase 88: Per-Folder Memory Triple Wiring -- Discussion Log

> Audit trail only. Not input to planning, research, or execution agents.
> Decisions captured in 88-CONTEXT.md; this log preserves alternatives considered.

**Date:** 2026-04-19
**Phase:** 88-feynman-minto-memory-layer
**Areas discussed:** Navigation vs assets, memory layer wiring, cross-session architecture, per-folder triple coordination
**Audit source:** In-session architecture conversation with Jonathan Sagir, 2026-04-19

---

## Key architectural insights (from conversation)

### Insight 1 -- Skill navigation is below standard; it's the real next-steps engine
Jonathan: "the way mindrian navigates the skills according to context and brain is not yet to standard. this is better then the ask tell dial in the conversion mode. this is the next steps engine isnt it?"

Verdict: Correct. The Ask-Tell dial sits downstream of skill selection. Selection is the missing engine layer. Dial becomes a surface artifact of selection.

### Insight 2 -- Navigation depends on SQL + ICM + Feynman-MINTO
Jonathan: "dependent on sql and the ICM" then extended to "feyminto as logical flow memory"

Verdict: Correct. Layered memory:
- L1 ICM (folder identity, ROOM.md)
- L2 Memory (SQL relational edges + Feynman-MINTO compressed reasoning)
- L3 Navigation (SQL + Feynman-MINTO together produce meaningful paths)
- L4 Assets (wiki, dashboard, deck, export)
- L5 Decision (Navigation Engine consuming L3)

### Insight 3 -- Wiki is L4 asset; navigation is L3 substrate
Jonathan: "wiki is an assists and meyminto nevigates togerther with sql? feynman-minto md + sql"

Verdict: Correct. Wiki is a rendered view of L3 data. SQL + Feynman-MINTO together form the navigation substrate. All L4 assets (wiki, dashboard, deck, exports) render from the same L3 substrate.

### Insight 4 -- Feynman-MINTO not just MINTO
Jonathan: "why only mindto we did feyminto.md file type for condeced memory with minimak neded logical"

Verdict: Correction accepted. Feynman-MINTO is a specific file type with pre-compressed narrative. The Feynman compression is load-bearing for cross-session viability. Raw Minto pyramids would blow context budget; Feynman-MINTO under 1500 tokens per section fits.

### Insight 5 (CRITICAL) -- Memory is a TRIPLE, not a single file
Jonathan: "Feynman-MINTO is pre-compressed together with a sate.md and the ROOM.md! room.md complies all reffrececes!"

Verdict: Architectural correction. The unit of per-folder memory is ROOM.md + STATE.md + Feynman-MINTO.md, not Feynman-MINTO alone:
- ROOM.md compiles references (what belongs here, what cross-links exist)
- STATE.md holds quantitative state (counts, completeness, activity timestamps)
- Feynman-MINTO holds compressed logical flow (governing thought, arguments, evidence)

STATE.md is already wired (on-stop writes it). ROOM.md is partially wired (written at creation, not re-compiled as references drift). Feynman-MINTO is unwired. Phase 88 wires the TRIPLE, not just Feynman-MINTO.

Phase renamed and rescoped:
- Original draft: "Feynman-MINTO Cross-Session Memory Layer" (11 plans)
- Revised: "Per-Folder Memory Triple Wiring" (13 plans, adds ROOM.md recompiler plan + unified folder-memory.cjs read contract covering all three)

---

## Decisions captured

### D-01: Phase 88 scope
The phase wires the per-folder memory triple (ROOM.md + STATE.md + Feynman-MINTO.md) as a coordinated memory layer across session boundaries. STATE.md contract preserved unchanged. ROOM.md gets a recompile-references mechanism. Feynman-MINTO gets freshness (post-write), close-out snapshot (on-stop), restore-injection (session-start), compact resilience (pre/post-compact), and decision log persistence.

### D-02: Read contract name
`lib/core/folder-memory.cjs` (not `lib/core/minto-signal.cjs`). Reads all three files via single `readTriple(sectionPath)` export. Single source of truth for all consumers.

### D-03: ROOM.md recompile strategy
ROOM.md references section is machine-managed between clear delimiter markers. Everything outside the markers is preserved. mtime conflict detection prevents stomping manual edits made between sessions.

### D-04: Debouncer coalescing window
10 seconds per section. Prevents regen storm during rapid edits. Drained at UserPromptSubmit for items older than 30s, and at on-stop synchronously with 5s timeout.

### D-05: Session-start budget cap
TRIPLE_CONTEXT block capped at 20% of total session-start budget. Truncation order: weakest reasoning_health_score first (most informative signal preserved).

### D-06: decision_log location
In Feynman-MINTO.md frontmatter (structural Minto shell, not Feynman narrative). 20-entry cap per section. Archive older to `.mindrian/decision-archive/YYYY-MM/`. Preserved across Feynman regen because field lives in shell, not body.

### D-07: Dual-write for decisions
APPROVE/REJECT/DEFER cascade (Phase 69) now dual-writes: existing graph capture + new decision_log capture. Graph remains source of truth for cross-session queries. decision_log is read-optimized for session-start injection.

### D-08: Phase ordering
- Phase 87 (v1.10.11 + v1.10.12) must ship first
- Phase 88 (this phase) ships v1.10.13
- Phase 89 reverse-salient-engine (already allocated)
- Phase 90 Navigation Engine (renamed from Skill Offer Engine; consumes folder-memory.cjs)

Skill Offer Engine / Next-Steps Engine / Navigation Engine naming converged to **Navigation Engine** (reads L3 substrate to produce L5 decisions).

### D-09: Tier-0 fallback preserved
If Feynman regen fails (no Claude session, no Brain, offline), Phase 81 tier-0 fallback produces deterministic MINTO + AAAK footer. Phase 88 does not break this contract.

### D-10: Wiki and assets remain unchanged
Wiki (Phase 82 fix), dashboard (Phase 87-08), deck export (MOSDeckEngine), Obsidian vault (Phase 78) all remain as-is. They render from L3 substrate. Improvements to L3 propagate automatically.

---

## Claude's Discretion

- Exact format of TRIPLE_CONTEXT block in session-start injection (sketch provided, planner may refine)
- Archive folder structure under `.mindrian/decision-archive/` (YYYY-MM hierarchy suggested)
- Fixture naming for cross-session acceptance test (implementation detail)

---

## Deferred ideas (tracked for future phases)

- **Brain cross-reference on governing_thought** -- Phase 90 candidate. When Feynman-MINTO updates, optional Brain lookup for similar claim patterns. Adds enrichment, not core memory.
- **reasoning_health_score calibration** -- Brain teaching data could train the score. Phase 92 candidate.
- **Multi-room portfolio aggregation** -- TTO archetype use case. Phase 93+ candidate after Collaborative Mode.
- **UI rendering of decision_log** -- Dashboard surface in Phase 87-08 already or later. Not blocking this phase.
- **Triple merge conflicts in collaborative sessions** -- Phase 91 Collaborative Mode.
- **LaTeX bridge using folder-memory** -- Separate phase from 2026-04-19 meeting audit findings.
