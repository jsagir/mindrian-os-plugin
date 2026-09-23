---
phase: quick/260923-uam
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/build-command-irreversibility-ledger.cjs
  - tests/test-356-answer-key.cjs
  - tests/test-356-ledger-build.cjs
  - tests/test-356-check.cjs
  - data/jev-labels/command-irreversibility.json
  - data/command-irreversibility-ledger.json
  - data/ROOM.md
  - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-REPORT.md
autonomous: true
requirements: [R1, R2, R3, R4, R5, R6]

must_haves:
  truths:
    - "R1: the answer key's appeal_rulings accepts exactly three ruling types, relabel, accept and override (exported APPEAL_RULING_TYPES). loadInputs refuses (INPUT_REFUSED, exit 2, nothing written) any override that names a chain-run command (the registry curated_chains plus CHAIN_SUITE_COMMANDS set, which keeps the D-14 relabel/accept path), names a command labeled irreversible: true, lacks a non-empty verbatim reason, has a source other than navigator-appeal, lacks a YYYY-MM-DD decided_at, lacks a finite p_irreversible in [0,1] or a finite threshold in (0,1], or shares its command with any other ruling"
    - "R2: an override forces flag: false for that one command only. The entry keeps its p_irreversible and text_hash and gains overridden_by: navigator-appeal; the ledger gains a top-level navigator_overrides[] (always present, [] when none) listing each override's command, p_irreversible, threshold, reason, source and decided_at. threshold, threshold_set_by, margin, false_alarm_count, false_alarms[] and chain_run_false_alarms_accepted are byte-for-byte what they would be with no override, so Jev's disagreement with the labels stays on the record. The answer key rows are never edited by an override"
    - "R3: an override is a ruling on specific numbers. The build refuses (exit 2, nothing written) when the overridden command's scored p is below T (Jev does not flag it, so the ruling is stale) or when the ruling's recorded p_irreversible / threshold differ from this build's p and T (a re-score or a relabel moved them, so a new ruling is needed)"
    - "R4: --check (still key-free, zero network, always exit 0) prints WARN: OVERRIDE_INCONSISTENT <command>: <why> for any override whose command is unknown, is chain-run, is labeled irreversible, has p below T, has flag other than false, lacks overridden_by, or is missing from navigator_overrides, and for any orphan (an entry with overridden_by, or a navigator_overrides item, with no matching override ruling in the answer key). FLAG_INCONSISTENT expects flag false on an overridden entry and p >= T everywhere else. The false-alarm recount counts labeled-false entries with p >= T, so a consistent overridden ledger shows no FALSE_ALARM_COUNT_MISMATCH"
    - "R5: the runtime is unchanged and the override is add-only-safe. lib/core/irreversibility-ledger.cjs and lib/core/chain-executor.cjs are not edited. An override can never clear the keyword hint or an explicit step.irreversible: isIrreversibleStep({command, irreversible: true}) still returns true for both overridden commands, and neither /mos:setup nor /mos:mva-brief contains any IRREVERSIBLE_HINTS substring. Both are autonomous_safe: false today, so makeGateFn() still halts them through the posture gate (reason gate_halt, no longer forced_material). The override removes the forced-material floor only"
    - "R6: the navigator's two rulings (2026-09-23, verbatim Override: don't flag, for /mos:mva-brief and /mos:setup) are in data/jev-labels/command-irreversibility.json appeal_rulings. The shipped ledger is rebuilt with --from-raw from 356-RAW-SCORES.json with zero network and no key, against the registry bytes that were actually scored (hash-verified equal to the raw file's registry_hash 43d13474...). Result: 13 of 113 flagged, false_alarm_count still 4, threshold still 0.23, every non-overridden entry identical to the pre-rebuild ledger. data/ROOM.md and 356-REPORT.md describe the override. bash tests/run-all-356.sh keeps its baseline (24 PASSED; the only FAILED leg is the em-dash guard naming only the pre-existing 356-VERIFICATION.md). Only owned paths are committed, each through git commit --only"
  artifacts:
    - path: "scripts/build-command-irreversibility-ledger.cjs"
      provides: "override ruling type: loadInputs validation, resolveNavigatorOverrides build-time gate, assembleLedger bookkeeping, runCheck consistency warnings"
      exports: ["APPEAL_RULING_TYPES", "OVERRIDE_SOURCE", "resolveNavigatorOverrides", "appealGate", "loadInputs", "assembleLedger", "runBuild", "runCheck"]
      contains: "navigator_overrides"
    - path: "data/jev-labels/command-irreversibility.json"
      provides: "the navigator's two override rulings, recorded as data"
      contains: "navigator-appeal"
    - path: "data/command-irreversibility-ledger.json"
      provides: "rebuilt ledger, 13 flagged, navigator_overrides lists /mos:mva-brief and /mos:setup"
      contains: "navigator_overrides"
    - path: "tests/test-356-answer-key.cjs"
      provides: "loadInputs override refusal and acceptance legs; three-value ruling vocabulary"
      contains: "override"
    - path: "tests/test-356-ledger-build.cjs"
      provides: "resolveNavigatorOverrides unit legs, override CLI end-to-end legs, override-aware shipped legs, shipped navigator-override and runtime legs"
      contains: "navigator_overrides"
    - path: "tests/test-356-check.cjs"
      provides: "OVERRIDE_INCONSISTENT legs, override-aware recount and flag legs, shipped --check override-clean leg"
      contains: "OVERRIDE_INCONSISTENT"
  key_links:
    - from: "data/jev-labels/command-irreversibility.json appeal_rulings (ruling: override)"
      to: "scripts/build-command-irreversibility-ledger.cjs loadInputs + resolveNavigatorOverrides"
      via: "validated before scoring, re-checked against this build's p and T after thresholding"
      pattern: "resolveNavigatorOverrides"
    - from: "scripts/build-command-irreversibility-ledger.cjs assembleLedger"
      to: "data/command-irreversibility-ledger.json entries[].flag / overridden_by / navigator_overrides"
      via: "flag = overridden ? false : p >= T"
      pattern: "overridden_by"
    - from: "data/command-irreversibility-ledger.json entries[].flag"
      to: "lib/core/irreversibility-ledger.cjs forcesIrreversible (UNCHANGED)"
      via: "the runtime reads only flag, command and text_hash; flag false means no ledger halt"
      pattern: "entry.flag !== true"
    - from: "lib/core/chain-executor.cjs isIrreversibleStep (UNCHANGED)"
      to: "IRREVERSIBLE_HINTS + step.irreversible"
      via: "both older signals are checked before the ledger, so an override can never clear them"
      pattern: "_ledgerForcesIrreversible"
