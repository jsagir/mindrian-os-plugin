---
quick: 260911-juq
phase: quick-260911-juq
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [JUQ-01, JUQ-02, JUQ-03]
canon_parts: [6, 11]
files_modified:
  - data/hooks-markers.json
  - hooks/hooks.json
  - lib/mcp/hook-adapter-audit.cjs
  - tests/test-198-adapter-budget.test.cjs
  - tests/test-quick-260911-juq-hooks-json-top-level.cjs
  - tests/run-all-198.sh
  - CHANGELOG.md

must_haves:
  truths:
    - "A session start on Claude Code 2.1.268 no longer prints the line: hooks.json: unknown keys \"_mcpFirst198Migrated\", \"_firstInstallRouterOrdering\" ignored -- for any user, on any surface."
    - "hooks/hooks.json's top level is exactly {\"hooks\": ...}: Object.keys() returns the single-element array ['hooks']."
    - "Every matcher string and every hook command inside hooks.json's hooks block is byte-identical to HEAD fe45ad98."
    - "Both marker objects survive verbatim in data/hooks-markers.json, with the only text change being the phrase that used to point at 'the hooks key below'."
    - "lib/mcp/hook-adapter-audit.cjs's migratedSurfaces() still returns the three migrated scripts, now read from the sidecar, and still never throws."
    - "tests/test-198-adapter-budget.test.cjs stays green: the Stop migration marker is asserted from the sidecar, the Stop matcher dispatch is still asserted from hooks.json."
    - "A future edit that re-adds any extra top-level key to hooks/hooks.json fails a committed test."
    - "A future edit that silently breaks the sidecar path (so migratedSurfaces() returns [] through its never-throws catch and the D-06 budget goes vacuous) fails a committed test."
  artifacts:
    - path: "data/hooks-markers.json"
      provides: "The two Phase 198-08 / 267.2-06 markers, moved out of the loader-visible manifest"
      contains: "_mcpFirst198Migrated"
    - path: "tests/test-quick-260911-juq-hooks-json-top-level.cjs"
      provides: "Top-level-keys guard + sidecar liveness guard"
      min_lines: 60
    - path: "hooks/hooks.json"
      provides: "Loader-clean hook manifest, hooks key only"
  key_links:
    - from: "lib/mcp/hook-adapter-audit.cjs"
      to: "data/hooks-markers.json"
      via: "HOOKS_MARKERS_PATH readFileSync in migratedSurfaces()"
      pattern: "hooks-markers\\.json"
    - from: "tests/run-all-198.sh"
      to: "tests/test-quick-260911-juq-hooks-json-top-level.cjs"
      via: "run_if leg in the SPEC-5 section"
      pattern: "test-quick-260911-juq-hooks-json-top-level"
---

<objective>
Claude Code 2.1.268 prints `hooks.json: unknown keys "_mcpFirst198Migrated", "_firstInstallRouterOrdering" ignored` at every session start, for every user, on every surface that loads the plugin manifest. The two keys are our own build metadata, not hook configuration: the loader is correct to ignore them and correct to complain.

Move both markers verbatim into `data/hooks-markers.json`, leave `hooks/hooks.json` with exactly one top-level key (`hooks`), repoint the one production reader (`lib/mcp/hook-adapter-audit.cjs`) and the one test reader at the sidecar, and commit a guard so neither the stray key nor a silently-dead sidecar path can come back.

Purpose: the warning is user-visible noise on a commercial install and it is the kind of noise that trains users to ignore real warnings.
Output: one new data file, one stripped manifest, two repointed readers, one new guard test, one runner leg, one CHANGELOG entry.

Tri-Polar: hooks fire on the CLI, but Desktop and Cowork load the plugin manifest too, so the warning is cross-surface. The fix is one file and surface-neutral: nothing surface-specific is added or removed.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@hooks/hooks.json
@lib/mcp/hook-adapter-audit.cjs
@tests/test-198-adapter-budget.test.cjs
@tests/run-all-198.sh
@CHANGELOG.md
</context>

<facts_established_during_planning>
Do not re-derive these; they were measured against HEAD fe45ad98 during planning.

