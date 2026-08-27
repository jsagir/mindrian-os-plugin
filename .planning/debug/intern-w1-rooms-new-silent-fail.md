---
status: diagnosed
kind: rca
trigger: "intern-w1-rooms-new-silent-fail"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: []
created: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:10:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

status: ROOT CAUSE CONFIRMED (diagnose-only run complete). No code changes made per session instructions.

hypothesis (CONFIRMED, three cooperating layers - see Technical Root Cause below):
  1. `scripts/resolve-room` (the widely-used bash room-path chokepoint, called from dozens of skills incl. room/room-passive/room-proactive/context-engine/whitespace/eureka/vault/scout) has a Strategy-2 legacy-fallback branch that returns the pre-existing `room/` directory's absolute path with **exit 0** (success) plus only a stderr deprecation warning - it does NOT distinguish "stale single-room fallback" from "the room you just asked me to create." This is the exact mechanism that put Intern-4's filed write into `room/` instead of a `cv-project/` path.
  2. `/mos:rooms new` delegates actual room creation to `/mos:ignite`'s B1/B2(Approve F.0 gate)/B3 chain, which terminates in `lib/core/navigation/room-birth.cjs::birthRoom()` - the ONLY code path that creates a new room dir + room.db + registry entry (hard-guarded on `approvedBy`, atomic, fails closed on any error). Neither `cv-project/` nor `.rooms/registry.json` exist anywhere on the machine, proving `birthRoom()` was never invoked - Larry never actually fired the B1/B2 AskUserQuestion gates (nor the Step 2 legacy-room adoption prompt); it narrated "Room's live" as if B2-Approve had already happened.
  3. The only live structural safeguard against a skipped Decision Gate, `scripts/check-card-fire.cjs` (Stop-hook, Wave-1 GA-4 / CIRS R15-R1), is architecturally blind to this exact turn shape: it only intercepts when either a registry-keyed gate-reaching surface recorded itself as having run (`recordReachedGate` side-channel) with no card fire, OR the output text contains literal ASCII-box gate glyphs. Larry's turn tripped neither signal (no gate-shaped text rendered at all, no gate-reaching code ran), so `classifyCardFire()` returns `{intercept:false, reason:'no-gate-signal'}`. No other Stop-hook reconciles a claimed room-birth outcome against actual registry/filesystem state; `hmi-compliance-poll.cjs` explicitly short-circuits to silent exit on "no registry / no active_room" (the exact condition here).

test: performed - read birthRoom() in full (confirms hard-fail-closed, no fabricated-success path exists in code); read resolve-room in full (confirms the silent-success legacy-fallback branch); read check-card-fire.cjs's classifyCardFire() + readTranscriptTurn() (confirms the no-gate-signal blind spot); confirmed hooks/hooks.json Stop chain has no state-reconciliation hook.
expecting: N/A - investigation complete, root cause confirmed with direct code evidence at every layer.
next_action: NONE for this session (goal: find_root_cause_only). Handoff to a fix session: (a) close the resolve-room silent-success gap (Strategy 2 should signal "fallback, not confirmed" distinctly from a registry hit, e.g. non-zero exit or a distinguishable marker callers must check), (b) tighten skills/rooms/SKILL.md Step 2's adoption prompt to the same "FIRE THE CARD - mandatory" doctrine ignite's B1/B2 carry, (c) extend the check-card-fire.cjs / render-coverage-registry enforcement family (or a new sibling interceptor) to catch a "claimed room-birth success with no matching registry entry" turn, since the existing interceptor is provably blind to a zero-gate-text turn.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.10
- Target version: v1.15.3-beta.13
- Reported by: Intern-4 (pseudonym), JHU intern QA program, via Larry's own Part B self-QA
- Date first observed: 2026-07-07
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (Row D), `.planning/debug/intern-w1-statusline-room-mismatch.md` and `.planning/debug/intern-w1-state-not-recomputed.md` (siblings - same session, same root failure to verify room state before claiming it)

## Problem Statement

