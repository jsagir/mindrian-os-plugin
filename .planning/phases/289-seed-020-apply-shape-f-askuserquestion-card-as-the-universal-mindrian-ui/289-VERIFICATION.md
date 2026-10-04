---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
verified: 2026-10-04T07:10:00Z
status: human_needed
score: 9/9 must-haves verified (22/22 requirement IDs accounted for and satisfied in code)
overrides_applied: 0
re_verification: false
gaps: []
human_verification:
  - test: "After the next release is cut and picked up by the installed plugin, fire /mos:suggest-next (or any gated command) on the Claude Code CLI"
    expected: "An AskUserQuestion card renders and no elicitation dialog opens; record the Claude Code build number"
    why_human: "The tests prove the server's choice of rung; the host's rendering is observed by a person. A main commit is not live until released and picked up (289-VALIDATION.md Manual-Only row, CARD289-02; 2026-10-04 status PENDING A RELEASE)."
---

# Phase 289: SEED-020 Shape F card as the universal chooser + SEED-104 gate defects - Verification Report

**Phase Goal:** Shape F (AskUserQuestion card) is the universal Mindrian chooser; the --list text fallback is the floor on non-interactive surfaces; reach-list renderer and shape-f1-renderer.cjs are the reused core. Folded in: (a) "Normal card on CLI" ruling, tested on both protocol eras; (b) elicitation default = recommended option, field titled as instruction; (c) consumeGate checks session first, deletes only on a valid consume (owner-after-stranger); (d) rendered gate contract carries the recommended option id.
**Verified:** 2026-10-04, HEAD 90fbae612, node v22.23.1
**Status:** human_needed (all automated truths verified; one host-rendering observation cannot be made until a release is installed)
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | One shared `detectGateCapabilities` decides the rung; five tool copies are one-line delegates; Claude host surface (cli/desktop/cowork) gets the card even when elicitation is declared (D-02/D-03, CARD289-01) | VERIFIED | `lib/mcp/gate-render.cjs:131-190` read: `elicitation = declared && (!claudeSurface || nonClaudeHost)`; exported at :663. `gate.cjs:325`, `research.cjs:103`, `chain.cjs:140`, `sensors.cjs:189`, `stop-gate.cjs:34` each `return gateRender.detectGateCapabilities(server, ctx)`. `pickRenderer` untouched (lines ~120-128). |
| 2 | "Normal card on CLI" holds on BOTH protocol eras incl. HTTP daemon (CARD289-02) | VERIFIED | Re-ran `tests/run-all-289.sh`: dual-era leg PASS=6 FAIL=0: stdio 2025 cli+desktop, stdio 2026, HTTP 2026, HTTP legacy, each "elicitation requests seen: 0; renderer askuserquestion"; process hygiene clean. |
| 3 | Ruling artifact with `Ruling:` line naming the dual-era test, canon tension, what did not change (CARD289-03/04) | VERIFIED | `289-CLI-CARD-RULING.md` read: `Ruling:` line names `tests/test-289-cli-card-dual-era.cjs`; gate.cjs keeps literal "2.1.280" (count 2); old ruling text only survives as "superseded" references (gate.cjs:12, :320); test-267 premise/dual-era arms flipped and green. |
| 4 | Elicitation survives only for recognized non-Claude hosts, `requestedSchema.default` = recommended id, instruction title (ELICIT289-01/02, CARD289-06) | VERIFIED | `gate-render.cjs:402-430` `buildElicitRequestedSchema`: single-select `default = card.recommended`, title "Choose: A / B" capped 120; multi default only explicitly flagged ids. Ran `test-289-elicit-default.cjs` PASS=13 FAIL=0 incl. live "Visual Studio Code" gets ONE defaulted dialog, "some-new-client" gets the card, SDK safeParse. |
| 5 | consumeGate checks session before its one delete; `peekGate` non-consuming; gate_answer and chain resume peek, refuse, then consume with no await between; owner-after-stranger (LEDGER289-01..05) | VERIFIED | `gate-ledger.cjs:103-137` read: session mismatch returns before the only `_ledger.delete(` (:111); `peekGate(gateId, sessionId)` has two params, never mutates. `gate.cjs:446` peek, refusals (chosen, resume owner, bound room, DB), `:529` consume before first write. `chain.cjs:867-883` peek, session/chosen refusals, then consume. `test-238-session-scoped-ledger` has the owner-after-stranger arm (ok); `run-all-238` PASS=10 FAIL=0; ledger test arms inside run-all-289 green. |
| 6 | Rendered contract carries the recommended option id (CONTRACT289-01..04, CARD289-05) | VERIFIED | `gate-render.cjs:222-234, 334, 536-542, 595-614`: `normalizeCard` derives recommended (flag, else lowest finite rank, else null); rung (b) sets `contract.recommended` single-select only, rows boolean; rung (c) marks line; multi-select stays null (Canon App. D 32). Ran `test-289-contract-recommended.cjs` PASS=23 FAIL=0: path `rendered.contract.recommended` found BY VALUE on a live daemon gate; "with the 3 options above" real count. `research.cjs` passes `recommended` on grant/deep_plan/filing cards (lines 144, 224, 465, 494). |
| 7 | Menus: /mos:pipeline chooser is an F.1 card with `--list` floor; soft gaps converted or allow-listed; bare-text fence; test-192 healed (MENU289-01..03) | VERIFIED | `commands/pipeline.md`: AskUserQuestion in allowed-tools (:34), F.1 chain-select hitl stage, card + "Text floor" on `--list` (:112-114), resume card (:122), "Do not auto-select." kept. `test-289-menu-fence.cjs` PASS=17, hits=7 passed=5 allow_listed=2 failures=0 stale=0; allow-list has exactly two reasoned entries (ignite, systems-thinking). `test-192-menu-sweep-live-selectors` all assertions PASS. radar/deck/find-analogies/new-project/scientific-roadmap each carry AskUserQuestion. |
| 8 | VAL289-01: `run-all-289.sh` written once, exit 77 not a pass, dual-era leg last, closing 369 probe leg | VERIFIED | Re-ran: PASSED=41 FAILED=0 SKIPPED=1 (369 probe, file absent as expected) KNOWN=1 (test-237 MUTATION), exit 0; dual-era leg ran last and passed. |
| 9 | CLOSE289-01: SEED-020 resolved with shipped scope; Theo handoff in the phase dir; no Theo edit | VERIFIED | Seed `status: resolved`, names 9a18fe81d, 28f95106b, Phase 192, Phase 289; `289-THEO-HANDOFF.md` names gate-render.ts:38/106 and the ruling; no Theo file edited by 289 commits. |

