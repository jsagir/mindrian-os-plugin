---
phase: 122
slug: workflow-layer
full_name: "Workflow Layer -- framework <-> command registry + reliable invocation"
status: registered
created: 2026-05-11
milestone: v1.13.0
beta_target: beta.10
priority: CRITICAL (highest), ships LATE -- the v1.13.0 capstone
authority: .planning/WORKFLOW-LAYER-SPEC.md
hard_dep: brain-cleanup Phase 5 (enrichCausalEdges -> FEEDS_INTO rewrite) -- for build sub-phase 3 only; brain-cleanup Phase 4 is DONE
brain_impact: NONE (100% plugin-side; the Brain stays methodology-pure)
canon_parts: [Part 7 (Reuse Before Build -- frontmatter as single source of truth), Part 8 (Graph Boundary -- commands never enter the Brain), Part 3 (Decision Gate -- the resolver feeds offer_next_step), Part 4 (Every Choice Is Graph Data -- the navigation hook is deterministic, not model-recalled)]
---

# Phase 122 -- Workflow Layer (framework <-> command registry + reliable invocation)

**STATUS:** REGISTERED 2026-05-11. Spec is LOCKED. Plans not yet written. Per the maintainer: **deep research FIRST** (`/gsd:research-phase 122`), then `/gsd:plan-phase 122`, then `/gsd:review --phase 122`, then `/gsd:execute-phase 122`.

## The authority

`.planning/WORKFLOW-LAYER-SPEC.md` is the spec-locked source of truth for this phase -- read it in full before researching or planning. It carries: the "why" (the highest need), the five reliability rules (single source of truth / generated-not-handwritten + CI tripwire / resolver is the only door / hook is the trigger not the model / degrade-don't-fabricate), the critical path (algorithmic command cohort retrofitted FIRST), the five build sub-phases, the acceptance criteria, and the "what it leverages" section (a HARD requirement -- design it knowing what all of v1.13.0 delivers).

## Why this exists (one line)

Larry can read `Framework -[:FEEDS_INTO]-> Framework` from the Brain but cannot reliably map "the methodology suggests framework X" -> "run `/mos:x`" -- the mapping is not 1:1, some frameworks have no command, and Larry names commands from memory (and sometimes invents non-existent ones, e.g. `/mos:jtbd` -- the real command is `/mos:analyze-needs`). The fix is NOT "put commands in the Brain" (that creates a second store to hand-sync -- the exact drift class brain-cleanup just scrubbed out of Neo4j, and it forfeits the Brain's portability). The fix is the opposite: truth lives in ONE place (the command file's own frontmatter), everything else is generated + CI-checked, and Larry is not permitted to be a source of truth about which command runs what.

## The 5 build sub-phases (from the spec; expect ~5 plans)

1. **Frontmatter contract + retrofit** -- extend the `/mos:` command frontmatter schema (`kind`, `frameworks[]`, `produces`, `inputs[]`, `autonomous_safe`); document as `docs/COMMAND-FRONTMATTER.md`. Retrofit the **algorithmic cohort FIRST** (HSI / whitespace / explore-domains / research + think-hats / rs-pipeline / find-* / diagnostics / scoring / systems / argument-structure), then the rest. Can start immediately.
2. **Registry + generator + CI tripwire** -- `data/command-registry.json` built by `scripts/build-command-registry.cjs` from frontmatter; validated against a `framework-names` list mirrored from a Brain query / `BRAIN-SCHEMA.md`; CI fails on stale registry OR unresolvable framework (mirror the Brain Phase-6 CI-01 tripwire). Can start immediately.
3. **Resolver + chain recommender** -- `lib/workflow/command-resolver.cjs` (the SOLE framework->command path) + `recommendFrameworkChain` (Brain `FEEDS_INTO` traversal) + `composeWorkflow`. **HARD DEP: brain-cleanup Phase 5** (enrichCausalEdges -> FEEDS_INTO rewrite).
4. **Wire the orchestrators** -- route `/mos:suggest-next`, `/mos:pipeline`, `/mos:act`, the `pws-methodology` skill, the `brain-connector` skill, and the navigation hook (engine v1) through the resolver. Partial work can start immediately; full wiring waits on (3).
5. **Skill cleanup + docs + end-to-end** -- prune `pws-methodology` / `brain-connector` of any hardcoded framework<->command maps; `docs/WORKFLOWS.md` + `THE-BRAIN.md`; end-to-end test. Docs can start immediately.

## Out of scope for this phase

- Putting commands into the Brain (Canon Part 8 -- explicitly forbidden by the spec).
- `/mos:jtbd` as a real command (the real command is `/mos:analyze-needs`; the registry will surface the right name).
