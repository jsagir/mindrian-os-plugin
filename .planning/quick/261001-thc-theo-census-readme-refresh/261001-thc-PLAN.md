---
quick_id: 261001-thc
slug: theo-census-readme-refresh
date: 2026-10-01
mode: quick (inline)
---

# Quick 261001-thc: refresh Theo census numbers in README

Goal: README states the live Theo graph size. Current README says 27,951 nodes / 452 frameworks
from a census dated 2026-09-11; Theo Phase 20.4 added MENTIONS edges since.

## Task 1: regenerate the census (read-only against Theo)
- `node scripts/build-brain-census.cjs --lane-a` then `--lane-b`.
- Script writes ONLY docs/BRAIN-GRAPH-CENSUS.generated.md and data/brain-census.generated.json
  (verified by reading writeOut()). Tools called: brain_stats, brain_schema, brain_query (read),
  normalize_framework_name, orchestration_readiness, discover_structure. No writes to Theo.
- If Theo is unreachable or the key is missing: stop, invent nothing.

## Task 2: update README
- Replace node / framework counts and the census date with values from the regenerated census.

## Scope fence (peer session executing Phase 365)
- Touch only README.md, the two census outputs, and this quick dir. No STATE.md / ROADMAP.md.
- Commit with `git commit --only`. No push.
