---
status: resolved
trigger: "Two PostToolUse:Write hooks emit JSON envelopes that Claude Code's hook schema validator rejects with 'Hook JSON output validation failed — (root): Invalid input'"
created: 2026-04-29T00:00:00Z
updated: 2026-04-29T15:30:00Z
resolved: 2026-04-29T15:30:00Z
shipped_in: v1.11.2
---

## Current Focus

hypothesis: CONFIRMED. A1 patches applied to both .cjs hooks. Live reproduction confirms valid envelopes on message path and zero stdout bytes on silent path.
test: (DONE) New regression test tests/test-hook-envelope-shape.cjs covers 5 scenarios across all three .cjs PostToolUse hooks; passes. Three pre-existing test files (frontmatter-schema-validator 10/10, async-artifact-auto-commit 10/10, query-efficiency-telemetry 12/12) still pass. Live byte-level reproduction in /tmp scratch room confirms both patched hooks now emit `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"<message>"}}` on message path and zero bytes on silent path.
expecting: User to run an Edit/Write inside any active room and confirm the two "Hook JSON output validation failed" lines are gone, AND the bash post-write hook's "post-write: cascade complete for X.md" line is still visible.
next_action: Wait for human verification, then second checkpoint for v1.11.2 release gate approval (CHANGELOG entry + version bump 1.11.1 -> 1.11.2 + commit + tag + push).

## Symptoms

expected: PostToolUse:Write hooks return cleanly with either no stdout or a valid Claude Code hook envelope. Tool calls show no "hook error" lines.

actual: After any Write/Edit/MultiEdit call, two "Hook JSON output validation failed — (root): Invalid input" lines fire (one per failing hook), plus one succeeding "PostToolUse:Write says: post-write: cascade complete for X.md" line.

errors:
- frontmatter-schema-validator.cjs and async-artifact-auto-commit.cjs both emit `{"additionalContext": null, "systemMessage": null, "suppressOutput": false}`
- `additionalContext` is not a top-level PostToolUse field; belongs under `hookSpecificOutput`
- `systemMessage: null` is suspect; schema wants string or omitted, not explicit null
- post-write bash also emits unknown root keys (cascade_status, classification, git_commit, graph_index, proactive_intelligence) but currently appears to "work" because systemMessage is recognized

reproduction:
1. cd into any active room (e.g. ~/MindrianRooms/align-ecosystem)
2. Use Write or Edit to create/modify any .md file inside a section
3. Observe two "Hook JSON output validation failed" lines plus one "PostToolUse:Write says: ..." line

started: Phase 88.1 (v1.10.15) per file headers — frontmatter-schema-validator = Phase 88.1-07, async-artifact-auto-commit = Phase 88.1-08

## Eliminated

(none — primary hypothesis confirmed on first pass)

## Evidence

- timestamp: 2026-04-29T14:00:00Z
  checked: scripts/frontmatter-schema-validator.cjs lines 56-65 (emitEnvelope helper)
  found: Emits `{additionalContext: null, systemMessage: <string|null>, suppressOutput: false}` on EVERY exit path including the silent path (exitSilent calls emitEnvelope(null) at line 68).
  implication: Every Write/Edit/MultiEdit anywhere produces this envelope, not just rooms. The "Invalid input" fires on every tool call, matching the symptom.

- timestamp: 2026-04-29T14:00:30Z
  checked: scripts/async-artifact-auto-commit.cjs lines 63-72 (emitEnvelope helper) + line 77 (exitSilent)
  found: Identical broken envelope shape, identical silent-path bug.
  implication: This is the second of the two failing hooks. Bug is shared via copy-paste of emitEnvelope, not a single-source dependency.

- timestamp: 2026-04-29T14:01:00Z
  checked: scripts/post-write lines 186-205 (jq builds the JSON envelope)
  found: When jq is available, emits `{cascade_status, classification, git_commit, graph_index, proactive_intelligence, systemMessage}`. When jq is missing, emits `{cascade_status, systemMessage}`. Five of these are unknown root-level keys.
  implication: This is the third hook. Currently "works" only because Claude Code surfaces `systemMessage` even when other root keys are present. The user reports this hook DOES display its message ("post-write: cascade complete..."), so the current Claude Code 2.x validator may be tolerating unknown root keys when at least one valid key is present, OR the bash hook fires before the strict schema check. Either way, it's the same class of bug.

