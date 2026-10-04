---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 47
subsystem: close-out
tags: [gap-closure, close-out, requirements, validation, re-review, compositing, d-01, d-08, d-15, d-16, d-19]
requires:
  - phase: 369-35
    provides: "package-lock.json lockstep"
  - phase: 369-46
    provides: "ten non-void journey runs, the navigator's verdict"
  - phase: 369.1-08
    provides: "the sharp prune (payload ceiling 0 findings)"
provides:
  - "tests/run-all-369.sh with the gap closure's eight legs registered once"
  - "the gap-closure re-run record in 369-CLOSE-GATE.md and measured statuses in 369-VALIDATION.md"
  - "369-REVIEW-FIX.md: all 32 review findings with a disposition, CR-02 for the navigator, a re-review note"
  - "Phase 369 requirement rows closed on measured proof (SHELL369-11 re-closed; SHELL369-12, SHELL369-13, REV369-01..16, TS369-08 closed)"
  - "the gap-closure addendum in the research mirror (home commit fb97d1041); the room copy left to the orchestrator"
affects: [369.1-14 (CHANGELOG), orchestrator (room copy, STATE.md, ROADMAP.md, nyquist flip)]
tech-stack:
  added: []
  patterns: ["a row flips only on a command that ran in this session", "a flake is counted with its run, never averaged away"]
key-files:
  created:
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-REVIEW-FIX.md
  modified:
    - tests/run-all-369.sh
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-VALIDATION.md
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-CLOSE-GATE.md
    - .planning/REQUIREMENTS.md
    - /home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md (home repository)
key-decisions:
  - "TS369-08 closed on its own text (the orchestrator's brief allows it; the plan text said stay open): every clause measured, the payload ceiling clause now 0 findings after Phase 369.1 plan 08"
  - "nyquist_compliant stays false for exactly one stated reason: the room copy of the research entry (rows 369-31-02 and 369-47-03) is the orchestrator's cp and cmp"
  - "run 1 of two aggregators failed on one flake each and run 2 was green; both are recorded in 369-CLOSE-GATE.md, neither averaged away"
requirements-completed: [SHELL369-11, SHELL369-12, SHELL369-13, GREC369-05, CM369-03, FEED369-04, SHELL369-09, BAKE369-02, TS369-03, TS369-08, REV369-01, REV369-02, REV369-03, REV369-04, REV369-05, REV369-06, REV369-07, REV369-08, REV369-09, REV369-10, REV369-11, REV369-12, REV369-13, REV369-14, REV369-15, REV369-16]
duration: ~2h
completed: 2026-10-04
---

# Phase 369 Plan 47: Gap closure close-out Summary

The gate re-run on the gap-closed tree is green on a clean run (run-all-369 PASS=63 FAIL=0 SKIP=1, run-all-267 PASS=31, 238 and 289 green, doctor 22 of 22, payload ceiling 0 findings, journey 5 of 5), every one of the 32 review findings has a recorded disposition, and all 77 Phase 369 requirement IDs stand `[x]` on measured proof; what is left is one `cp` and `cmp` for the orchestrator and the navigator's items.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | d7817c712 | tests/run-all-369.sh: six gate and read-surface legs and two Phase 267 regression legs registered once; the dash guard also covers cli-gate-369.cjs and gate-raised.cjs |
| 1 | 6ce5d9e80 | 369-CLOSE-GATE.md "Gap closure re-run (369-47)" and the measured 369-VALIDATION.md statuses |
| 2 | a61b40683 | 369-REVIEW-FIX.md |
| 3 | f4c9a8728 | the Phase 369 block of REQUIREMENTS.md and the one traceability line |
| 3 | c2b4bd61a | VALIDATION row 369-47-02 flipped on the committed REVIEW-FIX |
| 3 (home repo) | fb97d1041 | the research mirror /home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md, explicit path, `git -C /home/jsagi commit --only` |

## What was measured (all in this session, HEAD d7817c712, nvm Node 22.23.1)

