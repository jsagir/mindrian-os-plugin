---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 03
subsystem: cli-surface
tags: [b1, cli, mos-room, checking-record, rome, tdd, cirs]

# Dependency graph
requires:
  - phase: 358-01
    provides: recordClaimVerification, readClaimVerification, listClaimsForChecking, readVerificationPortrait, VERIFICATION_RUNGS/AGAINST_KINDS/METHODS/RESULTS, render helpers (verification.cjs core library, additively re-exported by navigation.cjs)
  - phase: 358-02
    provides: writeClaimNode carry-forward fix (checking record survives re-file), Claude Desktop tier0 host recognition
provides:
  - "scripts/claim-checks.cjs -- argv switch-case CLI (rungs | options | portrait | list | show | record | help), one thin caller of lib/core/navigation.cjs"
  - "/mos:room checks, /mos:room claim <id or words>, /mos:room check <id or words> -- three new body subcommands on the existing born-wired /mos:room surface"
  - "regenerated skills/room/SKILL.md mirror"
  - "tests/test-358-b1-cli.cjs -- 28 CLI/room.md legs"
affects: [358-04, 358-05, 358-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI enum mirroring: every option list (rungs, against_kinds, methods, results) printed by the CLI is read from navigation.cjs at call time (VERIFICATION_RUNGS/AGAINST_KINDS/METHODS/RESULTS), never a hardcoded literal, so the paper author's final rung list swap (358-01's TODO(358) marker) never touches this file"
    - "Claim reference resolution by words: a ref starting with 'claim:' is treated as an id; otherwise it is a text-search query through listClaimsForChecking, refusing ambiguous_claim (candidates rendered) or claim_not_found -- the same resolution rule is used by 'show' and 'record --claim'"
    - "Frontmatter argument-hint-only diff: commands/room.md's connector block, hitl_shape and body_shape declarations are untouched; only the argument-hint line changed, verified by diffing frontmatter against the phase's PLAN_BASE commit with the argument-hint line excluded"

key-files:
  created:
    - tests/test-358-b1-cli.cjs
    - scripts/claim-checks.cjs
  modified:
    - commands/room.md
    - skills/room/SKILL.md

key-decisions:
  - "options.rungs mirrors navigation.VERIFICATION_RUNGS literally ({id, label} entries, no embedded rung number); the rung number is the array index + 1, which commands/room.md computes itself when building the 'Rung N - <label>' AskUserQuestion option labels -- this keeps 'options' JSON a direct, literal mirror of the navigation constant rather than a CLI-invented shape"
  - "--json and --resolves-dispute are parsed as boolean flags (no following value consumed). The plan's flag-parsing sentence listed --json among the value-taking flags, but every one of the plan's own usage examples (`rungs --json`, `portrait --room R --json`, `show --json`) uses --json as a bare flag with nothing after it; treating it as boolean is the only reading consistent with the plan's own examples and was implemented as such (Claude's Discretion, CONTEXT.md: 'Rendering format ... as long as the four states plus no record are always visible' -- this is a parsing-shape detail, not a rendered behavior)"
  - "The Voice Rules and 'checks' rules bullets were reworded to avoid the literal substring 'verified' entirely (e.g. 'Never present checked as if it were confirmed' instead of the plan's literal draft text 'never call a checked claim verified or confirmed'), because the Task 3 acceptance criterion requires `grep -ci verified commands/room.md` not to exceed the PLAN_BASE count of 0, and because the codebase's own established convention (358-01 SUMMARY: 'the word verified never appears' in every render helper) treats that word as a banned literal wherever the checking record is documented, not only where it is rendered to a user"

patterns-established:
  - "A CLI script wraps a navigation core library one-to-one: every subcommand is a direct call to an existing navigation.cjs function plus a render call, with zero business logic duplicated in the CLI layer (rung/status derivation, sticky-disputed rules, and render strings all stay in verification.cjs)"

requirements-completed: [B1-02, B1-04, B1-05, B1-07]

