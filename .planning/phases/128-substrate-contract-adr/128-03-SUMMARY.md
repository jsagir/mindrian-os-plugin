---
phase: 128-substrate-contract-adr
plan: 03
subsystem: ci-guards
tags: [substrate-contract, ci-guard, pre-commit-hook, canon-part-6, canon-part-8, canon-part-9, reuse-before-build, h1-closure]
requires:
  - 128-01 (the Substrate Contract ADR -- the supersede decision that retires --check-chokepoint)
  - 128-02 (scripts/check-substrate.cjs -- the guard with --diff and --baseline modes)
  - .git/hooks/pre-commit (the live hook that ran only --check-sendpacket before this plan)
  - scripts/install-pre-commit.sh (the installer template extended here)
provides:
  - .git/hooks/pre-commit wiring of check-substrate.cjs --diff (closes CONTEXT finding H1)
  - scripts/install-pre-commit.sh check-substrate.cjs --diff wiring for fresh clones
  - docs/architecture/SUBSTRATE-BASELINE.md (the 195-violation known-debt ledger + hook hard-fail proof)
affects:
  - 129 (spine-repair-memory-event -- owns the schema-unification + the bulk of the enumerated debt)
  - 129.5 (the rs-* reverse-salient graph-write migration)
  - 130 (lens-engine-skeleton -- owns the hats persistence path + breakthrough writers)
  - every future commit touching room.db (now blocked on net-new bypass)
tech-stack:
  added: []
  patterns:
    - "Additive installer extension: both the append branch and the create-branch heredoc wire the new guard; idempotency keyed on BOTH guards present"
    - "Live hook block modeled on the existing --check-sendpacket block (all node-guards co-located)"
    - "Net-new-only enforcement via check-substrate.cjs --diff (staged files); pre-existing debt ledgered, not blocked"
    - "Hook hard-fail proven via MINDRIAN_HOOK_STAGED_FILES + MINDRIAN_HOOK_STAGED_CONTENT_DIR seams (no real fixture left in tree)"
key-files:
  created:
    - docs/architecture/SUBSTRATE-BASELINE.md
  modified:
    - scripts/install-pre-commit.sh
    - .git/hooks/pre-commit (untracked per git convention -- live wiring, not committable)
decisions:
  - "The live .git/hooks/pre-commit is untracked by git convention; the tracked scripts/install-pre-commit.sh is the source of truth for fresh clones. The live hook was edited in-place (it now self-enforces on every commit)"
  - "--check-chokepoint is RETIRED, not invoked: check-substrate.cjs --diff is its strict superset per the ADR"
  - "The substrate guard sits adjacent to the --check-sendpacket block so all node-guards (brain-packet-schema, sendpacket, substrate) are co-located"
  - "Baseline report assigns every one of 195 violations to an owning downstream phase (129 / 129.5 / 130 / v1.14.0 / test-debt); none fixed in Phase 128"
metrics:
  duration: ~12m
  completed: 2026-05-30
  tasks: 2
  files: 2
---

# Phase 128 Plan 03: Substrate Guard Wiring + Baseline Report Summary

Wires the Plan-02 `check-substrate.cjs --diff` guard into the live `.git/hooks/pre-commit` and the `scripts/install-pre-commit.sh` installer template (retiring the never-wired `--check-chokepoint` per the ADR), and files the informational `docs/architecture/SUBSTRATE-BASELINE.md` known-debt ledger. Closes CONTEXT finding H1: the guard existed since Plan 02 but no live hook ever called it. After this plan, a net-new chokepoint bypass (raw INSERT INTO nodes, a new openGraph caller, a direct sqlite require, a Cypher user-content interpolation outside navigation.cjs) is hard-rejected at commit time; the ~195 pre-existing bypasses are ledgered as debt owned by Phases 129/129.5/130/v1.14.0.

## What shipped

- **`.git/hooks/pre-commit` substrate guard block** (untracked per git convention; live wiring). A Phase-128-03 block placed adjacent to the existing `--check-sendpacket` block: when `node` is available and `scripts/check-substrate.cjs` exists, it runs `node "$REPO_ROOT/scripts/check-substrate.cjs" --diff` and exits 2 with a recovery message naming `lib/core/navigation.cjs` as the only door and pointing at `docs/architecture/SUBSTRATE-CONTRACT.md`. The pre-existing `--check-sendpacket` block is unchanged. No `--check-chokepoint` invocation is added.

- **`scripts/install-pre-commit.sh`** (tracked; the fresh-clone installer). Extended additively: the idempotency grep now requires BOTH `check-schema-aliases.cjs` AND `check-substrate.cjs` to be present before declaring "already installed"; the append branch appends each missing guard independently; the create-branch heredoc now writes both `node ... check-schema-aliases.cjs` and `node ... check-substrate.cjs --diff`. The existing schema-aliases/sendpacket behavior, `set -euo pipefail`, and the `--no-verify` bypass note are preserved.

