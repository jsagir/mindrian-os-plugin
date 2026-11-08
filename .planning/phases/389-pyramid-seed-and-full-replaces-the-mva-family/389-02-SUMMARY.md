---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 02
subsystem: mva-retirement-owner-gate
tags: [owner-card, decision-gate, token-gate, coupling, tdd]
requires: [389-01]
provides:
  - 389-DECISION.md (owner card, 11 items D1 to D11, all PENDING)
  - 389-decision.cjs (selftest, hash, check, gate)
affects: [389-06, 389-07, 389-08, 389-09, 389-10, 389-11, 389-12, 389-13]
key-files:
  created:
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-decision.cjs
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-DECISION.md
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-02-SUMMARY.md
  modified: []
decisions:
  - No owner answer was written. All 11 lines are PENDING. The recommended token is APPROVE on all 11.
  - STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (spawn instruction; the main session updates them).
metrics:
  tasks: 2 of 3 (Task 3 is the owner checkpoint)
  files: 3
completed: 2026-11-08
status: awaiting owner answer
---

# Phase 389 Plan 02: Owner decision card and token gate Summary

One line: 389-DECISION.md puts 11 owner decisions (D1 to D11) on one card with live caller numbers, and 389-decision.cjs is a self-tested gate (66 asserts over the 9 behaviors) that lets a later plan act only on the exact token APPROVE or a listed alternative. Status: awaiting owner answer. No product file changed.

## NEEDS_HUMAN line (exact)

NEEDS_HUMAN: Rule on D1 to D11 in 389-DECISION.md? Recommended: APPROVE on all 11 (D1 command-only entry, D2 first-install on the Seed, D3 retire the pipeline skill, D4 retire the option router, D5 retire the old brief, D6 retire the old core, D7 rename mva-report to session-report, D8 soft alias for one release, D9 rename the surviving modules, D10 share opt-in and default off, D11 keep autonomous_safe true behind a card and a code refusal). Answer "approve all", or give a token per item.

Card path: .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-DECISION.md. The commit sha of Task 2 is the commit that holds this file (named in the handback report; a file cannot hold its own commit sha).

## Recommended tokens

| Item | Name | Allowed tokens | Recommended | Consumed by | Live evidence (389-CALLERS.tsv, plan 01) |
|------|------|----------------|-------------|-------------|--------------------------------------------|
| D1 | ENTRY | APPROVE, KEEP-HOOK | APPROVE | plan 07 | hook row hooks/hooks.json:354; 18 hits, 16 files; only live non-family caller is the test list in run-feynman-tests.cjs |
| D2 | FIRST-INSTALL | APPROVE, KEEP-DETACHED | APPROVE | plan 07 | router requires mva-state at :454 and :578, spawns mva-run at :480; router classifies with greeting-intent-detector, gets the venture verdict only from the hook; old brief ignores the idea |
| D3 | PIPELINE-SKILL | APPROVE, NO | APPROVE | plan 08 | 19 hits for mva-pipeline, no live non-family caller |
| D4 | OPTION-ROUTER | APPROVE, NO | APPROVE | plan 08 | 31 hits mva-option, 20 hits router; plan 08 total 48 files; docs in ignite, new-project, vault |
| D5 | BRIEF | APPROVE, NO | APPROVE | plan 09 | 33 hits, 27 files; live non-family caller scripts/room-naming-selector.cjs:74; SENS-01 keeps 10 consumers |
| D6 | CORE | APPROVE, NO | APPROVE | plan 10 | 78 hits, 47 files; router is the live non-family caller of mva-state and mva-run; needs D1 and D2 APPROVE |
| D7 | SESSION-REPORT | APPROVE, NO | APPROVE | plan 11 | 21 hits, 21 files, no live non-family caller |
| D8 | ALIAS | APPROVE, NO-ALIAS | APPROVE | plans 09, 11 | soft-alias pattern of commands/heal.md |
| D9 | SURVIVORS | APPROVE, NO | APPROVE | plan 13 | 62 hits, 40 files; 5 live code callers of mva-classifier, 3 of mva-rule-linter (verify-release:414 reads an output prefix) |
| D10 | SHARE | APPROVE, DROP, NO | APPROVE | plan 12 | 22 hits, 9 files; live non-family caller only the test list; privacy fact printed |
| D11 | POSTURE | APPROVE, FLAG-FALSE | APPROVE | plan 06 | flag read per command row only; chain_run refuses an unbound session; 7 pipeline files name the command |

Coupling rules enforced by code: D1 APPROVE needs D2 APPROVE; D6 APPROVE needs D1 and D2 APPROVE; D10 DROP needs D6 APPROVE; D2 KEEP-DETACHED needs D1 KEEP-HOOK and D6 NO.

The D6 text states: removing the old core removes the only trigger of scripts/room-naming-selector.cjs (spawned only by the orchestrator block phase-119-01-naming-selector-hook, lib/core/mva-orchestrator.cjs lines 306 to 322); the script, its library and its test stay unreachable and go to the Phase 390 table. It also states the facts from 389-01: first-install-router requires mva-state too (lines 454 and 578), no writer of mva-brief.json exists, and autonomous_safe is read per command row only (D11).

Re-scan note: a fresh run of the caller scan during this plan gave 310 rows. The 6 extra rows are plan 01's own file tests/test-389-stale-text.cjs (it names mva tokens), added after the committed table was made. The card uses the committed 389-CALLERS.tsv numbers.

