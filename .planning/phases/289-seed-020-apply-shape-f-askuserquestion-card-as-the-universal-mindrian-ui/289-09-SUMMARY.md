---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 09
subsystem: mcp-gate
tags: [close-out, regression, validation, seed-020, theo-handoff, d-08, d-09]
requires: [289-01, 289-02, 289-03, 289-04, 289-05, 289-06, 289-07, 289-08]
provides:
  - "289-VALIDATION.md: 22 rows flipped to measured status, nyquist_compliant true (live dual-era leg RAN, exit 0), close-out measurement section"
  - "SEED-020 (shape-f file) status resolved with the shipped scope and the canon note as an open navigator item"
  - "289-THEO-HANDOFF.md: the Theo description-mirror request (no Theo edit)"
  - "The requirements close-out block for the orchestrator (below)"
affects: [369-26, 369-27]
tech-stack:
  added: []
  patterns: ["close against measurements, never against the plan"]
key-files:
  created:
    - .planning/phases/289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui/289-THEO-HANDOFF.md
  modified:
    - .planning/phases/289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui/289-VALIDATION.md
    - .planning/seeds/SEED-020-shape-f-is-the-universal-mindrian-ui.md
key-decisions:
  - "VALIDATION status stays draft: five regression legs outside Phase 289 are red (all caused by Phase 369 and older commits, classified below), so the plan's every-required-leg-green close rule is not met; the orchestrator or navigator decides the waiver"
  - "Row 289-09-01 is flipped red (not green) for the same reason; every other row is green"
  - "VALIDATION.md rides in the Task 2 commit as well as Task 1 (one small edit: row 289-09-02 flips only after its artifacts exist)"
requirements-completed: [VAL289-01, CLOSE289-01]
duration: 45 min
completed: 2026-10-04
---

# Phase 289 Plan 09: close-out Summary

Phase 289's own suite is green with the live "Normal card on CLI" leg run (`PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1`), the validation rows say what was measured, SEED-020 reads resolved with the shipped scope, the Theo mirror request is filed in the phase dir, and the orchestrator has a requirements close-out block. One honest caveat: five regression suites outside this phase are red for reasons that predate or sit beside Phase 289 (Phase 369 root-dependency and description changes, a July on-stop budget overrun, a version-bump ledger drift); none was patched here.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | run the phase suite and the regression set, flip 289-VALIDATION.md | 257c8e527 | 289-VALIDATION.md |
| 2 | SEED-020 resolved, Theo handoff, close-out block, VALIDATION row 09-02 | the commit carrying this SUMMARY (`docs(289-09): SEED-020 resolved, Theo handoff, phase close-out`) | SEED-020 shape-f file, 289-THEO-HANDOFF.md, 289-09-SUMMARY.md, 289-VALIDATION.md |

## Measurements (2026-10-04, HEAD 1af0dcf79 at run start, node v22.23.1)

