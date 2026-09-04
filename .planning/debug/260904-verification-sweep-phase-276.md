---
status: investigating
kind: qa-sweep
trigger: "260904-verification-sweep-phase-276"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: unreachable
canon_parts: [6, 8, 9, 11]
created: 2026-09-04T00:00:00Z
updated: 2026-09-04T00:00:00Z
---

## Current Focus

hypothesis: Phase 276's frozen tool-honesty ledger is accurate, and the 2 HIGH_RISK
findings a fresh scan produced come from `resolveWritePrimitives()` silently degrading
when `lib/core/navigation.cjs` cannot be required.
test: run `scripts/check-tool-honesty.cjs --report` twice on the same tree, once with an
empty `node_modules/` and once with dependencies installed, and diff the verdicts.
expecting: identical tool/branch discovery totals with a different risk distribution, and
`require('./lib/core/navigation.cjs')` throwing in the degraded run.
next_action: navigator decision on whether the checker should fail loudly (or emit an
UNKNOWN verdict) when a write-primitive source module fails to load, instead of grading
tools against a silently shortened primitive set.

## Meta

- Repo: `jsagir/mindrian-os-plugin`, remote Claude Code container checkout at
  `/home/user/mindrian-os-plugin`. NOT the `/home/jsagi/dev/MindrianOS-Plugin` dev
  workspace, and not the plugin install cache. No commits or pushes were made by this
  sweep except this report.
- Plugin version: 2.0.0-beta.20 (`package.json` / `.claude-plugin/plugin.json`)
- Reported by: verification sweep requested 2026-09-04
- Date first observed: 2026-09-04
- Related debug sessions: `meeting-file-meeting-false-success.md` (the Phase 276 partial-close)

## Source-of-Truth Preamble

- **CODE claims read against:** branch `claude/new-session-d21q7y` @ `941c44f3`, which is
  identical to `origin/main` @ `941c44f3` (0 ahead, 0 behind, verified by `git fetch origin main`).
  Comparison runs used a detached worktree at `e484f4b3`, the commit the Phase 276
  disposition ledger names as its freeze point.
- **WIRE claims probe against:** none. Both MCP servers (`mindrian-brain`, `mindrian-os`)
  failed to connect in this session (CONNECTION_CLOSED), so no live tool call was made and
  no wire claim is filed below. Every finding here is a source-and-local-execution claim.
- **Date of audit:** 2026-09-04
- **Re-verification rule:** source claims below were read against `origin/main` HEAD
  directly, so none carry `needs-source-reverify`.

## Problem Statement

`scripts/check-tool-honesty.cjs` reports 2 HIGH_RISK findings with full confidence on any
checkout where `lib/core/navigation.cjs` cannot be loaded, because its write-primitive
resolver swallows the load failure and grades every tool against a primitive set that is
missing all 35 of navigation.cjs's write-prefixed exports.

## Symptoms

expected: the advisory tool-honesty gate either reports the same verdict the Phase 276
ledger froze (0 HIGH_RISK, 12 MEDIUM, 119 OK across 37 tools / 131 branches), or says out
loud that it could not resolve its own write-primitive set.
actual: on a checkout with an empty `node_modules/` the gate reports 2 HIGH_RISK, 12
MEDIUM, 117 OK across the same 37 tools / 131 branches, with no warning that anything
degraded, and `--check` prints a `WARN` naming two tools as dishonest that are not.
errors: verbatim, from `node scripts/check-tool-honesty.cjs --check`:

```
WARN: tool-honesty advisory: 2 high-risk finding(s) detected; not blocking (run with --strict to restore hard-fail)
WARN:   - extract_shallow.(default): HIGH_RISK -- claims "Routes graph writes through lib/core/navigation.cjs setFocus + memory_event (Phase 109 chokepoint)." but no write primitive is reachable
WARN:   - memory_event.(default): HIGH_RISK -- claims "Routes EXCLUSIVELY through navigation.cjs (the single Part 9 chokepoint) -- never opens the graph store directly." but no write primitive is reachable
```

and the underlying load failure, which the checker never surfaces:

```
MODULE_NOT_FOUND | Cannot find module 'ajv/dist/2020'
Require stack:
- /home/user/mindrian-os-plugin/lib/core
```

reproduction:
  1. Clone the repo fresh (or `rm -rf node_modules`) so no dependencies are installed.
  2. `node scripts/check-tool-honesty.cjs --report | grep -c HIGH_RISK` -> 2
  3. `npm install --ignore-scripts`
  4. `node scripts/check-tool-honesty.cjs --report | grep -c HIGH_RISK` -> 0
started: present since the checker shipped (`209b604f` and the 3 commits after it). It is
not a regression from any commit after the `e484f4b3` freeze: `scripts/check-tool-honesty.cjs`,
`lib/mcp/tools/graph.cjs`, `lib/mcp/tools/dual-path.cjs`, `lib/core/navigation.cjs` and
`lib/core/dual-path-detector.cjs` are all byte-identical between `e484f4b3` and `941c44f3`
(`git diff --quiet`, 5 of 5 clean), and a detached worktree at `e484f4b3` with no
`node_modules/` reproduces the same 2 HIGH_RISK.

## Scope and Impact

- Affected surfaces: cli (the gate runs at commit, at release, and in `doctor --acceptance`).
  Desktop and Cowork never invoke it.
- Affected commands: `scripts/check-tool-honesty.cjs` (`--check`, `--check --strict`,
  `--report`), and by inclusion `scripts/verify-release` and `node scripts/doctor.cjs --acceptance`
  (the `coverage-gate` point, where tool-honesty is advisory).
- Affected users: nobody in production. This is a developer and CI gate only, and it cannot
  reach an installed plugin.
- Version range: from the checker's first commit to HEAD `941c44f3` (v2.0.0-beta.20).
- Severity: medium. The gate is advisory today (WARN, never blocks), so a degraded run costs
  investigation time rather than a broken build. It becomes high the moment anyone runs
  `--strict` in CI, where a dependency-less checkout would hard-fail on two false findings.
- Blast radius: any consumer of the checker's verdict, including the disposition-ledger
  diff in `tests/test-276-tool-honesty-findings-closed.cjs` and the future Theo-side TS-AST
  port recommended in `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md`, which would
  inherit the same silent-degrade shape if ported literally.

## Eliminated

- hypothesis: a commit landed after the `e484f4b3` ledger freeze and broke tool honesty.
  evidence: `git diff --quiet e484f4b3 HEAD` is clean for all 5 files in the reachability
  path (`scripts/check-tool-honesty.cjs`, `lib/mcp/tools/graph.cjs`,
  `lib/mcp/tools/dual-path.cjs`, `lib/core/navigation.cjs`, `lib/core/dual-path-detector.cjs`).
  timestamp: 2026-09-04T00:00:00Z

- hypothesis: the Phase 276 frozen sweep (`tests/fixtures/tool-honesty/276-dispositions.json`,
  `frozen_sweep: {tools:37, branches:131, high_risk:0, medium:12, low:0, unknown:0, ok:119}`)
  overstated its result, making it a false-success claim inside the phase built to eliminate
  false-success claims.
  evidence: with dependencies installed, the live scan at HEAD reproduces that record
  exactly: 37 tools, 131 branches, 0 HIGH_RISK, 12 MEDIUM, 119 OK, 0 LOW, 0 UNKNOWN. The
  ledger is accurate.
  timestamp: 2026-09-04T00:00:00Z

- hypothesis: `memory_event` is a genuine Layer 1 defect (a tool whose description claims a
  write it cannot perform).
  evidence: `lib/mcp/tools/graph.cjs:272` calls `memoryEvent(db, ...)`, defined at
  `:173-182`, which calls `navigation.logMemoryEvent(db, 'mcp_client_event_logged', body)`
  at `:181`. `logMemoryEvent` is a live export of `navigation.cjs` (confirmed by loading the
  module). The description is true; only the degraded scan cannot see it.
  timestamp: 2026-09-04T00:00:00Z

## Evidence