## RED output (kept)

The self-test sits in 389-decision.cjs next to the implementation. RED was made by first writing the file with the full self-test and with the commands hash, check and gate as stubs that throw "not implemented". Run before the implementation, exit 1:

```
PASS T1 pending gate exits 1
FAIL T1 pending prints "D1 PENDING PENDING" :: ERROR not implemented
FAIL T1 check accepts an all-PENDING card :: ERROR not implemented
PASS T2 unknown token exits 1
FAIL T2 prints UNKNOWN-TOKEN :: ERROR not implemented
FAIL T3 control: unedited all-APPROVE card passes D1 :: ERROR not implemented
PASS T3 edited items exit 1
FAIL T3 prints HASH-MISMATCH :: ERROR not implemented
...
selftest: FAIL (19 passed, 47 failed)
```

The 19 passes in RED are negative asserts (exit 1 expected) that the error exit satisfied by accident. Every positive assert failed (all 47 failures). After the implementation: `selftest: PASS (66 passed, 0 failed)`, exit 0.

## GREEN output and checks

- `node 389-decision.cjs selftest`: PASS (66 passed, 0 failed). It builds synthetic cards and a temporary git repo (3 commits, one side branch) in a mkdtemp folder and removes it in a finally block. It runs the commands as child processes, so exit codes are tested for real.
- Behaviors covered: (1) PENDING gives `D1 PENDING PENDING` and exit 1; (2) unlisted token gives UNKNOWN-TOKEN; (3) edited items section gives HASH-MISMATCH; (4) side-branch sha, unknown sha and malformed sha give HEAD-NOT-ANCESTOR or exit 1; (5) all four coupling rules, each with its message, plus coupling enforced for an item that was not requested, plus valid pairs passing; (6) all 11 APPROVE prints `D<n> APPROVE APPROVED` x11, listed alternatives print ALTERNATIVE; (7) check rejects 10 lines, 12 lines, a missing start marker, a missing end marker, a missing HEAD line, a missing hash line, markers in the wrong order; (8) exact tokens: approve, Approve, APPROVE-MOST, "APPROVE # ok", "APPROVE now", "APPROVE.", leading space, trailing tab, a token of another item (6 cases), duplicate line, missing line, no space after the colon, indented line, and an answer-like line inside the items section are never a go; trailing spaces and CRLF are removed before the match and the hash still matches; (9) hash value checked against an independent SHA-256, one changed character changes it, an answer line change does not, CRLF items hash like LF items, a file without markers exits 1.
- `node 389-decision.cjs check 389-DECISION.md`: `CHECK OK: 11 answer lines, hash matches, HEAD is an ancestor, 11 PENDING`, exit 0.
- Hash mismatch proof: a scratch copy with one word changed inside the markers gives `HASH-MISMATCH expected=b779dcef... actual=284e7076...` and exit 1 (the scratch copy also printed HEAD-NOT-ANCESTOR because it sits outside a git repo: the gate fails closed).
- `node 389-decision.cjs gate 389-DECISION.md D1` on the real card: `D1 PENDING PENDING`, `GATE FAIL`, exit 1.
- 11 lines match `^OWNER-ANSWER-D[0-9]*: PENDING$`. HEAD-AT-DECISION is ce0babce792ee66b33c28eb1c4e0cce6f39e1de8. ITEMS-SHA256 is b779dcef7c0da7da7d326fa8a4ce9d607e12e7b10b69b5938d86917c36e52a7f.
- A grep for non-ASCII characters in both files finds none (so no en-dash or em-dash). Re-read after the Write: the regex escapes in the .cjs file are intact (the self-test passing proves it).
- Scope guard (388-guard.cjs, snapshot 389-02 first, check last): the only offenders are files of peer plans (for example tests/test-389-full-pyramid.cjs); none is a file of this plan.

## Deviations from Plan

None in the work. Two notes:

1. [Process] The plan says to commit nothing in Task 1. Task 1 and Task 2 are committed together in one commit (the plan Task 2 lists the checker among its three files), as the plan text says.
2. [Process] The caller scan live count (310) differs from the committed table (304); see the re-scan note above.

## Known Stubs

None. The checker has no stub left. The word "not implemented" only appears in the RED record above, not in the file.

## Threat Flags

None. The card and the checker read and hash local files only. The checker runs `git merge-base --is-ancestor` with a validated 40-character hex argument and spawns no shell.

## Hard limits kept

No push, tag, version bump, release script or dist regeneration. STATE.md, ROADMAP.md and REQUIREMENTS.md untouched; no gsd-tools state, roadmap or requirements command run. No product file changed.

## UNVERIFIED

- The CLI chain path for autonomous_safe (carried from plan 01) is still untraced; the card says so in D11.
- Whether an older release wrote <room>/.mindrian/mva-brief.json (carried from plan 01); the card says so in D5 and D6.
- Whether pipelines/thesis/02-challenge-assumptions.md, pipelines/PWS_grading/03-build-thesis.md and pipelines/analogy/04-transfer.md run structure-argument as a step or only mention it; the card says so in D11.
- The tests/run-all-* aggregators were not run in this plan (not in scope; a peer session may be running them).

## Self-Check

Self-Check: PASSED. The three created files exist. The self-test passes (66 of 66). The card check exits 0 and 11 PENDING lines are present. The commit that holds these files is named in the handback report and was checked as an ancestor of HEAD after the commit.
