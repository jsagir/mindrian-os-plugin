---
phase: 240
plan: 06
created: 2026-07-30
updated: 2026-07-30
purpose: >
  The phase-wide residual register. Every finding this phase surfaced and
  deliberately did not fix, with its citation, its observation, its reason
  for staying open, and what closing it would take. This supersedes the
  plan-scoped version of this file that plan 240-02 first created (its two
  items are folded in below as D-240-11 and D-240-12, not lost).
---

# Phase 240 (Memory) - Deferred Items (residual register)

Ten items were named at planning time (D-240-01 through D-240-10). Five more
were found live during execution across plans 240-02 and 240-06 and are
folded in below (D-240-11 through D-240-15) per this file's own floor-not-
ceiling instruction. Every item below has a citation that resolves; four
were independently spot-checked against the file and line during this
plan's own Task 1 and are marked SPOT-CHECKED below.

Cross-link: the durable reasoning trail for this phase lives in the
`rethinking-mindrianos` Data Room at
`~/MindrianRooms/rethinking-mindrianos/research/2026-07-30-phase-240-memory/2026-07-30-phase-240-memory.md`,
alongside the three sibling 2026-07-28 RCAs, per the CLAUDE.md Dev-Research
Compositing mandate. That entry cross-links back here in both directions.

## D-240-01: `tests/test-navigation-chokepoint-hook.cjs` writes into the real `$HOME/.mindrian/telemetry/navigation-bypass.jsonl`

**Citation:** `240-RESEARCH.md` Finding 4 conclusion 4 and Assumption A4. **SPOT-CHECKED:** `tests/test-navigation-chokepoint-hook.cjs:97` defines `test6_runtimeSoftDefenseJsonl`; `:100` and `:128` both build `file = path.join(dir, 'navigation-bypass.jsonl')` where `dir` is `os.homedir()`-derived, and `:114` asserts `fs.existsSync(file)`. Confirmed live on disk exactly as cited.

**Observed:** the test deliberately writes a real line into the developer's own `$HOME/.mindrian/telemetry/navigation-bypass.jsonl` and asserts the line count grew. This is the same defect class MEM-03 closes (a test writing into a live per-user store) but a DIFFERENT store: `.mindrian/telemetry/`, not `.memory/` or `.rooms/`. MEM-03's own wording is "the memory store," and this is outside that literal scope.

**Why not fixed here:** the phase's `files_modified` and every plan's threat model scope MEM-03 to the JTBD/memory stores measured in the Finding 4 census. Widening scope mid-phase to a different store the requirement text does not name is a scope escape this executor is not authorized to make silently (Rule 4 territory, not Rule 1-3).

**What closing it would take:** the same `withTmpRoot`-style hermetic root swap MEM-03 already applied to `tests/test-jtbd-auto-anchor-empirical.sh`, pointed at `$HOME` (or a dedicated `MINDRIAN_TELEMETRY_HOME`-style seam if one is introduced) instead of `MINDRIAN_ROOMS_HOME`. A follow-up quick-task or a future phase, not this one.

## D-240-02: `scripts/memory-resume-nudge.cjs:93` and `:127` each resolve `MINDRIAN_ROOMS_HOME` with their own inline fallback

**Citation:** `240-RESEARCH.md` Runtime State Inventory, secrets row. **SPOT-CHECKED:** live grep confirms both lines read `const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');`, byte-identical at both sites, neither calling the module's own exported `ROOMS_HOME()` from `lib/hmi/across-session-memory.cjs`.

**Observed:** a third independent copy of the same environment-variable resolution logic that `across-session-memory.cjs::ROOMS_HOME()` already centralizes. Not a bug today (both copies compute the same value), but a latent drift site: if `ROOMS_HOME()`'s precedence ever changes (for example to add a config-file fallback), these two inline copies will not follow.

**Why not fixed here:** out of MEM scope. This is a Canon Part 7 (Reuse Before Build) consolidation candidate, not a defect any of the three MEM requirements names.