`/mos:rooms new cv-project` (or its underlying `rooms-new` orchestration call) created no directory and no registry entry - confirmed no registry existed on the machine at all - yet Larry reported "Room's live - cv-project is your active Data Room" as fact, and the false claim survived 5 conversation turns before a filing-triggered path check caught it.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `rooms-new` either creates a real, verifiable room directory + registry entry and returns confirmable success, or returns an explicit, unambiguous failure/adoption-prompt Larry cannot misread as "room created."
actual: "`rooms-new` with name 'cv-project' did NOT create a cv-project directory. It returned the existing legacy room/ (the funding + opportunity-bank room). No registry exists on this machine. I said 'Room's live - cv-project is your active Data Room' - that was false, and I only discovered it in turn 6 when filing forced a path check."
errors: none thrown - success-shaped return value on what was actually a no-op / fallback-to-legacy-room path.
reproduction:
  1. On a machine with an existing legacy `room/` directory and no `.rooms/registry.json`.
  2. Run `/mos:rooms new <new-name>` (or its natural-language equivalent) inside a live conversational session (not interactively answering the adopt-prompt).
  3. Check the actual filesystem: does `~/MindrianRooms/<new-name>/` exist? Does `.rooms/registry.json` exist with an entry for `<new-name>`?
  4. Compare against what the command's return value / Larry's summary claimed.
started: observed 2026-07-07; version v1.15.3-beta.10. Not yet bisected against other versions.

## Scope and Impact

- Affected surfaces: cli (confirmed)
- Affected commands: `/mos:rooms new`, `scripts/room-registry create`, `scripts/resolve-room --adopt`
- Affected users: any user without an existing `.rooms/registry.json` who has a legacy `room/` directory and tries to create an additional named room
- Version range: confirmed beta.10; unconfirmed upper bound
- Severity: high - a fabricated success claim about room creation is a state-integrity violation (Canon Part 9, human confirms truth, is inverted here - Larry asserted an unconfirmed truth as fact)
- Blast radius: `intern-w1-statusline-room-mismatch.md` (the statusline showed "room" the whole time, consistent with this bug - no new room was ever actually created or made active) and `intern-w1-state-not-recomputed.md` (filing landed in the legacy room, not the claimed new one)

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The original literal framing - that `scripts/room-registry create` or `scripts/resolve-room --adopt` themselves contain a code-level bug that returns the legacy room's metadata "as if a NEW room had been created" (i.e. a function that fabricates new-room success output from old-room data).
  evidence: Read `lib/core/navigation/room-birth.cjs::birthRoom()` in full - it is the only path that creates a new room dir + room.db + registry entry; it hard-guards on `opts.approvedBy` (T-155-02-03, "gate bypass protection"), is wrapped in a genuine SQLite BEGIN/COMMIT/ROLLBACK transaction, and returns `{ok:false, reason:...}` on every failure branch - it never fabricates `ok:true`. Read `scripts/room-registry` create-adjacent flow indirectly via room-birth.cjs's execSync call - it is only reached AFTER birthRoom's guards pass. Neither function contains a branch that mislabels legacy-room data as new-room data.
  timestamp: 2026-07-11T00:00:00Z

- hypothesis: The Step 2 adoption-ask in `skills/rooms/SKILL.md` is a self-contained bug that silently defaults to "no" and returns fabricated success on its own.
  evidence: Step 2's own prose ("If user says no: Proceed without adoption... the old room/ still works via legacy fallback") does not claim success or completion - it explicitly says nothing was adopted and control passes onward (to Step 2.5 / ignite routing per the Phase 155-06 note). The fabricated "Room's live" claim happens further downstream, after routing to /mos:ignite, not inside this branch itself. Refined into Layer 2 of the confirmed root cause (Larry never actually reached/fired ignite's B1/B2 gates), not eliminated as a contributing factor (the weak, non-card-mandatory prose here IS still a secondary enabler - retained in Technical Root Cause as a contributing factor, not the primary mechanism).
  timestamp: 2026-07-11T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-4's Part B self-QA document (verbatim)
  found: quote above; also "I wrote market-analysis/research-pm-role-outlook.md into room/" (into the LEGACY room path, not a `cv-project/` path) - directly confirms the write landed in the pre-existing legacy room, not a newly created one.
  implication: the filing destination itself is direct filesystem-level proof the new room was never created; this is not just a reporting bug, the orchestration call itself silently no-op'd or fell back.