| Command | Result |
|---------|--------|
| `bash tests/run-all-369.sh` run 1 | PASS=62 FAIL=1 SKIP=1: the Phase 289 precondition probe failed because `test-289-cli-card-dual-era.cjs` failed its process-hygiene leg inside it (my own probe script was running at that moment; cause not established); standalone 2 of 2 PASS=6 and the probe PASS |
| `bash tests/run-all-369.sh` run 2 (nothing else running) | PASS=63 FAIL=0 SKIP=1 (the SKIP is the exact-floor install, ENV GAP: no Node 22.18.0, no Docker) |
| `bash tests/run-all-267.sh` run 1 / run 2 | PASS=30 FAIL=1 SKIP=3 (`267: local server dual era`, process-hygiene leg, nothing of mine running) / PASS=31 FAIL=0 SKIP=3 (three Phase 267 ENV GAP legs); the dual-era test alone 3 of 3 PASS=5 |
| `bash tests/run-all-238.sh`, `bash tests/run-all-289.sh` | PASS=10 FAIL=0; PASSED=47 FAILED=0 SKIPPED=0 KNOWN=1 |
| `bash tests/run-all-198.sh` | Passed 15, Failed 1: SPEC-5 on-stop 618 against 570 (pre-existing since July) |
| connector registry, orchestration projection, render coverage, shape declaration, tool honesty, gen-mcp-adapter, `build-ui-shell --check` | all exit 0 (270 dist files verified, source hash 539768ed075ce362) |
| `node scripts/check-release-payload-ceiling.cjs --check` | OK, 0 findings (2276 entries, 43,784,988 bytes unpacked) |
| `node scripts/doctor.cjs --acceptance` | 22 of 22 |
| `node tests/test-369-bakeoff-agent-native.cjs --built`; `MOS_369_STRICT_CEILING=1 node tests/test-369-ui-dist-fresh.cjs` | 13 passed 0 failed; 18 passed 0 failed 0 skipped |
| `node tests/e2e-369/journey.cjs` x 5 standalone | 5 of 5 exit 0, 0 void (`git status --short -- lib bin scripts ui` empty before and after each); gate click to recorded 60 to 95 ms (median 79), raised to listed 812 to 820 ms (median 814), restart catch-up 2798 to 2818 ms (median 2805), lost writes 0, answered_elsewhere replays 1 in every run |
| Reviewer probes (ledger overwrite, `isOurShell`, tampered dist) | all three fixed behaviours confirmed; before and after in 369-REVIEW-FIX.md |

The four VALIDATION rows: 369-13-03 green (zod4 PASS=4), 369-16-02 green (`--built` 13 passed), 369-28-02 green (ceiling 0 findings, dist-fresh 18 passed strict), 369-31-02 green before my addendum and now differs by design (room copy pending). Every gap row 369-33-01 to 369-47-03 has a status other than pending except 369-47-03 (the same room copy). `nyquist_compliant` stays false with that single reason written beside it (the five core e2e legs and HTTP arm 8 ran and passed).

## Reds that are not this phase's (re-measured, named)

test-198-adapter-budget (on-stop 618/570, unowned); test-237-approve-executes and test-237-autonomy-parity (MUTATION legs, Phase 289 cascade); test-345-gate-ratify (red under the real ~/MindrianRooms registry, `no_bound_room`; PASS 33 checks under a clean HOME); test-363-mcp-tool M3 to M7 (PASS 11 FAIL 4); test-366-gated-term-release R6b (PASS 27 FAIL 1); test-353-filing-gate (EVENT_TYPES size 102); test-354-framework-command-ledger T2 (stamp drift). **Cleared:** test-365-floor-gate H6 is green now (PASS 59 FAIL 0): plan 369-41's zod4 move cleared it. The four post-369 items are routed to a `/gsd-quick` by the orchestrator, as at 369-31.

## Deviations from Plan