---

<objective>
Give the navigator a third appeal ruling, `override`, in the Phase 356 irreversibility ledger builder. It lets the navigator unflag a command that is NOT chain-run after Jev flagged it. Then apply the navigator's two overrides (/mos:mva-brief and /mos:setup) by rebuilding the shipped ledger from the saved raw scores, with no vendor call.

Purpose: D-14 (356-CONTEXT.md) made Jev the judge and the navigator the auditor, but the only appeal paths were relabel and accept, and both apply to chain-run false alarms only. A false alarm on a command that is not chain-run shipped flagged with no way back. The navigator ruled on 2026-09-23 (AskUserQuestion, verbatim): /mos:mva-brief = "Override: don't flag"; /mos:setup = "Override: don't flag"; then "Build an override ruling (Recommended)". An override must never quietly weaken anything else: labels, T, false_alarms and the runtime reader stay untouched, and --check proves every override is consistent.

Output: the override ruling type in scripts/build-command-irreversibility-ledger.cjs, new test legs in the three existing 356 test files (no assertion deleted, only extended), the two rulings recorded as data, the rebuilt ledger (13 flagged), and data/ROOM.md plus a 356-REPORT.md addendum.

Two facts found during planning. The executor must honor both:
1. `--from-raw` against the CURRENT registry refuses (exit 2). Phase 361-07 (commit 9c739dcf9, a peer session, 2026-09-23 20:51) changed the /mos:dominant-designs `teaching` line after the 356 scoring. The shipped `--check` already prints `WARN: STALE /mos:dominant-designs`. That entry has p 0.1, flag false and label false, so ignoring it at runtime changes no halt. The fix: rebuild against the registry bytes that were actually scored, `git show 9c739dcf9^:data/command-registry.json`, after checking that their sha256 equals the raw file's `registry_hash` (43d13474f8028fb9a2cc589388a9aa2a2ef90cf5a7bb55fee10eb203c850f9f8). The only diff between those bytes and HEAD is that one teaching line (one hunk), so `curated_chains` and the chain-run set are identical. This keeps the T-356-09 staleness refusal intact. Never add a stale-tolerance flag.
2. Both overridden commands are `autonomous_safe: false` in the registry, so the chain executor's posture gate still halts them. What actually changes today: the halt reason goes from `forced_material` to `gate_halt`, and the forced-material floor is gone. If either command ever becomes autonomous_safe, unattended chains would run it without stopping. That is the tradeoff the navigator accepted. The SUMMARY and the REPORT addendum must state this plainly.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-CONTEXT.md
@scripts/build-command-irreversibility-ledger.cjs
@lib/core/irreversibility-ledger.cjs

<interfaces>
Current builder surfaces (scripts/build-command-irreversibility-ledger.cjs), line refs at plan time:
- appealGate(opts) ~l.410: returns chain-run false alarms with no accept ruling. Unchanged by this plan.
- loadInputs({ registryPath, labelsPath, root }) ~l.454: parses the registry JSON (variable `registry`), rows, labels; appeal_rulings validation at ~l.523-532 (currently: command must be in the registry, ruling must be 'relabel' or 'accept', message contains 'invalid ruling'). Returns { registry, rows, registryHash, policy, labels, labelsHash, labelsByCommand }.
- assembleLedger(opts) ~l.560: entries[i].flag = p_irreversible >= threshold; top-level field order ends ... false_alarm_count, false_alarms, chain_run_false_alarms_accepted, jev_calls, ...
- runBuild(opts) ~l.627: loadInputs -> score or from-raw -> computeThreshold -> chainRunCommands -> appealGate (exit 4) -> acceptedChainRun -> assembleLedger -> writeFileAtomic. Exit codes: 0 ok, 1 threshold/scoring, 2 refused input, 3 no key, 4 appeal gate.
- runCheck(opts) ~l.845: FLAG_INCONSISTENT uses expectedFlag = p >= T; recount currently counts label false AND entry.flag === true (this recount must change, see Task 2).
- chainRunCommands(registry) returns a sorted array; the real registry gives 31 commands; neither /mos:setup nor /mos:mva-brief is in it.