# Metrics
duration: ~55min
completed: 2026-09-23
---

# Phase 358 Plan 03: B1 CLI Surface (scripts/claim-checks.cjs + /mos:room checks|claim|check) Summary

**A thin argv-routed CLI (`scripts/claim-checks.cjs`) and three new `/mos:room` body subcommands (`checks`, `claim`, `check`) give the Claude Code CLI the normal-flow B1 checking-record surface, built TDD (RED then GREEN), every enum sourced live from `navigation.cjs`, all CIRS/born-wired gates green.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-23 (after reading PLAN/CONTEXT/RESEARCH/358-01-SUMMARY/358-02-SUMMARY)
- **Completed:** 2026-09-23
- **Tasks:** 3/3 completed
- **Files modified:** 4 (2 created new, 2 pre-existing extended: commands/room.md + its regenerated skill mirror)

## Accomplishments

- Built `tests/test-358-b1-cli.cjs` (28 legs): rungs/options enum mirrors, empty-room portrait (all 4 states, never a score), record + sticky-disputed + resolves-dispute flow end to end, words-based claim resolution (unique / ambiguous / not-found), invalid-enum refusals with allowed-value hints, `show` verified in a brand-new process, `list`/`--query`, `portrait --json` deep-equal parity against an in-process `readVerificationPortrait` call, no-room refusal, substrate hygiene (no raw sqlite, no Brain, no hardcoded enum or rung-label literal), and the `commands/room.md` wiring legs (subcommand headers, script-name count, AskUserQuestion mention, "before the [section] fallback" phrase, argument-hint line).
- Built `scripts/claim-checks.cjs`: a switch-case CLI over `rungs | options | portrait | list | show | record | help`, one thin caller of `lib/core/navigation.cjs` -- the exact functions the `claim_verify` / `claim_read` MCP tools call (Canon Part 9, one write door). Zero direct sqlite substrate access, zero Brain reach, zero network. Every allowed-value list and refusal hint is generated from `navigation.VERIFICATION_RUNGS` / `VERIFICATION_AGAINST_KINDS` / `VERIFICATION_METHODS` / `VERIFICATION_RESULTS` at call time.
- Wired `/mos:room checks` (room-wide portrait + claim list, all 4 states always shown, unchecked included at 0, never a score), `/mos:room claim <id or words>` (reopens a claim, Confirmation status and Checking record rendered side by side, ambiguity resolved through an AskUserQuestion card over up to 4 candidates), and `/mos:room check <id or words>` (gathers against/against-kind/rung/method/result through AskUserQuestion cards sourced verbatim from `claim-checks.cjs options`, asks the disputed-resolution question only when the claim is disputed and the chosen result is `supports`/`inconclusive`, passes `--resolves-dispute` only on an explicit person "Yes").
- Regenerated `skills/room/SKILL.md` via `build-skill-mirrors.cjs`; confirmed it is the only mirror that changed.
- Verified the frontmatter diff against `PLAN_BASE` (`d3da69ec3`) is byte-identical outside the `argument-hint` line: the connector block, `hitl_shape: "F.1"`, `body_shape*`, `layer*` declarations are untouched, so `data/connector-registry.json` and `data/brain-orchestration-projection.json` needed no regeneration.
- Ran every CIRS/born-wired gate named in the plan's `<verify>` block: `build-skill-mirrors.cjs --check`, `build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs --check`, `build-render-coverage.cjs --check`, `check-shape-declaration.cjs --check` (pre-existing advisory WARNs only, none naming `room.md`/`skills/room`), `check-help-coverage.cjs`, `build-command-registry.cjs --check`, `check-cirs-declaration.cjs --check` against this plan file -- all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - CLI test for claim-checks.cjs and the /mos:room wiring** - `a62b9d924` (test)
2. **Task 2: GREEN - scripts/claim-checks.cjs (one thin caller of the core functions)** - `470618812` (feat)
3. **Task 3: /mos:room checks | claim | check subcommands, mirror regeneration, CIRS gates** - `f804d5a8c` (feat)

