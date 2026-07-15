# Phase 229: HUJI Pitch Feedback Module - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 8 net-new + 3 modified (extract from CONTEXT.md / RESEARCH.md file list)
**Analogs found:** 8 / 8 (every net-new surface has a shipped in-repo analog; nothing is from-scratch)

> Framing note: RESEARCH.md already grepped every REUSE call site (writeClaimNode, openRoomDb, runChain, composeWorkflow, part8-egress-guard.classify, model-profiles.resolveModel). Those are DIRECT-CALL reuse surfaces, not "copy the pattern" analogs, and the planner should call them as-is. This map covers the genuinely NEW files that must be authored, and names the closest shipped file each one should copy its shape from.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/huji-batch.cjs` (NEW) | orchestrator/script | batch (N=200 loop, spawn, checkpoint, resume) | `lib/core/room-auto-create.cjs` (args-array `execFileSync`, cleanup-on-fail) + AVOID `scripts/label-topic-forest.cjs` | role-match (no batch orchestrator exists) |
| `scripts/huji-eval.cjs` (NEW) | script/test-harness | transform + judge-spawn | `scripts/label-topic-forest.cjs` CLI-router shape + `lib/core/part8-egress-guard.cjs` (reuse `classify`) | role-match |
| `tests/run-all-229.sh` (NEW) | test aggregator | batch (run/run_if legs) | `tests/run-all-226.sh` | exact |
| `recipe-maps.cjs` `PWS_grading` entry (MODIFY) | config/registration | lookup map | `SENS10_CAUSE_RECIPES` block in same file (`recipe-maps.cjs:282`) | exact |
| `.../schemas/evidence.schema.json` (NEW) | schema (generated) | transform (zod->JSONSchema) | `require('zod/v4').z.toJSONSchema` (verified CJS) | n/a (generated artifact) |
| `.../schemas/feedback-result.schema.json` (NEW) | schema (generated) | transform | same | n/a |
| Stage A intake prompt (NEW, headless) | adapter/prompt | streaming (transcript->claims) | `skills/file-meeting/SKILL.md:286` Claimify 4-pass (port machinery, call `navigation.writeClaimNode` directly) | role-match |
| `rubric-huji.md` / build-thesis scored override (NEW) | prompt/config | request-response | `commands/build-thesis.md` body (neutralize the prompt-level 6/10 gate) | partial |

**No new server, no new dependency.** Per CLAUDE.md (CJS only, no TypeScript, bash scripts authoritative) and RESEARCH.md Package Legitimacy Audit: zero `npm install`.

---

## Pattern Assignments

### `scripts/huji-batch.cjs` (orchestrator, batch)

**Primary analog (COPY the spawn discipline):** `lib/core/room-auto-create.cjs:240` - the in-repo precedent for spawning a subprocess with an **args array, no shell, timeout, cleanup-on-failure**. This is the shape `huji-batch.cjs` must follow for its per-submission `claude -p` spawn (swap `execFileSync('bash', [...])` for `spawnSync('claude', [argsArray], {...})`).

```javascript
// Source: lib/core/room-auto-create.cjs:238-254 (args array, no shell, cleanup-on-fail)
const { execFileSync } = require('node:child_process');
try {
  execFileSync('bash', [registryScript, absRoomsHome, 'create', slug, ...], {
    cwd: REPO_ROOT,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: absRoomsHome }),
    stdio: 'pipe',
    timeout: 5000,
  });
} catch (err) {
  // Cleanup: rm the partial room dir; never leave a half-registered room.
  try { fs.rmSync(roomPath, { recursive: true, force: true }); } catch (_ignore) {}
  return { ok: false, reason: 'registry_create_failed:' + ... };
}
```

Apply to `huji-batch.cjs`: `spawnSync('claude', ['-p', '--plugin-dir', pluginDir, '--model', PINNED_FULL_ID, '--output-format', 'json', '--json-schema', schemaPath, '--permission-mode', 'dontAsk', '--allowedTools', tools, '--max-turns', '40', '--max-budget-usd', '3.00', '--no-session-persistence', promptOrFile], { timeout, stdio: 'pipe' })`. Long transcript content goes via a **file path in argv or stdin (<=10MB)**, never inlined into the prompt string.

**Anti-pattern to AVOID (RESEARCH.md flags this explicitly):** `scripts/label-topic-forest.cjs:77-90` - shell-quoted `execSync`:

```javascript
// ANTI-PATTERN - DO NOT COPY (scripts/label-topic-forest.cjs:78-89)
function callClaude(prompt) {
  try {
    const escaped = prompt.replace(/'/g, "'\\''");         // breaks on transcript apostrophes
    const result = execSync(`claude -p '${escaped}'`, {    // blocks the event loop -> serial 200x
      encoding: 'utf-8', timeout: 30000, stdio: ['pipe','pipe','pipe'],
    });
    return result.trim();
  } catch (e) { return null; }                             // injection-prone
}
```
Three defects (RESEARCH Pitfall 4): (1) `execSync` blocks -> serializes 200 runs into ~30h; (2) `replace(/'/.../)` breaks on apostrophes in student transcripts; (3) shell-quote injection surface. `huji-batch.cjs` uses `spawnSync`/`spawn` with an args array and file-path input instead.

**Checkpoint/resume pattern (build net-new, no in-repo batch analog):** filesystem ledger `batch-state.json` (atomic write-temp-rename), `out/<id>/.done` idempotency marker written ONLY after zod `safeParse` passes AND `feedback.md` non-empty. Skip any `<id>` with a `.done`. Retry 2x with a fresh scratch room per attempt, then `failures.md`. Workspace lives OUTSIDE the repo (`~/MindrianRooms/huji-pilot-batch/`) - do not commit (RESEARCH Runtime State Inventory).

**Hard constraints (RESEARCH Anti-Patterns):**
- Do NOT `require('chain-executor.cjs')` in the orchestrator - the chain runs INSIDE the spawned session; importing it collapses the isolation boundary and the per-unit cost line.
- Never `--continue`/`--resume` across submissions (leaks student A into student B).
- Never run `scripts/compute-state` on a scratch room (overwrites the required `Stage: Validation` marker).

**Reuse (direct call, do not reimplement):**
- Scaffold: `navigation.birthRoom(opts)` -> `scaffoldRoomSkeleton(roomDir, opts)` (`room-birth.cjs:645`, `room-skeleton-scaffold.cjs:262`), then write STATE.md directly with the literal line `Stage: Validation` (Pitfall 2; `model-profiles.parseVentureStage` at `model-profiles.cjs:100` regex-matches it; `Validation` -> grading=`opus`, `Pre-Opportunity` -> `null` = hard stop).
- Per-room `.config.json` with `model_overrides` -> pinned full model ID (cascade step 1 override in `resolveModel`).

---

### `scripts/huji-eval.cjs` (script/test-harness, transform + judge-spawn)

**CLI-router analog:** `scripts/label-topic-forest.cjs` argv shape (`--room`, `--force`, `--dry-run`, `--help`) - copy the switch-case argv parsing per CLAUDE.md convention ("CLI entry points parse `process.argv` with a switch-case router; no Commander or yargs"). Sub-commands the harness needs: `--check {quote-verifier|inventory-recall|drift|schema|similarity|cost-ledger}`, `--suite {code|anchors|demo}`, `--judge`.

**Part 8 hygiene leg (REUSE, never hand-roll) - D4/G3:**
```javascript
// Source: lib/core/part8-egress-guard.cjs:231,97 (VERIFIED exports)
const { classify, scanForContent } = require('../lib/core/part8-egress-guard.cjs');
const verdict = classify(brainQueryPayload, { toolName: 'brain_ask' });
// verdict hit OR any evidence.json entity string found in payload -> HALT ENTIRE BATCH (G3, zero tolerance)
```

**Judge spawner:** same `spawnSync` args-array discipline as `huji-batch.cjs` (sonnet judging opus, `--bare`, `--json-schema` judge schema). Fails closed under 0.7 Spearman correlation vs the 6 graded anchors + 12 Notion fixtures on disk.

**Structured-output validation:** zod `safeParse` in-process (belt-and-suspenders over the CLI `--json-schema`), catches CLI-version regressions.

---

### `tests/run-all-229.sh` (test aggregator, batch)

**Analog: `tests/run-all-226.sh` (EXACT - copy verbatim skeleton).** Extract its actual shape:

```bash
#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0; SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then run "$label" "$@";
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""; fi
}

# D-dimension legs, each mapped to its dimension + REQ id (D1 listed FIRST as hardest gate):
run_if "229-01 (D1) quote-verifier: zero fabrication" "scripts/huji-eval.cjs" \
  node scripts/huji-eval.cjs --check quote-verifier
# ... D2..D10 legs ...

echo "======================================"
echo "Phase 229: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
```

**Copy exactly from 226:** the `run`/`run_if` counters, the `NODE_OPTIONS` preload export line (adapt or drop the eureka-offline preload; 229 has no offline model dep), the non-zero-exit-on-FAIL convention (`[ "$FAIL" -eq 0 ]` last line), the `run_if` file-guard so a partially-landed phase SKIPs (counter, never silent) instead of RED-failing. **D1 leg listed FIRST as the hardest gate** (226 puts null-legs first; 229 puts quote-verifier/zero-fabrication first). bash only, no em-dashes.

**Two-part phase gate (copy 226's header doctrine):** (1) `run-all-229` green = the AUTOMATED half asserting STRUCTURE only; (2) the mandatory HUMAN calibration checkpoint (Amnon's "better than a TA" verdict on the 2 demo artifacts) is a real leg, NEVER an automated assertion.

---

### `recipe-maps.cjs` - register `PWS_grading` (config registration, MODIFY)

**Analog: `SENS10_CAUSE_RECIPES` in the SAME file (`recipe-maps.cjs:282`, EXACT pattern).** A frozen map of key -> **bare command-string array** (NO `autonomous_safe` literal fabricated; posture is sourced separately via `postureForCommand`):

```javascript
// Source: lib/core/recipe-maps.cjs:282-312 (the pattern to mirror)
const SENS10_CAUSE_RECIPES = Object.freeze({
  assertion_unvalidated: Object.freeze([
    '/mos:challenge-assumptions',
    '/mos:find-analogies',
    '/mos:bono',
    '/mos:tell-synthesis',
  ]),
  // ...
});
```

**New registration (navigator-locked native order):**
```javascript
// PWS_grading: deep-grade spine -> mullins (BEFORE build-thesis) -> build-thesis (scored, non-gating) -> structure-argument (Minto pyramid, packaging last)
PWS_grading: Object.freeze([
  '/mos:deep-grade',
  '/mos:mullins',
  '/mos:build-thesis',
  '/mos:structure-argument',
]),
```
**Where to hang it:** RESEARCH.md §Seam(d) says `recipe-maps.cjs` is named by AI-SPEC §3 as the recipe home. Mirror `recipeForCause`'s accessor contract (`recipe-maps.cjs:322` - returns a fresh `.slice()` copy, never the frozen source, never throws, unknown key -> `[]`). Confirm whether `PWS_grading` slots into the existing `SENS10_CAUSE_RECIPES` map or a sibling named-recipe map + accessor - it is NOT a SENS-10 cause, so likely a new `NAMED_RECIPES` const + `recipeForName(name)` accessor following the identical frozen-map + slice-copy shape.

**Do NOT add `autonomous_safe` literals here** (T-166-02 / T-205-06-E): all 4 commands already resolve `autonomous_safe:true` in `data/command-registry.json`; posture comes from `postureForCommand` (`recipe-maps.cjs:177`, the ONE posture authority via `validateChainAutonomy`). `validateChainAutonomy` will report `runnable:true` with zero blockers.

---

### `.../schemas/evidence.schema.json` + `feedback-result.schema.json` (generated schemas)

**No hand-writing (RESEARCH State of the Art).** Author two small zod schemas in the eval harness and emit JSON Schema:
```javascript
const { z } = require('zod/v4');          // VERIFIED resolves under CJS on this machine
const jsonSchema = z.toJSONSchema(EvidenceSchema);
```
`EvidenceSchema` carries `quote` fields (verbatim anchors for D1 zero-fabrication). `FeedbackResultSchema` encodes the Minto contract: governing thought + 2-3 branches + teachable step + `self_identified_gaps` (D5/D6). These files feed the `--json-schema` CLI flag AND the orchestrator's `safeParse`.

---

### Stage A intake prompt (headless adapter, streaming)

**Analog: `skills/file-meeting/SKILL.md:286` Claimify 4-pass - PORT the machinery, do not reimplement** (navigator ruling 3, Canon Part 7). The 4 passes are selection -> disambiguation -> decomposition -> typing; extraction is LLM judgment (there is NO CJS extractor - a hardcoded one is the anti-pattern). Per atomic claim, call the shipped writer:

```javascript
// Source: SKILL.md:354-372 + navigation.cjs:209 + room-db.cjs:100 (VERIFIED)
const navigation = require('../lib/core/navigation.cjs');
const { openRoomDb } = require('../lib/core/room-db.cjs');
const db = openRoomDb(scratchRoomDir);
navigation.writeClaimNode(db, {
  text, knowledge_type,            // one of the frozen 6 enum members
  conditions, counter_conditions,  // '' if none stated
  valid_from, valid_until,         // ISO or ''
  sourceSpeaker, sourceSegment,    // segment id = idempotency key (UPSERT, never dup)
  sessionId,
  disambiguation                   // 'ambiguous' ONLY for unresolved (Pass 2), else omit
});
// mints type='claim', review_status='proposed' (NEVER auto-confirmed - Canon Part 9)
```
Link claims with `navigation.writeEdge` using `ALLOWED_EDGE_TYPES` (`navigation/edges.cjs`: REFINES / ROOT_CAUSES / INSTANTIATES). Also do wisdom-nugget extraction like file-meeting.

**Do NOT invoke the interactive `/mos:file-meeting` command** (it is `autonomous_safe:false`, carries nugget-routing HITL - Assumption A5). Drive the writer functions DIRECTLY from a headless Stage A prompt scoped to `Read` + `Bash(node lib/core/*)`. Stage A prompt baseline = the ported fusion engine (`assets/claims-fusion-engine-prompt.md`), **Mode A + extraction discipline ONLY; Modes B/C DISABLED** (generating missing transcript/slides = fabricated-critique failure mode).

---

### build-thesis scored override (`rubric-huji.md`, prompt/config)

**Analog: `commands/build-thesis.md` body - neutralize, don't fork.** Root cause (VERIFIED `build-thesis.md:62-78`): the 6/10 halt is a **PROMPT-LEVEL** natural-language instruction ("Binary gate (6/10 to proceed)"), not CJS. There is NO code gate to patch.

Two layers to neutralize (RESEARCH Seam c):
1. **Code halt (chain-level HITL):** ride `autonomous_safe` end-to-end (all 4 commands + `build-thesis.md` frontmatter already `autonomous_safe:true`); `runChain` (`chain-executor.cjs:432`) auto-runs and never reaches a material gate. `validateChainAutonomy` confirms zero blockers.
2. **Prompt halt (6/10):** a frozen `rubric-huji.md` passed via `--append-system-prompt-file` instructing build-thesis to SCORE all ten questions and CONTINUE unconditionally (emit per-question scores as feedback input). Keeps the prefix bit-identical across 200 runs (cache + provenance). **Fallback (Assumption A1):** if the demo shows the command still halts, add a scored-variant reference `references/methodology/build-thesis-scored.md` invoked by the recipe. Test on the demo first.

---

## Shared Patterns

### Subprocess spawn discipline (args array, no shell)
**Source:** `lib/core/room-auto-create.cjs:240` (`execFileSync('bash', [argsArray], {timeout, stdio, cwd, env})` + cleanup-on-fail).
**Apply to:** `huji-batch.cjs` (per-submission `claude -p`), `huji-eval.cjs` (judge spawner).
**Never:** the `execSync` shell-quote pattern at `label-topic-forest.cjs:81`.

### Part 8 egress guard (constitutional, REUSE)
**Source:** `lib/core/part8-egress-guard.cjs:231,97` (`classify`, `scanForContent`).
**Apply to:** every Brain-query payload in the batch (D4/G3). Any student-specific string in a payload -> HALT ENTIRE BATCH. Never hand-roll a regex.

### Room scaffold + grading-legal stage marker
**Source:** `navigation.birthRoom` (`room-birth.cjs:645`) -> `scaffoldRoomSkeleton` (`room-skeleton-scaffold.cjs:262`); STATE.md written directly with literal `Stage: Validation`; read back by `model-profiles.parseVentureStage` (`model-profiles.cjs:100`).
**Apply to:** every scratch room in `huji-batch.cjs`. Never run `compute-state` on a scratch room.

### Frozen-map + slice-copy accessor (recipe registration)
**Source:** `SENS10_CAUSE_RECIPES` + `recipeForCause` (`recipe-maps.cjs:282,322`).
**Apply to:** the `PWS_grading` registration - `Object.freeze` map of bare command strings, accessor returns a fresh copy, never throws, unknown key -> `[]`, no fabricated posture literals.

### Bash aggregator with run/run_if counters
**Source:** `tests/run-all-226.sh` (whole file).
**Apply to:** `tests/run-all-229.sh` - identical counters, file-guarded SKIP legs, D1 first, `[ "$FAIL" -eq 0 ]` exit, human calibration checkpoint documented as a non-automatable leg.

### zod -> JSON Schema (no hand-writing)
**Source:** `require('zod/v4').z.toJSONSchema(schema)` (VERIFIED CJS on this machine).
**Apply to:** both schema files + judge schema.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `batch-state.json` ledger + `.done` resume protocol (inside `huji-batch.cjs`) | state machine | batch resume | No batch/cohort orchestrator exists in the repo (RESEARCH Sweep 3). The checkpoint/resume/aggregation loop is the ONE genuine net-new build - filesystem ledger + atomic write-temp-rename + `.done` idempotency is authored fresh against AI-SPEC §4 State Management (no shipped precedent to copy). Concurrency pool 3-4, retry 2x. |

Everything else reuses a shipped, audited surface - which is exactly what keeps the Canon Part 8 privacy story defensible (RESEARCH Key insight).

---

## Metadata

**Analog search scope:** `scripts/`, `lib/core/`, `lib/workflow/`, `tests/`, `skills/file-meeting/`, `commands/`, `data/`.
**Files scanned:** ~30 (targeted grep + read of the RESEARCH-named call sites and the 3 flagged precedents).
**Pattern extraction date:** 2026-07-15
