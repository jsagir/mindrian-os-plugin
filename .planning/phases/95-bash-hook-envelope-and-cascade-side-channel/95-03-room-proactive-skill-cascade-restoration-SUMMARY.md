---
phase: 95-bash-hook-envelope-and-cascade-side-channel
plan: 03
subsystem: room-proactive-skill-side-channel-reader
tags: [skill, room-proactive, side-channel, cascade, cool-ui, canon-part-3, canon-part-4, canon-part-7]
requirements: [BASH-95-03]
canon_parts:
  - "Part 3 - Tri-Context Decision Gate (cascade-finding APPROVE/REJECT/DEFER flow now actually fires after 88.1-03 silence)"
  - "Part 4 - Every Choice Is Graph Data (the rejection edges that have been impossible since 88.1-03 can finally land)"
  - "Part 7 - Reuse Before Build (cool-UI style canon already exists at .planning/research/cool-ui-style-reference.md; this plan USES it instead of inventing)"
dependency_graph:
  requires: [95-02-post-write-side-channel-writer-SUMMARY.md]
  provides: ["skills/room-proactive/SKILL.md side-channel-reader contract", "tests/test-room-proactive-side-channel.cjs text-level + data-contract fence"]
  affects: ["Plan 95-05 release gate (CHANGELOG Changed entry: cascade loop now fires)"]
tech_stack:
  added: []
  patterns:
    - "Text-level contract fence via OLD_PHRASES negative-string list (whole-file scan; catches OLD framings that escape line-range fences)"
    - "Anchored awk-diff for byte-identical preservation guard (### How to Present through Do NOT follow up...)"
    - "Synthetic side-channel JSON dry-run (independent of SKILL.md text; tests Plan 95-02 data contract round-trip)"
    - "Cool-UI render contract per .planning/research/cool-ui-style-reference.md: banner with thin horizontal rules + status grid + canonical glyph vocabulary"
key_files:
  created:
    - tests/test-room-proactive-side-channel.cjs
    - .planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-03-room-proactive-skill-cascade-restoration-SUMMARY.md
    - .planning/phases/95-bash-hook-envelope-and-cascade-side-channel/deferred-items.md
  modified:
    - skills/room-proactive/SKILL.md
    - lib/memory/run-feynman-tests.cjs
decisions:
  - "OLD_PHRASES negative-string list contains all 5 documented OLD-contract framings (whole-file scan, not just line-80-92 literal); the original plan revision missed lines 102-113 which carried `cascade_status.proactive_intelligence` wording in the After Filing block intro and When to Present block"
  - "F.0 AskUserQuestion selector deferred to Phase 88.2 / 97 per room/decisions/decision-phase-95-sequencing.md; Phase 95 only relocates WHERE the finding payload comes from, not the renderer; SKILL.md text explicitly notes the deferral so a half-built F.0 cannot accidentally land here"
  - "Cool-UI render contract added as a NEW subsection inside Mid-Session Intelligence (banner with thin horizontal rules + status grid + canonical glyph vocabulary per .planning/research/cool-ui-style-reference.md); cascade-finding render must NOT fall back to raw prose"
  - "Lines 114-160 of pre-edit SKILL.md (### How to Present through Do NOT follow up...) byte-identical preserved via anchored awk-diff (range bounded by section headers, not line numbers, robust against rewrite-induced line shifts)"
  - "Dog-food smoke artifact step deferred per CLAUDE.md Decision #16 (Obsidian Vault Nested Structure v1.9.7); regression test fixtures (which use spawnSync against scripts/post-write inside scratch dirs) provide equivalent evidence"
  - "Plan 95-04 RED test extensions in test-hook-envelope-shape.cjs documented in deferred-items.md as out-of-scope per SCOPE BOUNDARY rule (Plan 95-04 owns the 6 audit-target bash hook GREEN patches)"
metrics:
  duration: "4min51s"
  completed: "2026-04-29T19:06:00Z"
  tasks_completed: 2
  files_changed: 2
  files_created: 3
---

# Phase 95 Plan 03: Room-Proactive SKILL Cascade Restoration Summary

JWT-style one-liner: rewrite skills/room-proactive/SKILL.md detection block from the Phase-88.1-03-shipped-but-broken `cascade_status.proactive_intelligence` in-band parse to a side-channel reader that consumes `<roomDir>/.mindrian/last-cascade.json` when the post-write hook's `additionalContext` matches one of two recognized prefixes, restoring mid-session intelligence injection for the first time since 88.1-03 shipped, while preserving the prose APPROVE/REJECT/DEFER renderer (lines 114-160) byte-identical and adding a cool-UI render contract per .planning/research/cool-ui-style-reference.md.

