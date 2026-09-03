# Phase 296: SEED-030: RS Pipeline Spine-Wiring + Expert-Graph Reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 296-SEED-030: RS Pipeline Spine-Wiring + Expert-Graph Reconciliation
**Areas discussed:** RS vector repoint mechanism, R-expert scope confirmation

---

## RS vector repoint

| Option | Description | Selected |
|--------|-------------|----------|
| Point Python at local data | Keep rs-engine.py/rs_corpus.py in Python, read the same local room.db vector table embedding-spine.cjs already writes, instead of Pinecone. No cross-language bridge, no new dependency. | ✓ |
| Defer to SEED-013 (Python elimination) | Leave rs-engine.py on Pinecone untouched; let the separate Python-elimination phase (SEED-013/283) rewrite it in CJS wholesale later. | |
| Port rs-engine.py to CJS now, inside this phase | Pull the CJS port forward into Phase 296 instead of waiting for 283. | |

**User's choice:** Point Python at local data (Recommended option, session run in express/single-round mode given SEED-030's own file already functions as a near-complete acceptance-criteria spec).
**Notes:** Keeps this phase's scope tight (data-source swap only) and avoids conflating it with Phase 283's separate, larger Python-elimination scope.

---

## R-expert scope confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep remote, degrade gracefully | rs-experts stays remote-Brain Mode-A (people + teaching-graph data, real Brain IP per Canon Part 8); this phase adds a clean "Brain unreachable" message instead of a crash. | ✓ |
| Descope rs-experts entirely | Drop the expert-network capability rather than maintain the remote coupling. | |

**User's choice:** Keep remote, degrade gracefully (matches SEED-030's own Option A recommendation - this confirms the seed's "LOCKED-pending" flag as final, not a re-litigation).
**Notes:** No new reasoning needed beyond what SEED-030 already argued; this was a confirmation pass, not a fresh debate.

---

## Claude's Discretion

- Exact wording of the "Brain unreachable" degrade message.
- Whether the Python-side local-vector read uses a direct sqlite3 connection or a thin CJS-side export step (research-time call, D-02 in CONTEXT.md).

## Deferred Ideas

- Porting rs-engine.py/rs_corpus.py to CJS - Phase 283 (SEED-013)'s scope, not this phase's.
- SEED-057 (Phase 316, synthesis-as-votable-expert) - a downstream consumer of this phase's work, explicitly out of scope here. Flagged as newly-unblocked (all three of its own trigger conditions confirmed satisfied 2026-09-03) for a separate discuss-phase pass.
