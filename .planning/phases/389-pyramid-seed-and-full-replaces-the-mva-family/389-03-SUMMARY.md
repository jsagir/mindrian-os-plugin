---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 03
subsystem: pyramid-seed-test-step
tags: [seed, part8, egress, consent-gate, canary, mva-reuse]
requires: [389-01]
provides:
  - lib/core/pyramid-seed-cells.cjs (SLOTS, CELL_TABLE, checkSprouts, buildCells)
  - scripts/pyramid-seed-run.cjs (card and run commands, consent gate)
  - tests/test-389-seed-cells.cjs (53 checks), tests/test-389-seed-egress.cjs (55 checks, Part 8 canary)
  - tests/fixtures/389/sprouts.json (3 phrase sets)
  - 389-measure-live.cjs and 389-MEASURE.md (open question 5: NOT-MEASURED)
affects: [389-06, 389-13]
key-files:
  created:
    - lib/core/pyramid-seed-cells.cjs
    - scripts/pyramid-seed-run.cjs
    - tests/test-389-seed-cells.cjs
    - tests/test-389-seed-egress.cjs
    - tests/fixtures/389/sprouts.json
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-measure-live.cjs
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-MEASURE.md
  modified: []
decisions:
  - A pending confirmation expires after 1 hour (not in the plan; a safety addition).
  - Run checks the phrase shape again before it reads the confirmation (exit 2 for a bad file, exit 3 for a missing or wrong card).
  - Verdict PARTIAL added to the measure script for a mix of empty and distinct cells.
metrics:
  tasks: 3
  files: 7
completed: 2026-11-08
---

# Phase 389 Plan 03: Seed Test cells, card and consent gate Summary

One line: four Seed cells (similar_cases, known_traps, analogies via Theo; funding via Tavily) take only host-written generic phrases that pass the Part 8 shape check and the shared-word-run check, and `run` refuses with `card_required` unless a single-use confirmation bound to the SHA-256 of the exact phrase set exists; open question 5 stays NOT-MEASURED.

No MVA surface was changed or removed. `git diff --quiet HEAD -- lib/agents/mva lib/core/mva-dispatcher.cjs lib/core/mva-budget.cjs lib/core/mva-agent-contract.cjs` exits 0.

## RED output (kept)

Task 1, `node tests/test-389-seed-cells.cjs` before the module existed (exit 1):

```
FAIL module loads :: Cannot find module '/home/jsagi/dev/MindrianOS-Plugin-release/lib/core/pyramid-seed-cells.cjs'
test-389-seed-cells: 0 passed, 1 failed
```

Task 2, `node tests/test-389-seed-egress.cjs` before the script existed (exit 1):

```
Error: Cannot find module '/home/jsagi/dev/MindrianOS-Plugin-release/scripts/pyramid-seed-run.cjs'
FAIL Test 5: one entry per present slot with the fields
FAIL Test 5: second run with the same hash exits 3 (single use)
FAIL Test 6 [consumer-subscription]: three Brain calls captured (not vacuous) :: []
FAIL Test 7: every Brain cell is empty with a typed reason :: []
FAIL Test 8: unknown subcommand exits 1 with a usage line
FAIL Test 9: script exists
test-389-seed-egress: 21 passed, 34 failed
```

The 21 checks that passed in RED are negative checks (no text in output, no request seen) that hold when nothing runs. The non-vacuous checks all failed.

## GREEN output

```
test-389-seed-cells: 53 passed, 0 failed
test-389-seed-egress: 55 passed, 0 failed
Phase 389: PASS=5 FAIL=0 SKIPPED=0      (bash tests/run-all-389.sh, 4 test files discovered at that moment, includes peer tests)
connector-registry: OK                  (node scripts/build-connector-registry.cjs --check)
render-coverage report: 17 covered, 0 excluded, 0 gap   (node scripts/check-render-coverage.cjs)
```

Mutation probe on the gate (manual, restored after): removing only the pending-record check was NOT caught, because the unlink of the pending record is a second guard (unlink of a missing file refuses). Removing both guards made 7 checks fail (Test 3 capture server saw 1 request; Test 4; Test 5 single use). The script was restored and the test is green.

## Cell table

| id | slot | pyramid part | destination | call |
|----|------|--------------|-------------|------|
| similar_cases | situation | Situation | Theo | brain.search(phrase, { topK: 3 }) |
| known_traps | complication | Complication | Theo | brain.search(phrase, { topK: 3 }) |
| analogies | analogy | key-line support | Theo | brain.search(phrase, { topK: 2 }) |
| funding | funding | key-line support | web (Tavily) | fetchCorpusEnvelope({ source: 'tavily', query, limit: 3 }) |

dashboard_graph and the dead classic traps cell are not carried over. A Brain answer with an error key (egress_blocked, sprouts_required, tier_denied, rate_limited), a null answer or an unavailable Brain gives status empty with a typed reason. Text is returned as summary_line (160 characters or fewer), excerpt (600 or fewer), a source label and `evidence_only: true`. The Brain success shape was read from `callTool` in `lib/core/brain-client.cjs`: the parsed JSON of the first text block, or `{ text }`.

## Confirmation design

1. `card` validates the phrases (shape, guard, shared 4-word run with `--sentence-file`), prints slot, destination and phrase, and writes `<home>/.mindrian/pyramid-seed/pending/<sha>.json` (hash and timestamp, no phrase) by temp file and rename.
2. The hash is SHA-256 of the JSON text of the present slots in order situation, complication, analogy, funding, each value trimmed.
3. `run` recomputes the hash from the file and needs `--confirm` equal to it and a fresh pending record (1 hour).
4. `run` deletes the pending record before the first network call; a second run with the same hash exits 3.
5. A refusal prints `{ error: 'card_required' }` and exits 3; the capture server saw 0 requests in that case. The sentence file is read only by `card` and is never stored or printed.

## Deviations from Plan

None that change behavior. Additions: the 1-hour expiry of the pending record, and the PARTIAL verdict in the measure script (both listed under decisions). Rule 3 note: the Write tool turned a unicode escape for a dash in the test sources into a literal dash character; both test files were repaired with escapes and re-read (no non-ASCII bytes remain in any new file).

## Part 8 and Part 11

- Every test child runs with a scratch HOME, a dummy Brain key, no Tavily key and a loopback Brain URL (capture server or a dead port). No live call ran.
- Canary (Test 6, all 3 fixture sentences): exactly 3 `brain_search` calls captured per run; each query is an approved phrase; no captured argument shares a 4-word run with the sentence; the sentence is absent from the card and run output.
- Part 11: a script and a lib module are not invocable surfaces; the registry and render-coverage gates pass. The command text that tells Larry to use the script is plan 06.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model (T-389-03-01 to 06 are covered by the tests above).

## UNVERIFIED

- Live Brain answers and the open question 5 measure (NOT-MEASURED; command: `MOS_389_LIVE=1 node .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-measure-live.cjs`).
- Presence of a Tavily key on any machine; the funding cell with a real key.
- The Brain success shape on a real answer: the parser handles `text`, `results` arrays and `answer`/`summary`/`message`; the capture server answers `{ ok: true }` or a fixed text only.
- The result of `bash tests/run-all-389.sh` depends on peer test files that were being written at the same time.

## Self-Check: PASSED

All 7 created files exist; both tests pass; the MVA files are unchanged. Commit hash: see the final report.
