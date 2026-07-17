# Phase 230: MindrianOS Skill Fleet Optimization - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 7 new files (6 scripts + 1 schema module)
**Analogs found:** 7 / 7 (6 exact/strong, 1 partial + no-analog note for the WS2 reviewer surface)

> Source of file list: `230-AI-SPEC.md` Section 3 "Recommended Project Structure" (authoritative) + `230-CONTEXT.md` decisions. No RESEARCH.md this run (research folded into the AI-SPEC). The in-repo precedent named by both docs is the Phase 229 HUJI pilot: `scripts/huji-run-one.cjs`, `scripts/huji-batch.cjs`, `lib/core/pitch-feedback-schemas.cjs`. All three read and confirmed as near-perfect analogs (same spawn/schema/stream-json/pool patterns this phase needs).

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `lib/core/skillopt-schemas.cjs` | model (schema/contract) | transform | `lib/core/pitch-feedback-schemas.cjs` | **exact** |
| `scripts/skillopt-inventory.cjs` | service (parse/classify) | batch / file-I/O | `scripts/frontmatter-schema-validator.cjs` (gray-matter parse) + `huji-batch.listSubmissions` (enumerate) | role-match |
| `scripts/skillopt-genqueries.cjs` | service (subagent worker) | request-response | `scripts/huji-run-one.cjs` (buildStageAArgs -> spawnSync -> parseEnvelope) | strong |
| `scripts/skillopt-funnel.cjs` | service (subagent worker) | request-response / batch | `scripts/huji-run-one.cjs` (judgeOneQuery two-stage) + `huji-batch.runPool` | **exact** |
| `scripts/skillopt-triggerloop.cjs` | service (subagent worker) | streaming / event-driven | `scripts/huji-batch.cjs` `preflightPluginLoad` (stream-json JSONL scan) | **exact** (only stream-json analog in repo) |
| `scripts/skillopt-codereview.cjs` | service (subagent worker) | request-response / batch | `scripts/huji-eval.cjs` judge+calibration leg; `huji-run-one.buildStageBArgs` | partial (see No-Analog note) |
| `scripts/skillopt-merge.cjs` | service (aggregator + gate) | batch / transform | `scripts/huji-batch.cjs` (ledger, `writeAtomic`, `runAggregation`, halt gate) | strong |
| `scripts/skillopt-eval.cjs` (eval harness, AI-SPEC S5) | test | batch | `scripts/huji-eval.cjs` (deterministic `--check`/`--suite` code layer) | **exact** |

---

## Shared Patterns (apply to ALL WS1/WS2 subagent-spawning scripts)

### Spawn arg construction (no shell, path-not-inline)
**Source:** `scripts/huji-run-one.cjs:255-269` (`buildStageAArgs`), `:289-304` (`buildStageBArgs`)
Every subagent spawns via a discrete arg array to `spawnSync('claude', args)` - never a shell string, never student/skill content interpolated into the command line. Large inputs (skill body, `.cjs` file) are passed as a FILE PATH the session `Read`s.
```javascript
return [
  '-p', prompt,
  '--plugin-dir', config.pluginDir,      // keychain/OAuth auth, NEVER --bare (Pitfall 4)
  '--model', config.model,               // pinned FULL id, never a bare alias
  '--permission-mode', 'dontAsk',
  '--allowedTools', 'Read',              // locked per-unit allowlist
  '--output-format', 'json',
  '--json-schema', inlineSchemaJson(schemaPath), // INLINE, never a path (Pitfall 2)
  '--max-budget-usd', String(config.budgetPerUnitUsd), // per-unit fuse
  '--no-session-persistence',            // hermetic; never --continue/--resume (Pitfall 5)
];
```
The spawn call with fuses (`scripts/huji-run-one.cjs:485-487`):
```javascript
const aRes = spawnSync('claude', stageAArgs, {
  env: process.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: config.stageATimeoutMs,
});
if (aRes.error) return { ok: false, reason: 'stageA_spawn_failed', detail: ... };
if (aRes.status !== 0) return { ok: false, reason: 'stageA_nonzero', detail: ... };
```

