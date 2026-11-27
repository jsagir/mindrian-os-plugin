---
phase: 405
round: 3 (narrow: 3.2/3.2a/slice 2a, 3.3, 3.5/4b, 3.7a/slice 9, 3.10/slice 10, section 9)
target: 405-DESIGN.md r3
reviewers:
  implementation_readiness: completed (4 Blocker, 11 Major, 7 Nit) - 405-GOLDFISH-R3-implementation-readiness.md
  codebase_details: completed (4 Blocker, 13 Major, 15 Nit) - 405-GOLDFISH-R3-codebase-details.md
raw_counts: {blocker: 8, major: 24, nit: 22}
merged_counts: {blocker: 6, major: 21}
outcomes: {FIXED: 26, CUT: 0, CONTESTED: 0, OWNER: 1}
owner_items_new: 2 (O9, O10)
owner_rulings_applied: [OR-10]
result: 405-DESIGN.md r4 (readiness) then r4.1 (codebase details); r4 kept as 405-DESIGN-r4.md
clean_round: false
next: narrow round 4 on the sections r4 and r4.1 changed
---

# 405 Goldfish round 3: resolution

Merges given by the coordinator: CD3-B2 = IR3-B1, CD3-B3 = IR3-B2, CD3-B4 = IR3-M3, CD3-M12 = IR3-M4, CD3-M13 = IR3-M5.

## Blockers

| Id | Source ids | Finding | Outcome | Where in r4.1 |
|---|---|---|---|---|
| R3B1 | IR3-B1, CD3-B2 | `resolve-room --adopt` never writes the central registry | FIXED | 3.2a: new `room-registry register <slug> <abs path>` (no scaffold, no activation, unlike `create` :502-511); slug rule; six typed refusals; leak guard first; AC2.6 includes the IR3-B1 case |
| R3B2 | IR3-B2, CD3-B3 | pending: crashed vs live undefined | FIXED | 3.3: owner_pid, owner_host_hash, created_at; stale = dead pid on this host (ownerProcessAlive, resolve-active-room.cjs:220) or older than 120 s; takeover in BEGIN IMMEDIATE; AC3.8 |
| R3B3 | IR3-B3 | verify-release check would abort Step 2 and redden doctor | FIXED | slice 9: separate `verify-release --mcpb <file>` after Step 6.8b and at 9.8; default verify-release unchanged |
| R3B4 | IR3-B4 | payload too big; limits vague; no size If B | FIXED | 3.7a: next, react, react-dom removed (AC5a.10 plus the AC5a.3 scan); numeric gates; SP7 size leg B to the owner |
| R3B5 | CD3-B1 | rule inside classify breaks census C4, C5, HEAL-02 and the 367 spawn | FIXED | 3.2: check in resolveMcpWriteRoom after classify; no room.db term; AC2.1c |
| R3B6 | CD3-B4, IR3-M3 | no `gh release create`; upload fails; Step 9.x failure mode; link | FIXED | AC9.4: view or create (`--verify-tag`, `--prerelease` for betas), upload versioned and stable names, warn never abort, tag URL printed by the doctor |

## Majors

