---
quick: 260911-iko
phase: quick-260911-iko
plan: 01
type: execute
status: complete
requirements: [IKO-01, IKO-02, IKO-03]
---

# Quick Task 260911-iko Summary: Per-Install Opaque Header (x-theo-install-id)

One-liner: a 32-hex CSPRNG id, minted once per install and spread into both of
`callTool`'s Brain fetch calls via `lib/core/install-id.cjs`, lets Theo bucket
"one install calling twice" apart from "two installs calling once" without
learning who the install belongs to.

## What changed, per task

### Task 1: Mint the opaque id (RED first)

- New `lib/core/install-id.cjs`: `getInstallId` / `peekInstallId` /
  `resetInstallId` / `installIdPath` / `installIdHeaderName`. Mints a 32
  lowercase hex id from `crypto.randomBytes(16)` once per install, stores it
  as `{id, minted_at}` at mode 0600 via atomic temp-then-rename write in
  `MINDRIAN_HOME` else `~/.mindrian`. Never derives from user, machine,
  account, room, path, hostname, or key. Never throws to its caller, never
  writes to stdout (posture copied from `lib/core/brain-prewarm.cjs`).
- New `tests/test-339-install-id-header.cjs` (Task 1: arms 1-12).
- Commit: `03af92f3`.

**RED evidence:** ran `node tests/test-339-install-id-header.cjs` with the
implementation file moved out of the tree first -- failed with
`Error: Cannot find module '.../lib/core/install-id.cjs'` (`MODULE_NOT_FOUND`),
the expected reason.

**GREEN evidence:** after restoring the implementation, all 12 arms passed:
`# tests 12 / # pass 12 / # fail 0`.

### Task 2: Ride the wire, rotate on demand, report presence only

- `lib/core/brain-client.cjs`: new `_installIdHeaders()` helper (mirrors the
  `getApiKey()` per-process memo idiom), spread via `..._installIdHeaders()`
  into exactly the two callTool wire header blocks (`_ensureSession`
  initialize, `tools/call`). Deliberately excluded from the `/register`
  fetch, with an inline comment stating the reason. Wrapped in try/catch so a
  broken install-id module can never take a Brain call down.
- `scripts/doctor.cjs`: `--reset-install-id` sibling flag (parseArgs default,
  case-chain parse, usage text, main() dispatch before the class-flag block
  and before `--acceptance`, same position/shape as `--bind-check`). Prints
  exactly `install id rotated` or the failure line, never the value, always
  exits 0.
- `lib/core/doctor/class-m-brain-smoke.cjs`: L0 gains `install_id_present`
  (boolean only, read via `peekInstallId` so a diagnostic run never mints),
  documented as lettered bullet (d) in the L0 docblock, tagged `T-iko-02`.
  Never changes the verdict.
- `commands/doctor.md` + regenerated `skills/doctor/SKILL.md` and `dist/`
  mirrors: `--reset-install-id` documented (argument-hint + sibling-flag
  bullet), required by `tests/test-doctor-doc-parity.cjs`'s flag-parity gate.
- Appended arms 13-16 to `tests/test-339-install-id-header.cjs`.
- Commit: `ca5331bb`.

**RED evidence:** before the wire/doctor/L0 edits, ran the appended arms:
arm 13 failed (`expected: 'string', actual: 'undefined'` for the recorded
request header), arm 15 failed (doctor printed the full no-drift report
instead of `install id rotated`, since `--reset-install-id` was unrecognized),
arm 16 failed (`expected: 'boolean', actual: 'undefined'` for
`payload.install_id_present`). Arm 14 (the absence path) passed trivially
both before and after, since no header existed anywhere yet -- noted, not a
concern, since arm 14 asserts an absence.

