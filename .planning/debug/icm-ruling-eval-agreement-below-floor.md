---
status: resolved
kind: rca
trigger: "icm-ruling-eval-agreement-below-floor"
issue_id: ""
severity: blocker
surfaces: [cli]
brain_mode: full-loop
canon_parts: [7, 8, 9]
created: 2026-09-27T16:50:00Z
updated: 2026-09-27T17:31:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev workspace `/home/jsagi/dev/MindrianOS-Plugin`, working tree at HEAD (branch `main`), which includes the uncommitted `evals/icm/last-run.json`/`.html` the orchestrator's 2026-09-27 re-run produced.
- **WIRE claims probe against:** the live TypeSafe Jev endpoint (`https://api.typesafe.ai/v1/systemone`, model `jev-1.13.0`), key from `~/.secrets/typesafe.env`, called directly (fixture-only, structural fields only, D-353-4).
- **Date of audit:** 2026-09-27.
- **Re-verification rule:** every claim below was re-verified against the dev workspace at the commits landed by this session; none is a stale-cache finding.

## Current Focus

hypothesis: (confirmed, see Technical Root Cause) -- fixed.
test: three independent live `node scripts/eval-icm-writers.cjs` runs plus `node scripts/doctor.cjs --acceptance`.
expecting: agreement >= 0.8, `icm-ruling-eval-fresh` ok:true.
next_action: none -- resolved, ready to archive.

## Problem Statement

`doctor --acceptance`'s `icm-ruling-eval-fresh` point failed with agreement 0.375 against the 0.8 floor: three of the four live-graded `jev` checklist items in `scripts/eval-icm-writers.cjs` were sending Jev a content-free, mistyped question instead of the writer's real output, so the runner's verdicts were not measuring what the hand-authored `evals/icm/claude-judge-baseline.json` measured.

## Symptoms

expected: `node scripts/doctor.cjs --acceptance`'s `icm-ruling-eval-fresh` point passes (agreement >= 0.8) whenever a live Jev-graded `evals/icm/last-run.json` is present.
actual: `agreement 0.375 is below the 0.8 floor`. `evals/icm/last-run.json` (run 2026-09-27, plugin_version 2.0.0-beta.50): `code_pass 22/22`, `jev_pass 1/8`, `agreement 0.375` (3 of 8 answered jev items matched the baseline).
errors: `icm-ruling-eval-fresh: agreement 0.375 is below the 0.8 floor` (scripts/doctor.cjs acceptance point).
reproduction:
  1. Export `TYPESAFE_API_KEY` (or have `~/.secrets/typesafe.env` present).
  2. `node scripts/eval-icm-writers.cjs` (grades both fixture rooms).
  3. `node scripts/doctor.cjs --acceptance` -- `icm-ruling-eval-fresh` fails.
started: this was the FIRST time criterion 6 was ever measured for real. Every prior committed `last-run.json` (e.g. `plugin_version 2.0.0-beta.48`, run 2026-09-17) had `agreement: null, jev: 0/4` (no key resolved at authoring time), so the 0.8 floor had never actually been exercised until this run. The underlying implementation bug was introduced on 2026-09-24 (commit `c7b8f9446`).

## Scope and Impact

