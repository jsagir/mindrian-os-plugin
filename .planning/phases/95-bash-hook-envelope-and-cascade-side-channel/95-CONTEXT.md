---
phase: 95
slug: bash-hook-envelope-and-cascade-side-channel
milestone: v1.11.0
status: ready
priority: immediate-next
depends_on:
  - phase-94 (v1.11.2 release gate must ship first; this phase is the FIRST work after v1.11.2 lands)
canon_parts:
  - "Part 4 — Every Choice Is Graph Data (cascade edges flow only when the loop works end-to-end)"
  - "Part 8 — Graph Boundary (side-channel file stays LOCAL; no network)"
related_debug:
  - .planning/debug/post-write-hook-envelope-invalid-input.md (root cause + Follow-Ups source)
related_phases:
  - 88.1-07 (frontmatter-schema-validator) — fixed in v1.11.2
  - 88.1-08 (async-artifact-auto-commit) — fixed in v1.11.2
  - 88.1-03 (post-write systemMessage retrofit) — bug introduced here, NOT YET fixed
  - 88.1-16 (query-efficiency-telemetry) — reference fix pattern (v1.10.19)
created: 2026-04-29
---

# Phase 95 — Bash Hook Envelope Hygiene + Cascade Side-Channel

## Why this exists

Phase 94 (v1.11.2) closed the noisy half of the PostToolUse:Write envelope bug — the two `.cjs` hooks no longer trip the schema validator. But debugging that surface uncovered TWO bigger problems that were intentionally deferred from v1.11.2 to keep the release scope tight:

1. **The bash `scripts/post-write` hook also emits a non-conforming envelope** — it's just been silently tolerated by the schema validator because it carries a recognized `systemMessage` alongside five unknown root keys (`cascade_status`, `classification`, `git_commit`, `graph_index`, `proactive_intelligence`). Same class-of-bug as the .cjs hooks, just hidden.
2. **The room-proactive intelligence loop has been silently broken since Phase 88.1-03.** `skills/room-proactive/SKILL.md` (lines 80-112) declares a contract: after every cascade, read `cascade_status.proactive_intelligence.newFindings` from `additionalContext`. The bash hook never put it there — it has always written cascade_status at JSON root. The skill has been receiving nothing for months. The mid-session intelligence injection feature shipped in 88.1-03 has never functioned in production.

There are also OTHER bash hooks dispatched through `hooks/run-hook.cmd` (session-start, pre-compact, on-stop, write-scope-check, intent-classifier, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete). Any of them that emit JSON to stdout could carry the same class of bug. v1.11.2 left them unaudited.

## Scope (3 problems, 1 phase)

### Problem 1 — Fix the bash `post-write` envelope

**File:** `scripts/post-write` lines 186-205.

**Current (broken):**
```bash
CASCADE_STATUS=$(echo "$CASCADE_OUTPUT" | jq -c '{
  cascade_status: "complete",
  classification: ...,
  git_commit: ...,
  graph_index: ...,
  proactive_intelligence: { ... },
  systemMessage: env.SM_TEXT
}')
echo "$CASCADE_STATUS"
```

**Target:**
```bash
# Stdout is ONE JSON object with ONLY allowed top-level keys.
# All cascade payload moves to the side-channel file (Problem 2).
echo "$(jq -nc --arg msg "$SM_TEXT" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $msg
  }
}')"
```

Mirrors the v1.10.19 / v1.11.2 fix pattern. Allowed PostToolUse top-level keys per Claude Code 2.x schema: `{decision, reason, continue, stopReason, suppressOutput, systemMessage, hookSpecificOutput}`. Every other key is invalid input.

### Problem 2 — Cascade payload moves to a side-channel file

**New file:** `<roomDir>/.mindrian/last-cascade.json`

Written atomically (`openSync('wx')` + rename, per Phase 87-02 pattern) by the bash post-write hook on every successful cascade. Contains the full payload that used to live in stdout:

```json
{
  "timestamp": "2026-04-29T...",
  "file_path": "<artifact path>",
  "section": "<section name>",
  "cascade_status": "complete",
  "classification": "...",
  "git_commit": { ... },
  "graph_index": { ... },
  "proactive_intelligence": {
    "status": "...",
    "new": <int>,
    "suppressed": <int>,
    "newFindings": [ ... ]
  }
}
```

Constraints:
- LOCAL only. Never sent over network. Canon Part 8.
- Atomic write — partial reads must never see torn JSON.
- One file per room (overwritten each cascade). Not a log; the cascade-edges graph is the durable record. This file is ephemeral state for the next skill read.
- Cleaned up on `/mos:rooms archive` (add to archive checklist; track in plan).

### Problem 3 — `skills/room-proactive/SKILL.md` reads from the side-channel

**File:** `skills/room-proactive/SKILL.md` lines 80-112.

Update the trigger contract:
- OLD: "Check cascade_status.proactive_intelligence.newFindings in PostToolUse additionalContext."
- NEW: "After PostToolUse:Write fires with `additionalContext` matching `^post-write: cascade complete` or `^queued MINTO regen`, read `<roomDir>/.mindrian/last-cascade.json` and check `proactive_intelligence.newFindings`."

The trigger logic moves from in-band JSON parsing of additionalContext to filesystem read keyed off the additionalContext one-liner. The skill is then receiving real cascade signals for the first time since 88.1-03 shipped.

