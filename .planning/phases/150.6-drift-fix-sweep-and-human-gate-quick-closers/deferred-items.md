# Deferred Items - Phase 150.6 Plan 02 execution

## DI-150.6-02-01: `npx @mindrian_os/install` strings in sent-mail archives (out of FIX-02 scope)

**Found during:** Task 1 verify gate (FIX-02 sweep).

**Discovery:** Four `npx @mindrian_os/install` install-instruction strings remain in
`docs/testers/outbox/` files:
- `docs/testers/outbox/beta-36-40-update-email.html:158`
- `docs/testers/outbox/beta-36-40-update-email.txt:59`
- `docs/testers/outbox/2026-05-24-rea-native-windows-fix.md:32` and `:34`

**Why deferred (not fixed):** These are point-in-time **sent-mail archives** (dated outbox
emails), not live install documentation. FIX-02's named scope is exactly
`package.json`, `docs/INSTALL-LIFECYCLE-HARNESS.md`, `docs/CANON-PHASE-MAP.md`. Rewriting an
archived sent email would falsify the historical record of what was actually sent to testers.
The supply-chain mitigation that matters (the npm `deprecate` of `@mindrian_os/install`)
redirects any `npx @mindrian_os/install` invocation at the registry layer regardless of which
archived doc a user copies from.

**Recommended follow-up:** If a future tester-email round re-sends an install string, use
`npx @mindrian_os/cli`. Do not retroactively edit the archived outbox files.

## DI-150.6-02-02: ~52 pre-existing em-dashes in CLAUDE.md (out of FIX-03 scope)

**Found during:** Task 2b em-dash gate scan over the four Brain-number surfaces.

**Discovery:** CLAUDE.md carries ~52 pre-existing em-dashes (U+2014) in sections unrelated to
the Brain-number normalization -- the header title, WORKSPACE GUARD, Three Layers (non-Brain
rows), Tri-Polar table, Key Decisions, Architecture, Release Process, and the GSD-managed
PROJECT/STACK blocks. These predate this plan.

**Resolution applied:** Every line this plan edited (the Brain moat block + Three Layers Brain
row + curriculum-graph line + the PROJECT/STACK Brain-number prose) was converted to hyphens
(`--`). docs/THE-BRAIN.md, docs/brain-setup.md, and docs/MINDRIAN-CANON.md are now FULLY
em-dash clean (0 each).

**Why the rest deferred:** FIX-03's scope is the Brain-number surfaces, not a full CLAUDE.md
prose rewrite. Converting ~52 em-dashes across unrelated sections is a separate hygiene sweep
(the no-em-dash HARD RULE applies repo-wide and warrants its own dedicated pass, e.g. a
`scripts/doctor.cjs` class K em_dash_check sweep over CLAUDE.md). Doing it inside this
figures-correction plan would balloon the diff far beyond the plan's named files.

**Recommended follow-up:** A dedicated CLAUDE.md em-dash hygiene pass (s/—/--/g across the
whole file, reviewed for the few intentional ranges like "30-60s").
