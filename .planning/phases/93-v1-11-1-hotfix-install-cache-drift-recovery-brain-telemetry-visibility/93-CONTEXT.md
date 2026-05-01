---
phase: 93
status: complete (retroactive)
gathered: 2026-05-01
source: autonomous-bookkeeping pass
---

# Phase 93: v1.11.1 Hotfix — Context (retroactive)

Retroactive context filed during 2026-05-01 autonomous bookkeeping pass. Phase 93 shipped as v1.11.1 on 2026-04-29 (with v1.11.1-beta.1 cut on 2026-04-28).

<domain>
## Phase Boundary
Two production hotfixes:
1. Install cache drift recovery (`/mos:doctor` --fix)
2. Brain telemetry column-name mismatch fix (auth.cjs / brain-admin.cjs schema alignment + brain_usage_log api_key column)
</domain>

<decisions>
## Implementation Decisions
Hotfix discipline: bug fixes + safety net only, no feature additions. Same 5-gate release pipeline as v1.11.0.
</decisions>
