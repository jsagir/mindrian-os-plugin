---
phase: 137
slug: brain-mindrianos-sync-compat-harness
status: scoped-backlog (v1.14.0; captured 2026-06-01, NOT built in v1.13.1)
priority: P1 -- operationalizes the 130.7 dual-graph contract into a standing harness + recurring sync
created: 2026-06-01
milestone: v1.14.0
origin: user request 2026-06-01 mid-130.7 execution -- "a harness that any brain change gets a full mindrianOS compatibility and vice versa; a weekly sync checkup with a trigger pipeline workflow that does the sync between remote brain and local brain, as mentioned in 1.13.1"
canon_parts:
  - Part 6 (dog-fooding -- the plugin tests its own Brain<->local coherence on a schedule)
  - Part 8 (graph boundary -- the sync job is read-only on both sides; enum/correlation_id projection only; no user content to Brain, no Brain IP to CI logs)
  - Part 9 (memory locality -- local brain aggregates resolve to canonical teaching-graph correlation_ids; this harness measures that resolution stays intact over time)
  - Part 10 (Larry's chain-recommender coherence depends on local<->remote staying in sync)
depends_on:
  - Phase 130.7 correlation-id-contract-dual-graph-ci-gates (THE substrate -- this phase turns its one-shot release-candidate CI gate into a standing bidirectional harness + recurring job)
  - Phase 127 brain-mcp-local-stdio-shim (bin/local-chain-recommender.cjs -- the "local brain" side of the sync)
  - Phase 122 workflow-layer (lib/brain/chain-recommender.cjs -- the "remote brain" recommender)
brain_impact: NONE (LOCKED read-only -- see decision 2)
hotfix_discipline: NO (net-new CI surface + scheduled job)
estimated_days: 2-3

# LOCKED DECISIONS (AskUserQuestion 2026-06-01)
decisions:
  placement: "v1.14.0 backlog. Do NOT build inside the frozen v1.13.1 chain (130.5/130.7/131/132). Build after v1.13.1 ships."
  sync_semantics: "READ-ONLY validate + report. The weekly job reads BOTH graphs, diffs correlation_ids, and REPORTS drift (orphans, cross-label dups, local-vs-Brain mismatch) as an alert/artifact. ZERO writes on either side. No Brain-write hard gate on the recurring job."
  trigger: "New GitHub Actions CI. .github/workflows/brain-sync.yml (schedule: weekly cron) + .github/workflows/brain-compat.yml (on: pull_request). Needs Brain read creds (NEO4J read-only + MINDRIAN_BRAIN_KEY read scope) in CI secrets -- read-only scope only, never write-plan."
---

# Phase 137: Brain<->MindrianOS Sync + Compatibility Harness (v1.14.0)

## Goal

Operationalize the Phase 130.7 dual-graph contract into TWO standing surfaces:

1. **Bidirectional compatibility harness (per-change).** Any Brain change runs a full MindrianOS compatibility check; any MindrianOS change checks back against the live Brain. Surfaced as a PR gate (.github/workflows/brain-compat.yml). This is the 130.7 4-metric CI health check promoted from a one-shot release-candidate gate to an on-PR regression gate, plus the reverse direction (a MindrianOS code change that would break local<->Brain correlation resolution fails the PR).

2. **Weekly scheduled sync checkup (recurring).** A cron-scheduled GitHub Actions job (.github/workflows/brain-sync.yml, weekly) that reads BOTH the remote Brain (Neo4j teaching graph) and the local brain (bin/local-chain-recommender.cjs aggregates + the local correlation_labels index) and REPORTS drift between them. Read-only on both sides. Output: a drift report artifact (orphan correlation_ids per side, cross-label duplicate groups, any canonical_name whose local resolution diverges from the Brain canonical target). Alert on regression vs the recorded baseline.

## Reframe (why this is mostly reuse, not net-new -- Canon Part 7)

130.7 already ships: computeCorrelationId (the hashing chokepoint), the 4-metric dual-graph CI health check (report-only/baseline mode), and the three /mos:brain-derive curation surfaces (--review-anchors, --orphan-census, --cross-label-dups). This phase REPOINTS those into (a) a PR-triggered gate and (b) a scheduled job, and adds the REVERSE direction (MindrianOS-change -> Brain-compat). The new surface is the two GitHub Actions workflow files + the read-only diff/report harness; the measurement logic is reused.

## Scope (LOCKED read-only)

- .github/workflows/brain-compat.yml -- on: pull_request. Runs the 130.7 4-metric gate + the reverse-direction local-resolution check. Fails the PR on regression vs baseline.
- .github/workflows/brain-sync.yml -- schedule: weekly cron. Reads both graphs, emits a drift-report artifact. Read-only. Alerts on regression.
- A read-only diff/report harness (lib or scripts) that consumes 130.7's computeCorrelationId + correlation_labels index + a read-only Brain enumeration (correlation_id + label + canonical_name projection ONLY -- Canon Part 8) and reports divergence.
- Brain read creds wired as CI secrets (read-only scope; NEVER write/admin plan).

## Out of scope (LOCKED)

- Any write-back / reconciliation. The job NEVER mutates the Brain or the local graph. If drift is found, it reports; a human runs the 130.7 backfill (--execute, gated) to repair. (Decision 2: read-only.)
- Local cron / /mos:scheduled-tasks trigger -- the user chose GitHub Actions CI as the trigger surface (decision 3). A local-cron variant is a possible follow-on, not this phase.

## Acceptance criteria (draft -- refine at /gsd:plan-phase)

- [ ] brain-compat.yml fails a PR that would regress any of the 4 dual-graph metrics vs baseline
- [ ] brain-compat.yml fails a PR whose MindrianOS code change breaks local-brain -> canonical-Brain correlation resolution (reverse direction)
- [ ] brain-sync.yml runs weekly, reads both graphs read-only, and uploads a drift-report artifact
- [ ] Zero writes to Brain or local graph from either workflow (Canon Part 8 + decision 2)
- [ ] CI secrets carry read-only Brain scope only (no write/admin plan key in CI)
- [ ] brain-boundary-scan passes: the read-only enumeration projects correlation_id + primary_label + canonical_name only, never user content or Brain IP body text

## Cross-references

- Phase 130.7 CONTEXT + 130.7-03 (the dual-graph CI gate this phase promotes to standing)
- bin/local-chain-recommender.cjs (the local-brain side)
- ~/MindrianRooms/mindrian/mindrianOS/methodology/2026-05-17-brain-curation-audit.md (the original correlation_id + CI-gate design)
