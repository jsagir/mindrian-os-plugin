---
phase: quick-261012-rxc
plan: "01"
status: complete
subsystem: room-search
tags: [room_search, walk-bound, truncated, single-scan, search-surface-qa-sweep-20261012, item-2, item-3]
commits:
  - ca9b5722d
  - 287c76a76
requirements: [QUICK-261012-RXC]
metrics:
  completed: 2026-10-12
  tasks: 3
---

# Quick 261012-rxc: room_search walks every room file, reads each file once, reports truncation

One-liner: `room_search` now reads every walkable file up to a 5,000-file safety bound (was 500), reads each file once for both tiers (was twice for a sentence query), and every reply carries `scanned`, `walkable` and `truncated`; an empty reply from a stopped walk says where it stopped.

## Commits

Trailer on both commits, as the last line after a blank line: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (orchestrator ruling 2). Both were made with `git commit --only -m ... -- <paths>`. Nothing under `.planning/` was staged.

| Task | Sha | Files |
|------|-----|-------|
| 1 RED | ca9b5722d | tests/test-room-search-walk-bound.cjs (new, 50 checks), tests/run-all-198.sh (1 run_if leg) |
| 2 GREEN | 287c76a76 | lib/mcp/tools/room.cjs, tests/test-room-search-natural-language.cjs (2 checks, 1 header comment), CHANGELOG.md (1 Fixed bullet) |
| 3 | none | verify script and public results JSON stay in this quick folder for the orchestrator to commit |

Ancestor check: both shas are ancestors of HEAD (PROVEN, `git merge-base --is-ancestor`).

## What changed in room.cjs

- `SEARCH_MAX_FILES = 5000`, with the reason from cluster A in a comment (0.312 ms per file for the costliest call, about 1,560 ms at 5,000 files, 4.5 times the largest room measured).
- `walkSearchFiles(scopeDir, roomDir, onFile, options)`: the two early returns are gone. Past the bound it lists directories and counts files that pass every filter (dot skip, WR-19 symlink skip, extension allowlist, `isRealpathContained`) without a read, a stat or an `onFile` call. It returns `{ scanned, walkable, truncated }`.
- `options.maxFiles` is a per-call argument, valid only for an integer of 1 or more. The handler passes no options. No env var and no setter was added (P3). It is not reachable from MCP input.
- New `scanSearchScope`: one walk, one read per file, one lower-cased line used by the phrase pass and the word pass. After the first phrase hit the word pass stops (D1 short-circuit), so the output is unchanged.
- `collectMatches` and `collectWordStats` are thin wrappers. `scoreWordTier` is a wrapper over the new pure `scoreWordStats`. All BM25 and floor constants are unchanged.
- `searchRoomDetailed(roomDir, query, section, options)` returns `scanned`, `walkable`, `truncated` on every tier and scope. The room_search envelope carries the same three fields on every reply.
- New frozen `SEARCH_REASONS_TRUNCATED`. When truncated, an empty reply starts with "The search stopped at S of W files, so K files were not read. " (singular: "so 1 file was not read. "). When not truncated, the three reason texts are byte-identical to HEAD (strict equality in the new test).
- Not touched: the tool description, the `.describe` text, `inputSchema`, the `connectors` export (the diff holds no `description:`, `.describe(`, `hitl_why` or `layer_why` line; PROVEN by grep on the diff).

## Verification

Commands run, results (all PROVEN, run in this session):

| Check | Result |
|-------|--------|
| node tests/test-room-search-walk-bound.cjs | PASS, 50 checks (RED first: exit 1 with "walk bound not exported") |
| node tests/test-room-search-natural-language.cjs | PASS, 50 checks (only the P6 change) |
| node tests/test-room-search-rank-before-cap.cjs | PASS, 7 checks, no edit |
| node tests/test-room-search-html-blindness.cjs | PASS, 22 checks, no edit |
| tests/test-369-read-surfaces.cjs | PASS=9 FAIL=0 |
| tests/test-198-contract-schema.test.cjs, test-198-local-only.test.cjs | PASS |
| tests/test-267-mcpv2-zod4-contract.cjs, test-267-mcpv2-dual-era.cjs (PASS=5) | PASS |
| tests/test-234-tool-description-floor.cjs | 204 passed, 0 failed |
| node scripts/build-connector-registry.cjs --check | exit 0 |
| bash tests/run-all-198.sh | `Passed: 18   Failed: 0   Skipped: 0` |
| em-dash or en-dash in room.cjs, both tests, the CHANGELOG diff, the verify script | none |

