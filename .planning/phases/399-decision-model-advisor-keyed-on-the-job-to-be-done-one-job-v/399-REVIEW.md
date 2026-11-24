---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
reviewed: 2026-11-24T00:00:00Z
depth: deep
files_reviewed: 18
files_reviewed_list:
  - lib/core/decision-advisor/adapter.cjs
  - lib/core/decision-advisor/labels-only.cjs
  - lib/core/decision-advisor/present.cjs
  - lib/core/decision-advisor/shortlist.cjs
  - lib/core/decision-advisor/providers/gemini.cjs
  - lib/core/decision-advisor/providers/jev.cjs
  - scripts/decision-advisor-transport.cjs
  - lib/core/feyminto/next-move.cjs
  - lib/workflow/command-resolver.cjs
  - lib/mcp/tools/gate.cjs
  - lib/mcp/tools/sensors.cjs
  - lib/workflow/offer-closer.cjs
  - lib/core/memory-ops.cjs
  - lib/core/navigation.cjs
  - lib/core/navigation/selection-log.cjs
  - lib/core/navigation/calibration-log.cjs
  - scripts/act-command.cjs
  - evals/selection/score.cjs
findings:
  critical: 0
  warning: 8
  info: 6
  total: 14
status: issues_found
fix_status: 8 warnings fixed, IN-01 and IN-04 fixed, IN-02 IN-03 IN-05 IN-06 skipped with reason
---

# Phase 399: Code Review Report

**Reviewed:** 2026-11-24
**Depth:** deep (cross-file call chains traced; `bash tests/run-all-399.sh` run: all 15 test files and 5 drift checks PASS)
**Files Reviewed:** 18 source files, plus the phase tests read for what they pin
**Status:** issues_found

## Summary

Priority 1 (room content to the provider payload or transport) is CLEAN. I found no path by which free text, artifact text or user words reach a provider body. Evidence:

- `validateNeutralRequest` (labels-only.cjs:150-190) checks every key against a closed list and every string leaf against a Map or Set of shipped labels (job ids, vocabulary summaries, command names, registry teaching text, template ids). Unknown input is refused, not stripped. `Map.has` and `Set.has` make `__proto__` and `constructor` keys safe.
- Every send path validates first: `askDecisionModel` (adapter.cjs:104), `buildChunks` (transport:88-112), and a second `guard` call right before each POST (transport:155-163).
- `provider.buildBody` only reads `rendered`, which is built from the catalog. The jev builder whitelists `model`; the gemini builder ignores it.
- The key is read only from `opts.env` / `process.env` (transport:144-147). It is never printed, never in an error, and goes in a header only. Failures return fixed reason strings (`http_error: status N`).
- No file under `lib/` names the transport (fence FN2).

No critical issues. The warnings below are about data quality of the new selection log, one network-hardening gap, a ranking inconsistency, and hook-path work done when the advisor is off.

Verified by running (PROVEN): with `MINDRIAN_DECISION_ADVISOR` unset, `composeWorkflow([fw], {jobId})` equals `composeWorkflow([fw])` for every multi-command framework in the registry. Ties abstain (`top_tie > 1` gives 0 changed steps on `compare-options`, `connect-domains`, `decide-pursue`, `explore`, `validate-idea`). With the advisor on, `audit-room` and `find-problem` change steps and the rest do not.

UNVERIFIED: I did not diff `composeNextMove` output byte for byte against the base commit. I relied on code reading and test O4.

## Warnings

### WR-01: closeOffer logs a decision even when the decision write failed

**Fix status:** fixed, b37b0f473 (closeOffer logs only when the result is not ok: false; test K4b)

**File:** `lib/workflow/offer-closer.cjs:293-296` (call), `:304-333` (`_logSelection`)
**Issue:** `closeOffer` runs `_closeOfferRoute(args)`, then calls `_logSelection(args)` without looking at `result`. The header comment claims "post-commit", but only the gate path is post-commit. Scenario: `decisions.recordSelectorDecision` returns `{ ok: false, reason: 'decision_record_failed' }`, or `decisions_unavailable`. The navigator's reject never persisted, yet `_logSelection` writes a `reject` row with `ground_truth_label = 0` for the first shown option. It also writes a labelled `calibration_observations` row. The ground-truth labels are the whole point of I-09, so failed decisions poison them.
**Fix:**
```js
function closeOffer(args) {
  const result = _closeOfferRoute(args);
  if (result && result.ok !== false) _logSelection(args);
  return result;
}
```