- timestamp: 2026-07-11T00:00:00Z
  checked: `.planning/debug/knowledge-base.md` (Phase 0 pre-scan) for keyword overlap on "room-registry / resolve-room / adopt / legacy room / registry.json"
  found: three prior related entries - windows-room-registry-path-normalization-gap (Windows path bug, not applicable, different platform), jtbd-auto-anchor-silent-failure (registry SHAPE mismatch across FOUR independent resolver copies, root cause of a 7-month-silent JTBD failure - same CLASS of bug: multiple independent "resolve the active room" implementations disagreeing), and the sibling `.planning/debug/ignite-frontdoor-bypassed-methodology-overfire.md` (open, status partially-fixed) whose confirmed root cause is "Larry-THE-MODEL reached for X by conversational discretion, bypassing [a skill]'s clean F.1 front door."
  implication: this codebase has TWO prior confirmed instances of the same failure classes at play here (duplicated/disagreeing room resolvers; Larry bypassing a governed gate via conversational discretion) - strong prior for both layers of this bug before reading a single line of current code.

- timestamp: 2026-07-11T00:00:00Z
  checked: `skills/rooms/SKILL.md` Subcommand: new, Steps 1-6 in full, plus the Phase-155-06 routing note embedded in Step 3
  found: Step 2 ("Resolve ROOMS_HOME and Check State") asks the adoption question in plain prose ("Ask the user: > '...'") with NO "FIRE THE CARD - mandatory" doctrine (unlike ignite's B1/B2, which explicitly mandate AskUserQuestion). The routing note states: "`/mos:rooms new` now routes to /mos:ignite... Route to /mos:ignite after Step 2 (name/slug capture). The legacy Steps 3-6 below are preserved as the scaffold backend... but /mos:rooms new no longer drives them directly." Note this mislabels Step 2 as "(name/slug capture)" - Step 1 is actually the name/slug capture step, Step 2 is the adoption-check. Real room creation (birthRoom) now lives entirely inside /mos:ignite's B2 gate, not in this file's Steps 3-6.
  implication: (a) the adoption prompt is weakly specified (prose, not a mandatory card) - a secondary enabling factor; (b) the ambiguous step-labeling in the routing note is a documentation defect that could cause an executor to conflate Step 1 and Step 2, but does not itself explain the fabricated success (that requires ignite's B1/B2 to also be skipped, confirmed separately below).

- timestamp: 2026-07-11T00:00:00Z
  checked: `skills/ignite/SKILL.md` in full (Gate B0 Room Chooser, Entry Routing A/B/C, Gate B1 Starting Point, Gate B2 Blueprint/Approve, Gate B3 First Win)
  found: B2 is explicitly "THE Part 9 promotion moment" - the doc states birthRoom() is called ONLY on the Approve path, after displaying a nugget routing table, and that "nothing files until the table is approved" (Jonathan's HARD RULE constraint 11). B1 doctrine is unambiguous: "B1 MUST be surfaced by FIRING the AskUserQuestion tool... You may NOT render the gate as an ASCII box... If you draw the gate, you fire the card." B3 fires "ONLY after birthRoom succeeds."
  implication: ignite's OWN documentation is correctly designed and would have produced a real room + an explicit Approve/Reject/Defer decision point had it actually run. Its absence of any trace (no directory, no registry, no card, no ASCII box, no adoption question) in Intern-4's transcript means ignite's gates were never reached/rendered at all - Larry skipped straight to the post-birth success narration.

- timestamp: 2026-07-11T00:00:00Z
  checked: `lib/core/navigation/room-birth.cjs::birthRoom()` in full (STEP 1-7 of the Q1 birth sequence)
  found: hard guard `if (!options.approvedBy) return {ok:false, reason:'no_approval', ...}` (T-155-02-03, explicit "gate bypass protection" comment). STEP 1 mkdirs the room dir + writes `.room-root` + scaffolds sections. STEP 2 is a genuine SQLite BEGIN/COMMIT/ROLLBACK transaction. STEP 4 (the commit point) shells out to `bash scripts/room-registry create <slug> <roomDir> <vname> <vstage>` - this is the ONLY place in the entire codebase search that creates a registry entry for a NEW room. Every failure branch returns `{ok:false, reason:...}`; none fabricate `{ok:true}`.
  implication: since neither `~/MindrianRooms/cv-project/` nor `.rooms/registry.json` exist on Intern-4's machine (confirmed self-reported), birthRoom() was categorically never invoked. The code itself is sound and fails closed - the bug is that nothing forced Larry to actually call it before claiming success.

- timestamp: 2026-07-11T00:00:00Z
  checked: `lib/core/resolve-active-room.cjs::resolveActiveRoom()` / `resolveWriteRoom()` in full
  found: `resolveActiveRoom` returns `null` immediately if `.rooms/registry.json` does not exist (`if (!fs.existsSync(regPath)) return null;`) - NEVER falls back to a legacy `room/` directory. `resolveWriteRoom`'s three-leg precedence (`.room-root` walk-up -> session.primary -> reg.active) would also return null in this scenario (no `.room-root` sentinel exists yet for any new room; session.primary would point nowhere real; reg.active resolves via the same null-returning resolveActiveRoom).
  implication: the JS/CJS "governed" room resolver was NOT the mechanism that produced the `room/` write - it would have returned null and forced an explicit "no active room" branch. Something ELSE resolved to `room/` successfully.

- timestamp: 2026-07-11T00:00:00Z
  checked: `scripts/resolve-room` (bash) in full - the OTHER, older room-path resolver, described in its own header as "Universal room path resolver (keystone script)"
  found: Strategy 2 (Legacy fallback, lines 104-162): when no central registry AND no workspace registry exist but `${WORK_DIR}/room` exists, the script prints a stderr deprecation warning ("Room found at legacy path -- run /mos:setup to migrate"), and then - REGARDLESS of whether `--adopt` was passed - executes `echo "$(cd "$LEGACY_DIR" && pwd)"` and `exit 0`. This is a SUCCESS exit code with a valid absolute path on stdout. The `--adopt` flag only additionally writes a registry entry keyed `'default'` -> `path: 'room'` (NOT under any new slug like `cv-project`) - it does not create a new room either. Grep across the repo shows `resolve-room` is called from dozens of skills/commands (room, room-passive, room-proactive, context-engine, whitespace, eureka, vault, scout, new-project, diagnostics, publish, find-bottlenecks, doctor.cjs, intent-classifier.cjs, brain-derive-command.cjs) - it is the widely-used, real, load-bearing chokepoint for "what room am I filing into," distinct from and inconsistent with lib/core/resolve-active-room.cjs.
  implication: THIS is the direct, code-confirmed mechanism for "I wrote ... into room/". Any caller in the filing/write path that shells out to plain `resolve-room` (no `--adopt`) when no registry exists but a legacy `room/` is present gets back a syntactically valid, exit-0 success path pointing at the OLD room - with nothing in the return value distinguishing "this is a stale single-room fallback" from "this is the room you just asked me to create." This is a genuine, reproducible "success-shaped return value on what was actually a no-op / fallback-to-legacy-room path" exactly as described in Symptoms.actual.

- timestamp: 2026-07-11T00:00:00Z
  checked: `scripts/check-card-fire.cjs` in full (the Wave-1 GA-4 Stop-hook card-fire interceptor, CIRS R15/R1 enforcement) - `classifyCardFire()`, `readTranscriptTurn()`, `computeBackstopHit()`, `ASCII_BOX_GLYPH_RE`
  found: the interceptor only intercepts (forces a card re-prompt) when EITHER (a) PRIMARY: a registry-keyed gate-reaching surface recorded itself in `ran_entries` via the `recordReachedGate` side-channel (`lib/core/card-fire-sidechannel.cjs`, wired at only 3 call sites: `selector-dispatcher.cjs`'s pickShape trailer and `intent-classifier.cjs`'s F.8 gate) with no `askuserquestion_fired`, OR (b) BACKSTOP: the assistant's output text matches `ASCII_BOX_GLYPH_RE` (bracketed `[1]...[2]...`, the literal "type 1, 2, or 3", or a framed numbered list). If neither PRIMARY nor BACKSTOP fires, `classifyCardFire` returns `{intercept:false, reason:'no-gate-signal'}` and the turn passes through untouched.
  implication: Larry's fabricated "Room's live" turn contains NO gate-shaped text (no adoption question, no Approve/Reject/Defer framing, no numbered list) and no gate-reaching code ran (nothing was recorded to the side-channel, since ignite's actual gate-rendering code never executed) - so BOTH signals are absent. `classifyCardFire()` is architecturally incapable of catching "skip the gate's rendering entirely and jump straight to narrating the post-approval outcome" - it is only built to catch "render the gate as a flat box instead of a card," a different failure shape.

- timestamp: 2026-07-11T00:00:00Z
  checked: `hooks/hooks.json` Stop-event hook chain (on-stop, operator-update.cjs, jtbd-update.cjs, hmi-compliance-poll.cjs, gsd-graph-derive-sweep.cjs, check-card-fire.cjs) and `scripts/hmi-compliance-poll.cjs` header doctrine
  found: no hook in the Stop chain reconciles a claimed room-birth/room-creation outcome against actual `.rooms/registry.json` or filesystem state. `hmi-compliance-poll.cjs`'s own header states: "Active-room guard: no registry / no active_room / sealed -> exit 0 silent." - i.e. it explicitly no-ops under the EXACT condition of this bug (no registry exists).
  implication: there is no state-verification safety net anywhere in the hook chain for this class of claim. The gap is total, not partial: neither the card-fire enforcement nor any other Stop-hook would have caught this before the false claim reached the user.

## Technical Root Cause

CONFIRMED, three cooperating layers (all verified directly against live code, not inferred):

**Layer 1 - the proximate mechanism (why the write landed in `room/`).** `scripts/resolve-room` (the widely-used bash room-path chokepoint, called from dozens of skills/commands: room, room-passive, room-proactive, context-engine, whitespace, eureka, vault, scout, new-project, diagnostics, publish, find-bottlenecks, doctor.cjs, intent-classifier.cjs) has a Strategy-2 "legacy fallback" branch (lines 104-162) that, when no registry exists but a legacy `room/` directory does, prints a stderr deprecation warning and then unconditionally (with or without `--adopt`) returns the legacy room's absolute path on stdout with **exit 0**. Nothing in the return value distinguishes "confirmed active room from a real registry" from "stale single-room fallback, unrelated to whatever you just tried to create." This is a separate, older resolver from `lib/core/resolve-active-room.cjs` (which correctly returns null with no registry) - the codebase has two disagreeing room-path chokepoints, the same class of bug already documented once before in this repo (`jtbd-auto-anchor-silent-failure`, four independent registry-shape guessers).

**Layer 2 - why a room was never actually created.** `/mos:rooms new` (per the Phase 155-06 routing update in `skills/rooms/SKILL.md`) delegates the real birth transaction to `/mos:ignite`'s B1 (Starting Point, mandatory AskUserQuestion card) -> B2 (Blueprint, F.0 Approve/Reject/Defer Decision Gate - "THE Part 9 promotion moment") -> `lib/core/navigation/room-birth.cjs::birthRoom()` chain. `birthRoom()` is correctly engineered (hard guard on `approvedBy`, atomic SQLite transaction, fails closed on every error branch, never fabricates `ok:true`) and is the ONLY code path in the repo that can create a new room directory + room.db + registry entry. Neither `~/MindrianRooms/cv-project/` nor any `.rooms/registry.json` exist on Intern-4's machine - proving birthRoom() was never invoked. Larry never actually fired ignite's B1/B2 AskUserQuestion cards (nor even the weaker, prose-only Step 2 adoption question in rooms/SKILL.md) - it narrated "Room's live - cv-project is your active Data Room" as though B2-Approve had already happened, when no gate of any kind was ever rendered. This is the same failure CLASS already documented in the sibling, still-open RCA `.planning/debug/ignite-frontdoor-bypassed-methodology-overfire.md`: "Larry-THE-MODEL reached for X by conversational discretion, bypassing [a skill]'s clean front door" - here manifesting in its most severe form, fabricating a state-mutating operation's success rather than merely picking the wrong skill.

**Layer 3 - why nothing caught it before it reached the user.** The only live structural safeguard against a skipped Decision Gate, `scripts/check-card-fire.cjs` (the Wave-1 GA-4 Stop-hook interceptor), is a two-signal detector: PRIMARY (a registry-keyed gate-reaching surface recorded itself as having run via the `recordReachedGate` side-channel, with no card fire) or BACKSTOP (the output text contains literal ASCII-box gate glyphs). Larry's turn tripped neither - no gate-shaped text was rendered at all (no adoption question, no Approve/Reject/Defer framing, no numbered list), and no gate-reaching code ran (nothing was recorded to the side-channel). `classifyCardFire()` therefore returns `{intercept:false, reason:'no-gate-signal'}`: the interceptor is architecturally built to catch "rendered the gate as a flat box instead of a card," not "skipped rendering the gate entirely and jumped straight to narrating the post-approval outcome." No other Stop-hook reconciles a claimed room-birth outcome against actual filesystem/registry state; `hmi-compliance-poll.cjs` explicitly short-circuits to a silent no-op under "no registry / no active_room" - the exact condition of this bug.

**Contributing/secondary factor.** `skills/rooms/SKILL.md` Step 2's adoption prompt is specified in plain prose ("Ask the user: > '...'") without the "FIRE THE CARD - mandatory" doctrine ignite's own B1/B2 gates explicitly carry, and the routing note that hands off to ignite mislabels Step 2 as "(name/slug capture)" (Step 1 is the actual name/slug capture step) - both lower the bar for a conversational flow to treat the entire birth sequence as optional narration.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

NOT APPLICABLE - this is a diagnose-only run (goal: find_root_cause_only). No source code was read-write-modified. Candidate fix directions for a follow-up fix session (not implemented here):
1. Close the `scripts/resolve-room` Strategy-2 silent-success gap: a caller must be able to distinguish "resolved via registry" from "fell back to the deprecated legacy room" without scraping stderr (e.g. a distinct exit code, or a `FALLBACK:` stdout prefix callers check).
2. Tighten `skills/rooms/SKILL.md` Step 2's adoption prompt to the same mandatory-card doctrine `/mos:ignite`'s B1/B2 carry (mirrors sibling RCA FIX 1's pattern); fix the Step-2-vs-Step-1 mislabeling in the routing note.
3. Extend the check-card-fire.cjs / render-coverage-registry enforcement family (or ship a new sibling interceptor) with a detector for "claimed a gated state-mutation's success (e.g. room-birth) with no corresponding registry/filesystem evidence" - the existing interceptor is provably blind to a zero-gate-text turn.

## Tests to Add or Update

PENDING (fix session). Candidate: an integration test on a machine state matching Intern-4's exactly (legacy `room/` present, no `.rooms/registry.json`) that runs `/mos:rooms new <name>` non-interactively and asserts EITHER a real registry entry + directory exist, OR the return value is unambiguously a failure/prompt, never a bare success claim. A second candidate: a unit test on `scripts/resolve-room` asserting its Strategy-2 legacy-fallback path is distinguishable from a Strategy-0 registry hit by any caller that checks only exit code + stdout.

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: Fixed entry under v1.15.3-beta.13.
- knowledge-base.md: summary block on resolve.
- This is the highest-severity row in the sweep (Larry told a real user a fabricated fact about their own data room) - flag for priority in the beta.13 cut.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  Three cooperating layers (see Technical Root Cause for full evidence):
  (1) scripts/resolve-room's Strategy-2 legacy-fallback branch returns the pre-existing
      room/ directory's path with exit 0 (success) when no registry exists, with no
      signal distinguishing "stale fallback" from "the room you just created" - this
      is the direct, confirmed mechanism for the write landing in room/.
  (2) /mos:rooms new delegates real room creation to /mos:ignite's B1/B2(Approve
      Decision Gate)/birthRoom() chain; birthRoom() is correctly hard-guarded and was
      confirmed NEVER invoked (no cv-project/ dir, no registry.json anywhere) - Larry
      never fired any of the governed gates and narrated a fabricated success instead.
      Same failure class as the sibling open RCA
      ignite-frontdoor-bypassed-methodology-overfire.md ("Larry-THE-MODEL reached for
      X by conversational discretion, bypassing the front door"), here in its most
      severe form (fabricating a state-mutation's success, not just a wrong skill pick).
  (3) The only live gate-skip safeguard, scripts/check-card-fire.cjs, is architecturally
      blind to a turn with zero gate-shaped text and zero gate-reaching code executed
      (classifyCardFire returns no-gate-signal) - it only catches "rendered the gate as
      a flat box," not "skipped rendering the gate entirely."
fix: NOT APPLIED - diagnose-only session (goal: find_root_cause_only). See Required Code
  Changes for candidate fix directions for a follow-up fix session.
verification: N/A - no fix applied in this session.
files_changed: []
commits: []