**Score:** 9/9 truths verified

### Requirements Coverage (cross-referenced against PLAN frontmatter and REQUIREMENTS.md lines 4637-4658)

All 22 IDs are declared in at least one PLAN `requirements:` field, are `[x]` with a Measured line in REQUIREMENTS.md, and have code evidence above. No orphaned IDs (REQUIREMENTS.md Phase 289 block lists exactly these 22; no additional 289 IDs).

| IDs | Plans | Status |
|-----|-------|--------|
| CARD289-01..06 | 01, 04, 07, 02 | SATISFIED (truths 1-4, 6) |
| LEDGER289-01..05 | 02, 05 | SATISFIED (truth 5) |
| CONTRACT289-01..04 | 02, 04, 07 | SATISFIED (truth 6) |
| ELICIT289-01..02 | 03, 04, 07 | SATISFIED (truth 4) |
| MENU289-01..03 | 03, 06, 08 | SATISFIED (truth 7) |
| VAL289-01, CLOSE289-01 | 01, 09 | SATISFIED (truths 8, 9) |

### Key Links

| From | To | Status | Details |
|------|----|--------|---------|
| five tool modules | `gateRender.detectGateCapabilities` | WIRED | one-line delegates, grep confirmed |
| `gate_answer` handler | `gateLedger.peekGate` then `consumeGate` | WIRED | gate.cjs:446 and :529 (binding branch :499) |
| `_resumeFromGateAnswer` | peek then consume | WIRED | chain.cjs:867, :883 |
| `normalizeCard.recommended` | rung (b)/(c) contract and elicitation default | WIRED | gate-render.cjs:334, 422, 542, 614 |
| `research.cjs` options | normalizeCard recommended | WIRED | test arm "normalizeCard over grantOptions recommends approve_standing" |
| 369 precondition probe | `rendered.contract.recommended`, `peekGate`, ruling file | READY | all three exist; probe file is 369's to write (SKIPPED leg, expected) |

