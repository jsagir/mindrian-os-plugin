---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 19
subsystem: commands
tags: [commands, research-planner-mode, question-set, d-00, d-02, d-18, d-19, cirs, registry, whitespace]

requires:
  - phase: 363-15
    provides: research-planner CLI (plan, pending, exit contract)
  - phase: 363-18
    provides: /mos:research plan-run mode (accepts any run id with a saved plan.json)
provides:
  - research-planner door in /mos:map-unknowns, /mos:root-cause, /mos:think-hats, /mos:diffusion
  - /mos:whitespace research ZONE_ID subcommand (routing row, help line, Write pre-approval)
  - tests/test-363-command-contract.cjs (P1-P8)
affects: [363-20, 363-22]

tech-stack:
  added: []
  patterns:
    - "A first-wave command is a thin door: it writes local JSON, runs one CLI step, shows the card, hands over a run id; the runner does everything else"
    - "Appended sections keep the base body a byte prefix, so preservation is one startsWith check per command"

key-files:
  created:
    - tests/test-363-command-contract.cjs
  modified:
    - commands/map-unknowns.md
    - commands/root-cause.md
    - commands/think-hats.md
    - commands/diffusion.md
    - commands/whitespace.md
    - skills/map-unknowns/SKILL.md
    - skills/root-cause/SKILL.md
    - skills/think-hats/SKILL.md
    - skills/diffusion/SKILL.md
    - skills/whitespace/SKILL.md
    - data/command-registry.json
    - data/harness-manifest.json

key-decisions:
  - "The whitespace door takes the search term from the zone's zone_term when present, otherwise from the navigator typing it in their own words; nothing is derived from artifact names, section names or the hypothesis. The term is NOT persisted into whitespace-results.json by this plan (see Follow-on: zone_term)."
  - "Whitespace numbering differs from the other four: step 3 reads the zone and applies the two-section rule before step 4 writes the question set, because the term and cohort must exist before the leaves do."
  - "The help line for research ZONE_ID sits between external and discover so the last-item glyph on the discover line (a backslash) stays byte-identical; the routing row goes at the end of the table."
  - "Diffusion's own door leaves lens_selection empty (the lens is its template); the other four add it on a stated local judgment about a dual-use or deep-tech technology's adoption, diffusion or timing."

requirements-completed: [DRP363-13, DRP363-19, DRP363-20, DRP363-02]

duration: ~60min
completed: 2026-09-30
---

# Phase 363 Plan 19: Five PWS commands become research planners Summary

**/mos:map-unknowns, /mos:root-cause, /mos:think-hats, /mos:diffusion and /mos:whitespace each gained a research-planner door that writes a checked question set from the framework's own dimensions, runs `research-planner.cjs plan`, shows the card, and hands the run id to `/mos:research --plan`, with every existing flow byte-identical.**

## PLAN_BASE

`8f4295b2fc0a70fc6c533c3f13e1b4e5f2e6d13c` (HEAD before the first edit).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | 2b0608988 | tests/test-363-command-contract.cjs (P1 and P2 passing, P3-P7 failing on the pre-plan tree, as the acceptance asks) |
| 2 + 3 GREEN (one commit, as the plan asks) | 2af9fea0e | five commands, five skill mirrors, data/command-registry.json, data/harness-manifest.json |

Both are ancestors of HEAD. The GREEN commit deleted no files. No Phase 363.1 sibling path was touched.

## Tests and gates

- `node tests/test-363-command-contract.cjs`: PASS 8, FAIL 0 (P1-P8).
- `node tests/test-363-runner-contract.cjs`: PASS 9. Neighbours: test-363-cli 17/17, test-363-ambient 18/18, test-363-baseline 7/7, test-361-command-contract 20/20.
- Five generator `--check`s (skill mirrors 112, command registry, connector registry, orchestration projection, harness manifest): all OK, re-run immediately before the commit.
- `check-render-coverage`: 17 covered, 0 gap; md-keyspace 202 wired, 0 unwired. `check-layer-declaration`: 292 surfaces, 255 declared, 37 exempt. `check-cirs-declaration --check` on this plan: OK.
- `check-shape-declaration --check`: exit 0, advisory WARN count **53**, equal to the 53 baseline; no WARN names any of the five commands or their mirrors.
- `test-265-declaration-truth` (three arms clean), `test-148-engine-reaches` (12), `test-341-registry-drift` (PASS=7), `test-344-surface-layer-parity` (PASS=9), `check-floor-ledger --check` (0 unresolved).
- `bash tests/run-all-361.sh`: PASSED=26 FAILED=3. The three reds are pre-existing and unrelated: `209 declared-implies-wired` (same signature as 363-18: the two stale `brain-derive` entries), `FDA known-tool-shapes` (Arm E: brain_ask "lean startup methodology" returns allow, not ambiguous), and `part8-egress-guard self-test`. The FDA and egress-guard failures were reproduced in a scratch worktree at PLAN_BASE with the identical message, so they predate this plan.

