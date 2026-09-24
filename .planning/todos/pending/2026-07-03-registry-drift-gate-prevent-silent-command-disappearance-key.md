---
created: 2026-07-03T08:25:01.818Z
title: Registry-drift gate - prevent silent command disappearance keyed to F-shape
area: tooling
files:
  - scripts/check-shape-declaration.cjs
  - scripts/release.sh
  - data/connector-registry.json
  - data/command-registry.json
  - data/help-groups.json
  - tests/test-connector-exhaustive-coverage.cjs
---

## Problem

2026-07-03: navigator believed the entire rs-family of commands (`/mos:rs-fetch`, `/mos:rs-thesis`, `/mos:rs-explain`, `/mos:rs-experts`) had been silently lost in the v1.15.2 update. Verified this was a false alarm - all 4 were fully intact: files present in `commands/`, wired in `data/connector-registry.json` with `connects_to_spine: true`, listed in `data/help-groups.json` in the right order, zero deletions in git history. The scare was almost certainly a terminal line-wrap artifact in a pasted help listing (the first two lines were missing their `/rs` prefix).

Even though this specific alarm was false, the underlying worry is legitimate: there is currently no STRUCTURAL guarantee that a command present in one release stays present (or gets an explicit deprecation entry) in the next. The pieces to build this ARE already in place:

- `scripts/check-shape-declaration.cjs` already enumerates every command's declared HITL shape (`hitl_shape`, e.g. F.0-F.9) from disk via `fs.readdirSync` - never hardcoded (the RETRO-07c pattern) - and this is now an advisory lint signal as of Phase 210 (WARN on every violation, `--strict` for hard-fail).
- `tests/test-connector-exhaustive-coverage.cjs` already asserts the full live surface set (currently 126 declared + 5 skill-exempt) is either wired to the connector spine or explicitly allowlisted as out-of-spine, with zero silently-unclassified surfaces.

What's MISSING is a release-time DIFF: comparing the current enumerated `{command, hitl_shape, connects_to_spine}` triple set against the PRIOR release's snapshot, and failing loudly (or at minimum WARNing prominently) if any command present in the prior snapshot has vanished from the current one without an explicit deprecation entry recording why.

## Solution

TBD, sketch:

1. On every `scripts/release.sh` run, snapshot the enumerated `{command, hitl_shape, connects_to_spine}` triple for every live surface into a committed JSON, e.g. `data/command-registry-snapshot-v{version}.json` (one snapshot per released version, or just keep the latest + diff against it before overwriting).
2. Add a new release gate step: diff the current enumeration against the most recent prior snapshot. Any command present before and absent now, without a matching entry in a `data/deprecated-commands.json` ledger (command, version removed, reason, replacement if any), fails the release gate (or WARNs loudly if we want this advisory-first like the Phase 210 shape-declaration gate).
3. Surface the diff result in the release changelog automatically ("N commands added, N removed (all deprecated with reason), N F-shape changes this release") so drift is visible in the human-facing release notes, not just a passing/failing gate.
4. Consider whether this belongs in `node scripts/doctor.cjs --acceptance` too, so a local dev session (not just the release pipeline) can catch drift before it ships.

Propose as the next phase after Phase 210 ships (Phase 210 is mid-execution as of this todo's creation - do not start this until 210's release lands, to avoid scope-creeping an already-locked, already-verified phase).

## Phase 355 ruling (D-26, 2026-09-25)

`scripts/check-registry-drift.cjs` compares only the `command` key in
`data/command-registry.json` (`/mos:scout` at `:1854`, `/mos:whitespace` at
`:2267`); neither MCP tool name is in it, so an MCP-side rename would pass
this gate green and break Desktop/Cowork silently. Phase 355 (Hidden in
Plain Sight, the naming-honesty plan 355-05) did NOT rename any MCP tool:
it shipped description fixes plus a fixture test only
(`tests/test-355-naming-honesty.cjs`), confirming no shipped command,
skill, agent or hook calls the old `whitespace_scan` name. The gate this
todo proposes (a release-time diff of the `{command, hitl_shape,
connects_to_spine}` triple set) still does not cover MCP tool names, so
this todo's underlying gap is unchanged by Phase 355. Ruling, carried
forward for any future MCP tool rename: if an MCP tool name is ever
renamed, the rename MUST ship a deprecated alias (the old name still
resolves, with a deprecation notice) because nothing structural in this
repo would otherwise catch the break. `355-CONTEXT.md` D-26 is the source
of this ruling; `.planning/REQUIREMENTS.md` HIPS-03's Measured line cites
it.