**GREEN evidence:** after implementing, all 16 arms passed:
`# tests 16 / # pass 16 / # fail 0`. Also verified:
`node tests/test-doctor-doc-parity.cjs` -- FAILED, but on a pre-existing,
unrelated `--none` token match in the `interactive_first_reward` frontmatter
prose (confirmed to reproduce byte-identically on `e6aef0a0` before this task
touched the file; see Deviations below).
`node lib/core/doctor/class-m-brain-smoke.test.cjs` -- PASSED 22/22.
`node scripts/build-skill-mirrors.cjs --check && node scripts/build-dist-bundles.cjs --check-stale`
-- both OK.
Wire-sites scan (`grep` for `..._installIdHeaders()` count) -- exactly 2.

### Task 3: Record the contract, register the harness, prove it live

- New `docs/THEO-INSTALL-ID.md`: the one plugin-side record of the contract,
  all 9 sections (what/wire contract/where it lives/where it rides/rotation/
  Canon Part 8 argument in full/bucket-key-never-entitlement/Tri-Polar/
  changing this).
- `commands/doctor.md`: `--reset-install-id` bullet cross-linked to the new
  doc; mirrors regenerated.
- `CHANGELOG.md`: entry added under the current top heading,
  `## [Unreleased] -- v2.0.0-beta.36 (in progress)` (no new heading created,
  no renumbering).
- `tests/run-all-339.sh`: registered `lib/core/install-id.cjs`,
  `scripts/doctor.cjs`, `commands/doctor.md`, `docs/THEO-INSTALL-ID.md` in
  `EMDASH_TARGETS`.
- `tests/test-127-03-canon-part-8-adversarial.sh`: confirmed GREEN as
  predicted at planning time (its fixed 6-file scan list does not include
  `lib/core/install-id.cjs`, and `class-m-brain-smoke.cjs`'s new boolean
  field name matches none of its forbidden patterns). No edit needed, no
  allowlist entry added.
- Live loopback wire proof written to the session scratchpad (not the repo),
  a local `http.createServer` on `127.0.0.1:0`.
- Commit: `4ef6e583`.

## Verification commands, exit codes, PASS/FAIL counts

Run in the constraint's order, on a tree confirmed clean of any concurrent
release ceremony (`git log` / `git status` checked read-only first: HEAD was
`e6aef0a0` at start, no ceremony in flight):

| Command | Exit | Result |
|---|---|---|
| `bash tests/run-all-339.sh` | 1 | `PASS=15 FAIL=1 SKIP=0` -- the one failure is `test-339-update-path-single-source.cjs`, a **pre-existing red leg named in this task's constraints**; confirmed to reproduce byte-identically on `e6aef0a0` (verified via `git stash`) before this task touched any file. |
| `node scripts/doctor.cjs --acceptance` | 1 -> 0 | First run (before Task 3's own files were committed): 19/20, the sole failure `verify-release-clean-tree` naming 7 dirty tracked files (this task's own uncommitted Task 3 changes) -- environment-attributable per the plan's own instruction. Re-run after the Task 3 commit landed: **20/20 points passed.** |
| `bash tests/test-127-03-canon-part-8-adversarial.sh` | 0 | `CANON PART 8 ADVERSARIAL AUDIT: PASS (delegation property holds across 6 Phase 127 sources)`. No pattern touched, no allowlist entry needed -- the plan's GREEN prediction held. |
| `node tests/test-339-theo-ask-e2e-live.cjs` | 0 | `Phase 339 (quick/260910-hni) live e2e smoke: PASS` -- live Theo, PASSED not SKIPPED. |
| `node "$SCRATCHPAD/loopback-header-proof.cjs"` | 0 | `x-theo-install-id on 2/2 requests` -- the observed header NAME, ridden on every request `callTool` made against the local loopback listener. Value never printed. |
| `node tests/test-339-install-id-header.cjs` | 0 | `# tests 16 / # pass 16 / # fail 0` |
| `node tests/test-doctor-doc-parity.cjs` | 1 | Pre-existing, unrelated failure (see Deviations) |
| `node lib/core/doctor/class-m-brain-smoke.test.cjs` | 0 | `PASSED: 22 / FAILED: 0` |
| `node scripts/build-skill-mirrors.cjs --check` | 0 | OK, 112 mirrors match |
| `node scripts/build-dist-bundles.cjs --check-stale` | 0 | `stale=false` |
| EMDASH_TARGETS registration grep | 0 | `emdash targets registered` |
| contract-doc-linked grep | 0 | `contract doc linked` |

