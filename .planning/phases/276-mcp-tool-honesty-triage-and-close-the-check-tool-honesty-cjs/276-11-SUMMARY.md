---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 11
subsystem: mcp-tool-descriptions
tags: [mcp-tool-honesty, gate-render, graph-write, brain-shim, theo-mirror, flip-day, description-correction]

# Dependency graph
requires:
  - phase: 276-07
    provides: "The 'nothing is persisted' NEGATION_PATTERNS entry, minted specifically for this plan's gate_render rewrite, and the confirmed-unchanged STRONG_VERBS vocabulary (minted was never added, D-276-3)."
  - phase: 276-08
    provides: "The four-move description-rewrite pattern (state the claim, disclose the gap, keep the useful part, prove by re-run) this plan reused a third and fourth time; global HIGH_RISK already at 0 before this plan started."
provides:
  - "gate_render's description discloses the in-memory, TTL-bounded, non-surviving nature of the gate_id mint; the row flips from MEDIUM to fully OK (globally cancelled by the existing 'nothing is persisted' negation pattern)"
  - "graph_write's read_version parameter .describe() string discloses both CAS fail-open paths (missing source node, guard read error) alongside the original true-in-the-normal-case claim"
  - "brain_ask's DirectiveEnvelope description names the mode fallback explicitly: mode is carried from upstream mode_signals when present, defaults to GUIDED when absent"
  - "the honest-empty trio (enrichCausalEdges/hatAwareRecommend/suggestValidationSteps) re-measured at execution time and recorded as a forward-looking finding, not a fix; research's caller counts confirmed unchanged"
  - "the Theo mirror task for gate_render is registered (owed to plan 276-13), naming GATE_RENDER_DESCRIPTION at /home/jsagi/Theo/src/mcp/operational/gate-render.ts:89"
