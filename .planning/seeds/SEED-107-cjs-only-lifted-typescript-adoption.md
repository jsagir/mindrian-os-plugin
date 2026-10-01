---
id: SEED-107
status: dormant
priority: CRITICAL
planted: 2026-10-02
planted_during: Phase 366 (executing)
trigger_when: before ANY TypeScript file lands in the plugin repo, and before the SEED-105 UI moves from spike to build
scope: medium (constitution edit + release/install/hook decisions); the code migration itself is incremental and optional per file
related: SEED-105 (UI route), spikes 005-007, CLAUDE.md line 134, .planning/spikes/CONVENTIONS.md
---

# SEED-107: CJS-only is lifted plugin-wide - adopt TypeScript without breaking install, hooks or the release lockstep

## The ruling (navigator, 2026-10-02, verbatim plus card)

"the ui worth sacrificing the CJS-only hard rule !" - then, on the scope card, the navigator chose
**"Whole plugin may go TypeScript"** over "a UI package only" and "a separate UI repo".

This supersedes CLAUDE.md line 134 ("CJS only, no TypeScript: `lib/core/*.cjs` ships as source; every
output is an inspectable edit surface") and the spike convention "Node 22 CJS, zero npm deps". Until
this seed's phase lands, CLAUDE.md still says CJS-only: the edit goes through GSD, never silently.

## What the CJS rule was protecting (keep these, change the means)

1. **No build step on the user's machine.** Install is `claude plugin install` plus the npm-shrinkwrap
   loader (RULE 8); a compile step on every install would be a new failure mode.
2. **Hook cold start.** Hooks run under 2000 ms budgets (spike 003 measured them). A TS loader or
   transpile at hook time eats that budget.
3. **Inspectable source.** "Every output is an inspectable edit surface": users and agents read the
   shipped files directly.
4. **Release lockstep.** `scripts/release.sh` and `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 assume no
   build artifact.

## Candidate shape to evaluate (not decided)

- **Erasable-only TypeScript run natively by Node.** Recent Node 22 lines can strip types at run time,
  which would keep "ships as source, no build" (verify the exact Node version where type stripping is
  unflagged against the repo's `>=22.16.0` floor; if the floor must rise, that is a release-note-level
  change). Erasable syntax only: no enums, no namespaces, no parameter properties.
- **The UI package** (agent-native + RxDB, React) is a normal Vite build and ships its built assets; it
  is the one place a build step is unavoidable.
- **Hooks and the MCP server stay plain JS until measured**: a hook moves to TS only after a cold-start
  measurement shows it stays inside budget.
- Mixed CJS/ESM interop: agent-native and RxDB are ESM-first; decide the module system for new code
  explicitly.

## Done when

- CLAUDE.md line 134 and the spike CONVENTIONS rewritten to the new rule (via GSD), canon/decision row
  recorded.
- A decision on the TS shape above, with a measured hook cold-start number and an install test on a
  clean machine.
- release.sh and RULE 5 updated if any build artifact ships.
