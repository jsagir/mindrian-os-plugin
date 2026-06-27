---
kind: context
phase: 186
slug: corpus-stats-hygiene
milestone: v1.15.0
created: 2026-06-27
canon_parts: [6, 8]
depends_on: []
status: planned
class: CODE
priority: P1
---

# Phase 186 - CORPUS: Stats Hygiene

## Why it is here

The repo carries stale corpus literals (748 frameworks / 27,804 nodes / 12,413 vectors and
older: 23K, 313, 275+, PROJECT.md "21K+ nodes / 1,427 embeddings"). Live verified ground
truth is 27,904 nodes / 177 frameworks / 12,485 Pinecone vectors (1024-dim). A1/A3 from the
investigation brief: one generated stats artifact + a --check tripwire so the numbers stop
drifting, and the stale live-surface literals get repointed.

## Scope

1. **Generate** `docs/CORPUS-STATS.generated.md` (and/or `.json`) - the single source of truth
   for corpus magnitudes. Header marks it generated (do not hand-edit).
2. **--check tripwire** wired into the existing R9 enforcement surfaces (pre-commit +
   release.sh + doctor where the other generators already hook), mirroring the
   build-connector-registry.cjs / build-orchestration-projection.cjs --check idiom. Fails on a
   stale literal outside the artifact.
3. **Repoint** the stale literals on LIVE fact surfaces to the live numbers.

## Locked decisions

- **D1 - live numbers (verified ground truth ONLY):** 27,904 nodes / 177 frameworks /
  12,485 Pinecone vectors (1024-dim). These three are the only asserted magnitudes.
- **D2 - directional sub-counts are NOT asserted as fact.** The teaching-graph sub-counts
  (176/76/56/383/203/171 etc.) are DIRECTIONAL ONLY, zero source-of-truth, admin-gated (do-NOT
  list). The artifact either omits them or labels them directional-only; the tripwire never
  enforces them.
- **D3 - figures-correction, NOT a doctrine amendment.** This is the same class of change as
  Appendix D entries 13 and 16 (corpus-figures-corrected). It does NOT touch canon doctrine, does
  NOT move a frozen set, and is NOT an entry-32-class user-outcome amendment - so it is NOT blocked
  by the entry-31 self-binding clause. No navigator reading required. If a canon figures-correction
  provenance note is warranted, it is added as a new dated entry, NOT by rewriting an existing one.
- **D4 - historical provenance is FROZEN; only LIVE surfaces are repointed.** The tripwire and
  the repoint EXCLUDE: the canon Appendix D entries (13/16 deliberately record the OLD numbers as
  dated history), CANON-PHASE-MAP version-history rows, every `.planning/` dated artifact
  (session handoffs, SUMMARY.md, VERIFICATION.md, debug autopsies), and any file whose number sits
  inside a dated/historical record. Rewriting a dated provenance record would falsify history.
  LIVE surfaces TO repoint: CLAUDE.md moat block + "Brain" table, docs/THE-BRAIN.md live numbers,
  docs/brain-setup.md, PROJECT.md description + stack rows, and the live (non-provenance) prose in
  docs/MINDRIAN-CANON.md / CANON-PHASE-MAP.md if any sits outside a dated entry.
- **D5 - Part 8 + no em-dashes.** Generator is LOCAL, reads no Brain (the magnitudes are passed
  in / read from a committed source, NOT a live Brain query on the hot path). Hyphens only.

## Acceptance

- `docs/CORPUS-STATS.generated.*` exists with the three verified magnitudes; header marks generated.
- The --check tripwire fails on a stale literal on a LIVE surface and is wired into pre-commit/release.
- Zero stale-literal hits on LIVE surfaces (historical provenance allow-listed, documented in the
  tripwire's exclude list).
- No directional sub-count asserted as fact. No em-dashes. Part 8 clean.

## REQ
- CORPUS-01: generated stats artifact (single source of truth) + the three live magnitudes.
- CORPUS-02: --check tripwire with the historical-provenance exclude list + LIVE-surface repoint.

## Next
Plan lean (research not needed - this is a mechanical sweep with a known exclude rule): then execute.