## PRE_HASH and POST_HASH

data/command-registry.json sha256:

- PRE_HASH  `44c477db95622ee460d6b54154c86735d88fa9e3f67aa88231f71dfe5593d7eb` (after 363-18)
- POST_HASH `fda868e5a4e316421891428e1716033c76eebabe0f2a04c60e86799228de9064`

The pre-phase fixture value is `a3fbe501...154b`; the registry has now moved twice. Five rows changed, only `teaching` on each. The registryHash change rides the next real release's Step 5.6 theo-resync dispatch; this plan sends no notify.

## Regenerated files (and what moved)

- Skill mirrors: exactly the five (`overwritten 5`).
- `data/command-registry.json`: 5 lines, the five teaching values.
- `data/harness-manifest.json`: one line, the command-registry digest (now equal to POST_HASH). The direct write worked; no scratch route needed.
- `data/connector-registry.json`, `data/connector-coverage-ledger.json`, `data/brain-orchestration-projection.json`, `data/orchestration-command-ledger.json`: regenerated and unchanged (no connector or projection field of these five commands moved), so not staged.

Every hunk concerned the five commands or their mirrors, or was a derived digest. No peer drift.

## What each door does

Shared shape, 9 steps in the plan's order: when to offer (one line, never on its own, unattended callers skip), `pending` first, write `question-set.json` to a scratch dir outside the room (template_id, command, stated_question, SCQA framed as /mos:structure-argument frames it, key line, leaves with origin `user_stated` / `framework_dimension` / `mece_gap`, falsifiers, typed slots, `coverage_notes`, and the D-18 perspective block with the three forum passes for deep runs and physics / assumed limiters), the command's own dimension list, the diffusion lens on a stated local judgment, the `plan --mode quick|deep --section <slug>` step, the card and its incomplete / wish / needs_lens_leaves handling, the hand-off `Continue in /mos:research --plan <run_id>.`, and the Desktop and Cowork line naming the `research_run` tool with op `plan`.

Per command: map-unknowns (mu:known_known, mu:blind_spot, mu:hidden_known and mu:unknown_unknown as not researchable; an unknown-unknown leaf may only be `mece_gap`), root-cause (rc:why_link plus the six Fishbone dimensions under `multi_cause`), think-hats (hat:white, black, yellow, green; red not researchable; blue becomes the governing question), diffusion (four df dimensions, slot `technology`), whitespace (ws:gap_claim, ws:covered_elsewhere, ws:irrelevant not researchable, ws:extraction_failure as a room-only leaf, with the fewer-than-2-sections stop).

## zone_term status (KEY GAP): NOT closed in production, recorded as follow-on

Production `.mindrian/whitespace-results.json` still carries no `zone_term`, so 363-16 ambient runs still answer `context_insufficient` / `no_zone_term` on real rooms. The plan's scope was the command bodies, the registries and one contract test; it does not include a script, a schema change or an ambient.cjs change, and `whitespace-results.json` is regenerated by `scripts/compute-whitespace-gaps.py`, so a term written into it by a command would be lost on the next `map`. Per the carry-forward I did not expand scope.

What this plan does do: `/mos:whitespace research ZONE_ID` reads the zone from that file, uses `zone_term` if present (shown to the navigator to confirm), otherwise asks the navigator to type the term in their own words (2 to 80 characters, no quotes, parentheses or AND/OR/NOT), and never derives a term from artifact names, section names or the hypothesis (Canon Part 8, D-10). The term reaches the plan as a slot and the navigator approves it on the F.0 grant card, which is where a standing grant learns it.

### Follow-on: exact design proposal (for 363-20 or a 363.x quick task)