**1. [Orchestrator override of plan text] TS369-08 closed instead of left `[ ]`**
- The plan said "stays `[ ]` with the Phase 369.1 pointer"; the brief says it may close if its own text is met. Every clause was measured: freshness gate at release.sh Step 2.4 and `build-ui-shell --check` exit 0; no `node_modules` in the dist; RULE 5 and RULE 8 sentences present (docs/RELEASE-CEREMONY-RULING-SYSTEM.md lines 52 and 81); root dependencies are the navigator's 2026-10-03 amendment (as at 369-31); payload ceiling 0 findings; installed layout runs it (dist-fresh arm 8, 18 passed strict). The Open line stays as history. Consequence: Task 3's own automated verify (`grep -c '^- \[ \] \*\*TS369-08'` equals 1) reads 0 by design; every other acceptance grep holds (16 closed REV rows carry 16 `Measured:` lines; zero `[ ]` rows in the block; no dash hits).

**2. [Rule 3 - ordering] Row 369-31-02 and the nyquist flip left to the orchestrator**
- The addendum makes the mirror differ from the room copy, and the room write is refused by the hook, so the row cannot be both green and honest. Written as "green before the addendum, differs by design, orchestrator's `cp` and `cmp`".

**3. [Plan header] run-all-369.sh's "written once" header amended**
- The header says no later plan edits the leg list; plan 47 is the stated exception (registered once). The header now says so.

**4. [Command text] Row 369-34-01 names the pre-resolution RCA path**
- The RCA moved to .planning/debug/resolved/ when 369-34 resolved it; the row's status cites the measured resolved path (`grep -c "kind: rca"` prints 1) and says the command text names the old path.