| Command | Exit | Counters |
|---------|------|----------|
| `bash tests/run-all-289.sh` | 0 | PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1; `>>> CARD289-02 dual-era (live, last): PASSED` |
| `node tests/test-289-cli-card-dual-era.cjs` | 0 | PASS=6 FAIL=0 (stdio 2025 cli and desktop, stdio 2026, HTTP 2026, HTTP legacy, process hygiene) |
| `node tests/test-289-capability-ruling.cjs` | 0 | PASS=201 FAIL=0 |
| `node tests/test-289-ledger-consume-after-checks.cjs` | 0 | PASS=26 FAIL=0 |
| `node tests/test-289-contract-recommended.cjs --arm unit --arm live` | 0 | PASS=20 FAIL=0 |
| `node tests/test-289-elicit-default.cjs` | 0 | PASS=13 FAIL=0 |
| `node tests/test-289-menu-fence.cjs` | 0 | PASS=17 FAIL=0; `hits=7 passed=5 allow_listed=2 failures=0 stale=0` |
| `node tests/test-365-never-do-gate.cjs` | 0 | PASS: 75 FAIL: 0 |
| `node tests/test-369-human-only.cjs` | 0 | PASS=10 FAIL=0; arm 4 "owner-after-stranger ratified" |
| `node tests/test-369-sessionful-acceptance.cjs` | 0 | PASS=6 FAIL=0; "owner-after-stranger ratified" |
| `bash tests/run-all-238.sh` | 0 | PASS=10 FAIL=0 SKIP=0 |
| `node tests/test-276-tool-honesty-findings-closed.cjs` | 0 | 148 passed, 0 failed (no tolerance) |
| `node scripts/check-tool-honesty.cjs --check` | 0 | clean |
| `node lib/mcp/no-instructions.test.cjs` | 0 | 9 passed, 0 failed |
| `node tests/test-276-theo-description-parity.cjs` | 0 | coordination signal only; nothing written under Theo |
| `node scripts/check-shape-declaration.cjs --check` | 0 (advisory) | WARN lines for the 14 touched surfaces (seven commands, seven mirrors; scientific-roadmap joined in plan 08): only the two pre-existing radar lines |
| `bash tests/run-all-198.sh` | 1 | Passed 15, Failed 1 |
| `bash tests/run-all-267.sh` | 1 | PASS=28 FAIL=3 SKIP=3 |
| `bash tests/run-all-354.sh` | 1 | PASSED=18 FAILED=1 SKIPPED=1 |
| `node scripts/doctor.cjs --acceptance` | 1 | 21/22 points; failed: harness-policies |

SKIPPED: `tests/test-369-289-precondition.cjs` (missing; Phase 369 plan 26 writes it, it runs once that lands). KNOWN: test-237 `MUTATION -- could not build the mutated copy` (signature matched, pre-existing before any Phase 289 edit, not owned).

## Red regression legs, classified (docs/RCA-TEMPLATE.md classes)

The plan's required-for-close list names run-all-198, 267, 354 and doctor --acceptance as exit 0. They are not. None is a NEW FAILURE caused by Phase 289: each is a known pre-existing or other-phase break, and no Phase 289 commit touches any file it reads. No code was patched (this plan has no code edits); a `/gsd-debug` or `/gsd-quick` per row is the orchestrator's call.

