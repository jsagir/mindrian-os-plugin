# CACHE-03 live baseline result - 2026-08-11

Session: an 11-turn generated working session in a bound room, on the machine's released
v2.0.0-beta.3 install. Analyzer: scripts/cache-hitrate-report.cjs (aggregates only).

| Criterion | Result | Verdict |
|---|---|---|
| hit_rate >= 0.91 | 0.96 | PASS |
| zero-cache-reads attributable only to start/compaction | 0 total | PASS (better than the 2-3 allowance) |
| suppression observed (suppressed_markers >= 1) | not provable from this transcript | DEFERRED honestly |

Why the third leg defers: headless -p child sessions carry no per-turn navigation
injection, so nav_blocks = 0 and there was nothing to suppress. Compensating field
evidence, same date: the orchestrator session itself (running beta.3 hooks via the
symlink mitigation) emitted the DEDUPED AskUserQuestion payload live (verb_count in place
of the verbatim verbs array) - hygiene item (c) observed working in production. The
suppression leg (item a) closes from the navigator's next real interactive session, where
identical idle turns occur naturally; the analyzer command in 251-02-PLAN.md Task 3 stands.

Cache economics on the released rail: 1,745,299 cache-read tokens vs 40 uncached input
tokens across 21 requests - the rail is effectively free, confirming CACHE-01's verdict on
the shipped build.