### WR-02: CLI selection log has no replay dedupe

**Fix status:** fixed, 21ac27a5b (dedupe_key hashed into gate_id; with no key, an identical decision inside 5 seconds is a replay; closeOffer forwards an optional dedupe_key; test K4c). Fixed by the review minimum plus the explicit key; consumers that have a stable offer id should pass dedupe_key.

**File:** `lib/core/navigation/selection-log.cjs:147-152`, `lib/workflow/offer-closer.cjs:325-331`
**Issue:** Dedupe exists only when `gate_id` is present, which only the MCP path passes. `_logSelection` passes no key, so a second `closeOffer` call for the same offer (a consumer retry, a re-rendered F.1 envelope answered twice) writes a full second set of rows and a second set of labelled calibration rows. Each replay double-counts one navigator decision in the calibration data.
**Fix:** Have the consumer pass a stable offer id (or hash offer command + `roomState` turn id) as `args.dedupe_key`, and hash it like `gateKey` into the same `gate_id` column with `surface = 'cli'`. The partial unique index then also covers CLI. Minimum fix: skip the write when an identical (surface, decision, shown_command) row exists within the same turn.

### WR-03: Provider POST follows redirects and would forward the key header

**Fix status:** fixed, bb9c9597f (redirect: error in the decision transport and in scripts/jev-devtime-client.cjs; test T9 uses a real 307 to a second loopback host)

**File:** `scripts/decision-advisor-transport.cjs:67-72` (Gemini, keyless Jev), `scripts/jev-devtime-client.cjs:375-380` (Jev with key)
**Issue:** Both `fetch` calls use the default `redirect: 'follow'`. A 307 or 308 from the configured `--base` host (a misconfigured proxy, a compromised or typo-squatted host) makes undici re-send the body to the new host. undici strips `authorization` on a cross-origin redirect but does NOT strip a custom header, so `x-goog-api-key` goes to the redirect target. The Jev `Authorization` header is stripped, but the body still follows. The body is labels only, but the key is a secret. The repo already uses `redirect: 'manual'` in `scripts/radar-changelog-slice.cjs:249`.
**Fix:** Add `redirect: 'error'` (or `'manual'` and treat 3xx as `http_error`) to both fetch option objects. Add a transport-capture test with a stub that answers 307.

### WR-04: composeWorkflow ranks differently from the next-move selector (last command, band)

**Fix status:** fixed, fd8746812 (lastCommand skipped in any spelling, strong band only; tests W2 updated, W2b and W2c added)

**File:** `lib/workflow/command-resolver.cjs:218-232` (`_rankCommands`), against `lib/core/feyminto/next-move.cjs:273-292`
**Issue:** Two inconsistencies inside what the header calls "one selector":
1. `next-move` excludes the last command and done commands from the shortlist and only acts on `strong` picks. `_rankCommands` uses `scoreFor`, which does not exclude `lastCommand`, and promotes every non-weak (`possible` and `strong`) command. With row `[A:1.0, B:0.929]` and `lastCommand = A`, the abstain check (`top_tie` excludes A) passes, A ranks first, and a chain step re-runs the command that just ran.
2. A `possible` command (0.5 to 0.7) reorders registry order here but never in `next-move`.
**Fix:** In `_rankCommands`, skip `ctx.query.lastCommand` (put it in `rest`), and promote only `bandFor(value) === 'strong'`, matching next-move.

### WR-05: Advisor inputs are computed on every call even when the advisor is off (hook and suggest_next path)

**Fix status:** fixed, 8f2275629 (advisorOptsForRoom in command-resolver.cjs, used by sensors.cjs and act-command.cjs; advisorEnabled guard before readRoomAxes in nextMoveForSection; tests W6 updated, W6b added). The helper lives in command-resolver, not jtbd-state or shortlist, because the O1 fence limits who may require shortlist.cjs.

