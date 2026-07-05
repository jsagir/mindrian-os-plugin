---
phase: quick-260705-jeq
plan: 01
subsystem: doctor-diagnostics + help-selector
tags: [doctor, help, command-registration, escalation-report, de-stijl-selector]
requires:
  - lib/core/check-plugin-enabled.cjs
  - scripts/doctor.cjs evidence collectors (collectVersionOfRecord, readLegacyConfigPin, detectMarketplaceCacheInstall)
  - lib/core/active-plugin-root.cjs
provides:
  - lib/core/command-registration-check.cjs (sweepCommandRegistration)
  - scripts/doctor.cjs --report-registration-bug sibling mode
  - data/help-groups.json 11-family re-group
  - scripts/help-renderer.cjs --group <family-id>
affects:
  - scripts/verify-release (new section 7b)
  - scripts/install-pre-commit.sh (new command-registration gate)
  - commands/help.md, commands/doctor.md
tech-stack:
  added: []
  patterns:
    - "sibling-flag dispatch with own exit contract (mirrors --check-rs-engine)"
    - "one reusable static check in lib/core/ shared by release gate + pre-commit hook + doctor mode"
    - "data-driven help-groups.json as single source of truth; no prose duplication"
key-files:
  created:
    - lib/core/command-registration-check.cjs
    - tests/test-command-registration-check.cjs
    - tests/test-doctor-report-registration-bug.cjs
  modified:
    - scripts/doctor.cjs
    - commands/doctor.md
    - scripts/verify-release
    - scripts/install-pre-commit.sh
    - data/help-groups.json
    - commands/help.md
    - scripts/help-renderer.cjs
    - tests/test-help-selector-lanes.cjs
    - data/command-registry.json
decisions: [D-01, D-02, D-03, D-04, D-05, D-06]
metrics:
  duration: ~22 min
  completed: 2026-07-05
  tasks: 5
  files: 12
---

# Quick Task 260705-jeq: Doctor registration-bug diagnostic + /mos:help 11-family reshape Summary

Shipped a read-only `doctor --report-registration-bug` escalation mode (backed by a reusable command-registration precondition sweep wired as a release + pre-commit gate) and rewrote `/mos:help` from the stale 4-lane claim to the real 11 command families as a 3-card AskUserQuestion selector sourced solely from `data/help-groups.json`.

## What shipped

**Part 1 (doctor):**
- `lib/core/command-registration-check.cjs` -- `sweepCommandRegistration(dir)` returns `{ pass, failures, warnings, scanned }`. FAIL class (silent registration skip): unbalanced frontmatter fence, tab in the frontmatter block, illegal command name (`/^[a-z0-9-]+$/`), case-insensitive basename collision. WARN class (renders badly): missing / over-60-char description, subdirectory. CLI exits 1 on any FAIL, 0 on warnings-only. Live tree: 107 scanned, 0 failures.
- Wired into `scripts/verify-release` (new section 7b, FAIL calls `fail()`, warnings call `warn()`) and `scripts/install-pre-commit.sh` (both hook-body copies + the idempotency grep chain).
- `scripts/doctor.cjs --report-registration-bug` -- NEW read-only sibling mode (dispatched right after `--check-rs-engine`, NOT in `--all`). Reuses existing evidence collectors (Canon Part 7) to prove all 7 locally-checkable causes are CLEAN (install-cache drift, enabledPlugins silent-disable, legacy config pin, marketplace clone git-dirt, version-of-record legs, on-disk command count, static sweep), then assembles a paste-ready Anthropic bug report with environment facts, generic control-test wording, and provenance pointers. stdout only, `--json` for the machine shape, exit 0 whenever the report assembles (offline-safe). On this machine it correctly FLAGGED real drift (install-cache + dirty clone) with the "fix locally first" cue and still exited 0.

**Part 2 (help):**
- `data/help-groups.json` re-grouped to the CONTEXT-locked 11 families as a 3-card 4+4+3 map. Command union byte-identical (100 non-admin commands, zero add/drop/dup). `deprecated_aliases` + `_lanes` byte-untouched; schema unchanged.
- `commands/help.md` rewritten: 11 families as 3 cards, each card its own AskUserQuestion call (no auto-chain), the exact escape-hatch line for families over 4 commands, explicit bare-argument resolution order, family text-list path delegating to `help-renderer.cjs --group`. All stale 4-lane / one-call literals swept from frontmatter and body.
- `scripts/help-renderer.cjs` -- new `--group <family-id>` flag renders one family's full list (reusing `loadGroups()` + jtbd join); unknown id prints the 11 valid ids and exits 1. DS palette lines (verify-release greps them) kept byte-stable.

## Task 3 checkpoint (resolved from CONTEXT, not a live stop)

