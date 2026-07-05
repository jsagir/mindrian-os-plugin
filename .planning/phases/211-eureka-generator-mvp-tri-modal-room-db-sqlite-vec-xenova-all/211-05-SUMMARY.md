---
phase: 211-eureka-generator-mvp
plan: 05
subsystem: eureka-engine
tags: [vertical-slice, real-room, fire-rate, plurai-judge, cross-topic-connection, phase-gate, canon-part-8, canon-part-9, human-checkpoint]
requires:
  - lib/core/room-db.cjs (openRoomDb allowExtension - 211-02)
  - lib/core/eureka/tri-modal-index.cjs (openIndex / indexNodes / nodeText - 211-02)
  - lib/core/rs-differential-scorer.cjs (scoreMeasured with opts.vectors - 211-03)
  - lib/core/eureka/embedding-spine.cjs (encoderProvenance - 211-01)
  - evals/eureka/cases/*.md (6 pseudonymous gold cards - 211-04)
  - lab/eval/report-from-transcript.cjs (endpointUrl + JUDGES cross-topic-connection)
provides:
  - scripts/eureka-room-report.cjs (the vertical-slice runner: index -> embed once -> full-matrix signed differential -> ranked top-N report)
  - tests/test-211-judge-gate.cjs (offline directional contract + key-gated deployed judge, synthetic-only egress)
  - tests/run-all-211.sh (the phase aggregator: 7 run_if legs, PASS/FAIL/SKIP)
  - evals/plurai/211-baseline.json (honest baseline_deferred record)
  - evals/eureka/211-room-report.md (real-room candidate list + fire-rate + navigator checklist; LIVE verdict pending)
affects:
  - 202 (APO calibrates EUREKA_DIFF_FLOOR + bands from the fire-rate evidence)
  - 212 (Grounding Guard filters the surfaced candidates)
tech-stack:
  added: []
  patterns:
    - "vertical-slice runner: openRoomDb(allowExtension) -> indexNodes (embed once) -> read vectors back -> cross-boundary pair enumeration -> scoreMeasured(text, text, {vectors}) full-matrix reuse -> ranked top-N markdown"
    - "cross-boundary pair = differ in root-domain ancestor (parentId walk) OR differ in node type; same-domain same-type excluded"
    - "deterministic stub encoder (hashed bag-of-tokens, L2-normalized) for the offline seam; never a network touch"
    - "idx.embedded gate: only score vectors freshly embedded THIS run, never stale rows from a prior mode's persisted index tables"
    - "per-pair Part 8 tolerance: catch ExternalEgressViolation, skip + count, never abort the local report"
    - "synthetic-only egress enforced structurally: the judge test never opens the room database (grep-clean)"
    - "graceful judge fallback: no key OR endpoint unreachable -> baseline_deferred + SKIP, never a red CI"
key-files:
  created:
    - scripts/eureka-room-report.cjs
    - tests/test-211-judge-gate.cjs
    - tests/run-all-211.sh
    - evals/plurai/211-baseline.json
    - evals/eureka/211-room-report.md
  modified: []
decisions:
  - "The LIVE MiniLM run is genuinely part of the human checkpoint: @huggingface/transformers is declared in package.json but not carried into the build worktree, so the autonomous report is generated OFFLINE (real db, real pairs, real lexical, stub semantics) with the LIVE run + spot-check handed to the navigator"
  - "The runner is LOCAL-only and never egresses, so it catches scoreMeasured's Part 8 figure-guard throw per pair (skip + count) instead of aborting the whole report"
  - "idx.embedded gates scoring so a prior offline run's persisted stub vectors can never bleed into a report labeled LIVE (found and fixed during the live smoke)"
  - "No spot-check verdict is fabricated; the report carries an explicit BLOCKING navigator checklist and the phase SUMMARY mirrors it"
metrics:
  duration: ~50m
  tasks_completed: 2 of 3 (Task 3 is a blocking human-verify checkpoint, deferred by design)
  files_created: 5
  files_modified: 0
  completed: 2026-07-06
---

# Phase 211 Plan 05: Real-Room Vertical Slice + Phase Gate Summary

**The whole measured Phase 211 pipeline now runs as ONE command against a real 261-node room database, `bash tests/run-all-211.sh` aggregates every 211 leg green (PASS=6 FAIL=0), and the deployed Cross-Topic Connection judge is wired on synthetic gold-card text only with an honest offline fallback; the real-room eureka spot-check (the MVP de-risk verdict) is a blocking human checkpoint left cleanly for the navigator, no verdict fabricated.**

## What Was Built

- **`scripts/eureka-room-report.cjs`** (415 lines) - the vertical-slice runner. Flags: `--db` (default `room`), `--offline` (stub encoder), `--top` (default 50), `--out` (default `evals/eureka/211-room-report.md`); switch-case argv, no dep. Flow: `openRoomDb(roomDir, {allowExtension:true})` -> `openIndex` + `indexNodes` (embed EACH node ONCE into the derived `eureka_*` tables) -> read every node vector back ONCE -> enumerate CROSS-BOUNDARY pairs (differ in root-domain ancestor via `parentId` walk OR differ in node type; same-domain same-type excluded) -> `scoreMeasured(textA, textB, {vectors:[vA, vB]})` (the 211-03 full-matrix reuse path, embed once score many) -> sort by `|signed_diff|` -> write a markdown report with a provenance header, a FIRE-RATE table (0.1 / 0.3 / 0.4 / 0.5 bands), the top-N candidate table (RS-NNN), and a mandatory necessary-not-sufficient / uncalibrated caveat block. Zero network calls, zero writes to `nodes`/`edges`/`memory_event`, room handle in a `try/finally` so it always closes.
- **`tests/test-211-judge-gate.cjs`** (247 lines) - Test A (offline, always) asserts DIRECTIONAL truths on `scoreMeasured` over gold-card pairs with a deterministic stub encoder (valid signed result + full provenance; restatement distractor lexical below a verbatim self-pair; unrelated cross-card pair well-formed, no NaN, no throw). Test B (network, key-gated) POSTs the darkmatter transferable connection statement and one unrelated pairing to the `cross-topic-connection` endpoint and asserts `Hedged|Confident` vs `No Connection`; on missing key OR endpoint error it writes a `baseline_deferred` record and SKIPs. The Part 8 egress rule is enforced structurally: the test never opens the room database (grep-clean), only synthetic gold-card text can ever cross the wire.
- **`tests/run-all-211.sh`** (73 lines) - the phase aggregator, modeled line-for-line on `run-all-200.sh` (`set -uo pipefail`, `run`/`run_if`, PASS/FAIL/SKIP, exit on FAIL=0). Seven `run_if`-guarded legs: embedding-spine, tri-modal, measured-differential, case-cards, judge-gate, and the runner offline smoke. Header restates the three-leg ROADMAP gate and the synthetic-only egress rule.
- **`evals/plurai/211-baseline.json`** - an honest `baseline_deferred:true` record (the `201-baseline.json` house shape) for the `cross-topic-connection` leg.
- **`evals/eureka/211-room-report.md`** - the real-room run output: provenance header, fire-rate table, ranked candidates from the real 261-node dogfood room, and the BLOCKING navigator checklist. Generated OFFLINE (see the checkpoint note below); the LIVE verdict is pending.

## Verification

- `bash tests/run-all-211.sh` -> **PASS=6 FAIL=0 SKIP=0**, exit 0 (the judge leg PASSES with an internal SKIP + deferred baseline; the runner offline smoke against the real 261-node database exits 0).
- `node tests/test-211-judge-gate.cjs` -> **PASS=3 FAIL=0 SKIP=1** (Test A1/A2/A3 pass; Test B skips on the endpoint 404 and writes the deferred baseline).
- Offline runner smoke against `room/.mindrian/room.db` (261 nodes) -> 115 indexed, 6054 cross-boundary pairs, fire-rate table + provenance + caveat present.
- `bash tests/run-all-200.sh` -> **PASS=6 FAIL=0 SKIP=0** (no regression across the phase's dependency).
- Acceptance greps: runner `scoreMeasured` count 3 (>=1), runner network-URL count 0, no writes to `nodes`/`edges`/`memory_event`, judge-test `room.db` count 0 (structural egress guard), `run_if` count 7 (>=6), `211-baseline.json` valid JSON (`baseline_deferred:true`), no em-dash in any touched file.

## The three ROADMAP gate legs

1. **run-all-211 green** - DONE. PASS=6 FAIL=0, one command.
2. **Deployed Cross-Topic Connection judge wired on synthetic text** - DONE (wired) with an honest deferral. A Plurai key resolved in this environment, but the `cross-topic-connection` route returns HTTP 404 (`run.plurai.ai/ioa/v1/cross-topic-connection/1.0.0` is not deployed). The test caught it, recorded the 404 verbatim in `evals/plurai/211-baseline.json` (`reason: plurai_endpoint_unreachable`), and SKIPped without red-failing CI. Synthetic-gold-card-only egress; never real-room content.
3. **Real-room eureka spot-check (MVP de-risk verdict)** - PENDING NAVIGATOR (blocking human-verify). See below.

## Task 3: the pending navigator checkpoint (NOT fabricated)

Task 3 is a `checkpoint:human-verify` and was stopped cleanly. The autonomous executor generated `evals/eureka/211-room-report.md` in OFFLINE (stub-encoder) mode against the REAL 261-node dogfood room database, because the live MiniLM encoder is not installed in the build worktree (`@huggingface/transformers` ^4.2.0 is declared in `package.json` but `node_modules` is not carried across worktrees - the same condition 211-02 and 211-03 recorded). The candidate PAIRS and lexical scores in the report are REAL; the semantic column is a deterministic stub that tracks lexical overlap, so the offline top-of-list is dominated by short `cmd:*` subdomain labels that hash alike (a stub artifact, explicitly stamped NOT the embedding-quality evidence).

**What the navigator must do to close R211-REALROOM-GATE:**
1. `npm install` (brings in `@huggingface/transformers` + `sqlite-vec` so the real encoder resolves).
2. `node scripts/eureka-room-report.cjs --db room --top 50 --out evals/eureka/211-room-report.md` (first run downloads the ~25MB q8 all-MiniLM model by id; zero room bytes egress). This OVERWRITES the report with the first MEASURED (real MiniLM) eureka candidates.
3. Read the top 10: label each MEANINGFUL / RESTATEMENT / NOISE (SEED-049 bar: "confirm the eurekas are meaningful").
4. Read the fire-rate table: at the 0.3 floor, judge HOT / COLD / OK (s11 measured real bridges at 0.16-0.25, so watch for cold-and-silent).
5. Append a `## Spot-check verdict (navigator, dated)` section with the per-candidate labels and the fire-rate verdict verbatim. If cold at 0.3, note that `EUREKA_DIFF_FLOOR` needs 202-APO calibration (a finding, not a failure).
6. Re-run `bash tests/run-all-211.sh` and confirm FAIL=0.

Separately (non-blocking): deploy or correct the `cross-topic-connection` Plurai endpoint, then re-run `node tests/test-211-judge-gate.cjs` to replace the deferral with a hosted baseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing error handling] Runner aborted on the Part 8 figure-guard throw**
- **Found during:** Task 2 (wiring the judge-gate test surfaced that the nichefoods gold card's `12M`/`30M` figures trip `scoreMeasured`'s Canon Part 8 egress audit, pattern `/\b\d+(?:\.\d+)?[KMB]\b/`).
- **Root cause:** `scoreMeasured` runs the Part 8 defense-in-depth audit on its inputs and THROWS `ExternalEgressViolation` on a forbidden pattern (a K/M/B money figure). The runner scored pairs in an unguarded loop, so a single real-room node carrying a figure would abort the entire report.
- **Fix:** wrapped the per-pair `scoreMeasured` call in `try/catch`; the runner is LOCAL-only (never egresses), so it skips + counts the tripping pair and surfaces the count as a `Pairs skipped (Part 8 figure-guard)` report row.
- **Files modified:** scripts/eureka-room-report.cjs
- **Commit:** 86e878e1

**2. [Rule 1 - Bug] Stale-vector mode bleed labeled a stub run as LIVE**
- **Found during:** Task 3 (the first live smoke reported "6054 pairs scored, mode live" AND an "Encoder unavailable" section simultaneously).
- **Root cause:** the derived `eureka_vec*` tables persist inside `room.db` across runs. An earlier offline run left 384-dim stub vectors in `eureka_vec_fallback`. When the live encoder was unavailable (`indexNodes` returned `embedded:false` and wrote no fresh rows), `loadIndexVectors` read the STALE stub rows and scored 6054 pairs in a report labeled LIVE.
- **Fix:** gate vector loading + scoring on `idx.embedded === true` (only trust vectors this run freshly embedded); otherwise `nodes = []` and the report honestly shows encoder-unavailable with 0 candidates. `encoderUnavailable` now keys off `idx.embedded !== true`.
- **Files modified:** scripts/eureka-room-report.cjs
- **Commit:** a1e13182

### Environment finding (documented, not a code deviation)

- The deployed `cross-topic-connection` Plurai judge is NOT live at `run.plurai.ai/ioa/v1/cross-topic-connection/1.0.0` (HTTP 404). The test degrades honestly (deferred baseline, SKIP). Recorded for the navigator; it does not block the real-room gate (synthetic-only leg).
- The live MiniLM encoder is absent in the build worktree (`node_modules` not carried across worktrees), so the LIVE real-room run is part of the navigator checkpoint rather than the autonomous scope.

## Task Commits

| # | Type | Commit | What |
|---|------|--------|------|
| 1 | feat | `dbdbfb42` | eureka-room-report vertical-slice runner |
| 2 | test | `f526ca00` | judge-gate test + run-all-211 aggregator + deferred baseline |
| - | fix  | `86e878e1` | Rule 2: per-pair Part 8 figure-guard tolerance in the runner |
| - | fix  | `a1e13182` | Rule 1: gate scoring on idx.embedded (stale-vector mode bleed) |
| 3 | docs | `90c289a2` | real-room report (offline partial) + navigator checklist |

## Canon Compliance

- **Part 8 (Graph Boundary):** the runner makes ZERO network calls (no URL in the source; the only possible touch is the embedding spine's one-time model-weight download by model id, no room bytes). The judge leg egresses ONLY synthetic gold-card text and structurally never opens the room database. Real-room content is verified by the human spot-check, never a network judge.
- **Part 9 (Memory Locality):** the runner writes ONLY the derived `eureka_*` projection tables (via `indexNodes`) and the report file. ZERO writes to `nodes`, `edges`, or `memory_event`; the room handle closes in `finally`.
- **Part 7 (Reuse Before Build):** consumes `openRoomDb`, `indexNodes`/`nodeText`, `scoreMeasured` (with `opts.vectors`), `encoderProvenance`, and `endpointUrl`/`JUDGES`/`callJudge` as shipped; no fork.

## Threat Model Compliance

- **T-211-11** (info disclosure at the Plurai leg) - mitigated: the judge test never opens the room database (grep-gated acceptance); only pseudonymous gold-card text egresses; offline default = `baseline_deferred`.
- **T-211-12** (room content in the tracked report) - accepted: the dogfood room is repo-internal command-research content; report texts are truncated; no user room touched.
- **T-211-13** (repudiation of the spot-check verdict) - the verdict is recorded verbatim, dated, and attributed to the navigator inside the report artifact (pending their run).

## Known Stubs

- The report's semantic column in its current OFFLINE state is stub-derived (deterministic hashed bag-of-tokens). This is a documented, clearly-stamped seam, not a shipped production stub: the runner's default is the LIVE encoder path, and the report file explicitly flags the offline mode and hands the LIVE run to the navigator. It resolves the moment the navigator runs step 2 of the checklist.

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary schema beyond what 211-01/02 already registered. The judge leg reuses the existing, already-registered Plurai egress surface with synthetic-only content.

## Self-Check: PASSED

- Files exist: `scripts/eureka-room-report.cjs`, `tests/test-211-judge-gate.cjs`, `tests/run-all-211.sh`, `evals/plurai/211-baseline.json`, `evals/eureka/211-room-report.md`, `211-05-SUMMARY.md` - all FOUND.
- Commits exist: `dbdbfb42` (runner), `f526ca00` (judge-gate + aggregator + baseline), `86e878e1` (Rule 2 Part 8 tolerance), `a1e13182` (Rule 1 stale-vector fix), `90c289a2` (report) - all FOUND in git log.
- `bash tests/run-all-211.sh` PASS=6 FAIL=0; `bash tests/run-all-200.sh` PASS=6 FAIL=0 (no regression). Task 3 real-room spot-check is a blocking human checkpoint left cleanly for the navigator (no verdict fabricated).
