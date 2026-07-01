---
phase: 196-part8-runtime-slm-guardrail
plan: 02
subsystem: testing
tags: [plurai, part8, guardrail, eval, csv, baseline, synthetic-data, egress]

# Dependency graph
requires:
  - phase: 196-01
    provides: "CSV parity loader (lib/core/part8-egress-guard.test.cjs) that JSON.parses each row's Sample and asserts classify() verdicts"
provides:
  - "Expanded 32-row synthetic MOVE-SET vs CONTENT-SET Part 8 guardrail CSV (16 compliant / 16 violation)"
  - "evals/plurai/196-baseline.json: precision/recall baseline + sample_index -> block|allow parity map (CI artifact, never runtime-loaded)"
  - "Deterministic hand-labeled degrade path when the interactive Plurai eval cannot run in a non-interactive executor"
affects: [196-03, 196-04, 196-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synthetic-only eval fixtures (D-04): Part 8 applies to training data too; pseudonyms + invented figures, never a real room"
    - "CI baseline as a non-runtime artifact (runtime_loaded:false); the verdict_map is the parity target the local classifier must clear"
    - "Network-optional build step: degrade to deterministic hand-labeling so the phase never blocks on Plurai reachability"

key-files:
  created:
    - evals/plurai/196-baseline.json
  modified:
    - evals/plurai/01-part8-boundary-guardrail.csv

key-decisions:
  - "Kept the {\"brain_query_payload\": \"...\"} Sample shape so the 196-01 CSV parity loader parses the expanded rows unchanged"
  - "Took the plan DEGRADE path: the Plurai eval is an interactive multi-turn MCP-tool flow, not a one-shot offline CLI, so rows were hand-labeled deterministically and the baseline marked baseline_deferred:true"
  - "Balanced the set 16/16 and added two near-miss proper-noun rows labeled violation under the stricter reading to stress the boundary"

patterns-established:
  - "Part 8 eval CSVs carry a Reasoning cell naming the fired class tell (MOVE ... / CONTENT ...)"
  - "196-baseline.json verdict_map is index-aligned to CSV data-row order (0-based), verified by cross-check against the loader"

requirements-completed: [PB8-09]

# Metrics
duration: 12min
completed: 2026-07-01
---

# Phase 196 Plan 02: Plurai Baseline Summary

**Expanded the synthetic Part 8 guardrail CSV to 32 balanced MOVE/CONTENT rows and persisted a hand-labeled precision/recall baseline (196-baseline.json) whose block/allow verdict_map is the exact parity target the 196-03 local classifier must clear.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01
- **Completed:** 2026-07-01
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 expanded)

## Accomplishments
- Grew `evals/plurai/01-part8-boundary-guardrail.csv` from 8 to 32 SYNTHETIC rows, balanced 16 compliant (MOVE-SET) / 16 violation (CONTENT-SET), covering all six MOVE tells (framework-handle, reach_id/slug, methodology_tier, phase-id, problem-type enum, edge-type traversal) and all six CONTENT tells (personal identifier, proprietary number, meeting text, room metric + location, verbatim quote, near-miss proper-noun).
- Persisted `evals/plurai/196-baseline.json` with method, precision, recall, accuracy, f1, row/class counts, and a `verdict_map` (sample_index -> block|allow) that is the parity target for 196-03.
- Verified the expanded CSV round-trips through the exact 196-01 loader logic (all 32 rows JSON.parse, header intact) and cross-checked the verdict_map is index-aligned to CSV row order.
- `bash tests/run-all-196.sh` still exits 0 (Wave 0 SKIPs preserved).

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand the synthetic MOVE-SET vs CONTENT-SET CSV** - `c4e48ae2` (feat)
2. **Task 2: Run Plurai eval offline, persist 196-baseline.json (hand-labeled degrade)** - `f75421d0` (feat)

## Files Created/Modified
- `evals/plurai/01-part8-boundary-guardrail.csv` - Expanded to 32 synthetic rows, same `Sample,Label,Reasoning` schema
- `evals/plurai/196-baseline.json` - CI baseline artifact (never runtime-loaded); precision/recall + verdict_map parity target