| Suite and leg | Class | Evidence |
|---------------|-------|----------|
| run-all-198, `test-198-adapter-budget` (SPEC-5): `scripts/on-stop` 618 lines vs budget 570 (`lib/mcp/hook-adapter-audit.cjs:62`) | known tracked bug, pre-existing | `scripts/on-stop` was already 617 lines at 463559e1f~1 (the parent of Phase 289's first commit) with the same 570 budget; last edit 01c3ca19d (240.1-03, 2026-07-30). The planning note "run-all-198 is green since 615e7ac41" was true of `test-198-local-only` only; the aggregator also carries this older red. |
| run-all-267, lockstep MCPV2-19 (package.json vs package-lock: next, react, react-dom) | other-phase, Phase 369 | 28d9196fe (369-19, 2026-10-03) added the root deps without a lockfile refresh. |
| run-all-267, zod4 contract MCPV2-03: `tool:room_list:description` | other-phase, Phase 369 | 428ab60a0 (369-22, 2026-10-03) reworded the room_list description; the 267 baseline was not re-pinned. Phase 289 edited no room tool. |
| run-all-267, release payload ceiling | other-phase, Phase 369 | npm-shrinkwrap.json declares hasInstallScript:true for node_modules/sharp, pulled in by 28d9196fe (369-19). |
| run-all-354, framework-command-ledger THEO-01 | known tracked bug, pre-existing | `plugin_version drift: ledger=2.0.0-beta.48 repo=2.0.0-beta.56`; bump 6d7bf5828 (2026-10-02) predates Phase 289. |
| doctor --acceptance, `harness-policies` (release-payload-ceiling) | other-phase, Phase 369 | same sharp hasInstallScript cause; no point carries the test-237 signature (the tolerance did not apply and was not needed). |

Consequence: VALIDATION `status` stays `draft` (not `complete`) and row 289-09-01 is red with the reason; `nyquist_compliant: true` is set because the live dual-era leg ran (exit 0).

## D-01 check (ROADMAP Depends on line)

Read-only: the applied `### Phase 289` card in `.planning/ROADMAP.md` carries the `**Depends on:**` line verbatim as drafted in `289-ROADMAP-REQS-DRAFT.md` (Phase 288 waived by navigator ruling 2026-10-03). No mismatch. One reminder for the orchestrator: the card's nine `- [ ] 289-0N-PLAN.md` rows and `**Plans:** 9 plans` are still the plan-time text.

## Requirements close-out block for the orchestrator

REQUIREMENTS.md, ROADMAP.md and STATE.md writes belong to the orchestrator (D-09, coordinated with the Phase 369 peer); this plan wrote none of them. To apply: in the `### Phase 289` block of `.planning/REQUIREMENTS.md`, replace each row below, and in the Traceability note change "all [ ] until 289-09" to the closed state.

- [x] **CARD289-01**: One shared `detectGateCapabilities(server, ctx)` in `lib/mcp/gate-render.cjs`; a Claude host surface renders rung (b) on both protocol eras even when elicitation is declared; the five tool copies are one-line delegates; `pickRenderer` and test-198:35 unchanged (D-03). Plans 289-01, 289-04, 289-07. **Measured:** (2026-10-04) `node tests/test-289-capability-ruling.cjs` exit 0 in `bash tests/run-all-289.sh` (PASS=201 FAIL=0; PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1).
- [x] **CARD289-02**: `tests/test-289-cli-card-dual-era.cjs` passes all legs: stdio 2025 (cli and desktop), stdio 2026, HTTP daemon 2026 and legacy, zero elicitation requests, renderer askuserquestion (D-03). Plans 289-01, 289-07. **Measured:** (2026-10-04) `node tests/test-289-cli-card-dual-era.cjs` exit 0 (PASS=6 FAIL=0) as the last leg of `bash tests/run-all-289.sh` (`>>> CARD289-02 dual-era (live, last): PASSED`).
- [x] **CARD289-03**: `289-CLI-CARD-RULING.md` carries the `Ruling:` line naming `tests/test-289-cli-card-dual-era.cjs`, the canon tension and what did not change. Plan 289-07. **Measured:** (2026-10-04) the file is committed (9b222f551); the test it names exits 0 (PASS=6 FAIL=0).
- [x] **CARD289-04**: gate.cjs ruling comments rewritten (literal "2.1.280" kept); test-267 era-2025 arm and gate-premise behaviour arm flipped; test-365-acceptance-floor rung (a) reports a non-Claude client. Plan 289-07. **Measured:** (2026-10-04) `flipped: 267 gate premise`, `267 dual era (live)` and `flipped: 365 acceptance floor` PASSED in `bash tests/run-all-289.sh` (PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1).
- [x] **CARD289-05**: The rung (b) imperative names the real option count (`verbs=N`), fixed in the gate layer, shared dispatcher untouched (D-07). Plans 289-02, 289-04. **Measured:** (2026-10-04) `node tests/test-289-contract-recommended.cjs --arm unit --arm live` exit 0 (PASS=20 FAIL=0) and `flipped: 365 floor notice` PASSED in `bash tests/run-all-289.sh`.
- [x] **CARD289-06**: A recognized non-Claude host that declares elicitation keeps rung (a); a Claude host never does (D-02). Plans 289-01, 289-04, 289-07. **Measured:** (2026-10-04) `node tests/test-289-capability-ruling.cjs` (PASS=201 FAIL=0) and `node tests/test-289-elicit-default.cjs` live arm (PASS=13 FAIL=0) exit 0 in `bash tests/run-all-289.sh`.
- [x] **LEDGER289-01**: `consumeGate` checks the session before its one `_ledger.delete(`; a refused stranger never deletes the owner's entry (D-04). Plans 289-02, 289-05. **Measured:** (2026-10-04) `node tests/test-289-ledger-consume-after-checks.cjs` exit 0 (PASS=26 FAIL=0) and `node tests/test-238-session-scoped-ledger.cjs` exit 0 in `bash tests/run-all-289.sh`.
- [x] **LEDGER289-02**: `peekGate(gateId, sessionId)` is a non-consuming read with the same TTL and session contract (D-04). Plans 289-02, 289-05. **Measured:** (2026-10-04) `node tests/test-289-ledger-consume-after-checks.cjs` exit 0 (ledger arm, PASS=26 FAIL=0).
- [x] **LEDGER289-03**: `gate_answer` peeks, runs every refusal, then consumes immediately before its first write with no await between; concurrent answers ratify once (D-04). Plans 289-02, 289-05. **Measured:** (2026-10-04) `node tests/test-289-ledger-consume-after-checks.cjs` (PASS=26 FAIL=0), `node tests/test-238-chosen-validation.cjs` and `node tests/test-354-concurrency-surfaces.cjs` exit 0 in `bash tests/run-all-289.sh`; `node tests/test-369-human-only.cjs` arm 4 prints "owner-after-stranger ratified" (PASS=10 FAIL=0).
- [x] **LEDGER289-04**: `chain_run` resume gets the same peek, refuse, consume discipline (D-04). Plan 289-05. **Measured:** (2026-10-04) `node tests/test-238-chain-chosen-validation.cjs` exit 0 in `bash tests/run-all-289.sh`; `bash tests/run-all-238.sh` exit 0 (PASS=10 FAIL=0 SKIP=0).
- [x] **LEDGER289-05**: The owner-after-stranger arm lives in `tests/test-238-session-scoped-ledger.cjs`; the four burn-pinning tests are flipped with replay-after-success arms; the residual (a write that throws after the consume still loses the gate) is assigned to Phase 369 plan 26. Plan 289-05. **Measured:** (2026-10-04) `flipped: 238 session-scoped ledger`, `238 chosen validation`, `238 chain chosen validation` and `354 concurrency surfaces (live)` PASSED in `bash tests/run-all-289.sh` (PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1); residual stated, not fixed.
- [x] **CONTRACT289-01**: `normalizeCard` derives `recommended`: explicit flag, else lowest finite rank, else null (D-05). Plans 289-02, 289-04. **Measured:** (2026-10-04) `node tests/test-289-contract-recommended.cjs --arm unit --arm research` exit 0 in `bash tests/run-all-289.sh`.
- [x] **CONTRACT289-02**: Rung (b) single-select sets `rendered.contract.recommended`; `superset_options` rows carry a boolean; multi-select stays null; the F.8 renderer and `gate_render` schema are untouched; the JSON path is found by value (D-05). Plans 289-02, 289-04. **Measured:** (2026-10-04) `node tests/test-289-contract-recommended.cjs --arm unit --arm live` exit 0 (PASS=20 FAIL=0); `regression: F.8 renderer canon` and `regression: 198 gate renderers` PASSED in `bash tests/run-all-289.sh`.
- [x] **CONTRACT289-03**: Rung (c) sets the same `contract.recommended` and marks the body line ` (recommended)`, single-select only (D-05). Plans 289-02, 289-04. **Measured:** (2026-10-04) `node tests/test-289-contract-recommended.cjs --arm unit` exit 0 in `bash tests/run-all-289.sh`; `flipped: 365 floor notice` PASSED.
- [x] **CONTRACT289-04**: `research.cjs` passes the planner's `recommended` flag to the grant, deep_plan and filing cards (D-05). Plans 289-02, 289-07. **Measured:** (2026-10-04) `node tests/test-289-contract-recommended.cjs --arm unit --arm research` exit 0 in `bash tests/run-all-289.sh`; `node tests/test-276-tool-honesty-findings-closed.cjs` exit 0 (148 passed, 0 failed) and `node scripts/check-tool-honesty.cjs --check` exit 0.
- [x] **ELICIT289-01**: The elicitation `default` is the recommended id (single) or explicitly flagged ids (multi); the title is an instruction capped at 120 characters; both shapes pass SDK 2.1.0 `safeParse`. Plans 289-03, 289-04. **Measured:** (2026-10-04) `node tests/test-289-elicit-default.cjs` exit 0 (PASS=13 FAIL=0) and `re-pinned: 265 gate_render elicit schema` PASSED in `bash tests/run-all-289.sh`.
- [x] **ELICIT289-02**: Elicitation fires only where the ruling allows, proven live: a recognized non-Claude host gets one defaulted dialog; an unknown client gets the card (D-02). Plans 289-03, 289-07. **Measured:** (2026-10-04) `node tests/test-289-elicit-default.cjs` live arm exit 0 (PASS=13 FAIL=0) in `bash tests/run-all-289.sh`.
- [x] **MENU289-01**: `/mos:pipeline` chain selection and resume are live F.1 cards with the `--list` floor, `Do not auto-select.` kept and a chain-select gate stage; the radar, deck, find-analogies, new-project and skill choosers are converted with text floors, and (navigator ruling 2026-10-03) the scientific-roadmap missing-input chooser too; every touched surface keeps its CIRS declaration (D-06). Plans 289-06, 289-08. **Measured:** (2026-10-04) `node tests/test-289-menu-fence.cjs` exit 0 in `bash tests/run-all-289.sh` (`hits=7 passed=5 allow_listed=2 failures=0 stale=0`); `node scripts/build-skill-mirrors.cjs --check`, `build-command-registry`, `build-connector-registry` and `build-render-coverage --check` exit 0; check-shape-declaration WARN lines for the touched surfaces are only the two pre-existing radar lines.
- [x] **MENU289-02**: `tests/test-192-menu-sweep-live-selectors.cjs` Assertion B is healed to the 3-card, 11-family help contract (D-06). Plan 289-06. **Measured:** (2026-10-04) `healed: 192 menu sweep live selectors` PASSED in `bash tests/run-all-289.sh` (PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1).
- [x] **MENU289-03**: `tests/test-289-menu-fence.cjs` scans every `commands/*.md` with a substring-matched, reasoned allow-list (exactly two entries: ignite.md, systems-thinking.md) and fails on an unlisted chooser or a stale entry; green over the whole surface (D-06). Plans 289-03, 289-08. **Measured:** (2026-10-04) `node tests/test-289-menu-fence.cjs` exit 0 (PASS=17 FAIL=0; `hits=7 passed=5 allow_listed=2 failures=0 stale=0`). The fence went 8 failures to 0 (not the planned 7) because the navigator ruled 2026-10-03 that scientific-roadmap.md:143 is converted, not allow-listed.
- [x] **VAL289-01**: `tests/run-all-289.sh` written once with every leg pre-declared, exit 77 never a pass, one `run_known_if` (test-237), the live dual-era leg last, a closing 369-probe leg, a long-dash guard; green at close with the dual-era leg run. Plans 289-01, 289-09. **Measured:** (2026-10-04) `bash tests/run-all-289.sh` exit 0 (PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1; `>>> CARD289-02 dual-era (live, last): PASSED`). The one SKIPPED leg is the 369 precondition probe (file missing until Phase 369 plan 26). Note for the orchestrator: the broader regression set is not fully green (five legs outside this phase, classified above); the requirement text itself is met.
- [x] **CLOSE289-01**: SEED-020 (shape-f file) `status: resolved` with the shipped scope (9a18fe81d, 28f95106b, Phase 192, Phase 289) and the canon note as an open navigator item; a Theo handoff note in the phase dir naming gate-render.ts:38 and 106 (no Theo edit); VALIDATION flipped to measured status; this close-out block handed over. Plan 289-09. **Measured:** (2026-10-04) `grep '^status: resolved'` on the seed matches; `289-THEO-HANDOFF.md` is tracked; `sha256sum` of `/home/jsagi/Theo/src/mcp/operational/gate-render.ts` is 547e979122b67c5779767853d38111e0a96afc1c54bef60f79ca9e4d58154ee2 before and after; `git diff --stat` of the other SEED-020 file (regulation-layer, merged into SEED-031) is empty.

Counts: 22 of 22 IDs closed `[x]` with proof; none left open.

ROADMAP Plans line text: `9/9 plans executed`; the nine `- [ ] 289-0N-PLAN.md` rows flip to `[x]`.

## Residuals (named, not fixed)

1. A write that throws after the consume still loses the gate (`gate_answer` consumes just before `logMemoryEvent`; chain resume before `_executeResumedEntry`). Durable consumption after commit is Phase 369 plan 26 (it builds on `peekGate`).
2. The canon note "command menus render as live selectors, never bare text" needs Part 6 approval; deliberately not written (D-08). Recorded on SEED-020 and in `289-CLI-CARD-RULING.md`.
3. Research Assumption A5 (`289-RESEARCH.md` line 422): is a rank-derived recommendation outside the Canon 0.70 Brain-confidence rule for F.1 Mode A (`docs/MINDRIAN-CANON.md` line 189)? OPEN navigator item, not ruled, not closed. The code derives `recommended` from an explicit flag or a rank and claims no exemption.
4. The Theo mirror (`gate-render.ts` lines 38 and 106, still "elicitation first"): `289-THEO-HANDOFF.md` is filed; the edit is Theo's.
5. The CLI card manual check (a real gate on Claude Code 2.1.287 or later) waits for a release (a main commit is not live until released and picked up by the installed plugin).
6. The Phase 369 precondition probe `tests/test-369-289-precondition.cjs` does not exist yet (369 plan 26); the closing run-all-289 leg reports SKIPPED (missing) until it does.
7. Five regression legs outside this phase are red (table above): adapter budget (on-stop), 267 lockstep, 267 zod4 room_list description, release payload ceiling and doctor harness-policies (sharp install script), 354 framework-command ledger drift.

## Deviations from Plan

### Auto-fixed Issues

None. No code was edited.

### Plan-text deviations

**1. [Plan scope] Red regression legs reported, not stopped on.** Task 1 says to stop if a required leg is red. Four required legs were red (run-all-198, 267, 354, doctor --acceptance). Each was classified with commit evidence as pre-existing or Phase 369 caused (none touches a Phase 289 file), and the plan's own truths allow classification. I recorded the reds, left VALIDATION `status: draft`, flipped row 289-09-01 to red, and still completed Task 2 (the seed and handoff are true statements about shipped scope and do not depend on the regression set). The orchestrator decides whether to waive.

**2. [Plan text stale] "run-all-198 is green since 615e7ac41".** Only `test-198-local-only` healed then; `test-198-adapter-budget` has been red since scripts/on-stop reached 617 lines in July, before this phase.

**3. [Plan text stale] "twelve touched surfaces".** Plan 08 added scientific-roadmap, so the WARN-line check covered 14 surfaces (seven commands, seven mirrors); still only the two pre-existing radar lines.

**4. [Commit shape] VALIDATION.md is in both task commits.** Row 289-09-02 can only flip after its artifacts exist, so the Task 2 commit carries one more small VALIDATION edit.

## Authentication gates

None.

## Threat Flags

None. No network endpoint, auth path or schema changed; only planning artifacts were written.

## Known Stubs

None.

## Self-Check: PASSED

- 289-VALIDATION.md (22 rows, all green except 289-09-01 red), 289-THEO-HANDOFF.md and the SEED-020 shape-f file exist and are named in the commits; commit 257c8e527 verified on main.
- Theo `gate-render.ts` sha256 unchanged (547e9791...); regulation-layer SEED-020 file untouched; STATE.md, ROADMAP.md and REQUIREMENTS.md not written; no em-dash or en-dash in any file written.
