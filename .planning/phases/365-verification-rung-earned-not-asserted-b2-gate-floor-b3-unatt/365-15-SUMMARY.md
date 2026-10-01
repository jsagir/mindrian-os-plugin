---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 15
subsystem: portrait
tags: [portrait, b5, status, claim-read, pulled-not-pushed]
requires: [365-04, 365-07, 365-08, 365-11, 365-14]
provides:
  - "navigation.readStandingPortrait(db) and navigation.HELD_WORDS"
  - "renderPortraitLines(portrait, standingPortrait): optional second argument adds the standing rows"
  - "standing on readClaimVerification's claim, on the claim view and on the claim list lines"
  - "claim_read rendered.portrait carries the standing rows; standing_portrait added to the response"
  - "/mos:status --checks (CLI pulled portrait plus never-do line)"
affects: [365-16, 365-17, 365.1]
requirements: [V365-03, V365-14, V365-16]
key-files:
  created:
    - tests/test-365-portrait.cjs
  modified:
    - lib/core/navigation/verification.cjs
    - lib/core/navigation.cjs
    - lib/mcp/tools/claim-verify.cjs
    - scripts/mos-status.cjs
    - commands/status.md
    - skills/status/SKILL.md
    - tests/fixtures/365-baseline-red.json
decisions:
  - "The standing rows reuse the 365-04 words map and one new HELD_WORDS inside the same PROVISIONAL(365) block; no second vocabulary"
  - "readVerificationPortrait is untouched; the counts come from a new reader so the 358 deep-equal pins stay valid"
  - "The row group opens with one heading line (What this room's claims were checked against) inside the shared renderer, so Desktop, Cowork and the CLI print identical text"
  - "--checks prints the whole shared portrait (358 lines plus standing rows), inserts the never-do line just before the closing line, and never prints any of it without the flag"
metrics:
  tasks: 2
  files: 8
  commits: 2
---

# Phase 365 Plan 15: Pulled portrait and standing on every claim view Summary

Asked a week later what a claim was checked against, the room now answers in words, and the whole room's picture is one call away: `/mos:status --checks` on the CLI and claim_read's portrait on Desktop and Cowork, never pushed, never scored. RED-365-ONEWEEK-STANDING is healed and gone from the red list (RED-365-BYTE-DERIVED stays, owned by 365.1).

PLAN_BASE = `5b9b0e0a7dfe01aed163e3a659abcc57484edad3`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `e5b420ccf` | feat(365-15): standing portrait rows and standing on the claim view; one-week test green |
| 2 | `603e5cba6` | feat(365-15): /mos:status --checks and the claim_read portrait name each standing in words |

Each used `git add <exact paths>` then `git commit --only -- <exact paths>`; both pass `git merge-base --is-ancestor <sha> HEAD`. STATE.md and ROADMAP.md were not touched; no `state.*` writer, `roadmap.update-plan-progress` or `query commit` ran. The peer's uncommitted 353-FLEET-REPORT.json was left alone.

## What changed

- verification.cjs: `HELD_WORDS` (frozen: label "held for evidence (approved below this room's floor)", moves_when "a source is attached and it is approved again, or the room's floor is lowered in ROOM.md"); `readStandingPortrait(db)` returns `{claims_by_standing, held, records_total}` (read-only, never throws); `renderPortraitLines(portrait, standingPortrait)` adds, before the closing line, the heading plus one row per standing (located_source, source_edge, model_only, none) plus the held row, each `<label>: <n> - moves when <moves_when>`; `claim.standing` on the claim view; view line `Checked against: <label>. It moves when <moves_when>.` after the Confirmation status line; the list line appends ` | <label>`. Every new line is guarded so a claim object without `standing` renders the old lines only. Diff against PLAN_BASE removes only the one-argument signature line and the list-line tail (both extended, not reworded).
- claim-verify.cjs claim_read: `rendered.portrait` built with the standing portrait on every path; `standing_portrait` added to the response. Descriptions and schemas unchanged (sha-pinned in Q7b, equals PLAN_BASE).
- mos-status.cjs: `--checks` flag. Resolves the room as the script already does, opens room.db through navigation, prints the shared portrait with the never-do line (`Never-do list: <n> named. ` + FLOOR_SENTENCE, or the unreadable form with its fix) just before the closing line, closes the db, exits 0 without the normal status.
- commands/status.md: `argument-hint` and one Arguments line only; teaching, description, hitl_shape and hitl_why are byte-unchanged.

## Sample `--checks` output (scratch room: one source-linked claim, one asked-and-held claim, one unchecked claim, no never-do file)

