---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 14
subsystem: testing
tags: [theo, capture, replay, citation-pairs, gold, blind, checkpoint, external-model-labeling]

# Dependency graph
requires:
  - phase: 355-02
    provides: direction-convention.cjs (phraseHash, PHRASES_CONFIRMED) gating the citations set
  - phase: 355-03
    provides: scripts/label-355-gold.cjs (blind labeling CLI: start/resume/status/emit)
  - phase: 355-06
    provides: lib/core/verification-stamp.cjs (choosePath, name resolution)
  - phase: 355-07
    provides: scripts/jev-question-ceilings.cjs (renderClaim, hopsFromTheoPath)
  - phase: 355-08
    provides: data/framework-names.json (canon snapshot, Part 8 name check)
provides:
  - "scripts/capture-355-theo-responses.cjs: dev-time Theo find_connections capture with offline --check"
  - "tests/fixtures/355-theo-find-connections-responses.json: 148 sanitized, real Theo answers (served: true)"
  - "tests/fixtures/355-citation-pairs.items.json: 43 templated {claim, path} citation items, 5 strata, 8 no_path"
  - "tests/fixtures/355-citation-pairs.json: citation gold, machine-labeled by claude-opus-5.5 (labeler_kind: external_model), 43/43, counts 35 says_nothing / 8 contradicts / 0 supports"
  - "scripts/label-355-gold.cjs import subcommand: gold from an external model's labels under a navigator ruling, refuses --labeler navigator"
  - "itemId() bug fix in scripts/label-355-gold.cjs: the citation items file keys by pair_id, not id -- root cause of the navigator's 0/43 sitting"