### Behavioral Spot-Checks (all re-run by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase suite | `bash tests/run-all-289.sh` | PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1, exit 0 | PASS |
| Contract by value, live daemon | `node tests/test-289-contract-recommended.cjs` | PASS=23 FAIL=0 | PASS |
| Elicitation default, live | `node tests/test-289-elicit-default.cjs` | PASS=13 FAIL=0 | PASS |
| Owner-after-stranger | `node tests/test-238-session-scoped-ledger.cjs` | arm ok | PASS |
| Phase 238 suite | `bash tests/run-all-238.sh` | PASS=10 FAIL=0 | PASS |
| Menu fence + 192 | `node tests/test-289-menu-fence.cjs`; `test-192-menu-sweep-live-selectors.cjs` | 17/17; all PASS | PASS |
| Tool honesty | `node scripts/check-tool-honesty.cjs --check`; `test-276-tool-honesty-findings-closed.cjs` | exit 0; 148 passed 0 failed | PASS |
| 267 dual-era (flipped) | `node tests/test-267-mcpv2-dual-era.cjs` x3 | PASS=5 FAIL=0 x3 | PASS (see note) |

### Out-of-phase regressions (NOTED, not 289 gaps)

Re-measured here: `run-all-198` Passed 15 Failed 1 (adapter budget); `run-all-267` lockstep (package.json lists next/react/react-dom, lockfile does not) and zod4 `tool:room_list:description` red. Both match the commit evidence in 289-VALIDATION.md (369-19 `28d9196fe`, 369-22 `428ab60a0`). I checked the file list of every commit whose subject carries `(289`: none touches package.json, npm-shrinkwrap.json, scripts/, or any room tool, so no 289 commit caused any of the five red legs (on-stop budget, lockfile/shrinkwrap, release payload ceiling, room_list description, test-354 ledger beta.48 vs beta.56). Not re-run by me: run-all-354 and doctor --acceptance (cause analysis taken from the close-out table; the touched-file check above is consistent with it).

One extra observation: `test-267-mcpv2-dual-era.cjs` process-hygiene arm failed once inside `run-all-267` and once standalone, then passed 3 of 3 on rerun. Its check is a pgrep before/after of any new `bin/mindrian-mcp-server.cjs` PID anchored to this repo; the peer Phase 369 session was spawning servers on the shared tree at the same moment (a new PID started at 07:03 during my run, the surviving PID was gone seconds later). This is shared-tree interference with the hygiene check, not a leak by the 289 code. Worth hardening in the 369 owner's queue (the check cannot distinguish a peer's server from its own), but not a 289 gap.

### Anti-Patterns

No TBD/FIXME/XXX in touched lib/tests/commands files; no em/en-dashes found in the 289 lib and test files or the ruling artifact. No stubs: the detect function, peek/consume order, contract and elicitation default are real and exercised live.

### Notes (info, not gaps)

- The fence scans `commands/*.md` only (the 289 plan scope); skill-level menus are not fenced. The ROADMAP card says "every user-facing menu"; the phase delivered the command surface plus the already-shipped help/Phase 192 conversions. Reasonable reading of D-06, flagged for awareness.
- Research Assumption A5 (does a rank-derived recommendation sit outside the Canon 0.70 Brain-confidence rule for F.1 Mode A) is unruled; recorded as an open navigator item in the ruling file. Canon amendment (Part 6) and the Theo description edit are intentionally out of scope (D-08).
- Residual by design: a write that throws after the consume still loses the gate (369 plan 26).

### Human Verification Required

1. **Real-host card rendering after release.** Test: after the next release is picked up by the installed plugin, fire `/mos:suggest-next` or any gated command on Claude Code CLI. Expected: AskUserQuestion card, no elicitation dialog; record build number. Why human: host rendering is observable only by a person, and a main commit is not live until released and picked up.

### Gaps Summary

No gaps. Every must-have and all 22 requirement IDs are verified against code and re-run tests. Status is human_needed solely because of the one pending post-release host observation.

---

_Verified: 2026-10-04T07:10:00Z_
_Verifier: Claude (gsd-verifier)_