**File:** `lib/core/feyminto/next-move.cjs:684-687`, `lib/mcp/tools/sensors.cjs:546-555`, `scripts/act-command.cjs:486-494`
**Issue:** With `MINDRIAN_DECISION_ADVISOR` unset (the default, advisor off), `nextMoveForSection` still does `readRoomAxes(roomDir)` (reads and parses STATE.md, and when the file exists loads `ambient-framing.cjs` and `direction-convention.cjs`). `sensors.cjs` and `act-command.cjs` also run `resolveSelectionJob` and `readRoomAxes` before `composeWorkflow`, where `_advisorContext` immediately returns null. All of that is work with no output change, on the path with a 200 ms budget. The same 8-line `advisorOpts` block is copy-pasted in `sensors.cjs` and `act-command.cjs`.
**Fix:** One helper, for example `advisorOptsForRoom(roomDir)` in `lib/hmi/jtbd-state.cjs` or `lib/core/decision-advisor/shortlist.cjs`, that returns `null` first when `!advisorEnabled()`. Call it from all three sites. In `nextMoveForSection`, guard with `require('../decision-advisor/shortlist.cjs').advisorEnabled()` before `readRoomAxes`.

### WR-06: The log writes to every room.db with the advisor off, and runs DDL on every call

**Fix status:** fixed, 00b100221 (schema setup cached per db handle with a WeakSet; owner ruling recorded in selection-log.cjs: the log stays on with the advisor off, MINDRIAN_SELECTION_LOG=off is the opt-out; release notes must name the room-state change; test G9)

**File:** `lib/core/navigation/selection-log.cjs:145-146`, `lib/core/memory-ops.cjs:154-179, 198-226`
**Issue:** The advisor is opt-in, yet `MINDRIAN_SELECTION_LOG` is default on. Every gate answer and every offer decision in every user's room now creates `selection_observations`, ALTERs `calibration_observations`, and inserts rows with null probabilities. Each call re-runs two create-table-if-absent statements, three create-index-if-absent statements, and `PRAGMA table_info`. These take the writer lock. In `gate_answer` this is a second handle open, DDL and savepoint on the MCP event loop after the answer already committed. With the advisor off the rows carry no signal beyond the decision itself.
**Fix:** Cache schema initialisation per db handle (`WeakSet`) or per process and room path. Decide and document whether the log should require the advisor to be on, or be opt-out in the release notes (a persistent room-state change for all users).

### WR-07: initCalibrationSchema can now throw where it never did before

**Fix status:** fixed, 8964efd56 (re-read table info after an ALTER failure, throw only when the column is still missing; test G1b)

**File:** `lib/core/memory-ops.cjs:175-178`
**Issue:** The additive migration is `PRAGMA table_info` then `ALTER TABLE`. Two processes (hook plus MCP server, or two Cowork sessions) can both see the column missing; the second `ALTER` throws `duplicate column name`. On a read-only or locked old room.db, `ALTER` also throws, whereas the old create-table-if-absent statement was a no-op on an existing table. Today the only caller is `recordSelectionOutcome`, whose outer try/catch swallows it, so that one decision is silently lost. The exported function now has a throwing contract it did not have.
**Fix:**
```js
if (!cols.some((c) => c.name === 'ground_truth_label')) {
  try { db.exec('ALTER TABLE calibration_observations ADD COLUMN ground_truth_label INTEGER'); }
  catch (e) {
    const again = db.prepare('PRAGMA table_info(calibration_observations)').all();
    if (!again.some((c) => c.name === 'ground_truth_label')) throw e;
  }
}
```

### WR-08: Fabricated ground-truth labels when an accepted option cannot be resolved

**Fix status:** fixed, 8ed4fcedc (shown[0] stands in only when exactly one option was shown, else chosen null and no row labelled; test G10). Not changed: advisor_top still ignores done commands in the nest on the MCP path; documented as a known gap in selection-log.cjs. The CLI closer still passes chosen_command = shown[0] explicitly on accept (test K3 pins it); that is the closer stating the accepted offer, not the writer guessing.

**File:** `lib/core/navigation/selection-log.cjs:159`, `lib/mcp/tools/gate.cjs:1840-1851`
**Issue:** For `accept` with `chosen === null`, `chosenForLabel` falls back to `shown[0]`, so the first option gets label 1 and the rest label 0. In gate.cjs, `chosenOpt` is undefined when `validChosen` matches no option (for example an approve on a multi-option card where `chosen` is absent or maps to nothing). Then `chosen_command` is null and the log still asserts the first option was taken. That is invented data in a labelled column. `advisor_top` is also taken from a shortlist that does not exclude commands already done in the nest, so `overrule_by` can report a host overrule against a command that was not eligible.
**Fix:** Fall back to `shown[0]` only when `shown.length === 1`. When more than one option is shown and `chosen` is null, write `ground_truth_label = NULL` for all rows. Pass `exclude` of done commands into the `lookupShortlist` call, or document the gap.