### Envelope unwrapping (structured_output first, then result, then first {...})
**Source:** `scripts/huji-run-one.cjs:311-337` (`parseEnvelope`)
Copy this function near-verbatim for `skillopt-funnel.cjs` and `skillopt-codereview.cjs`. Prefers `structured_output` (populated when `--json-schema` is passed), falls back to JSON-parsing `result`, then to the first `{...}` in the text. Also reads `env.total_cost_usd` for the cost line.
```javascript
let env = null; try { env = JSON.parse(String(stdout)); } catch (_e) { env = null; }
if (env && env.structured_output && typeof env.structured_output === 'object') return env.structured_output;
if (typeof env.result === 'string') { try { return JSON.parse(env.result); } catch { /* match /\{[\s\S]*\}/ */ } }
```

### zod v4 -> JSON Schema inlining (the single chokepoint)
**Source:** `lib/core/pitch-feedback-schemas.cjs:140-186` (`toJsonSchemas` + `inlineSchemaJson`)
The `$schema` meta-ref MUST be stripped (CLI 2.1.211 rejects `draft/2020-12`); draft-07 keywords only.
```javascript
const { z } = require('zod/v4');                 // NOT bare 'zod' - v4 subpath gives z.toJSONSchema
const obj = z.toJSONSchema(JudgeVerdictSchema);
delete obj.$schema;                              // DI-2: CLI cannot resolve draft/2020-12 meta-ref
return JSON.stringify(obj);                       // INLINE string, never a file path (DI-1)
```
Double-validation (belt + suspenders): CLI self-corrects, orchestrator re-checks with the same zod source (`scripts/huji-run-one.cjs:391-398`):
```javascript
const evOk = EvidenceSchema.safeParse(evidence);
if (!evOk.success) failures.push({ gate: 'G2', detail: evOk.error.issues.map((i)=>i.path.join('.')).join(',') });
```

### No-silent-skip (Critical Failure Mode 3 / D5)
**Source pattern:** `scripts/huji-run-one.cjs:488-496` (spawn error/nonzero/unparseable -> explicit `{ ok:false, reason }`), `scripts/huji-batch.cjs:465-478` (`onSettle` records `failed` status, appends to `failures.md`, never absorbs).
A `safeParse` failure or spawn/timeout error is recorded as `not_evaluated` with its reason after one retry - NEVER counted as a pass or no-finding. This directly answers the two logged silent-skip incidents in repo memory.

### Bounded concurrency pool (guardrailed 3-4)
**Source:** `scripts/huji-batch.cjs:200-229` (`runPool`) + `:459-463` (`getLimit`)
Copy `runPool` verbatim for the fleet fan-out. `getLimit` re-read each iteration so a halt or drop-to-serial takes effect at once. Never an unbounded `Promise.all` (429 storm).
```javascript
async function runPool({ items, getLimit, worker, onSettle }) {
  let idx = 0; const running = []; const results = [];
  const limitNow = () => Math.max(0, getLimit());
  while (idx < items.length || running.length > 0) {
    while (idx < items.length && running.length < limitNow()) { /* launch worker, push entry */ }
    if (running.length === 0) break;
    await Promise.race(running.map((e) => e.promise));
    /* reap settled, call onSettle */
  }
  return results;
}
```

### Atomic ledger + resume (`.done` sentinel)
**Source:** `scripts/huji-batch.cjs:60-64` (`writeAtomic`), `:83-86` (`isDone`), `:81` resume predicate.
State is JSON artifacts on disk (write-temp-then-rename); a unit is done if the ledger says done OR a `.done` marker exists. Makes the run resumable with no checkpoint library.

### Write-path containment (Critical Failure Mode 4 / D6)
**Source:** `scripts/huji-batch.cjs:147-154` (`assertOutsideRepo`)
Adapt this to assert every pipeline write resolves under `.planning/.../out/` only - nothing pipeline-generated may land under `skills/` or `scripts/`. Fail closed.
```javascript
const resolved = path.resolve(targetDir);
if (resolved === REPO_ROOT || resolved.startsWith(REPO_ROOT + path.sep)) return { ok:false, reason:'inside_repo' };
```

### Pinned-model preflight (fairness / no bare alias)
**Source:** `scripts/huji-batch.cjs:135-141` (`assertPinnedModelId`)
Reject bare aliases (`opus`/`sonnet`/`haiku`) before spending; require `^claude-[a-z]+-[0-9]`.

---

## Pattern Assignments

### `lib/core/skillopt-schemas.cjs` (model, transform)
**Analog:** `lib/core/pitch-feedback-schemas.cjs` (exact - same module shape, same zod/v4 discipline, same `inlineSchemaJson`/`toJsonSchemas` exports).

