---
phase: quick
plan: 261005-mux
subsystem: mcp-gate
tags: [gate_answer, pretooluse-hook, card_pending, elicitation, canon-part-3, canon-part-9, seed-120, seed-021]
requires: [261004-av2 (answered_via), 261005-kvv]
provides:
  - scripts/card-before-answer-hook.cjs (PreToolUse hook on gate_answer: never shown as a card / does not match the card; fails open)
  - hooks/hooks.json PreToolUse entry for gate_answer on both server scopes (2000 ms budget)
  - renderer stored on every gate-ledger entry (7 mint sites), gateRender.ledgerRenderer
  - gate_answer card_pending refusal on an open elicitation-rendered gate (relayed answers only)
  - doctrine sentence in larry-extended, research.md (+ regenerated skills/research mirror), larry-personality
affects: [gate_answer, gate_render, research_run, chain_run, hooks]
tech-stack:
  added: []
  patterns: [transcript-reading PreToolUse hook that fails open, ledger-stored renderer read at the answer seam]
key-files:
  created:
    - scripts/card-before-answer-hook.cjs
    - tests/test-mux-card-before-answer.cjs
    - tests/fixtures/mux/card-shown.jsonl
    - tests/fixtures/mux/card-missing.jsonl
    - tests/fixtures/mux/card-mismatch.jsonl
  modified:
    - hooks/hooks.json
    - lib/mcp/gate-render.cjs
    - lib/mcp/gate-ledger.cjs
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/research.cjs
    - lib/mcp/tools/chain.cjs
    - lib/mcp/never-do-gate.cjs
    - lib/mcp/tool-router.cjs
    - lib/core/research-planner/canon-release.cjs
    - scripts/operator-command.cjs
    - agents/larry-extended.md
    - commands/research.md
    - skills/research/SKILL.md
    - skills/larry-personality/SKILL.md
    - tests/test-365-never-do-gate.cjs
    - CHANGELOG.md
key-decisions:
  - "The hook anchors on the EARLIEST tool_result that carries the gate id and a card (a gate id is minted once; a later gate_list or mirror must not move the anchor past a card already answered), then the LATEST overlapping AskUserQuestion after it"
  - "Card words are any JSON options / superset_options / verbs list in the result, so research_run, gate_render, chain_run and the meeting card all work; matching is loose (equality or containment of at least 4 characters, '(Recommended)' stripped) because the hook fails open"
  - "ledgerRenderer stores 'elicitation' only when a dialog was actually put to the navigator (ctx carried elicitInput); an elicitation rendering with no elicitInput stores 'none'"
  - "chain_run records the accepted dialog choice as elicited_answer; gate_answer lets a relay that names exactly that choice through (otherwise accepting a dialog on a non-Claude host would have bricked every chain halt)"
requirements-completed: [QUICK-261005-mux, 369.2-INPUT-defect-4]
duration: about 1 h 45 min
completed: 2026-10-05
---

# Quick 261005-mux: a yes is a card, never prose Summary

A model can no longer answer a gate for the navigator from typed words. On the CLI a PreToolUse hook refuses a `gate_answer` whose gate was never shown as an AskUserQuestion card since its render, or whose choice does not match what the card answered. On the elicitation rung (Desktop, Cowork, non-Claude hosts, where there is no transcript) a gate whose dialog the navigator dismissed is refused `card_pending` and consumes nothing.

## The design

- **Hook** (`scripts/card-before-answer-hook.cjs`, 2000 ms PreToolUse budget, matcher `mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-os__gate_answer`). Reads the last 8 MB of the transcript. Finds the earliest tool_result that carries the gate id and a card, then the latest AskUserQuestion after it whose option labels overlap the card's labels or ids, then that call's tool_result (structured `toolUseResult.answers` first, the `="value"` pairs of the text second). Allows when every `chosen` entry names something the navigator answered. Denies with the PreToolUse JSON (`hookSpecificOutput.permissionDecision: "deny"`) for the two cases the plan names. Every case it cannot judge allows and logs one `surface_degraded:<why>` line (`empty_stdin`, `bad_stdin`, `bad_tool_input`, `no_transcript_path`, `transcript_unreadable`, `gate_not_in_transcript`, `no_card_options_for_gate`, `card_answer_not_in_transcript`, `hook_error`). It never throws and never exits non-zero. The only require is `lib/hmi/turn-text.cjs` (node:fs only), reused for `scanContentForAskUserQuestion`.
- **Record shapes** were read from real transcripts under `~/.claude/projects` (shapes only): an AskUserQuestion tool_use is `{type:'tool_use', name:'AskUserQuestion', input:{questions:[{question, header, multiSelect, options:[{label, description}]}]}}`; its tool_result `content` is a string `Your questions have been answered: "<q>"="<label>"...` and the record carries `toolUseResult:{questions, answers:{<q>:<label>}, annotations}`; an MCP tool_result `content` is `[{type:'text', text:'<json>'}]` with the same array on `toolUseResult`. The fixtures use exactly these shapes.
- **Server.** `gateRender.ledgerRenderer(result, renderCtx)` names the rung that showed a card. Every `gateLedger.mintGate(` site now stores `renderer` (gate.cjs through `_mintLiveGate` default `'none'` plus the gate_render handler, research.cjs `mintApprovalGate`, chain.cjs through `_mintResumeLedger` default plus the halt entry, never-do-gate.cjs, tool-router.cjs meeting card, canon-release.cjs, scripts/operator-command.cjs). `gate_answer`, after the peek and session check and before validation, any room write and any consume: an entry with `renderer === 'elicitation'` and `answered_via !== 'browser_nonce'` is refused `card_pending` ("The navigator dismissed the dialog; show the card again. Nothing was written and the gate is still open."). An accepted dialog never reaches this (research and gate_render consume it inline).
- **Doctrine.** One sentence, in `agents/larry-extended.md` (Decision Gates), `commands/research.md` (end of Filing), `skills/larry-personality/SKILL.md` (Reach rule 1); `skills/research/SKILL.md` regenerated by `build-skill-mirrors`.

