# Phase 149: GSD Planning Artifacts as Local-Graph Members - Discussion Log

> **Audit trail only.** Decisions are in CONTEXT.md; this preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 149-gsd-planning-artifacts-as-local-graph-members
**Areas discussed:** Writer-hook trigger, Backfill + reconcile timing

---

## Writer-hook trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Hook + session-start safety net | PostToolUse hook (immediate CLI) + idempotent session-start reconcile (universal, covers Desktop/Cowork) | ✓ |
| Session-start reconcile only | One idempotent scan at session start; simplest, not real-time | |
| PostToolUse hook only | Immediate but CLI-only; breaks tri-polar | |

**User's choice:** Hook + session-start safety net
**Notes:** The reconcile being idempotent makes hook + reconcile safe (no duplication). Also resolves the unselected tri-polar area.

---

## Backfill + reconcile timing

| Option | Description | Selected |
|--------|-------------|----------|
| Session-start reconcile (one mechanism) | Same idempotent reconcile backfills + re-syncs every session start | ✓ |
| One-time backfill + lazy on /mos:graph | Backfill once; re-sync on graph read; can be stale | |
| Explicit command only | Manual /mos command | |

**User's choice:** Session-start reconcile (one mechanism)
**Notes:** Backfill and ongoing sync are the same code path.

---

## Claude's Discretion

- Tri-polar (not selected) - resolved by the hybrid trigger; reconcile works on all surfaces.
- Lifecycle/prune (not selected) - default create+update+prune-on-archive; planner may simplify.
- Reconcile host - reuse scripts/session-start cascade (Phase 124 analog).
- Requirement-link edge type - reuse INFORMS/FEEDS_INTO; additive only if needed.

## Deferred Ideas

- Per-command INTAKE design (deck / Feynman / generative commands need their own intake: topic, audience, SVG/CSS/animation toggles, PDF download, visual Feynman-per-slide) - Phase 152, captured in the keyboard-TUI research doc Section 12.
- Lifecycle prune as a hard requirement - follow-up if delete-detection is costly.
