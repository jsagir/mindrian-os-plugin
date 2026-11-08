# Phase 389 caller proof (plan 389-01)

Source of truth for the file lists: 389-CALLERS.tsv, made by `node 389-caller-scan.cjs scan --out 389-CALLERS.tsv`. Print the files a plan must touch with `node 389-caller-scan.cjs allow --plan NN`.
Every answer below comes from reading the file at the line named, at the HEAD where plan 01 ran. Plugin version at the run: 2.0.0-beta.82.
A name in a file is not a caller. Only the classes spawn, require and path-string are callers.

Class counts in the table at the run: 304 rows. spawn 1, require 20, path-string 17, data 66, doc 50, comment 53, test 97.

LIVE-NON-FAMILY callers (class spawn, require or path-string, in a file outside the family). Read this list before any delete:
- mva-classifier: lib/core/semantic-index/entity-classifier.cjs:53, lib/wiki/briefing.cjs:29, lib/workflow/selector-decisions.cjs:55, scripts/entity-extract.cjs:128, scripts/spike-366-prepare.cjs:133 (a require inside a generated string), lib/memory/run-feynman-tests.cjs:1492 (a test path list).
- mva-rule-linter: scripts/check-reward-before-investment.cjs:71 (require), scripts/verify-release:414 (greps the output text "mva-rule-linter: scanning"), lib/memory/run-feynman-tests.cjs:1512.
- mva-state: scripts/first-install-router.cjs:454 and :578 (require).
- mva-run: scripts/first-install-router.cjs:480 (spawn).
- mva-brief: scripts/room-naming-selector.cjs:74 (path-string, reads the file mva-brief.json).
- mva-detect, mva-option-router, mva-orchestrator, mva-progressive-renderer, mva-telemetry, mva-deck-builder, mva-vercel-deploy, resolve-vercel-key, mva-agent-contract, mva-dispatcher, mva-budget: only lib/memory/run-feynman-tests.cjs (a list of test file paths).
- mva-pipeline, mva-option, mva-report, lib/agents/mva, mva-agent-prompts: none.

## (a) mva-classifier live callers

PROVEN live, four code callers plus one spike. selector-decisions requires `classify` at lib/workflow/selector-decisions.cjs:55 and calls it at line 207 to stage a scalar `venture_classified`. entity-classifier requires the module at lib/core/semantic-index/entity-classifier.cjs:53. briefing requires `resolveAnthropicKey` at lib/wiki/briefing.cjs:29. entity-extract requires `resolveAnthropicKey` at scripts/entity-extract.cjs:128. venture-shape-nudge names the module only in a comment (lib/core/venture-shape-nudge.cjs:32): comment, not a caller. spike-366-prepare.cjs:133 holds the require inside a string that it writes into a child script. Fate: plan 13 must move or rename, never delete.

## (b) mva-rule-linter callers

PROVEN. scripts/check-reward-before-investment.cjs:71 requires it (7 hits in that file). scripts/hooks/pre-commit:314 is a comment; the hook runs the script check-reward-before-investment.cjs at lines 324 to 327, not the library. scripts/verify-release:406 runs `check-reward-before-investment.cjs --surfaces` and line 414 reads the text `mva-rule-linter: scanning N declared surfaces` from its output. A rename of the module must keep that output prefix or edit verify-release:414 in the same commit. data/first-reward-surfaces.json also names it (data class).

## (c) mva-agent-contract and llm-name-suggester

