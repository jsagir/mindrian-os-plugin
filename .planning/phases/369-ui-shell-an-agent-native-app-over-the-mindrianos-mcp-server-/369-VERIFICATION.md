---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
verified: 2026-10-04T18:00:00Z
status: human_needed
score: 8/8 goal clauses verified (automated); 5 human items open, none a gap
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed:
    - "Gap 1 (BLOCKER): a person can start and reach a decision from the shipped shell"
    - "Gap 2: a restarted shell reads 'already recorded' for an old decision"
    - "Gap 3: journey step 6 flake (cause established as a peer test sweeping the daemon pid; the journey now voids such a run instead of failing silently)"
    - "Gap 4: three phase-caused reds (zod4 room_list, lockstep, stale --built assertion) and TS369-08 (sharp)"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
human_verification:
  - test: "CR-02 navigator decision (Critical review finding, not built, by ruling)"
    expected: "Navigator picks one of the options in 369-REVIEW-FIX.md: (1) a human-only loopback route for gate_answer, (2) an answered_via marker with honest attribution (recommended now), (3) leave it and say so in the canon. Until then an MCP session can mint and answer its own gate and the approve is attributed to the navigator; the shell's own D-15 path (cookie, CSRF, Origin, single-use nonce) is intact and proven."
    why_human: "Product and security-policy decision inherited from Phases 198/289; the review itself says the fix is a server-side design choice"
  - test: "Record the Claude Desktop and Cowork host build numbers for the D-03 plain line"
    expected: "Build numbers written into 369-MANUAL-VERIFICATION.md beside the navigator's approval (currently 'not reported')"
    why_human: "Only a person with the host app open can read its build number"
  - test: "MCPV2-13 Claude Desktop smoke (Phase 267's owed check)"
    expected: "Desktop lists the MindrianOS tools; room_list shows the two D-03 sentences"
    why_human: "Real host application; owned by Phase 267 follow-ons"
  - test: "Wording rulings: NOT_FOUND 404 copy (369-20), duplicate 'Reconnect now' placement and 'Catching up' fallback (369-24), Research A5 (rank-only recommendation vs the 0.70 Brain-confidence rule)"
    expected: "Navigator rulings recorded"
    why_human: "Product and canon judgment"
  - test: "Remaining Info findings IN-01..IN-11 and the never-do mirrored proposal / 1,000-character mirrored preview (369-36)"
    expected: "Dispositions per the one-line recommendations in 369-REVIEW-FIX.md"
    why_human: "Navigator items by the review-fix record; none blocks a goal clause"
---

# Phase 369: UI shell over the MindrianOS MCP server - Verification Report (re-verification)

**Phase Goal:** Ship the fourth surface: a browser workspace whose ONLY access to a room is the MindrianOS MCP server (Streamable HTTP, per-connection session mode), where a decision gate is a real button with the recommendation preselected, the room view stays current without a reload through a one-way RxDB read copy, every pixel follows Design Canon v3, no outside host is contacted, CJS-only is lifted for TypeScript under erasable-only rules, and the shell ships as release-built assets never built on the user's machine.
**Verified:** 2026-10-04
**Status:** human_needed (all automated and code-level checks pass; no gap remains; five human items are listed, CR-02 the one that matters)
**Re-verification:** Yes, after gap closure (plans 369-33 to 369-47 on top of the original 32)