- **Imports** (`lib/core/pitch-feedback-schemas.cjs:36-40`): `'use strict'; const { z } = require('zod/v4');` plus `fs`/`path`.
- **Bounds-as-contract** (`:44-49`): every free-text field gets a `.max()` constant (token budget IS a contract). Reuse `JudgeVerdictSchema` (`reasoning: z.string().max(600)`), `CodeFindingSchema` (`claim`/`evidence_quote`/`refutation_attempt` all `.max(800)`), and a new `TriggerResultSchema` per AI-SPEC 4b:307-333.
- **Enum-forced verdicts** (`:78`, `:128`): `confidence: z.enum(['high','medium','low'])` (low/medium => flag, never silent pass); `verdict: z.enum(['confirmed','plausible','refuted'])` (refuted dropped, never downgraded silently).
- **Dual-consumption export** (`:140-186`): keep BOTH `toJsonSchemas(outDir)` (emit files, strip `$schema`) and `inlineSchemaJson(schemaPath)` (the single inlining chokepoint for all spawn call sites).
- **Self-test at bottom** (`:208-296`): mirror the `require.main === module` deterministic assert block (valid + reject fixtures per schema, then regenerate JSON Schema files). This is what the CI `tests/run-all-230.sh` code layer runs.

### `scripts/skillopt-inventory.cjs` (service, batch/file-I/O)
**Analog:** `scripts/frontmatter-schema-validator.cjs` (gray-matter parse) + `scripts/huji-batch.cjs:89-104` (`listSubmissions` enumeration).
- **Frontmatter parse:** `matter(fileText)` -> `{ data, content }`; pull `name`/`description` from `data`, grep `content` for `scripts/*.cjs` / `bin/*.cjs` / `Workflow(` to mark the WS2-backed subset (AI-SPEC 3 Key Abstractions:227).
- **Enumeration:** copy the `readdirSync(..., { withFileTypes:true }).filter(d=>d.isDirectory())` walk from `huji-batch.cjs:89-104`, pointed at `skills/`.
- **Family grouping:** namespace-prefix split (`mos:find-*`, `mos:explore-*`) is net-new logic; no in-repo analog for the grouping itself.
- Model: haiku tier (AI-SPEC 4 model table).

### `scripts/skillopt-genqueries.cjs` (service, request-response)
**Analog:** `scripts/huji-run-one.cjs` `buildStageAPrompt` (`:219-243`) + `buildStageAArgs` (`:255-269`).
- Frozen instruction in `--append-system-prompt-file` (prompt-cache bite + provenance), per-family variable (all sibling stubs) in `-p`. See AI-SPEC 4b "System vs. user separation".
- One sonnet subagent per family sees every sibling at once so negatives are real near-misses. Output is a `eval_queries.json` per skill with the train/validation split.
- Same spawn/unwrap/safeParse spine as the shared patterns above.

### `scripts/skillopt-funnel.cjs` (service, request-response/batch)
**Analog:** `scripts/huji-run-one.cjs` overall two-stage runner + AI-SPEC 3 `judgeOneQuery` reference (`:190-217`, itself a distillation of this file).
- One isolated headless subagent judges ONE eval query against the full 124-skill roster (name+description stubs only - never bodies; AI-SPEC 4 Context Window Strategy).
- Uses `runPool` (from `huji-batch.cjs`) for the ~800-1,000 call fan-out, `getLimit` capped 3-4.
- `--allowedTools Read`, `--max-turns 2`, `--max-budget-usd 0.05` per query.
- Flag on `predicted != expected` OR `confidence in {low, medium}`. Record `not_evaluated` on any failure (shared no-silent-skip pattern).

### `scripts/skillopt-triggerloop.cjs` (service, streaming/event-driven)
**Analog:** `scripts/huji-batch.cjs:162-192` (`preflightPluginLoad`) - the ONLY stream-json JSONL-parsing precedent in the repo, and the exact mechanism WS1 step 5 needs.
- **This is the single most load-bearing pattern in the phase** (AI-SPEC Pitfall 1): `--output-format json` has NO reliable `.messages[]` tool trace. To observe a REAL Skill fire you MUST use `--output-format stream-json --verbose` and scan the JSONL line by line.
```javascript
for (const ln of String(res.stdout || '').split('\n').filter(Boolean)) {
  let ev = null; try { ev = JSON.parse(ln); } catch (_e) { continue; }
  if ((ev.type === 'system' && ev.subtype === 'init') || ev.plugins !== undefined) { /* preflight assert */ }
  // WS1.5 extension: scan assistant events for message.content[] block
  //   { type:'tool_use', name:'Skill', input:{...} } matching the expected skill
}
```
- Preflight the plugin load first (assert `system/init.plugins` contains `mos`, `plugin_errors` empty) - abort closed otherwise (`:188-191`).
- Verify the `input` field name against a LIVE stream-json capture before hard-coding (AI-SPEC 4 note: agentskills.io says `input.skill` but this plugin may surface the namespaced command).
- Flagged skills only (~10-20). Train/validation split, up to 5 revision iterations, best-BY-VALIDATION selection, `regressed_query_count == 0` hard gate (D3/CFM1).

