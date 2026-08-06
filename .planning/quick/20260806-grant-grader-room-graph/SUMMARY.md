---
status: complete
---
# Summary: grade-grant room-mode + roadmap + decompose + graph substrate

Shipped in three atomic commits (no release cut, no version bump -- explicitly out of
scope; the work folds into the open v1.16.0-beta.10 Unreleased section):

- `2b2fd4ec` engine + substrate: room_section on every tnufa criterion (schema +
  validateRubric fail-closed vocabulary), sectionMap / buildRoadmap /
  askBrainForStrategy pure functions, MAPS_TO_SECTION minted additively in
  ALLOWED_EDGE_TYPES, lib/core/navigation/grant-rubric.cjs writers
  (writeGrantRubricGraph + writeGradingSectionEdges) re-exported on navigation.cjs.
  tests/test-grade-grant.cjs 18/18 (10 prior untouched).
- `a6219380` command surface: three input modes (room-mode preferred / paste kept /
  decompose inverse), the build-roadmap step, the D1 room-targeting decision recorded
  in the command body (NEW dedicated tnufa-app-<slug> room via navigation.birthRoom,
  NEVER the active venture room), Brain structural-strategy step, node+graph filing.
  Skill mirror + command-registry + harness-manifest regenerated.
- (this commit) CHANGELOG fold + planning record + STATE.md row.

## Verification

- `node tests/test-grade-grant.cjs`: 18/18.
- Gates all green: build-connector-registry (--check OK), build-orchestration-projection
  (--check OK), build-command-registry (113), build-skill-mirrors (--check OK at commit),
  build-harness-manifest, build-render-coverage / check-render-coverage (0 gap),
  check-substrate (zero hits on the new files), mva-rule-linter (compliant 1/1),
  check-shape-declaration --check: 53-54 pre-existing advisory WARNs, ZERO mentioning
  grade-grant -- no new warning introduced.

## Honest notes

- PRE-EXISTING failure, not caused here, verified identical at HEAD by stashing the
  edges.cjs change: tests/test-edges-*-floor.cjs + test-218-edge-vocab.cjs fail with
  "table edges has no column named review_status" because their OWN in-memory DDL
  predates the Phase 224 edges.review_status migration. Membership/floor checks (the
  part my change touches) pass; the live-write check fails identically without my
  change. Already surfaced in .planning/debug/handoff-eureka-entity-noise-2026-07-19.md.
  Left un-fixed here deliberately (out of quick-task scope; would muddy atomicity).
- A first attempt at commit 1 swept ~30 unrelated untracked files (.planning/debug/*,
  prototypes/, docs/MINDRIANOS-PRD.md, dist/zed/) into the commit -- something outside
  the explicit `git add` staged them (the repo's pre-commit hook contains no `git add`;
  suspected harness file-changed side effect). Caught immediately, `git reset --mixed
  HEAD~1`, re-committed with explicit `git commit -- <pathspecs>` so exactly the
  intended files landed. Final commits verified file-exact.
- Decompose-mode is a COMMAND-ORCHESTRATED flow (birthRoom + section filing by
  sectionMap + re-grade), not an engine function: the engine stays pure, the command
  owns HITL gates and filing, mirroring how ignite owns birth. No automated
  venture-room merge-back (deliberate).