- timestamp: 2026-04-29T14:01:30Z
  checked: Live reproduction. Set up /tmp/test-room-debug with .room-root sentinel + git init + dummy commit. Piped synthetic PostToolUse JSON into both .cjs hooks.
  found: 
    - frontmatter-schema-validator.cjs stdout: `{"additionalContext":null,"systemMessage":"schema violation: source in test.md","suppressOutput":false}` (exit 0)
    - frontmatter-schema-validator.cjs stdout on silent path (file outside room): `{"additionalContext":null,"systemMessage":null,"suppressOutput":false}` (exit 0)
    - async-artifact-auto-commit.cjs stdout: `{"additionalContext":null,"systemMessage":"auto-committed to data-room-autocommit","suppressOutput":false}` (exit 0)
    - async-artifact-auto-commit.cjs stdout on silent path: same broken envelope
    - post-write bash stdout: `{"cascade_status":"complete","classification":null,"git_commit":null,"graph_index":null,"proactive_intelligence":{"status":null,...},"systemMessage":"queued MINTO regen for problem-definition, recompiled references (test.md)"}` (exit 0)
  implication: Every assumption from the orchestrator's diagnosis is now verified at the byte level.

- timestamp: 2026-04-29T14:02:00Z
  checked: scripts/query-efficiency-telemetry.cjs lines 79-104 (already-fixed comparator)
  found: This file was patched in v1.10.19 (2026-04-26) with the EXACT correct shape: `{ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: <string> } }`. The header comment at line 80-84 explicitly states "Claude Code 2.x added additionalProperties: false to the hook output schema. Top-level systemMessage and additionalContext are no longer accepted -- they must be wrapped in hookSpecificOutput." Silent path emits ZERO bytes (just exit 0); see line 87 `if (!systemMessage) return;` and line 99-103 exitSilent comment "previously called emitEnvelope(null) which wrote an invalid JSON envelope. Silent now means truly silent."
  implication: The fix was discovered and applied to ONE of three failing hooks during the v1.10.19 hotfix sprint, but the other two .cjs hooks (and the bash hook) were missed. This makes the fix shape unambiguous — it's already been decided; we just have to apply the same pattern.

- timestamp: 2026-04-29T14:02:30Z
  checked: docs.claude.com/docs/en/hooks via web search; GitHub issue anthropics/claude-code#19115 (conflicting JSON response schemas, Jan 2026)
  found: Authoritative PostToolUse output schema: `{ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "...", updatedToolOutput: {...} } }`. Top-level allowed fields: continue, stopReason, suppressOutput, systemMessage, decision, reason, hookSpecificOutput. `additionalContext` at root is NOT in the schema for PostToolUse.
  implication: The orchestrator's diagnosis is correct against the authoritative source. The fix shape is locked.

- timestamp: 2026-04-29T14:03:00Z
  checked: skills/room-proactive/SKILL.md lines 80-92 (cascade_status consumption contract)
  found: The skill expects `cascade_status` to "appear in additionalContext (from a post-write hook completing)" with proactive_intelligence.newFindings inside. Today this contract is BROKEN end-to-end: (1) the bash post-write hook puts cascade_status at JSON root, NOT in additionalContext; (2) Claude Code never surfaces unknown root keys to the agent, so the skill has been receiving NOTHING from the cascade since 88.1-03 shipped.
  implication: The bash post-write fix is not just envelope hygiene — it's a latent feature delivery bug. Cascade payload needs to either go INSIDE hookSpecificOutput.additionalContext as a JSON-stringified blob the skill parses, OR move to a side-channel file the skill reads. The orchestrator's hint to use a side-channel is cleaner because it survives the 10K char additionalContext cap and is independent of envelope schema churn.

- timestamp: 2026-04-29T14:03:30Z
  checked: package.json + .claude-plugin/plugin.json + CHANGELOG.md
  found: Current version is 1.11.1 (released today, 2026-04-29). v1.11.2 release gate is already deferred from Phase 94 with "Plan 94-10 v1.11.2-release-gate" preserved as a template. Next bump is 1.11.2.
  implication: This fix lands as v1.11.2 with a single Fixed entry, leveraging the deferred 94-10 release-gate plan.

- timestamp: 2026-04-29T14:35:00Z
  checked: Applied A1 patches. scripts/frontmatter-schema-validator.cjs lines 40-83 (replaced emitEnvelope + exitSilent + header comment to v1.11.2 envelope shape). scripts/async-artifact-auto-commit.cjs lines 40-87 (identical replacement).
  found: Both hooks now match the v1.10.19 reference pattern in scripts/query-efficiency-telemetry.cjs. emitEnvelope() returns silently when systemMessage is falsy; otherwise emits exactly `{ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: <string> } }`. exitSilent() now does nothing more than process.exit(0) -- no JSON written. Soft-fail invariant preserved (outer try/catch unchanged; always exit 0).
  implication: Patches in place. Schema-conformant on every emission path. Bash post-write hook untouched per checkpoint decision.