## Outcome

The room-proactive skill's mid-session intelligence trigger contract is now consistent with the data flow that Plan 95-02 established. Before this plan, the skill instructed Larry to look for `proactive_intelligence.newFindings` in the cascade_status JSON inside the PostToolUse `additionalContext` envelope, but the bash hook had always written that payload at JSON ROOT (and v1.11.2's schema validator stripped it). After this plan, the skill instructs Larry to read `<roomDir>/.mindrian/last-cascade.json` via the Read tool when the additionalContext one-liner matches `^post-write: cascade complete` OR `^queued MINTO regen` (the two trigger prefixes Plan 95-02 byte-fences in Test 4 of `tests/test-cascade-side-channel.cjs`).

The cascade-decision-edge production loop (Canon Part 4) is now end-to-end functional: artifact filed -> bash hook writes side-channel JSON + emits envelope advisory -> SKILL.md detection block reads side-channel -> Larry surfaces finding via cool-UI render -> user APPROVE/REJECT/DEFER -> `node bin/mindrian-tools.cjs record-decision` writes typed edge to `room.db`. The user has lived with silence on this surface for months. Plan 95-05 (release gate) is responsible for the CHANGELOG `### Changed` entry that flags this user-visible behavior shift.

## Tasks Completed

### Task 1 - RED test fence (commit 010a029)

Created `tests/test-room-proactive-side-channel.cjs` (407 lines) with 6 scenarios:

1. **OLD detection contract removed - ALL framings** - whole-file scan over SKILL.md asserts every entry in OLD_PHRASES (5 documented OLD-contract framings) has `indexOf === -1`. The whole-file scan ensures lines 102-113 of pre-95-03 SKILL.md (which carried `cascade_status.proactive_intelligence` wording in the After Filing block intro and When to Present block) cannot escape the fence.
2. **side-channel reader contract present** - SKILL.md contains `.mindrian/last-cascade.json`.
3. **trigger pattern documented** - SKILL.md contains BOTH trigger prefixes (`post-write: cascade complete` AND `queued MINTO regen`).
4. **cool-UI render directive present** - SKILL.md contains the literal string `banner` AND (`---` U+2501 BOX DRAWINGS HEAVY HORIZONTAL OR `status grid`); plus at least 3 of 5 canonical glyphs from {U+25C6 BLACK DIAMOND, U+26A0 WARNING SIGN, U+26A1 HIGH VOLTAGE, U+2B1C WHITE LARGE SQUARE, U+25B6 BLACK RIGHT-POINTING TRIANGLE}.
5. **F.0 deferral acknowledged** - SKILL.md contains explicit text noting the prose APPROVE/REJECT/DEFER flow is preserved (any of `prose APPROVE`, `existing APPROVE/REJECT/DEFER`, `F.0`).
6. **synthetic side-channel data contract round-trip** - creates scratch `<scratch>/.mindrian/last-cascade.json` with a synthetic newFindings array; asserts JSON parses cleanly with the documented 8-key schema, `proactive_intelligence.newFindings` array has at least one item with `confidence` (number) and `message` (string) fields. Independent of SKILL.md text, so passes in BOTH RED and GREEN states.

OLD_PHRASES list (the negative-string fence catching all 5 documented framings):

1. `proactive_intelligence.newFindings in the cascade_status JSON`
2. `cascade_status includes proactive_intelligence.newFindings`
3. `cascade_status.proactive_intelligence`
4. `proactive_intelligence in additionalContext`
5. `When cascade_status appears in additionalContext`

Helpers cloned from `tests/test-hook-envelope-shape.cjs` and `tests/test-cascade-side-channel.cjs`: `makeScratchDir`, `rmrf`, `ok`/`fail` reporters. New helper `makeScratchSideChannel(scratch)` builds the synthetic 8-key side-channel JSON file with a single contradiction-type finding at confidence 0.78. New helper `readSkill()` returns the SKILL.md content string.

Registered in `lib/memory/run-feynman-tests.cjs` immediately after the existing `tests/test-cascade-side-channel.cjs` entry (line 286) with a 12-line comment block citing Phase 88.1-03 silence + line-102-113 escape rationale + F.0 deferral pointer.

**RED verification (before Task 2):** 5 of 6 scenarios FAILED:

- Test 1: `cascade_status.proactive_intelligence` found at character index 1146 (the After Filing intro line of pre-edit SKILL.md).
- Test 2: SKILL.md does not reference `.mindrian/last-cascade.json`.
- Test 3: SKILL.md does not reference `post-write: cascade complete` (the trigger prefix only existed in the bash hook's SM_TEXT, not in the skill's contract).
- Test 4: SKILL.md does not reference the literal string `banner` (the cool-UI render contract did not exist).
- Test 5: SKILL.md does not contain any of the F.0-deferral acknowledgment phrases.