## Decisions Made
- Kept the `{"brain_query_payload": "..."}` Sample shape so the 196-01 CSV parity loader parses the new rows with zero loader changes.
- Balanced the classes 16/16 and added two near-miss proper-noun rows (Nimbus Robotics, Tel Aviv contract) labeled `violation` under the stricter reading to stress the block boundary for 196-03.
- Set precision/recall/accuracy/f1 = 1.0 by construction: in the hand-labeled path the Label column IS the gold set, so agreement is trivially perfect and the meaningful output is the verdict_map, not the metric.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Degraded to deterministic hand-labeling because the Plurai eval cannot run in a non-interactive executor**
- **Found during:** Task 2 (Run Plurai eval offline)
- **Issue:** The plan anticipated a one-shot `uv run ... python -m evals_mcp ...` eval. Inspection of the installed plugin (0.4.0) showed the CLI exposes ONLY the `auth` subcommand; `python -m evals_mcp` with no args starts a stdio FastMCP server for an interactive client. The real eval is a multi-turn MCP-tool flow (`start_evaluator` -> `ask_user` model choice -> `ScheduleWakeup` 2-20 min -> `get_results`), and SLM vibe-training needs a paid Plurai plan. None of that is executable one-shot in the sequential executor.
- **Fix:** Took the plan's explicit DEGRADE path: hand-labeled every row deterministically from its Label column (violation -> block, compliant -> allow), set `method:"hand-labeled"`, `baseline_deferred:true`, and a `deferred_note` explaining how to re-run `/evals:eval` interactively after `/reload-plugins` to replace this with a hosted Plurai baseline.
- **Files modified:** evals/plurai/196-baseline.json
- **Verification:** `node -e require(...)` confirms method + precision + recall present; cross-check confirms verdict_map matches all 32 CSV rows in order.
- **Committed in:** `f75421d0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, degrade path pre-authorized by the plan).
**Impact on plan:** The DEGRADE path was explicitly specified as non-blocking; the phase is not gated on Plurai reachability. No scope creep. Auth is confirmed configured (`API key configured.`), so an interactive re-run can lift the baseline to a genuine Plurai precision/recall later without touching runtime code.

## Issues Encountered
- Preconditions all confirmed present: `uv 0.9.4` at `~/.local/bin/uv`, credentials at `~/.config/evals/credentials.json` (`API key configured.`), plugin at `~/.claude/plugins/cache/plurai-plugins/evals/0.4.0`. The only blocker was the interactive-only nature of the eval flow, handled via the degrade path above.

## Threat Flags
None - no new security surface. All rows are SYNTHETIC (T-196-02-01 mitigated via D-04); the baseline JSON is a build/CI artifact with `runtime_loaded:false` and never sits on the Brain-egress path (T-196-02-02 accepted); the phase proceeds without Plurai (T-196-02-03 mitigated via the degrade path).

## User Setup Required
None for this plan - the Plurai key is already provisioned. To later replace the hand-labeled baseline with a genuine Plurai one, run `/reload-plugins` then `/evals:eval` interactively against `evals/plurai/01-part8-boundary-guardrail.csv` (SLM vibe-training requires a paid Plurai plan; the Optimized-LLM path does not).

## Next Phase Readiness
- 196-03 (local classifier) has its parity fixtures: every `violation` row must BLOCK and every `compliant` row must ALLOW, per `196-baseline.json.verdict_map` and the 196-01 CSV parity loop.
- The near-miss proper-noun rows will force 196-03 to tighten MOVE-SET/FORBIDDEN rules until parity, as the RESEARCH distill step requires.

## Self-Check: PASSED
- FOUND: evals/plurai/01-part8-boundary-guardrail.csv
- FOUND: evals/plurai/196-baseline.json
- FOUND: .planning/phases/196-part8-runtime-slm-guardrail/196-02-SUMMARY.md
- FOUND commit c4e48ae2 (Task 1: expand CSV)
- FOUND commit f75421d0 (Task 2: baseline JSON)

---
*Phase: 196-part8-runtime-slm-guardrail*
*Completed: 2026-07-01*