PROVEN: llm-name-suggester does not require mva-agent-contract. lib/core/llm-name-suggester.cjs:132 is a comment that says the contract exports only runAgent, validateAgentResult and AGENT_RESULT_SHAPE and has no LLM client factory. Lines 19, 48 to 52 and 136 are comments that point at mva-classifier. The require of mva-agent-contract is made by lib/agents/mva/* and lib/core/mva-dispatcher.cjs (family files). Outside the family only the test list lib/memory/run-feynman-tests.cjs:1495 names the contract test.

## (d) mva-state

PROVEN. Require sites: lib/core/mva-orchestrator.cjs:38, scripts/mva-detect.cjs:137, scripts/first-install-router.cjs:454 and :578. The first two are family files. The router is the live non-family caller. Comment-only mentions (not callers): lib/core/doctor/mode-select-checkpoint-module.cjs:48, lib/core/eureka-deps-resolver.cjs:37, lib/core/recovery/case-file.cjs:23, lib/core/recovery/controller.cjs:16, lib/core/research-cache.cjs:31, lib/core/semantic-index/embedding-spine.cjs:323. data/arbitration-rule-catalogue.json:157 names it as data. DISPROVEN: the PRD claim that "only mva-orchestrator requires it". The first-install router requires it too.

## (e) scripts/first-install-router.cjs

PROVEN. `_fireReward` starts at line 446. Line 454 requires mva-state. Line 455 calls `mvaState.readPending()`. Line 462 calls `isAlreadyRunning()`. Line 480 spawns `path.join(__dirname, 'mva-run.cjs')` detached with stdout sent to a capture file (lines 480 to 485). Line 583 reads `pending.pipeline_status === 'complete'` for the drain, with a stable-file fallback after one retry. `SKIP_REASONS` is at line 444: no_pending, hebrew_refusal, already_running, pending_sentence_mismatch. `_classifyAndRoute` (line 330) classifies with `lib/core/greeting-intent-detector.cjs` (line 335), not with mva-classifier. So the router already classifies on its own, but it has no pending record of its own: the pending record comes only from the hook scripts/mva-detect.cjs. Without the hook the reward path ends in `no_pending`. The research claim (first-install reward depends on the hook and the runner) is PROVEN.

## (f) room-naming-selector and mva-brief.json

PROVEN reader, DISPROVEN writer. scripts/room-naming-selector.cjs:72 to 78 (`readMvaBriefSentence`) reads `<roomDir>/.mindrian/mva-brief.json` and returns an empty string when the file is missing. A whole-tree grep (tracked files, outside .planning) for `mva-brief.json` finds only that read (line 17 comment, line 74 path) and no writer. So the sentence is always the empty string unless an older release wrote the file (UNVERIFIED for older releases and for real rooms; no room data was read). lib/core/room-naming-selector.cjs:5, :105 and :112 read the completion payload of `mva_brief_rendered`, not the file. The caller of the room-naming selector is lib/core/mva-orchestrator.cjs:322, which spawns scripts/room-naming-selector.cjs. When plan 10 retires the orchestrator the room-naming shim has no caller left (decide there). Other hits for `mva-brief` as a name: scripts/mva-detect.cjs:186 (`dispatch: 'mva-brief'` in a spine-read log record), lib/core/venture-shape-nudge.test.cjs (test fixtures).

## (g) SENS-01 after mva-brief leaves

PROVEN. data/connector-registry.json:4187 holds the reverse map `"SENS-01"` with 11 commands: auto-explore, diagnose, diagnostics, discover, explore-domains, find-analogies, find-connections, mva-brief, new-project, new-surface, skill. Ten stay after mva-brief leaves. The sensor itself is lib/core/insight-sensors.cjs:642 (`SENS-01: first-material sensor`). Frontmatter `sensor_triggers: [SENS-01]` exists in commands/diagnostics.md:25, discover.md:27, explore-domains.md:30, find-analogies.md:45, find-connections.md:28, new-surface.md:29, skill.md:32 and others. The generators (build-connector-registry, build-orchestration-projection) rebuild the map. No consumer is lost.

## (h) autonomous_safe for a sub-mode, and chain_run and a bound room

PROVEN, per command row only. lib/workflow/command-resolver.cjs:233 to 243 (`validateChainAutonomy`) builds a map from command string to registry row and blocks a step when `c.autonomous_safe !== true`. It never reads `sub_mode`. lib/core/recipe-maps.cjs:172 to 199 (`postureForCommand`) wraps a single-step workflow in that function. lib/core/chain-executor.cjs:900 calls `postureFn(step.command)`, line 901 reads `verdict.autonomous_safe`, and line 928 returns `run` for `autonomousSafe && verb === 'run'`. So a Seed branch inside /mos:structure-argument (which declares `autonomous_safe: true`, commands/structure-argument.md:24, skills/structure-argument/SKILL.md:25, `sub_mode: pyramid-argument` at commands/structure-argument.md:36) inherits the flag. A chain would run the step without a gate. A card inside the command body is the only guard unless the flag changes. `chain_run` needs a bound room: lib/mcp/tools/chain.cjs:981 to 984 calls `resolveMcpWriteRoom` and returns the `no_bound_room` refusal for an unbound session (the gate_answer resume branch at line 970 carries the room of the halted chain). So a no-room Seed cannot run through `chain_run` at all; it runs as a command in conversation. The research assumption A1 is PROVEN for the resolver and chain code. The CLI chain path (scripts/act-command.cjs, pipeline-command.cjs) was not traced: UNVERIFIED.

## (i) per-turn no-room offer

PROVEN absent. There is no code that offers a venture sentence to a user with no room on every turn except the hook this phase may retire. Facts: (1) scripts/mva-detect.cjs is the only per-prompt venture path with no room: hooks/hooks.json:354, timeout 3. (2) lib/core/venture-shape-nudge.cjs needs a room: `room.db` missing returns `surface:false, skip_reason: 'no_room_db'` (lines 79 to 82), and its threshold is 3 turns (line 59). (3) Its only runtime caller is scripts/room-auto-create-nudge.cjs, which needs a `--room` argument and is not named in hooks/hooks.json or scripts/session-start (git grep: only data/render-coverage-registry.json and tests name it). (4) lib/workflow/selector-decisions.cjs:207 to 211 writes the scalar `venture_classified` only when a selector decision is logged, and it needs a room. (5) scripts/session-start:735 to 745 and first-install-router handle only the very first session. So the PRD sentence "the navigation engine already runs each turn" gives no no-room offer. Research assumption A4 is PROVEN.

## (j) telemetry schema mirror

PROVEN. lib/core/telemetry/schema.cjs:79 holds the comment "6 inherited mva.* (must mirror lib/core/mva-telemetry.cjs verbatim)" and lines 80 to 85 list the six event names. The mirror is enforced by lib/core/telemetry/schema.test.cjs lines 42 to 47 (the six names), line 60 (exactly 15 event types, 6 mva plus 9 new) and lines 113 to 116 (field checks), and by tests/test-121-01-scaffold.sh gate 3 (lib/core/mva-telemetry.cjs must be a shim of 60 lines or fewer that requires telemetry/writer). Unknown event names: lib/core/telemetry/validator.cjs:152 to 153 returns `unknown_event:<name>` and lib/core/telemetry/writer.cjs `emit()` throws `TELEMETRY_VALIDATION` for it. This runs only when a new line is written. No reader validates old lines: lib/core/mva-option-router.cjs:276 to 291 reads `~/.mindrian/telemetry/v1.13/mva.jsonl`, parses each line with a try and catch, and matches `evt.event === 'mva_brief_rendered'`. So an old line with a removed event name is skipped silently, not rejected. A rename of the event names needs the schema, its test and docs/TELEMETRY-SCHEMA.md in one commit. Writer side: mva-telemetry.cjs:36 to 48 still dual-writes the legacy path.

## Further facts that plans 07 to 13 need

- lib/memory/run-feynman-tests.cjs lines 1492 to 1512 list the MVA test files by path. A deleted test file needs its line removed or that runner breaks.
- The family has files the token table does not name by path: data/mva-heuristic-keywords.json (read by the classifier, plan 13), data/mva-deck-template.html (deck builder, plan 12), tests/test-mva-from-brief.cjs and tests/test-mva-dror-harness.cjs (self_plan empty; the table lists them under the tokens they name).
- hooks/hooks.json:354 is the only hook row for mva-detect. data/hooks-markers.json:23 says the order is load bearing: the first-install router runs right after mva-detect and reads the pending record that mva-detect wrote on the same turn. data/hooks-markers.json:23, data/arbitration-rule-catalogue.json:147 and :157, and tests/fixtures/369/hook-cold-start-baseline.json:692 also name it.
- scripts/mva-run.cjs is called from one place outside the family: scripts/first-install-router.cjs:480.
- commands/ignite.md (lines 60, 92) and commands/new-project.md (lines 55 to 64) and their skill mirrors name mva-option-router and `--from-brief <sha8>`. They are doc-class hits and plan 08 must edit them.
- commands/vault.md:17 and skills/vault/SKILL.md:19 name mva-option in prose.
- Baseline red legs that touch hook files (tier-d hooks CHECK 4, catalogue assert 12) are pre-existing: see 389-BASELINE.md.

## Depends on

Reading for the record, nothing changes in ROADMAP.md. ROADMAP.md says Phase 389 depends on Phase 388. 389-PRD.md says Phases 385 to 387. The research did not prove either line wrong. Reading: ROADMAP is the chain 385, 386, 387, 388, 389. Phase 388 depends on 385, and 386 and 387 are executed, so "after 388" contains the PRD set. Phase 388 also changes what ships (package files, tracked dist copies), which the retirement plans of this phase touch (research risks R9 and R10). The ROADMAP line stays "Phase 388".
