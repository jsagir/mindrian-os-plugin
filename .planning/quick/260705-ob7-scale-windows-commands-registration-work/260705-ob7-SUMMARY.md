---
phase: quick-260705-ob7
plan: 01
subsystem: plugin-loading
tags: [skills-migration, windows-defect, cirs, generator, scale]
requires: [commands/*.md, skills/help/SKILL.md (pilot ee2fefac)]
provides: [scripts/build-skill-mirrors.cjs, skills/*/SKILL.md (105 new mirrors)]
affects: [data/connector-registry.json, data/connector-coverage-ledger.json, data/brain-orchestration-projection.json, .gitignore]
tech-stack:
  added: []
  patterns: [skill-mirror-of-command, sensor-triggers-desensitize-on-mirror]
key-files:
  created: [scripts/build-skill-mirrors.cjs, skills/*/SKILL.md (105 files)]
  modified: [data/connector-registry.json, data/connector-coverage-ledger.json, data/brain-orchestration-projection.json, .gitignore]
decisions:
  - "Byte-identical mirror for 45/105 commands; for the 61/105 wired commands with non-empty sensor_triggers, that ONE field is rewritten to sensor_triggers:[] on the mirror to avoid a CONN-03 duplicate-tuple collision -- precedented by the pre-existing skills/trending-to-absurd/SKILL.md, which already ships connects_to_spine:true + sensor_triggers:[] for the identical reason."
  - "commands/trending-to-absurd.md skip-listed (SKIP_LIST) -- skills/trending-to-absurd/SKILL.md already exists as a hand-authored, divergent phase-163 skill; mirroring would have clobbered it. Skill-over-command precedence already serves /mos:trending-to-absurd via that existing skill."
  - "commands/*.md remains the single, untouched source of truth. Generator is read-only against commands/, write-only against skills/."
metrics:
  duration: ~50m (across two dispatch rounds -- first hit the duplicate-tuple gate failure, second implemented the desensitize fix)
  completed: 2026-07-05
  tasks_completed: 3
  tasks_total: 3
  files_created: 106 (1 script + 105 mirrors)
  files_modified: 4
status: complete
---

# Quick Task 260705-ob7: Scale the Windows commands-registration workaround to all 107 commands

Built `scripts/build-skill-mirrors.cjs` and generated 105 new `skills/<name>/SKILL.md` mirrors of `commands/<name>.md` (byte-identical except a single documented, precedented field exception), bringing every `/mos:` command onto the skills/ loading path that already works on the affected Windows machine, without moving or editing a single `commands/*.md` file.

## What Was Done

**Task 1 -- Generator script**
- `scripts/build-skill-mirrors.cjs`: write mode (default) + `--check` mode, following `build-connector-registry.cjs`'s CLI convention (process.argv flag parsing, fs/path only, no new deps).
- `SKIP_LIST = ['trending-to-absurd']` -- the one pre-existing name collision with a hand-authored, divergent skill (phase 163). Skill-over-command precedence already serves that command via the existing skill.

**Task 2 -- Generation + verification (two rounds)**
- First round: naive byte-copy of all 105 non-skip-listed commands. Ran the full gate sweep myself independently (not just trusting the executor) -- `build-connector-registry.cjs --check` failed with ~76 "duplicate connector tuple" errors: every wired command's mirror duplicated its `connector.sensor_triggers` into the registry, since `build-connector-registry.cjs` walks both `commands/*.md` and `skills/*/SKILL.md`.
- Root-caused directly (read `build-connector-registry.cjs`'s `listSourceFiles()`/`validateConnectors()` myself) rather than relying on the executor's terse "awaiting your decision" replies, which never carried the actual detail through the notification channel.
- Fix decided and dispatched: mirrors of `connects_to_spine:true` commands with non-empty `sensor_triggers` get that one field rewritten to `sensor_triggers: []` -- the exact pattern already used by `skills/trending-to-absurd/SKILL.md` for the identical reason. 61/105 mirrors got this treatment; 45/105 (excluded commands or already-empty sensor_triggers) are pure byte copies.
- Verified: byte-identity-with-the-one-documented-exception across all 105 pairs, F-shape (`body_shape`/`hitl_shape`) parity unaffected (different field), `commands/*.md` untouched (confirmed via `git status --porcelain commands/`), idempotent second run.

**Task 3 -- CIRS regeneration, gate sweep, commit**
- Regenerated `data/connector-registry.json`, `data/connector-coverage-ledger.json`, `data/brain-orchestration-projection.json` -- purely additive (`+skill:<name>` surfaces/nodes only).
- Full gate sweep, independently re-run and confirmed clean by the coordinator (not just the executor's self-report):
  - `build-connector-registry.cjs --check` -> `connector-registry: OK`
  - `check-shape-declaration.cjs --check` -> `OK (234 declared, 5 skill-exempt, 239 scanned)`
  - `check-render-coverage.cjs` -> 16 covered / 0 gap; md-keyspace 97 wired / 0 unwired (commands/ untouched)
  - `check-help-coverage.cjs` -> `valid: true`
  - `build-orchestration-projection.cjs --check` -> `orchestration-projection: OK`
  - `build-skill-mirrors.cjs --check` -> `OK (106 mirrors match expected content)`
  - `doctor.cjs --acceptance` -> `14/14 points passed`
- Commit `14f2923d`: generator + 105 mirrors + regenerated data/ artifacts. No version bump, no release.

## Deviations from Plan

**1. [Rule 3 - Blocking] Duplicate connector-registry tuples**
- **Found during:** Task 3 gate sweep (first round, naive byte-copy).
- **Issue:** `build-connector-registry.cjs --check` failed on ~76 duplicate `(sensor, reach_id, sub_mode)` tuples -- every wired command's mirror re-declared the same `sensor_triggers`.
- **Fix:** Desensitize exception (see Decisions above), scoped to exactly the field causing the collision. `scripts/build-skill-mirrors.cjs` documents the exception with its rationale and the `trending-to-absurd` precedent inline.
- **Files modified:** `scripts/build-skill-mirrors.cjs` (generator logic), all 61 affected mirrors regenerated.
- **Process note:** the executor's chat replies to two resumptions were terse placeholders ("awaiting your decision on Option 2", "Done.") that did not carry the actual decision content through the async task-notification channel. The coordinator root-caused the failure directly against the gate script source and dispatched the exact fix rather than relying on the executor to explain itself; all gate results in this summary were independently re-run and confirmed by the coordinator, not taken on the executor's word.

**2. [Rule 3 - Blocking] .gitignore silently dropping 2 mirrors**
- **Found during:** post-commit spot-check (executor).
- **Issue:** Unanchored `.gitignore` patterns `room/` and `export/` (meant for the user's private root-level Data Room workspace) also matched the nested `skills/room/` and `skills/export/` mirror directories, silently excluding them from `git add` with no CIRS gate catching it (every gate checks filesystem presence, not git-tracking status).
- **Fix:** Anchored both patterns to repo root (`/room/`, `/export/`) in a separate commit `ec8a475b`. Verified the real root-level `room/` workspace is still ignored via `git status --ignored`.
- **Files modified:** `.gitignore`, `skills/room/SKILL.md` (new), `skills/export/SKILL.md` (new).

## Known Stubs

None.

## Threat Flags

None. Mechanical mirroring of already-shipped, already-gated command surfaces onto the skills/ loading path; no new network endpoint, auth path, or trust-boundary surface. The desensitize exception narrows an existing field on a copy, it does not add scope.

## Windows Verification (non-blocking per plan, still open)

Not yet done. Recommend a human spot-check of a small sample (e.g. `/mos:ignite`, one wired-connector command, one of the 7 no-name-field commands, plus the still-outstanding pilot check of `/mos:help` itself from quick task 260705-nwr) on the affected Windows machine. This does not block the commit -- skills/ loading on that machine was already independently confirmed before the pilot ever ran, and the pilot proved the mirror mechanic end-to-end for one file.

## Self-Check: PASSED

- FOUND: scripts/build-skill-mirrors.cjs
- FOUND: 105 new skills/*/SKILL.md mirrors (120 total skills/ dirs: 106 command-mirrors + 14 standalone)
- FOUND: skills/trending-to-absurd/SKILL.md unchanged (git status clean)
- FOUND: commands/ unchanged (git status clean, 107 files, zero diff)
- FOUND commits: 14f2923d (mirrors), ec8a475b (.gitignore fix)
- All 6 CIRS gates + doctor --acceptance independently re-run and confirmed green by the coordinator.
- Working tree clean.
