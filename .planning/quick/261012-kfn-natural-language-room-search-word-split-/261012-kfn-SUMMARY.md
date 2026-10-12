---
phase: quick-261012-kfn
plan: "01"
status: complete
subsystem: mcp-room-tools
tags: [room_search, bm25, relevance-floor, natural-language, spike-010]
requirements: [QUICK-ROOM-SEARCH-NL]
canon_parts: [7, 8]
key-files:
  modified:
    - lib/mcp/tools/room.cjs
    - tests/run-all-198.sh
  created:
    - tests/test-room-search-natural-language.cjs
    - .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-spike010-rerun.json
commits:
  - 19db43789  # RED  test(quick-261012-kfn): add failing natural-language room_search test
  - 32fcb604b  # GREEN feat(quick-261012-kfn): room_search word tier (BM25) with relevance floor
---

# Quick 261012-kfn: natural-language room_search (word tier + relevance floor)

room_search keeps its phrase tier unchanged and gains a BM25 word tier that runs only when the phrase tier finds nothing, plus a relevance floor that turns an unanswerable question into an empty result with a plain-English reason. No new dependency, no network, no Brain call.

## Result

All targets met. Measured on the real room `rethinking-mindrianos` (424 files), read-only, with the plan's measure script and the unmodified spike 010 harness.

### Before and after

| Metric | Before (baseline) | After | Target | Status |
|---|--:|--:|--:|---|
| nl top-5 (10 cases) | 0 | 10 | at least 8 | PROVEN |
| nl top-1 | 0 | 9 | none | PROVEN |
| nl zero-hit | 10 | 0 | none | PROVEN |
| nl median results tokens (chars/4) | 1 | 394 | at most 460 | PROVEN |
| kw top-5 (10 cases) | 7 | 9 | at least 7 | PROVEN |
| kw top-1 | 4 | 5 | none | PROVEN |
| kw zero-hit | 2 | 0 | none | PROVEN |
| kw median results tokens | 458 | 458 | at most 460 | PROVEN |
| Median tool-envelope tokens (nl / kw) | not measured | 496 / 514 | none | PROVEN |
| Median latency per sentence query (harness, nl) | 56.1 ms | 170.5 ms | none | PROVEN |
| Median latency per keyword query (harness, kw) | 58.1 ms | 95.3 ms | none | PROVEN |

Baseline source: `261012-kfn-spike010-baseline.json`. After source: `261012-kfn-measure.cjs` (prints "PASS: 261012-kfn targets met (engine=room.cjs)") and `261012-kfn-spike010-rerun.json` (harness rerun through the write-redirect preload). The two sources agree on every number.

The numbers equal the planning prototype exactly (nl 9/10/0/394, kw 5/9/0/458). No port defect, no constant changed.

### Negative controls

| Query | Results | reason_code | Best file words matched | Best file idf_share | Status |
|---|--:|---|--:|--:|---|
| quarterly revenue forecast for the bakery franchise | 0 | below_relevance_floor | 1 of 5 | 0.15 | PROVEN |
| how do I configure Kubernetes autoscaling | 0 | below_relevance_floor | 1 of 3 | 0.28 | PROVEN |
| what is the capital of Mongolia | 0 | below_relevance_floor | 1 of 2 | 0.35 | PROVEN |

### Control rows of the harness (leviathan and flexsearch)

nl/flexsearch 1/1/8/1, nl/leviathan 10/10/0/689, kw/flexsearch 1/2/3/189, kw/leviathan 6/8/0/598 (top1/top5/zeroHit/medTokens). These match the baseline file on all four counters. PROVEN. Only the millisecond timings differ (machine noise).

## What changed

- `lib/mcp/tools/room.cjs`
  - `walkSearchFiles(scopeDir, roomDir, onFile)`: one shared walker. It keeps the 500-file bound, the sort, the dot-entry skip, the WR-19 symlink skip, `isRealpathContained`, the read and stat catches and the html de-tag pass. `collectMatches` now runs on it with the same signature and the same records.
  - Word tier: `queryWords`, `collectWordStats`, `scoreWordTier` (BM25, K1 1.2, B 0.75), `passesWordFloor`.
  - `searchRoomDetailed(roomDir, query, section)` returns `{ tier, words, results }` plus `reason_code` and `reason` when results is empty. `searchRoom` keeps its signature and array return, so the spike harness runs unmodified.
  - The `room_search` handler returns `{ room_dir, query, tier, results }`, plus `words` when the tier is not `phrase`, plus `reason_code` and `reason` when results is empty. The error path is unchanged.
  - The description, the inputSchema text and the connectors export are untouched (plan D5).
- `tests/test-room-search-natural-language.cjs`: 50 checks on a fixture room (word tier, phrase priority, reasons, symlink and containment guards, 500-file bound, html pass, section scope, tool envelope, no dashes).
- `tests/run-all-198.sh`: one new `run_if` leg next to the two existing room_search legs.

## Decisions and measured basis