## Arm results (tests/test-mux-card-before-answer.cjs: PASS=16 FAIL=0)

| Arm | What | RED on 63e78184b | GREEN |
|-----|------|------------------|-------|
| H1 | card shown, answer matches: allow | FAIL | PASS |
| H2 | typed "i accept" (card missing): deny, "never shown as a card" | FAIL | PASS |
| H3 | card answered "Not now", chosen approve_run: deny, "does not match the card" | FAIL | PASS |
| H4 | no transcript_path: allow, stderr surface_degraded | FAIL | PASS |
| H5 | gate id absent: allow, stderr gate_not_in_transcript | FAIL | PASS |
| H6 | hooks.json matcher fires on gate_answer (both scopes), not gate_render/gate_list, anchored and unanchored | FAIL | PASS |
| H7 | 5 MB transcript under the 2000 ms budget | FAIL | PASS (see below) |
| H8 | garbage/empty stdin, foreign tool, missing file: allow, exit 0 (added) | FAIL | PASS |
| H9 | a card shown BEFORE the render does not count (added) | FAIL | PASS |
| S1 | grant gate, dialog cancelled: card_pending, entry still open, no grant | FAIL | PASS |
| S1b | gate_render, dialog cancelled: card_pending, entry still open (added) | FAIL | PASS |
| S2 | grant gate, dialog accepted: consumed inline, grant written once, later relay refused unknown_gate | PASS (pins today) | PASS |
| S3 | 7 of 7 `gateLedger.mintGate(` sites name a renderer | FAIL (0 of 7) | PASS |
| S4 | accepted-but-unconsumed dialog (chain_run) passes exactly that choice, refuses a dismissed or different one (added) | n/a | PASS |
| D1 | doctrine in the three files; research mirror fresh | FAIL | PASS |
| D2 | dash guard (owned files + lines added since 465178e79); CHANGELOG entry | FAIL | PASS |

RED run on 63e78184b: PASS=1 FAIL=14 (S2 passes on HEAD by design; S4 was added in the GREEN commit).

## Hook cold start (measured, spawn to exit, this machine)

| Case | p50 | p95 | max |
|------|-----|-----|-----|
| 5 MB transcript, card shown (n=10) | 32.5 ms | 34.3 ms | 35.2 ms |
| 5 MB transcript, gate id absent, full scan (n=10) | 35.9 ms | 37.8 ms | 38.3 ms |
| 14 KB fixture (n=10) | 20.0 ms | 21.9 ms | 22.8 ms |
| empty `node -e 0` (n=10) | 20.9 ms | 23.2 ms | 28.4 ms |

Budget: 2000 ms, the hooks.json `timeout` of the hook's entry, which is the number `scripts/measure-hook-cold-start.cjs` compares every hook to (`parseHookCommands` -> `timeout_ms`; 2000 ms is the spike 003 PreToolUse budget recorded in `369-HOOK-COLD-START.md`). Worst p95 is 37.8 ms, 1.9 percent of it. The in-test H7 run (n=5) read min 27.3 ms, max 39.4 ms.

## Suite table (before = HEAD 465178e79 baseline run in this tree; after = this quick)

