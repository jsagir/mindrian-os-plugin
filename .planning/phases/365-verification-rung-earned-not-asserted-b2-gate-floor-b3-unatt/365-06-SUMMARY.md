---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 06
subsystem: gate-render
tags: [b2, gate-card, tri-polar, renderer]
requires: [365-01, 365-02, 365-03]
provides:
  - normalizeCard field `notice` (one plain string, at most 400 chars, whitespace collapsed, or null; always present)
  - normalizeCard input `approve_label` / `approveLabel` (snake_case wins): relabels ONLY the option whose id is `approve`, capped at 80 chars, id and description unchanged; not echoed on the normalized card
  - rung a (elicitation) appends the notice to the message after a blank line
  - rung b (AskUserQuestion) puts the notice in zones.signals and contract.notice; superset_options carry the relabelled label
  - rung c (text) prints the notice before the options in zones.body and puts it in zones.signals and contract.notice
affects: [365-08]
requirements: [V365-04, V365-07]
key-files:
  created:
    - tests/test-365-floor-notice.cjs
  modified:
    - lib/mcp/gate-render.cjs
decisions:
  - "The relabel is applied to the normalized options after de-duplication, so validateChosenAgainstCard resolves the new label and the id, and no longer the old label"
  - "notice is its own field; header is never modified (gate_answer derives the decision node text from header)"
  - "Rung a has no signals zone, so the notice rides at the end of the message; rung c prints it in the body (a consumer that reads only the body still shows it) and ALSO in signals/contract per the plan"
metrics:
  tasks: 2
  files: 2
  commits: 2
---

# Phase 365 Plan 06: The Gate Card Carries a Why-Line Summary

The one card normalizer and its three renderer rungs now carry and print a why-line (`notice`) and an approve relabel as pure data, with gate-render.cjs still opening no database and knowing nothing about floors.

PLAN_BASE: `1184484835db861f578d3dbe9d4330db362cef46`

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `1faceed72` | normalizeCard reads `notice` and `approve_label`; tests C1..C6 |
| 2 | `f19e982d6` | three rungs print the notice; tests D1..D5 |

Both verified ancestors of HEAD.

## How D4 pinned the pre-change output

Before touching a renderer, a snapshot script (two cards, plain 3-option and rich multi-select with descriptions, rank, preview, subject and evidence ids, across rungs a/b/c, with stub elicitInput, simulateAskUserQuestion and simulateTextReply) was run against the unmodified module at PLAN_BASE. Each result `{ renderer, rendered, answer, elicitation params }` was serialised and pinned as a sha256 digest in the test (`PINNED`, 6 digests). After the renderer edit the same digests reproduce, so a card with no notice is byte-identical on every rung. A pinned digest was chosen over `git show PLAN_BASE:...` so the test does not depend on that sha surviving a rebase or squash. The card object itself is excluded from the digest (it gains the intended `notice: null` field).

## Verification (at HEAD f19e982d6 plus this SUMMARY commit's parent)

- `node tests/test-365-floor-notice.cjs`: C1..C6, D1..D5 all pass
- `tests/test-198-gate-renderers.test.cjs`, `tests/test-265-gate-render-elicit-schema.cjs`, `tests/test-238-one-ledger.cjs`: pass
- `node scripts/check-render-coverage.cjs`: 17 covered, 0 gap; md-keyspace 200 wired, 0 unwired
- `bash tests/run-all-365.sh` at f19e982d6: exit 0, PASSED=48 FAILED=0 SKIPPED=1 KNOWN=8 (was 47 passed at 4a0f89830; +1 is the new test file). The floor reds (RED-365-FLOOR / FLOOR-NOTICE) remain KNOWN; 365-08 owns them.
- Dash grep on both files: clean.

## Deviations from Plan

None to the work. One observation, out of scope:

- `tests/test-238-chosen-validation.cjs` fails (`expected memory_event count to increase by exactly 1 (before=0, after=2)`). It fails identically against the PLAN_BASE `gate-render.cjs` (verified by temporarily swapping in the base file, then restoring my version), and it is already recorded as a known failure in `tests/fixtures/365-regression-base.json` and in 365-01-SUMMARY.md. The plan named it as a neighbor to keep green; it could not be, because it was never green. Not caused by this plan; not fixed here.

## Hand-offs

- 365-08: a card builder passes `notice` (from `composeFloorNotice(...).notice`) and `approve_label` (from `.approve_label`) on the raw card given to `renderGate`/`normalizeCard`, in the gate.cjs gate_render handler and the tool-router.cjs meeting card. Keys: `notice`, `approve_label` (or camelCase `approveLabel`). Option ids must stay approve/reject/defer; the relabel only works on an option whose id is exactly `approve`.
- The relabelled card validates `chosen` by id or by the NEW label only; callers that echo the old "Approve" label back will be rejected.
- Rung b: the native AskUserQuestion thin adapter should read `contract.notice` / `zones.signals`; the F.8 body and contract.options labels already reflect the relabel.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file or schema surface; the notice is local card text (T-365-06 accepted), ids unchanged (T-365-18), header untouched (T-365-19).

## Self-Check: PASSED

- lib/mcp/gate-render.cjs and tests/test-365-floor-notice.cjs exist; commits 1faceed72 and f19e982d6 are ancestors of HEAD.