- timestamp: 2026-04-29T14:40:00Z
  checked: Created tests/test-hook-envelope-shape.cjs (regression fence). Registered in lib/memory/run-feynman-tests.cjs immediately after query-efficiency-telemetry.test.cjs.
  found: Test runs 5 scenarios -- two per patched .cjs hook (silent + message) plus one fence over the already-fixed v1.10.19 reference. Asserts: top-level keys subset of {continue, stopReason, suppressOutput, systemMessage, decision, reason, hookSpecificOutput}; `additionalContext` NEVER at top level; if hookSpecificOutput present, hookEventName === 'PostToolUse' and additionalContext is a string; silent path emits zero stdout bytes; hook always exits 0.
  implication: Regression fence in place for v1.11.2 patch surface. Bash post-write hook intentionally NOT gated (out of scope per checkpoint).

- timestamp: 2026-04-29T14:45:00Z
  checked: Test execution. `node tests/test-hook-envelope-shape.cjs` and `node lib/memory/{frontmatter-schema-validator,async-artifact-auto-commit,query-efficiency-telemetry}.test.cjs`.
  found: 
    - tests/test-hook-envelope-shape.cjs: 5/5 passed
    - lib/memory/frontmatter-schema-validator.test.cjs: 10/10 passed (no regressions)
    - lib/memory/async-artifact-auto-commit.test.cjs: 10/10 passed (no regressions)
    - lib/memory/query-efficiency-telemetry.test.cjs: 12/12 passed (no regressions)
    - Total: 37/37 across patch + adjacent suites
  implication: No collateral damage to pure modules. Envelope-shape regression fence is green.

- timestamp: 2026-04-29T14:50:00Z
  checked: Live byte-level reproduction. /tmp scratch room with .room-root sentinel + git init + dummy commit. Synthetic PostToolUse JSON piped to both patched hooks for both message-path and silent-path scenarios.
  found:
    - frontmatter-schema-validator.cjs (message path) stdout: `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"schema violation: title, source, status in test.md"}}` (exit 0)
    - async-artifact-auto-commit.cjs (message path) stdout: `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"auto-committed to data-room-autocommit"}}` (exit 0)
    - frontmatter-schema-validator.cjs (silent path, file outside room): zero bytes (exit 0)
    - async-artifact-auto-commit.cjs (silent path, file outside room): zero bytes (exit 0)
  implication: Both hooks now emit Claude Code 2.x-compliant envelopes on every code path. Original symptom should disappear in user terminal after install.

## Resolution

root_cause: |
  Three plugin hooks emit Claude Code PostToolUse JSON envelopes with `additionalContext` at top level. Claude Code 2.x added `additionalProperties: false` to the PostToolUse output schema, which makes top-level `additionalContext` an unrecognized field. The validator rejects every emission with "Hook JSON output validation failed — (root): Invalid input". The two .cjs hooks fail loudly (two error lines per Write/Edit/MultiEdit). The bash post-write hook also has this class of bug (multiple unknown root keys: cascade_status, classification, git_commit, graph_index, proactive_intelligence) but the user-visible systemMessage is still surfaced because Claude Code displays the recognized fields it can find.

  The correct fix pattern was discovered and applied to scripts/query-efficiency-telemetry.cjs in v1.10.19 hotfixes (2026-04-26), but the other two .cjs PostToolUse hooks (and the bash post-write hook) were missed.

fix: |
  v1.11.2 patch SCOPE NARROWED PER CHECKPOINT DECISION (2026-04-29): A1 only.
  Two patches + one regression test. Bash post-write hook DEFERRED to a follow-up.

  Patch 1: scripts/frontmatter-schema-validator.cjs (APPLIED)
    - Replaced emitEnvelope() to emit nothing on falsy systemMessage, and
      to emit `{ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: <string> } }`
      otherwise. Matches scripts/query-efficiency-telemetry.cjs (v1.10.19 reference).
    - Replaced exitSilent() to be truly silent: just process.exit(0). No stdout.
    - Updated header comment block to reflect the v1.11.2 fix shape.
    - Soft-fail invariant preserved (outer try/catch unchanged; always exit 0).

  Patch 2: scripts/async-artifact-auto-commit.cjs (APPLIED)
    - Identical fix: replaced emitEnvelope() and exitSilent() with the v1.10.19-pattern bodies.
    - Updated header comment block.
    - Soft-fail invariant preserved.

  Test: tests/test-hook-envelope-shape.cjs (CREATED + REGISTERED)
    - 5 scenarios: silent + message path for each of the two patched .cjs hooks,
      plus one fence over the already-fixed v1.10.19 query-efficiency-telemetry.cjs.
    - Pipes synthetic PostToolUse JSON into each hook from a /tmp scratch dir
      (no real rooms touched). Asserts:
      (a) silent path emits zero stdout bytes;
      (b) message path either silent or emits valid Claude Code 2.x JSON;
      (c) top-level keys are subset of {continue, stopReason, suppressOutput,
          systemMessage, decision, reason, hookSpecificOutput};
      (d) `additionalContext` does NOT appear at top level;
      (e) if `hookSpecificOutput` present, hookEventName === 'PostToolUse' and
          additionalContext is a string;
      (f) hook always exits 0.
    - Registered in lib/memory/run-feynman-tests.cjs after query-efficiency-telemetry.test.cjs.