The stance was that the gap closure did not land. The evidence moved it: each of the four gaps closes in code and in a command run in this verification, not only in a SUMMARY.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Only access to a room is the MCP server (sessionful Streamable HTTP, one session per browser session) | VERIFIED | Unchanged from the first pass; `test-369-shell-server` re-run 43 passed; `run-all-369` legs for shared-core and sessionful-acceptance PASSED. |
| 2 | A decision gate is a real button with the recommendation preselected | VERIFIED | `gate-button.cjs` PASSED in the aggregator (18 arms per the requirement line); recommendation seeded from the contract; `gate-model.ts` `classifyAnswer` maps `ok:true` only to "recorded". |
| 2b | A person can reach a decision from the shipped shell (previous BLOCKER) | VERIFIED (closed) | Three independent routes, all seen in code and in the journey run (below): the Evidence "Ask Larry about this" control, gates raised by Larry in Claude Code listed in Work and Decisions, and the launcher default source `adapter`. |
| 3 | Room view current without reload via one-way RxDB read copy | VERIFIED | `replica` e2e leg PASSED in the aggregator; journey step 7 this run: 32 items, 0 missing, catch-up 2805 ms. |
| 4 | Every pixel follows Design Canon v3 | VERIFIED + navigator "approved" | canon-skin and egress-and-canon legs PASSED; navigator approved the 31 captures and, on 2026-10-04, the two new flows. |
| 5 | No outside host is contacted | VERIFIED | Journey step 8 this run: 762 requests, one host `127.0.0.1:34411`, 0 CSP events. |
| 6 | CJS-only lifted for TypeScript under erasable-only rules | VERIFIED | CLAUDE.md Conventions carry the lifted rule; constitution, ts-erasable, walled-manifest, hook-require-graph legs PASSED. Exact-floor Node 22.18.0 leg SKIPPED (ENV GAP, binary absent, stated). |
| 7 | Shell ships as release-built assets, never built on the user's machine, payload ceiling holds | VERIFIED (was PARTIAL) | `node scripts/build-ui-shell.cjs --check`: fresh, source hash 539768ed075ce362, 110 files, 270 dist files verified (the check now re-hashes every dist byte, 369-45). `node scripts/check-release-payload-ceiling.cjs --check`: OK, 0 findings (run three times: standalone and in the aggregator). sharp pruned by Phase 369.1 plan 08. Built strings "Check for Larry" and "Raised by Larry outside this browser" are present in `lib/ui-shell/dist`, so the shipped assets carry the new controls. |
| 8 | Chassis chosen by navigator at a Decision Gate (D-07) | VERIFIED | 369-BAKEOFF-DECISION.md; bakeoff measure leg PASSED. |

**Score:** 8 of 8 clauses verified.

### Gap closure, checked in code

| Gap | Closure claim | Code evidence read in this verification | Status |
|-----|---------------|------------------------------------------|--------|
| 1a | A CLI-shaped stdio gate reaches the shell list | `lib/mcp/tools/gate.cjs` registers `gate_render` (records a contract-only row, no session identity) and `gate_list`; `lib/mcp/gate-raised.cjs` is the store; `ui/shell/server/actions.ts` `listOpenGates` merges the session's gates with `gateList(...)` results, flags `raised_elsewhere: true`, drops stale mirrors, and sets `unavailable` on a failed lookup rather than hiding gates. | VERIFIED |
| 1b | It is answered through a mirror | `gate_render` takes `mirror_of` (ledger id of its own, source gate must be open in the same room; `mirror_mismatch`, `unknown_gate`, `mirror_source_answered`); `actions.ts` answers under the mirror's `mcp_gate_id` and `scrubId`s it from the page; the source replays `answered_elsewhere` (gate.cjs 919-1009); `classifyAnswer` reads it as "already recorded". Journey step 5 this run: "listed 823 ms after Larry raised it, no reload; Approve recorded one node; the CLI answer replayed answered_elsewhere". | VERIFIED |
| 1c | `askClaude` is called from the Evidence control | `ui/shell/client/views/evidence/AskLarry.tsx` `check()` calls `callAction('askClaude', {selectedNodeId, question})`; on `ok` with `gate_id` it navigates to `/gate/<id>`; `no_proposal` reads as honest "nothing filed" copy; the control never answers a decision. Journey step 4 this run: no proposal, then Larry's filed proposal opened the gate; Approve recorded once, 66 ms. | VERIFIED |
| 1d | Default does not answer no_proposal | `lib/ui-shell/launch.cjs` `proposalSourceFromEnv()` returns `adapter` unless the environment says `fixed`; a running shell on another source is replaced (`rec.proposalSource === proposalSource`). | VERIFIED |
| CR-01 | Launcher never prints the link to non-TTY output and opens `/auth/start` | `launch.cjs` `shouldPrintLink` is true only for a TTY without `--open`; the non-print path arms `{start:true}` through the 0600 control channel, no code is minted, and the opener gets `startUrlFor(port)` = `/auth/start`; if no browser opens it prints a command for the person's own terminal, not a link. `test-369-launch-surface` 30 passed. Journey step 1 asserts the launcher printed no code. | VERIFIED |
| CR-01 | A curl-shaped exchange is refused | `ui/shell/server/auth.ts` `isBrowserNavigation` requires `Sec-Fetch-Site: none`, `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`; both `handleBootstrapRequest` and `handleStartRequest` return 403 before the code is read or the slot is spent. `test-369-shell-server` 43 passed (live curl-shaped exchange 403). Residual (a same-user process forging the three headers) is CR-02's class, recorded in 369-SESSION-CONTRACT.md. | VERIFIED |
| 2 | Restart reads "already recorded" | `actions.ts` readGate checks the room for an already-answered gate and issues no nonce; copy `'This decision was already recorded.'`; journey step 7 this run: "old gate id: browser says already-recorded, room says replayed:true", one node. | VERIFIED |
| 3 | Step-6 flake | Root cause recorded in 369-34 and the resolved debug file (`.planning/debug/resolved/369-journey-step6-catch-up-stall.md`): a peer hygiene test SIGKILLing repo-anchored daemons (ENV GAP); the journey now voids such a run (DAEMON-EXIT-UNEXPECTED). This verification: journey 1 of 1 non-void pass, tree clean before and after; aggregator journey leg PASSED; 369-46 recorded 10 of 10 and 369-47 5 of 5. Family owner Phase 369.1 / post-369 quick. | VERIFIED (cause is environmental, tracked) |
| 4 | Three phase-caused reds and TS369-08 | zod4 contract, lockstep and `--built` all inside the green aggregator (PASS=63 FAIL=0); run-all-369 includes the release payload ceiling leg PASSED; TS369-08 `[x]` with a Measured line. | VERIFIED |

