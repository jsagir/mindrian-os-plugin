# Phase 311 Discussion Log

**Date:** 2026-09-08
**Mode:** compressed (single decisive gray area; seed pre-locks the rest)

## Area: Where visibility lives / how ranker purity is preserved

**Options presented:**
1. Registry carries `visibility`, caller passes `isAdmin` in (Recommended) - extend
   `build-command-registry.cjs`'s generator, keep `f-selector-ranker.cjs` pure, caller computes
   `isAdmin()` once via `scripts/check-admin-identity.cjs`.
2. Ranker reads `commands/*.md` frontmatter directly - skip the registry, mirror
   `admin-command-gate.cjs`'s own frontmatter reader.

**Selected:** Option 1.

**Reasoning offered:** the registry is the single source of truth every other scorer input
already flows through (Reliability Rule 2); a second frontmatter-reading path inside the ranker
would duplicate `admin-command-gate.cjs`'s existing reader for a different concern. The ranker's
own header states it is a pure synchronous function - `isAdmin()` reads env/fs, so it must be
computed by the caller and injected, mirroring the existing `opts._applyDecayWeight` pattern.

## Filter vs deprioritize (folded into the same turn, not separately re-asked)

Decided: filter (exclude entirely from ranked output when non-admin), not deprioritize. A
deprioritized-but-still-visible admin command does not close the gap Phase 191's addendum
named.

## Deferred

- The full SEED-052 107-command mini-product GSD-ing. Explicitly out of scope; the seed's own
  text gates it on this slice surfacing something real first.
