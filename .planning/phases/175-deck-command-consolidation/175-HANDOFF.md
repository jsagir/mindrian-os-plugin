# Phase 175 + session handoff (2026-06-23)

**Branch:** `phase-175-deck-command` (cut off `main`; NOT merged, NOT pushed). All work committed, tree otherwise clean.

## What shipped this session (all committed)
- **Phase 173 `/mos:show`** - the JTBD need-selector. 8/8 auto-verified; 1 human UAT item open (R12 live degradation-note render on Desktop/Cowork). Merged to `main` earlier (commit `9f2c8474`).
- **Phase 175 `/mos:deck`** - the consolidated deck command (MOSDeckEngine + feynman-engine aliased; Feynman/HEART/mesh styles; per-section F.1 build; deck-design ruleset WARN-first; born-wired CIRS; make-land lane repointed). 8/9 auto-verified. `data-ai` provenance finding FIXED (`0e3d959e`).
- **Phase 174** hypothesis-ignite - seeded + researched (AION precedent + person-anchored). Not specced.
- AION one-pager live: https://mindrian-onepager.vercel.app (+ case study + zep rebuttal/R&D filed in mindrianOS room).

## OPEN - human UAT (need a live Larry session; no test can assert these)
1. **175 R5** - invoke `/mos:deck`, pick HEART, confirm an accept/reshape/skip gate fires after EACH of the 5 H/E/A/R/T sections (not auto-advance).
2. **175 R1** - invoke the old `MOSDeckEngine` handle live, confirm it routes to the `/mos:deck` style selector (not the legacy pipeline, not command-not-found). Alias is doctrine+data only (`data/deck-aliases.json`) - no runtime code reads it; if that is unacceptable, wire a dispatch-time alias read.
3. **173 R12** - on Desktop/Cowork, confirm a Node-only `/mos:show` result surfaces an explicit CLI-only degradation note (not a silent failure).
   - Close all three via `/gsd-verify-work 175` and `/gsd-verify-work 173`.

## OPEN - loose ends (NOT touched; owner action)
1. **Interrupted release `v1.14.0-beta.5`** sits in the working tree: modified `.claude-plugin/plugin.json`, `CHANGELOG.md`, `package.json` + a staged `node_modules` un-cache (release.sh Commit-B form). The release process owns finishing or reverting it. Executors used targeted staging and never touched it.
2. **Merge/push decision:** `phase-175-deck-command` -> `main` is unmade (deliberately - the release entanglement above should be resolved first).

## Resume next session
- Close UAT: `/gsd-verify-work 175` then `/gsd-verify-work 173`.
- Or build: `/gsd-spec-phase 174` (hypothesis-ignite, researched).
- Or release: resolve the interrupted v1.14.0-beta.5 (finish or revert) BEFORE merging 175 to main.