| Suite | Before | After |
|-------|--------|-------|
| tests/test-mux-card-before-answer.cjs | n/a | PASS (16/0) |
| tests/test-av2-answered-via.cjs | PASS | PASS |
| tests/test-369-gate-recovery.cjs | PASS | PASS |
| tests/test-369-gate-mirror.cjs | PASS | PASS |
| tests/test-369-gate-raised.cjs | PASS | PASS |
| tests/test-369-gate-hardening.cjs | PASS | PASS |
| tests/test-369-human-only.cjs | PASS | PASS |
| tests/test-365-never-do-gate.cjs | PASS (75/0) | PASS (75/0) after the GATE_BASE re-pin |
| tests/test-363-mcp-tool.cjs (drives research_run and gate_answer) | not run | PASS |
| bash tests/run-all-289.sh | PASSED=47 FAILED=0 KNOWN=1 | PASSED=47 FAILED=0 KNOWN=1 |
| bash tests/run-all-366.sh | PASSED=70 FAILED=0 KNOWN=1 | PASSED=70 FAILED=0 KNOWN=1 |
| build-connector-registry, build-orchestration-projection, check-render-coverage, build-skill-mirrors, check-tool-honesty (all --check) | n/a | OK |
| tests/test-369-hook-require-graph.cjs, test-hmi-poll-hook, test-quick-260911-juq-hooks-json-top-level | n/a | PASS |
| node scripts/doctor.cjs --acceptance | n/a | see Self-Check |

Pre-existing reds, named, identical before and after: run-all-289 "known red: 237 approve executes (not owned)" and run-all-366 "pin 355 direction agreement" (both counted KNOWN, signature matched, not owned here).

## Deviations from Plan

**1. [Rule 1 - plan assumption wrong] S2 pins unknown_gate, not replayed:true.** The plan said an inline-accepted grant gate then answered later returns `replayed: true`. Measured on HEAD: it returns `ok:false, reason: unknown_gate`, because the inline consume in `mintApprovalGate` writes no `gate_answer` anchor in the room, so there is nothing to replay. S2 pins the real behavior (one grant, later relay refused, nothing written). Not changed: making the inline path write a durable anchor is a separate decision.

**2. [Rule 2 - missing critical functionality] elicited_answer on chain_run entries.** Applying `card_pending` to every elicitation entry would have broken `chain_run` on non-Claude hosts: chain_run does not consume an inline dialog answer (the halt is resumed through gate_answer), so an ACCEPTED dialog leaves an open elicitation entry and the model's relay would be refused forever. chain.cjs now records the accepted choice as `elicited_answer`, and gate_answer lets a relay naming exactly that choice through (S4). A dismissed dialog records none and stays refused.

**3. [Rule 3 - blocking] Re-pinned GATE_BASE in tests/test-365-never-do-gate.cjs** to 80ef6a9d5787384f8aa14d20c005ba8681689e10 (the byte-identity pin of lib/mcp/tools/gate.cjs, N12), following the av2 precedent. The gate_render and gate_answer descriptions, titles and input schemas are byte-identical to the previous pin; only the file-identity pin moved. Committed with this SUMMARY.

**4. [Scope] `ledgerRenderer` added to lib/mcp/gate-render.cjs** (not in the plan's file list) so the four storing sites share one rule instead of repeating the `elicitInput` condition. sensors.cjs `framework_run` mints no ledger entry (the known 369 trap), so it needed no edit.

**5. [Note] `scripts/measure-hook-cold-start.cjs` was not edited.** It enumerates hooks from hooks.json, not by name, so the new entry is measured automatically (its PreToolUse payload is a Write tool call, which the hook allows without reading a transcript; the 5 MB case is measured by the new test).

## Residuals (stated, not hidden)

- **Loose label matching.** A model that fires a card with labels that share no word of at least 4 characters with the gate's labels is denied "never shown as a card" and recovers by firing the card with the gate's own options (the reason text says so). A model that fires a lookalike card with overlapping labels passes. The hook proves a card was shown and answered, not that its wording was faithful.
- **"Other" free text.** An answer typed into the card's Other field does not name a gate option, so it is denied "does not match the card"; the model re-asks.
- **Window.** A gate rendered more than 8 MB of transcript ago (or a transcript path the harness did not give) is allowed with `surface_degraded:gate_not_in_transcript`. Fail open by design.
- **Desktop and Cowork without hooks** rely on card_pending alone, which covers only the elicitation rung. A card-rung gate on a hookless Claude surface is still answerable by the model; SEED-114 owns the human-only route.
- **Hook is advisory to a hostile model.** It reads a transcript the model's own host writes; it stops a careless shortcut, not an adversary with host access.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: local-file-read | scripts/card-before-answer-hook.cjs | Reads the harness-provided `transcript_path` read-only (last 8 MB), never writes, never logs content, no network, no Brain (Canon Part 8). Same trust shape as scripts/check-card-fire.cjs. |

## Commits

| Step | Commit | Message |
|------|--------|---------|
| RED | 63e78184bfca2fe9d61ead859ce2a4fabe5aec8c | test(261005-mux): RED arms for a yes is a card, never prose (hook, card_pending, renderer on every mint, doctrine) |
| GREEN | 80ef6a9d5787384f8aa14d20c005ba8681689e10 | feat(261005-mux): a yes is a card, never prose (PreToolUse card-before-answer hook, renderer on every mint, card_pending, doctrine) |
| Task 3 | recorded in the completion message | docs/test(261005-mux): summary and the GATE_BASE re-pin |