1. A sidecar, not the generated file: `.mindrian/whitespace-zone-terms.json`, `{schema: "mos.whitespace-zone-terms/1", terms: {"<zone_id>": {term, approved_at, approved_via, grant_id}}}`, written atomically by one new facade function `planner.recordZoneTerm(roomDir, zoneId, term, {approvedVia, grantId})` and one CLI subcommand `zone-term set <zone_id> --term-file <terms.json> --room <room> --approved-via cli`. The term goes through `families.validTerm` and the audit fence like any other slot.
2. Trigger: recorded only after the navigator approves the F.0 grant card that lists that term (`grant approve` for the same run). Approval is the ask; a term the navigator never saw is never stored.
3. `ambient.cjs` `zoneTermOf(gap)` reads `gap.zone_term` first, then the sidecar entry for `gap.zone_id`, then falls back to `no_zone_term`. The one guarded ambient-run.cjs call is untouched.
4. The sidecar is room-local, survives `map` recomputes, and is never sent anywhere; `whitespace-results.json` stays a pure generated file.
5. Tests: a leg in test-363-ambient (sidecar term promotes a `no_zone_term` zone to a plan-only card) and one in test-363-cli (record-then-read round trip, refusal of an unapproved or invalid term, no room text on argv).

## Deviations from Plan

### Auto-fixed Issues

**1. [Interpretation] P1 and the RED acceptance**
- The plan says whitespace's routing and help "gain exactly one line", and also that P1 passes in RED. Both hold if P1 allows zero or one added line and the exact-one assertion lives in P6. Done that way.

**2. [Rule 3 - Blocking] The tool wrote the test's dash constants as literal characters**
- The first write of the test turned `—` and `–` in `EM` and `EN` into literal characters (P8 caught it). Both are now `String.fromCharCode(0x2014)` and `String.fromCharCode(0x2013)`, fixed before the RED commit.

**3. [Design] Whitespace step order**
- Whitespace reads the zone (step 3) before writing the question set (step 4); the plan's shared shape puts the dimension list at step 4. The other four follow the plan's order exactly.

**4. [Design] Help line placement**
- The new help line goes before `\- discover` so the last-item glyph line stays byte-identical.

**5. Unlisted generated files not staged**
- data/connector-registry.json, data/connector-coverage-ledger.json, data/brain-orchestration-projection.json and data/orchestration-command-ledger.json did not change, so they are not in the commit.

No auth gates.

## Carried forward

- **Registry hash:** PRE_HASH and POST_HASH above; POST rides the next release's Step 5.6 theo-resync. No notify from this phase.
- **Irreversibility ledger STALE (recorded, not rebuilt):** `node scripts/build-command-irreversibility-ledger.cjs --check` prints `WARN: STALE` for `/mos:auto-explore`, `/mos:diffusion`, `/mos:dominant-designs`, `/mos:map-unknowns`, `/mos:research`, `/mos:root-cause`, `/mos:think-hats`, `/mos:whitespace` and `/mos:room` (WARN 9, exit 0). The five commands of this plan are new (their bodies changed); `/mos:auto-explore` is not touched by this plan.
- **Aggregator:** `tests/run-all-363.sh` has skipped legs for the 363-19 and 363-20 test files; this plan does not edit it. Phase close should wire `tests/test-363-command-contract.cjs`.
- **Blockers for 363-20:** none. 363-20 owns the disclosed family defaults and, if wanted, the zone_term sidecar above. The doors only need a saved plan.json run id, which `/mos:research` already accepts.
- **Not written by this executor (orchestrator to do):** STATE.md, ROADMAP.md plan progress and REQUIREMENTS.md ticks (DRP363-13, DRP363-19, DRP363-20, DRP363-02), per the shared-tree rules.

## Known Stubs

None. Every command step names a live CLI subcommand from 363-15.

## Threat Flags

None new. P5 bars web tools and search names from every new section (T-363-01, T-363-50); P1 and P2 pin byte preservation against git objects at base_sha (T-363-49); P3 pins no Task, Agent, web_scope, plan_gated or hitl change; regeneration was checked hunk by hunk (T-363-12); the diffusion lens is a stated local judgment, never a question sent anywhere (T-363-26).

## Self-Check: PASSED

Found: tests/test-363-command-contract.cjs and all five commands, skill mirrors and both data files. Commits 2b0608988 and 2af9fea0e are ancestors of HEAD. `grep -P '[\x{2013}\x{2014}]'` over every written file: no hits.
