---
phase: 242-the-moat
plan: 02
subsystem: build-tooling
tags: [release-gate, static-analysis, doctrine-rot, supply-chain, mutation-proof, moat]
requirements: [MOAT-02]
canon_parts: [7, 8]
dependency_graph:
  requires:
    - "scripts/check-hook-schema-compatibility.cjs (scaffold, READ ONLY this phase)"
    - "scripts/verify-release pass/fail helpers and PLUGIN_ROOT (existing, unchanged)"
    - "tests/run-all-242.sh glob discovery (Plan 01, zero edits needed)"
  provides:
    - "scripts/check-kuzu-reintroduction.cjs, exit 0/1/2 forbidden-dependency scanner"
    - "node scripts/check-kuzu-reintroduction.cjs [--root <dir>] CLI surface"
    - "scripts/verify-release section 17 release-blocking gate"
    - "A machine-checked, same-polarity warning-sign item in docs/MOAT-MANDATE.md"
  affects:
    - "scripts/release.sh (runs verify-release; a kuzu reintroduction now blocks a release)"
tech_stack:
  added: []
  patterns:
    - "Allowlist-grep release gate with a self-referential exemption (check-* family)"
    - "Size-fenced allowlist: the test asserts count AND exact members"
    - "Zero-files-scanned exits 2, never a fast empty PASS"
    - "Comment-stripped wiring assertion so a banner cannot satisfy a production gate"
key_files:
  created:
    - scripts/check-kuzu-reintroduction.cjs
    - tests/test-242-kuzu-reintroduction-gate.cjs
  modified:
    - scripts/verify-release
    - docs/MOAT-MANDATE.md
decisions:
  - "Open Question 2 resolved to verify-release ONLY; scripts/doctor.cjs was not touched"
  - "Polarity correction applied: the replacement line stays a warning sign (checked means bad), overriding the 'the gate passes' text RESEARCH.md and PATTERNS.md proposed"
  - "The scan is scoped to require/import statements and manifest keys, never a blanket string search, so 38 historical prose mentions cannot trip it"
metrics:
  tasks: 3
  duration: ~30 min
  completed: 2026-07-28
  tests_added: 12
  suite_runtime_seconds: 0.7
---

# Phase 242 Plan 02: Kuzu Reintroduction Gate Summary

One-liner: the PR checklist stopped asking a human to judge, by eye, whether a change "works without KuzuDB edges" and started running a scanner that fails the release if a retired graph engine re-enters the dependency surface.

## What Changed and Why

`docs/MOAT-MANDATE.md` line 96 asked reviewers "Does this work without KuzuDB edges?" while line 3 of the same file recorded that the local per-room graph moved off KuzuDB to `node:sqlite` on 2026-06-14. That is doctrine rot in its purest form: a checklist item pointing at a database this repo no longer has, unfalsifiable by construction, so nobody could ever fail it and nobody could ever pass it meaningfully.

The replacement is a deterministic scanner with two checks:

1. **Dependency manifests.** Every line of `package.json` (and `package-lock.json` when present) is matched against a dependency-key pattern covering the real npm family: bare `kuzu`, `kuzu-` prefixed siblings such as `kuzu-wasm`, and scoped `@kuzudb/*`. A lockfile v3 package path key (`"node_modules/kuzu"`) is matched too, so a **transitive** reintroduction that never touches `package.json` is still caught.
2. **Live require/import statements.** Every `.cjs`/`.js`/`.mjs` file under the root is scanned for a module specifier that resolves to a kuzu package.

Three design details carry the weight:

- **Scope, not breadth.** A blanket `grep -i kuzu` would have failed on its first run against roughly 38 legitimate files and forced a giant, stale-by-design allowlist. Scoping to statements and manifest keys is what lets the historical "Migrated from hsi-to-kuzu.cjs" comments, the `buildGraphFromKuzu` back-compat alias, and the `case 'build-kuzu':` label all stay exactly where they are. Deleting history was never the ask.
- **A scanner that scanned nothing must never report PASS.** Zero scannable files exits 2, matching the sibling script's zero-Stop-hook-files guard. This is the same false-success shape Phase 242 exists to close, so the gate itself must not be able to produce it.
- **The allowlist is size-fenced.** Growing an allowlist is how a gate like this gets neutered without anyone noticing. Leg 9 asserts both the count (exactly two) and the exact members, so a third entry turns a test red before it ships.

## Required Re-Check Exit Codes

Both live mutation re-checks the plan mandates were actually run against the real tree, not asserted.

### 1. Seeded require probe