## Info

### IN-01: Stale kill-switch comments contradict the opt-in rule

**Fix status:** fixed, a0a232d9a (comment-only)

**File:** `lib/core/decision-advisor/shortlist.cjs:19`, `lib/core/feyminto/next-move.cjs:38, 271`
**Issue:** These comments say `MINDRIAN_DECISION_ADVISOR=off` turns the advisor off and that "the kill switch wins over the test seam". Since the 2026-11-24 ruling only `=on` enables it; any other value is off. The next-move comment misleads a reader about which env value matters.
**Fix:** Reword to "unless MINDRIAN_DECISION_ADVISOR=on, nothing here runs".

### IN-02: selectorMark changes for every room even with the advisor off

**Fix status:** skipped: left as documented (brief basis change is accepted; note it in the release notes)

**File:** `lib/core/feyminto/next-move.cjs:127-141`
**Issue:** `SELECTOR_ORDER` moved to `399-07` and the mark now always ends with `, advisor table off|none|<version>`. Every existing BRIEF is judged stale and rewritten once, on rooms that never turn the advisor on. The selector result is unchanged (so "unset equals base" holds for the move), but the brief basis does not.
**Fix:** Either accept and note it in the release notes, or append the advisor segment only when `advisorEnabled()`, and leave `SELECTOR_ORDER` alone until the order can change.

### IN-03: validateProviderBody cannot catch a bad provider builder

**Fix status:** skipped: left as documented (a structural body allow-list is more than a one-line change)

**File:** `lib/core/decision-advisor/labels-only.cjs:199-215`
**Issue:** The expected body is `provider.buildBody(renderRequest(req))`, from the same provider and the same render that produced the body. The check only detects mutation between build and send. A provider whose `buildBody` adds a field passes. Safety rests on the builders being pure and on the validated render. The tests pin the real two providers, but the validator is described as a defence in depth it does not provide.
**Fix:** Add a structural allow-list check on the body (top keys `model`, the provider's `REQUEST_FIELD`, `questions`; per-question keys `type`, `instructions`, `criteria`) independent of the builder. Or reword the comment.

### IN-04: Small defects in the transport script

**Fix status:** fixed, ce38e4e6c (--base with query, fragment or userinfo is refused; URL built from origin, path prefix and PATH; dead PATH null branch and unused catch binding removed; test T9b). PATH_CONFIRMED left in gemini.cjs because tests/test-399-adapter.cjs pins it.

**File:** `scripts/decision-advisor-transport.cjs:45-58, 100, 131`
**Issue:** (a) `parseBase` keeps the query and fragment in `href`, so `--base https://h/?x=1` becomes `https://h/?x=1/v1beta/decisions`. (b) `catch (e)` at line 100 has an unused binding. (c) The `provider.PATH === null` branch (line 131) is dead because both providers now set `PATH`; `PATH_CONFIRMED` in gemini.cjs is unused. (d) Userinfo in `--base` (`https://user:pass@host`) is kept in `href`.
**Fix:** Build the URL with `new URL(provider.PATH, origin)` after rejecting `search`, `hash`, `username`, `password`. Drop the dead branch and the unused binding.

### IN-05: evals/selection/score.cjs re-implements the advisor pool rule

**Fix status:** skipped: left as documented (shared helper is a larger refactor)

**File:** `evals/selection/score.cjs:128-147`
**Issue:** A second copy of the "strong pick that serves the job, not a top tie" rule, reading and parsing the registry on every call. It will drift from `next-move.cjs:285-290`.
**Fix:** Export one `advisorPoolNames(jobId, level)` from `lib/core/feyminto/next-move.cjs` or `present.cjs` and call it from both.

### IN-06: Decision-only rows with no shown command

**Fix status:** skipped: tests K3 and G7 pin the decision-only row on purpose ("so an accept is still recorded")

**File:** `lib/workflow/offer-closer.cjs:312-320`, `lib/core/navigation/selection-log.cjs:186`
**Issue:** When the offer has no `/mos:` command, `shown` is empty and `recordSelectionOutcome` still writes one decision-only row with every feature null except the decision. These rows add nothing the decision edge does not already hold.
**Fix:** Skip the write in `_logSelection` when `shown.length === 0`.

---

_Reviewed: 2026-11-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