- `hooks/hooks.json` top-level keys today, in order: `_mcpFirst198Migrated`, `_firstInstallRouterOrdering`, `hooks`. 493 lines, 15236 bytes, 2-space indent, trailing newline.
- `  "hooks": {` starts at line 25. The whole-file rewrite `'{' + raw.slice(raw.indexOf('\n  "hooks": {'))` was executed during planning: it parses, `Object.keys()` is `["hooks"]`, and the sliced text is character-for-character identical to the original from that index onward. Use exactly this transform; do NOT reserialize through `JSON.stringify`, which would reflow the matcher strings' surrounding whitespace.
- Repo-wide grep for `_mcpFirst198Migrated` and `_firstInstallRouterOrdering` (excluding node_modules and .planning) returns readers in exactly two files: `lib/mcp/hook-adapter-audit.cjs` (:4 comment, :71 jsdoc, :81 `parsed._mcpFirst198Migrated`) and `tests/test-198-adapter-budget.test.cjs` (:4 comment, :252 test title, :255 `parsed._mcpFirst198Migrated`). Nineteen other files read `hooks/hooks.json`; none of them touches either marker.
- `HOOKS_JSON_PATH` in `lib/mcp/hook-adapter-audit.cjs` is defined at :29 and used at exactly one site (:79). After the repoint it has no remaining consumer in that file.
- `tests/run-all-198.sh` exists and already runs `node tests/test-198-adapter-budget.test.cjs` under a `run_if` gated on `lib/mcp/hook-adapter-audit.cjs`, inside the `SPEC-5` section. That is the correct home for the new guard leg; the `run-all-339.sh` / `EMDASH_TARGETS` fallback named in the task brief is NOT needed.
- `data/` ships: `package.json` `files` includes `"data"`, so the sidecar travels with the npm distribution and with the plugin install cache.
- `claude plugin validate .` does NOT surface the unknown-keys line (it validates `.claude-plugin/plugin.json`, not the hook manifest's key set). Its baseline today is `Validation passed with warnings` with exactly one warning: `root: CLAUDE.md at the plugin root is not loaded as project context`. That warning is pre-existing and out of scope. Treat validate as a no-regression check (still exactly one warning, still passes); the definitive proof of the fix is the `Object.keys()` assertion.
- Quick-task test naming precedent: `tests/test-quick-260910-h32-no-brain-write-from-scripts.cjs`, registered in a phase `run-all-*.sh`.
</facts_established_during_planning>

<tasks>

<task type="auto">
  <name>Task 1: Move both markers to data/hooks-markers.json and repoint the two readers</name>
  <files>data/hooks-markers.json, hooks/hooks.json, lib/mcp/hook-adapter-audit.cjs, tests/test-198-adapter-budget.test.cjs</files>
  <action>
Four edits, in this order.

1. Create `data/hooks-markers.json`. Generate it, do not retype it: read `hooks/hooks.json` with node, pick off `_mcpFirst198Migrated` and `_firstInstallRouterOrdering`, and write `JSON.stringify({_mcpFirst198Migrated, _firstInstallRouterOrdering}, null, 2) + '\n'`. Preserve key order (`_mcpFirst198Migrated` first). Both `_note` strings and every `surfaces[]` entry stay byte-identical through this step.

Then apply the one permitted text change, once per `_note`, in each of the two notes: the phrase that reads `which only reads the 'hooks' key below` must stop saying "below", because the markers no longer sit above that key. Replace it with `which only reads the 'hooks' key in hooks/hooks.json`. Nothing else in either note changes: the phase attributions, the D-05/D-06 ordering rationale, the `check-card-fire.cjs` carve-out, and the load-bearing UserPromptSubmit ordering warning all stay word-for-word.

2. Rewrite `hooks/hooks.json` as the proven slice: read the raw text, find the index of the literal `\n  "hooks": {`, and write `'{' + raw.slice(index)`. Do not reserialize through `JSON.stringify`. Do not touch any matcher string, any `command`, any `timeout`, any `statusMessage`, or the hooks block's indentation. After the write, the file is 12 lines shorter at the top and byte-identical from `  "hooks": {` onward.

3. `lib/mcp/hook-adapter-audit.cjs`:
   - Replace the `HOOKS_JSON_PATH` constant (:29) with `const HOOKS_MARKERS_PATH = path.join(REPO_ROOT, 'data', 'hooks-markers.json');`. `HOOKS_JSON_PATH` has exactly one consumer, so remove the old constant rather than leaving a dead binding.
   - In `migratedSurfaces()` (:71-90), read `HOOKS_MARKERS_PATH` instead. Everything else about the function is unchanged: same `try`/`catch (_e) { return []; }` never-throws contract, same `Array.isArray(marker.surfaces)` guard, same `.map`/`.filter` on `s.script`.
   - Update the header comment (:3-4 and the "Scope" paragraph at :17) and the jsdoc at :71 so they name `data/hooks-markers.json` as the enumeration source and say, in one clause, why it moved: the Claude Code hook loader warns on unknown top-level keys in `hooks/hooks.json`. The `LINE_BUDGETS` numbers and the `FORBIDDEN_IMPORT_PATTERN` are untouched.

4. `tests/test-198-adapter-budget.test.cjs`:
   - The test at :252 currently reads both the marker and the Stop matcher out of `hooks/hooks.json`. Split the sources: read `surfaces` from `data/hooks-markers.json` (keep asserting it names `scripts/on-stop`), and keep reading `hooks/hooks.json` for the `parsed.hooks.Stop` assertion that the Stop matcher still dispatches `run-hook.cmd" on-stop`. Both assertions and both failure messages stay semantically what they are today; update the test title so it names the two files it now reads.
   - Update the header comment at :4 so the enumeration source reads `data/hooks-markers.json`.

No em-dashes in any prose added by this task; hyphens only.
  </action>
  <verify>
    <automated>node -e "const k=Object.keys(require('./hooks/hooks.json')); if(JSON.stringify(k)!==JSON.stringify(['hooks'])) throw new Error('top-level keys: '+JSON.stringify(k)); const m=require('./data/hooks-markers.json'); if(!m._mcpFirst198Migrated.surfaces.some(s=>s.script==='scripts/on-stop')) throw new Error('sidecar lost scripts/on-stop'); if(!m._firstInstallRouterOrdering._note) throw new Error('sidecar lost the router-ordering note'); const a=require('./lib/mcp/hook-adapter-audit.cjs'); const s=a.migratedSurfaces(); if(s.length!==3) throw new Error('migratedSurfaces() returned '+s.length+', expected 3: '+JSON.stringify(s)); console.log('ok', JSON.stringify(s));"</automated>
    <automated>node tests/test-198-adapter-budget.test.cjs</automated>
    <automated>node tests/test-brain-response-sanitize.cjs</automated>
    <automated>git diff -- hooks/hooks.json | grep -c '^[-+]' | xargs -I{} sh -c 'test {} -le 26 || { echo "hooks.json diff touched more than the 12 removed marker lines: {} changed lines"; exit 1; }'</automated>
    <automated>git show HEAD:hooks/hooks.json | node -e "let a='';process.stdin.on('data',d=>a+=d).on('end',()=>{const fs=require('fs');const b=fs.readFileSync('hooks/hooks.json','utf8');const i=a.indexOf('\n  \"hooks\": {');if(a.slice(i+1)!==b.slice(1))throw new Error('hooks block is NOT byte-identical to HEAD');console.log('hooks block byte-identical to HEAD');});"</automated>
  </verify>
  <done>`hooks/hooks.json` has exactly one top-level key; the hooks block is byte-identical to HEAD; `data/hooks-markers.json` carries both markers with only the "hooks key below" phrase adjusted; `migratedSurfaces()` returns all three migrated scripts from the sidecar; `tests/test-198-adapter-budget.test.cjs` and `tests/test-brain-response-sanitize.cjs` are both green.</done>
</task>

<task type="auto">
  <name>Task 2: Commit the guard test, register it in run-all-198.sh, and log the fix</name>
  <files>tests/test-quick-260911-juq-hooks-json-top-level.cjs, tests/run-all-198.sh, CHANGELOG.md</files>
  <action>
1. Create `tests/test-quick-260911-juq-hooks-json-top-level.cjs`: `#!/usr/bin/env node`, `'use strict'`, `node:test` + `node:assert/strict`, no network, no room writes, no tmpdir. Header comment states the defect in one paragraph, quoting the exact Claude Code 2.1.268 line `hooks.json: unknown keys "_mcpFirst198Migrated", "_firstInstallRouterOrdering" ignored` and naming quick task 260911-juq.

Four arms:
   - Arm 1 (the fix holds): `Object.keys(JSON.parse(readFileSync('hooks/hooks.json')))` deep-equals `['hooks']`. The failure message must enumerate the offending keys, so a future regression names itself.
   - Arm 2 (nothing was lost): `data/hooks-markers.json` parses; `_mcpFirst198Migrated.surfaces` names all three of `scripts/statusline-mos-dispatch`, `scripts/sessionstart-coordinator.cjs`, `scripts/on-stop`; `_firstInstallRouterOrdering._note` is a non-empty string that still mentions `first-install-router.cjs` and `mva-detect.cjs` (the load-bearing ordering fact the note exists to carry).
   - Arm 3 (sidecar liveness, the important one): `require('../lib/mcp/hook-adapter-audit.cjs').migratedSurfaces()` returns 3 scripts. `migratedSurfaces()` swallows every error and returns `[]` by contract, so a wrong path would silently make the whole D-06 adapter budget vacuous instead of failing. This arm is what makes that impossible.
   - Arm 4 (guard is not vacuous, mutation leg): run Arm 1's key assertion against an in-memory fixture object that carries an extra `_someFutureMarker` top-level key, and assert it throws. Proves the matcher actually discriminates rather than passing on anything.

Resolve paths from `__dirname` up to the repo root, the same way the neighbouring tests do. No em-dashes.

2. `tests/run-all-198.sh`: add one `run_if` leg in the SPEC-5 section, immediately after the existing `SPEC-5 hooks/ adapter-only budget` leg, gated on `tests/test-quick-260911-juq-hooks-json-top-level.cjs`, running `node tests/test-quick-260911-juq-hooks-json-top-level.cjs`. Label it so the reason is legible from the runner output, for example `SPEC-5 hooks.json top level is hooks-only (loader unknown-keys warning, quick 260911-juq)`. Match the existing legs' comment style: a short block comment above the leg explaining what defect it guards. Do not touch the PASS/FAIL/SKIP accounting or the two hard floors.

3. `CHANGELOG.md`: add a `### Fixed` block under the existing `## [Unreleased] -- v2.0.0-beta.36 (in progress)` heading (leave the existing `### Added` block for 260911-iko in place). Name the Claude Code version (2.1.268), quote the exact warning line, say that the two keys were our own build metadata and never hook configuration, name `data/hooks-markers.json` as their new home, and state plainly that no matcher, command, or timeout inside the hooks block changed. One short paragraph plus a line for the new guard test. No em-dashes.
  </action>
  <verify>
    <automated>node tests/test-quick-260911-juq-hooks-json-top-level.cjs</automated>
    <automated>bash tests/run-all-198.sh</automated>
    <automated>grep -n 'test-quick-260911-juq-hooks-json-top-level' tests/run-all-198.sh | grep -q run_if -A0 || grep -c 'test-quick-260911-juq-hooks-json-top-level' tests/run-all-198.sh | xargs -I{} sh -c 'test {} -ge 2'</automated>
    <automated>grep -rn '\xe2\x80\x94' tests/test-quick-260911-juq-hooks-json-top-level.cjs data/hooks-markers.json CHANGELOG.md tests/run-all-198.sh lib/mcp/hook-adapter-audit.cjs && { echo "em-dash found"; exit 1; } || echo "no em-dashes"</automated>
    <automated>node scripts/doctor.cjs --acceptance</automated>
    <automated>claude plugin validate . 2>&1 | tee /tmp/claude-1000/-home-jsagi/383b3887-faba-443b-be72-b84ea781d872/scratchpad/juq-validate.txt | grep -q 'Found 1 warning' && grep -q 'Validation passed with warnings' /tmp/claude-1000/-home-jsagi/383b3887-faba-443b-be72-b84ea781d872/scratchpad/juq-validate.txt && echo 'validate: unchanged baseline (1 pre-existing CLAUDE.md warning, no new warnings)'</automated>
  </verify>
  <done>The guard test passes on its own and runs as a leg of `bash tests/run-all-198.sh` with zero FAIL; `node scripts/doctor.cjs --acceptance` is still 20/20 on a clean tree; `claude plugin validate .` still reports exactly its one pre-existing CLAUDE.md warning; the `[Unreleased]` CHANGELOG entry names the 2.1.268 warning text and the fix.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Claude Code plugin loader -> hooks/hooks.json | The loader parses this manifest on every session start on every install; anything unrecognized here is user-visible output we do not control |
| test/audit module -> data/hooks-markers.json | A non-throwing reader consumes this file; a read failure degrades to an empty list rather than an error |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-juq-01 | Tampering | hooks/hooks.json top level | mitigate | Arm 1 of `tests/test-quick-260911-juq-hooks-json-top-level.cjs` asserts `Object.keys() === ['hooks']` and enumerates any offender; registered in `tests/run-all-198.sh` so it runs in the phase gate |
| T-juq-02 | Tampering | hooks block matcher strings | mitigate | Whole-file slice transform (no reserialize) plus a `git show HEAD:hooks/hooks.json` byte-comparison of the hooks block in Task 1 verify; `tests/test-brain-response-sanitize.cjs` independently re-checks the Part 8 matcher byte-parity |
| T-juq-03 | Repudiation | migratedSurfaces() never-throws contract | mitigate | Arm 3 asserts the reader returns 3 scripts, so a wrong sidecar path cannot silently return `[]` and make the D-06 adapter budget vacuously green |
| T-juq-04 | Information disclosure | data/hooks-markers.json | accept | The moved notes carry phase attributions and hook script names only: no user data, no secrets, no Brain content. Canon Part 8 is untouched, nothing crosses LOCAL -> BRAIN in this change |
| T-juq-05 | Denial of service | plugin install cache resolution | accept | `data/` is already in `package.json` `files`, so the sidecar ships; and the reader is test-time only, never on a hook hot path, so a missing sidecar cannot break a user session |
| T-juq-SC | Tampering | npm/pip/cargo installs | n/a | This task installs no packages; no legitimacy gate required |
</threat_model>

<verification>
```bash
node -e "console.log(JSON.stringify(Object.keys(require('./hooks/hooks.json'))))"   # ["hooks"]
node tests/test-198-adapter-budget.test.cjs
node tests/test-brain-response-sanitize.cjs
node tests/test-quick-260911-juq-hooks-json-top-level.cjs
bash tests/run-all-198.sh
node scripts/doctor.cjs --acceptance
claude plugin validate .
```

Manual, once, after the change is committed: start a fresh Claude Code session in this repo and confirm the `hooks.json: unknown keys ... ignored` line is gone. `claude plugin validate .` does not emit that line, so it cannot substitute for this observation.
</verification>

<success_criteria>
- `Object.keys(require('./hooks/hooks.json'))` is exactly `['hooks']`.
- The hooks block is byte-identical to HEAD fe45ad98 from `  "hooks": {` onward: no matcher, command, timeout, or statusMessage changed.
- `data/hooks-markers.json` carries both marker objects with every note preserved except the one "hooks key below" phrase.
- `lib/mcp/hook-adapter-audit.cjs` reads the sidecar through `HOOKS_MARKERS_PATH`, keeps its never-throws contract, and its header comment names the new source and the reason.
- `tests/test-198-adapter-budget.test.cjs` reads surfaces from the sidecar and the Stop matcher from `hooks.json`, and is green.
- `tests/test-quick-260911-juq-hooks-json-top-level.cjs` exists, is green, is registered in `tests/run-all-198.sh`, and its Arm 4 proves the guard discriminates.
- `bash tests/run-all-198.sh` reports zero FAIL; `node scripts/doctor.cjs --acceptance` is 20/20; `claude plugin validate .` shows no new warning.
- `CHANGELOG.md` `[Unreleased]` names Claude Code 2.1.268 and the exact warning text.
- No em-dashes anywhere in the change.
- Commit message ends with the executing model's own `Co-Authored-By:` trailer followed by `Claude-Session: https://claude.ai/code/session_01HBgMttGjUp3zcYdCJkn3Zv`.
</success_criteria>

<output>
Create `.planning/quick/260911-juq-silence-the-claude-code-hooks-json-unkno/260911-juq-SUMMARY.md` when done.
</output>