The loopback proof's observed header name: **`x-theo-install-id`**, on
**2/2** recorded requests (the session initialize plus the tools/call), value
never printed by the proof script.

## Deviations

### Pre-existing red legs (not caused by this task)

1. **`tests/test-339-update-path-single-source.cjs`** fails inside
   `run-all-339.sh` -- confirmed by `git stash` to fail byte-identically at
   the exact same assertion (`expected: [], actual: [...]`) on this task's
   own commit `ca5331bb` with all Task 3 changes stashed out, which is
   functionally equivalent to `e6aef0a0` for this file (Task 1/2 never
   touched it). Named explicitly in this task's constraint list as a known
   pre-existing red leg. Not fixed (out of scope).
2. **`tests/test-doctor-doc-parity.cjs`** reports one violation: flag
   `--none` is "documented" in `commands/doctor.md` but not parsed by
   `doctor.cjs`. This is a false-positive match against the pre-existing
   frontmatter line `interactive_first_reward: "--none (diagnostic
   surface)"`, which predates this task and was not touched by any of its
   three commits. Confirmed to reproduce byte-identically on `e6aef0a0`
   using an isolated copy of the four files the test reads (`commands/
   doctor.md`, `scripts/doctor.cjs`, `data/doctor-modules.json`,
   `tests/test-doctor-doc-parity.cjs`, all pinned to `e6aef0a0`). Not fixed
   (out of scope; not in this task's `files_modified` list to begin with,
   and the `--none` token sits in prose this task never edited).

No other deviations. The plan's contract clauses (D-01 through D-08) were
followed exactly: header name, value shape, mint-once/state-dir/file-shape/
mode, never-derived list, both header blocks only (never `/register`),
rotation via reinstall or `--reset-install-id`, one contract doc, and the
Canon Part 8 / Tri-Polar statements reproduced in `docs/THEO-INSTALL-ID.md`.

## Commit hashes

| Task | Commit | Message |
|---|---|---|
| 1 | `03af92f3` | feat(quick-260911-iko): mint the opaque per-install id (RED first) |
| 2 | `ca5331bb` | feat(quick-260911-iko): ride the wire, rotate on demand, report presence only |
| 3 | `4ef6e583` | docs(quick-260911-iko): record the contract, register the harness, prove it live |

## CHANGELOG heading

The entry landed under `## [Unreleased] -- v2.0.0-beta.36 (in progress)` --
the top-most heading in the file at execution time. No new heading was
created and no version was renumbered.

## Files touched

- `lib/core/install-id.cjs` (new)
- `tests/test-339-install-id-header.cjs` (new)
- `lib/core/brain-client.cjs`
- `scripts/doctor.cjs`
- `lib/core/doctor/class-m-brain-smoke.cjs`
- `commands/doctor.md`
- `skills/doctor/SKILL.md` (generated)
- `dist/generic-claude-dir/.claude/skills/doctor/SKILL.md` (generated)
- `dist/zed/.agents/skills/doctor/SKILL.md` (generated)
- `dist/BUNDLE-VERSION.json` (generated)
- `docs/THEO-INSTALL-ID.md` (new)
- `CHANGELOG.md`
- `tests/run-all-339.sh`

`hooks/hooks.json`, the alias tables, `lib/core/part8-egress-guard.cjs`, and
`lib/core/directive-envelope.cjs` were not touched, as required.

## Self-Check

- `test -f lib/core/install-id.cjs` -- FOUND
- `test -f tests/test-339-install-id-header.cjs` -- FOUND
- `test -f docs/THEO-INSTALL-ID.md` -- FOUND
- `git log --oneline --all | grep -q 03af92f3` -- FOUND
- `git log --oneline --all | grep -q ca5331bb` -- FOUND
- `git log --oneline --all | grep -q 4ef6e583` -- FOUND

## Self-Check: PASSED
