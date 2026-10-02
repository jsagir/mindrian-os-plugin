---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 24
status: complete
subsystem: phase-close-out
tags: [close-out, requirements, handoff, theo-request, research-trail, todos, baseline-refresh]
requires:
  - 366-11 (the release envelope shape and the strictObject fact)
  - 366-20 (the spike record and the six rulings)
  - 366-22, 366-23 (runner retired, semantic-index split; the carry list)
provides:
  - EPV366 rows closed with Measured lines (29 [x], EPV366-21 [ ] with its reason)
  - 366-HANDOFF.md (D-01..D-17 per plan, spike summary, rulings, follow-ons F1-F17)
  - .planning/todos/pending/2026-10-01-theo-intent-led-canon-resolver.md (the Theo-side request)
  - the research entry 2026-10-02-eureka-366-spike-and-close-out.md in three homes
  - the combined 267 baseline refresh (MCPV2-03, MCPV2-08 [x])
affects: [Phase 349 (D-17 leading edge), Phase 364, Phase 367, Phase 368, the Theo workspace (request only), the next release (place 9 refuses until the snapshot is stamped)]
tech-stack:
  added: []
  patterns: [close-out per the 363-22 precedent, Dev-Research Compositing mirror in three homes]
key-files:
  created:
    - .planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-HANDOFF.md
    - .planning/todos/pending/2026-10-01-theo-intent-led-canon-resolver.md
    - .planning/research/2026-10-02-eureka-366-spike-and-close-out.md
    - .planning/todos/completed/2026-07-08-f7-rescope-212-213-against-registercapability.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-VALIDATION.md
    - .planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/deferred-items.md
    - .planning/todos/pending/2026-07-29-deck-generation-ignores-explicit-slide-count-on-first-pass.md
    - .planning/todos/completed/2026-07-03-registry-drift-gate-prevent-silent-command-disappearance-key.md (moved from pending)
    - .planning/todos/completed/2026-07-12-never-git-stash-mid-merge-conflict-resolution-it-drops-merge.md (moved from pending)
    - tests/fixtures/267/wire-snapshot-zod3.json
    - tests/fixtures/267/zod4-accepted-deltas.json
    - tests/fixtures/267/zod-importers-baseline.txt
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-BASELINE.md
    - lib/core/navigation/memory-events.cjs (comment only)
decisions:
  - "EPV366-21 reopened to [ ]: the snapshot gate is green but data/framework-names.json has no theo_stamp; refresh-framework-names.cjs --live is a live Theo read and was not run; the next release refuses at RULE 5 place 9 until it is"
  - "EPV366-13 closed [x] with a note: its --legacy half was retired on purpose by EPV366-25"
  - "eureka-ranking-pin.json kept, not deleted: still cited by measure-355-hit-rate's report text and two code comments"
  - "Deck slide-count todo re-deferred: the fix needs the engine prompt, the deck door and the renderer (more than one site)"
  - "No egress-policy.json change: the spike rulings kept every default"
  - "The 267 research_run membership delta is pinned in zod4_other with its reason instead of inventing a zod 3 entry for a tool that post-dates the zod 3 snapshot"
metrics:
  tasks_done: 3
  tasks_total: 3
  completed: 2026-10-02
---

# Phase 366 Plan 24: Phase close-out Summary

Phase 366 is closed with proof: 29 of 30 EPV366 rows carry a Measured line, one stays open with a
named command, three folded todos are closed and one re-deferred with a written finding, the
handoff lists D-01 to D-17 with their plans and seventeen follow-ons, the Theo-side intent-led
resolver request is filed as a todo, and the spike close-out is in the research trail in three homes.
The orchestrator-approved 267 baseline refresh also landed, flipping MCPV2-03 and MCPV2-08.

## Commits