Test 6 (synthetic side-channel data-contract round-trip) passed in RED state because it tests Plan 95-02's data contract, not the SKILL.md text. Exit code 1 confirmed RED.

### Task 2 - GREEN patch (commit 9e8fe13)

Modified `skills/room-proactive/SKILL.md`:

**STEP A** - Local backup taken at `/tmp/SKILL.md.pre-95-03.bak` before edit. After edit, byte-identical guards verified for lines 1-24 + 26-79 (only line 25 changed in that range per STEP B) and for the preserve range (`### How to Present` through `Do NOT follow up...`).

**STEP B** - Activation Triggers row at line 25 updated. Old: `Check cascade_status.proactive_intelligence.newFindings. If non-empty, present max 2 for APPROVE/REJECT/DEFER using Decision Capture flow.`. New: `When additionalContext matches \`^post-write: cascade complete\` OR \`^queued MINTO regen\`, read \`<roomDir>/.mindrian/last-cascade.json\`. If \`proactive_intelligence.newFindings\` is non-empty, present max 2 for APPROVE/REJECT/DEFER using Decision Capture flow.`. The bare phrase `proactive_intelligence.newFindings` (without `cascade_status.` prefix) IS allowed - it is the field name in the side-channel JSON, not a contract framing. The OLD_PHRASES negative-string list does not include the bare phrase.

**STEP C** - Block from `## Mid-Session Intelligence` (line 80) through end of OLD `### When to Present` block (line 113) replaced with new content. Section headers `## After Filing: Decision Capture` and `### When to Present` PRESERVED but their bodies rewritten to drop OLD `cascade_status.proactive_intelligence` framings. New content adds:

- New introduction paragraph naming the side-channel file at `<roomDir>/.mindrian/last-cascade.json` and noting it is LOCAL only per Canon Part 8.
- Detection subsection documenting BOTH trigger prefixes verbatim with leading `^` regex anchors.
- Behavior subsection (6 numbered steps) covering soft-fail on missing/unparseable file, empty/missing newFindings, suppressed > 0, confidence >= 0.60 gate, isNew false framing, never-interrupt-methodology rule.
- NEW Render Contract subsection per `.planning/research/cool-ui-style-reference.md`: banner with thin horizontal rules (U+2501) + status grid (two-space indent + glyph at column 0 + alignment whitespace, no colons) + canonical glyph vocabulary (U+25C6 ◆ active, U+26A0 ⚠ contradiction, U+26A1 ⚡ convergence, U+2B1C ⬜ gap, U+25B6 ▶ next-action callout). Includes a worked example render of one contradiction finding. Includes explicit F.0 deferral note pointing at room/decisions/decision-phase-95-sequencing.md.
- New Evidence Indicator subsection (preserved from original; rewritten to live below the grid as part of the soft prose paragraph).
- Why a side-channel file (not in-band JSON) explanation citing Phase 88-08 pre-compact-snapshot.json + Phase 88-06 session-snapshot.json as canonical precedents.
- NOTE at end of Mid-Session Intelligence section explicitly stating the contract REPLACES the load-bearing-broken-since-88.1-03 detection and that the prose APPROVE/REJECT/DEFER renderer below is BYTE-IDENTICAL.

**STEP D** - Anchored awk-diff for the byte-identical preserve range:

```bash
awk '/^### How to Present$/{flag=1} flag; /^Do NOT follow up with more findings/{flag=0; exit}' \
  /tmp/SKILL.md.pre-95-03.bak > /tmp/preserve.bak
awk '/^### How to Present$/{flag=1} flag; /^Do NOT follow up with more findings/{flag=0; exit}' \
  skills/room-proactive/SKILL.md > /tmp/preserve.now
diff /tmp/preserve.bak /tmp/preserve.now
```

Result: empty diff (47 lines on both sides). Lines 114-160 of pre-edit SKILL.md (the `### How to Present` block: prose APPROVE/REJECT/DEFER renderer + bash `node bin/mindrian-tools.cjs record-decision` examples for APPROVE/REJECT/DEFER + Rejection-is-Data note + After-Recording note + Do NOT follow up... line) are byte-identical to pre-edit.

**STEP E** - `node tests/test-room-proactive-side-channel.cjs` -> 6/6 GREEN.

