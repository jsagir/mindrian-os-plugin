# Phase 311: SEED-052 (smallest slice) - Admin Visibility Into the Recommendation Scorer

## Domain

Wire the already-declared `visibility: admin` command frontmatter field into the Brain
recommendation scorer (`lib/workflow/f-selector-ranker.cjs`, the shipped Phase 191/125-05 D4
formula), so LarryReacts / the F.7 dial never recommends `commands/admin.md` or
`commands/dogfood-flush.md` to a non-admin navigator. This is NOT the full SEED-052 scope
(the 107-command mini-product GSD-ing) - it is explicitly the "smallest experiment" first
slice the seed itself names: "closing 191-03/191-05 + wiring the admin-visibility filter is
the FIRST, smallest slice of this seed's scope."

## Locked Requirements (from the seed, not re-litigated)

- Exactly two commands carry `visibility: admin` today: `commands/admin.md`,
  `commands/dogfood-flush.md`. `commands/help.md` mentions "visibility: admin" in body prose
  (documenting the concept) but does not declare itself admin-only - confirmed by direct grep
  of its frontmatter block, not assumed from the earlier body-text match.
- A non-admin navigator must never see either command surfaced as a recommendation. An admin
  navigator's recommendations are unaffected (visibility-admin commands stay eligible for them).
- Reuse before build (Canon Part 7): `scripts/check-admin-identity.cjs` already ships a pure,
  local, network-free `isAdmin()` (env flag, username/home match, optional allowlist file).
  This phase reuses it; it does not build a second admin-identity check. A separate,
  execution-time gate already exists (`scripts/admin-command-gate.cjs`) - that gate blocks
  RUNNING an admin command; this phase is about RECOMMENDING one, a different concern, same
  underlying identity check.

## Decisions

### Where visibility lives
`data/command-registry.json` currently carries zero `visibility` fields for any of its 113
commands, even though every other scorer input already flows through the registry (single
source of truth, matching the file's own stated Reliability Rule 2: the frontmatter is
authoritative, everything downstream is generated and CI-checked against it).

**Decision: extend `scripts/build-command-registry.cjs`'s generator to mirror each command's
`visibility` frontmatter field (when present) into `data/command-registry.json`.** The `--check`
tripwire's existing drift detection covers the new field automatically once it round-trips
through the same generate-then-diff pattern the file already uses for every other field. Do
NOT have the ranker read `commands/*.md` frontmatter directly - that would give the scorer a
second command-metadata source alongside the registry it already reads everything else from,
duplicating `admin-command-gate.cjs`'s separate frontmatter reader rather than reusing the
registry's own single-source pattern.

### How ranker purity is preserved
`f-selector-ranker.cjs`'s own header states it is a "Pure synchronous function." Calling
`isAdmin()` (which reads env vars and an optional filesystem allowlist) from inside the scorer
would violate that stated contract.

**Decision: the ranker's CALLER computes `isAdmin()` once (via the existing
`scripts/check-admin-identity.cjs`) and passes it into the ranker as an `opts.isAdmin` boolean.**
The scorer itself performs zero new fs/env reads; it only filters or deprioritizes candidates
based on the passed flag. This mirrors the file's own existing `opts._applyDecayWeight`
injection pattern (Plan 05/D7) - a capability supplied by the caller, not summoned by the
function itself.

### Filter vs deprioritize
An admin-visibility command surfacing at all to a non-admin navigator is the exact bug this
phase closes (Phase 191's addendum already flagged it as a real, live gap). Filter, don't just
deprioritize: when `opts.isAdmin` is falsy, an admin-visibility candidate is excluded from the
ranked output entirely, not merely scored lower. A deprioritized-but-still-visible admin
command is not a fix.

## Canonical Refs

- `.planning/seeds/SEED-052-gsd-each-command-as-mini-product.md` - the seed; "smallest
  experiment" section names this exact slice
- `scripts/check-admin-identity.cjs` - the identity check this phase reuses, not rebuilds
- `scripts/admin-command-gate.cjs` - the sibling execution-time gate (different concern, same
  underlying `visibility: admin` frontmatter field); do not modify, reference for the
  frontmatter-parsing pattern only if needed
- `scripts/build-command-registry.cjs` - the generator this phase extends (Phase 122-02)
- `lib/workflow/f-selector-ranker.cjs` - the D4 scorer this phase wires the filter into (Phase
  125-05 / Phase 191's addendum)
- `data/command-registry.json` - the registry gaining the new `visibility` field
- `.planning/phases/191-brain-orchestration-advisor/` - the phase whose own addendum first
  flagged this gap (read its CONTEXT.md if it exists, for the exact addendum wording)

## Deferred Ideas (out of this phase's scope)

- The full 107-command JTBD/audience/F-shape mini-product GSD-ing SEED-052 describes. This
  phase is deliberately only the admin-visibility slice; the seed's own text says to confirm
  this slice surfaces something real before committing to the rest ("If it does, graduate this
  to a phase, sized per-cluster... not one 107-command mega-phase"). Not re-scoped here.
- Any change to `scripts/admin-command-gate.cjs` (the execution-time gate). Untouched.