No auth gates. STATE.md, ROADMAP.md, CHANGELOG.md, the Phase 369.1 REQUIREMENTS block and every 369.1-owned file untouched (a peer's uncommitted edits to 369.1-MANUAL-VERIFICATION.md and 369.1-VALIDATION.md were visible in `git status` and left alone).

## ROOM COPY: the one step for the orchestrator

The room write is the one the mos write-scope hook refused at 369-31 (active room egain-des-liquid-conductor: "write to rethinking-mindrianos denied ... To authorize, run: /mos:rooms switch rethinking-mindrianos"). It was not attempted and not worked around. With the navigator's authorization, run exactly:

```bash
cp /home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md /home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md
cmp /home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md /home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md; echo cmp=$?
```

`cmp` must print `cmp=0`. Today it prints `EOF on the room copy after byte 10834` (the room copy still holds the 369-31 content; the mirror carries the 84-line addendum, home commit fb97d1041). Then commit the room copy in the home repository with an explicit path, as 94878236d did. When `cmp` exits 0: flip VALIDATION rows 369-31-02 and 369-47-03 to green, tick the last sign-off box and set `nyquist_compliant: true` in 369-VALIDATION.md (nothing else keeps it false).

## CHANGELOG handoff (for Phase 369.1 plan 14's owner or the orchestrator; CHANGELOG.md was not edited)

369.1-14 already wrote the dist, sharp and `bin/` to `scripts/` lines under `## [Unreleased]`. These are Phase 369's remaining lines, in the file's style, to route under the matching headings:

### Added
- **Ask Larry about this, inside the workspace.** On an Evidence item the workspace shows the one line to copy into Claude Code and a "Check for Larry's proposal" button; a proposal Larry files in the room opens as a decision you can answer. With nothing filed yet it says so in plain words and raises nothing.
- **Decisions Larry raises in Claude Code now appear in the workspace**, in Work and in Decisions ("Raised by Larry outside this browser."), with no reload, and you answer them there. Only you can approve. Larry's own session then sees "answered elsewhere" with your answer, and a halted step carries on exactly once.
- **A new read-only tool, `gate_list`,** lists the open decisions of the room you are bound to. `gate_render` takes two new inputs: `mirror_of` (draw a copy of a decision raised in another session of the room, from the room's own record) and `approving` (which options mean yes, so an approve that names Hold is refused). `gate_render` now also records the card's contract in the bound room (never a session identity), so other surfaces can show the gate.

### Changed
- **Opening the workspace no longer passes a sign-in link through the conversation.** `/mos:dashboard shell` opens your browser already signed in; the one-time link is printed only in a real terminal, and the workspace accepts a sign-in only from a real browser navigation. The workspace server now starts with an allow-listed environment (no API keys, no `NODE_OPTIONS`), recognizes its own process exactly before stopping it, and writes its control token to a private file it creates itself.
- **After a restart, a decision you already made reads "This decision was already recorded."** instead of "no longer open", and a failed room lookup keeps the decision with a "Check again" action instead of dropping it.
- **`room_search` no longer follows a symlink**, inside or out of the room (an in-room alias is skipped too).
- **The release freshness check (`node scripts/build-ui-shell.cjs --check`) now proves every byte** of the committed workspace build, re-runs the build's own output checks, and follows the pinned next, react, react-dom and ajv versions; the dist override is honoured by the check only.

### Fixed
- **A decision can no longer read "expired" after it was recorded**, a live decision id can no longer be taken over by another session, the strategy goal file is written only after the answer commits (once per decision), and a changed subject or cited evidence is caught inside the write transaction. A failed lookup is its own retryable answer, `replay_lookup_failed`.
- **`room_changes` refuses a cursor beyond the log** (`checkpoint_expired`) and reads a page's metadata and rows in one transaction, so a concurrent compaction cannot leave a silent gap; the workspace's change relay now notices a reset log or epoch, a hint stream ends with its browser session, and a room feed never pairs one room's document with another room's checkpoint.

## Navigator items (listed, not closed)

- **CR-02:** an MCP `gate_answer` has no human principal; any MCP session can mint and answer its own gate and the approve is attributed to the navigator. Options in 369-REVIEW-FIX.md: (1) a human-only loopback route, (2) an `answered_via` marker with honest attribution, (3) leave it and say so in the canon. Recommendation: (2) now, (1) later. Residual in 369-SESSION-CONTRACT.md: a same-user process forging the three navigation headers inside the 60 s start window.
- **IN-01 to IN-11** (IN-07 and IN-11 untouched per 369-45), each with a one-line recommended disposition in 369-REVIEW-FIX.md.
- The 404-page copy (`NOT_FOUND`, 369-20); the duplicate "Reconnect now" and the "Catching up" fallback (369-24); Research A5 (rank-only recommendation against the 0.70 rule); MCPV2-13 (Phase 267's Desktop smoke); the Desktop and Cowork host build numbers (not reported); the never-do mirrored proposal (`decision_node_missing`) and the 1,000-character mirrored preview (369-36); no issue was raised by the navigator in 369-46 ("approved", no notes).
- **Handed to Phase 369.1 plan 04** (lib/mcp/daemon-lifecycle.cjs): WR-15 and the daemon half of WR-13.
- **Hygiene flake family** (tests that sweep repo-anchored `mindrian-mcp-server` pids: test-267-mcpv2-dual-era, test-289-cli-card-dual-era, test-369.1-bin-relocation): one failure of two families seen in this session's first aggregator runs; owner Phase 369.1 or a post-369 quick (sweep only processes the test started).

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or file access: this plan edited tests, planning records and a research note. The research addendum carries architecture and counts only (Canon Part 8, T-369-47-04).

## Self-Check: PASSED

- Created and modified files exist: 369-REVIEW-FIX.md, 369-47-SUMMARY.md, tests/run-all-369.sh, 369-VALIDATION.md, 369-CLOSE-GATE.md, REQUIREMENTS.md, the research mirror.
- Commits d7817c712, 6ce5d9e80, a61b40683, f4c9a8728, c2b4bd61a are ancestors of HEAD; fb97d1041 is on the home repository's HEAD.
- No STATE.md, ROADMAP.md, CHANGELOG.md, Phase 369.1 REQUIREMENTS rows or 369.1-owned file was written; hyphens only (`LC_ALL=C grep -nP "\xE2\x80\x94|\xE2\x80\x93"` over every file this plan touched prints nothing).