## Real-room verification (read-only), against cluster A baselines

Verify script: `261012-rxc-verify-rooms.cjs`. Result line: `PASS: 261012-rxc verify -- 21 gates`. Public record: `261012-rxc-verify-results.json` (slugs, counts, walk indices, timings; no room path, no probe term). Private record: `private/261012-rxc-verify-private.json` (gitignored, never committed, never quoted here).

| Measure | Cluster A before | After (this run) |
|---------|------------------|------------------|
| Walker visits, mindrianOS | 500 of 1,121 | 1,121 of 1,121, truncated false |
| Walker visits, motj-ecosystem | 500 of 833 | 833 of 833, truncated false |
| Walker visits, rethinking-mindrianos | 424 of 424 | 424 of 424, truncated false |
| Beyond-cap probes found, mindrianOS | 0 of 5 | 5 of 5 |
| Beyond-cap probes found, motj-ecosystem | 0 of 5 | 5 of 5 |
| Beyond-cap probes found, total | 0 of 10 | 10 of 10 |
| In-cap controls found | 9 of 9 | 9 of 9 (3 per room) |
| Section-scoped calls found | not applicable | 8 of 8, 8 of 8, 3 of 3 |
| Natural-language form of the probe (informational) | not measured | 8 of 8, 8 of 8, 3 of 3 |
| Re-derived probes equal to cluster A (walk index and term sha8) | not applicable | 5 of 5 (mindrianOS), 5 of 5 (motj-ecosystem) |
| Files unreachable by any call | 43 (mindrianOS), 236 (motj-ecosystem) | 0 |
| Reads per sentence query | 2 per file (1,000 reads for 500 files) | 1 per file: 1,121 reads over 1,121 files; 833 over 833; 424 over 424 |
| Handler envelope keys (both big rooms) | room_dir, query, tier, results | room_dir, query, tier, results, scanned, walkable, truncated; scanned = walkable = room size, truncated false |

Latency, median of 5 timed runs after 1 untimed warm-up, `searchRoomDetailed` (the call the handler makes). Cluster A medians are for 500 files with two walks.

| Room (files now) | Query | Cluster A median (500 files, two walks) | After median (all files, one scan) | min, max after |
|------------------|-------|------------------------------------------|-------------------------------------|----------------|
| mindrianOS (1,121) | keyword phrase hit | 54.5 ms | 98.9 ms | 95.5, 102.2 |
| mindrianOS (1,121) | sentence, word tier | 197.7 ms | 251.9 ms | 241.2, 257.9 |
| mindrianOS (1,121) | sentence, below floor | 197.0 ms | 229.3 ms | 227.1, 246.1 |
| motj-ecosystem (833) | keyword phrase hit | 51.3 ms | 100.6 ms | 92.2, 102.9 |
| motj-ecosystem (833) | sentence, word tier | 167.6 ms | 195.1 ms | 187.7, 217.9 |
| motj-ecosystem (833) | sentence, below floor | 159.0 ms | 178.0 ms | 176.6, 182.4 |
| rethinking-mindrianos (424) | keyword phrase hit | 30.8 ms | 31.0 ms | 29.0, 31.2 |
| rethinking-mindrianos (424) | sentence, word tier | 126.0 ms | 97.3 ms | 93.5, 98.9 |
| rethinking-mindrianos (424) | sentence, below floor | 115.5 ms | 89.9 ms | 87.2, 93.2 |

Gate (ruling 6): the mindrianOS sentence-query median is 251.9 ms, under the 2,000 ms limit. Cluster A extrapolated about 350 ms for all 1,121 files with two walks (UNVERIFIED in cluster A); the measured figure for all 1,121 files with one scan is 251.9 ms. Cluster A extrapolation for motj-ecosystem was 260 ms; measured 195.1 ms. The keyword phrase-hit median rises from 54.5 ms to 98.9 ms on mindrianOS because the walk now reads 1,121 files instead of 500; it stays far under the 2,000 ms line.

261012-kfn measure on rethinking-mindrianos (424 files, under both bounds), quoted from the run:

| Measure | Baseline | After |
|---------|----------|-------|
| nl top1 / top5 / zero_hit / median tokens | 9 / 10 / 0 / 394 | 9 / 10 / 0 / 394 |
| kw top1 / top5 / zero_hit / median tokens | 5 / 9 / 0 / 458 | 5 / 9 / 0 / 458 |
| Negatives (best idf share), code | 0.15, 0.28, 0.35, below_relevance_floor | 0.15, 0.28, 0.35, below_relevance_floor (3 of 3) |
| Result line | | `PASS: 261012-kfn targets met (engine=room.cjs)` |

run-all-198 line: `Passed: 18   Failed: 0   Skipped: 0` (with quick 261012-rey landed; the new leg is the 18th).

Envelope cost (P5): the three new fields add 49 characters to the mindrianOS envelope and 47 to the motj-ecosystem envelope (compact JSON, measured by re-serialising with and without the fields), about 12 to 13 tokens by chars/4. The plan estimate was about 60 characters and 15 tokens.

No room write (ruling 5, PROVEN): `find` over mindrianOS, motj-ecosystem and rethinking-mindrianos with `-newer private/rxc-marker -type f` printed nothing, not even the SQLite side files. The marker was created before the verify script and the kfn measure ran. No room filing was done (navigator constraint, dev-research compositing).

## Planning notes (as the plan asked)

- P1, bound reason: 5,000 files. The costliest call today is a two-walk miss at 0.45 ms + 0.312 ms per file (cluster A fit, R2 0.908), about 1,560 ms at 5,000 files, under the 2,000 ms reference line. The single scan is cheaper per file, so the margin is larger. 5,000 is 4.5 times the largest room on this machine. `room_search` is in no hook.
- P3, injection choice: a per-call `options.maxFiles` argument, not an env var and not a setter. An env var is a new knob on three surfaces, needs a docs/ENV-TUNING.md entry (outside this task's file limit), and a shared environment could remove the safety bound. A setter is process-global mutable state in a long-lived MCP server. The argument is pure, per call and not reachable from MCP input; the handler passes none. Invalid values (0, -1, 2.5, '10', NaN, null) fall back to 5,000 (tested).
- P5, `no_search_words`: ruling 1 confirmed it. The truncated prefix applies to all three codes (`no_match`, `below_relevance_floor`, `no_search_words`), because "No file contains this exact text" is false whenever the walk stopped early. Each has its own text in `SEARCH_REASONS_TRUNCATED`.
- P7, memory bound: one file's text is in memory at a time. Kept per call: one phrase record per file with a hit (at most 200 lines of at most 200 characters) and, until the first phrase hit, one word record per file that holds a query word (a tf Map of at most the query word count and 1 line of at most 200 characters). With scanned at most 5,000, the kept text never exceeds the text of the files read (about 8.0 MB for the 1,121 files of mindrianOS). The per-file caps did not change.
- Tri-Polar: `room_search` is one read-only MCP tool and behaves the same on Claude Code CLI, Claude Desktop and Cowork. No hook, no surface-specific code. The tools/list description is the only carrier of tool guidance and it did not change; the 267 pins pass.
- Canon Part 8: local files only. No Brain call, no network call, no npm package. `tests/test-198-local-only.test.cjs` passes.

## Deviations from Plan

None - plan executed as written, with ruling 1 (truncated prefix on all three codes) applied as the plan's own default. Two small wording points: the verify script prints "found 0 of 0" for the rethinking-mindrianos beyond-cap gate because that room has no file beyond 500 (the gate is vacuously true; its controls and scoped calls are real). The plan's Task 3 note on stderr: node:sqlite prints an ExperimentalWarning, the PASS line was read from stdout.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or schema. T-rxc-01 to T-rxc-07 are mitigated as the plan listed (bound, same filters for the walkable count, argument-only override, honest truncated reasons, local-only test, private evidence not committed, explicit-path commits).

## Files left for the orchestrator to commit

- `.planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-PLAN.md`
- `.planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-SUMMARY.md`
- `.planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-verify-rooms.cjs`
- `.planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/261012-rxc-verify-results.json`
- Never add `.planning/quick/261012-rxc-room-search-walks-every-room-file-with-a/private/`.
