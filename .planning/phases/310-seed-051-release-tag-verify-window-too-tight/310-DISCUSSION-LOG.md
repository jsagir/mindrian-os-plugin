# Phase 310 Discussion Log

**Date:** 2026-09-08
**Mode:** compressed (architecture traced by direct code reading; git semantics considered
carefully rather than assumed)

## Area: what "push demonstrably succeeded" means

Traced `set -euo pipefail` (line 71) as a partial guarantee (Step 5.5 being reached means the
combined push command returned 0), but decided this is insufficient alone since a multi-ref
push (`git push origin main --tags`) can partially fail per-ref in ways that do not always
distinguish cleanly by exit code. Decision: add an independent `git ls-remote` check that
`main`'s remote SHA matches local HEAD, as the seed's own explicit condition, rather than
trusting `set -e` as the sole guarantee.

## Area: testability

Found the existing sandbox test harness (`tests/test-release-bump-tag-and-publish-gates.cjs`)
cannot exercise Step 5.5 at all - `--dry-run` short-circuits before that step runs, so
today's gate has zero behavioral coverage. Decided to extract the gate's decision logic into
a pure, injectable function (mirroring this session's own `spawnImpl` pattern from the
skillopt scripts) rather than either leaving it untestable or building a full sandboxed
release run just to test one gate.

## Scope boundary decided without a question

Step 9's push mechanism itself, `SKIP_TAG_VERIFY`'s bypass behavior, and the shipped default
retry/backoff numbers are all left untouched - the seed's actual ask is the abort-vs-warn
decision, not any of these adjacent knobs.