| Commit | Message |
|--------|---------|
| 0bcdf31cc | test(366-24): combined 267 baseline refresh after Phase 366; flip MCPV2-03 and MCPV2-08 |
| 0fedbd1aa | docs(366-24): memory-events comment no longer names the deleted runner |
| 289371734 | docs(366-24): folded todos closed or re-deferred with written findings |
| 1273ab929 | docs(366-24): phase handoff, Theo-side intent-led resolver request, research trail |
| 843b95dd3 | docs(366-24): close the EPV366 rows with measured proof; validation rows green |
| (this summary's commit) | docs(366-24): close-out summary and deferred-items dispositions |

Every commit used `git add -f <paths>` and `git commit --only <paths>`. No stash, reset or `add -A`.

## Task 1: EPV366 rows, VALIDATION

- 29 rows `[x]`, each with a `**Measured:** (2026-10-02)` line naming its tests and their counts,
  exit 0 in `bash tests/run-all-366.sh` (PASSED=69 FAILED=0 SKIPPED=1 KNOWN=1).
- 1 row `[ ]`: **EPV366-21**. It was `[x]` from 366-06, but the row says the snapshot carries a
  `theo_stamp`, and it does not (`theo_stamp: null`). The gate, writer and docs tests are green;
  `node scripts/refresh-framework-names.cjs --live` has never run. Reopened with that reason, and
  surfaced as handoff F1 because the next `release.sh` cut will refuse at place 9.
- EPV366-13 is `[x]` with a note: the `--legacy` half held at 366-03 and was then removed on
  purpose by EPV366-25.
- `366-VALIDATION.md`: all 59 task rows green. Rows that run an older aggregator say which
  pre-existing reds they keep. `nyquist_compliant: true`, `wave_0_complete: true`, Wave 0 boxes
  ticked.
- ROADMAP.md was not edited (orchestrator instruction; see Deviations).

## Task 2: folded todos and egress

| Todo | Outcome | Finding |
|---|---|---|
| Registry-drift gate | closed (moved to completed/) | `check-registry-drift --check` OK, 0 findings; `/mos:eureka` passes. MCP op names are outside the gate (the known 355 D-26 gap); 366 kept every op and router name as a deprecated alias or pointer, held by test-366-mcp-perspective-ops M2, router-redirects and eureka-alias |
| F7 / SENS-13 | closed | the eureka producer no longer files or writes last-eureka.json (366-07); rs, hsi, whitespace, find-connections still feed SENS-13 through the relocated filer; the runner is deleted (366-22), so the 212/213 re-plan is moot for eureka |
| Never-stash | closed | the one 366 merge (ebd9090cf) is two-parent; every plan used `--only` commits; 366-23 used a detached worktree for its base comparison. No exception |
| Deck slide count | re-deferred, dated note | `generate-deck.cjs` renders a fixed 10 slides with no count input; the engine's "Slide Architecture (10-12 slides)" has no override rule; the 7-slide report matches neither, so the model path decides. The fix needs the engine prompt, the deck door and the renderer: more than one site, so no code was touched |

Egress: `366-SPIKE-RULINGS.md` changed no default (jev-runtime dev-time, haiku separate-producer),
so `data/egress-policy.json` is untouched; `node tests/test-366-egress-policy.cjs` PASS 24.

## Task 3: handoff, Theo request, research mirror

- `366-HANDOFF.md`: D-01 to D-17 one line each with the delivering plans; the D-17 line says the
  lagging gate plus the refresh command is the delivered form and the leading edge is unwired; the
  spike summary and the six rulings; follow-ons F1 to F17, including "wire the D-17 leading edge
  into the Phase 349 dispatch step" (F2), the rs-engine / hsi-engine fate, the four command doors,
  Phases 364, 367 and 368, and the carry list. `Research trail:` line names all three paths.
- `2026-10-01-theo-intent-led-canon-resolver.md`: the envelope `{ raw, intent, section,
  perspective }` with the closed vocabulary of each key, the strictObject fact, what the plugin
  already does, and that only a transport switch in `canon-release.cjs` `releaseTerm` is needed.
  Generic handles only; nothing under the Theo workspace was touched.
- `2026-10-02-eureka-366-spike-and-close-out.md`: per arm and repeat (shown, useful, Wilson,
  clears), the 44.8% baseline note, the RS and HSI slice comparisons, the judge arms, label
  consistency, the re-measured direction and floor rows, the six rulings quoted, the D-13 (c)
  request. Byte-identical (`cmp`) in `.planning/research/`,
  `~/MindrianRooms/rethinking-mindrianos/research/` and `~/MindrianOS/research/`. The two outside
  copies are written, not committed (the home repo's mirror commit is left to the orchestrator).

## Orchestrator-approved additions

1. **Combined 267 baseline refresh (one commit, 0bcdf31cc).** Each pin was re-measured:
   - `tool:orchestration` description: the zod 3 snapshot now carries the 366-16 wording (the
     scout-hsi pointer to `perspective_recall`). Caused by 366.
   - `tool:research_run:membership`: pinned in `zod4_other` with a note (363-17 added the tool after
     the zod 3 snapshot; 366-12 added its perspective ops). Not a zod delta, so it was pinned with a
     reason rather than by inventing a zod 3 schema for it.
   - `scripts/fork359-permission-probe.cjs` added to the importer baseline (359-05). Not caused by
     366, but named in the approved refresh list and the 267 verification record.
   - `CONNECTOR_DESCRIPTORS` 31 to 32 in `267-BASELINE.md` (research_run, 363-17), with dated notes.
   - Result: `test-267-mcpv2-zod4-contract` PASS=4 FAIL=0 (was 1/3); `test-267-mcpv2-cirs-gates`
     PASS=3 FAIL=0 (was 2/1). MCPV2-03 and MCPV2-08 `[x]` with Measured lines; the family is 19 of
     19. No other red was touched.
2. **Carry list.** (b) `eureka-ranking-pin.json` NOT deleted: the condition was "if nothing
   references it", and it is still cited by the report text `measure-355-hit-rate.cjs` emits and by
   two code comments (filed as F13). (c) the memory-events comment fixed, allowlist entry left, the
   no-producer fact stated (0fedbd1aa). (a), (d), the eleven test-only eureka modules and the
   dist/zed text are filed as handoff follow-ons F9, F10, F12, F14, not fixed.

## Suite results (hermetic: temp HOME / USERPROFILE / MINDRIAN_ROOMS_HOME, CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID unset)

| Suite | Result | Versus the 366-23 baseline |
|---|---|---|
| run-all-366 (final, after every commit) | PASSED=69 FAILED=0 SKIPPED=1 KNOWN=1 | same; SKIP = spike preparer ENV GAP (no local embedding model in a temp HOME), KNOWN = 355 direction-agreement leg H |
| run-all-seed103 | PASSED=20 FAILED=0 | same |
| run-all-363 | PASSED=45 FAILED=3 SKIPPED=1 KNOWN=5 | same legs (run-all-221 and run-all-3551 signature drift, no-new-dependency) |
| run-all-355 | PASS=67 FAIL=4 | same (direction-agreement H, doctor --acceptance, run-all-272 / 272-cache-probe, part8-egress-guard PB8-03) |
| run-all-3551 | PASS=62 FAIL=6 | the stated baseline |
| run-all-215 / 218 / 219 / 226 / 363.1 / 341 | 6/0, 17/0, 13/0, 4/0, 10/0 (1 skip), 22/0 (6 skips) | same |
| run-all-216 | PASS=8 FAIL=1 | the strict shape-declaration leg |
| run-all-223 | PASS=16 FAIL=3 | same three legs |
| run-all-343 | PASS=9 FAIL=2 | the two git-porcelain legs (shared tree dirty with peer files) |
| test-267-mcpv2-zod4-contract / cirs-gates | 4/0, 3/0 | were 1/3, 2/1 |

Also green: `check-registry-drift --check`, `check-require-integrity` (OK, 2693 files),
`build-harness-manifest --check`, `test-355-filing` 42/0 after the comment edit.

## Deviations from Plan

1. **[Orchestrator instruction] ROADMAP.md not edited.** The plan's Task 1 marks the 366 plans in
   ROADMAP.md; the orchestrator ticks ROADMAP and STATE after verification, so neither was touched.
2. **[Orchestrator-approved] Combined 267 baseline refresh** (above), with MCPV2-03 and MCPV2-08
   flipped in REQUIREMENTS.md in the same commit.
3. **[Orchestrator-approved] Carry list** (above): one comment fix, one fixture kept with a reason,
   the rest filed as follow-ons.
4. **[Rule 1 - honesty] EPV366-21 reopened from `[x]` to `[ ]`.** The plan named this case; the row's
   claim (the snapshot carries a stamp) is false today.
5. **[Rule 2 - CLAUDE.md, no real names] The deck todo's tester name and personal room path** were
   replaced with "an intern" and "the navigator's team room" while adding the dated note.
6. **[Plan reading] The F7 todo was untracked** (ignored under `.planning/`); it was written to
   `completed/` and force-added, so it is tracked for the first time.

## Known Stubs

None.

## Threat Flags

None. T-366-97: every closed row cites a command run green in this plan. T-366-98:
`data/egress-policy.json` unchanged (no ruling changed a default). T-366-99: the Theo request and the
research entry carry a schema, counts and generic handles only; the one live word quoted ("Bottleneck
Hunt") is from the synthetic scratch room of 366-11.

## Self-Check: PASSED

- FOUND commits (ancestors of HEAD): 0bcdf31cc, 0fedbd1aa, 289371734, 1273ab929, 843b95dd3
- FOUND files: 366-HANDOFF.md, the Theo request todo, the research entry (three byte-identical homes), the closed F7 todo
- No em-dash or en-dash in any file this plan wrote