### Probe and Aggregator Execution (own process, this verification)

| Command | Result | Status |
|---------|--------|--------|
| `bash tests/run-all-369.sh` (run once, nothing of mine running alongside) | `Phase 369: PASS=63 FAIL=0 SKIP=1`, exit 0. SKIP = exact-floor Node 22.18.0 install (ENV GAP: binary and Docker absent). No hygiene arm flaked, so no leg was re-run alone. Replica, views copy, views e2e, journey, human-only (PASS=10 incl. HTTP arm), payload ceiling and render coverage legs all PASSED. | PASS |
| `node tests/e2e-369/journey.cjs` (standalone, spot-run) | 8 of 8 steps PASS in 23 s; metrics: click to recorded 66 ms, raised to listed 823 ms, restart catch-up 2805 ms, lost writes 0, answered_elsewhere replays 1. `git status` of lib/bin/scripts/ui empty before and after (non-void). | PASS |
| `node scripts/build-ui-shell.cjs --check` | fresh, 270 dist files verified | PASS |
| `node scripts/check-release-payload-ceiling.cjs --check` | OK, 0 findings | PASS |
| `node tests/test-369-launch-surface.cjs`, `node tests/test-369-shell-server.cjs` | 30 passed 0 failed; 43 passed 0 failed | PASS |

I did not re-run run-all-267, run-all-289 or `doctor --acceptance` here; the 31/0/3, 47/0/1 and 22/22 figures are the close gate's and the generator and ceiling checks that sit inside run-all-369 re-ran green.

### Requirements Coverage

All 77 IDs (59 plan-time: TS369-01..08, CHG369-01..06, FEED369-01..05, SESS369-01..04, GREC369-01..05, HUM369-01..03, RXP369-01..03, CANON369-01..07, SHELL369-01..11, BAKE369-01..04, CM369-01..03; 18 gap-closure: SHELL369-12, SHELL369-13, REV369-01..16) were extracted from the REQUIREMENTS.md Phase 369 block and compared with the `requirements:` frontmatter of the 47 plans: the two sets are identical (no orphan, no unclaimed row). All 77 rows are `[x]` and zero `[ ]` remain in the block. SHELL369-11 carries a Reopened line and a new Measured line from 369-47; TS369-08 carries its Open history and a Measured line. Spot-read Measured lines for TS369-08, SHELL369-11, 12, 13 name commands that I re-ran or that sit inside the green aggregator. Two cautions: (a) the Measured text is the executor's; my own evidence for each is in the table above; (b) REV369 rows are 16 closures against 32 review findings: 18 fixed, 2 handed to Phase 369.1 plan 04 (WR-13 daemon half, WR-15, both in `lib/mcp/daemon-lifecycle.cjs`, outside 369's files), 12 navigator items (CR-02, IN-01..IN-11). Status: SATISFIED for every row; the handed-off and navigator items are not requirement rows.

