---
type: directory-identity
name: lib/brain
section: lib/brain
purpose: Brain-facing helpers -- the framework-chain recommender that seeds a workflow from the Brain's FEEDS_INTO graph. Everything here goes through lib/core/brain-client.cjs (the Canon-Part-8-sanitized chokepoint).
founding_phase: 122
phase: 122
milestone: v1.13.0-beta.10
canon_parts: [3, 8]
created: 2026-05-12
---

# lib/brain/

`lib/brain/` is the home for the small set of helpers that read the Brain's methodology graph. Phase 122 is the founding phase; the chain recommender is the first contained surface. Nothing in this directory talks to the Brain directly -- every Brain touch goes through `lib/core/brain-client.cjs`, the single Canon-Part-8-sanitized chokepoint.

## Files in this section

| File | Plan | Purpose |
|------|------|---------|
| `chain-recommender.cjs` | 122-03 | `recommendFrameworkChain({ problemType?, currentFramework?, roomState? }) -> [frameworkName, ...]` (ordered, length 1..4, seed first). Picks a seed framework (reusing `lib/core/problem-type-router.cjs` -- problemType / activeJtbd / currentFramework -> seed), walks FEEDS_INTO from it (reusing `lib/core/framework-chain-composer.cjs` `proposeNextFramework` over already-parsed edges supplied via `roomState`), and degrades to `[seed]` when there is no outgoing FEEDS_INTO edge, no Brain, or any error. Returns framework names ONLY -- `composeWorkflow()` (the resolver in `lib/workflow/`) attaches the commands. |

## Canon Part 8 boundary (names + enums only, never user content, never commands)

The chain recommender's Brain-facing payload carries ONLY framework names and problem-type / phase enums (the `brain-client.sanitizeCypherInput` whitelist), bound as `$`-params -- never a command literal, never user content (no artifact bodies, no meeting text, no proprietary numbers). The file is free of any `/mos:` command literal; the navigation-engine wiring (Phase 122-04) that performs the live FEEDS_INTO query does so through `brain-client.query` with the seed bound via `sanitizeCypherInput`. The pre-commit / test grep guard from 122-02 enforces the no-command-near-Brain rule across `lib/workflow/` and `lib/brain/chain-recommender.cjs`.

This directory is the OUTBOUND side of the Brain boundary: it queries the Brain for generic methodology (the FEEDS_INTO chain), and it never sends LOCAL bytes the other way. The resolver in `lib/workflow/` is the side that never touches the Brain at all.

## Hard dependency (DONE)

The chain recommender depends on brain-cleanup Phase 5 (`enrichCausalEdges` rewritten to traverse `FEEDS_INTO` instead of the now-zero `CO_OCCURS` edges) -- that is DONE per `.planning/phases/122-workflow-layer/122-RESEARCH.md` and `.planning/STATE.md`, so nothing here is externally blocked.

## Decision #15 compliance

Per `CLAUDE.md` Decision #15, every directory in the data room (and the lib tree by extension under this milestone's policy) carries a ROOM.md identity file. `lib/brain/` is bound to Phase 122; subsequent additions update this file's "Files in this section" table. No MINTO.md required at this level -- the `.room-root` cascade scope is `room/`, not `lib/`.

## Cross-references

- Spec: `.planning/WORKFLOW-LAYER-SPEC.md`
- Phase 122 PLAN: `.planning/phases/122-workflow-layer/122-03-PLAN.md`
- Phase 122 RESEARCH: `.planning/phases/122-workflow-layer/122-RESEARCH.md`
- Sibling: `lib/workflow/ROOM.md` (the resolver -- the no-Brain side), `lib/core/brain-client.cjs` (the chokepoint), `lib/core/framework-chain-composer.cjs` + `lib/core/problem-type-router.cjs` (the reused engines)
- Canon: `docs/MINDRIAN-CANON.md` Parts 3, 8
- Frontmatter contract: `docs/COMMAND-FRONTMATTER.md`