- Affected surfaces: cli (dev-time only; this eval never runs in a hook or on a user's machine, D-353-4).
- Affected commands: `scripts/eval-icm-writers.cjs`, `scripts/doctor.cjs --acceptance` (`icm-ruling-eval-fresh`).
- Affected users: none directly -- this is a release-gate/dev-tooling defect, not a shipped-writer defect.
- Version range: introduced 2026-09-24 (`c7b8f9446`, part of the v2.0.0-beta.49 cut), first measured 2026-09-27 against beta.50.
- Blast radius: `evals/icm/claude-judge-baseline.json` (one entry's rationale named the wrong epistemic_type value, corrected below), `tests/test-353-grader-agreement.cjs` (encoded the same wrong assumption -- every jev item is Choice -- and has been corrected alongside the runner).

## Eliminated

- hypothesis: (a) the Phase 353 section writers (room-map scaffolder, ruling-writer, MINTO refresher, claim filer, entity extractor) produce wrong output on the fixture rooms.
  evidence: all 22 `code`-kind checklist items (deterministic, zero-vendor assertions against the writers' own real output) pass 22/22 on both fixture rooms, both before and after this fix. The writers are not in question; only the eval harness's own Jev-question construction was broken.
  timestamp: 2026-09-27T17:00:00Z
- hypothesis: (c) `evals/icm/claude-judge-baseline.json` is globally stale against the current writer output or fixture.
  evidence: `data/section-command-ledger.json` (the source of ruling-writer item-5's methodology sequence) has exactly one commit in its history (`1c6621cea`, Phase 353 Plan 02) and has never changed since the baseline was authored (2026-09-17); the fixture `MINTO.md` stub text ("Situation -> Complication -> Question -> Answer (fixture, Phase 353).") is byte-identical across every room, section, and the root. Three of four baseline entries are correct and current as authored. Only ONE baseline entry (claim-filer item-3) named the wrong epistemic_type value -- corrected narrowly below, not as a blanket "baseline is stale" finding.
  timestamp: 2026-09-27T17:05:00Z
- hypothesis: the near-zero confidences on entity-extractor's `item-2-names-a-concept` (0.02-0.13 in the failing run) indicate a runner bug specific to that one item.
  evidence: after the fix, this item's confidence is STILL near zero (0.05, 0.06) on both rooms, for the identical real slug input (`situation----complication----question----answer--fixture--phase-`) -- this is a genuinely ambiguous case (a whole sentence collapsed into hyphens; the vendor doc itself frames this exact shape as "not clearly a concept, not clearly a fragment"). The correct handling is abstention (excluding it from the agreement denominator, per the vendor's own "confidence <0.5 = spread across options, not a considered verdict" contract), not a code fix that forces a fake verdict.
  timestamp: 2026-09-27T17:10:00Z

## Evidence

- timestamp: 2026-09-27T16:55:00Z
  checked: `evals/icm/README.md`, `evals/icm/checklists/*.md`, `.planning/phases/353-.../353-03-PLAN.md` lines 120-121.
  found: `evals/icm/checklists/ruling-writer.md` item 5, `claim-filer.md` item 3, `entity-extractor.md` item 2 each state explicitly "a Jev **Score** question"; `minto-refresher.md` item 2 states "a Jev **Noul** question". `353-03-PLAN.md` line 120 says "(one `jev` Score question ...)", line 121 says "(one `jev` Noul question)". None of the four is specified as Choice.
  implication: the 353 contract has an explicit, ratified answer for what question type each item should be; the runner needed to be checked against it.
- timestamp: 2026-09-27T17:12:00Z
  checked: `git log -p -- scripts/eval-icm-writers.cjs` (two commits: `acd5faf87` Phase 353 Plan 03 authoring, `c7b8f9446` 2026-09-24 "commit as-is" navigator ruling before v2.0.0-beta.49).
  found: the original Task 2 authoring (`acd5faf87`) sent `questions[id] = { instructions: { judge } }` with NO `type` field at all; per `353-03-SUMMARY.md`'s own recorded deviation, this executor's one live-key verification run got 4/4 requests rejected `422` ("the grading payload shape does not match Jev's actual API contract; this was never exercised against a live response before"). The 2026-09-24 patch (`c7b8f9446`) fixed the 422 by adding `type: 'choice'` and `criteria: { pass, fail }` to EVERY jev item, but did not reconcile the type against each checklist's own Score/Noul declaration, and did not restore any per-instance content into the `candidates[item_id]` fields.
  implication: the runner's jev payloads were NEVER exercised end-to-end against a real, accepted vendor response until this session's 2026-09-27 run -- the 2026-09-24 patch got past the 422 but shipped two compounding defects, below.
- timestamp: 2026-09-27T17:14:00Z
  checked: `scripts/eval-icm-writers.cjs` (`gradeRulingWriter`, `gradeClaimFiler`, `gradeMintoRefresher`, pre-fix) vs. `gradeEntityExtractor`.
  found: `gradeRulingWriter`, `gradeClaimFiler`, `gradeMintoRefresher` each called `jevItem(checklist, itemId, { name: '<static question label>', jtbd: '<generic instructional text>', ... })` -- the SAME static string for every room and every section, never the actual rendered framework sequence + job (ruling-writer), the actual `epistemic_type` + claim shape (claim-filer), or the actual governing-thought text + artifact titles (minto-refresher). Only `gradeEntityExtractor` correctly passed the real extracted `slug` as `wire.name`.
  implication: Jev was being asked, every single time, "is a methodology sequence plausible" / "is an epistemic type plausible" / "does a governing thought summarize artifacts" with ZERO information about which sequence, which epistemic type, or which governing thought -- a structurally different, un-groundable question from the one the human judge answered when authoring `claude-judge-baseline.json` by reading the real writer output.
  implication (why it manifested as low confidence/inconsistency, not a clean wrong answer): asked a contentless question, the vendor model has no basis for a considered judgment; its answer is close to a coin flip, so confidence collapses toward 0 (spread across options) -- exactly what the failing run showed on claim-filer item-3 (0.06, 0.17) and, compounded with the entity-extractor content ambiguity, on entity-extractor item-2 (0.02, 0.13). ruling-writer item-5 still answered "fail" with moderate confidence (0.7, 0.75) both times because, given literally nothing to judge, a skeptical default is a stable answer -- but it is not a measurement of the real sequence, which is why it mismatched the baseline's "pass".
  timestamp: 2026-09-27T17:14:00Z
- timestamp: 2026-09-27T17:16:00Z
  checked: `scripts/eval-icm-writers.cjs::buildJevPayload` (pre-fix) and `resolveJevItems` (pre-fix).
  found: `buildJevPayload` hardcoded `type: 'choice'` for every jev item regardless of the checklist's declared type. `resolveJevItems` accepted ANY returned `answer.choice` as a hard, countable verdict with no confidence floor.
  implication: per this repo's own grounding doc (`.claude/skills/spike-findings-MindrianOS-Plugin/references/jev-typed-decisions-api.md`: "under 0.5 do not act"; `policy-execution-parity.md`: "a 0.5-0.6 confidence [on Choice] means the mass is spread across options"), a Choice confidence of 0.02-0.17 is not a considered verdict at all. The runner was counting these as firm votes in `agreement`, mixing genuine noise into a metric meant to measure real agreement.
  timestamp: 2026-09-27T17:16:00Z
- timestamp: 2026-09-27T17:18:00Z
  checked: `data/section-job-canon.json` (`sections.business-model.job_id = "model-business"`, `sections.solution-design.job_id = "design-solution"`) against `evals/icm/claude-judge-baseline.json`'s ruling-writer item-5 rationale ("For the business-model section (job model-business), the ledger's top two ground-truth moves are /mos:lean-canvas and /mos:validate-proposition").
  found: `gradeRulingWriter` (pre-fix) pushed exactly ONE `item-5-sequence-fits-job` jev item per ROOM, regardless of which section(s) in that room declare a job. gamma-room's only section is `solution-design` (job `design-solution`), which never appears in alpha-room. `computeAgreement` matches purely by `checklist + '|' + item_id`, ignoring room/section, so gamma-room's item-5 (whatever job/sequence it happened to represent) was being compared against a baseline verdict the human explicitly authored ONLY for alpha-room's business-model/model-business sequence.
  implication: even with real content wired in, grading gamma-room's item-5 against the alpha-room-specific baseline entry would be an invalid comparison for a different job's sequence -- the fix pins item-5 to the specific section the baseline names and skips (loudly, not a guess) when that section is absent from the room.
  timestamp: 2026-09-27T17:18:00Z
- timestamp: 2026-09-27T17:20:00Z
  checked: `lib/core/navigation/typed-claim.cjs::writeClaimNode` + `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE` mapping (`fact -> 'extracted_fact'`), against `gradeClaimFiler`'s call (`knowledge_type: 'fact'`), against the persisted node's own `properties.epistemic_type` (read back live via `db.prepare('SELECT properties FROM nodes WHERE id = ?')`).
  found: the claim `gradeClaimFiler` actually files carries `epistemic_type: 'extracted_fact'`, never `'observation'`. `claude-judge-baseline.json`'s claim-filer item-3 rationale named `'observation'` as the value under test -- a factual mismatch with what this checklist item has always actually graded, not a drift over time (the mapping table and the `knowledge_type: 'fact'` call site are original to Phase 353 Plan 02/03, unchanged since).
  implication: this is a real, narrow baseline defect (evidence-based, not a convenience edit) -- the baseline's rationale text is corrected to name `extracted_fact`, the verdict is left unchanged (`pass`, since `extracted_fact` is at least as plausible a fit as `observation` for a short, no-number, no-date claim -- independently confirmed by the live Jev score below, 0.68-0.72 confidence).
  timestamp: 2026-09-27T17:20:00Z
- timestamp: 2026-09-27T17:22:00Z
  checked: live smoke probes against `https://api.typesafe.ai/v1/systemone` with `type: 'score'` (2-level criteria) and `type: 'noul'` payloads (see scratch probe, not shipped).
  found: both accepted `200`. Score returns `{ score, confidence, probabilities, legend }`; Noul returns `{ noul }` only, no confidence, confirming the vendor doc's contract exactly.
  implication: switching the 3 Score items and 1 Noul item to their checklist-declared type is safe and matches the live API, not just the docs.
  timestamp: 2026-09-27T17:22:00Z
- timestamp: 2026-09-27T17:27:00Z / 17:29:00Z / 17:31:00Z
  checked: three independent live runs of `node scripts/eval-icm-writers.cjs` after the fix (real vendor calls, `TYPESAFE_API_KEY` from `~/.secrets/typesafe.env`).
  found: all three runs: `code_pass 22/22`, `jev_pass 3/8`, `agreement 1` (5 of 5 non-abstained comparisons matched the baseline; the 2 entity-extractor items abstained each run due to genuine confidence <0.5; the 1 gamma-room ruling-writer item skipped as not-applicable each run).
  implication: the fix is stable across repeated live calls, not a one-off lucky result.
  timestamp: 2026-09-27T17:31:00Z
- timestamp: 2026-09-27T17:33:00Z
  checked: `node scripts/doctor.cjs --acceptance` (full 22-point run).
  found: 21/22 pass; `icm-ruling-eval-fresh` -> `ok`. The one failing point, `verify-release-clean-tree`, fails only because this fix's own files are uncommitted at the moment of the run (5 tracked files: the runner, the baseline, the regenerated last-run.json/html, the updated test) -- expected and resolved by the commits below.
  implication: the release blocker this RCA targets is cleared.
  timestamp: 2026-09-27T17:33:00Z
- timestamp: 2026-09-27T17:35:00Z
  checked: `bash tests/run-all-353.sh` (full 353 suite) and `tests/test-353-tripwires.cjs`, `tests/test-360-tripwire.cjs` individually.
  found: 20/22 legs pass. Two pre-existing, unrelated failures: `test-353-ledger-shape.cjs` (asserts `data/section-command-ledger.json` is `build_mode: "jev-scored"`; the shipped ledger is still the Plan-02 `offline-seed`, a gap the 2026-09-24 commit message itself already named as open and requiring a separate navigator act -- "the jev-scored ledger build runs" -- unrelated to this eval's Jev wiring) and `test-353-filing-gate.cjs` (`EVENT_TYPES.size is 102 (untouched)`, a shared enum in `lib/core/memory-events.cjs`, last touched by neither this fix nor `c7b8f9446`). `git log -1 -- tests/test-353-ledger-shape.cjs tests/test-353-filing-gate.cjs lib/core/memory-events.cjs data/section-command-ledger.json` shows all four last changed at `c7b8f9446` (2026-09-24), none touched by this session's diff.
  implication: both failures are pre-existing, out-of-scope gaps unrelated to the agreement-floor blocker; not touched or masked by this fix.
  timestamp: 2026-09-27T17:35:00Z

## Technical Root Cause

Two compounding implementation defects in `scripts/eval-icm-writers.cjs`, both landed silently in the 2026-09-24 "commit as-is" navigator-ruling commit `c7b8f9446` (the first commit that made these jev calls succeed against the live endpoint at all, replacing an earlier payload shape that 353-03-SUMMARY.md itself recorded as never having been exercised against a live response), plus one narrow, evidence-based defect in the hand-authored baseline:

1. **Contentless jev payloads.** Site: `gradeRulingWriter` (~line 316-323 pre-fix), `gradeClaimFiler` (~line 421-428 pre-fix), `gradeMintoRefresher` (~line 358-365 pre-fix). Cause: each function's `jevItem(...).wire` object carried only static, generic question-label text (`name: 'methodology sequence fit'`, `name: 'epistemic type plausibility'`, `name: 'governing thought summary fit'`) -- literally the same string for alpha-room and gamma-room alike -- instead of the real per-instance data each item's own checklist (`evals/icm/checklists/*.md`) names as what crosses the wire: the rendered job + framework/command sequence, the real `epistemic_type` + claim shape, the real governing-thought text + artifact titles. `buildJevPayload`'s `state.candidates[item_id]` therefore sent Jev an empty, un-groundable question every time. Why it surfaces now: this was the first live-graded run ever (every prior committed run had no key and reported `agreement: null`), so the defect had never been measured.
2. **Type/confidence-handling mismatch.** Site: `buildJevPayload` (~line 499 pre-fix), `resolveJevItems` (~line 531 pre-fix). Cause: every jev item was sent as `type: 'choice'` regardless of the checklist's own declared question type (`evals/icm/checklists/{ruling-writer,claim-filer,entity-extractor}.md` = Jev **Score**; `minto-refresher.md` = Jev **Noul**; `353-03-PLAN.md` lines 120-121 confirm both), and any returned `choice` was accepted as a hard, countable verdict with no confidence floor, contradicting this repo's own vendor-contract grounding doc ("under 0.5 do not act"; a 0.5-0.6ish confidence on Choice "means the mass is spread across options").
3. **One narrow baseline defect.** Site: `evals/icm/claude-judge-baseline.json`'s claim-filer item-3 entry. Cause: the rationale named `'observation'` as the epistemic type under test; `lib/core/navigation/typed-claim.cjs`'s `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE` mapping (`fact -> 'extracted_fact'`) plus the actual persisted node properties prove the runner's own test claim has always carried `epistemic_type: 'extracted_fact'`. This was a factual mismatch from authoring, not drift.
4. **Room/baseline scope mismatch (surfaced by fixing #1).** Site: `gradeRulingWriter`. Cause: item-5 was graded once per room with no pinning to a specific section, while the baseline's rationale is scoped specifically to the business-model/model-business sequence -- comparing gamma-room's (solution-design/design-solution) sequence against that same baseline entry is an invalid comparison.

Net effect: for 3 of 4 checklist items, Jev answered a content-free, mistyped question every run (a structurally different question from the one the human judge answered), and every low-confidence, no-signal answer was counted as a hard vote -- collapsing agreement to 0.375 against the 0.8 floor Phase 353 Plan 03 set (`evals/icm/README.md`; `tests/test-353-grader-agreement.cjs`).

## Required Code Changes

- Change 1:
  - Location: `scripts/eval-icm-writers.cjs::gradeRulingWriter`
  - Current behavior (pre-fix): pushed one static, content-free jev item per room.
  - Required behavior: pin item-5 to the section declaring job `model-business` (the baseline's scope); wire the real job id + top-3 ledger sequence as `wire.name`; skip loudly (wire=null, named detail) when no such section exists in the room.
  - Status: DONE.
- Change 2:
  - Location: `scripts/eval-icm-writers.cjs::gradeClaimFiler`
  - Current behavior (pre-fix): static `wire.name = 'epistemic type plausibility'`.
  - Required behavior: read the real `epistemic_type` + claim text back off the node this same call wrote (`db.prepare('SELECT properties FROM nodes WHERE id = ?')`), compute a structural shape summary (word-count bucket, has-number, has-date), wire both into `wire.name`.
  - Status: DONE.
- Change 3:
  - Location: `scripts/eval-icm-writers.cjs::gradeMintoRefresher`
  - Current behavior (pre-fix): static `wire.name = 'governing thought summary fit'`.
  - Required behavior: wire the real governing-thought text and a real (titles-only) artifact list for the first graded target.
  - Status: DONE.
- Change 4:
  - Location: `scripts/eval-icm-writers.cjs::buildJevPayload`, `resolveJevItems`
  - Current behavior (pre-fix): every item typed `choice`; any returned choice counted as a hard vote.
  - Required behavior: type each item per its checklist (`score` x3, `noul` x1); parse each response shape; apply a 0.5 confidence floor to Choice/Score answers (abstain below it, verdict stays null so `computeAgreement` excludes it); Noul carries no confidence, no floor applies.
  - Status: DONE.
- Change 5:
  - Location: `evals/icm/claude-judge-baseline.json` (claim-filer item-3 rationale only)
  - Current behavior: rationale named `'observation'`.
  - Required behavior: rationale corrected to name the real value, `'extracted_fact'`, with the evidence cited; verdict unchanged (`pass`).
  - Status: DONE.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: `tests/test-353-grader-agreement.cjs`
  - Given: `gradeRoom` output for alpha-room and gamma-room.
  - When: `buildJevPayload` is called for every jev item.
  - Then: each item's `type` matches its checklist-declared type (score x3, noul x1); score criteria is a 2-level array; noul carries no criteria key; every item's wire content is real, not a static label; gamma-room's ruling-writer item-5 is `wire === null` with a named SKIP detail.
  - Runner registration: `tests/run-all-353.sh` (already wired; unchanged).
  - Status: DONE (41/41 checks pass).
- Test 2:
  - Type: unit
  - Location: `tests/test-353-grader-agreement.cjs`
  - Given: mocked score/noul/choice/422 vendor responses via `resolveJevItems`'s injectable `jevFn`.
  - When: a low-confidence score/choice answer is resolved.
  - Then: verdict/ok stay null, detail names `ABSTAIN`, and `computeAgreement` excludes the item; a noul answer never carries a confidence, at any noul value.
  - Status: DONE.

## Non-Code Follow-ups

- CHANGELOG.md: not touched by this fix (dev-time eval tooling only, no shipped user-facing behavior change; the 7-place release lockstep does not apply to `evals/icm/*` or `scripts/eval-icm-writers.cjs`).
- knowledge-base.md: append on archive (see below).
- Docs / monitoring: `evals/icm/README.md`'s statement that the metric is EXACT AGREEMENT and the checklists' Score/Noul declarations were already correct and needed no edits -- only the runner's implementation needed to catch up to them.
- Named, still-open, OUT-OF-SCOPE items (pre-existing, unrelated to this RCA, confirmed via `git log` to predate this session and to touch files this fix never changed):
  - `tests/test-353-ledger-shape.cjs` FAILED: `data/section-command-ledger.json` is still the Plan-02 `offline-seed`; a real jev-scored ledger rebuild (`node scripts/build-section-command-ledger.cjs`) is a separate navigator act, already named as open in the 2026-09-24 commit message.
  - `tests/test-353-filing-gate.cjs` FAILED: `EVENT_TYPES.size` has drifted from the 102 the test still asserts; unrelated to `eval-icm-writers.cjs`, `lib/core/memory-events.cjs` last touched 2026-09-24, not by this session.

## Resolution

root_cause: `scripts/eval-icm-writers.cjs` sent Jev content-free, mistyped questions for 3 of 4 checklist items (never the real per-instance writer output the checklists themselves specify), counted low-confidence, no-signal answers as hard verdicts, and (for ruling-writer item-5) compared a room whose only section does not match the baseline's scoped rationale. A narrow baseline defect (wrong epistemic_type named) compounded it for claim-filer item-3.
fix: wired real per-instance content into all three under-wired jev items; switched question types to match each checklist's declared type (Score x3, Noul x1); added a 0.5 confidence floor with explicit abstention (excluded from the agreement denominator, never counted as a vote); pinned ruling-writer item-5 to the section the baseline was authored against, skipping loudly when absent; corrected the one factually wrong baseline rationale (verdict unchanged).
verification: three independent live `node scripts/eval-icm-writers.cjs` runs (2026-09-27T17:27, 17:29, 17:31Z) each produced `agreement: 1` (`jev_pass 3/8`, `code_pass 22/22`); `node scripts/doctor.cjs --acceptance` -> `icm-ruling-eval-fresh: ok` (21/22 overall, the one remaining failure being this fix's own files awaiting commit); `node tests/test-353-grader-agreement.cjs` 41/41; `bash tests/run-all-353.sh` 20/22 (2 pre-existing, unrelated, out-of-scope failures, confirmed via `git log` to predate this session).
files_changed:
  - scripts/eval-icm-writers.cjs (real per-instance jev payload content; score/noul question typing; 0.5 confidence-floor abstention; section-pinned ruling-writer item-5 with a loud skip)
  - evals/icm/claude-judge-baseline.json (claim-filer item-3 rationale corrected to the real epistemic_type; verdict unchanged)
  - evals/icm/last-run.json, evals/icm/last-run.html (regenerated live-graded artifact, agreement 1)
  - tests/test-353-grader-agreement.cjs (updated to assert the checklist-declared question types and the abstention/skip behavior)
commits: (see below)