**What closing it would take:** replace both inline expressions with `require('../lib/hmi/across-session-memory.cjs').ROOMS_HOME()` (or export a standalone `ROOMS_HOME()` helper from a lower-level shared module if the require creates an unwanted dependency direction), plus a regression test pinning that both call sites route through the one function.

## D-240-03: `/mos:jtbd set` still does not promote immediately

**Citation:** `240-RESEARCH.md` Assumption A5 and plan 240-03 Decision R-10. **SPOT-CHECKED:** `grep -n promoteIfEligible scripts/jtbd-command.cjs` returns zero hits (re-run live during this plan). `scripts/jtbd-command.cjs:706` and `:768` both write `trigger: 'manual_set'` into the history row, confirming the manual-set flow exists and completes, but the promotion gate is never called from this file.

**Observed:** `scripts/jtbd-command.cjs` has zero `promoteIfEligible` call sites. A manual `/mos:jtbd set X` writes `current.manual_set = true` (round-tripped correctly since plan 240-03) but produces no Layer 2 `in_flight` row until the NEXT `jtbd-update.cjs` turn or the next SessionStart backfill (`memory-resume-nudge.cjs`) reads that same `current` object and promotes it. SC1 was read, deliberately, as a field-persistence requirement ("persists exactly the fields its own gate later checks"), not an immediacy requirement ("promotes the instant the command runs"). 240-03's round-trip test and 240-04's continuous-promotion test both prove the fields persist correctly; neither claims immediate promotion.

**Why not fixed here:** `/gsd-discuss-phase` never surfaced an explicit user decision that immediate promotion is required, and 240-RESEARCH.md flagged this exact ambiguity as needing a human call before any plan added a new call site. Adding one without that call would be an unauthorized scope expansion of MEM-01.

**What closing it would take:** one new call site in `scripts/jtbd-command.cjs`'s `set` subcommand (`jtbdState.getCurrent(roomDir)` immediately followed by `acrossSession.promoteIfEligible(slug, {current, history})`), plus one integration test proving a single `/mos:jtbd set` call produces an immediate `in_flight` row without waiting for the next turn.

## D-240-04: a `manual_set: true` can outlive its `expires_at` window

**Citation:** plan 240-03 Decision R-09 and threat T-240-16. **SPOT-CHECKED:** `lib/hmi/jtbd-state.cjs`'s manual-block branch (unchanged by this phase) updates an existing `in_flight` row in place rather than appending a duplicate; the next auto transition (once `expires_at` has passed) overwrites `manual_set` back to `false` on the new `current`.

**Observed:** between the moment `expires_at` passes and the moment the NEXT classifier-driven transition actually occurs, `current.manual_set` still reads `true` even though the manual window has technically expired. This is bounded, not unbounded: the field self-corrects on the next real transition, and `manualOverrideActive(current)` (the predicate production already uses to decide `kind: 'override'` vs `kind: 'set'`) independently checks `expires_at` against `Date.now()`, so any code path that calls the predicate rather than reading the raw flag is already correct.

**Why not fixed here:** deliberately NOT ANDing `manualOverrideActive` into the Layer 2 promotion gate. Doing so reddens `tests/test-jtbd-transition-graph-wiring.cjs` test 1 (confirmed at plan-time, re-confirmed live during this plan: `14 passed, 0 failed` with the current gate shape), because that test's manual-promote path exercises the gate BEFORE any expiry check would matter, and ORing the predicate in would not enforce expiry either (ORing only ever widens the gate, never narrows it). The gate's `cur.manual_set === true || cur.trigger === 'manual_set' || cur.trigger === 'manual'` shape is intentionally about "was this transition originally flagged manual," not "is a manual override active right now."