```
Checking record across this room (counts only)
  checked: 1
  disputed: 0
  inconclusive: 0
  unchecked (no checking record yet): 2
  claims in this room: 3
  checks recorded: 1 (supports 1, contradicts 0, inconclusive 0)
  checks by rung: rung 1: 0, rung 2: 1, rung 3: 0, rung 4: 0, rung 5: 0, rung unknown: 0
What this room's claims were checked against
  checked against a located part of a source outside the conversation: 0 - moves when a person with standing checks it (the room cannot record that yet)
  checked against a source document outside the conversation (a link and a retrieval date): 1 - moves when the exact part of a primary source that decides it is recorded (a page, section, DOI or clause)
  recorded as checked only by asking a model: 1 - moves when it is checked against a source document outside the conversation
  not checked yet: 1 - moves when any check is recorded
  held for evidence (approved below this room's floor): 1 - moves when a source is attached and it is approved again, or the room's floor is lowered in ROOM.md
Never-do list: 0 named. This list catches only what has been named. It is a floor, not a guarantee.
A count is not a verdict. Only a person confirms a claim.
```

With a malformed `.mindrian/never-do.json` the never-do line reads `Never-do list: could not be read (.mindrian/never-do.json). Until it is fixed, every unattended step in this room stops. This list catches only what has been named. It is a floor, not a guarantee.`

## Regeneration delta

Before any edit all generators' `--check` passed and no generated file had a foreign diff. After the edits only the skill mirror drifted (status DIVERGES). `node scripts/build-skill-mirrors.cjs` overwrote exactly one mirror, skills/status/SKILL.md (argument-hint plus the Arguments line). data/command-registry.json, data/connector-registry.json, data/brain-orchestration-projection.json and data/render-coverage-registry.json did NOT move (their `--check` still passes), so none was regenerated or committed. data/harness-manifest.json digests none of the touched files (`--check` OK).

## Verification (HEAD `603e5cba6ca48a30ccaae3dda933c69d4d94ae4b`)

- `node tests/test-365-portrait.cjs`: PASS (Q1..Q11, plus Q1b, Q1c, Q3b, Q5b, Q5c, Q7b).
- test-358-b1-portrait, test-358-b1-core, test-358-b1-cli, test-b1-verification, test-365-acceptance-one-week, test-365-standing, test-365-baseline: exit 0.
- `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` at HEAD `603e5cba6ca48a30ccaae3dda933c69d4d94ae4b`: exit 0, `PASSED=66 FAILED=0 SKIPPED=0 KNOWN=6` (baseline 64/0/0/7: +1 new test, +1 one-week leg now passing, KNOWN 7 to 6). Regression block: 354 now 1 / base 1, 355 now 4 / base 4, 356 now 0 / base 0, 358 now 6 / base 6, 363 now 4 / base 4; all PASSED.
- `node scripts/build-harness-manifest.cjs --check`: OK at the same HEAD. build-skill-mirrors, build-command-registry, build-connector-registry, build-orchestration-projection `--check` all OK; check-render-coverage 0 unwired; check-cirs-declaration on the plan OK.
- test-267 zod4 contract: check (a) PASS (descriptions byte-identical). Checks (b) (research_run membership) and (d) (fork359 probe zod import) fail and are pre-existing (listed KNOWN in the aggregator); not touched.
- No em-dash or en-dash in any touched file (`grep -nP '[\x{2013}\x{2014}]'` clean).

## Deviations from Plan

None - plan executed as written. Two small shape choices: the standing rows carry one heading line inside the shared renderer (so all three surfaces print identical text and the Q8 header is the same line), and `--checks` prints the full portrait (358 lines first) rather than only the new rows, so the closing line stays last and one renderer serves every surface.

## Known Stubs

None.

## Threat Flags

None new. T-365-04 (unreadable list reported with its fix, Q9), T-365-26 (no score words over every rendered line, Q4/Q7/Q8), T-365-15 (descriptions and schemas unchanged, sha-pinned Q7b, zod4 check (a) green) and T-365-11 (commit --only, ancestors verified) are implemented as planned. `--checks` reads room.db and `.mindrian/never-do.json` locally only; no network.

## Hand-offs

- **365-16 (Theo sync):** claim_read's description and schema are unchanged; only the response gained `standing_portrait` (a response field, not a schema field).
- **Wording ratification:** when the paper author ratifies the ladder, change `STANDING_WORDS` and `HELD_WORDS` in verification.cjs only; test-365-portrait builds its expectations from those exports, so the tests follow.
- **365.1:** replaces only the body of `claimStanding`; the portrait, the claim view, the list lines and the weekly signals all read it. D-25 fence kept: no `deriveRung` added.
- Later plans touching commands/status.md must re-run `node scripts/build-skill-mirrors.cjs`.

## Self-Check: PASSED

- FOUND: tests/test-365-portrait.cjs, and every file listed under key-files modified
- FOUND commits e5b420ccf and 603e5cba6 (both ancestors of HEAD)
- STATE.md and ROADMAP.md untouched
