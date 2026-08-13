# Roadmap: MindrianOS Plugin

**Current state:** between milestones. v2.0.0 "Build the Loop" completed 2026-08-13; the next
milestone has not been defined yet. Run `/gsd-new-milestone` to start the next cycle
(questioning -> research -> requirements -> roadmap).

## Completed Milestones

- **v2.0.0 "Build the Loop"** (completed 2026-08-13): 7 phases (246-252), 19 plans. The
  local-context -> Brain -> Larry-join -> HITL loop shipped live with honest refusal
  everywhere; released as the v2.0.0-beta train (latest verified v2.0.0-beta.5).
  20/23 requirements closed; SWEEP-02 / CACHE-03 / AVAIL-03 carried open by navigator
  ruling. Full detail: `.planning/milestones/v2.0.0-ROADMAP.md` +
  `.planning/milestones/v2.0.0-REQUIREMENTS.md`.
- **v1.16.0 "Infrastructure Remediation"** (completed 2026-08-10): 12 phases (235-245),
  67 plans. Archives: `.planning/milestones/v1.16.0-ROADMAP.md` +
  `.planning/milestones/v1.16.0-REQUIREMENTS.md`.
- **v1.15.0 "The Cockpit"** and earlier: see `.planning/MILESTONES.md` (honest-close
  records; v1.14.0/v1.15.0 rolled forward without formal archives).

## Carried Forward (not silently dropped)

- SWEEP-02 fixture inversion: floor-gated; the path is source-authored enrichment payloads
  (proven template: payload -> ingest dry-run -> card -> fixture) until
  `check-flagship-floor.cjs` exits 0.
- CACHE-03 closing evidence: live 10+ turn session hit-rate measurement (>= 0.91).
- AVAIL-03: mindrian-brain suspension + restore rehearsal (operator).
- Gate 0 foreign-host verify (234-08 Task 2, navigator's own hands).
- Bolt-capable checkpoint queue: 7 vector-index DROPs + 1 self-loop DELETE
  (Nested Hierarchies 42214).
- Pipeline fixes filed by the 2026-08-11 admin sitting: ingest live-node prop drop, 429
  refusal mislabel, normalizeName alias-awareness.

**Phase numbering continues from 252** - the next milestone's first phase is 253.