| State | Command | Exit code |
|---|---|---|
| `lib/core/__kuzu-mutation-probe.cjs` present, containing `const kuzu = require('kuzu');` | `node scripts/check-kuzu-reintroduction.cjs` | **1** |
| probe removed | `node scripts/check-kuzu-reintroduction.cjs` | **0** |

The failing run named the offender precisely: `lib/core/__kuzu-mutation-probe.cjs:2` with the snippet `const kuzu = require('kuzu');`.

### 2. Seeded package.json dependency

| State | Command | Exit code |
|---|---|---|
| `"kuzu": "^0.11.3"` inserted into `dependencies` | `node scripts/check-kuzu-reintroduction.cjs` | **1** |
| `git checkout -- package.json` | `node scripts/check-kuzu-reintroduction.cjs` | **0** |

The failing run named `package.json:22` with the snippet `"kuzu": "^0.11.3",`. After the restore, **`git status --porcelain package.json` was empty**, so the mutation left no residue.

### 3. End-to-end wiring proof (the section 17 command line)

The exact command `scripts/verify-release` section 17 invokes was run directly, by absolute path, in both states.

| State | Command | Exit code |
|---|---|---|
| probe seeded | `node "$PLUGIN_ROOT/scripts/check-kuzu-reintroduction.cjs"` | **1** |
| probe removed | same | **0** |

Section 17 captures that code into `KUZU_GATE_CODE` and branches through the existing `pass`/`fail` helpers, so a 1 fails the release rather than printing a warning.

## Blast Radius

`git diff --stat docs/MOAT-MANDATE.md` reported exactly **1 insertion and 1 deletion**. `wc -l docs/MOAT-MANDATE.md` was **147 before and 147 after** the edit. The 2026-06-14 correction banner at line 3 was not touched; it is legitimate history and the very evidence the replacement cites.

`git diff --stat lib/` is **empty**. Nothing under `lib/` was modified. `git diff --name-only HEAD~3 HEAD` lists exactly this plan's four files and nothing else:

```
docs/MOAT-MANDATE.md
scripts/check-kuzu-reintroduction.cjs
scripts/verify-release
tests/test-242-kuzu-reintroduction-gate.cjs
```

`git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty: zero files were deleted.

## Polarity: the planner catch that mattered

RESEARCH.md and PATTERNS.md both proposed replacing line 96 with "`scripts/check-kuzu-reintroduction.cjs` passes ...". The plan's `<planner_resolutions>` overrode that, and the override was correct. Line 96 sits inside `### Surface Area Warning Signs`, and line 99 reads "If 3+ warning signs are checked, the PR adds surface area." Every item in that list means **checked equals bad**. A "the gate passes" item would have meant checked equals good and silently corrupted the arithmetic of the 3+ rule, converting a moat control into a counting bug.

Reading lines 92-99 after the edit confirms **all four items in the list share one polarity**:

```
- [ ] Is this feature standalone (not connected to the cascade)?
- [ ] Could this be added to any folder-based system without modification?
- [ ] Does this PR reintroduce a retired graph engine? (machine-checked: ...)
- [ ] Is this just a UI addition without intelligence underneath?
```

The 3+ rule at line 99 keeps its meaning exactly.

## Open Question 2