### Anti-Patterns and Debt Markers

`TBD|FIXME|XXX` scan over `lib/mcp/gate-raised.cjs`, `lib/mcp/tools/gate.cjs`, `lib/ui-shell/launch.cjs`, `scripts/build-ui-shell.cjs` and every tracked `.ts`/`.tsx` under `ui/shell` and `ui/shared/src` (generated adapter excluded): no hits. The `unconfiguredSource` `no_proposal` path is now honest copy behind a real control, not a stub. Em-dash guard leg PASSED in the aggregator. 369-34's SUMMARY lacks the literal "Self-Check: PASSED" string (it has a "## Self-Check" section); not a gap.

Known out-of-phase reds (owners named, not counted): test-198-adapter-budget, test-237 MUTATION, test-345 under the real registry, test-363 M3-M7, test-366 R6b, test-353 EVENT_TYPES, test-354 ledger stamp. Hygiene-sweep flake family (test-267-mcpv2-dual-era, test-289-cli-card-dual-era, test-369.1-bin-relocation SIGKILL repo-anchored `mindrian-mcp-server` pids): owner Phase 369.1 or a post-369 quick.

### Research trail and Nyquist

`cmp /home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md /home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md` exits 0 (byte-identical, home repo commit 4653c2cbe). 369-VALIDATION.md now shows `nyquist_compliant: true`, rows 369-31-02 and 369-47-03 green.

### Human Verification Required

1. **CR-02 (Critical review finding, navigator decision).** An MCP `gate_answer` has no human principal: any MCP session can mint and answer its own gate and the approve is attributed to the navigator. Inherited from Phases 198/289; Phase 369's shell path is protected (nonce, cookie, CSRF, Origin, `human_only`), and a direct MCP answer from the adapter session on a shell gate is `session_mismatch` (HUM369-03 proven). Options in 369-REVIEW-FIX.md: (1) human-only loopback route, (2) `answered_via` marker with honest attribution (recommended now), (3) leave it and say so in the canon. I treat it as human_needed rather than a gap because the phase's own requirement (HUM369-01..03) is met and the roadmap goal speaks of the button, not of server-side principal binding; if the navigator reads "only a person approves" as a server invariant, this becomes a gap for a follow-on phase.
2. Desktop and Cowork host build numbers for D-03 (navigator approved; numbers not reported).
3. MCPV2-13 Claude Desktop smoke (Phase 267's owed check).
4. Wording rulings: 404 copy, duplicate "Reconnect now", "Catching up" fallback, Research A5.
5. IN-01..IN-11 dispositions and the 369-36 mirrored-preview items.

### Gaps Summary

No gap remains against the eight goal clauses. The previous BLOCKER (a person could not start or reach a decision) is closed three ways and proven by a fresh journey run on the shipped dist: Ask Larry on Evidence raises a gate from a filed proposal, a gate Larry raises in Claude Code appears in Work and Decisions with no reload and is answered in the browser while the CLI session replays `answered_elsewhere`, and the launcher defaults to the adapter source and signs the person in without printing a link. The payload ceiling passes and the three phase-caused reds are gone. What is left is human: the CR-02 policy choice, host build numbers, one Desktop smoke owed by Phase 267, and wording rulings.

## Previous verification (2026-10-04, gaps_found)

The first pass scored 6 of 8 clauses. The engine (change feed, one-way read copy, human-only answer, recovery contract, Canon v3, loopback-only egress) reproduced green, but a person could not start a decision from the shipped shell (CLI-raised gates invisible, no browser control called `askClaude`, proposals off by default), the payload ceiling failed on `sharp`, an old decision read "no longer open" after a restart, journey step 6 flaked about 1 in 10, and three phase-caused reds (zod4 `room_list`, lockstep, a stale `--built` assertion) had no owner. Plans 369-33 to 369-47 addressed each; this report supersedes it.

---

_Verified: 2026-10-04_
_Verifier: Claude (gsd-verifier)_
