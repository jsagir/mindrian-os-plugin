---
status: investigating        # gathering | investigating | fixing | resolved
kind: rca                    # rca | debug-session | qa-sweep
trigger: "doctor-fix-class-b-unwired"
issue_id: ""
severity: medium             # blocker | high | medium | low
surfaces: [cli]              # cli | desktop | cowork
brain_mode: local-only       # full-loop | local-only | tier-0
canon_parts: [6, 7]          # dog-fooding (doctor honors its own contract), reuse-before-build
created: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ 2ba3df792578148d8e68fbe8dca9f87cb269c976 (dev workspace /home/jsagi/dev/MindrianOS-Plugin), before quick task 260711-nrd landed the renderer fix. Line anchors verified in the working tree at that base.
- **WIRE claims probe against:** none. This is a pure source-contract finding (a doc claim vs code presence); no deployed server, no Brain wire, no network probe.
- **Date of audit:** 2026-07-11
- **Re-verification rule:** the class B unwired claim below was verified by direct source inspection (grep for `flags.fix && flags.cascadeRooms` returns no match; the `if (flags.cascadeRooms)` block at scripts/doctor.cjs:4963-4968 is check-only; data/doctor-modules.json registers only the umbilical module). Any future actor re-verifies against `origin/main` HEAD before acting.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: commands/doctor.md line 71 advertises `--fix` for "class A, B, E, G", but class B (cascade-rooms) has no `--fix` dispatch anywhere in scripts/doctor.cjs. The doc contract is stale relative to the code.
test: grep scripts/doctor.cjs for a `flags.fix && flags.cascadeRooms` branch or a cascade-rooms recovery function; inspect data/doctor-modules.json for a cascade-rooms module.
expecting: no fix branch, no recovery function, and no registered module - confirming class B `--fix` silently no-ops today.
next_action: navigator decides between wiring a class B recovery (write `.room-root` sentinel + re-check) OR amending the doctor.md claim. This finding does NOT implement either; it is scoped out of quick task 260711-nrd.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.x (working tree @ 2ba3df79)
- Reported by: quick task 260711-nrd renderer investigation (2026-07-11)
- Date first observed: 2026-07-11
- Related debug sessions: none. Sibling to the class E renderer gap fixed in quick task 260711-nrd (that was a rendering bug in renderHumanReport; this is a missing dispatch, a different bug class).

## Problem Statement

commands/doctor.md advertises `--fix` support for class B (cascade-rooms), but scripts/doctor.cjs has no class B recovery dispatch, so `/mos:doctor --fix` (or `--fix --all`) silently no-ops for cascade-rooms drift.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: per commands/doctor.md line 71, `/mos:doctor --fix` auto-recovers "any class that supports --fix (class A, B, E, G)", so a `--fix --all` run against rooms missing their `.room-root` sentinel should write the sentinels and re-check class B to green.
actual: `--fix` never touches cascade-rooms. The cascade-rooms check re-runs read-only and still reports `warn` (for example `15 room(s) missing .room-root sentinel`); no sentinel is written, no recovery entry is pushed into report.recovered for class B.
errors: none - there is no error, which is the problem. The fix is a silent no-op: no branch runs, nothing is logged, exit behavior is identical to a non-fix run.
reproduction:
  1. Have registered rooms that are missing their `.room-root` sentinel (cascade-rooms check reports `warn`).
  2. Run `node scripts/doctor.cjs --fix --all`.
  3. Observe: cascade-rooms still `warn`; no `.room-root` files were created; no class B line in the recovered output.
started: class B `--fix` was never wired. data/doctor-modules.json was SEEDED EMPTY at Phase 139 with only the umbilical module; the 15 remaining SCOUT-2 organs (cascade-rooms among the check family) were an explicit `out_of_scope LOCKED` decision to backfill in v1.13.1+. The doctor.md line 71 claim predates and overstates that seeded-empty reality.

## Scope and Impact