affects: ["355-26 (citation-check calibration, D-46, consumes this gold -- its stated-vs-withheld agreement must be read against a two-class effective gold, see Deferred Items below)", "355-15 (already completed; unaffected)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "import subcommand on the blind-labeling CLI: a machine-gold escape hatch parallel to emit --partial (355-03's precedent) -- opt-in, additive, refuses the reserved 'navigator' labeler name so the human sitting path can never be impersonated by an import, and stamps labeler_kind: external_model so no downstream consumer can mistake it for human gold"
    - "itemId() fallback (it.id ?? it.pair_id): lets id-keyed session/emit/import code paths work uniformly across item-file shapes that differ only in which field names the identity, without per-set branching"

key-files:
  created:
    - tests/fixtures/355-citation-pairs.json
  modified:
    - scripts/label-355-gold.cjs
    - tests/test-355-label-cli.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/labeling-session-citations.json
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "Navigator ruling (2026-09-24): the citation gold for this phase is machine-labeled by an external model (Claude Opus 5.5, fresh chat, opaque ids, shuffled order, rule withheld) instead of the navigator's own blind keystrokes. The gold file's labeler field reads \"claude-opus-5.5\", never \"navigator\"; labeler_kind: \"external_model\" makes the provenance structurally unmistakable. The navigator's own sitting stands at 0/43 and is recorded as such (labeling-session-citations.json, entries: {}). This is a ruled deviation for the citation set only -- the sentence gold from 355-03 remains the navigator's own blind labels."
  - "Root-caused, not just observed: the navigator's 0/43 outcome traces to a real bug, not operator error or a change of heart. scripts/label-355-gold.cjs used item.id uniformly across all four sets, but the citation items file (355-citation-pairs.items.json, authored by this same plan's Task 2) keys items by pair_id. Every citation item therefore collapsed onto the single Map key item.id === undefined, so the CLI could show and record at most one distinct item no matter how many the navigator pressed through. Fixed via a new itemId() helper (id, falling back to pair_id) applied uniformly in start/resume/emit/import, with a regression test (B11b) proving three distinct entries now record correctly against a pair_id-only items file. Default behavior for the three sets that already used id (sentences, both pairings) is unchanged -- proven by the full pre-existing 54-check suite staying green."
  - "import implemented as a new subcommand, not a flag on emit: emit's job stays 'turn my own completed session into gold'; import's job is 'turn someone else's completed, provenance-carrying label set into gold'. Keeping them separate subcommands (rather than overloading emit with a --from flag) makes the labeler_kind: external_model / navigator distinction a structural property of which subcommand ran, not a value that could be omitted or spoofed."

requirements-completed: [HIPS-04, HIPS-09]

# Metrics
duration: ~35min (this resumed session; Tasks 1-2 and the navigator's 0/43 sitting happened in prior sessions)
completed: 2026-09-24
---

# Phase 355 Plan 14: Theo Capture, Templated Citation Items, and Machine-Labeled Citation Gold Summary

**scripts/capture-355-theo-responses.cjs records 148 sanitized, real Theo find_connections answers; scripts/jev-question-ceilings.cjs templates 43 Part-8-clean citation items across 5 strata; the citation gold is machine-labeled by an external model (Claude Opus 5.5) under an explicit navigator ruling, after root-causing the navigator's own 0/43 sitting to a real pair_id/id key-collision bug in the labeling CLI, now fixed.**

## Performance

- **Duration:** ~35 min (this resumed session only, covering Task 3's executor half; Tasks 1-2 and the navigator's citation sitting happened in prior sessions)
- **Completed:** 2026-09-24
- **Tasks:** 1 (Task 3, executor half, resumed after a human-action checkpoint)
- **Files modified:** 5 (scripts/label-355-gold.cjs, tests/test-355-label-cli.cjs, tests/fixtures/355-citation-pairs.json created, labeling-session-citations.json committed, deferred-items.md, ROADMAP.md)

## Accomplishments

- Root-caused the navigator's 0/43 citation sitting (previously assumed to be a simple "navigator didn't finish"): `scripts/label-355-gold.cjs` keyed every id-based operation off `item.id`, but the citation items file (`355-citation-pairs.items.json`) keys its items by `pair_id`. All 43 items collapsed onto one `undefined` Map key, so the CLI could only ever track one item's worth of state regardless of how many distinct pairs the navigator pressed through -- an actual defect, not operator fatigue or an early quit.
- Fixed test-first (RED then GREEN): a new `itemId()` helper (`it.id ?? it.pair_id`) applied uniformly across `start`/`resume`/`emit`/`import`; a regression test (Behavior 11b) proves three distinct citation-style items now record as three distinct session entries and emit as three distinct gold rows. The pre-existing 54-check suite stayed green throughout, confirming no behavior change for the three sets that already used `id` (sentences, both pairing sets).
- Added a new `import` subcommand test-first (Behavior 11c, 13 new checks): writes gold from an external model's labels under the navigator's ruling. Refuses `--labeler navigator` outright (that path stays the CLI sitting); verifies every item id appears exactly once in the external file with a label from the closed vocabulary before writing anything; writes the same `{id, claim, path, gold}` shape `emit` writes, plus `labeler_kind: "external_model"`.
- Ran the import for the real 43-item citation set against `external-labels-citations.json` (Claude Opus 5.5's labels, delivered by the navigator after the ruling). Verified: `labeler === "claude-opus-5.5"`, `labeler_kind === "external_model"`, `fixture_sha256` matches the current items file, 43/43 items, every verdict in `{supports, says_nothing, contradicts}`, counts exactly 35 `says_nothing` / 8 `contradicts` / 0 `supports`.
- Committed the gold, the external-model's raw provenance record, and the navigator's own (empty, 0/43) session file together, force-added since `.planning/*` is gitignored in this repo (per the tracked-files house rule). Confirmed D-32 holds: no `tests/fixtures/355-jev-citation-*.json` exists at this commit -- the gold precedes any Jev citation response file.

## Task Commits

Task 3 (executor half) was a TDD-style RED/GREEN sequence plus a data commit:

1. **RED + GREEN: `itemId()` bug fix + `import` subcommand, test-first** - `dffc7d983` (feat) -- both the citation-item pair_id/id fix and the new `import` command landed in one commit; RED added 18 failing checks (5 for the bug-fix regression, 13 for `import`), GREEN brought the suite to 72/72.
2. **Commit the machine-labeled gold + provenance + navigator's 0/43 session file** - `c568d6da7` (docs)

Prior-session commits for this plan (Tasks 1-2, recorded here for completeness): `c0d012496` (Task 1 RED), `85c29d57c` (Task 1 GREEN), `635956586` (fix: never write the raw OS hostname into a committed capture file), `b12ad09a0` (Task 2: live Theo capture + 43 templated citation items).

**Metadata commit (this plan close):** committed separately below, per the final_commit protocol.

## Files Created/Modified

- `scripts/label-355-gold.cjs` - New `itemId()` helper (fixes the pair_id/id collision for the citation set); new `import` subcommand (external-model gold under a navigator ruling, refuses `--labeler navigator`); `usageText()` documents `import`
- `tests/test-355-label-cli.cjs` - Behavior 11b (pair_id-only items now record and emit correctly, 5 checks) and Behavior 11c (`import` happy path + three refusal paths, 13 checks); suite now 72/72
- `tests/fixtures/355-citation-pairs.json` - NEW. The citation gold, `labeler: "claude-opus-5.5"`, `labeler_kind: "external_model"`, 43 items, `{id, claim, path, gold}`
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/labeling-session-citations.json` - The navigator's own session, `entries: {}` (0/43), committed as the honest record of the ruled deviation
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md` - Two new entries: the `ALIAS_OF`-sampling gap (`supports` unreachable) and the synthetic-`contradicting` note, both carried forward for 355-26
- `.planning/ROADMAP.md` - 355-14 row checked, Plans counter 23/28 -> 24/28

## Decisions Made

**1. Navigator ruling accepted verbatim, recorded as data, not just prose.**

> The citation gold for this phase is machine-labeled by [Claude Opus 5.5]; every record must say so. The gold file's `labeler` field is `"claude-opus-5.5"` (never `"navigator"`), with `labeler_kind: "external_model"`. The navigator's own sitting stands at 0/43 and is recorded as such. D-31..D-33's "navigator labels blind" is a ruled deviation for this set only -- the sentence gold in 355-03 remains the navigator's.

This is the exact inverse of 355-03's precedent (where Codex or any model labeling the *remaining* sentence items was explicitly rejected -- "gold is human or it is not gold"). The distinction the navigator drew between the two cases: 355-03's gap was the navigator running out of time on a working CLI; 355-14's gap was a broken CLI making a working sitting impossible in the first place, discovered only after the checkpoint was already raised. Both rulings are logged verbatim so a future reader sees they are not in tension -- they answer different situations.

**2. The bug is fixed, not routed around.** Rather than leaving the pair_id/id mismatch as a permanent reason the citation set must always go through `import`, `itemId()` fixes the underlying defect so a future full navigator sitting (`resume --set citations`, then `emit --set citations` without `--partial`) would now work correctly and supersede this machine gold through the pre-existing strict `emit` path -- no further CLI changes needed. The bug fix is a Rule 1 (auto-fix bug) deviation, in scope because it was directly encountered while wiring the `import` path for this exact item set, and because leaving it in place would have meant the navigator (or anyone) hitting the identical collapse on any future citation sitting attempt.

**3. `import` as a new subcommand, not an `emit --from` flag.** Keeps `labeler_kind` a structural property of which subcommand ran (`emit` always writes `labeler: "navigator"`; `import` always writes `labeler_kind: "external_model"` and refuses the literal string `"navigator"` as a labeler name) rather than a value that could be typo'd or omitted on an overloaded flag.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `itemId()`: citation items file keys by `pair_id`, but every id-based CLI path used `item.id`**

- **Found during:** Task 3 (executor half), while designing the `import` subcommand's matching logic against the real `355-citation-pairs.items.json`
- **Issue:** `doSession`'s `itemById`/`ids` construction, and `doEmit`'s missing/session-lookup/output-id logic, all read `items[i].id` / `it.id` directly. The citation items file (authored in this same plan's Task 2, per the plan's own action text: `{ "pair_id", "from", "to", ... }`) has no `id` field at all -- every item's `.id` was `undefined`. This silently collapsed all 43 distinct citation pairs onto a single `Map` key and a single `session.entries['undefined']` slot, meaning the CLI could show and record at most one item's worth of labeling state no matter how many keys the navigator pressed. This is confirmed as the actual mechanism behind the checkpoint's reported 0/43 outcome (`labeling-session-citations.json` shows `entries: {}` -- consistent with the navigator hitting the "all items labeled" false-positive after at most one keypress and quitting without saving further).
- **Fix:** Added `itemId(it)` (`it.id !== undefined ? it.id : it.pair_id`), applied uniformly in `doSession` (itemById/ids construction), `doEmit` (missing/itemsToEmit filters, session lookups, both keyed and triple-kind output id fields), and the new `doImport`.
- **Files modified:** scripts/label-355-gold.cjs
- **Verification:** `node tests/test-355-label-cli.cjs` green, 72/72 (up from 54/54 pre-change). New Behavior 11b block proves three distinct pair_id-only items now record as three distinct session entries and emit with `id` set to the `pair_id` value. All pre-existing checks for the three `id`-keyed sets (sentences, both pairings) stayed green throughout, confirming no behavior change there.
- **Committed in:** `dffc7d983` (feat commit, same commit as the `import` subcommand since both were designed and tested together)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary for the citation set's labeling CLI (and the new `import` path) to function correctly at all -- without it, every citation item's session state and emitted gold row would carry the wrong id, and any future navigator resume attempt on this set would reproduce the same collapse. No scope creep: found and fixed while directly implementing this task's stated deliverable (an import path for the citation set specifically), not a speculative sweep of unrelated code.

## Issues Encountered

None beyond the `itemId()` bug above, which is documented as a Rule 1 auto-fix rather than an "issue" since it was found, fixed, tested, and committed within this task's own scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **355-26 (citation-check calibration, D-46) can now proceed against a complete 43-item gold**, but two limitations the external labeler itself surfaced must be read into that plan's results (both also logged to `deferred-items.md`):
  1. **`supports` is structurally unreachable in this item set.** All 43 items were templated from `feeds_into`/lateral/hub/three-hop/`CONTRASTS_WITH`-adjacent hop types (355-14 Task 2's strata); none samples an `ALIAS_OF` path, even though Theo's own canon carries `ALIAS_OF` edges (per this same plan's Task 2 live-capture census). A `feeds_into` hop is never sufficient grounds for a genuine `supports` verdict on a same-meaning claim, so every item in this gold reduces to a binary "does a contrasts-with hop appear" question. This is a sampling gap in the item set, not a labeling failure -- confirmed by the labeler's own perfect recovery of the intended `contradicting` stratum (see below). 355-26's stated-vs-withheld agreement must be reported against this two-class effective gold, and its own SUMMARY must say so plainly rather than treat the 3-class schema as if all three classes were actually exercised. A follow-up item set sampling `ALIAS_OF` paths specifically is the fix, flagged for a later 355 plan.
  2. **The eight `contradicts`-labeled items are exactly the eight synthetic `contradicting`-stratum items** (verified: the two id sets match exactly, `cp-036` through `cp-043`) -- Theo's canon carries zero naturally-occurring `CONTRASTS_WITH` edges among the sampled pairs, so 355-14 Task 2 constructed these eight synthetically per its own action text's fallback rule. Every `contradicts` verdict in this gold is therefore scored against a constructed contradiction, not one the canon produced unprompted. Worth noting alongside limitation (1) when 355-26 characterizes what its calibration actually measured.
- **Theo findings recorded at the checkpoint, reconfirmed here:** live capture `served: true`, 148 calls, latency p50 = 1578ms, p95 = 1758ms, max = 3385ms (recomputed directly from `tests/fixtures/355-theo-find-connections-responses.json`'s `latency_ms` array, matches exactly). Three-hop paths are rare in Theo's canon at this sampling breadth: only 4 of the 43 templated items land in the `three_hop` stratum. Zero naturally-occurring `CONTRASTS_WITH` edges were found among the sampled pairs (hence limitation 2 above). The hostname sanitization fix (commit `635956586`, prior session) holds -- `theo_host` in the committed capture file is a short container id, never a raw OS hostname.
- **The labeler's blind performance is a strong signal for calibration purposes**, independent of the two limitations above: it recovered the intended `contradicting` stratum with 100% precision and 100% recall (8/8 exact match, blind, opaque ids, shuffled order, rule withheld) -- suggesting the citation-check judge's real discriminative task (spotting a contrasts-with hop) is tractable even without the rule stated, at least at this item set's difficulty.
- **STATE.md and REQUIREMENTS.md were intentionally not touched** in this resumed session, per the 355-06..355-28 precedent recorded in this plan's `<shared_tree_rules>` (this working tree is shared with concurrent Claude sessions executing Phases 357/358/360/361; `state.*` writes are reserved to avoid collision). ROADMAP.md's 355-14 row and Plans counter (23/28 -> 24/28) were updated in this session, via a direct edit confirmed clean-diff against the last committed ROADMAP.md before editing (no peer hunks present to sweep).

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`scripts/label-355-gold.cjs`, `tests/test-355-label-cli.cjs`, `tests/fixtures/355-citation-pairs.json`, `labeling-session-citations.json`, `deferred-items.md`, `.planning/ROADMAP.md`, this SUMMARY). All six referenced commits (`dffc7d983`, `c568d6da7`, and the four prior-session Task 1/2 commits `c0d012496`, `85c29d57c`, `635956586`, `b12ad09a0`) confirmed in `git log --oneline --all`.