**What closing it would take:** replacing the raw `manual_set` read with a call to `manualOverrideActive(cur)` specifically inside the promotion gate (not the manual-block branch, which is correct as-is), re-running `test-jtbd-transition-graph-wiring.cjs` test 1 to confirm it still passes with the predicate substituted, and adding a new test that seeds an expired `manual_set: true` and confirms the gate now falls through to the turn-count floor. Not attempted here because SC1 does not ask for it and the risk of reddening an existing green suite outweighs a residual whose actual blast radius is one stale flag that self-corrects on the next transition.

## D-240-05: lock contention and FIFO pressure under a far higher promotion rate

**Citation:** `240-RESEARCH.md` Open Question Q3 and threat T-240-27.

**Observed:** before this phase, promotion effectively never fired (confirmed: two months of real use, zero genuine promotions). After MEM-01, it can fire on most same-topic turns in every open room. Bounded by three independent properties, all confirmed live during this phase's own test runs: the in-place `in_flight` row update (no per-turn append, confirmed by plan 240-04's test3: `history.length === 1` across six turns and `in_flight.length === 1`), the 100-entry per-room cap with archive spillover (`tests/test-across-session-memory.cjs` class 9/10, still 36/36 passing), and `audit.log`'s bound with sample-rate truncation. The observed `audit.log` line count from plan 240-04's own test 4: 4 new lines after 6 turns in one seeded room (one line per turn that actually reached `atomicUpdateMemory`, matching the test's own INFO line: "observed audit.log line count after 6 turns: 4"). Concurrent-Cowork behavior (multiple rooms promoting simultaneously against the same global lockfile) is unmeasured by this phase. `tests/test-across-session-memory.cjs` class 11's multi-process race check is pre-existing, confirmed still passing (`36/36`), and its known-flaky-timing character (documented in the test's own header before this phase) is unrelated to MEM-01's fix.

**Why not fixed here:** none of the three MEM requirements names a load or concurrency budget, and 240-RESEARCH.md explicitly recommended NOT inventing a new number without evidence. No real-world data exists yet on the actual promotion rate under the fixed trigger.

**What closing it would take:** instrumenting the real lockfile's contention rate over a real multi-week deployment (not a synthetic test), then deciding whether to add a "fire only when `turn_count` CROSSES the threshold" debounce (240-RESEARCH.md's own suggested mitigation, which would cut write volume to roughly one per topic rather than one per turn past the floor). A follow-up phase once real usage data exists, not a speculative fix now.

## D-240-06: the frozen `graph-edge-pending.log` residue

**Citation:** locked decision D-1, `240-RESEARCH.md` Finding 2, and the resolved RCA at `.planning/debug/resolved/graph-edge-pending-undrained-dead-letter-queue.md`.

**RE-MEASURED live during this plan's Task 2 (2026-07-30):** exactly **13 lines**, `wc -l` confirmed. `stat` mtime resolves to `2026-07-28T02:42:14Z` (epoch `1785206534`), byte-for-byte matching the last line's own `ts` field. **Unchanged from 240-RESEARCH.md's recorded value** (also 13 lines, also last-touched 2026-07-28T02:42:14Z). Both slugs present in the file (`test-jtbd-promote`, `test-jtbd-127.3-empirical`) are confirmed absent from the current `.rooms/registry.json`, so `resolveRoomDirForSlug` returns `null` for both and any replay through `logJtbdTransition` would be a structural no-op today, exactly as the resolved RCA concluded.

**Not backfilled, by human-approved decision.** A future plan proposing a drainer for this file is reversing that decision, not extending this phase's work. The decision was made and executed BEFORE this phase started (commit `3c9afa2e`); this phase's only job regarding this file was to confirm it stays frozen, which it did across all five prior plans (240-02 through 240-05 each independently hashed `.memory` before/after their own runs and found it unchanged) and again here in Task 2's final audit.

**What closing it would take:** nothing, by design. If a future navigator decides Option A (a real drainer with a new `HAS_JTBD` edge type and a new JTBD node type) should be reversed into, that is an explicit architectural decision requiring the same human approval the original rejection required, not a residual to "close."

## D-240-07: pre-existing failures this phase must not be blamed for or credited with fixing

**Citation:** `240-RESEARCH.md` Validation Architecture and Sources; each failure independently re-run live during this plan's Task 2 (2026-07-30) to confirm the EXACT current failure names, not copied from an earlier SUMMARY.

1. **`tests/test-memory-command.cjs`: 24/26 passed.** The SAME two failures across every plan in this phase (240-03, 240-04, and re-confirmed here): `FAIL cross-room Mode A: output mentions Brain Patterns block` and `FAIL cross-room Mode A: surfaces Brain hint verb (validate-idea)`. Neither `lib/memory/` Brain-hint rendering nor any file this phase touches is implicated; these are Brain Mode A rendering failures, unrelated to MEM-01/02/03.
2. **`tests/test-hmi-compliance-e2e.cjs`: 10 passed, 1 failed, exit 1.** `FAIL 11 hooks.json byte-identity for Phase 99/100/103 Stop entries`, error message `expected 4 Stop entries, got 6`. `hooks/hooks.json` is confirmed untouched by every commit in this phase (`git diff --stat hooks/hooks.json` empty across all five prior plans and this one).
3. **`tests/test-graph-derivation-verdict.cjs`: `passed:false, checks:14, failed:2`.** The two failures, re-confirmed by name live: `FAIL GDH-09: a healed room is a FULL CITIZEN ... byte-indistinguishable-on-markers from a born room` (detail: "born-like: a FEYNMAN body carries the ## Timeline (auto) section") and `FAIL D-169-11 depth>=2: ... EACH nested level is a FULL CITIZEN` (detail: "jonathan-contractor-motj: a FEYNMAN body carries the ## Timeline (auto) section"). Confirmed pre-existing and unrelated to Phase 240 (Phase 236 Plan 03's own STATE.md entry already recorded these same two FEYNMAN/Timeline assertions failing before Phase 240 started, and no file this phase touches is part of the FEYNMAN-timeline rendering surface).

A future reader can therefore tell an old red from a new one: none of these three failure sets changed shape across any of the six Phase 240 plans.

## D-240-08: the unrelated dirty working tree present at research time

**Citation:** `240-RESEARCH.md` Assumption A6 and plan 240-01 Task 1's own pre-execution capture.

**Observed:** `240-RESEARCH.md`'s Runtime State Inventory (captured against `main`, before any worktree existed for this phase) recorded a non-clean `git status`: `lib/statusline/ctx-window.cjs`, `scripts/context-monitor`, `scripts/statusline-fallback-echo.cjs`, `package-lock.json`, three statusline test files modified, plus several untracked `.planning/debug/*.md` files. Plan 240-01's own Task 1 (the first plan to actually touch this worktree) captured `git status --short` immediately before its first edit and found it EMPTY -- the dirty state was specific to the `main` checkout the research ran against, not to this phase's own execution worktree.

**State now:** confirmed via `git status --short` at the start and end of this closing plan's own Task 2: empty both times (after reverting one incidental `package-lock.json` regeneration caused by running `doctor --acceptance`, see D-240-14 below). None of the statusline files was touched or committed by any Phase 240 commit, confirmed by `git log --oneline --name-only` over every commit in this phase (see the Foreign-Change Audit in `240-06-SUMMARY.md`).

**What closing it would take:** nothing from this phase. The statusline files still need an owner on whatever branch or session originally modified them; not tracked further here since they were never this phase's concern and never entered this phase's worktree.

## D-240-09: `isRoomOptOut` joins `roomSlug` into a path raw in its defensive fallback branch

**Citation:** `240-RESEARCH.md` Security Domain V5 and threat T-240-18. **SPOT-CHECKED:** `lib/hmi/across-session-memory.cjs:241-255`. The function first attempts a registry-matched lookup (`r.path`, joined via `path.join(ROOMS_HOME(), r.path)` at line 249, safe -- driven by a registry value, not the raw slug). ONLY when that lookup fails (no matching registry entry, or the entry has no `path`) does it fall through to line 252's defensive fallback: `roomDir = path.join(ROOMS_HOME(), roomSlug);` -- confirmed byte-identical to `240-RESEARCH.md`'s citation.

**Observed:** this is the one place in the module that joins the caller-supplied `roomSlug` directly into a filesystem path, rather than resolving it through the registry first (the pattern `resolveRoomDirForSlug` uses everywhere else, confirmed at `:339-353`: registry exact-match only, `abs_path` or `path` from the matched entry, never a raw join with the input slug). No traversal is reachable TODAY because every production call site passes a `roomSlug` that already came from the registry or from a trusted internal caller, not from unsanitized external input.

**Why not fixed here:** pre-existing, not introduced by this phase (confirmed: this function and its call site are untouched by every commit in Phase 240). No MEM requirement names input validation on `roomSlug`, and this is a hardening opportunity, not a demonstrated exploit.

**What closing it would take:** removing the fallback branch entirely (treat "no registry match" as "opt-out unknown, default to false" rather than guessing a folder name), or explicitly documenting why the guess is intentional (backward compatibility with rooms created before the registry existed, if that is the actual reason -- not verified this session). A one-line fix plus a regression test asserting a crafted `roomSlug` containing `../` sequences cannot escape `ROOMS_HOME()` even via this fallback branch.

## D-240-10: both mandated MCP grounding legs were unavailable for this phase's research

**Citation:** `240-RESEARCH.md` Environment Availability and Open Question Q1.

**Observed:** `mcp__langtalks-graph-expert__*` and `mcp__*Context7__*` both returned "No such tool available" throughout this phase's research and every plan's execution, including this closing plan. This is the documented upstream tool-stripping bug for agents with a `tools:` frontmatter restriction (`anthropics/claude-code#13898`), the identical condition Phase 236 recorded twice. `ctx7` is not on PATH in this environment (confirmed, not re-installed per the standing prohibition on `npx --yes`).

**Discharged, not papered over:** by file:line reads and live observation throughout every plan in this phase -- for a phase entirely about this repo's own code (no external library API, no third-party framework behavior claim), this is the STRONGER form of evidence, not a fallback of lesser quality. Every load-bearing claim in `240-RESEARCH.md` and every plan's SUMMARY carries a `[VERIFIED: live observation]` or `[VERIFIED: source read]` tag rather than an unfired grounding claim.

**No unasked WebSearch was fired.** Per the standing MCP-stack-awareness HARD RULE (check the stack and ask before web research), `240-RESEARCH.md`'s Open Question Q1 explicitly declined to fire WebSearch unasked and recommended the navigator authorize an external leg if wanted. No such authorization was given during this phase's execution, and none was fired at any point across all six plans, including this one.

## D-240-11: `tests/test-127.3-sibling-sweep.sh` fails, pre-existing, unrelated to Phase 240 (folds in `DI-240-02-01`)

**Citation:** first logged by plan 240-02 as `DI-240-02-01`, reconfirmed unrelated by plan 240-04, reconfirmed a third time live during this plan's Task 2.

**Observed (re-confirmed 2026-07-30):** `bash tests/run-all-127.3.sh` reports `2/3 green`; `test-127.3-sibling-sweep.sh` fails with the same seven call sites every time: `lib/core/resolve-umbilical-target.cjs:192,264,265`, `lib/core/navigation/room-birth.cjs:393,418`, `lib/core/doctor/umbilical-module.cjs:134,343`. This is a structural registry-resolution tripwire (Phase 127.3 Plan 03) that has drifted independently of MEM-03; none of the three flagged files is in any Phase 240 plan's `files_modified` list, and `git status --short` before and after every Phase 240 commit confirms none of the three was ever touched.

**Hermeticity impact: none.** The `.memory`/`.rooms` subtrees (the only paths a MEM-03-class leak could touch) were confirmed byte-identical before and after this exact `run-all-127.3.sh` invocation, every time it was run across all six plans in this phase, including this closing one.

**What closing it would take:** rerouting the 7 flagged call sites through `lib/core/resolve-active-room.cjs`, or adding them to the sibling-sweep's own allow-list per its header note ("Phase-129-deferral allow-list"). Recommended owner: whichever phase or quick-task next touches those three files, or a dedicated Phase 129 follow-up.

## D-240-12: whole-tree `$HOME/MindrianRooms` digest is not a stable measurement in this dev environment (folds in `DI-240-02-02`)

**Citation:** first logged by plan 240-02 as `DI-240-02-02`.

**Observed:** two back-to-back whole-tree recursive digests of the real `$HOME/MindrianRooms` (16,853 files), taken seconds apart with no test suite running, differed by exactly one file: `mindrianOS/STATE.md`, this very GSD session's own live state file, being actively written by the standard GSD state-update flow as plans complete. Not a leak.

**Resolution used throughout this phase:** every hermeticity verification (in plans 240-02 through 240-06) was scoped to the two subtrees where a JTBD-memory leak could actually land, `.memory/` and `.rooms/`, which were confirmed byte-identical before and after every test run in every plan, including the final audit in this closing plan's Task 2. This is a stronger measurement than the whole-tree digest, not a weaker one: it isolates the measurement from known, expected, concurrent GSD session activity rather than either papering over a real difference or falsely alarming on one.

**What closing it would take:** nothing. `tests/test-240-memory-store-hermetic-fence.sh`'s own Leg 2 already uses this exact scoping by design (fingerprints `.memory` and `.rooms` specifically), so this is a documented environmental property, not an open defect.

## D-240-13: `240-RESEARCH.md`'s recorded `audit.log` line count (5) does not match the file's actual, stable content (14 lines)

**Found during:** this plan's Task 2 live-store final audit (2026-07-30).

**Observed:** `240-RESEARCH.md`'s Runtime State Inventory states "`~/MindrianRooms/.memory/audit.log`: 5 `promote` lines, all `roomSlug=test-jtbd-127.3-empirical`, dated 2026-05-31 to 2026-07-28." The file, read directly during this plan's Task 2, actually contains **14 lines**: the first (`2026-05-24T19:12:22.858Z | test-jtbd-promote | promote | decide-pursue`) carries a DIFFERENT slug (`test-jtbd-promote`, matching `graph-edge-pending.log`'s other orphan slug) and an earlier date than the research's stated range; the remaining 13 lines carry `test-jtbd-127.3-empirical` and span 2026-05-24 through 2026-07-28T04:16:13.903Z (the same timestamp, to the millisecond, as `jtbd-history.json`'s own `last_updated` field).

**This is NOT a leak this phase failed to close.** The file's last line is dated 2026-07-28, two days before Phase 240 began execution (2026-07-30), and every one of plans 240-02, 240-03, 240-04, and 240-05 independently hashed the whole `.memory/` directory before and after their own test runs and found it byte-identical every time (see each plan's own SUMMARY.md hermeticity sections). This closing plan's own Task 2 re-confirmed the same content hash before and after its full gate run. The discrepancy is therefore a measurement inaccuracy in `240-RESEARCH.md` itself (the research undercounted or read a filtered subset of the file at research time), not a change introduced by anything this phase did.

**Why not fixed here:** correcting a stale count inside an already-published RESEARCH.md is not one of this plan's named files, and the underlying fact the research was trying to establish (the real store carries test-fixture pollution, not genuine user activity) is unaffected by whether the exact count is 5 or 14.

**What closing it would take:** a one-line correction to `240-RESEARCH.md`'s Runtime State Inventory row if a future reader needs the exact figure; not attempted here, since RESEARCH.md documents are not typically amended post-hoc and the correction is captured here instead.

## D-240-14: `doctor --acceptance` silently regenerates `package-lock.json` as a side effect of its own "Package-lock sync" check

**Found during:** this plan's Task 2 phase-gate execution (2026-07-30).

**Observed:** running `node scripts/doctor.cjs --acceptance` for the first time in this session flipped `verify-release-clean-tree` to FAIL, citing "tracked-file drift: 1 file(s)." `git diff package-lock.json` showed the file's `version` field and `engines.node` field silently updated in place (from stale `1.15.3-beta.11` / `>=22.5.0` to the current `1.15.3-beta.51` / `>=22.16.0`, matching `package.json`), evidently as a side effect of the acceptance suite's own "Package-lock sync (vendored-deps lockstep)" check running an implicit lockfile regeneration.

**Not a Phase 240 change.** `package.json`'s own version and engines fields were already correct (set by an earlier release cut and by Phase 236 GRAPHDB-03 respectively); `package-lock.json` was simply stale relative to them before this session ran the acceptance gate at all. No Phase 240 commit touched either file.

**Action taken:** `git checkout -- package-lock.json` immediately after observing the diff, restoring the pre-gate state. Re-ran `node scripts/doctor.cjs --acceptance`: 15/15 points passed, `git status --short` confirmed empty both before and after. This file was never staged and never entered any Phase 240 commit.

**What closing it would take:** nothing from this phase (the acceptance suite's own behavior is a pre-existing property of `scripts/doctor.cjs`, not a Phase 240 defect). Worth a note to whichever session next runs a clean-tree release gate: expect `package-lock.json` to silently update on first run if it was stale, and re-run the gate a second time before trusting a "clean tree" verdict.

## D-240-15: `240-PATTERNS.md` existed on disk with a delayed commit history

**Citation:** plan 240-03's own SUMMARY.md, which recorded the file as absent from disk and from `git log --all` at 240-03's execution time; commit `c5302427` ("docs(240): add pattern map (was written but never committed)"), which landed the file after 240-03 completed.

**Observed:** the file exists now (34103 bytes, dated after 240-03's commits) and its own header states it was mapped 2026-07-30 with "no CONTEXT.md on disk at mapping time." This is a planning-artifact commit-timing gap (the pattern map was authored during planning but its commit was dropped, then re-landed later in the same session), not a defect in any plan's execution. Every plan's acceptance criteria were independently verified against source and tests regardless of whether `240-PATTERNS.md` was present, per 240-03's own SUMMARY.

**Why not fixed here:** already self-resolved by the time this closing plan ran (the file is present and committed). Recorded for completeness only, per this file's own instruction to capture every finding a prior SUMMARY recorded.

**What closing it would take:** nothing further.

---

## Spot-check record (Task 1 acceptance criterion: at least four citations independently confirmed)

1. **D-240-09** -- `lib/hmi/across-session-memory.cjs:241-255` (`isRoomOptOut`, the raw-join fallback at line 252) -- read directly, byte-identical to the citation.
2. **D-240-01** -- `tests/test-navigation-chokepoint-hook.cjs:97,100,114,128` (`test6_runtimeSoftDefenseJsonl`, the `navigation-bypass.jsonl` write and assertion) -- read directly, byte-identical to the citation.
3. **D-240-02** -- `scripts/memory-resume-nudge.cjs:93,127` (the two inline `MINDRIAN_ROOMS_HOME` fallback expressions) -- read directly via live grep, byte-identical at both sites.
4. **D-240-03** -- `scripts/jtbd-command.cjs` (zero `promoteIfEligible` call sites; `trigger: 'manual_set'` at lines 706 and 768) -- re-confirmed via live grep during this plan, matching the citation exactly.

## Cross-reference

The Dev-Research Compositing room entry for this phase lives at
`~/MindrianRooms/rethinking-mindrianos/research/2026-07-30-phase-240-memory/2026-07-30-phase-240-memory.md`.
That entry's own header carries a reciprocal cross-link back to this file and
to `.planning/phases/240-memory/` in full, satisfying the CLAUDE.md
Dev-Research Compositing mandate's both-directions requirement.