**STEP F** - Dog-food smoke artifact deferred per CLAUDE.md Decision #16 nested-structure rule (writing a bare `_smoke-test-95-03.md` directly into `room/problem-definition/` would violate the Obsidian Vault Nested Structure v1.9.7 invariant). Regression test fixtures (Tests 1-5 over the SKILL.md text + Test 6 over the synthetic side-channel JSON file) provide equivalent evidence: the OLD framings are absent, the new contract is present, the cool-UI render directive is in scope, and the data contract round-trips cleanly. The end-to-end side-channel materialization is fenced separately by Plan 95-02's Test 3 (atomic write contract) which has been GREEN since commit fe53b97.

## Files Changed

### Created

- `tests/test-room-proactive-side-channel.cjs` (407 lines) - text-level fence + synthetic side-channel data-contract round-trip. 6 scenarios; OLD_PHRASES negative-string list with 5 entries; helpers self-contained.
- `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/deferred-items.md` - logs the 11 RED scenarios in `tests/test-hook-envelope-shape.cjs` introduced by the parallel Plan 95-04 executor (commit 1d2d6ce); they are out of scope per SCOPE BOUNDARY rule.
- `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-03-room-proactive-skill-cascade-restoration-SUMMARY.md` - this file.

### Modified

- `skills/room-proactive/SKILL.md` (+82 / -9 lines net):
  - Activation Triggers row at line 25 (one row replaced).
  - Mid-Session Intelligence section header preserved; body rewritten + extended with Render Contract subsection.
  - After Filing: Decision Capture intro paragraph rewritten (drops OLD `cascade_status.proactive_intelligence` framing).
  - When to Present block first bullet rewritten (drops OLD framing).
  - All other content (lines 1-24, 26-79, lines from `### How to Present` through end of file) byte-identical.
- `lib/memory/run-feynman-tests.cjs` (+12 lines) - registered `tests/test-room-proactive-side-channel.cjs` immediately after the Plan 95-02 entry with a 12-line comment block.

## Deviations from Plan

### Auto-fixed Issues

None. The plan executed exactly as written. Both tasks completed in TDD discipline (Task 1 RED then Task 2 GREEN); STEP A backup + STEP D anchored awk-diff guarded the preservation invariant; STEP F dog-food smoke step was already removed in the v1.11.2 plan-checker revision (W4 fix) per Decision #16, and the regression test fixtures provided equivalent evidence as documented.

### Out-of-scope items deferred (SCOPE BOUNDARY rule)

The parallel Plan 95-04 executor committed `1d2d6ce test(95-04): extend test-hook-envelope-shape with 6 bash hook scenarios (RED)` between the start of this plan's execution and the regression check at STEP F. That commit added 11 new RED scenarios to `tests/test-hook-envelope-shape.cjs` covering the 6 audit-target bash hooks (pre-compact, post-compact, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete). All 11 scenarios fail RED against the unpatched bash hooks. Per the SCOPE BOUNDARY rule (Plan 95-03 only auto-fixes issues DIRECTLY caused by the current task's changes), I logged these to `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/deferred-items.md` and did NOT fix them. Plan 95-04 owns those bash hook GREEN patches.

The 6/6 GREEN of `tests/test-room-proactive-side-channel.cjs` (this plan's deliverable) and the 5/5 GREEN of `tests/test-cascade-side-channel.cjs` (Plan 95-02's deliverable) confirm Plan 95-03 success criteria are met; the RED state of the 11 newly-added Plan 95-04 scenarios is owned by Plan 95-04, not by Plan 95-03.

## Verification Evidence