**Resolved to `scripts/verify-release` only. `scripts/doctor.cjs` was NOT touched** (confirmed: it does not appear in this plan's diff). The closest sibling precedent, `scripts/check-hook-schema-compatibility.cjs`, also lives only in `verify-release`; doctor's coverage-gate organ reports coverage of DECLARED surfaces, which is a different question from a forbidden-dependency scan; and a kuzu reintroduction can only arrive through a commit, so release time is the moment it must be caught. Folding it into doctor later stays additive and non-breaking.

## Cross-Plan Discovery Check

`bash tests/run-all-242.sh` was run once after Task 3, with **zero edits to the aggregator** (`git diff --name-only tests/run-all-242.sh` is empty). Both phase test files were glob-discovered and passed:

```
--- test-242-hsi-to-graph-transaction.cjs ---
>>> test-242-hsi-to-graph-transaction.cjs: PASSED
--- test-242-kuzu-reintroduction-gate.cjs ---
>>> test-242-kuzu-reintroduction-gate.cjs: PASSED
--- Part 8 self-test: the tripwire actually bites ---
>>> Part 8 self-test: PASSED
--- Part 8 sweep: zero egress in every phase-242 surface ---
>>> Part 8 sweep: PASSED
Phase 242: PASS=4 FAIL=0 SKIP=0
```

Aggregator exit code **0**. Plan 01's zero-edit glob contract holds in practice, not just by claim: PASS went from 3 to 4 with this plan's file simply appearing on disk.

Per Plan 01's note, `PART8_TARGETS` was deliberately left containing only `scripts/hsi-to-graph.cjs`. This plan asserts its own surface inside its own test (leg 12), which is what kept the two plans independently green in the same wave.

## Verification Results

| Check | Command | Result |
|---|---|---|
| Gate clean on the live tree | `node scripts/check-kuzu-reintroduction.cjs` | exit **0**, PASS, 2 manifests + **1898** source files scanned |
| Twelve MOAT-02 legs | `node tests/test-242-kuzu-reintroduction-gate.cjs` | exit **0**, 12/12 pass, 0.70s |
| Phase aggregator | `bash tests/run-all-242.sh` | exit **0**, PASS=4 FAIL=0 SKIP=0 |
| Task 1 structure gate | all of `KUZU_DEP_RE`, `KUZU_LOCK_PATH_RE`, `KUZU_REQUIRE_RE`, `ALLOWLIST`, `SKIP_DIRS`, `--root` present | `gate structure OK` |
| Bad root | `node scripts/check-kuzu-reintroduction.cjs --root /nonexistent-path-xyz` | exit **2** (not 0, not 1) |
| verify-release syntax | `bash -n scripts/verify-release` | exit **0** |
| Wiring, comment-stripped | non-comment lines containing `check-kuzu-reintroduction.cjs` | exactly **1** |
| Section heading | `17. Kuzu Reintroduction Gate` | exactly **1** |
| Doc, two-sided | `Does this work without KuzuDB edges` / `check-kuzu-reintroduction.cjs` | **0** / **1** |
| False-positive fence | the six legitimate files in `git diff --name-only` | **none of them** |
| No em-dashes | `grep -cP '\x{2014}'` on all four files | **0**, **0**, **0**, **0** |
| Hermetic | `git status --porcelain` after a full test run; `/tmp/mindrian-242-kuzu-*` | only this plan's files; **no scratch leftovers** |
| `lib/` untouched | `git diff --stat lib/` | empty |

### The twelve legs, and why none is vacuous

- **Legs 1 and 2 (pass).** Leg 1 deliberately drives the **default** root with no `--root`, because that is what `scripts/verify-release` actually invokes. A `--root`-only suite could pass while the production path was broken. Leg 2 proves a clean scratch root also passes, separating "the tree happens to be clean" from "the scanner works".
- **Legs 3, 4, 5 (fire).** Three independent reintroduction shapes: a live require, a `package.json` dependency key, a `package-lock.json` package path key. Each asserts exit **exactly 1**, and legs 3 and 4 additionally assert the output names the offending file (and, for the manifest, a line number). Each seeds into a fresh scratch root that is asserted clean first, so a fixture that failed to seed cannot pass as a violation.
- **Legs 6 and 7 (fail loudly).** Two independent scanner-failure shapes, both asserting exit **2**. Without leg 7 in particular, a walk that silently found nothing would print PASS in milliseconds and look identical to a clean repo.
- **Leg 8 (false-positive fence).** Asserts that all six legitimate files still contain the string kuzu **and** that the live tree still passes. Either fact alone proves nothing: the files could have been scrubbed, or the scanner could have been narrowed to nothing. Together they are the fence.
- **Leg 9 (anti-neutering).** Parses the `ALLOWLIST` literal out of the gate's own source, strips `//` comment tails first (the written reasons contain apostrophes that would otherwise corrupt the string extraction), and asserts both the count and the exact two members.
- **Leg 10 (doc, two-sided).** Zero occurrences of the dead prose AND exactly one pointer to the gate, so an emptied or truncated file cannot pass vacuously.
- **Leg 11 (anti-spoofing).** Strips every line whose first non-whitespace character is `#` before asserting the reference, so a banner comment about the gate cannot stand in for the gate being wired.
- **Leg 12 (self-testing Part 8 sweep).** Plants all seven forbidden egress tokens on executable lines and requires each to be caught, plus one comment line naming all of them that must be ignored, and only then sweeps the real script. A grep gate that quietly stopped matching looks exactly like a clean file, which is the same false-success shape this phase exists to close.

## Deviations from Plan

**None.** All three tasks were executed exactly as written, including the `<planner_resolutions>` polarity override.

One implementation detail worth naming because it sits inside the plan's spec rather than beyond it: `scanManifest` breaks after the first matching regex on a given line, so a line that satisfies both `KUZU_DEP_RE` and `KUZU_LOCK_PATH_RE` (a bare `"kuzu":` key satisfies both) is reported once, not twice. Both regexes are still applied to both manifests, so nothing is under-scanned; only duplicate reporting is suppressed.

## Scope Confirmation

Phase 236's off-limits surface was neither read for modification nor touched: no `.planning/phases/236-*`, no `lib/core/lazygraph-ops.cjs`, no `tests/test-236-*`, no `tests/helpers/fixture-room-236.cjs`. No file under `lib/` appears in this plan's diff.

Plan 01's files were not re-touched: `scripts/hsi-to-graph.cjs` and `tests/test-242-hsi-to-graph-transaction.cjs` are absent from this plan's diff. `scripts/hsi-to-graph.cjs` was read only, to confirm the historical comment the gate must keep exempt.

`.planning/STATE.md` and `.planning/ROADMAP.md` were deliberately NOT modified; the orchestrator owns those writes after both Wave 1 plans complete. `.planning/REQUIREMENTS.md`'s MOAT-02 checkbox and traceability row WERE updated, matching Plan 01's precedent, since this plan delivers MOAT-02 in full.

Two files show as modified in `git status` throughout this session (`.planning/STATE.md`, `references/personality/pws-lexicon-full.md`). Both were already dirty at plan start, both belong to another session, and neither was staged or committed here.

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-242-05 (kuzu reintroduction, Tampering / supply chain) | mitigate | **Closed.** Manifest keys plus live require/import are scanned and wired into `verify-release` section 17 as an exit-1 release blocker, proven by three seeded shapes plus two live probes on the real tree. |
| T-242-06 (allowlist as a repudiation surface) | mitigate | **Closed.** Exactly two entries, each with a written reason on its own line, size-fenced and member-fenced by leg 9. |
| T-242-07 (walk as a DoS surface) | mitigate | **Closed.** `SKIP_DIRS` excludes `node_modules`, `.git`, `.planning`, `worktrees`; only three code extensions are read; the walk bounded to 1898 files and the whole default-root run completes in about 0.3s. Zero files exits 2, never a fast empty PASS. |
| T-242-08 (a banner comment satisfying the wiring gate, Spoofing) | mitigate | **Closed.** Leg 11 strips comment lines before asserting, and the count is exactly 1. |
| T-242-09 (scanner output, Information disclosure) | accept | **As designed.** Output is repo-relative paths, line numbers, and trimmed snippets of violating lines only. No `.env`, no credentials, no room data, and zero network reach (leg 12). Canon Part 8 unaffected: nothing egresses. |
| T-242-SC (package installs) | accept | **N/A.** Zero package-manager installs. No `package.json` line changed (the seeded dependency was reverted and verified clean). The new script uses only the `node:fs` and `node:path` builtins. Note the inversion: this plan's deliverable IS a supply-chain control. |

No new threat surface was introduced: no network endpoint, no auth path, no schema change. The one new file-access pattern (a recursive read-only walk of the repo) is bounded by `SKIP_DIRS` and an extension filter, and reads only source text it then discards.

## Known Stubs

None. Every artifact this plan claims is wired and exercised by a passing test: the script by twelve legs, the `verify-release` wiring by leg 11 plus a live end-to-end exit-code proof, and the doc replacement by leg 10.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | `68f8514b` | `feat(242-02): add kuzu-reintroduction release gate (MOAT-02)` |
| 2 | `3f344d1d` | `feat(242-02): wire section 17 kuzu gate and replace dead checklist prose (MOAT-02)` |
| 3 | `e6002580` | `test(242-02): twelve-leg hermetic gate proof for MOAT-02` |

## Notes for the Verifier

- The gate's clean-run counts (2 manifests, 1898 source files) are printed on every PASS. A future run reporting a dramatically smaller source count is a signal that `SKIP_DIRS` or the extension filter drifted, not that the repo shrank.
- Leg 9 is the load-bearing anti-neutering assertion. If a future change legitimately needs a third allowlist entry, that test must be updated deliberately in the same commit, which is the point.
- `scripts/doctor.cjs` was intentionally left alone. If the gate is ever wanted in the day-to-day acceptance report, folding it into doctor's coverage-gate organ is additive and breaks nothing.

## Self-Check: PASSED

Every file and commit claimed above was verified present on disk and in the log after writing this summary.

| Claimed artifact | Verified |
|---|---|
| `scripts/check-kuzu-reintroduction.cjs` | FOUND |
| `tests/test-242-kuzu-reintroduction-gate.cjs` | FOUND |
| `scripts/verify-release` | FOUND, executable bit set |
| `docs/MOAT-MANDATE.md` | FOUND |
| `.planning/phases/242-the-moat/242-02-SUMMARY.md` | FOUND |
| commit `68f8514b` | FOUND |
| commit `3f344d1d` | FOUND |
| commit `e6002580` | FOUND |