verification: |
  Self-verification COMPLETE (all green):
  1. tests/test-hook-envelope-shape.cjs: 5/5 passed.
  2. Pre-existing test suites still pass: frontmatter-schema-validator 10/10, async-artifact-auto-commit 10/10, query-efficiency-telemetry 12/12. Total 32/32.
  3. Live byte-level reproduction in /tmp scratch room confirms:
     - frontmatter-schema-validator.cjs (message path): emits `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"schema violation: ..."}}` exit 0.
     - async-artifact-auto-commit.cjs (message path): emits `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"auto-committed to data-room-autocommit"}}` exit 0.
     - Both hooks (silent path, outside room): zero stdout bytes, exit 0.
  4. Top-level keys on every emission are a subset of the Claude Code 2.x allowed set.

  Pending HUMAN verification:
  - User runs an Edit/Write inside any active room (e.g. ~/MindrianRooms/align-ecosystem) and confirms:
    (a) The two "Hook JSON output validation failed" lines are gone.
    (b) The bash post-write hook's "post-write: cascade complete for X.md" line is still visible (untouched).

files_changed:
  - scripts/frontmatter-schema-validator.cjs
  - scripts/async-artifact-auto-commit.cjs
  - tests/test-hook-envelope-shape.cjs (new)
  - lib/memory/run-feynman-tests.cjs (registration entry)

files_NOT_changed_in_this_patch:
  - scripts/post-write (bash hook envelope fix DEFERRED)
  - skills/room-proactive/SKILL.md (cascade payload side-channel DEFERRED)
  - CHANGELOG.md (release-gate-deferred until second checkpoint)
  - package.json (version bump deferred until second checkpoint)
  - .claude-plugin/plugin.json (version bump deferred until second checkpoint)

## Follow-Ups

- room-proactive cascade loop broken since Phase 88.1-03 — bash post-write emits cascade_status at JSON root, but skills/room-proactive/SKILL.md (lines 80-112) expects it inside additionalContext. Fix is to write payload to side-channel <roomDir>/.mindrian/last-cascade.json and update SKILL.md to read from it. Out of scope for v1.11.2.

## Resolution Log

- 2026-04-29T15:30:00Z — User authorized direct ship per checkpoint response (skipped user-side verification, trusted synthetic byte-level repro: 5/5 new + 32/32 pre-existing tests).
- v1.11.2 release executed per .claude/includes/release-process.md:
  1. CHANGELOG.md entry added under [1.11.2] - 2026-04-29 with Fixed section (2 bullets) + Deferred section flagging Phase 95 (cascade loop still not firing — bash hook + room-proactive SKILL.md side-channel deferred).
  2. Version bumped 1.11.1 -> 1.11.2 in BOTH .claude-plugin/plugin.json and package.json (verified via grep — both match).
  3. Staged (explicit filenames, no `git add -A`): plugin.json, package.json, CHANGELOG.md, scripts/frontmatter-schema-validator.cjs, scripts/async-artifact-auto-commit.cjs, lib/memory/run-feynman-tests.cjs, tests/test-hook-envelope-shape.cjs (new), .planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-CONTEXT.md (new, force-added since .planning/ is in .gitignore but phase folders are tracked), .planning/TODO.md (modified — IMMEDIATE NEXT entry pointing at Phase 95), .planning/debug/post-write-hook-envelope-invalid-input.md (this file, force-added).
  4. Commit: release: v1.11.2 -- fix PostToolUse:Write hook envelope schema (Invalid input errors gone). HEREDOC commit message; standard Co-Authored-By footer.
  5. Tag: v1.11.2.
  6. Push: origin main --tags.
  7. Marketplace pin: ~/mindrian-marketplace/.claude-plugin/marketplace.json updated -- version bumped 1.11.1-beta.1 -> 1.11.2; source.ref bumped v1.11.1 -> v1.11.2. Committed + pushed in marketplace repo.
  8. Debug session moved to .planning/debug/resolved/.
- Status of original symptom: cosmetic noise gone (two "Hook JSON output validation failed" lines per Write/Edit/MultiEdit eliminated). The bash post-write hook's "post-write: cascade complete for X.md" line is unchanged. The DEEPER bug (room-proactive cascade loop never firing since 88.1-03) is NOT resolved by v1.11.2; that's Phase 95 work.