- timestamp: 2026-09-04T00:00:00Z
  checked: `git fetch origin main` then `git log origin/main..HEAD` and `git log HEAD..origin/main`
  found: branch `claude/new-session-d21q7y` @ `941c44f3` is 0 ahead, 0 behind `origin/main`;
  working tree clean before the sweep began.
  implication: every finding below reads against published `origin/main`, not local drift.

- timestamp: 2026-09-04T00:00:00Z
  checked: `node scripts/check-tool-honesty.cjs --report` with `node_modules/` empty (0 entries)
  found: 37 tools / 131 branches scanned; 2 HIGH_RISK (`extract_shallow.(default)`,
  `memory_event.(default)`), 12 MEDIUM, 117 OK.
  implication: a delta of 2 against the frozen ledger, with discovery totals unchanged, so
  the difference is in grading, not in what was found.

- timestamp: 2026-09-04T00:00:00Z
  checked: detached worktree at `e484f4b3` (the ledger's own freeze commit), same empty
  `node_modules/`, same command
  found: identical 2 HIGH_RISK.
  implication: the delta is not time-dependent and not caused by any commit in
  `e484f4b3..941c44f3`. It is environment-dependent.

- timestamp: 2026-09-04T00:00:00Z
  checked: `scripts/check-tool-honesty.cjs:449-474`, function `resolveWritePrimitives()`
  found: it calls `require()` at scan time on `lib/core/navigation.cjs`,
  `lib/core/navigation/edges.cjs` and `lib/core/node-insert.cjs`, and wraps each in
  `try { ... } catch (_e) { }` with the comment "Module unavailable at scan time -- degrade,
  never throw". The catch body is empty: no warning, no counter, no verdict change.
  implication: a load failure silently shrinks the primitive name set. Because
  `FIXED_FS_PRIMITIVES` (12 entries) always remains, `combinedRe` is never null, so no
  downstream emptiness check can notice either.

- timestamp: 2026-09-04T00:00:00Z
  checked: `require('./lib/core/navigation.cjs')` with `node_modules/` empty
  found: throws `MODULE_NOT_FOUND: Cannot find module 'ajv/dist/2020'`.
  `lib/core/navigation/edges.cjs` (3 exports) and `lib/core/node-insert.cjs` (6 exports)
  both load fine, so only one of the three sources is lost.
  implication: the degraded run loses exactly the navigation.cjs contribution and keeps the
  rest, which is why most tools still grade OK and only two flip.

- timestamp: 2026-09-04T00:00:00Z
  checked: navigation.cjs's exports against `WRITE_PRIMITIVE_PREFIXES`
  (`write`/`log`/`set`/`store`/`promote`/`confirm`/`insert` at a camelCase boundary)
  found: 117 exports total, of which 35 match the prefix set, including `logMemoryEvent`,
  `setFocus` and `writeEdge` - the three primitives the two flagged descriptions name.
  implication: the degraded set is missing precisely the names needed to grade
  `memory_event` and `extract_shallow` correctly.

- timestamp: 2026-09-04T00:00:00Z
  checked: `npm install --ignore-scripts --no-audit --no-fund` (171 packages), then the same
  `--report` run
  found: 37 tools / 131 branches; 0 HIGH_RISK, 12 MEDIUM, 119 OK. Byte-for-byte the
  `frozen_sweep` record in `tests/fixtures/tool-honesty/276-dispositions.json`.
  implication: Phase 276's close-out claim is TRUE. The delta was entirely the checker's
  own degraded input.

- timestamp: 2026-09-04T00:00:00Z
  checked: `package-lock.json` after `npm install`
  found: modified. Reverted with `git checkout --`; tracked tree is clean again.
  implication: the `verify-release-clean-tree` FAIL recorded below was self-inflicted by
  this sweep, not pre-existing drift.

## Technical Root Cause

- Site: `scripts/check-tool-honesty.cjs:449-474`, function `resolveWritePrimitives()`
- Cause: the per-source `try/catch` around `require(src)` has an empty catch body. A source
  module that fails to load contributes zero names and leaves no trace. The function's
  return value carries no signal that its input set is incomplete, and every caller treats
  the resulting `test(maskedText)` as authoritative. A tool whose only write goes through a
  lost primitive is then graded "no write primitive is reachable" and, when it carries a
  strong persistence claim, escalated to HIGH_RISK with the same confidence as a real finding.
- Why it surfaces now: it does not require a code change to surface. It needs only a
  checkout where `lib/core/navigation.cjs`'s dependency chain is unavailable, which is the
  default state of a fresh clone and of any CI job that runs gates before `npm ci`. This
  sweep is simply the first run of the checker in that state.

## Required Code Changes

- Change 1:
  - Location: `scripts/check-tool-honesty.cjs:449-474`, function `resolveWritePrimitives()`
  - Current behavior: swallows a source-module load failure silently and returns a shortened
    primitive set indistinguishable from a complete one.
  - Required behavior: record each failed source and expose it on the returned object (for
    example `degradedSources: [{path, code, message}]`).
  - Short-term patch: when `degradedSources` is non-empty, print one `WARN` line naming each
    unloadable source and the recovery step (`npm ci`), so a reader can never mistake a
    degraded run for a clean one.
  - Long-term fix: when `degradedSources` is non-empty, cap every verdict that depends on
    write reachability at UNKNOWN rather than HIGH_RISK, and make `--strict` fail on the
    degradation itself instead of on the findings it manufactures. A gate that cannot resolve
    its own vocabulary should say so, not guess. This is the same discipline D-276-2 already
    applies to suppression: a verdict the measurement cannot support is not a verdict.
- Change 2:
  - Location: `scripts/check-tool-honesty.cjs`, the `--check` and `--report` entry points
  - Current behavior: neither mode reports how many write primitives were resolved.
  - Required behavior: print the resolved primitive count (and the per-source contribution)
    in `--report`, so the disposition-ledger diff has an observable input, not just an output.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: `tests/test-276-tool-honesty-degraded-primitives.cjs` (new)
  - Given: `resolveWritePrimitives()` with one source path pointed at a module that throws on
    require (reuse the existing fixture shape in `tests/fixtures/tool-honesty/unresolvable.cjs`).
  - When: the resolver runs.
  - Then: the returned object reports the failed source, and no branch that depends on it is
    graded HIGH_RISK.
  - Runner registration: `tests/run-all-276.sh` discovers `tests/test-276-*.cjs` by glob, so
    the file is picked up on creation with no runner edit.
- Test 2:
  - Type: integration
  - Location: `tests/test-276-tool-honesty-findings-closed.cjs` (update)
  - Given: the frozen ledger's `frozen_sweep` record.
  - When: the suite compares it against a live scan.
  - Then: the comparison SKIPs with a stated reason when the primitive resolver reports a
    degraded source, instead of diffing against a set it knows is incomplete.

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the next version once Change 1 lands.
- Release lockstep: no version bump is required by this report alone.
- Canon: Part 11's advisory-gate posture is unchanged by this fix; no
  `docs/CANON-PHASE-MAP.md` edit needed. Canon Part 8 is untouched (the checker is a
  read-only static analyzer and performs no egress).
- knowledge-base.md: on resolve, add the summary block with the error-pattern keyword
  `Cannot find module 'ajv/dist/2020'` and the phrase "silently shortened primitive set".
- Theo: `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md` recommends porting this
  methodology to Theo. The SEED should name this degrade-silently shape explicitly so the
  TS-AST port does not reproduce it.
- Phase 276 bookkeeping: `.planning/phases/276-.../276-10-SUMMARY.md` does not exist even
  though the ROADMAP marks `276-10-PLAN.md` `[x]`. The plan's code did land and is verified
  (see the sweep results below), so this is a missing artifact, not missing work.

## Sweep Results

Every gate CLAUDE.md's Verification section names, run at `941c44f3` with dependencies
installed. Classification follows the standard four buckets.

| Gate | Result | Classification |
|---|---|---|
| `bash tests/run-all-276.sh` | PASS=13 FAIL=0 SKIP=0, 11 test files discovered, Part 8 source sweep clean on 17 targets, no-em-dash fence PASSED | WORKING |
| `node scripts/check-tool-honesty.cjs --report` (deps installed) | 37 tools / 131 branches, 0 HIGH_RISK, 12 MEDIUM, 0 LOW, 0 UNKNOWN, 119 OK. Matches `frozen_sweep` exactly | WORKING. Phase 276's close-out claim independently reproduced |
| `node scripts/check-tool-honesty.cjs --report` (no deps) | 2 HIGH_RISK, 12 MEDIUM, 117 OK, no degradation warning | NEW FAILURE. This report |
| `node scripts/build-connector-registry.cjs --check` | `connector-registry: OK` | WORKING |
| `node scripts/build-orchestration-projection.cjs --check` | `orchestration-projection: OK` | WORKING |
| `node scripts/check-render-coverage.cjs` | 16 covered / 0 excluded / 0 gap; md-keyspace 202 wired / 2 excluded / 0 unwired | WORKING |
| `node scripts/check-shape-declaration.cjs --check` | 53 advisory violations, exit 0, all of one shape: a surface declaring both a real `hitl_shape` fork and `connector.excluded:true` | Known, by design. Advisory since Phase 210 (WARN with every violation enumerated, never a block). Not silent, not new. The 53 count is worth a navigator decision on its own, separately from this sweep |
| `node scripts/doctor.cjs --acceptance` | 12/18 points passed | See breakdown below |

`doctor --acceptance` failures, all six:

| Point | Reported reason | Classification |
|---|---|---|
| `install-state` | install-state record absent | ENV GAP. No plugin install cache exists in this container |
| `version-of-record-published` | git tag `v2.0.0-beta.20` not found | ENV GAP, and correct-by-design: `854507ed` is the "bump to the next pre-release" commit. beta.19 is the released cut (`39a096aa`); beta.20 is deliberately unpublished |
| `npx-roundtrip` | `npm install @mindrian_os/cli@2.0.0-beta.20` failed | ENV GAP, same cause as the row above |
| `session-start-active-version` | `installed_plugins.json` absent | ENV GAP. Same missing install cache |
| `verify-release-clean-tree` | tracked-file drift: 1 file | Self-inflicted by this sweep. The file was `package-lock.json`, dirtied by the `npm install` this investigation required, and reverted immediately after. The tree was clean before and is clean now |
| `activation-reached-the-wire` | L4 `mcp_stdio_handshake` skipped-prior-layer-failed | ENV GAP, cascading from `install-state` |

No `doctor --acceptance` failure is a code defect. The `coverage-gate` point, which is the
one that carries the tool-honesty and shape-declaration signals, PASSED.

## Position of Phase 276

Read from the ROADMAP and the phase directory, not from a summary:

- 15 of 16 plans executed. `276-16-PLAN.md` (phase close, `autonomous: false`) is the only
  open plan. Its `276-16-SUMMARY.md` does not exist.
- Most of 276-16's deliverables have already landed: `TOOLHON-01` through `TOOLHON-14` are
  registered in `.planning/REQUIREMENTS.md` (19 references), the CHANGELOG carries the
  close-of-phase entry, the knowledge base has 7 Phase 276 references, and the ROADMAP
  carries the `[RECONCILED 2026-09-04, plan 276-16]` count correction.
- Two of its deliverables are genuinely blocked, and both are blocked on the same thing,
  which is not available in this container:
  1. The blocking human verification of Desktop or Cowork meeting filing against `room.db`.
     No room exists here, and both MCP servers failed to connect.
  2. The dev-research compositing trail, staged at
     `276-16-COMPOSITING-TRAIL-STAGED.md` because the `scripts/write-scope-check` PreToolUse
     guard blocked the write to `rethinking-mindrianos` (active room was
     `jonathan-contractor-motj`). The guard was correctly not bypassed. `~/MindrianRooms`
     does not exist in this container either.

Layer 2's shipped code was spot-checked independently rather than trusted from the ROADMAP
checkbox: `lib/core/navigation/spine-events.cjs` carries the C5 typed reasons
(`room_db_busy` at `:173`, `room_db_broken` at `:176`, the classifier consulted at `:366`),
so `276-10` shipped despite its missing SUMMARY.

## Resolution

Not resolved. One NEW FAILURE filed (the silent primitive degradation), with its root cause
confirmed by measurement in both directions rather than inferred. Phase 276's own ledger
claim is verified accurate and needs no correction.
