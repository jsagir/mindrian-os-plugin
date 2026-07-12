---
status: resolved
kind: rca
trigger: "intern-w1-statusline-room-mismatch"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: []
created: 2026-07-11T00:00:00Z
updated: 2026-07-12T00:00:00Z
---

## Post-merge reconciliation note (2026-07-12)

The fix below was authored in worktree-agent-ae62a9f28425ebe74 against
`scripts/doctor.cjs`'s inline `checkInstallIncomplete()` / `performClassHFix()`
/ `checkStatuslineVisibility()` functions. Between that branch's fork point
and this merge, Phase 217 (doctor-cjs-architecture-rethink, merged to main
first) migrated those exact functions out of `scripts/doctor.cjs` into
`lib/core/doctor/install-incomplete-module.cjs` (`check()`/`fix()`) and
`lib/core/doctor/statusline-visibility-module.cjs` (`check()`), each now a
registry-driven `cadence:always` runner. A direct `git merge` of this branch
would have conflicted on deleted code and, even force-resolved, landed the
fix logic in a file no longer on the execution path.

This was NOT a `git merge` of the branch. The same fix logic (byte-identical
in spirit, adapted to the new file layout) was re-implemented directly against
the post-217 module files:

- `lib/core/doctor/install-incomplete-module.cjs`: added the Step 0.5
  topology guard to `_check()` (short-circuits to `status:'ok'` under
  `topology==='marketplace-cache'` with a resolvable active root, before
  Step 1's legacy receipt read) and the matching defense-in-depth guard at
  the top of `fix()`.
- `lib/core/doctor/statusline-visibility-module.cjs`: widened `check()`
  Step 3 to resolve and exec the EFFECTIVE statusline command (user-level
  override if `userSettings.statusLine.command` is a string, else the
  plugin-level `scripts/statusline-mos`), not always the plugin's own file.
- `scripts/check-onboard-statusline.cjs`: `attemptStatuslineSelfHeal()`'s
  outer `spawnSync` timeout raised 4000ms -> `SELF_HEAL_TIMEOUT_MS = 10000`.

`tests/test-doctor-class-h-topology-blind.cjs` was rehomed to exercise the
real end-to-end CLI dispatch (`node scripts/doctor.cjs --statusline-visibility
[--fix] --json`, which routes through the Phase 217 registry into the two
module files above) rather than referencing the deleted `scripts/doctor.cjs`
functions directly -- the JSON shape (`report.checks['install-incomplete']`,
`report.checks['statusline-visibility']`, `report.recovered`) is unchanged
post-217, so the test's assertions carried over unchanged. RED/GREEN-verified
via `git stash` on just the 3 fix files (not mid-merge, so no `MERGE_HEAD`
risk): 3/4 cases failed with the exact pre-fix symptoms before the fix, 4/4
pass after. `tests/test-install-receipt.cjs`'s independent HOME/USERPROFILE
isolation fix cherry-picked unchanged (its `runDoctor()` helper's shape did
not move).

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED for both halves via direct source read (not yet fixed - diagnose-only run).

(a) VISIBILITY GLITCH - root cause is a topology-blind false positive in `scripts/doctor.cjs`
Class H (`checkInstallIncomplete`, Phase 95.6 D-09, added 2026-05-11 commit 20cad3a79) that was
never given the topology-awareness fix Class A/Class I received later (Phase 123 Plan-03,
2026-05-31 / 2026-06-12). On a standard one-command marketplace install (no `install.sh` ever ran,
no `~/.claude/plugins/mindrian-os/` legacy dir, no user-level `statusLine` block - ALL of which are
NORMAL/HEALTHY for this topology), `checkInstallIncomplete()` only recognizes two "healthy"
signals (a completed `.install-receipt.json`, or a user-level `statusLine` block) - neither of
which the marketplace flow ever produces - so it false-positives `status:'warn', recoverable:true`.
When `--fix` runs (the F6 SessionStart self-heal in `scripts/check-onboard-statusline.cjs`, or a
manual/Larry-assisted `/mos:doctor --fix`), `performClassHFix()` WRITES a brand-new
`~/.claude/settings.json.statusLine` override pointing at the HARDCODED LEGACY constant
`INSTALL_DIR` (`scripts/doctor.cjs:55`, `~/.claude/plugins/mindrian-os/scripts/statusline-mos`) -
a path that does not exist on a marketplace-cache-only machine. User-level `settings.json`
overrides plugin-level `settings.json` (documented precedence, header comment in
`scripts/migrate-stale-user-settings.cjs`), so every subsequent statusline render now execs a
nonexistent path; bash's failure goes to a stream never surfaced in the chat transcript, so the
statusline silently goes blank with no visible error - matching "not being displayed... no errors
thrown."
The self-heal's own re-verification cannot detect this self-inflicted breakage: Class G
(`checkStatuslineVisibility`) Step 1's `STALE_STATUSLINE_PATH_REGEX` (line 1353) only matches
version-PINNED marketplace-cache paths (`plugins/cache/.../mos/<version>/`), not the legacy
`INSTALL_DIR` shape Class H just wrote, so it never flags it; Step 3's synthetic self-test execs
the PLUGIN's OWN resolved `scripts/statusline-mos` directly (`pluginRoot`-relative, line 1456),
never the actual effective user-level override Claude Code would run - so it reports 'ok'
regardless of what the user-level override actually says. Both checks land 'ok' post-fix,
`attemptStatuslineSelfHeal()` declares `resolved:true`, writes the onboarding touch-file, and stays
silent - no gate question ever reaches the user. The intern is left to notice the blank statusline
unprompted and ask Larry/Claude Code directly; Claude (general file-edit capability, not bound by
doctor.cjs's blind spot) inspects and manually removes/fixes the bad `~/.claude/settings.json`
entry, restoring the plugin-level `${CLAUDE_PLUGIN_ROOT}` statusLine config - which is why it
"started appearing correctly and remained visible for the rest of the session" once fixed this way.

Secondary, independently-real defect noted (not required to explain this specific report, but
corroborates "the self-heal cannot be trusted" more broadly): `attemptStatuslineSelfHeal()`'s OUTER
`spawnSync` timeout (4000ms, `scripts/check-onboard-statusline.cjs:131`) is smaller than the
WORST-CASE inner budget `doctor.cjs` itself allocates when Class G genuinely needs repair -
`performStatuslineFix()` alone spawns `migrate-stale-user-settings.cjs` with its OWN 5000ms timeout
(`scripts/doctor.cjs:1533`), already exceeding the caller's 4000ms ceiling before counting the two
`checkStatuslineVisibility()` spawns (1500ms each, lines 1475 and the re-check at 5044). Any session
where Class G finds a REAL fixable drift is structurally likely to have its automatic repair killed
mid-flight by the outer timeout, falling back silently to "no-output"/still-drift. This is a
plausible alternate trigger for "asked Claude Code to fix it" in OTHER sessions, but the topology-
blind Class H false-positive above is the more precise match for THIS intern's report (no gate
question was mentioned - the human noticed unprompted, which fits the "self-heal silently declared
success" chain better than the "self-heal surfaced a question" chain).

(b) CONTENT MISMATCH - independently confirmed (without waiting on the sibling file) via
`scripts/context-monitor:663-683` + `lib/core/folder-memory.cjs:514-535`: the statusline's
`roomName` is read from STATE.md's `current_room` field via `getCurrentRoom()` /
`parseCurrentRoomField()`, with a legacy-dir fallback only when that is absent. Per
`intern-w1-rooms-new-silent-fail.md`'s own evidence, `rooms-new cv-project` never created anything
and the write landed in the pre-existing legacy `room/` directory - so STATE.md's `current_room`
field was never updated to "cv-project"; it stayed "room" (the legacy directory's own slug). The
statusline's "room" content was CORRECT the entire time; Larry's "cv-project is your active Data
Room" claim was the fabrication, not a statusline code bug. Row E closes as fully downstream of
`intern-w1-rooms-new-silent-fail.md`, now confirmed via an independent code path (the statusline's
own room-name resolution chain) rather than solely deferring to the sibling investigation.

test: N/A for this run - diagnose-only, root cause confirmed via direct source read against live
`origin`-tracked working tree (Source-of-Truth: files read directly via Read tool, 2026-07-11,
current HEAD at read time), not fixed/verified.
expecting: N/A
next_action: RESOLVED. Fix re-implemented against post-Phase-217 module files (see reconciliation
note above) and merged to main 2026-07-12. Half (b) closed by cross-reference to
`intern-w1-rooms-new-silent-fail.md` - no separate action was taken in this file for it.

reasoning_checkpoint:
  hypothesis: "scripts/doctor.cjs Class H (checkInstallIncomplete/performClassHFix) never received
    the resolveActivePluginRoot()+topology-classification fix that Class A (checkInstallVersion,
    line 527) and Class I (checkInstallState, line 2054) already have, so it false-positives
    'install incomplete' on healthy marketplace-cache-only installs (no legacy
    .install-receipt.json, no user-level statusLine block - both NORMAL for that topology) and its
    --fix path writes a ~/.claude/settings.json statusLine override pointing at the hardcoded
    legacy INSTALL_DIR constant (line 1684), which does not exist on marketplace-cache-only
    machines - silently breaking the statusline because user-level settings override plugin-level
    settings and bash exec failures never surface in the chat transcript."
  confirming_evidence:
    - "Direct read of scripts/doctor.cjs:1587-1674 (checkInstallIncomplete): the only two 'ok'
      paths are (a) a completed .install-receipt.json under legacy INSTALL_DIR, or (b) a
      user-level statusLine block in ~/.claude/settings.json - neither exists on a fresh
      marketplace install, so it always falls through to status:'warn', recoverable:true."
    - "Direct read of scripts/doctor.cjs:1680-1715 (performClassHFix): line 1684 builds the
      statusLine command from the raw INSTALL_DIR constant with zero call to
      resolveActivePluginRoot() or topology check anywhere in the function - contrasted directly
      against checkInstallVersion() (Class A, line 527-543) which calls resolveActivePluginRoot()
      FIRST and short-circuits to 'ok' under topology==='marketplace-cache' before ever touching
      the legacy INSTALL_DIR path."
    - "Direct read of scripts/doctor.cjs:1394-1519 (checkStatuslineVisibility Step 3, line 1456):
      always spawns path.join(pluginRoot, 'scripts', 'statusline-mos') - the PLUGIN's own file -
      never the effective ~/.claude/settings.json statusLine.command a real session would run, so
      the self-heal's own re-verification cannot detect a broken user-level override it just wrote."
    - "Direct read of scripts/check-onboard-statusline.cjs:131 (outer timeout 4000ms) vs
      scripts/doctor.cjs:1533 (inner migrator spawn 5000ms) + two 1500ms statusline-mos spawns in
      the same --fix call chain (Step 3 initial + Step 3 re-check after Class G --fix) - nested
      worst case is 1500+5000+1500=8000ms, already exceeding the 4000ms outer ceiling before any
      process-startup overhead."
  falsification_test: "If checkInstallVersion() (Class A) or checkInstallState() (Class I) also
    false-positived on the identical marketplace-cache-only fixture (no legacy dir, no receipt),
    the hypothesis that ONLY Class H is topology-blind would be wrong - but
    tests/test-doctor-class-a-topology-drift.cjs (Test a.1) and the Class I topology branch
    already assert 'ok'/no-drift on exactly this fixture, so the topology-aware pattern
    demonstrably works elsewhere and Class H's absence of it is the isolated defect."
  fix_rationale: "The fix mirrors the EXACT pattern already proven correct and tested for Class A
    (checkInstallVersion): call resolveActivePluginRoot() first, and when
    topology==='marketplace-cache' with a resolvable active root, report healthy WITHOUT
    consulting the legacy receipt/override signals at all - because those signals only ever apply
    to the legacy install.sh dev-clone flow, not the one-command marketplace flow. This addresses
    the ROOT CAUSE (topology-blindness), not a symptom - it does not just fix Class H's message,
    it prevents the fix from ever writing the broken override in the first place on the
    topology where it's broken, and adds a defense-in-depth guard directly inside the fix
    function too (mirroring the Class A recovery gate's own topology guard) in case the
    function is ever invoked outside the normal --fix dispatch gate. Step 3's widening and the
    timeout reconciliation are secondary, defense-in-depth fixes for the SAME class of blind spot
    (self-heal trusting the wrong artifact / racing its own budget), not required to close the
    primary false-positive but required by the debug file's own fix directions for robustness."
  blind_spots: "Have not verified this fix against a REAL Claude Code session (only hermetic
    fs-fixture tests, matching this repo's existing Class A/H/I test convention - no live
    marketplace install is available in this dev sandbox, though a LIVE informational sanity check
    against this actual dev machine's real marketplace-cache install did confirm both Class G and
    Class H now report 'ok' correctly post-merge). Have not widened
    migrate-stale-user-settings.cjs's STALE_PATH_REGEX to also match the legacy INSTALL_DIR shape
    Class H used to write - confirmed via direct read that it does NOT match today, so a
    Step-3-detected legacy-shaped override would still not be auto-repaired by the existing --fix
    migrator (only DETECTED, which is what fix direction (2) asks for - auto-repair of that
    specific shape is out of scope since fix (1) prevents Class H from ever writing it again).
    Have not touched check-onboard-statusline.cjs beyond the single timeout constant - did not
    convert the self-heal call to async/backgrounded (the debug file offers timeout-raise as the
    alternative, and it is the smaller, more targeted change)."

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.10
- Target version: v1.15.3-beta.13
- Reported by: Intern-4 (pseudonym), JHU intern QA program - BOTH Part A (human) and Part B (Larry self-QA) independently describe this session's statusline
- Date first observed: 2026-07-07
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (Rows E and E2), `.planning/debug/resolved/intern-w1-rooms-new-silent-fail.md` (read FIRST - likely explains the content-mismatch half of this bug)

## Problem Statement

Two statusline problems appear in one session: an early visibility glitch the human noticed and believed was fixed, and a persistent room-name mismatch (statusline said "room", Larry claimed "cv-project") that the human never noticed because the line was visible and looked plausible even while wrong.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: statusline renders consistently from session start, and its content (active room name) matches what Larry tells the user.
actual (visibility, human-reported Part A): "Earlier, it was not being displayed consistently on the screen, but after asking Mindrain (or Claude) to fix the issue, it started appearing correctly and remained visible for the rest of the session."
actual (content mismatch, Larry-reported Part B): "The startup hook reported the active room name as 'room', yet I told the user 'cv-project is your active Data Room.' If the statusline shows the active room, it was reading 'room' the whole time while I claimed 'cv-project.'"
errors: none thrown in either case - a rendering glitch (no error, just absence) and a silent content disagreement (no error, just an unreconciled claim).
reproduction (visibility half):
  1. Start a fresh session and observe whether the statusline renders immediately or requires a user-prompted fix.
reproduction (content half):
  1. See `intern-w1-rooms-new-silent-fail.md` reproduction - run `/mos:rooms new <name>` under the same no-registry condition and check whether the statusline (correctly) still shows the OLD room name while Larry (incorrectly) claims the new one.
started: observed 2026-07-07, v1.15.3-beta.10.

## Scope and Impact

- Affected surfaces: cli (confirmed)
- Affected commands: statusline render hook (visibility half); Larry's own room-name claims vs. the startup hook's reported value (content half, likely a persona/prompt-discipline issue once `intern-w1-rooms-new-silent-fail.md` is confirmed, not a separate code bug)
- Affected users: visibility glitch - unclear how widespread, only 1 report so far; content mismatch - anyone hitting the `rooms-new` silent-fail bug
- Version range: beta.10, unconfirmed upper bound
- Severity: high while unresolved which half is a real code bug vs. a downstream symptom - keep high until `intern-w1-rooms-new-silent-fail.md` narrows it
- Blast radius: user trust in the statusline as a whole - a human who believes a visible statusline is accurate has no way to know its content might still be contradicted by the assistant's own claims

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: statusline output is truthfully "wrong" per Row E (the content-mismatch half is a
  statusline code bug rendering the wrong slug).
  evidence: `scripts/context-monitor:663-683` + `lib/core/folder-memory.cjs:514-535` show `roomName`
  is a faithful read of STATE.md `current_room`; `intern-w1-rooms-new-silent-fail.md`'s evidence
  confirms `current_room` was never updated to "cv-project" because no room was ever created. The
  statusline rendered exactly what state said. Not a statusline bug - reclassified as Larry-persona
  claim-without-verification (Row D/E cluster), tracked in the sibling file.
  timestamp: 2026-07-11T00:00:00Z

- hypothesis: the visibility glitch is caused by `scripts/statusline-mos`'s `PLUGIN_ROOT` resolution
  racing against a not-yet-settled marketplace-cache directory or `installed_plugins.json` write
  immediately post-install (a first-session "install-cache family" race, by analogy to
  `mcp-servers-cache-missing-node-modules`).
  evidence: plausible in principle (the wrapper's two "exit 0, no output" early-exit branches are
  the only way to get a literally-blank render, and re-resolve fresh on every tick with no caching -
  so this class of bug COULD self-heal exactly as described) but NOT directly confirmed against any
  artifact in this repo the way the Class H topology-blind bug was (no code path in
  `lib/core/active-plugin-root.cjs` shows an actual unguarded race window; its marketplace-cache
  fallback scan does not depend on `installed_plugins.json` being fresh). Demoted from primary to a
  secondary, unconfirmed alternative - not disproven, just out-evidenced by the Class H finding,
  which explains BOTH the blank render AND the "self-heal stayed silent, no gate question" shape of
  the report precisely, where the pure-race theory does not explain why the automated self-heal
  never surfaced its own "do you see it?" fallback question.
  timestamp: 2026-07-11T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-4's Part A (human) and Part B (Larry self-QA), same session, cross-referenced
  found: Part A believes the statusline was "fixed and correct" for the back half of the session; Part B shows it was showing "room" (arguably correctly, per the sibling rooms-new bug) the entire time, and Larry never verified his own "cv-project" claim against it.
  implication: the human's belief that the glitch was "fixed" may itself be about the VISIBILITY half only - she had no way to evaluate the CONTENT half, since she does not independently know what the "correct" room name should be. This is not evidence the content bug is fixed; it is evidence the human side cannot detect it at all.

- timestamp: 2026-07-11T01:00:00Z
  checked: `scripts/doctor.cjs` lines 55, 1587-1674 (`checkInstallIncomplete`, Class H) and 1680-1715 (`performClassHFix`) -- pre-Phase-217 line numbers, now moved to `lib/core/doctor/install-incomplete-module.cjs`
  found: `INSTALL_DIR = path.join(PLUGIN_HOME, 'mindrian-os')` is the LEGACY hand-clone constant, explicitly commented "New code MUST use resolveActivePluginRoot() ... instead of this constant" - yet `performClassHFix()` (now `fix()`) uses `INSTALL_DIR` directly with zero topology check anywhere in `checkInstallIncomplete()` (now `check()`/`_check()`). `checkInstallIncomplete()` reports 'ok' ONLY if EITHER a completed `.install-receipt.json` under the legacy `INSTALL_DIR` exists (written only by the old `install.sh` dev-clone flow) OR a user-level `~/.claude/settings.json.statusLine` block exists (also only ever written by that same legacy flow, or by this Class H fix itself). Neither exists on a standard one-command marketplace install - the healthy state for that topology - so it false-positives `status:'warn', recoverable:true`.
  implication: every fresh marketplace-topology install (the documented one-command onboarding path) trips Class H's false positive; `--fix` then writes a new user-level override pointing at a nonexistent legacy path.

- timestamp: 2026-07-11T01:05:00Z
  checked: `scripts/doctor.cjs` `STALE_STATUSLINE_PATH_REGEX`, Class G Steps 1-3 -- pre-Phase-217 line numbers, now moved to `lib/core/doctor/statusline-visibility-module.cjs`
  found: `STALE_STATUSLINE_PATH_REGEX = /plugins[\/\\]cache[\/\\][^\/\\]+[\/\\]mos[\/\\]\d+\.\d+\.\d+[\/\\]/` matches only version-PINNED marketplace-cache paths, never the legacy `INSTALL_DIR` shape (`~/.claude/plugins/mindrian-os/...`) that `performClassHFix()` writes - so Step 1 cannot flag it. Step 3's synthetic execution test spawns `path.join(pluginRoot, 'scripts', 'statusline-mos')` directly (`pluginRoot` = `CLAUDE_PLUGIN_ROOT` or the plugin's own dirname) - it NEVER reads or executes the actual effective `~/.claude/settings.json.statusLine.command` a real Claude Code session would run.
  implication: Class G's re-check after a Class H fix cannot detect that the newly-written user-level override is broken; it structurally always reports the plugin's own file as healthy regardless of what the user-level override says. Both checks land 'ok' post-fix.

- timestamp: 2026-07-11T01:10:00Z
  checked: `scripts/check-onboard-statusline.cjs` (`attemptStatuslineSelfHeal`) and `tests/test-statusline-visibility-self-heal.cjs`
  found: `attemptStatuslineSelfHeal()` treats `gOk && hOk` (both 'ok') as `resolved:true`, writes the onboarding touch-file, and returns `emptyFragment()` - no message surfaces to the user at all on this path. The test file header states explicitly: "The doctor spawn is STUBBED via a fake CLAUDE_PLUGIN_ROOT/scripts/doctor.cjs ... no real broken install required" - that suite never exercises the real `checkInstallIncomplete()`/`performClassHFix()` logic against a real marketplace-cache topology.
  implication: this exact false-positive-then-self-inflicted-breakage chain is structurally invisible to both the automated self-heal's own success criteria AND its test coverage - it would silently fire on every fresh marketplace install and never be caught by CI.

- timestamp: 2026-07-11T01:15:00Z
  checked: `scripts/context-monitor` (room/roomName resolution) and `lib/core/folder-memory.cjs` (`getCurrentRoom`)
  found: `roomName` is sourced from `folderMemory.getCurrentRoom(dir)` which reads STATE.md's `current_room` field via `parseCurrentRoomField()`; only falls back to `path.basename(dir)` when that source is absent. `roomDir` falls back to the legacy `room/` directory only when no registry entry resolves one.
  implication: independent confirmation (a different code path than the sibling file's) that the statusline's "room" content is a faithful, mechanical reflection of STATE.md - not a separately-broken statusline rendering bug. Corroborates `intern-w1-rooms-new-silent-fail.md`'s conclusion that Row E is downstream of the `rooms-new` silent no-op, not a distinct defect.

- timestamp: 2026-07-11T01:20:00Z
  checked: `scripts/check-onboard-statusline.cjs` outer `spawnSync` timeout (4000ms) vs `doctor.cjs`'s `performStatuslineFix` inner spawn timeout (5000ms) and `checkStatuslineVisibility` spawns (1500ms each)
  found: the self-heal's own outer timeout budget (4000ms) is smaller than a SINGLE one of its nested callee's own declared timeouts (5000ms for the migrator spawn alone), before even counting the two 1500ms `statusline-mos` synthetic-test spawns in the same call chain.
  implication: independent of the Class H bug above, any session where Class G genuinely finds a real, fixable drift is structurally likely to have the automatic self-heal killed mid-flight by its own outer timeout - a secondary, real defect that would also produce "self-heal silently fails" behavior, logged for completeness though not the primary match for this specific report.

- timestamp: 2026-07-12T00:00:00Z
  checked: post-merge live sanity check on this dev machine (real marketplace-cache install present) via `node scripts/doctor.cjs --statusline-visibility --json`
  found: both `checks['install-incomplete']` and `checks['statusline-visibility']` report `status:'ok'`, with the install-incomplete detail naming the marketplace-cache topology explicitly.
  implication: the re-implemented fix behaves correctly against a real (not just hermetic-fixture) marketplace-cache install.

## Technical Root Cause

**(a) Visibility glitch - CONFIRMED, topology-blind self-inflicted breakage:**
Class H (`checkInstallIncomplete`, added 2026-05-11) never received the marketplace-cache
topology-awareness fix that Class A/Class I received later (2026-05-31 / 2026-06-12). It
false-positives "install incomplete" on every healthy one-command marketplace install (no
`.install-receipt.json`, no user-level `statusLine` block - both normal for that topology). Its
paired `--fix` action writes a NEW `~/.claude/settings.json` `statusLine` override pointing at the
hardcoded legacy `INSTALL_DIR` constant (`~/.claude/plugins/mindrian-os/scripts/statusline-mos`),
which does not exist on a marketplace-cache-only machine. Since user-level settings override
plugin-level settings, every subsequent statusline render silently fails (bash "no such file",
never surfaced in the chat). Class G's own re-verification cannot catch this: its stale-path regex
doesn't match the legacy-constant shape Class H just wrote, and its synthetic self-test always
execs the plugin's own file directly rather than the actual effective user-level override - so
both checks report 'ok' and the self-heal declares success silently, never prompting the user. The
intern noticed the blank statusline unprompted and asked Claude Code directly, which fixed it by
hand (outside doctor.cjs's blind spot) - explaining both the "no error, just absence" and the
"fixed after asking, stayed fixed" shape of the report. Secondary, independently-real contributing
defect: the self-heal's own outer 4000ms timeout is smaller than its callee's own worst-case nested
spawn budget (measured exactly at 8000ms during the fix pass: 1500+5000+1500).

**(b) Content mismatch - CONFIRMED, not a statusline bug (downstream of a sibling defect):**
The statusline's room-name content is a faithful, mechanical read of STATE.md's `current_room`
field (`scripts/context-monitor` -> `lib/core/folder-memory.cjs::getCurrentRoom`). Per
`intern-w1-rooms-new-silent-fail.md`'s evidence, `rooms-new cv-project` silently no-op'd and never
updated `current_room`, so the statusline correctly kept showing "room" (the legacy directory) the
entire session. Larry's "cv-project is your active Data Room" claim was the fabrication - Row E is
fully downstream of the `rooms-new` silent-fail defect, independently confirmed via the statusline's
own code path rather than solely deferring to the sibling investigation.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

APPLIED (half (a) only - half (b) closes by cross-reference, see Resolution below):

1. DONE - `lib/core/doctor/install-incomplete-module.cjs::_check()` now calls
   `resolveActivePluginRoot()` FIRST (Step 0.5, mirrors Class A's `checkInstallVersion()` in
   `scripts/doctor.cjs`) and short-circuits to `status:'ok'` when `topology === 'marketplace-cache'`
   and the active root has a valid `plugin.json` - before ever consulting the legacy
   receipt/override signals. `fix()` also gained a defense-in-depth topology guard (mirrors the
   Class A recovery gate's own guard) so it refuses to write the broken legacy-path override under
   marketplace-cache topology even if invoked outside the normal `--fix` dispatch gate.
2. DONE - `lib/core/doctor/statusline-visibility-module.cjs::check()` Step 3 now resolves the
   EFFECTIVE command first (the user-level `statusLine.command` if Step 1 found one, else the
   plugin-level `scripts/statusline-mos`) and execs THAT, instead of always testing `pluginRoot`'s
   own file. Missing effective target now reports `status:'warn'` (or `'error'` for a corrupt
   plugin-level file), `recoverable:true` only for the user-level-override shape.
3. DONE - `scripts/check-onboard-statusline.cjs::attemptStatuslineSelfHeal()`'s outer `spawnSync`
   timeout raised from 4000ms to `SELF_HEAL_TIMEOUT_MS = 10000` (named constant), clearing the
   8000ms nested worst-case (1500ms Step-3-initial + 5000ms migrator spawn + 1500ms Step-3-recheck)
   with headroom for child-process startup overhead.

## Tests to Add or Update

DONE:
- `tests/test-doctor-class-h-topology-blind.cjs` (NEW, 4 tests, registered in
  `lib/memory/run-feynman-tests.cjs`): exercises the REAL (not stubbed) end-to-end CLI dispatch
  through the post-217 module files.
  - h.1: marketplace-cache-only topology (no legacy dir, no receipt, no user statusLine) -> class H
    `'ok'`, not `'warn'`. Confirmed RED-before-fix via `git stash` sanity check (failed with the
    exact pre-fix `'warn'`/`recoverable:true` shape), GREEN after.
  - h.2: same fixture + `--fix` -> `~/.claude/settings.json` is never created; no `doctor-class-h`
    recovery entry.
  - h.3: dev-clone topology (MINDRIAN_OS_ROOT pinned, no statusLine block) -> class H still warns,
    recoverable - proves the topology guard does not swallow the legitimate legacy-flow detection.
  - h.4: marketplace-cache-only + a user-level override shaped exactly like Class H's old broken
    write (does not match `STALE_STATUSLINE_PATH_REGEX`) -> `checkStatuslineVisibility()` reports
    `status !== 'ok'`, proving Step 3 now tests the effective command rather than silently passing
    against the plugin's own unrelated (real, existing) file.
- `tests/test-install-receipt.cjs` UPDATED (pre-existing suite, not new): `runDoctor()` now
  isolates `HOME`/`USERPROFILE` to a fresh empty scratch dir. Without this, the new
  `resolveActivePluginRoot()` call in Step 0.5 leaked the REAL developer machine's actual
  marketplace-cache install and short-circuited class H to `'ok'` regardless of the receipt
  fixture under test.
- `tests/test-room-birth.cjs` (35/35), `tests/test-phase-23.sh` (16/16) unaffected/unrelated,
  re-run clean during this merge session as part of the wider regression sweep.

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- DONE - CHANGELOG.md: Fixed entry added under `[Unreleased] -- v1.15.3-beta.13`, updated to
  reference the post-217 module files.
- DONE - knowledge-base.md: summary block appended on resolve.
- Half (b) (content mismatch) is NOT duplicated here - it closes by cross-reference to
  `intern-w1-rooms-new-silent-fail.md`. No separate action was taken in this file for half (b).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  (a) Class H (checkInstallIncomplete/performClassHFix, since Phase 217 moved to
  lib/core/doctor/install-incomplete-module.cjs check()/fix()) is topology-blind: it
  false-positives "install incomplete" on every healthy one-command marketplace install (never
  received the resolveActivePluginRoot()/topology fix Class A+I got), and its --fix action writes a
  ~/.claude/settings.json statusLine override pointing at the hardcoded legacy INSTALL_DIR constant,
  which does not exist on a marketplace-cache-only machine. This override silently breaks the
  statusline (user-level overrides plugin-level; bash exec failure surfaces no chat-visible error).
  Class G's own re-check cannot detect this self-inflicted breakage (regex shape mismatch + Step 3
  tests the plugin's own file, not the effective user-level command), so the self-heal declares
  success and stays silent. Secondary contributing defect: the self-heal's outer 4000ms timeout is
  smaller than its own callee's worst-case nested spawn budget (measured exactly at 8000ms:
  1500+5000+1500).
  (b) Not a statusline bug. The statusline's room-name content is a faithful read of STATE.md
  current_room, independently confirmed via scripts/context-monitor + lib/core/folder-memory.cjs.
  Fully downstream of intern-w1-rooms-new-silent-fail.md (rooms-new silently no-op'd, current_room
  was never updated to "cv-project"). Larry's claim, not the statusline, was wrong. CLOSES BY
  CROSS-REFERENCE - no separate action needed in this file.
fix: |
  (a) APPLIED, re-implemented against the post-Phase-217 module files (see reconciliation note at
  top of this file for why a direct branch merge was not possible):
  1. lib/core/doctor/install-incomplete-module.cjs::_check() - new Step 0.5 topology guard, short-
     circuits to 'ok' under marketplace-cache topology with a resolvable active root, mirroring
     Class A's checkInstallVersion() pattern exactly. fix() gained a matching defense-in-depth
     guard.
  2. lib/core/doctor/statusline-visibility-module.cjs::check() Step 3 - now resolves and execs the
     EFFECTIVE statusline command (user-level override if present, else plugin-level), not always
     the plugin's own file.
  3. scripts/check-onboard-statusline.cjs::attemptStatuslineSelfHeal() - outer timeout raised
     4000ms -> 10000ms (SELF_HEAL_TIMEOUT_MS constant) to clear the 8000ms nested worst case.
  (b) NOT a code fix - closes by cross-reference to intern-w1-rooms-new-silent-fail.md.
verification: |
  - New regression test tests/test-doctor-class-h-topology-blind.cjs (rehomed to test the CLI
    end-to-end through the post-217 modules): 4/4 pass on fixed code; confirmed RED (3/4 failing
    with the exact pre-fix symptoms) against the pre-fix code via `git stash` on just the 3 fix
    files (not mid-merge) - the test genuinely proves the fix, not a tautology.
  - tests/test-install-receipt.cjs required and received the same HOME/USERPROFILE isolation fix;
    3/3 pass.
  - tests/test-room-birth.cjs (35/35) and tests/test-phase-23.sh (16/16) re-run clean (unrelated
    to this fix, part of the same merge session's wider regression sweep).
  - Live sanity check on this actual dev machine (real marketplace-cache install present): both
    Class G and Class H now report 'ok' correctly, install-incomplete detail names the topology.
  - bash scripts/verify-release: CLEAR TO RELEASE.
  - NOT verified: against a live/real Claude Code SessionStart on a fresh marketplace-only install
    outside this dev sandbox (no such environment available here).
files_changed:
  - lib/core/doctor/install-incomplete-module.cjs
  - lib/core/doctor/statusline-visibility-module.cjs
  - scripts/check-onboard-statusline.cjs
  - tests/test-doctor-class-h-topology-blind.cjs (new)
  - tests/test-install-receipt.cjs
  - CHANGELOG.md
  - .planning/debug/knowledge-base.md
commits: []
