---
phase: quick
plan: 261005-muy
status: complete
completed: 2026-10-05
subsystem: release-ceremony
tags: [release, real-room, receipt-gate, RULE-10, doctor, desktop-leg]
requirements: [navigator-ruling-2026-10-05-6]
key-files:
  created:
    - scripts/real-room-run.cjs
    - scripts/release-lib/real-room-gate.sh
    - tests/test-muy-real-room-rule.cjs
    - tests/fixtures/release-room/ (ROOM.md, seed.json, question-set-quick.json, question-set-deep.json, sections/ with 5 artifacts)
  modified:
    - scripts/release.sh
    - scripts/doctor.cjs
    - tests/fixtures/341-release-step-block-hashes.txt
    - docs/RELEASE-CEREMONY-RULING-SYSTEM.md
    - .claude/includes/release-process.md
    - CHANGELOG.md
commits:
  red: 3123013c3
  green: b1ccab56e
  fix: 8ef260620
---

# Quick 261005-muy: the real-room release rule (critical path item 7)

`release.sh` Step 2.6 now refuses a cut unless a receipt for the exact HEAD sha exists, written only by `node scripts/real-room-run.cjs --read-by "<name>"` after a person read the report of a quick run, a deep run, Eureka and analogies on a fixture room born through the room chokepoint.

## What was built