Runtime (NOT edited): lib/core/irreversibility-ledger.cjs _build() reads only entry.flag === true, entry.command, entry.text_hash (64-hex, compared with the CURRENT registry row). lib/core/chain-executor.cjs exports isIrreversibleStep and IRREVERSIBLE_HINTS ['email','deploy','publish','send','release','external-write','external_write'] (substring match on step.command only); makeGateFn() checks isIrreversibleStep first, then quality, then posture (autonomous_safe && verb 'run').

Shipped values at plan time: threshold 0.23 (set by /mos:new-surface), false_alarms [/mos:mva-brief p 0.88, /mos:mva-report, /mos:research, /mos:setup p 0.23], 15 flagged, build_mode jev-live, registry_hash 43d13474..., jev_model jev-1.13.0. Both data files are canonical JSON.stringify(obj, null, 2) + newline; appeal_rulings is the last key of the answer key and is currently [].

Baselines at plan time: test-356-ledger-build 81 pass, test-356-check 43 pass, test-356-answer-key 35 pass; bash tests/run-all-356.sh PASSED=24 FAILED=1 (em-dash guard, only .planning/phases/356-.../356-VERIFICATION.md, committed in f47f5981f, pre-existing, NOT owned by this task).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Override ruling type in the builder (validation, build-time gate, ledger bookkeeping)</name>
  <files>scripts/build-command-irreversibility-ledger.cjs, tests/test-356-answer-key.cjs, tests/test-356-ledger-build.cjs</files>
  <read_first>
    - scripts/build-command-irreversibility-ledger.cjs (full; already in context above)
    - tests/test-356-answer-key.cjs lines 103-266 (unit-leg helpers makeUnitWorld, baseAnswerKeyObj, writeLabels, checkThrows)
    - tests/test-356-ledger-build.cjs lines 108-182 (makeWorld, writeAnswerKey, runCli), 264-308 (leg 2), 359-439 (leg 5), 501-637 (legs 7-8), 663-724 (leg 10)
  </read_first>
  <behavior>
    - APPEAL_RULING_TYPES deep-equals ['relabel', 'accept', 'override']; OVERRIDE_SOURCE === 'navigator-appeal'
    - loadInputs: a ruling 'maybe' is still refused and the message still contains 'invalid ruling' and now names all three valid values
    - loadInputs: a well-formed override on /mos:setup (non-chain-run, labeled false) loads without throwing
    - loadInputs: an override on /mos:find-analogies (chain-run) is refused, the message names the command and says chain-run
    - loadInputs: an override on a command labeled irreversible: true is refused
    - loadInputs: an override with an empty reason, a source other than navigator-appeal, a missing or non-YYYY-MM-DD decided_at, a non-number p_irreversible, or a non-number threshold is refused (one leg each)
    - loadInputs: an override plus an accept for the same command, and two overrides for the same command, are each refused
    - resolveNavigatorOverrides (pure, Maps like appealGate): returns the override when p >= T and the recorded p/T equal this build's; reports a problem when p < T; reports a problem when the recorded p or T differ; reports a problem for a chain-run or labeled-true command (belt and braces)
    - CLI fixture build (world: /mos:publish labeled true p 0.97, /mos:setup p 0.99, default 0.05): with no ruling, /mos:setup ships flag true; with an override {p 0.99, threshold 0.97}, exit 0, the /mos:setup entry has flag false, overridden_by navigator-appeal, p 0.99, navigator_overrides lists it, false_alarm_count and false_alarms equal the no-ruling build, chain_run_false_alarms_accepted is [], and every other entry equals the no-ruling build
    - CLI: an override whose recorded threshold is wrong (0.5) exits 2 and writes no ledger; an override on a command left at default p 0.05 exits 2 and writes no ledger; an override on /mos:find-analogies exits 2 before scoring and writes no ledger
    - CLI: --from-raw with the override rebuilds entries identical to the fixture override build, zero network
    - leg 5 extension: 'navigator_overrides' is in the required top-field list and is [] with no rulings; the four-field entry check is unchanged
    - leg 10 extension (data-agnostic, passes on the current shipped ledger and after Task 3): an entry may carry a fifth key overridden_by === 'navigator-appeal' only if its command is listed in shippedLedger.navigator_overrides (a missing field is treated as []); flag consistency expects false for listed overrides and p >= T otherwise
  </behavior>
  <action>