affects: ["276-13 (owns the Theo-side GATE_RENDER_DESCRIPTION mirror; test-276-theo-description-parity.cjs now reports gate_render DIFFERS, the signal 276-13 consumes)", "276-15 (re-verifies the disposition ledger against this plan's now-fully-OK gate_render row; inherits the pre-existing frozen_sweep.tools/branches re-freeze, unchanged by this plan)", "276-16 (carries the honest-empty trio forward-looking finding into the follow-up register)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verify a checker-flip claim by temporarily swapping the pre-edit blob back into the working tree (via `git show <parent-commit>:<path>` into the real file path), running checkTree(), then restoring via `git checkout HEAD -- <path>` -- gives a verbatim, live-measured before/after total rather than trusting a prior SUMMARY's stale snapshot, without ever touching git history or leaving the tree dirty."
    - "A parameter .describe() string sits entirely outside scanAll's second-positional-argument scan (boundary B-6); a disclosure fix there needs its own over-the-wire assertion (a plain regex read of the file, both the survives claim and the new disclosure present) recorded in the plan's own verify step, since the standing detector structurally cannot confirm it."
    - "Additive-only STATE.md handling in a shared working tree: run only `state record-metric` and `state add-decision` (both proven to touch nothing but their own table row), never `state advance-plan` or `state record-session` when a concurrent session's `stopped_at`/`last_activity`/`Current Position` fields are legitimately current, per the 276-08 precedent."

key-files:
  created: []
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/graph.cjs
    - bin/mindrian-brain-mcp-client.cjs

key-decisions:
  - "D-276-3 upheld: `minted` was NOT added to STRONG_VERBS. The fix is entirely a description correction; scripts/check-tool-honesty.cjs was not touched at all by this plan (confirmed: `grep -c minted scripts/check-tool-honesty.cjs` unchanged at 2, both pre-existing comment references)."
  - "graph_write's TOOL description at :219 was deliberately left byte-identical (157 bytes before and after) to keep the Theo mirror surface (GRAPH_WRITE_DESCRIPTION) a single, small coordination item; only the read_version parameter's .describe() string changed. Confirmed live: test-276-theo-description-parity.cjs still reports GRAPH_WRITE_DESCRIPTION IDENTICAL."
  - "The honest-empty trio (item b) stays OUT of the code-fix scope, per the plan's own instruction, after re-measuring all three callers at execution time. The measured counts agree exactly with 276-RESEARCH.md's characterization: no revision to the recommendation was needed."
  - "mode_signals (item a) fixed as a one-sentence description addition only; none of the other six files on Phase 267/269's named seven-file Brain-shim adaptation list were touched, confirmed by an explicit `git status --porcelain` check against all six paths (empty)."
  - "STATE.md: only `state record-metric` and `state add-decision` were run (both additive, verified to leave stopped_at/last_activity/Current Position/completed_phases/completed_plans/percent untouched before and after). `state advance-plan`/`state record-session` were deliberately NOT run, per the 276-08 precedent and the shared_tree_guard instruction, because Phase 339's concurrent session currently and legitimately holds `stopped_at: Completed 339-01-PLAN.md` / `last_activity: 2026-09-03 -- Phase 339 execution started` / the Current Position section. `percent` remains at a stale 21 (pre-existing cross-phase drift, not caused by this plan's own additive calls, matching the file's own long-documented resync-clobber bug) -- left uncorrected here rather than risk fighting the concurrently-active session's own state management; not this plan's scope to repair."

requirements-completed: [TOOLHON-13, TOOLHON-02]

# Metrics
duration: ~50min
completed: 2026-09-03
---

# Phase 276 Plan 11: gate_render, graph_write, and the Brain Shim's Three Flip-Day Descriptions Summary

**Corrected three description-versus-behavior mismatches (gate_render's mint durability, graph_write's CAS fail-open disclosure, brain_ask's mode-signal fallback) as pure description edits with zero verb-vocabulary widening and zero handler-behavior change, closing all three ROADMAP flip-day items with an explicit in/out call each.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-03T~23:10:00+03:00 (approx, first file read)
- **Completed:** 2026-09-03T~23:55:00+03:00 (final task commit)
- **Tasks:** 3 completed
- **Files modified:** 3 (`lib/mcp/tools/gate.cjs`, `lib/mcp/tools/graph.cjs`, `bin/mindrian-brain-mcp-client.cjs`), one commit each

## Accomplishments

- **Task 1 (F-9/D-276-3, gate_render).** Replaced "Returns a minted gate_id that gate_answer must reference to ratify" with "Returns a gate_id minted into this server process's in-memory ledger, which gate_answer must reference to ratify; nothing is persisted and the id does not survive a restart." `STRONG_VERBS` was NOT widened (`minted` was never added; `grep -c "minted" scripts/check-tool-honesty.cjs` unchanged at 2). The row **flips from MEDIUM to fully OK**, globally cancelled by the `nothing is persisted` `NEGATION_PATTERNS` entry 276-07 minted for exactly this rewrite. The ledger (`lib/mcp/gate-ledger.cjs`), its 30-minute TTL, its single-use semantics, and the T-198-10 spoofing guard are byte-for-byte untouched. `gate_render`'s `hitl_why` was reviewed and remains accurate; no correction needed there. Registered the Theo mirror task for plan 276-13.
- **Task 2 (flip-day item c, graph_write's CAS fail-open).** Added a disclosure clause to the `read_version` parameter's `.describe()` string: the check fails open (proceeds as a normal write, no conflict reported) when the source node is missing, or when the guard read itself errors, so a pass is not proof the node existed or was unchanged. The original claim ("a lost update is rejected as a conflict instead of silently clobbering") was kept intact -- true in the normal case, this is an addition. Traced end to end against `reconcile-guard.cjs:37-92` myself (not inherited from the plan's own citation): `checkReconcile`'s explicit "NULL/absent on EITHER side -> no claim" guard, and the second fail-open on a guard read error at `:82-85`. Neither fail-open was touched. `graph_write`'s TOOL description at `:219` stays byte-identical (157 bytes both sides, confirmed by `test-276-theo-description-parity.cjs`). Boundary B-6 (the detector reads only the second positional argument to `server.tool(`, never a parameter `.describe()`) means the standing checker cannot verify this; the over-the-wire assertion (both the surviving claim regex and the new disclosure regex present in the file) is recorded below for 276-15 to promote into a permanent test if wanted.
- **Task 3 (flip-day item a, mode_signals; item b, the honest-empty trio).** Corrected `brain_ask`'s description at `bin/mindrian-brain-mcp-client.cjs:151`: "Returns a DirectiveEnvelope (default mode: GUIDED)..." became "Returns a DirectiveEnvelope carrying the directive content; the envelope's mode is set from the upstream response's mode signals when present, and falls back to the default mode (GUIDED) when they are absent." Handler body unchanged -- `const signals = (raw && ... raw.mode_signals) ? raw.mode_signals : {}` already degrades gracefully; `lib/core/directive-envelope.cjs`'s `selectMode({})` was traced and confirmed to fall through all five precedence rules to its own `DEFAULT_MODE = 'GUIDED'`. None of the other six files on Phase 267/269's named seven-file Brain-shim adaptation list were touched (confirmed empty `git status --porcelain` against all six). Re-measured the honest-empty trio's caller counts live: `enrichCausalEdges` zero production callers (2 prose-only references, `lib/brain/ROOM.md:31` and a comment at `lib/brain/chain-recommender.cjs:46`); `hatAwareRecommend` one caller (`commands/hat-briefing.md:139`, pipes raw JSON to stdout, no rendering layer); `suggestValidationSteps` one caller (`lib/core/opportunity-ops.cjs:1359`, returns an explicit `{ enriched: false, steps: 0 }` on empty and emits no markdown section). All three measurements agree exactly with `276-RESEARCH.md`; no revision needed. Recorded as a finding for plan 276-16, no code change made.

## Task Commits

Each task was committed atomically:

1. **Task 1: gate_render's in-memory-mint disclosure (F-9/D-276-3)** - `02468fcb` (fix)
2. **Task 2: graph_write's CAS fail-open disclosure on read_version** - `66d7b4d6` (fix)
3. **Task 3: brain_ask's mode-signal fallback disclosure; honest-empty trio recorded** - `6b043491` (docs)

## Files Created/Modified

- `lib/mcp/tools/gate.cjs` (Task 1) - one line changed: the `gate_render` description string. No behavioral line, no ledger, no TTL, no `connectors`/`hitl_shape`/`hitl_why` change.
- `lib/mcp/tools/graph.cjs` (Task 2) - one line changed: the `read_version` parameter's `.describe()` string. The `graph_write` TOOL description at `:219` and every behavioral line untouched.
- `bin/mindrian-brain-mcp-client.cjs` (Task 3) - one line changed: the `brain_ask` description string. The handler body (`:154-200`) byte-identical.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: (1) D-276-3 upheld, no verb-vocabulary widening, confirmed by an unchanged `minted` grep count; (2) `graph_write`'s TOOL description kept byte-identical to Theo's, only the parameter describe changed; (3) the honest-empty trio re-measured and confirmed to agree with the research, recorded as a finding not a fix; (4) the Brain-shim scope guard held, zero of the other six named files touched; (5) STATE.md handled additive-only, per the 276-08 precedent, to avoid fighting Phase 339's concurrently-active, legitimately-current position.

## Deviations from Plan

None - plan executed exactly as written. All three tasks were pure description-string edits; no bugs were found, no blocking issues, and no architectural questions arose. The plan's own explicit non-goals (no `STRONG_VERBS` widening, no ledger change, no CAS behavior change, no Brain-shim flip adaptation, no honest-empty code fix) were all held.

## Issues Encountered

None beyond the pre-existing, already-named, out-of-scope residuals inherited unchanged from 276-07/276-08 (the `frozen_sweep.tools`/`frozen_sweep.branches` ledger re-freeze, owned by 276-15; `gate_answer`'s pre-existing divergence from Theo's own constant, unrelated to this plan and already named in `276-RESEARCH.md` section B1a).

## Checker Totals, Before/After This Plan (verbatim, live-measured)

Measured by temporarily restoring the pre-plan blobs of all three touched files (from parent commit `581dfb02`, the last commit before this plan's Task 1) into the working tree, running `checkTree()`, then restoring the committed post-plan content via `git checkout HEAD -- <path>` (diff-verified clean restore, zero drift from the real commits).

| | Before 276-11 (post-276-08/09/10/12) | After this plan (final) |
|---|---|---|
| HIGH_RISK | 0 | 0 |
| MEDIUM | 13 | 12 |
| LOW | 0 | 0 |
| UNKNOWN | 0 | 0 |

**Row move:** `gate_render.(default)`: MEDIUM ("weak tool-scoped claim...") -> **fully OK**, absent from every bucket. No other row moved (`graph_write`'s and `brain_ask`'s fixes are outside the checker's scan set entirely -- `graph_write`'s change is a parameter describe, B-6; `brain_ask` lives in a different MCP server file, `bin/mindrian-brain-mcp-client.cjs`, never scanned by `scripts/check-tool-honesty.cjs` at all).

## Theo Parity (recorded verbatim, per acceptance criteria)

`node tests/test-276-theo-description-parity.cjs` output after this plan's changes:

```
ROOM_BIND_DESCRIPTION [room_bind]: IDENTICAL (254 bytes both sides)
GRAPH_WRITE_DESCRIPTION [graph_write]: IDENTICAL (157 bytes both sides)
GATE_RENDER_DESCRIPTION [gate_render]: DIFFERS at offset 266 (plugin 429 bytes / theo 323 bytes)
GATE_ANSWER_DESCRIPTION [gate_answer]: DIFFERS at offset 585 (plugin 1462 bytes / theo 1152 bytes)
CHAIN_RUN_DESCRIPTION [chain_run]: IDENTICAL (1113 bytes both sides)

5 constant(s) compared, 2 problem(s) (DIFFERS or EXTRACTION_FAILED)
```

`GATE_RENDER_DESCRIPTION` now DIFFERS (expected -- this is the exact signal plan 276-13 consumes to mirror the corrected text into `/home/jsagi/Theo/src/mcp/operational/gate-render.ts:89`). `GATE_ANSWER_DESCRIPTION` was ALREADY diverging before this plan (unrelated cause: the T2 node-writing half's `SOURCED_FROM`/`USES_FRAMEWORK` clause, `276-RESEARCH.md` section B1a) -- untouched by this plan. `GRAPH_WRITE_DESCRIPTION` stays IDENTICAL, as designed (Task 2 only touched a parameter describe, never the TOOL description). `CHAIN_RUN_DESCRIPTION`/`ROOM_BIND_DESCRIPTION` unaffected.

**Theo mirror task registered for plan 276-13:** `GATE_RENDER_DESCRIPTION` at `/home/jsagi/Theo/src/mcp/operational/gate-render.ts:89` (source `.ts`; the dist build `dist/mcp/operational/gate-render.js` is what the parity test actually diffs against -- 276-13 should target the `.ts` source and rebuild).

`git -C /home/jsagi/Theo status --porcelain` before and after this plan (identical both times, nothing written from this repo):
```
 M src/generated/build-stamp.ts
?? .planning/phases/11-the-calibrator-guided-framework-sessions-seed-011/.gitkeep
```
Both entries are pre-existing local Theo-repo state, unrelated to and untouched by this plan.

## Over-the-Wire Assertion for Task 2 (B-6, recorded verbatim)

```js
const fs = require('node:fs');
const s = fs.readFileSync('lib/mcp/tools/graph.cjs', 'utf8');
const hasClaim = /lost update is rejected as a conflict/.test(s);
const hasDisclosure = /fails? open/i.test(s);
// hasClaim === true, hasDisclosure === true
```

This is the only proof available for this fix; `scripts/check-tool-honesty.cjs`'s `scanAll` (boundary B-6) reads only the second positional argument to `server.tool(` and never inspects a parameter `.describe()` string, so the standing detector produces no signal on this change at all -- neither a flip nor a flag. Plan 276-15 is the named owner if this assertion is worth promoting into a permanent test.

## Suite Results (recorded verbatim per plan verification block)

- `node tests/test-234-tool-description-floor.cjs` -- exit 0, **172 passed, 0 failed** (prose-shape coverage 40/40). `brain_ask` is NOT among the 40 -- `bin/mindrian-mcp-server.cjs` is the server this suite spawns, a different file from `bin/mindrian-brain-mcp-client.cjs`, so Task 3's description change was never in this suite's scan set. Stated plainly rather than claiming a pass the suite never measured.
- `node tests/test-270-tool-schema-budget.cjs` -- exit 0, **5 passed, 0 failed**. 40 tools, 40,065 total bytes (16,344 desc + 23,721 schema), ~10,016 approx tokens. Delta from the 270-06 baseline: +11.11% tool count, +35.93% total bytes -- entirely attributable to `claim_write` (276-12) and the phase's earlier description rewrites, well documented in prior plans; still within the suite's own 10% comparison to the recorded `276-12` AFTER baseline (the suite compares against the most recent recorded baseline, not the original 270-06 one). No baseline move needed for this plan; Task 2's own byte addition (graph.cjs schema bytes) is small relative to this margin.
- `node scripts/check-shape-declaration.cjs --check` -- exit 0, WARN advisory, **53 violations, none naming `gate_render`** (the pre-existing 53 are all `commands/*.md`/`skills/*.md`/`agents/*.md` surfaces with the F.*+`connector.excluded:true` double-declaration pattern, unrelated to this plan). `gate_render`'s `hitl_why` reviewed and confirmed still accurate; no new violation introduced.
- `node tests/test-ljj-tool-honesty.cjs` -- exit 0, **16 passed, 0 failed** (9 assertion groups).
- `bash tests/run-all-266.sh` -- **PASS=11 FAIL=0 SKIP=0**.
- `node tests/test-kwl-meeting-mcp-honesty.cjs` -- exit 0, **37 passed, 0 failed** (5 scenarios). The `meeting` fixture is intact, unaffected by this plan.
- `node tests/test-276-tool-honesty-findings-closed.cjs` -- **146 passed, 2 failed**. `gate_render.(default)` is now **CLOSED** (absent from the "still open" failure list, previously present). The 2 remaining failures are pre-existing, unrelated, and explicitly out of this plan's scope: `ledger frozen_sweep.tools` (36 vs live 37) and `ledger frozen_sweep.branches` (130 vs live 131), both caused by `claim_write`'s addition in 276-12, both owned by plan 276-15's re-freeze, both already named in `276-07-SUMMARY.md` and `276-08-SUMMARY.md` before this plan started.
- `grep -rP '\x{2014}' lib/mcp/tools/gate.cjs lib/mcp/tools/graph.cjs bin/mindrian-brain-mcp-client.cjs` -- no match, all three files.
- `git diff --cached --name-only` before each of the three commits listed exactly one file each: `lib/mcp/tools/gate.cjs`, `lib/mcp/tools/graph.cjs`, `bin/mindrian-brain-mcp-client.cjs`.

## Known Stubs

None. Every description rewrite states real, live-traced handler behavior; no placeholder text or hardcoded empty value was introduced.

## Threat Flags

None. This plan's threat register (T-276-03, T-276-16, T-276-27, T-276-06, T-276-28, T-276-19, T-276-09, T-276-SC) covers exactly the surface touched: every rewrite is an ADDITION (the original claim string survives alongside the new disclosure in all three edits, verified above); the gate ledger, TTL, and single-use spoofing guard are untouched (`git diff lib/mcp/tools/gate.cjs` shows one line, the description string only); `reconcile-guard.cjs` is confirmed absent from this plan's diff (`git status --porcelain lib/core/navigation/reconcile-guard.cjs` empty); the Theo mirror task is registered, never executed, `git -C /home/jsagi/Theo status --porcelain` unchanged; none of the other six Brain-shim-adaptation files were touched (confirmed empty `git status --porcelain` against all six); `STRONG_VERBS` was not widened (confirmed unchanged `minted` grep count); every commit was preceded by an audited `git diff --cached --name-only` check listing exactly one file. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced -- this plan is three description strings, nothing else.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **276-13** has its exact target: mirror the corrected `gate_render` description into `GATE_RENDER_DESCRIPTION` at `/home/jsagi/Theo/src/mcp/operational/gate-render.ts:89`, using the exact plugin sentence recorded above as the source of truth (`test-276-theo-description-parity.cjs` now reports the DIFFERS this plan predicted).
- **276-15** re-freezes `frozen_sweep.tools` (36 -> 37) and `frozen_sweep.branches` (130 -> 131), unchanged by this plan, and can now also drop `gate_render.(default)` from its own re-verification list -- it is fully OK.
- **276-16** carries the honest-empty trio finding into the follow-up register: `enrichCausalEdges` has zero production callers today; the first future caller inherits an un-audited empty-versus-absent contract at exactly the moment the Theo flip makes empties the common case.
- `requirements mark-complete TOOLHON-13 TOOLHON-02` returned `not_found` for both IDs -- `.planning/REQUIREMENTS.md` does not track TOOLHON-prefixed requirement IDs at all (confirmed by a direct grep returning zero matches before running the command). This is a pre-existing gap in the requirements tracker, not something this plan caused or can fix; the `requirements-completed` frontmatter field above is the record of intent.
- No blockers.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*

## Self-Check: PASSED

All three modified files (`lib/mcp/tools/gate.cjs`, `lib/mcp/tools/graph.cjs`, `bin/mindrian-brain-mcp-client.cjs`) and this SUMMARY.md verified present on disk; all three task commits (`02468fcb`, `66d7b4d6`, `6b043491`) verified present in `git log --oneline --all`.