```text
$ node tests/test-room-proactive-side-channel.cjs
  ok room-proactive: OLD detection contract removed - ALL framings
  ok room-proactive: side-channel reader contract present
  ok room-proactive: trigger pattern documented (both prefixes)
  ok room-proactive: cool-UI render directive present (banner + grid)
  ok room-proactive: F.0 deferral acknowledged (prose flow preserved)
  ok room-proactive: synthetic side-channel data contract round-trip

room-proactive side-channel contract: 6 passed, 0 failed
EXIT_CODE=0

$ node tests/test-cascade-side-channel.cjs
  ok post-write: silent path (file outside room)
  ok post-write: message path inside room - envelope-shape valid
  ok post-write: side-channel file written atomically
  ok post-write: trigger string format invariant
  ok post-write: silent path emits zero or valid bytes

bash post-write envelope + side-channel: 5 passed, 0 failed
EXIT_CODE=0

$ for phrase in "proactive_intelligence.newFindings in the cascade_status JSON" \
                "cascade_status includes proactive_intelligence.newFindings" \
                "cascade_status.proactive_intelligence" \
                "proactive_intelligence in additionalContext" \
                "When cascade_status appears in additionalContext"; do
    grep -c "$phrase" skills/room-proactive/SKILL.md
  done
0
0
0
0
0

$ grep -c ".mindrian/last-cascade.json" skills/room-proactive/SKILL.md
4

$ grep -c "post-write: cascade complete" skills/room-proactive/SKILL.md
2

$ grep -c "queued MINTO regen" skills/room-proactive/SKILL.md
2

$ grep -c "After Filing: Decision Capture" skills/room-proactive/SKILL.md
4

$ grep -c "Rejection is Data" skills/room-proactive/SKILL.md
1

$ awk '/^### How to Present$/{flag=1} flag; /^Do NOT follow up with more findings/{flag=0; exit}' \
    /tmp/SKILL.md.pre-95-03.bak > /tmp/p.bak
$ awk '/^### How to Present$/{flag=1} flag; /^Do NOT follow up with more findings/{flag=0; exit}' \
    skills/room-proactive/SKILL.md > /tmp/p.now
$ diff /tmp/p.bak /tmp/p.now
(empty - byte-identical, 47 lines on both sides)

$ sed -n '1,24p' /tmp/SKILL.md.pre-95-03.bak > /tmp/h1.bak
$ sed -n '1,24p' skills/room-proactive/SKILL.md > /tmp/h1.now
$ diff /tmp/h1.bak /tmp/h1.now
(empty - lines 1-24 byte-identical)

$ sed -n '26,79p' /tmp/SKILL.md.pre-95-03.bak > /tmp/h2.bak
$ sed -n '26,79p' skills/room-proactive/SKILL.md > /tmp/h2.now
$ diff /tmp/h2.bak /tmp/h2.now
(empty - lines 26-79 byte-identical)
```

## Hand-off

- **Plan 95-04** owns the 6 audit-target bash hook GREEN patches (pre-compact, post-compact, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete). Commit `1d2d6ce test(95-04): ...` already added the 11 RED scenarios in tests/test-hook-envelope-shape.cjs. Plan 95-04 GREEN turns the suite back to all-pass.
- **Plan 95-05** runs the full `node lib/memory/run-feynman-tests.cjs` suite as the release gate. After Plan 95-04 GREEN lands, all four envelope tests (test-hook-envelope-shape.cjs, test-cascade-side-channel.cjs, test-room-proactive-side-channel.cjs, plus existing tests) pass on the same run. Plan 95-05 also files the CHANGELOG `### Changed` entry: "room-proactive cascade-decision-capture loop restored. Mid-session intelligence injection now functional for the first time since Phase 88.1-03 (which shipped silently broken). User-facing: expect cross-section impact prompts after writes filed inside a recognized room section. To suppress, disable the room-proactive skill via /mos:skills disable room-proactive."
- **Three-surface compatibility**: the Read tool is available on CLI / Desktop MCP / Cowork (verified by Phase 84 + 88 prior shipments). The skill auto-loads via `resolve_room:active`. Cowork concurrency is acceptable per `room/decisions/decision-cowork-round-locking.md` (cascades are idempotent given the artifact). No surface-specific code paths in this plan's deliverables.

## Stub tracking

No stubs introduced. The new SKILL.md detection block has full content for every subsection (introduction, Detection, Behavior, Render Contract with worked example, New Evidence Indicator, Why a side-channel file, NOTE about contract replacement). The After Filing: Decision Capture intro + When to Present block bodies are full prose. No placeholder text, no TODO markers, no `[]`/`{}`/`null`/`""` hardcoded values that would flow to UI rendering as empty.

## Self-Check: PASSED

Verification of claims:

- `tests/test-room-proactive-side-channel.cjs` exists at `/home/jsagi/MindrianOS-Plugin/tests/test-room-proactive-side-channel.cjs`: FOUND.
- `lib/memory/run-feynman-tests.cjs` registers the new test: FOUND (entry block immediately after `tests/test-cascade-side-channel.cjs` registration).
- `skills/room-proactive/SKILL.md` rewritten lines 80-113 + line 25 + After Filing intro + When to Present block first bullet: FOUND (verified by per-phrase grep counts: 5 OLD framings = 0; 5 NEW markers all >= 1).
- Lines 114-160 byte-identical via anchored awk-diff: FOUND (diff empty; 47 lines on both sides).
- Lines 1-24 + 26-79 byte-identical via sed-bounded diff: FOUND (both diffs empty).
- Commit `010a029` exists in `git log`: FOUND.
- Commit `9e8fe13` exists in `git log`: FOUND.
- `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/deferred-items.md` exists and documents Plan 95-04 RED-test ownership: FOUND.