- **D1, word tier only on zero phrase hits (option A).** Keyword top-5 is 9 of 10 and median tokens 458. Option B (append word files after phrase hits) gave 10 of 10 but 492 median tokens, over the 460 budget, and it mixes two tiers in one list. Cases 3 and 7 (zero phrase hits before) now land at rank 2 and rank 1. PROVEN (planning measurement, reproduced).
- **D2, relevance floor.** A file stays only when it holds at least min(2, number of query words) distinct query words AND the matched words carry at least 0.55 of the query IDF weight. Negatives top out at 1 matched word and share 0.35. The 10 positive targets start at 4 matched words and share 0.72. 0.55 is the rounded midpoint of that gap (0.535). PROVEN (the table above, and target columns of the measure output: nl target idf_share 0.72 to 1.0).
- **D3, output budget.** 5 files and 1 line per file. Natural-language median 394 tokens. PROVEN. The 2-lines-per-file figures (555 to 866) come from planning: ASSUMED carried over, not rerun here.
- Constants `BM25_K1`, `BM25_B`, `SEARCH_FLOOR_*`, `SEARCH_WORDS_*` are not changed.

## Verification run

| Check | Result | Status |
|---|---|---|
| `node tests/test-room-search-natural-language.cjs` | RED before the code: exit 1 "word tier not exported". GREEN after: 50 checks pass | PROVEN |
| `test-room-search-rank-before-cap.cjs` (7 checks), `test-room-search-html-blindness.cjs` (22 checks) | pass, no edit to either file (`git diff --quiet HEAD` clean) | PROVEN |
| `test-369-read-surfaces.cjs` | PASS=9 FAIL=0 | PROVEN |
| `test-198-contract-schema.test.cjs`, `test-198-local-only.test.cjs` | pass (Part 8 floor: zero Brain-egress token) | PROVEN |
| `test-267-mcpv2-zod4-contract.cjs` | PASS=4 FAIL=0 | PROVEN |
| `node scripts/build-connector-registry.cjs --check` | "connector-registry: OK" | PROVEN |
| `bash tests/run-all-198.sh` | Passed 16, Failed 1, Skipped 0. The 1 failure is the pre-existing "SPEC-5 hooks/ adapter-only budget" leg. The new leg passes | PROVEN |
| Spike folder byte identity | `results.json` md5 3db87e158c3bf77d253a700ad10700e0; `git status --short` on the folder is empty | PROVEN |
| No room file written | `find ~/MindrianRooms/rethinking-mindrianos -newer MARKER -type f` printed nothing | PROVEN |
| No em-dash or en-dash in room.cjs, the new test, run-all-198.sh | grep found none | PROVEN |
| Both commits are ancestors of HEAD | `git merge-base --is-ancestor` true for 19db43789 and 32fcb604b | PROVEN |

Root cause of the original 0 of 10: room_search matched the whole lower-cased query as one literal phrase, so a sentence never appears verbatim in any file. PROVEN by the baseline (zero-hit 10 of 10).

## Deviations from Plan

None. The plan was executed as written. One note: the SPEC-5 hooks budget leg failure is the one the plan names as pre-existing.

## Known limits

1. **Keyword case 9 is still a miss.** Its one phrase hit is the wrong file, and the word tier does not run when the phrase tier has a hit (D1). kw top-5 is 9 of 10, not 10. PROVEN.
2. **A lexical floor cannot reject a true word match.** The probe "what is the weather in Paris today" matches all 3 of its words in the semantic-trigger research file (that file uses those words as an example) and returns it. Also from planning probes: "best pizza recipe with mozzarella" (2 of 4, share 0.29) and "explain quantum entanglement to a child" (2 of 4, share 0.50) are empty at the 0.55 floor. These probes were measured in planning and were not rerun here: UNVERIFIED in this run.
3. **The room_search description still says "substring".** It is incomplete now, not false. PROVEN by reading the file; the description was left alone on purpose (plan D5).
4. **Cost.** A sentence query walks the files twice (phrase pass, then word pass): 170.5 ms median on 424 files, against 56.1 ms before. A phrase hit costs the same as before (kw median 95.3 ms in this run includes the 2 queries that now reach the word tier). PROVEN for this machine only.
5. The floor was calibrated on one room (424 files) and 13 questions. Its fit to a smaller or differently written room is UNVERIFIED.

## Follow-up (separate quick task)

Update the `room_search` description and the inputSchema describe text to say that a question in plain words works and that an empty answer carries a reason. That change moves the 267 wire pins (`tests/fixtures/267/wire-snapshot-zod3.json` and `wire-snapshot-zod4.json`), and `tests/test-234-tool-description-floor.cjs` needs a check. Regenerate `data/connector-registry.json` only if the connectors export text changes.

## Handoff notes for the main session

- Commit this SUMMARY and the quick-folder evidence files (`261012-kfn-spike010-rerun.json`) with `git add -f` on explicit paths. The executor did not commit PLAN, SUMMARY or STATE.
- Nothing pushed, nothing released, no version bump.
- The untracked file `.planning/debug/desktop-marketplace-add-fails-20261011.md` was not touched.

## Self-Check: PASSED

- FOUND: lib/mcp/tools/room.cjs, tests/test-room-search-natural-language.cjs, tests/run-all-198.sh, 261012-kfn-spike010-rerun.json
- FOUND: commits 19db43789 and 32fcb604b, both ancestors of HEAD