RED first. Add the legs listed in behavior, run both test files, confirm the new legs FAIL and every pre-existing leg still passes, and keep that RED output for the SUMMARY. Then implement. Per the navigator ruling of 2026-09-23 and 356 D-14/D-15:

(a) Export two frozen constants near appealGate. APPEAL_RULING_TYPES is ['relabel', 'accept', 'override']. OVERRIDE_SOURCE is 'navigator-appeal'. Add a header comment block explaining the override: it is allowed only for commands that are not chain-run; a chain-run false alarm keeps relabel or accept. It forces flag false for that one command. It is add-only-safe because the runtime reader is unchanged and the keyword hint and explicit step.irreversible still win. It never edits labels or T.

(b) loadInputs. Compute the chain-run set once from the parsed `registry` with chainRunCommands, and return it as `chainRun` (sorted array) alongside the existing fields. runBuild reuses inputs.chainRun instead of recomputing it. Replace the two-value ruling check with APPEAL_RULING_TYPES. Keep the words 'invalid ruling' in the message and append the three valid values. For every ruling === 'override', push a problem naming the command for each failed rule: the command is chain-run (the message says chain-run and points to relabel or accept per D-14); the label row is not irreversible: false (the message says an override only clears a false alarm, relabel instead); reason is not a non-empty trimmed string; source !== OVERRIDE_SOURCE; decided_at does not match /^\d{4}-\d{2}-\d{2}$/; p_irreversible is not a finite number in [0,1]; threshold is not a finite number with 0 < T <= 1. Also push a problem when a command carries an override and any other ruling (including a second override). All problems collect into the existing single INPUT_REFUSED throw.

(c) Add exported resolveNavigatorOverrides({ appealRulings, pByCommand, threshold, chainRun, labelsByCommand }). It accepts a Map or a plain object for pByCommand and labelsByCommand, and an array or Set for chainRun, the same way appealGate does. It returns { overrides, problems }. For each override ruling, collect a problem string naming the command when: the scored p is missing or below threshold (stale: Jev does not flag it, remove or re-rule); ruling.p_irreversible !== p or ruling.threshold !== threshold, using strict equality on the stored numbers with no epsilon (message: ruled on p=X T=Y, this build p=A T=B, a new score needs a new ruling); the command is chain-run; the label is not false. Otherwise push { command, p_irreversible, threshold, reason, source, decided_at } using the build's p and T. Sort overrides by command.

(d) runBuild. After the appeal gate and before assembleLedger, call resolveNavigatorOverrides. If there are problems: print one line per problem to stderr, prefixed 'OVERRIDE REFUSED: ', return { exitCode: 2, error }, and write nothing (in live mode the raw file was already written before thresholding, so a re-rule costs no vendor call). Pass `overrides` to assembleLedger, and append ', overrides=' + count to the success console line.

