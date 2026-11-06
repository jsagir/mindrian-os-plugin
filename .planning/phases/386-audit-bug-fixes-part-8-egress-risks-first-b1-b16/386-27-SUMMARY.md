---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "27"
subsystem: part8-egress
tags: [part8, ambiguous, sprouts-required, split-route, hook, brain-client]
requires: [386-26, 386-25, 386-30, 386-28, 386-37, 386-42]
provides:
  - the typed outcome sprouts_required on the hook, callTool, query(), ask() and search()
  - helper carriesEdgeOrBody in lib/core/part8-split-route.cjs
affects: [386-32, 386-33, 386-34]
key-files:
  created:
    - tests/test-386-sprouts-required-outcome.cjs
  modified:
    - lib/core/brain-client.cjs
    - lib/core/part8-split-route.cjs
    - scripts/part8-egress-guard-hook.cjs
    - .planning/debug/part8-ambiguous-verdict-is-sent-on-own-shim.md
decisions:
  - "An ambiguous call is refused with sprouts_required only when a string of the payload is an edge or body by classifyShape; the cypher key of brain_query is never read."
  - "If the shape test cannot run, the safe class applies: refuse with the typed outcome, send nothing."
  - "Brain-less hook mode keeps its allow (no wire)."
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 27: sprouts_required outcome on the hook, callTool and query Summary

Option-e of the owner decision in plan 386-26 is live in the three surfaces. A raw body, an edge refused by the guard (class sprouts_required) and an ambiguous call that carries an edge or body string now return one typed outcome: error egress_blocked, class and outcome sprouts_required, route sprout_call and the 5 step split guide. The call makes 0 network calls and the result holds no payload byte.

## What changed

- `lib/core/brain-client.cjs`: `callTool` returns the sentinel for the class (both the free-form and the other block branch) and for an ambiguous verdict whose payload carries an edge or body string. `_egressBlockedSentinel` maps the class too, so `query()`, `ask()` and `search()` return the same sentinel unchanged (no disclosure decoration). The long comment above the belt records that the Phase 254 Option A disposition was changed for the own shim by plan 386-26.
- `scripts/part8-egress-guard-hook.cjs`: a block verdict with the class sprouts_required exits 2 with the constant message of `refusalMessage()` on every scope. An ambiguous call on a shim-backed scope with Brain available that carries an edge or body string exits 2 with the same message. A sprout-only payload keeps the allow, Brain-less mode keeps the allow, the direct connector keeps its block.
- `lib/core/part8-split-route.cjs`: new export `carriesEdgeOrBody(toolName, args)`. It walks every string at any depth (bounded), applies `classifyShape`, skips the `cypher` key of `brain_query` (also with the `mcp__..__brain_query` name), and answers true when the shape test fails (safe class).
- `tests/test-386-sprouts-required-outcome.cjs`: arms SP1 to SP8. RED at 10536cca0 (SP1 to SP5 failed, SP6 to SP8 passed). GREEN at 5992a1f65 (all 8 pass).

## Verification (PROVEN)

- Corpus gate `node tests/test-3692-guard-survey-gate.cjs`, before and after, no stamp: PASS, MEASURED_SHA256 685f11b8...5dd unchanged, fetch calls 0.
- `bash tests/run-all-196.sh` 7/7. `bash tests/run-all-245.sh` 19/19. `bash tests/run-all-386.sh` 30/30.
- The 4 egress suites named in the plan (test-254-ambiguous-disclosure, test-260917-dgf-part8-hook-disposition, test-245-egress-contentless, test-260906-fda-known-tool-shapes) pass.
- Whitespace baseline (test-auto-explore-fire, test_interpret_whitespace, test-366-recall-whitespace, test-355-producer-whitespace-hsi), chains (test-254-one-chain-source, test-254-projection-chain-source, test-264-sensor-to-chain-resolve) and framework-name tests (test-355-framework-names, test-254-normalize-roundtrip-probe, test-247-contract-client): all exit 0.
- `bash tests/run-all-252.sh`: only the known reds census.1 and census.5b. The failure list did not grow.
- `bash tests/run-all-3692.sh`: 5 fails, none from this plan (see below).

## Deviations from Plan

**1. [Rule 3 - shared helper] Helper added to part8-split-route.cjs**
- The plan lists brain-client and the hook, not the split-route module. The hook and the shim need the same shape walk; two copies would drift. One export was added to the module of plan 386-42. No existing export changed.

**2. [No flip needed] Old assertions not flipped**
- The plan asks to flip assertions where an ambiguous edge or body proceeds. The four old suites hold only sprout fixtures, so no assertion needed a flip and none was deleted. Plan 386-34 strengthens them.

**3. [Rule 2 - fail closed] Shape test failure**
- If the split-route module or the shape helper cannot load, the call is refused with the typed outcome (never sent). This follows the fail-closed stance of plan 386-30.

## Residual reds (not caused by this plan)

- run-all-3692: L6 of test-3692-lexicon-generic-entries (stale X4 class, plan 386-33 updates it); `lib/memory/test-rs-fetcher-academic.cjs` A1 (a Springer api_key in a research URL, web line, plan 386-31 area); `tests/test-mux-card-before-answer.cjs` S3 (mintGate call site, a peer Eureka change); "no new dependency" (flexsearch removed from dependencies by a peer); "246 census guard" failed once during the long run and passed 112 assertions on a rerun (load timeout of 10 s on the hook child, flaky under a parallel suite). None of these files reference brain-client, the hook or the split-route module.

## Known Stubs

None.

## Threat Flags

None. The change reduces egress: no new endpoint, no new file access.

## Self-Check: PASSED

Files exist: tests/test-386-sprouts-required-outcome.cjs, the three product files. Commits 10536cca0 (RED), 5992a1f65 (GREEN) and f5132cb03 (RCA resolution) are on main. RCA holds `disposition: sprouts_required`.