_TDD plan: RED then GREEN, no separate REFACTOR commit needed (no cleanup pass required after GREEN)._

## Files Created/Modified

- `tests/test-358-b1-cli.cjs` - RED-first, 28 checks covering every `<behavior>` leg named in the plan's Task 1, including the `commands/room.md` wiring legs (which stay red until Task 3).
- `scripts/claim-checks.cjs` - the CLI: `parseArgs`, room resolution (`--room` or `navigation.detectActiveRoom()`), `resolveClaimRef` (id-by-`claim:`-prefix or words-via-`listClaimsForChecking`), `rungs`/`options`/`portrait`/`list`/`show`/`record`/`help` subcommands, 3-line `x`/`Why`/`Fix` refusal rendering with enum-driven hints, `--json` mirrors for every subcommand. Exports `{ main, parseArgs }`, runs only under `require.main === module`.
- `commands/room.md` - argument-hint updated; UI Format gains a `checks, claim and check` bullet; the "Parse the user's input" sentence states the before-`[section]`-fallback ordering; three new `## Subcommand:` sections (`checks`, `claim`, `check`) inserted before `## Subcommand: add`; Voice Rules gains one bullet distinguishing "checked" from "confirmed".
- `skills/room/SKILL.md` - regenerated byte mirror of `commands/room.md` (the only mirror `build-skill-mirrors.cjs` touched).

## Decisions Made

- `options.rungs` is a literal mirror of `navigation.VERIFICATION_RUNGS` (`{id, label}` entries, no embedded rung number); `commands/room.md` computes `Rung N - <label>` itself from the array index, keeping `options` JSON a direct pass-through of the navigation constant rather than a CLI-invented shape.
- `--json` and `--resolves-dispute` are parsed as boolean flags. See Deviations below.
- Reworded the two "checked is not confirmed" prose bullets to avoid the literal word "verified" entirely, preserving the semantic ban on ever presenting a check as a truth verdict while satisfying the Task 3 acceptance criterion that the `verified` grep count not increase past the `PLAN_BASE` value of 0.

## Deviations from Plan

**1. [Rule 4-adjacent, resolved without a checkpoint - internal contradiction in the plan text] `--json` parsed as a boolean flag, not a value-taking flag**