- `scripts/release-lib/real-room-gate.sh`: sourced in the release.sh preamble beside the other gates. `mos_real_room_gate plugin_dir dry_run no_check`. Reads `<receipt-dir>/<HEAD sha>.json` (default `$HOME/.mindrian/release-real-room`, seam `MINDRIAN_REAL_ROOM_RECEIPT_DIR`), validates sha, reader, four perspective blocks with numeric counts, and refuses an `offline: true` receipt. WARN (not refusal) when the receipt has no `desktop_verified` leg. Dry-run reports `[DRY RUN] ... would ABORT` and returns 0. `--no-real-room-check` prints the flag, the sha and "nothing proves this cut ran on a room".
- `scripts/real-room-run.cjs`: argv switch-case router. Births `release-fixture-<sha8>` through `birthRoom` into `--rooms-home` (default `<receipt-dir>/rooms`, refuses `~/MindrianRooms`), copies the committed seed sections, indexes them with `graphOps.indexArtifact`, writes the seed's entities, DESCRIBES links, one known pair and five typed claims through the navigation write door, then drives the planner CLI. One report, four sections (`== Quick research ==`, `== Deep research ==`, `== Eureka ==`, `== Analogies ==`), each "what it tried, what it got, what it could not do" plus per-lane `ran | empty | provider absent` lines. Receipt only with `--read-by`. `--desktop-verified mac|win` updates the existing receipt for HEAD or refuses `no_receipt_for_head`.
- `tests/fixtures/release-room/`: Lisbon Cold Locker, an invented venture whose governing question names a city (Lisbon) and a product (a solar-powered cold locker). Four sections plus `strategy`, five artifacts (one a SAPPhIRE-style encoding of termite mound ventilation, for analogies), five entities, five typed claims, one already-known pair, two question sets for the planner. No real name anywhere.
- `scripts/doctor.cjs`: acceptance point `real-room-run` (`applies_to: pre-tag, full`, ok with a WARN finding when the latest receipt is behind, absent or offline; never red).
- `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`: RULE 10 (not a lockstep place, RULE 5's list is unchanged). `.claude/includes/release-process.md`: a short section pointing at it. `CHANGELOG.md` Unreleased Added line.
- `release.sh`: flag `--no-real-room-check`, library sourced in the preamble (the incomplete-checkout guard), Step 2.6 between Step 2.5 and Step 3, a dry-run listing line plus the gate verdict. Header comment lines 1-79 untouched on purpose (the 310 suite's preamble tripwire pins them).

## Receipt schema

```
{ schema: "mos.real-room-receipt/1", sha, version, room, reader, read_at, offline,
  perspectives: { quick|deep|eureka|analogies: { status, counts: { <name>: <number> } } },
  providers: { tavily: "present|absent", openalex: "reachable|unreachable|not checked (offline)" },
  desktop_verified: { mac: <ISO|null>, win: <ISO|null> } }
```

counts: quick `searches_planned searches_executed rows lanes_ran lanes_empty lanes_unavailable`; deep adds `lanes_planned counterevidence_planned counterevidence_executed`; eureka `candidates things excluded_known passed_stage_a judged`; analogies `pairs structural_pairs things`.

## Arms (tests/test-muy-real-room-rule.cjs)

RED on a `git archive` of HEAD before the work (3123013c3 committed alone): 1 passed (the dash guard, by construction), 14 failed. GREEN: 15 passed, 0 failed.

| Arm | Result |
|---|---|
| G1 empty receipt dir refuses, names `node scripts/real-room-run.cjs --read-by "<your name>"` | PASS |
| G2 receipt for another sha refused, both shas shown (and a mislabelled file) | PASS |
| G3 receipt for HEAD passes, prints reader and the four counts (also: no reader and a missing block are refused) | PASS |
| G4 no desktop leg prints a WARN naming desktop, mac set prints none | PASS |
| G5 opt-out passes with the flag and "nothing proves this cut ran on a room"; dry-run reports `would ABORT` | PASS |
| G6 `--offline` births the room (room.db, registry lists it), report has the four sections and lane lines, no receipt | PASS |
| G6b rooms home under `~/MindrianRooms` refused (exit 2) | PASS |
| G7 `--read-by` receipt fields, `--desktop-verified mac` changes only that leg, `no_receipt_for_head`, gate refuses the offline receipt | PASS |
| G8 doctor point: WARN when absent or behind, ok with `latest_sha == HEAD` when equal | PASS |
| G9 dry-run lists Step 2.6 after 2.5 and before 3, reports the verdict, opt-out line, usage block | PASS |
| G9b real path: sourced in the preamble, Step 2.6 calls the gate with the dry-run and opt-out vars and aborts before Step 3 | PASS |
| G10a-d dash guard, CHANGELOG, RULE 10, include | PASS |

## Dry-run step list (`bash scripts/release.sh --dry-run --prerelease`)

`0.55, 2, 2.4, 2.4, 2.4, 2.5, 2.6, 3, 4, 5, 5b, 6, 6.5, 6.6, 6.6a, 6.6b, 6.7, 6.8, 7, 9.5, 7.5, 8, 9, 5.5, 9.6a, 9.6b, 9.6c, 9.7, 9.8, 10, 11`. Step 2.6 prints `[DRY RUN] real-room-gate: NO RECEIPT ... A real release would ABORT here.` and exits 0.

## What `--offline` runs and what it marks not fetched

Runs: room birth, indexing, graph seeding, both plans (quick and deep, with the exact search strings printed), Eureka recall and judge (`--judge none`), analogies recall and judge. Marks `offline (not fetched)` and `provider absent (offline, not fetched)`: the quick run (`run-quick --offline`, answers `plan_only`, nothing sent), every deep lane (no grant, no fetch), and the OpenAlex probe (`not checked (offline)`). A receipt made with `--offline` records `offline: true` and the gate refuses it.

## Deviations from Plan

1. **[Rule 3] The plan's command `bash scripts/release.sh --dry-run 2.0.0-beta.0` is not valid** (release.sh takes a bump mode, not a version; a version argument is `unknown arg`, exit 1). G9 and the Task 3 report use `--dry-run --prerelease`, which plans 2.0.0-beta.58 -> beta.59.
2. **[Rule 3] G9 parses the step listing, not `===` lines.** The dry-run block prints `  Step N :` lines, not `=== Step` headers; the real run prints the `=== Step 2.6 ===` header. The test accepts both forms and the order holds in each.
3. **Opt-out is a positional argument, not an env variable.** The plan allowed `MOS_NO_REAL_ROOM_CHECK=1 (or the flag variable the other gates use)`; the other gates take `no_check` as the third argument, and an ambient env bypass is a quiet hole. G5 drives the argument.
4. **The gate refuses an offline receipt** (not in the plan). Without it, `--offline --read-by X` would mint a valid receipt for a run that sent nothing. The receipt carries `offline`, the gate and the doctor point read it.
5. **Seed graph is written through navigation, not extracted.** `seed.json` names entities, DESCRIBES links, claims and a known pair, written with `writeEntityNode`, `linkEntityRelations`, `writeClaimNode`, `writeEdge`. The real extraction pipeline needs an embedding model download and may escalate to an LLM, which would make the ceremony slow and nondeterministic. The report states "seeded: N artifacts indexed, N entities, ..." so a reader knows.
6. **The encoding artifact lives in `strategy`, not `solution-design`.** Eureka and analogies pair things across sections; the locker is in `solution-design`.
7. **The deep run's rows are written by the harness** (the first record title per leaf, label `supports` or `contradicts`), a mechanical stand-in for the analyst lane. The report says so in its "could not" line and RULE 10 records the limit. Eureka runs `--judge none` (the planner door forces it) and the report says no model judged.
8. **Two question sets, not one** (`question-set-quick.json`, `question-set-deep.json`): the quick whitespace template and the deep map-unknowns template need different leaf shapes (deep lens lanes need `term` slots).
9. **[Rule 1] A second commit (8ef260620).** My first usage-block edit put `[--no-real-room-check]` between `[--no-cut-listener]` and `[--dry-run]`; `tests/test-release-cut-listener-wiring.cjs` pins their adjacency (found by `run-all-349.sh`, red after b1ccab56e). Moved it before `[--no-cut-listener]` and re-pinned the 341 fixture.
10. **341 step-block fixture regenerated, 310 left alone.** See Known pre-existing red.

## Verification

- `node tests/test-muy-real-room-rule.cjs`: 15/15.
- The live path was exercised hermetically (no network) with the Phase 363 OpenAlex replay preload: dry run, `--read-by` run (quick 3 of 3 searches, deep 6 of 6 searches, 3 lanes ran, 5 harness rows, synthesis done on saturation), `--desktop-verified win`, then the real gate sourced against that receipt: PASS with the desktop line. Nothing was written under `~/MindrianRooms` or `~/.mindrian`.
- `bash tests/run-all-349.sh`: PASS=14 FAIL=0. `tests/test-doctor-acceptance-self-coverage.cjs`: 6/6. `test-310-release-step55-wiring`, `test-235-release-shape-gate`, `test-353-release-wiring`, `test-366-suite-gate`, `test-349-release-wiring`, `test-366-snapshot-gate`, `test-343-theo-stamp-gate`, `test-release-cut-listener-wiring`: all exit 0.
- `node scripts/doctor.cjs --acceptance --pre-flight`: 1/1. `--pre-tag --json`: 21/21 points ok (was 20 with python-floor; the new one is `real-room-run`, which carries the expected WARN: no receipt exists on this machine yet).
- `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`: exit 0.
- Dash guard over every line the three commits added: 0 hits.

## Known pre-existing red (not caused by this task)

- `bash tests/run-all-310.sh`: PASS=10 FAIL=1 SKIP=1. Leg 3 (310 step-block tripwire, fixture `tests/fixtures/310-release-step-block-hashes.txt` and the literal 33 in the script) was red on HEAD before this task: 34 headers against 33 pinned and six hash mismatches since Phase 369.1 never re-minted it. It now reads 35 headers. Fixing it means a 310 fixture regeneration plus that literal, outside this task's files; needs its own rebaseline quick.
- `bash tests/run-all-341.sh`: PASS=20 FAIL=2 SKIP=6. FAIL 1 is the nested run-all-310 (above). FAIL 2 is `build-harness-manifest --check`: `data/harness-manifest.json` is stale against `agents/larry-extended.md` and `skills/larry-personality/SKILL.md`, which the peer executor changed and committed without regenerating the manifest. The 341 step-block tripwire, red on HEAD, is now green.
- `bash tests/run-all-343.sh`: PASS=9 FAIL=2: `test-343-counter-metric-declaration` (SENS_PRIORITY_IDS order) and `test-298-contract-parity` (the same harness-manifest staleness). Both fail identically on a clean `git archive` of 93c971b2d (the commit before this task's GREEN).

## Step-block fixture regeneration (the 261002-r41 precedent)

The 341 fixture matched `release.sh` at the r41 commit (76d50bc0e) byte for byte (0 differing lines). Every delta since was attributed by regenerating per commit and diffing block bodies: 843efa834 (369-02), 49a1a026a (369-28), 813fe74c8 (369.1-14, adds Step 6.8), 656e8c1fc (369.1 WR-08), f01173a32 (261005-l8h), and this task (adds Step 2.6, moves Step 0 and Step 1). None unexplained. Regenerated wholesale with the fixture's own generating command; `STEP_BLOCK_COUNT` 33 -> 35; the REBASELINE note in the fixture lists the attribution.

## The one human step owed before the cut

HEAD must be the commit that will be cut when this runs, because the receipt is per exact sha and every later commit (this SUMMARY, state commits) moves HEAD:

`node scripts/real-room-run.cjs --read-by "<name>"`

Read the report first. Then, if the cut ships a Desktop copy, on a Mac and a PC: `node scripts/real-room-run.cjs --desktop-verified mac|win`.

## Limits

- The receipt proves a named person ran the ceremony at that sha and passed `--read-by`, not that they approved the results. A dirty working tree at run time is not recorded.
- Tavily is reported (key present or absent) but the research planner's own lines go to OpenAlex; the run does not depend on Tavily.
- Not exercised here: a live run with the real network (the orchestrator's step), a Mac or Windows host.

## Self-Check: PASSED

Commits 3123013c3, b1ccab56e and 8ef260620 are ancestors of HEAD; the created files exist; `tests/test-muy-real-room-rule.cjs` runs 15/15 at HEAD.
