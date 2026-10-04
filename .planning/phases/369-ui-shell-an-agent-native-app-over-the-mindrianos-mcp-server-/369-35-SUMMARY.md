---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 35
subsystem: release-lockfiles
tags: [gap-closure, gap-4, lockstep, mcpv2-19, rule-8, d-17]
requires:
  - "369.1-08 (pruned npm-shrinkwrap.json, no sharp)"
provides:
  - "package-lock.json derived from the pruned shrinkwrap; 267 lockstep leg green"
affects: [package-lock.json]
tech-stack:
  added: []
  patterns: ["lockfile derived by deterministic copy of the shipped shrinkwrap, no npm run"]
key-files:
  modified: [package-lock.json]
key-decisions:
  - "package-lock.json is a pure copy of the shrinkwrap's name, version, lockfileVersion, requires and packages map"
requirements-completed: [TS369-03]
metrics:
  tasks: 2
  files: 1
  completed: 2026-10-04
---

# Phase 369 Plan 35: package-lock.json lockstep Summary

package-lock.json is now derived from the pruned npm-shrinkwrap.json by a deterministic node copy, clearing the test-267 lockstep red (Checks 1 and 2) that 369-19's RULE 8 ruling caused.

## Task 1: precondition probe (by behaviour, no edit)

| Probe | Result |
|-------|--------|
| (a) scripts/release-lib/prune-shrinkwrap.cjs exists | ok |
| (b) 369.1-08-SUMMARY.md exists | ok |
| (c) shrinkwrap has no node_modules/sharp and no node_modules/@img/ key | 148 entries, none found |
| (d) `node scripts/release-lib/prune-shrinkwrap.cjs npm-shrinkwrap.json --check` | "nothing to prune", rc=0 (the flag takes the lockfile path; bare `--check` is a usage error rc=2) |
| (e) `git status --short -- package.json npm-shrinkwrap.json package-lock.json` | clean |
| (f) test-267 before the edit | Check 1 FAIL (next, react, react-dom missing from package-lock.json root deps), Check 2 FAIL (packages maps differ); Checks 3 to 6 PASS |

## Task 2: derivation and proof

Command used (the exact derivation):

```
node -e "const fs=require('fs');const s=JSON.parse(fs.readFileSync('npm-shrinkwrap.json','utf8'));const o={name:s.name,version:s.version,lockfileVersion:s.lockfileVersion,requires:s.requires,packages:s.packages};o.packages[''].version=s.version;fs.writeFileSync('package-lock.json',JSON.stringify(o,null,2)+'\n')"
```

Results after the copy:
- test-267: PASS=6 FAIL=0 (Check 1: 20 dependencies agree across all three files; Check 2: packages maps identical, root version excluded)
- test-236-engines-floor: 5 passed, 0 failed (root engines still >=22.18.0)
- test-341-shrinkwrap-no-dev: PASS=4 FAIL=0
- `bash tests/run-all-267.sh`: lockstep leg PASSED; release payload ceiling OK (0 findings); em-dash guard PASSED; suite total PASS=26 FAIL=5 SKIP=3
- `prune-shrinkwrap.cjs npm-shrinkwrap.json --check` still rc=0; shrinkwrap and package.json untouched

The 5 remaining run-all-267 fails are not this plan's: CIRS gates, zod4 contract, registration API and titles, local server dual era, in-repo clients (the expected 267 dual-era/zod4/registration pins).

Commit: 59baf772e (package-lock.json alone).

## Handoff line for Phase 369.1

package-lock.json now mirrors the pruned npm-shrinkwrap.json (369-35). Any later regeneration of npm-shrinkwrap.json in the tree should be followed by the same derivation: the node command above; release Step 6.7 does not rewrite package-lock.json.

## Deviations from Plan

None - plan executed as written. Note: the plan's `--check` flag form needed the lockfile path argument; no impact.

## Known Stubs

None.

## Self-Check: PASSED
- package-lock.json commit 59baf772e present on main, one file
- test-267 6/6 PASS re-confirmed after commit via run-all-267 lockstep leg
