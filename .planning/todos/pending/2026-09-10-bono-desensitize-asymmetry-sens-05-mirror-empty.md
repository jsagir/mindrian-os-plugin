---
created: 2026-09-10
title: "run-all-223 leg 'DESENSITIZE asymmetry' fails: commands/bono.md declares SENS-05 but the sensor mirror is []"
area: harness
files:
  - commands/bono.md
  - tests/run-all-223.sh
  - data/connector-registry.json
source: "Surfaced while closing quick task 260910-dk1 (2026-09-10); reproduced at the quick task's parent commit in a throwaway worktree, so it pre-exists that change. commands/bono.md last touched by 31c7fe17 (fix(274-02), 2026-09-01)."
status: pending
---

## Problem

`bash tests/run-all-223.sh` reports one FAIL: `DESENSITIZE asymmetry: bono command SENS-05 vs mirror []`.
The bono command's frontmatter declares sensor SENS-05, but the mirror the leg reads (the connector /
sensor registry side) carries no sensor for bono, so the two sides of the declaration disagree. The leg
is a symmetry tripwire from Phase 222/223; the asymmetry means either bono's SENS-05 declaration is stale
or the mirror lost the entry (possibly in the 274-02 script-invocation anchoring, 2026-09-01).

## Fix shape

Decide which side is truth (the connector registry is the declared authority per lib/core/insight-sensors.cjs
SENSOR_REGISTRY conventions), regenerate the mirror or remove the stale declaration, and re-run
`bash tests/run-all-223.sh` to FAIL=0. Small; one commit.