(e) assembleLedger takes opts.overrides (default []). An entry whose command is overridden gets flag false and a trailing key overridden_by: OVERRIDE_SOURCE, with key order command, p_irreversible, flag, text_hash, overridden_by. Every other entry keeps exactly its four keys and flag = p >= T. Add the top-level navigator_overrides (the sorted array, [] when none) immediately after chain_run_false_alarms_accepted. Leave the schema string at command-irreversibility-ledger/v1: the fields are additive and the runtime reader ignores the schema (Claude's discretion, record it in the SUMMARY). Do not touch computeThreshold, appealGate, the false_alarms or false_alarm_count computation, or --from-raw's staleness refusals.

(f) Tests. In tests/test-356-answer-key.cjs, add the loadInputs unit legs next to the existing appeal_rulings legs. The override fixture object has the keys command, ruling, reason, source, decided_at, p_irreversible, threshold. Assert inside the test that /mos:setup is not in b.chainRunCommands(real registry) and /mos:find-analogies is. Extend the 'maybe' leg's matcher so it also requires the three names; do not remove its existing 'invalid ruling' condition. In tests/test-356-ledger-build.cjs: add leg 2b (resolveNavigatorOverrides unit), the leg 5 extension, a new leg 11 (override CLI end-to-end plus --from-raw, reusing makeWorld and runCli, with assertNoNetworkAttempt after every spawn), and the data-agnostic leg 10 extension. Keep the final NET_ATTEMPTS leg last. Hyphens only, no em-dashes. Do not edit lib/ or hooks/.

Commit (shared tree, owned paths only, never gsd-tools query commit): git add scripts/build-command-irreversibility-ledger.cjs tests/test-356-answer-key.cjs tests/test-356-ledger-build.cjs && git commit --only -m "feat(quick-260923-uam): navigator override appeal ruling in the irreversibility ledger builder" -- scripts/build-command-irreversibility-ledger.cjs tests/test-356-answer-key.cjs tests/test-356-ledger-build.cjs (end the message with the session's attribution trailer).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && env -u TYPESAFE_API_KEY node tests/test-356-answer-key.cjs && env -u TYPESAFE_API_KEY node tests/test-356-ledger-build.cjs && node -e "const b=require('./scripts/build-command-irreversibility-ledger.cjs');process.exit(JSON.stringify(b.APPEAL_RULING_TYPES)==='[\"relabel\",\"accept\",\"override\"]'&&b.OVERRIDE_SOURCE==='navigator-appeal'&&typeof b.resolveNavigatorOverrides==='function'?0:1)" && git diff --quiet HEAD -- lib/core/irreversibility-ledger.cjs lib/core/chain-executor.cjs</automated>
  </verify>
  <done>Both test files exit 0. Pass counts rise above the baselines (35 and 81) with zero failures, and the RED run is recorded. The builder refuses every malformed or unsafe override before writing anything. A valid override ships flag false plus overridden_by, while false_alarms, false_alarm_count, T and every other entry stay unchanged. The runtime files are untouched. The commit contains exactly the three owned paths.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: --check validates every override (OVERRIDE_INCONSISTENT, override-aware flag and recount)</name>
  <files>scripts/build-command-irreversibility-ledger.cjs, tests/test-356-check.cjs</files>
  <read_first>
    - scripts/build-command-irreversibility-ledger.cjs runCheck and runCheckCli (after Task 1)
    - tests/test-356-check.cjs lines 94-205 (makeCheckWorld, leg 1 "exactly one warning"), 309-356 (legs 5-6), 438-451 (leg 11)
  </read_first>
  <behavior>
    - Override world (own temp fixture: default_p 0.05, /mos:publish 0.97, /mos:setup 0.99; /mos:publish labeled true; a valid /mos:setup override with p 0.99, T 0.97; ledger built with the real CLI): --check prints exactly one warning (BUILD_MODE_FIXTURE), no FLAG_INCONSISTENT, no FALSE_ALARM_COUNT_MISMATCH, no OVERRIDE_INCONSISTENT, exit 0
    - Tamper A, orphan: the same ledger checked against a copy of the labels with the override ruling removed prints WARN: OVERRIDE_INCONSISTENT /mos:setup (no ruling)
    - Tamper B, hand-cleared halt: a copy of the no-override leg-1 ledger with /mos:publish set to flag false and overridden_by navigator-appeal prints OVERRIDE_INCONSISTENT /mos:publish
    - Tamper C: the override entry's flag set back to true prints OVERRIDE_INCONSISTENT and FLAG_INCONSISTENT for /mos:setup
    - Tamper D: the override entry's p edited below T prints OVERRIDE_INCONSISTENT /mos:setup (not flagged by p)
    - Tamper E: /mos:setup removed from navigator_overrides prints OVERRIDE_INCONSISTENT /mos:setup (not listed)
    - Tamper F: an override ruling for /mos:find-analogies added to a labels copy, with a matching hand-edited ledger entry, prints OVERRIDE_INCONSISTENT /mos:find-analogies (chain-run)
    - Runtime: with MINDRIAN_COMMAND_REGISTRY pointed at the world registry and MINDRIAN_IRREVERSIBILITY_LEDGER pointed at the override ledger (the leg-2 env pattern, restored after, with __reset on the ledger lib and the resolver), forcesIrreversible('/mos:setup') === false and forcesIrreversible('/mos:publish') === true
    - Every existing leg (1-11) still passes unchanged; leg 11 is extended so the shipped --check output contains no OVERRIDE_INCONSISTENT, FLAG_INCONSISTENT, FALSE_ALARM_COUNT_MISMATCH or ANSWER_KEY_DRIFT line (it may still print the pre-existing STALE /mos:dominant-designs)
  </behavior>
  <action>
RED first. Add the legs in behavior to tests/test-356-check.cjs, confirm they fail, and record the RED output. Then extend runCheck, keeping its contract: it never throws, it never calls client.loadKey or client.jev, and runCheckCli always exits 0 (SPEC R6: advisory, never a release blocker). This implements the navigator's requirement that --check validate every override.

(a) Next to the existing readRegistryRows call, also parse the registry JSON inside its own try (failure just skips the chain-run rule; REGISTRY_MISSING already reports). Compute chainRunCommands from it.

(b) From labelsObj.appeal_rulings, take the entries with ruling === 'override'. From the ledger, take navigator_overrides (a missing or non-array value counts as []).

(c) FLAG_INCONSISTENT: the expected flag is false when entry.overridden_by === OVERRIDE_SOURCE, and p_irreversible >= threshold otherwise.

(d) The recount becomes: label irreversible === false AND entry.p_irreversible >= ledger.threshold. That is the definition of a Jev false alarm, and it matches the recount in test-356-ledger-build leg 5. An override therefore never produces a FALSE_ALARM_COUNT_MISMATCH.

(e) New warning code OVERRIDE_INCONSISTENT with detail '<command>: <why>'. For each override ruling, warn when: the command is not in the registry; it is chain-run; its label is not irreversible: false; it has no ledger entry; the entry has p below T; the entry's flag !== false; entry.overridden_by !== OVERRIDE_SOURCE; the ledger's navigator_overrides does not list it. For each ledger entry carrying overridden_by, and each navigator_overrides item, warn when no override ruling in the answer key names that command. That orphan check is the tamper guard against a hand-cleared halt. The override rules need the labels, so they run in the same block as the recount (only when labelsRaw parsed).

(f) Add `overrides` (count of navigator_overrides) to summary, and print it in the OK line as ', overrides=N'. Leg 1 only matches the 'command-irreversibility-ledger --check:' prefix, so it stays green. Update runCheck's header comment to list OVERRIDE_INCONSISTENT among the ledger-dependent checks.

Build every tamper world from temp copies under WORLD.tmpRoot. Never touch the real data files. Hyphens only.

Commit: git add scripts/build-command-irreversibility-ledger.cjs tests/test-356-check.cjs && git commit --only -m "feat(quick-260923-uam): --check validates navigator overrides" -- scripts/build-command-irreversibility-ledger.cjs tests/test-356-check.cjs (attribution trailer at the end).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && env -u TYPESAFE_API_KEY node tests/test-356-check.cjs && env -u TYPESAFE_API_KEY node tests/test-356-ledger-build.cjs && ! env -u TYPESAFE_API_KEY node scripts/build-command-irreversibility-ledger.cjs --check | grep -q -E '^WARN: (OVERRIDE_INCONSISTENT|FLAG_INCONSISTENT|FALSE_ALARM_COUNT_MISMATCH)'</automated>
  </verify>
  <done>test-356-check exits 0 with its pass count above 43 and zero failures, and test-356-ledger-build is still green. Every tamper world produces its named OVERRIDE_INCONSISTENT line. A consistent override world is clean apart from BUILD_MODE_FIXTURE. The shipped --check shows no override, flag or recount warning. The commit contains exactly the two owned paths.</done>
</task>

<task type="auto">
  <name>Task 3: Apply the navigator's two overrides, rebuild from raw with zero network, pin the shipped state, document</name>
  <files>data/jev-labels/command-irreversibility.json, data/command-irreversibility-ledger.json, tests/test-356-ledger-build.cjs, data/ROOM.md, .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-REPORT.md</files>
  <read_first>
    - data/jev-labels/command-irreversibility.json (tail: the "appeal_rulings": [] line, last key)
    - data/ROOM.md lines 20-41 (rows for jev-labels and the ledger)
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-REPORT.md sections "Measured numbers" and "Theo re-emission (D-13)"
  </read_first>
  <action>
Implements the navigator ruling of 2026-09-23, applied exactly as ruled.

(a) Pre-flight. Run git status --short on the five owned files; all must be clean. Never touch data/command-registry.json: the peer Phase 361 session owns it. Snapshot the current ledger with git show HEAD:data/command-irreversibility-ledger.json into a temp file for the later comparison.

(b) Record the rulings. Use the Edit tool on the answer key's "appeal_rulings": [] line, keeping canonical 2-space JSON. Add two objects, sorted by command, each with keys in the order command, ruling, reason, source, decided_at, p_irreversible, threshold. First: /mos:mva-brief, "override", "Override: don't flag", "navigator-appeal", "2026-09-23", 0.88, 0.23. Second: /mos:setup, "override", "Override: don't flag", "navigator-appeal", "2026-09-23", 0.23, 0.23. Do not change any row, reviewed_by, reviewed_at or method. The answer-key labels and the threshold stay as they are. Then confirm JSON.stringify(JSON.parse(text), null, 2) + newline equals the file text.

(c) Recover the scored registry. Write git show 9c739dcf9^:data/command-registry.json to a mktemp path. Its sha256 must equal the registry_hash inside .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-RAW-SCORES.json (43d13474f8028fb9a2cc589388a9aa2a2ef90cf5a7bb55fee10eb203c850f9f8). If it does not, STOP and report; never rebuild against a registry whose hash differs from the raw file's. If the current data/command-registry.json already hashes to that value, use the default path instead.

(d) Rebuild, zero network and keyless: env -u TYPESAFE_API_KEY node scripts/build-command-irreversibility-ledger.cjs --from-raw .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-RAW-SCORES.json --registry <the verified temp registry>. It must exit 0 and print overrides=2. If it exits 2 or 4, read the message, fix the cause (never the safety rule), and rerun. Do not attempt a live call: no key, no network.

(e) Check the result against the snapshot. Exactly 13 entries have flag true. navigator_overrides lists /mos:mva-brief and /mos:setup. false_alarm_count is 4 and false_alarms is unchanged. threshold is 0.23, with threshold_set_by and margin unchanged. build_mode is jev-live, built_from_raw is true, registry_hash is 43d13474..., and answer_key_hash is the sha256 of the new answer-key bytes. Every entry except the two overrides deep-equals its snapshot entry. The two override entries keep p 0.88 and 0.23 and their text_hash, with flag false and overridden_by navigator-appeal. Runtime: forcesIrreversible is false for both overrides and true for the other 13 flagged commands. isIrreversibleStep({command, irreversible: true}) is true for both. Neither command contains an IRREVERSIBLE_HINTS substring. makeGateFn()({ command }) returns 'halt' for both, through the posture gate, because both are autonomous_safe: false. --check prints no OVERRIDE_INCONSISTENT, FLAG_INCONSISTENT, FALSE_ALARM_COUNT_MISMATCH or ANSWER_KEY_DRIFT. The pre-existing STALE /mos:dominant-designs is expected and stays.

(f) Pin the shipped state. Add a leg 10b ("shipped navigator overrides") to tests/test-356-ledger-build.cjs, after leg 10 and before the final NET_ATTEMPTS leg. It asserts that the shipped answer key's override rulings are exactly the two above: commands, verbatim reason, source, decided_at, and p/threshold equal to the shipped ledger's p and T. It also asserts that navigator_overrides mirrors them; that the flag-true count equals the count of p >= T minus the number of overrides; that false_alarm_count still equals the p-based recount; and that every override command is outside b.chainRunCommands(real registry). It then runs the runtime assertions from (e): require lib/core/irreversibility-ledger.cjs and lib/core/chain-executor.cjs, call __reset first, and make sure neither override env var is set. The makeGateFn 'halt' assertion documents the real effect today. Its label must say that if either command is ever flipped to autonomous_safe: true, the override lets unattended chains run it, and that this leg must then be updated deliberately. The leg is pending-safe: if navigator_overrides is absent, it prints PENDING and records a pass, the same way leg 10 handles a missing ledger.

(g) Documentation, hyphens only (the run-all-356 em-dash guard covers data/ROOM.md and 356-*.md). In data/ROOM.md, update the jev-labels row: appeal_rulings now records D-14 chain-run rulings (relabel/accept) and navigator override rulings for non-chain-run false alarms, two as of 2026-09-23 (/mos:mva-brief, /mos:setup). Update the ledger row: add navigator_overrides[] and the optional per-entry overridden_by to the field list, and say that an overridden entry keeps its p and has flag false. Append a section "## Post-phase navigator overrides (2026-09-23, quick 260923-uam)" to 356-REPORT.md covering: the verbatim rulings; the override rule and its limits (non-chain-run only, labeled-false only, bound to the ruled p and T, labels and T unchanged); the rebuilt numbers (13 of 113 flagged, false_alarm_count still 4, T 0.23); the real runtime effect from the objective's fact 2; the scored-registry rebuild from fact 1, including the pre-existing STALE /mos:dominant-designs from 361-07, which a future navigator-authorized re-score clears; and one line for D-13, saying a Theo-side re-emission applies the same rule (override means flag false plus overridden_by, read from appeal_rulings).

(h) Run bash tests/run-all-356.sh. Expected: PASSED=24, and the only FAILED leg is the em-dash guard, naming only 356-VERIFICATION.md (pre-existing, not owned; do not edit it). Any other red leg must be fixed before committing.

(i) Commit, owned paths only: git add data/jev-labels/command-irreversibility.json data/command-irreversibility-ledger.json tests/test-356-ledger-build.cjs data/ROOM.md && git add -f .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-REPORT.md && git commit --only -m "feat(quick-260923-uam): apply navigator overrides for /mos:mva-brief and /mos:setup, rebuild ledger from raw" -- data/jev-labels/command-irreversibility.json data/command-irreversibility-ledger.json tests/test-356-ledger-build.cjs data/ROOM.md .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-REPORT.md (attribution trailer at the end). Do not edit .planning/STATE.md; the orchestrator owns it.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node -e "const l=require('./data/command-irreversibility-ledger.json');const k=require('./data/jev-labels/command-irreversibility.json');const f=l.entries.filter(e=>e.flag).length;const o=(l.navigator_overrides||[]).map(x=>x.command).join(',');const r=k.appeal_rulings.filter(a=>a.ruling==='override').map(a=>a.command).join(',');process.exit(f===13&&o==='/mos:mva-brief,/mos:setup'&&r===o&&l.false_alarm_count===4&&l.threshold===0.23&&l.built_from_raw===true&&l.build_mode==='jev-live'&&l.registry_hash==='43d13474f8028fb9a2cc589388a9aa2a2ef90cf5a7bb55fee10eb203c850f9f8'?0:1)" && node -e "const m=require('./lib/core/irreversibility-ledger.cjs');const ce=require('./lib/core/chain-executor.cjs');const g=ce.makeGateFn();const cs=['/mos:mva-brief','/mos:setup'];process.exit(cs.every(c=>!m.forcesIrreversible(c)&&ce.isIrreversibleStep({command:c,irreversible:true})&&!ce.isIrreversibleStep({command:c})&&!ce.IRREVERSIBLE_HINTS.some(h=>c.includes(h))&&g({command:c})==='halt')&&m.forcesIrreversible('/mos:publish')?0:1)" && env -u TYPESAFE_API_KEY node tests/test-356-ledger-build.cjs && env -u TYPESAFE_API_KEY node tests/test-356-check.cjs && env -u TYPESAFE_API_KEY node tests/test-356-answer-key.cjs</automated>
  </verify>
  <done>The answer key carries the two verbatim override rulings. The shipped ledger was rebuilt from raw with zero network: 13 flagged, false_alarm_count 4, T 0.23, navigator_overrides lists both commands, and every other entry is unchanged. At runtime, neither command is forced by the ledger, the explicit flag and keyword signals still win, and the posture gate still halts both today. The three 356 test files are green. run-all-356 matches its baseline. data/ROOM.md and 356-REPORT.md describe the override honestly. The commit contains exactly the five owned paths.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigator ruling -> answer key | a human authority decision becomes data; that data can remove a runtime halt |
| answer key + raw scores -> builder -> shipped ledger | dev-time data turns into a shipped runtime input |
| shipped ledger -> runtime isIrreversibleStep | a local data file influences whether an unattended chain stops |
| dev-time builder -> Jev vendor | not crossed in this task (from-raw only, no key) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-uam-01 | Elevation of privilege | override on a chain-run command | mitigate | loadInputs refuses an override whose command is in chainRunCommands(registry) (curated_chains plus CHAIN_SUITE_COMMANDS); resolveNavigatorOverrides re-checks; --check warns OVERRIDE_INCONSISTENT chain-run; legs in all three test files |
| T-uam-02 | Tampering | hand-edited ledger clears a halt without a ruling | mitigate | --check orphan rule: any overridden_by entry or navigator_overrides item with no matching answer-key override warns OVERRIDE_INCONSISTENT; a bare flag flip still warns FLAG_INCONSISTENT; answer_key_hash pins the ruling bytes (test-356-check tamper B) |
| T-uam-03 | Repudiation | who unflagged a command and why | mitigate | each ruling carries the verbatim reason, source navigator-appeal, decided_at, and the p and T it overrides; the ledger mirrors them in navigator_overrides; false_alarms and false_alarm_count stay unchanged, so Jev's disagreement stays visible (extends T-356-18) |
| T-uam-04 | Elevation of privilege | override weakening the older runtime signals | mitigate | runtime files not edited (git diff check in Task 1 verify); isIrreversibleStep checks step.irreversible and IRREVERSIBLE_HINTS before the ledger; legs assert explicit irreversible still halts and neither command is keyword-hit |
| T-uam-05 | Tampering | stale override keeps clearing a halt after a re-score or relabel | mitigate | resolveNavigatorOverrides refuses (exit 2, nothing written) when p < T or the recorded p/T differ from this build; --check warns when the shipped entry's p < T |
| T-uam-06 | Tampering | rebuild against text that was not scored | mitigate | --from-raw staleness refusal (T-356-09) left intact, no tolerance flag; the scored registry is recovered by hash and must equal raw.registry_hash before use; the pre-existing STALE /mos:dominant-designs stays visible in --check |
| T-uam-07 | Information disclosure | Jev dev-time key | mitigate | every command runs under env -u TYPESAFE_API_KEY; from-raw never calls client.loadKey or client.jev; the test hygiene contract (no-network preload, temp HOME) applies to every new leg |
| T-uam-08 | Denial of service (safety) | unattended chain runs a deploy step without stopping | accept | navigator-accepted tradeoff (2026-09-23). Both commands are autonomous_safe: false today, so the posture gate still halts them; the shipped leg 10b pins makeGateFn 'halt', so a future autonomous_safe flip fails a test and forces a deliberate update |
| T-uam-SC | Tampering | package installs | accept | no packages installed |
</threat_model>

<verification>
- env -u TYPESAFE_API_KEY node tests/test-356-answer-key.cjs, tests/test-356-ledger-build.cjs, tests/test-356-check.cjs each exit 0, with pass counts above 35 / 81 / 43 and zero failures.
- bash tests/run-all-356.sh: PASSED=24, and the only FAILED leg is the em-dash guard naming only 356-VERIFICATION.md (pre-existing baseline).
- git diff HEAD~3 -- lib/ hooks/ is empty for this task's commits (runtime unchanged).
- grep -c on U+2014 is 0 in every file this task touched.
- git log -3 --stat shows only the owned paths.
</verification>

<success_criteria>
- The override ruling type exists, is refused on chain-run and labeled-true commands, is tied to the numbers it was ruled on, and is validated by --check.
- The shipped ledger flags 13 of 113 commands. /mos:mva-brief and /mos:setup carry flag false and overridden_by navigator-appeal, with their p unchanged. false_alarm_count is 4 and T is 0.23.
- The rebuild made zero network calls and used no key.
- No existing assertion was deleted. The old two-value ruling check is now a three-value check.
- The SUMMARY records the RED runs, the scored-registry rebuild, the real runtime effect (posture gate still halts, the forced-material floor is removed), the pre-existing STALE /mos:dominant-designs, and the pre-existing em-dash red in 356-VERIFICATION.md.
</success_criteria>

<output>
Create `.planning/quick/260923-uam-add-a-navigator-override-appeal-ruling-t/260923-uam-SUMMARY.md` when done (git add -f; commit it with git commit --only on that one path, or leave it for the orchestrator's final docs commit if the quick workflow does that).
</output>