- **Found during:** Task 2, while translating Task 1's `<action>` step 1 ("flags `--room`, `--json`, ... take one value") into `parseArgs`.
- **Issue:** Every one of the plan's own `<behavior>` usage examples in Task 1 (`rungs --json`, `portrait --room R --json`, `show --room R --json <id>`, `record ... --json`) uses `--json` as a bare flag with no value following it. Implementing `--json` as a value-consuming flag per the literal parsing sentence would make it swallow the next token (often nothing, or a positional ref) and break every one of those same examples.
- **Fix:** Implemented `--json` and `--resolves-dispute` (the plan's own boolean flag) identically: no value consumed. This is the only reading consistent with the plan's own worked examples. No test or acceptance criterion exercises the internal parser shape directly (only the resulting behavior), so this is a non-behavioral implementation-detail resolution, not a scope change.
- **Files modified:** `scripts/claim-checks.cjs` (`BOOLEAN_FLAGS` set).
- **Verification:** All 28 `tests/test-358-b1-cli.cjs` legs pass, including every `--json` usage from the plan's behavior list.

**2. [Rule 1 - internal contradiction between an action-step draft sentence and its own acceptance criterion] Removed the literal word "verified" from two new Voice/Rules bullets**

- **Found during:** Task 3, running the plan's own acceptance grep `grep -ci "verified" commands/room.md` against `PLAN_BASE`.
- **Issue:** Task 3's `<action>` step 4 literally drafts the "checks" rules bullet as containing the word "verified" ("never say verified"/"never call a checked claim verified or confirmed"), but the plan's own acceptance criterion requires `grep -ci "verified" commands/room.md` to be no higher than the `PLAN_BASE` count, which is 0. Writing the drafted sentence verbatim raises the count to 2, failing the plan's own acceptance criterion.
- **Fix:** Reworded both bullets to the same semantic effect ("checked" is not "confirmed"; a count is not a truth verdict) without using the literal substring "verified" anywhere in the file. This also matches the established codebase convention from 358-01 (`renderClaimViewLines`/`readClaimVerification`: "the word verified never appears").
- **Files modified:** `commands/room.md`.
- **Verification:** `grep -ci "verified" commands/room.md` returns 0 (unchanged from `PLAN_BASE`); the semantic requirement (checked-is-not-confirmed messaging present in both the `checks` rules and Voice Rules) is still satisfied.

No other deviations. The GREEN implementation (Task 2) and the wiring (Task 3) otherwise match the plan's `<action>` steps as written.

## Issues Encountered

None blocking. No auth gates (no MCP/network surfaces touched in this plan; Claude Desktop/MCP is 358-04).

## Verification Evidence

All commands from the plan's `<verify>` blocks and its `<verification>` section were run and are green as of the final commit:

```
node tests/test-358-b1-cli.cjs                       -> 28 passed, 0 failed (exit 0)
node tests/test-358-b1-core.cjs                       -> 18 passed, 0 failed (exit 0, no regression)
node tests/test-358-b1-portrait.cjs                   -> 6 passed, 0 failed (exit 0, no regression)
node tests/test-358-b1-refile.cjs                     -> 11 passed, 0 failed (exit 0, no regression)
node tests/test-b1-verification.cjs                   -> PASS (exit 0, no regression)
node scripts/build-skill-mirrors.cjs --check          -> OK (112 mirrors match; skills/room/SKILL.md the only one this plan touched)
node scripts/build-connector-registry.cjs --check     -> OK
node scripts/build-orchestration-projection.cjs --check -> OK
node scripts/check-render-coverage.cjs --check        -> OK
node scripts/build-render-coverage.cjs --check        -> OK
node scripts/check-shape-declaration.cjs --check      -> exit 0 (53 pre-existing advisory WARNs, none naming room.md/skills/room -- unaffected by this edit)
node scripts/check-help-coverage.cjs                  -> valid: true
node scripts/build-command-registry.cjs --check       -> OK
node scripts/check-cirs-declaration.cjs --check <this plan file> -> OK (1 plan)
bash tests/run-all-358.sh                             -> PASSED=22 FAILED=3 SKIPPED=2, exit 1 (the 3 FAILED legs are the pre-existing substrate-commit-broken tests documented in 358-02-SUMMARY as owned by 358-04/358-05, not this plan; the 2 SKIPPED legs are test-358-b1-surfaces.cjs / test-358-b1-persistence.cjs, not yet created by 358-04)
```

Acceptance-criteria checks (all satisfied):
- `grep -c "spawnSync" tests/test-358-b1-cli.cjs` = 2; `grep -c "resolveByUser" tests/test-358-b1-cli.cjs` = 3; `grep -c "No Data Room found" tests/test-358-b1-cli.cjs` = 2.
- `grep -v '^\s*//' scripts/claim-checks.cjs | grep -cE "node:sqlite|DatabaseSync|better-sqlite3|brain|confirmNode|promoteNodeStatus|child_process"` = 0.
- `grep -c "A database or a document" scripts/claim-checks.cjs` = 0; `grep -cE "'compare'|\"compare\"" scripts/claim-checks.cjs` = 0.
- `node scripts/claim-checks.cjs rungs | wc -l` = 5 = `navigation.VERIFICATION_RUNGS.length`.
- `node scripts/check-substrate.cjs` reports no line naming `scripts/claim-checks.cjs`.
- `grep -c "## Subcommand: checks\|## Subcommand: claim\|## Subcommand: check" commands/room.md` = 3; `grep -c "scripts/claim-checks.cjs" commands/room.md` = 7 (>= 4 required).
- `grep -c "resolves-dispute" commands/room.md` >= 1, same section contains "explicit Yes".
- Frontmatter diff against `PLAN_BASE` with `argument-hint` excluded: empty (byte-identical).
- `git diff --name-only <PLAN_BASE> -- skills/` lists only `skills/room/SKILL.md`.
- `grep -ci "verified" commands/room.md` = 0 (same as `PLAN_BASE`).
- No em-dashes in any of the 4 files touched by this plan (`tests/test-358-b1-cli.cjs`, `scripts/claim-checks.cjs`, `commands/room.md`, `skills/room/SKILL.md`).

## Threat Model Coverage

All five threats in the plan's STRIDE register (T-358-12 through T-358-16) are mitigated exactly as declared:

- **T-358-12** (Tampering, argv reaching SQL): the script never builds SQL and never shells out; every value flows to `navigation.recordClaimVerification`, which uses prepared statements with `?` binds and closed-enum validation. Proven by the substrate-hygiene test leg (no `node:sqlite`/`DatabaseSync`/`better-sqlite3` reference) and by `check-substrate.cjs` naming no violation in this file.
- **T-358-13** (Elevation of privilege, CLI auto-resolving a dispute or confirming a claim): `commands/room.md`'s `check` subcommand only passes `--resolves-dispute` after an explicit person "Yes" (Step 4); `scripts/claim-checks.cjs` never calls `confirmNode`, `promoteNodeStatus` or `gate_answer` (proven by the same static substrate-hygiene grep, which also checks for `confirmNode`/`promoteNodeStatus` per the Task 2 acceptance criterion).
- **T-358-14** (Information disclosure, Canon Part 8): no Brain import anywhere in `scripts/claim-checks.cjs` (static check); all output goes to the local terminal only; zero network calls in the file.
- **T-358-15** (Spoofing, `checked_by_id`, accepted risk): `checked_by_id` is resolved from `navigation.resolveByUser(roomDir)`, which coerces agent identities to `'navigator'` and is local-only; proven by the "checked_by_id from resolveByUser" test leg.
- **T-358-16** (Repudiation, room.md edit silently changing the declared HITL shape or connector): the frontmatter-diff acceptance criterion (byte-identical outside `argument-hint`) plus the connector/projection/render/mirror/CIRS gate suite, all run and green above.

No new trust boundaries or surfaces beyond what this plan's threat register already covers were introduced (no new MCP tool, no new command; `/mos:room` stays the one existing born-wired surface). No `## Threat Flags` section is needed.

## Known Stubs

None. Every subcommand (`rungs`, `options`, `portrait`, `list`, `show`, `record`) has a real, tested implementation reading and writing through `lib/core/navigation.cjs`; nothing renders a placeholder or hardcoded empty value. The `commands/room.md` `checks`/`claim`/`check` sections describe real script invocations, not aspirational text.

## Next Steps

- 358-04 adds the `claim_verify` rung/checked_by_id/resolves_dispute extension and the new `claim_read` MCP tool, giving Claude Desktop and Cowork the same checking-record surface this plan gave the CLI, built against the exact same `navigation.cjs` functions.
- 358-05 regenerates `data/mcp-tool-connectors.json` + `data/connector-registry.json` for the new MCP surface (this plan's landing-order note: `commands/room.md`'s hook-triggered `build-connector-registry.cjs --check` stayed green here specifically because 358-04's `claim_read` connector has not landed yet).
- 358-06 writes the operator go/no-go runbook.

## Self-Check: PASSED

- FOUND: `tests/test-358-b1-cli.cjs`
- FOUND: `scripts/claim-checks.cjs`
- FOUND: `commands/room.md` (modified)
- FOUND: `skills/room/SKILL.md` (modified)
- FOUND: `.planning/phases/358-rome-b1-checking-record-and-b2-frame-provenance-user-visible/358-03-SUMMARY.md`
- FOUND commit `a62b9d924` (test: RED, Task 1)
- FOUND commit `470618812` (feat: GREEN, Task 2)
- FOUND commit `f804d5a8c` (feat: GREEN, Task 3)