- **`docs/architecture/SUBSTRATE-BASELINE.md`** (created; 292 lines). The informational, non-blocking known-debt ledger. Enumerates all 195 pre-existing violations from `node scripts/check-substrate.cjs --baseline`, grouped by 5 rules (openGraph bypass / raw graph write / chokepoint require / direct sqlite require / Cypher interpolation), each row carrying its owning downstream phase. Names `lib/core/lazygraph-ops.cjs` as the #1 bypass (opened by ~15 callers via `openGraph`) and the bare 3-column un-provenanced schema vs the Phase-109 provenance schema divergence (`NOT NULL constraint failed: nodes.source_path`). States explicitly the report is informational / not-blocking and the hook blocks only net-new. Includes a "Hook enforcement proof" section recording the non-zero exit from `check-substrate.cjs --diff` against a net-new raw `INSERT INTO nodes` fixture. Names the hats persistence Cluster-2 finding (owned by Phase 130).

## Verification (all from the plan)

Task 1 automated gate (all pass):
- `grep -q "check-substrate.cjs --diff" .git/hooks/pre-commit` -- PASS
- `grep -q "check-substrate" scripts/install-pre-commit.sh` -- PASS
- `! grep -q "check-substrate.cjs --check-chokepoint" .git/hooks/pre-commit` -- PASS (retired, not wired)
- `! grep -q $'—' scripts/install-pre-commit.sh` -- PASS (zero em-dashes)
- `bash -n scripts/install-pre-commit.sh` + `bash -n .git/hooks/pre-commit` -- PASS (parse clean)
- Zero network surface: `grep -nE 'fetch|http|curl|wget|brain\.mindrian|tavily|onrender'` returns nothing in either file.

Task 2 automated gate (all pass):
- `docs/architecture/SUBSTRATE-BASELINE.md` exists, 292 lines (>= 30).
- Names `lazygraph-ops` + `openGraph`; marked `not blocking` / `informational` / `net-new`; assigns `129` and `130`.
- Zero em-dashes.
- "Hook enforcement proof" section present; net-new raw `INSERT INTO nodes` fixture drove `check-substrate.cjs --diff` to exit 1; fixture removed (no leak in tree).

## Self-enforcement note (load-bearing)

This plan's OWN two commits ran the newly-wired substrate hook:
- `1aba10d0` (Task 1, the installer) -- staged a pure-shell file; passed the `--diff` gate.
- `1f44b42d` (Task 2, the baseline report) -- staged a markdown file; passed the `--diff` gate.

The hook is now self-enforcing and did NOT block either legitimate commit. This confirms `--diff` correctly flags only NET-NEW violations in staged files (shell + markdown have none), not whole pre-existing-violating files. No `--diff` whole-file false-positive was observed; the teardown-awareness finding the orchestrator flagged (a legitimate commit blocked by whole-file `--diff`) did NOT occur, because the staged surface of both commits is non-source.

## Deviations from Plan

None - plan executed exactly as written. Rules 1-4 not triggered; no auth gates; no architectural changes.

## Known Stubs

None. The baseline report references but does not fix the enumerated violations (migration is Phase 129+, by design per the ADR Scope boundary). This is not a stub -- it is the explicitly-scoped contract-not-migration boundary documented in `docs/architecture/SUBSTRATE-CONTRACT.md` and assigned to named downstream phases in the baseline.

## Threat surface scan

No new security-relevant surface introduced. Per the plan threat register: T-128-04 (net-new bypass) and T-128-05 (H1 unwired-guard) are now MITIGATED -- the live hook runs `--diff` on every commit and the installer wires it for fresh clones, both proven by the hook hard-fail transcript. T-128-06 (hook reaching room.db / Brain) stays ACCEPTED and verified: zero network surface in hook or installer (grep gate above). T-128-SC (package installs): NONE -- zero new packages, no install task.

## Commits

- `1aba10d0` feat(128-03): wire check-substrate.cjs --diff into pre-commit + installer; retire --check-chokepoint
- `1f44b42d` docs(128-03): add SUBSTRATE-BASELINE.md known-debt ledger + hook hard-fail proof

## Self-Check: PASSED

- FOUND: docs/architecture/SUBSTRATE-BASELINE.md
- FOUND: scripts/install-pre-commit.sh
- FOUND: .planning/phases/128-substrate-contract-adr/128-03-SUMMARY.md
- FOUND: live .git/hooks/pre-commit check-substrate.cjs --diff wiring
- FOUND: commit 1aba10d0
- FOUND: commit 1f44b42d