- Affected surfaces: cli (doctor is a CLI/script surface; Desktop and Cowork invoke the same script, so the no-op is identical there by construction).
- Affected commands: `/mos:doctor --fix` and `/mos:doctor --fix --all` for the class B (cascade-rooms) remediation specifically. Class A, E, G `--fix` paths are unaffected by this finding.
- Affected users: any install whose registered rooms are missing `.room-root` sentinels and who trusts the doctor.md `--fix` class-B claim to repair them.
- Version range: since class B check shipped (Phase 95.1 family) through the current working tree @ 2ba3df79. Never wired.
- Blast radius: documentation trust only. No data loss, no wrong writes - the gap is an absence of behavior, not incorrect behavior. Adjacent classes (A/E/G) are independently wired and unaffected.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: class B `--fix` is wired but its outcome was invisible (the same bug class as class E's renderer gap).
  evidence: grep for `flags.fix && flags.cascadeRooms` returns zero matches; the `if (flags.cascadeRooms)` block at scripts/doctor.cjs:4963-4968 contains only checkCascadeRoomsSentinel() and checkCascadeRoomsActive() calls, no recovery. There is no cascade-rooms recovery function to be invisible. This is a MISSING dispatch, not an unrendered outcome.
  timestamp: 2026-07-11T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: commands/doctor.md line 71
  found: `- /mos:doctor --fix -> diagnostic + auto-recovery for any class that supports --fix (class A, B, E, G)`
  implication: the doc contract claims class B is a `--fix`-supported class.

- timestamp: 2026-07-11T00:00:00Z
  checked: scripts/doctor.cjs grep for `flags.fix && flags.cascadeRooms` and for a cascade-rooms recovery function
  found: zero matches for the fix branch; the only cascadeRooms code is the check-only block at lines 4963-4968; no performCascadeRoomsRecovery-style function exists.
  implication: class B has no `--fix` dispatch. `--fix` for cascade-rooms silently no-ops.

- timestamp: 2026-07-11T00:00:00Z
  checked: data/doctor-modules.json modules array
  found: a single registered module, `umbilical` (introduced_version 1.13.1-beta.4). The `$schema_note` states the file was SEEDED EMPTY and the 15 remaining SCOUT-2 organs are an `out_of_scope LOCKED` backfill for v1.13.1+.
  implication: no cascade-rooms module is registered in the accumulative engine either, so neither the legacy dispatch nor the module engine offers a class B `--fix`.

- timestamp: 2026-07-11T00:00:00Z
  checked: scripts/doctor.cjs:5022 (class E dispatch) as a contrast
  found: class E IS wired - `if (flags.fix && flags.roomMd)` calls performRoomMdRecovery(report.checks['room-md']) at line 5022, and performRoomMdRecovery is defined at line 1055-1086. `--all` sets flags.roomMd.
  implication: class E is a working template for what a class B recovery would look like (write the missing artifact, re-check, push a recovered entry). Class E's own INVISIBILITY (the recovered entry never rendered in plain text) was the renderer bug fixed in quick task 260711-nrd; that fix is unrelated to this class B missing-dispatch finding.

## Technical Root Cause

- Site: scripts/doctor.cjs:4963-4968 function `runDiagnostics` (the flag-dispatch region); the ABSENCE of a `flags.fix && flags.cascadeRooms` branch anywhere in the file.
- Cause: class B (cascade-rooms) was shipped check-only. No recovery function was ever authored (no performCascadeRoomsRecovery), no `flags.fix && flags.cascadeRooms` dispatch was ever added, and data/doctor-modules.json never registered a cascade-rooms module. Meanwhile commands/doctor.md line 71 was written to advertise "class A, B, E, G" - the "B" was aspirational and never matched the code.
- Why it surfaces now: the 2026-07-11 renderer investigation (quick task 260711-nrd) made warn-status checks visible for the first time. With cascade-rooms warnings now printing a line, the natural next user action is `--fix`, which exposes that class B `--fix` does nothing. The visibility fix surfaced the pre-existing doc-vs-code gap.

## Required Code Changes
<!-- Explicit, imperative, one block per change. This finding is DOCUMENT-ONLY;
     these are the two candidate resolutions for the navigator, NOT changes made
     by quick task 260711-nrd. -->

- Option 1 (wire class B recovery):
  - Location: scripts/doctor.cjs, add a `flags.fix && flags.cascadeRooms` branch adjacent to the class E dispatch at line 5022; add a performCascadeRoomsRecovery(checkResult) function mirroring performRoomMdRecovery (lines 1055-1086).
  - Current behavior: cascade-rooms is check-only; `--fix` no-ops.
  - Required behavior: for each room missing a `.room-root` sentinel, write the sentinel idempotently, re-run checkCascadeRoomsSentinel(), and push a recovered entry (tool + status + detail) into report.recovered.
  - Long-term fix: register a cascade-rooms module in data/doctor-modules.json so the accumulative engine owns it (matches the "new organ = one entry" discipline), rather than a hand-wired branch.
  - Substantive-behavior warning: writing `.room-root` sentinels into 15 registered rooms mutates real room state. This needs its own design (idempotency rules, dry-run, active-room safety) and its own tests. It is deliberately OUT of scope for the renderer-only quick task.

- Option 2 (amend the doc claim):
  - Location: commands/doctor.md line 71.
  - Current behavior: advertises `--fix` for "class A, B, E, G".
  - Required behavior: drop "B" (and audit "G" while there) so the doc contract matches the wired classes, until a class B recovery is deliberately built.
  - Long-term fix: none needed beyond the doc correction; revisit when Option 1 ships.

## Tests to Add or Update
<!-- Only relevant to whichever option the navigator picks; none added by this task. -->

- If Option 1 (wire recovery):
  - Type: integration
  - Location: a new tests/test-doctor-class-b-fix.cjs (hermetic HOME with registered rooms missing sentinels)
  - Given: rooms missing `.room-root`
  - When: `doctor --fix --cascade-rooms` runs
  - Then: sentinels are written, re-check reports ok, and a class B recovered entry appears in report.recovered (and now renders, thanks to the 260711-nrd renderer fix).
  - Runner registration: register in the relevant tests/run-all-*.sh for the phase that wires it.
- If Option 2 (doc correction):
  - Type: unit
  - Location: extend an existing doctor doc-contract test
  - Given: commands/doctor.md line listing `--fix`-supported classes
  - When: parsed
  - Then: every listed class has a corresponding `flags.fix && flags.<class>` dispatch in scripts/doctor.cjs (a cross-drift guard so the doc can never again claim an unwired class).

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry ONLY when a resolution ships (Option 1 or 2); this finding alone ships no user-visible change.
- Release lockstep: applies only if a resolution ships.
- Canon: touches Canon Part 6 (dog-fooding - doctor must honor its own doc contract) and Part 7 (reuse before build - Option 1 should extend the accumulative-engine module registry rather than hand-wire a one-off). Declare canon_parts in the resolving phase.
- knowledge-base.md: add the summary block on resolve.
- Docs / process: the navigator decides Option 1 vs Option 2. This is a deliberate product decision, not an auto-fix.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: class B (cascade-rooms) `--fix` was never wired in scripts/doctor.cjs (no dispatch branch, no recovery function, no registered module), while commands/doctor.md line 71 advertises class B as `--fix`-supported. Stale doc contract vs code.
fix: PENDING - deliberately deferred. Scoped OUT of quick task 260711-nrd (renderer-only) because writing `.room-root` sentinels into 15 registered rooms is substantive new behavior needing its own design, idempotency rules, and tests. The navigator picks Option 1 (wire recovery) or Option 2 (amend the doc claim).
verification: this finding was produced by source inspection at base 2ba3df79; the class E generator's ACTUAL success against the live active room remains UNVERIFIED because running `--fix --all` mutates room state and was out of scope for the 260711-nrd renderer fix.
files_changed: none by this finding (document-only).
commits: none for a code change; this RCA file is force-added to git per the .planning gitignore rule.

## Classification

NEW FAILURE (stale doc contract vs code presence), scoped OUT of quick task 260711-nrd. Not the same bug as class E: class E `--fix` IS wired (scripts/doctor.cjs:5022); its plain-text INVISIBILITY was the renderer gap closed by 260711-nrd. This finding is the separate class B MISSING-dispatch gap, recorded here to the RCA standard as a navigator follow-up rather than guessed at or hot-patched.
