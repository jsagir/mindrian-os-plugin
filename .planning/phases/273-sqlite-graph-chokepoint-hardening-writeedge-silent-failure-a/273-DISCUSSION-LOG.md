# Phase 273: SQLite Graph Chokepoint Hardening (writeEdge silent-failure + propagation-gap fixes) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 273-sqlite-graph-chokepoint-hardening-writeedge-silent-failure-a
**Areas discussed:** Fix scope, C3 Brain edge-type bypass, M2 cross-room fence, M4 substrate baseline

---

## Fix scope

| Option | Description | Selected |
|--------|-------------|----------|
| Two highest-value fixes now | writeEdge changes-aware + PRAGMA table_info(edges) fallback — closes C1+C2 together, per the reviewer's own verdict. Fast-follow the rest. | ✓ |
| Full propagation sweep in this phase | Fix all 5 Criticals and carry every good fix to every sibling site in one phase. | |

**User's choice:** Two highest-value fixes now (recommended option accepted).
**Notes:** None — recommendation accepted as presented.

---

## C3 — Brain edge-type bypass

| Option | Description | Selected |
|--------|-------------|----------|
| Fix defensively now | Route ingestion.cjs's raw edge insert through writeEdge/the allowlist regardless of original intent. | ✓ |
| Investigate intent first | Dig into Phase 109-08 vs 125-00 history before touching the code. | |

**User's choice:** Fix defensively now (recommended option accepted).
**Notes:** None — recommendation accepted as presented.

---

## M2 — cross-room fence

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the comment only | The fence already holds structurally via writeEdge's (db, params) signature; correct the comment, no new runtime code. | ✓ |
| Add a real runtime assertion too | Belt-and-suspenders explicit check on top of fixing the comment. | |

**User's choice:** Fix the comment only (recommended option accepted).
**Notes:** None — recommendation accepted as presented.

---

## M4 — substrate baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Burn it down first, then update baseline | Treat 208 as real debt, fix overlapping sites (e.g. C3), re-measure, then set the baseline to the honest post-fix number. | ✓ |
| Just regenerate the baseline at 208 | Accept 208 as the new documented floor now; treat debt reduction as separate future work. | |

**User's choice:** Burn it down first, then update baseline (recommended option accepted).
**Notes:** None — recommendation accepted as presented.

---

## Claude's Discretion

- Exact commit/wave sequencing of D-01 through D-04.
- Whether C3's fix routes through `writeEdge` directly or applies an equivalent inline allowlist check.

## Deferred Ideas

- Full propagation sweep (C4/M5/M6/M7/M8/M9/M10/M11) — registered as a fast-follow phase, not lost.
- M12 schema unification / U-2 bidirectional traversal via the `simple-graph` reference pattern.
- SEED-075 (gated on this phase's Criticals landing first, per its own sequencing note).