### `scripts/skillopt-codereview.cjs` (service, request-response/batch)
**Analog:** `scripts/huji-eval.cjs` judge+calibration leg (pinned-different-model, fail-closed, skip-without-key) + `huji-run-one.buildStageBArgs` for the spawn shape. See No-Analog note - there is no discrete `code-review` skill file to copy.
- Opus tier, two passes per skill: review then adversarial-verify (Refute-or-Promote).
- `CodeFindingSchema.evidence_quote` MUST be a verbatim substring of the real `.cjs` (anti-fabrication anchor, D4). The substring check is deterministic code, not a model call - put it in `skillopt-eval.cjs`.
- `--allowedTools Read, Glob, Bash(node scripts/*)`, no Write/Edit (review never rewrites). Chunk by file/export so no subagent holds the whole tree.
- Drop `refuted` findings; report only CONFIRMED/PLAUSIBLE survivors.

### `scripts/skillopt-merge.cjs` (service, aggregator + terminal gate)
**Analog:** `scripts/huji-batch.cjs` aggregation + halt/ledger machinery (`runAggregation:381-386`, `writeAtomic:60`, `haltBatch:272-278`).
- Merge WS1 verdicts + WS2 findings into ONE report under `.planning/.../out/`.
- The terminal human-approval gate (CFM4): STOP before any real `SKILL.md`/`.cjs` write; require explicit itemized sign-off. Model this as the batch `haltBatch` STOP-and-page shape but human-gated.
- Reconciliation assertion: `spawned == passed + flagged + not_evaluated` must hold (D5).

### `scripts/skillopt-eval.cjs` (test, batch) - the deterministic eval harness
**Analog:** `scripts/huji-eval.cjs` (exact - the switch-case `--check`/`--suite`/`--selftest` argv router, no Commander/yargs; the gsd-tools.cjs pattern).
- Code layer (zero API spend, runs on every push via `tests/run-all-230.sh`): zod round-trip on every schema; not-evaluated reconciliation (D5); do-no-harm `regressed_query_count == 0` gate (D3); write-path assertion (D6); `evidence_quote`-is-real-substring check (D4); smoke-set replay agreement (D7).
- Judge layer + calibration gate: mirror `huji-eval`'s pinned-different-model, fail-closed-under-tolerance, skip-cleanly-without-live-flag design (`huji-eval.cjs` header lines 5-14).

---

## No Analog Found

| Surface | Role | Data Flow | Reason / Guidance |
|---------|------|-----------|-------------------|
| WS2 reviewer prompt/skill | service | request-response | CONTEXT + AI-SPEC say "reuse the repo's existing `code-review` skill pattern," but **no discrete `code-review` SKILL.md or agent exists** in `skills/`, `commands/`, or `agents/`. The closest real precedent is the `huji-eval.cjs` judge leg (adversarial, pinned-different-model, calibrated). Planner should build the reviewer as a spawned-subagent rubric (opus, Refute-or-Promote) modeled on that judge leg, NOT assume a copy-able skill file. Flag this discrepancy to the navigator. |
| Per-family namespace grouping logic | utility | transform | The family-split heuristic (`mos:find-*` vs `mos:explore-*`) is net-new; no in-repo grouping analog. Small, self-contained. |

---

## Metadata

**Analog search scope:** `scripts/`, `lib/core/`, `lib/`, `skills/`, `commands/`, `agents/`
**Files scanned:** 3 named analogs read in full (`huji-run-one.cjs` 671 lines, `huji-batch.cjs` 821 lines, `pitch-feedback-schemas.cjs` 296 lines); `huji-eval.cjs` + `frontmatter-schema-validator.cjs` headers read; 124 SKILL.md counted; grep sweep for code-review/adversarial surfaces.
**Pattern extraction date:** 2026-07-17
</content>
</invoke>