### Audit scope — all other bash hooks dispatched through run-hook.cmd

Read each of these scripts end-to-end and check whether they emit JSON to stdout. If yes, validate the envelope shape against the allowed top-level key set:

- [ ] `scripts/session-start` (SessionStart hook)
- [ ] `scripts/pre-compact` (PreCompact)
- [ ] `scripts/post-compact` — wait, only `pre-compact` exists in scripts/, post-compact dispatches to `run-hook.cmd post-compact` which routes inside the .cmd. AUDIT the .cmd routing too.
- [ ] `scripts/on-stop` (Stop)
- [ ] `scripts/write-scope-check` (PreToolUse Write|Edit|MultiEdit)
- [ ] `scripts/intent-classifier` (UserPromptSubmit)
- [ ] `scripts/on-file-changed` (FileChanged)
- [ ] `scripts/on-cwd-changed` (CwdChanged)
- [ ] `scripts/on-agent-complete` (SubagentStop)
- [ ] `scripts/on-task-complete` (TaskCompleted)

Each script that emits stdout needs the same fix pattern:
- Silent path: emit nothing.
- Message path: ONE JSON object, top-level keys subset of `{decision, reason, continue, stopReason, suppressOutput, systemMessage, hookSpecificOutput}`.

Some of these hooks are NOT PostToolUse — they're SessionStart, UserPromptSubmit, etc. Each lifecycle event has its OWN allowed envelope schema. Per-event audit is required, not blanket pattern-copy. For example, UserPromptSubmit's allowed keys differ from PostToolUse's. The Claude Code docs at https://docs.claude.com/en/docs/claude-code/hooks list the schema per event.

## Regression test surface

Extend `tests/test-hook-envelope-shape.cjs` (created in Phase 94 / v1.11.2) to cover:
- bash `post-write` (new).
- All other bash hooks listed in the audit, with per-event allowed-keys assertions.
- Side-channel file: synthetic cascade write produces a valid JSON file at `<roomDir>/.mindrian/last-cascade.json`.
- room-proactive: synthetic side-channel file with newFindings triggers the skill's expected trigger condition.

## Risks

- **Bash JSON construction is fragile.** Use `jq -nc` for envelope construction; do NOT hand-build with `printf` / `echo` and string interpolation. The post-write script already uses jq for cascade payload — extend the same approach.
- **Atomic file writes in bash.** Use `mktemp` + `mv` (mv is atomic within the same filesystem); if the room directory is on a different mount than `/tmp`, write the temp file inside `<roomDir>/.mindrian/` to keep mv atomic.
- **SKILL.md contract change is a behavior shift.** The room-proactive skill will start surfacing findings it never did before. Some users have lived with silence. Plan a release note in CHANGELOG that flags: "Mid-session intelligence injection (Phase 88.1-03 feature) now functioning in production for the first time — expect cross-section impact prompts after writes."
- **Audit may surface MORE non-PostToolUse envelope bugs** in other hooks. Scope creep risk. If audit finds 2+ additional bugs, split into 95.1 (post-write + side-channel) and 95.2 (broader audit).

## Out of scope

- Refactoring run-hook.cmd dispatch logic.
- Replacing bash hooks with Node.js equivalents.
- Changing the cascade graph schema (cascade edges in room.db are unaffected).

## Acceptance

- [ ] Bash `post-write` emits a schema-valid PostToolUse envelope (top-level keys subset of allowed set).
- [ ] `<roomDir>/.mindrian/last-cascade.json` is written atomically on every cascade.
- [ ] `skills/room-proactive/SKILL.md` updated to read from the side-channel; mid-session intelligence injection is observable in a real session.
- [ ] All other bash hooks audited; any envelope bugs found are fixed in this phase or split to 95.2.
- [ ] Regression test fences all bash hook stdout shapes by lifecycle event.
- [ ] CHANGELOG entry under Fixed (envelope hygiene) AND Changed (room-proactive cascade now firing).
- [ ] Version bump 1.11.2 -> 1.11.3 (or 1.12.0 if SKILL.md contract change is treated as feature).

## How to start

When v1.11.2 ships:

```
/gsd:plan-phase 95
```

The planner will read this CONTEXT, do its own research pass (especially on per-event hook schemas in current Claude Code docs), and produce a per-plan breakdown. Expect 4-6 plans:
- 95-01 audit + per-script triage report
- 95-02 bash post-write fix + side-channel writer
- 95-03 room-proactive SKILL.md contract update + integration test
- 95-04 regression-test extension across all bash hooks
- 95-05 CHANGELOG + release gate (1.11.3 or 1.12.0)

If the audit (95-01) surfaces 2+ additional non-PostToolUse envelope bugs, the planner should split this into 95.1 and 95.2.

## Provenance

- Original symptom: `PostToolUse:Write hook error — Hook JSON output validation failed — (root): Invalid input` reported by user 2026-04-29.
- Investigation: `.planning/debug/post-write-hook-envelope-invalid-input.md` (gsd-debugger session, 2026-04-29).
- v1.11.2 patched the two `.cjs` hooks (Phase 94). The bash hook + cascade side-channel were intentionally deferred to keep the release tight.
- This phase exists because the user said "document the needed fixing for bash commands, file them for immediate next" — capturing the Follow-Ups before they slip.