| Id | Source ids | Finding | Outcome | Where in r4.1 |
|---|---|---|---|---|
| R3M1 | IR3-M1 | material set not literal; minters missing | FIXED | 3.5 literal predicate and minter list; AC4.1 one row per minter |
| R3M2 | IR3-M2 | payload hash form | FIXED | 3.3 canonical sorted-key JSON minus client_write_id, room, _meta; AC3.7 |
| R3M4 | IR3-M4, CD3-M12 | RULE 5: new place or release artifact | OWNER | O10; design default: release artifact checked by `verify-release --mcpb` (UI shell precedent, RELEASE-CEREMONY-RULING-SYSTEM.md:52); release-process.md stops restating a count |
| R3M5 | IR3-M5, CD3-M13 | three matchers and their pinned tests | FIXED | 3.10 item 4: new literal (checked with node), the three places, six pinned files; AC10.2 |
| R3M6 | IR3-M6 | slice 10 modifies a 5a file | FIXED | new lib/core/doctor/theo-context-module.cjs |
| R3M7 | IR3-M7 | slice 10 not in the release | FIXED | slice 10 builds before 9; 9 depends on 1 to 10 as built or dropped |
| R3M8 | IR3-M8 | run-all names wrong; skip passes PA-1 | FIXED | section 9: real files, run-all-369.1.sh, suites step, a missing pinned neighbour FAILs |
| R3M9 | IR3-M9 | ACs with no test | FIXED | tests/test-405-instructions-bind.cjs, test-405-release-steps.cjs, test-405-fixture-helper-scan.cjs; map updated |
| R3M10 | IR3-M10 | app card AC and names | FIXED | 3.5 target route (store, binding key, view) and AC4b.4 |
| R3M11 | IR3-M11 | sqlite-vec method GUESS | FIXED | 3.7a: package names and 0.1.9 from the shrinkwrap (:1629-1702), fetch by those entries with integrity, degrade via `cjs-fallback` |
| R3M12 | CD3-M1 | rule scope wider than OR-5 on the CLI | FIXED (narrow default) | 3.2 scope: boot-fallback, operator pins, every source on hookless places; AC2.1b; wider CLI scope is O9 |
| R3M13 | CD3-M4 | graph_write already idempotent | FIXED | 3.3: natural key (edges.cjs:1104-1116); write_keys for artifact_file only |
| R3M14 | CD3-M2 | registry reader | FIXED | new export listRegisteredRoomPaths over registryRoomPath; archived and parked count; test-248 unchanged |
| R3M15 | CD3-M6 | claim_write key scope on P4 | FIXED | receipt `key_scope: session`; R18; SP2 leg |
| R3M16 | CD3-M7 | predicate runs after early returns | FIXED | 3.5: isMaterialLive before :1724 (roomCreation, recovery, Eureka opt-in, material_step); isMaterialSubject after the db open |
| R3M17 | CD3-M8 | nonce only on gate_render | FIXED | 3.5: mint at the shared mint; every minting tool returns it; AC4b.4 |
| R3M18 | CD3-M9 | existing decision app card | FIXED | 3.5: extend gate-app.cjs and decision.html; gate.cjs:1630 order; card_pending treats app_nonce as proof |
| R3M19 | CD3-M10 | dependency self-heal in the extension | FIXED | 3.7a: no install with the marker; `extension_payload_incomplete`; `mcpb-deps.json`; AC5a.4 |
| R3M20 | CD3-M11 | rollback misses dist | FIXED | `mos_rollback_mcpb`; dist/ in .gitignore; step-hash fixtures re-based |
| R3M21 | CD3-M3 | fixture count and helper reuse | FIXED | 3.2: 117 files, six helpers first, reuse birthFixtureRoom, find writers by running, real file names |
| R3M22 | CD3-M5 | step 3 is not one transaction; artifact_id drift | FIXED | 3.3: one BEGIN IMMEDIATE over the row writes and done; writers check isTransaction; artifact_id stored in pending; index after done |

## Nits

| Id | Outcome |
|---|---|
| IR3-N1, CD3-M2 | FIXED (listRegisteredRoomPaths) |
| IR3-N2, CD3-N3 | FIXED (migration module named, in `_schemaStamp` specs) |
| IR3-N3 | FIXED (connect text copied into 3.10) |
| IR3-N4 | FIXED (dist/ in .gitignore) |
| IR3-N5 | FIXED (slice 9 builds what the spikes left; AC9.8) |
| IR3-N6 | FIXED (two npm ci runs named) |
| IR3-N7 | FIXED (gate.cjs:238-255 eligibility) |
| CD3-N1 | FIXED (refusal carries dir and slug, unlike classify's) |
| CD3-N2 | FIXED (destination() already fences the rooms home) |
| CD3-N4 | FIXED (canonical hash; 30-day retention) |
| CD3-N5 | FIXED (gate.cjs:657-718) |
| CD3-N6 | FIXED (relative path; fingerprint wording) |
| CD3-N7 | FIXED (`app_nonce` value) |
| CD3-N8 | FIXED (OR-4 interim exception stated) |
| CD3-N9 | FIXED (sqlite-vec-windows-x64; shrinkwrap entries; cjs-fallback) |
| CD3-N10 | FIXED (command and args; UNVERIFIED against spec) |
| CD3-N11 | FIXED (measure in 5a) |
| CD3-N12 | FIXED (host stated; public repo GUESS) |
| CD3-N13 | FIXED (reuse brain-client initialize) |
| CD3-N14 | FIXED (theo-tool-classes review in slice 10) |
| CD3-N15 | FIXED (CLI remote connection named; two tests stay green) |

## Owner ruling applied

OR-10 (O8): 3.11 ordered schema floor, `mos_meta.writer_version_max`, refusal `room_schema_newer` with the update line, reads allowed, hooks skip without failing; AC3.9.

## Owner items

| Id | Question | Recommended |
|---|---|---|
| O9 | Should the "registered rooms only" write rule also cover the CLI and the local Code tab for every room source (a bound room, a folder with .room-root, a workspace-registry room), not only pins and the Desktop chat? | Not now. Keep the narrow scope OR-5 locked; revisit after slice 2a shows how many CLI rooms are unregistered. |
| O10 | Is the `.mcpb` extension a new lockstep place in the release rules (RULE 5), or a release artifact that verify-release checks, like the UI shell assets? | A release artifact checked by `verify-release --mcpb`, like the UI shell assets; no new place. |
