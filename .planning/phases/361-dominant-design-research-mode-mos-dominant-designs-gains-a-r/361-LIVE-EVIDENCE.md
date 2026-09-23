# Phase 361 Plan 08: Live Theo probe and phase gate evidence

**Date:** 2026-09-23
**Commit at run time:** `bd61b6580` (HEAD, shared tree; other sessions active)

## Live Theo probe

Command: `node scripts/dominant-design-research.cjs theo-structure` (normal HOME, normal network, no flags).

This sends Theo exactly three calls, each with `args` deep-equal to `{"framework":"Dominant Design"}`. No domain, room, or venture text is involved.

Full JSON output:

```json
{
  "source": "reference",
  "reason": "no_steps_in_canon",
  "reasons": {
    "framework_step": "no_steps_in_canon",
    "framework_techniques": null,
    "case_story": "not_served"
  },
  "steps": [
    { "id": "phase-1", "name": "Domain Selection" },
    { "id": "phase-2", "name": "Dominant Design Identification" },
    { "id": "phase-3", "name": "Discontinuity Analysis" },
    { "id": "phase-4", "name": "S-Curve Limits and Destruction" },
    { "id": "phase-5", "name": "New Design Possibilities" },
    { "id": "phase-6", "name": "Problems Worth Solving" }
  ],
  "techniques": [],
  "cases": [],
  "calls": [
    {
      "tool": "framework_step",
      "args": { "framework": "Dominant Design" },
      "outcome": "no_steps_in_canon",
      "egress_disclosure": false
    },
    {
      "tool": "framework_techniques",
      "args": { "framework": "Dominant Design" },
      "outcome": "served",
      "egress_disclosure": false
    },
    {
      "tool": "case_story",
      "args": { "framework": "Dominant Design" },
      "outcome": "not_served",
      "egress_disclosure": false
    }
  ]
}
```

### Assertions

- Every `calls[].args` deep-equals `{"framework":"Dominant Design"}` -- CONFIRMED, all three.
- `calls[0].egress_disclosure` (framework_step) is `false` -- CONFIRMED. All three calls carry `egress_disclosure: false`, not just framework_step. Theo's raw responses no longer carry an `egress_disclosure` key at all for this known, generic-handle shape -- the 361-02 Part 8 arms (`framework_step`, `framework_techniques`, `case_story` known-shape entries in `_proveKnownToolShape`) took effect live: what would otherwise show `egress_disclosure: {verdict: "ambiguous", egress_class: "unknown"}` (per the 361-RESEARCH.md Pattern 5 baseline table, measured before this session's arms landed) is now recognized as a known, safe shape and disclosed clean.
- Theo reachable: `source: 'reference'` because `framework_step` is served but returned zero steps (`no_steps_in_canon`), matching D-09's "served but zero steps is not authoritative" rule. Not an ENV GAP -- Theo answered.

### Comparison with the 361-RESEARCH.md Pattern 5 baseline

| Tool | Baseline (2026-09-23, pre-arms) | This probe (2026-09-23, post-arms, live) | Changed? |
|---|---|---|---|
| `framework_step` | served, `steps: []` -> reference, `egress_disclosure: {ambiguous}` | served, `steps: []` -> reference (`no_steps_in_canon`), `egress_disclosure: false` | Outcome same; disclosure shape now clean (arm effect) |
| `framework_techniques` | not served (`Tool framework_techniques not found`) | **served** (empty `rows`, so `techniques: []`) | **Changed** -- Theo Phase 20 (deployed 2026-09-23T15:12Z per this session's live-Theo-probe brief, 41 tools) now serves this tool |
| `case_story` | not served | not served | Same -- Theo 20.1 (case_story / MOS-LEARNING) has not shipped |

This is news worth a line: `framework_techniques` moved from not-served to served sometime between the Pattern 5 baseline capture and this probe, consistent with the Theo Phase 20 deploy this session was briefed on. It returned an empty technique list for Dominant Design, so it does not change the overall `source: reference` outcome (D-09 still requires `framework_step` to carry at least one runnable step). No case_story recheck is triggered (D-15) -- that tool is still not served.

## Full-suite and acceptance gate results

| Gate | Result | Classification |
|---|---|---|
| `bash tests/run-all-361.sh` | `PASSED=27 FAILED=2 SKIPPED=0` | The 2 failures are the pre-existing peer failures named in this session's operating instructions: `lib/core/part8-egress-guard.test.cjs` (PB8-03 self-test) and `tests/test-209-declared-implies-wired.cjs`. Both predate this plan and are owned by other sessions/phases; not touched. |
| `node scripts/build-connector-registry.cjs --check` | `connector-registry: OK` | PASS |
| `node scripts/build-orchestration-projection.cjs --check` | `orchestration-projection: OK` | PASS |
| `node scripts/check-render-coverage.cjs` | 16 covered, 0 excluded, 0 gap; 202 wired, 2 excluded, 0 unwired | PASS |
| `node scripts/doctor.cjs --acceptance` | 20/21 points passed; failed: `verify-release-clean-tree` | `verify-release-clean-tree` FAILs on "tracked-file drift: 8 file(s)" -- confirmed via `git status --short` to be entirely peer-session uncommitted work in `.planning/quick/260920-bhx-localhost-review/*`, `docs/reviews/mindrian-system-explainer.html`, `evals/plurai/211-baseline.json`, `scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, plus two untracked docs files (`docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md`, `docs/reviews/mindrian-system-atlas.html`). None of these paths are in this plan's `files_modified` list or touched by any 361 plan. Known pre-existing peer condition (present at session start, confirmed unchanged); owner is whichever concurrent session (355/357/358/359/360) is mid-edit on those files. Not fixed here. |

## Registry hash pair (from 361-07-SUMMARY.md)

- `PRE_HASH`: `43d13474f8028fb9a2cc589388a9aa2a2ef90cf5a7bb55fee10eb203c850f9f8`
- `POST_HASH`: `c6150a8e09b42d6c2b67b4eef6ce40d780bb7d570d06ccb6bd4b6efaf35ac3bc`
- The hash movement rides the next real release's Step 5.6 theo-resync dispatch; this phase (and this plan) sends no notify.

## Task grant context (for the navigator's checkpoint)

Row today (`data/subagent-dispatch-grants.json`, `commands/dominant-designs.md`): `status: pending`, `reviewed_by: navigator`, `reviewed_date: 2026-09-23`, `fan_bound: 4` (clamped by `resolveFanoutCap`). With the row pending, `/mos:dominant-designs` still works; each of up to four lane-agent spawns per deep dive may show a permission prompt, and `tests/test-265-swarm-task-grant.cjs` reports it as `unratified` (a strict grant-gate run, `TEST_265_GRANTS_STRICT=1`, would fail on this row alone).