Per the dispatch instructions, the `checkpoint:human-verify` on the 11-family map was resolved directly from `260705-jeq-CONTEXT.md`'s `<specifics>` verbatim family->command list (the authoritative approval written into the context file for exactly this purpose). That verbatim list was verified to yield a byte-identical 100-command union against the prior groups (admin commands `admin` + `dogfood-flush` excluded, deprecated 5 excluded). Note: the CONTEXT verbatim command-to-family assignments differ from the PLAN's proposed reconstruction map (for example `setup`/`update` sit in Start Here, and `stance`/`jtbd`/`models`/`operator` sit in Memory/State/Engine); the CONTEXT list was used as authoritative per the dispatch, and the PLAN's ids/labels/lanes were reused as the naming layer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated data/command-registry.json**
- **Found during:** Task 5 commit (pre-commit command-registry drift gate blocked it).
- **Issue:** `data/command-registry.json` is a generated artifact that stores each command's `teaching` field; rewriting help.md's `teaching` frontmatter staled it.
- **Fix:** `node scripts/build-command-registry.cjs` (107 commands) and included the regenerated file in the Task 5 commit.
- **Note:** doctor.md's `description`/`argument-hint` changes (Task 2) did NOT affect the registry, so Task 2 committed cleanly; only the `teaching` change triggered drift.
- **Files modified:** data/command-registry.json
- **Commit:** 28f95106

**2. [Rule 1 - Test binding] Updated test-help-selector-lanes.cjs Assertion 5**
- **Found during:** Task 5 (help.md rewrite).
- **Issue:** Assertion 5 literal-bound to the OLD help.md "two-axis lanes-as-tabs" body contract (required `two-axis`, `ONE AskUserQuestion call`, `LANE axis`/`COMMAND axis`, `More ->`, `Back`) that Task 5 explicitly replaced. The plan's Task 4 note ("suite should pass unchanged") held only for Assertions 1-4 (data-driven lane coverage); Assertion 5 pins the help.md body.
- **Fix:** Rewrote Assertion 5 to lock the NEW 3-card 11-family contract (3 cards, AskUserQuestion call per card, exact escape-hatch line, `help-renderer.cjs --group` delegation, sourced from `data/help-groups.json`, host-keymap honesty preserved, no stale 4-lane / one-call literals). Intent preserved (selector not flat-list, one source of truth, renderer delegation), no assertion weakened.
- **Files modified:** tests/test-help-selector-lanes.cjs
- **Commit:** 28f95106

### No-edit-needed observations

- Task 4 required no edits to `lib/memory/help-renderer.test.cjs` or `tests/test-help-cards-render.cjs`: both are data-driven (labels read via `loadGroups()`, lanes read from `_lanes`), so the re-group passed them unchanged. The plan anticipated possible label-pin edits; none were pinned.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat surface

No new threat surface beyond the plan's `<threat_model>`. The doctor mode's two child-process probes (`git`, `claude --version`) are the T-jeq-01 mitigations already in the register: both use `execFileSync` with argument arrays (never string-interpolated shell) and guarded try/catch with placeholder / not-applicable fallback. The report carries only versions, counts, paths under `~/.claude`, and platform facts (T-jeq-02): zero room content, zero Brain wire, generic control-plugin wording (never names a specific plugin, never "supabase").

## Verification

- `node tests/test-command-registration-check.cjs` -- 8/8 (incl. live-tree-clean, 107 scanned)
- `node tests/test-doctor-report-registration-bug.cjs` -- 4/4 (diagnostic-only contract locked)
- `node scripts/doctor.cjs --acceptance` -- 14/14 (mode NOT in --all, no class-flag regression)
- `node scripts/check-help-coverage.cjs` -- valid (100% non-admin coverage preserved; 5 deprecated stay off cards)
- `node lib/memory/help-renderer.test.cjs` -- 6/6 (11 new labels render)
- `node tests/test-help-selector-lanes.cjs` -- 5/5 (Assertion 5 locks the 3-card contract)
- `node tests/test-help-cards-render.cjs` -- 4/4 (100 non-admin commands covered)
- `node tests/test-help-coverage-gate.cjs` -- 7/7
- `bash scripts/verify-release` -- exit 0 (CLEAR TO RELEASE; section 7b clean, the new gate does not brick the cut)
- em-dash sweep of commands/help.md, commands/doctor.md, lib/core/command-registration-check.cjs -- clean

## Follow-up seeds (OUT of scope, not built)

1. `check-stale-literals.cjs` sweep -- the deeper pattern behind every bug this session is a hardcoded literal drifting from an auto-discovered source of truth (the "45 commands" banner, the "4-lane" help claim, the swallowed "vunknown"). A sibling sweep inventorying such literals is a suggested SEED for a future quick task.
2. F8 loud-restart cue after plugin update (still open in windows-install-update-ux.md).
3. F11 item (b): /mos:update reconcile-or-retire of the legacy config.json (still open).
4. Consider registering the two new tests in `lib/memory/run-feynman-tests.cjs` for aggregator coverage (not required by this plan; the tests run standalone and via verify-release's gate).

## Self-Check: PASSED

- Created files verified on disk: lib/core/command-registration-check.cjs, tests/test-command-registration-check.cjs, tests/test-doctor-report-registration-bug.cjs
- Task commits verified in git: 068e3a2c (RED), 2641074d, 21152f4d, b7a38c68, 28f95106
