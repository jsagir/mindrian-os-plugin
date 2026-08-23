# Phase 264: Roadmap-Type Selector: challenge-driven act-chain orchestration for the research command family - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 264-roadmap-type-selector-challenge-driven-act-chain-orchestrati
**Areas discussed:** Classifier placement + method, Chain-table schema + fire threshold, BONO critique pattern (advisor mode, `minimal_decisive` calibration tier, 3 parallel `gsd-advisor-researcher` agents), plus one navigator-decided blocker (`ralph_verify` inert on `chain_run`'s async path).

---

## Classifier placement + method

| Option | Description | Selected |
|--------|-------------|----------|
| A. New standalone `lib/core/sensors/sensor-roadmap-type.cjs` | Matches 17 of 19 registered sensors; header doctrine names this as policy; both safety fences enumerate the directory from disk. | ✓ |
| B. One more inline `sensorX` in `insight-sensors.cjs` | Gray area's premise was factually wrong -- the two "inline" examples cited are actually standalone files (2 of 19 legacy exceptions are the true inline pair). | |
| A. Deterministic scored classifier (`dual-path-detector.cjs` template) | The only mechanism the seam supports -- `dispatchSensors` is sync inside a 1200ms budget, silently drops any Promise. | ✓ |
| B. Out-of-band judgment producer + marker file | Delivers model-grade judgment without breaking sync contract, but needs a producer + freshness/spoofing guards for a "silent" 6-way classification -- deferred if fixture accuracy proves inadequate later. | |
| C. LLM call inside the sensor | Structurally impossible: a returned Promise is silently dropped, not errored; `lib/core/*.cjs` has no model handle in-process. | |

**Auto-selected:** Option A for both sub-questions (`[auto]` — recommended default, both effectively forced by the shipped seam contract, not a real preference).
**Notes:** Research also caught a real defect in SPEC.md Requirement 3 during this pass: a reach candidate is a frozen 6-key struct (`makeReach`), so the planned `suggested_chain` top-level field cannot exist as such — resolved as `companions` (chain array) + `evidence.roadmap_type` (enum), see CONTEXT.md D-03.

---

## Chain-table schema + fire threshold

| Option | Description | Selected |
|--------|-------------|----------|
| A. Hand-authored flat map + drift test (`dispatch-framework-map.json` precedent) | No frontmatter source of truth to generate FROM; a generator would be cargo-culted ceremony over a literal. | ✓ |
| B. Generated file + `build-*.cjs --check` pre-commit gate | Matches `command-registry.json`'s convention, but that file generates from real frontmatter this content doesn't have. | |
| A. Single-hit tiered fire + `posture:'hold'` | The shipped pattern verbatim (`sensorDiffusionAdoption`/`sensorShowShare`); eagerness absorbed at the Decision Gate, not the threshold. | ✓ |
| B. Corroboration threshold (N>=2 signals) | One shipped precedent (`sensorPerspectiveLock`), but its rationale (avoid double-firing an already-firing sibling) does not transfer here; would mostly produce silence. | |

**Auto-selected:** Option A for both (`[auto]` — recommended default).
**Notes:** Validator must check against `framework_index` (what `commandsForFramework` actually reads), not a bare name allowlist — a name can pass an allowlist and still resolve to `{command:null, optional:true}`. Negative-fixture set strengthened beyond SPEC's floor: add one near-miss negative (the "laws"/"flaws" substring-match bug class already latent in two shipped sensors) plus a Part-8 flat-scalar-evidence assertion.

---

## BONO critique pattern

| Option | Description | Selected |
|--------|-------------|----------|
| `reviewer-governance.cjs` adapted into a new sibling module | Only one of three that emits the actual `selfCritiqueFn(step,result)->{passed,quality,violations}` contract; only one already proven wired into a real chain (`grade-grant-examine.cjs:517`). | ✓ |
| `debate-composition.cjs` | Only accepts a critic as pass-through option — wrong layer. | |
| `persona-research.cjs` | Async evidence dispatcher; `validateCitations` needs fields RS findings don't carry. | |
| N-skeptics-with-majority-vote panel | `eureka-critic.cjs` explicitly rejected panels in-repo ("a 9-judge panel delivered ~2.2 effective votes"). | |
| Exactly 2 judges (neutral, then adversarial), unanimity required to pass | `eureka-critic.cjs:462-468`'s already-ruled answer, reused verbatim. | ✓ |

**Auto-selected:** `reviewer-governance.cjs` + the eureka-critic 2-judge unanimous pattern (`[auto]` — recommended default).
**Notes:** Two real blockers surfaced by this research pass, both resolved:
1. `argumentFromResult` (`hat-governance.cjs`) would be a silent no-op critic on Reverse Salient findings — their shape has no `stance`/`evidence[]`. The plan must author real field mapping, not reuse this helper unmodified.
2. `ralph_verify` is inert on `chain_run`'s async path (`chainRun` always forces `roomDir`, which routes to `_runChainResilient`, which never calls `_ralphSafeRetry`) — see the separate navigator decision below.

---

## Navigator decision: ralph_verify inert on chain_run's async path

**Not a research-table choice** — a real architectural blocker found by direct code verification, presented to the navigator directly (not auto-resolved, since it changes how Requirement 4's acceptance actually gets satisfied).

| Option | Description | Selected |
|--------|-------------|----------|
| Direct `runChain()` call for the flagship proof + defer the async fix | Smallest, safest: proves the pattern via a scoped call mirroring an existing precedent (`debate-composition.cjs:367`), zero changes to shared machinery, stays inside SPEC.md's locked boundaries. | ✓ |
| Fix `chain_run`'s async path in this same phase | Bigger, more valuable (works everywhere, not just this flagship step), but touches `chain-executor.cjs`'s shared async path — would require reopening SPEC.md's own boundaries. | |

**Navigator's choice:** "Yes, direct runChain() call + defer the async fix (Recommended)"
**Notes:** The live navigator-facing `chain_resolve`/`chain_run` flow will NOT get `ralph_verify` benefits from this phase alone — an honest scoping consequence, stated in CONTEXT.md D-11 and named as a Deferred Idea, not swept under.

---

## Claude's Discretion

- Exact `data/roadmap-type-chains.json` key naming (slug vs enum string).
- Whether `salient-governance.cjs`'s rule table is inline or a separate fixture file.

## Deferred Ideas

- Make `chain_run`'s async path honor `ralph_verify` (future phase, reopens SPEC boundaries).
- Extend `ralph_verify` + the reused critic to the other five roadmap-type chains.
- The 4 deferred graph-edge classes in `payloads/scientific-roadmapping.mjs` (`ProblemsWorthSolving-Brain` repo) — same navigator-originated research thread, unrelated to this phase's code, needs a read-access session first.
