# Deferred / Out-of-Scope Items -- Phase 192

## 192-03 execution

- **Pre-existing harness-manifest drift absorbed (not caused by 192-03).**
  `data/harness-manifest.json` carried a stale `decide_engine` runtime digest for
  `lib/core/navigation-engine.cjs` (35a32e3b -> 60c4ec3f). The file was last changed by
  commit `5eb7a337` (feat 203-03) WITHOUT regenerating the manifest, so the manifest was
  already STALE on HEAD before 192-03 began. Because `build-harness-manifest.cjs` regenerates
  all digests atomically, 192-03's own manifest bump (`source_count 106 -> 107` for the new
  `commands/stance.md`) could not be committed without also syncing the navigation-engine
  digest. The navigation-engine digest sync is therefore folded into 192-03's Task 2 commit as
  a mechanical, deterministic byproduct. No behavioral change to navigation-engine.cjs was made
  by 192-03. Flagged so the 203 owners know the digest was reconciled here, not in 203-03.
## Deferred (192-04, 2026-07-02T07:32:46Z)

- tests/test-statusline-glyph-isolation.cjs FAILS on an UNTRACKED runtime cache
  `.mindrian/brain-substrate-cache.json` which contains the exclusive D-02 glyphs
  (chart / target). This is a runtime-generated cache, not a tracked repo file, and is
  NOT in any 192-04 commit. My changed files (lib/statusline/cockpit-signals.cjs,
  lib/statusline/cockpit-renderer.cjs) carry ZERO forbidden glyphs. Pre-existing,
  environmental, out of 192-04 scope. Fix: the glyph-isolation scan should exclude
  untracked runtime caches under .mindrian/, or the cache writer should not embed the
  glyphs. Owner: statusline/brain-substrate maintainer.

## 192-05 execution (aggregator + verdict)

- **Pre-existing em-dash in `evals/plurai/README.md:1` (NOT a Phase-192 regression).**
  The README TITLE line carries a single em-dash that predates Phase 192 (present at the
  pre-phase ref `61606a56`). Phase 192 introduced ZERO em-dashes across its entire diff
  (verified: `git diff 61606a56 e4b67e36 | grep '^+' | grep -c em-dash` = 0). Not fixed in
  192-05 because `evals/plurai/README.md` is outside this plan's exclusive file ownership
  (192-05 owns only `tests/run-all-192.sh` + `192-VERDICT.md`; R6). Fix: a future doc-scoped
  pass should replace the title em-dash with a hyphen. Owner: evals/docs maintainer.

