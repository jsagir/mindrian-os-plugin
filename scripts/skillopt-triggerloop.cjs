#!/usr/bin/env node
'use strict';
/*
 * scripts/skillopt-triggerloop.cjs - Phase 230-03, WS1.5: the flagged-only REAL trigger-test loop.
 * ==========================================================================
 * The funnel (Plan 02) PREDICTS which skill would fire; this loop MEASURES it by
 * spawning a real subagent and watching the Skill actually fire in the stream-json
 * JSONL. AI-SPEC Pitfall 1 is the load-bearing detail of the whole phase: the
 * `--output-format json` envelope has NO reliable `.messages[]` tool trace, so a
 * genuine fire is observable ONLY in `--output-format stream-json --verbose` output.
 * assertStreamJsonArgs structurally blocks any trigger run that is not stream-json
 * (a trigger rate computed off the json envelope is UNVERIFIED, D7).
 *
 * THE DETECTOR IS PINNED AGAINST A LIVE CAPTURE, NOT DOCUMENTATION.
 * agentskills.io documents a native `{ type:'tool_use', name:'Skill',
 * input:{ skill } }` block. Two live captures against THIS plugin
 * (out/captures/firing-beautiful-question.jsonl and nonfiring-weather.jsonl,
 * produced by live stream-json spawns during Plan 03) prove that the MindrianOS
 * plugin does NOT surface a native Skill tool at all: a skill fires through an MCP
 * tool named `mcp__plugin_mos_mindrian-os__methodology` whose input carries the
 * bare skill name in `input.command`. SKILL_FIRE_TOOL + SKILL_INPUT_FIELD below are
 * read from that firing capture, never assumed. The native `Skill` form is kept as
 * a forward-compat secondary so a future CLI that adds it still detects.
 *
 * Part 1 (this task): preflightPluginLoad, detectSkillFire, assertStreamJsonArgs,
 * the live --capture path, and the fixture-driven --selftest.
 * Part 2 (Task 2): the scratch-checkout revision loop + best-by-validation.
 *
 * CJS only, switch-case argv router, no em-dashes. Reuses lib/core/skillopt-schemas.cjs.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  TriggerResultSchema,
  LoopSummarySchema,
  DescriptionRevisionSchema,
  UnitRecordSchema,
  NOT_EVALUATED_REASONS,
  PHASE_OUT_DIR,
  inlineSchemaJson,
  assertUnderOut,
  assertPinnedModelId,
} = require('../lib/core/skillopt-schemas.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

// The pinned FULL user model id for the trigger-test (sonnet tier - we measure real
// triggering under the model a user actually runs). assertPinnedModelId preflights it.
const PINNED_TRIGGER_MODEL = 'claude-sonnet-4-5';

// --------------------------------------------------------------------------
// SKILL-FIRE DETECTION CONSTANTS - PINNED FROM A LIVE CAPTURE (never documentation).
// Source capture: out/captures/firing-beautiful-question.jsonl (a live stream-json
// spawn where the query "Reframe my challenge ... as Why / What-if / How" fired the
// beautiful-question skill). The observed tool_use block was, verbatim:
//   { "type":"tool_use", "name":"mcp__plugin_mos_mindrian-os__methodology",
//     "input": { "command":"beautiful-question", "context":"declining user retention" } }
// So the fire is an MCP methodology tool_use, and the invoked skill name lives in
// input.command (bare, no mos: prefix) - NOT the native Skill tool, NOT input.skill.
// --------------------------------------------------------------------------
const SKILL_FIRE_TOOL = 'mcp__plugin_mos_mindrian-os__methodology'; // out/captures/firing-beautiful-question.jsonl
const SKILL_INPUT_FIELD = 'command'; // out/captures/firing-beautiful-question.jsonl : input.command == "beautiful-question"
const NATIVE_SKILL_TOOL = 'Skill';   // forward-compat secondary (agentskills.io documented form)

// More than this fraction of unparseable JSONL lines means the capture is corrupt
// (never a silent zero-fire - D5). A corrupt stream is jsonl_corrupt, not fired:false.
const JSONL_CORRUPT_THRESHOLD = 0.20;

// The mos plugin name as it appears in system/init.plugins (live capture).
const MOS_PLUGIN_RE = /mos|mindrian/i;

// --------------------------------------------------------------------------
// resolveTriggerConfig - defaults; concurrency hard-capped at 4 (429-storm guard).
// --------------------------------------------------------------------------
const HARD_CAP_CONCURRENCY = 4;
function resolveTriggerConfig(config) {
  const c = config || {};
  let concurrency = typeof c.concurrency === 'number' && c.concurrency > 0 ? c.concurrency : 3;
  if (concurrency > HARD_CAP_CONCURRENCY) concurrency = HARD_CAP_CONCURRENCY;
  return {
    model: c.model || PINNED_TRIGGER_MODEL,
    reviseModel: c.reviseModel || PINNED_TRIGGER_MODEL,
    pluginDir: c.pluginDir || REPO_ROOT,
    captureMaxTurns: typeof c.captureMaxTurns === 'number' ? c.captureMaxTurns : 4,
    captureBudgetUsd: typeof c.captureBudgetUsd === 'number' ? c.captureBudgetUsd : 0.5,
    triggerBudgetUsd: typeof c.triggerBudgetUsd === 'number' ? c.triggerBudgetUsd : 0.25,
    triggerMaxTurns: typeof c.triggerMaxTurns === 'number' ? c.triggerMaxTurns : 4,
    runsPerQuery: typeof c.runsPerQuery === 'number' && c.runsPerQuery > 0 ? c.runsPerQuery : 3,
    maxIterations: Math.min(typeof c.maxIterations === 'number' ? c.maxIterations : 5, 5), // hard cap 5
    timeoutMs: typeof c.timeoutMs === 'number' ? c.timeoutMs : 180000,
    concurrency,
    reviseRubricPath: c.reviseRubricPath || path.join('references', 'methodology', 'skillopt-revise-rubric.md'),
  };
}

// --------------------------------------------------------------------------
// writeAtomic - write-temp-then-rename (copied from huji-batch.writeAtomic:60-64).
// --------------------------------------------------------------------------
function writeAtomic(filePath, contents) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

function safeStem(name) {
  return String(name || '').replace(/[^A-Za-z0-9._-]/g, '_');
}

// Strip the optional mos: namespace so a bare name and a namespaced command compare
// equal (AI-SPEC warns the field may surface either; live capture showed the bare form).
function normalizeSkillName(s) {
  return String(s == null ? '' : s).replace(/^mos:/, '').trim();
}

// --------------------------------------------------------------------------
// extractInvokedSkill(block) - given a tool_use content block, return the invoked
// skill name if this block is a skill fire, else null. Reads SKILL_INPUT_FIELD from
// the MCP methodology tool (the live-verified mechanism); falls back to the native
// Skill tool's documented input shape for forward compatibility.
// --------------------------------------------------------------------------
function extractInvokedSkill(block) {
  if (!block || block.type !== 'tool_use') return null;
  const input = block.input || {};
  if (block.name === SKILL_FIRE_TOOL) {
    return input[SKILL_INPUT_FIELD] != null ? String(input[SKILL_INPUT_FIELD]) : null;
  }
  if (block.name === NATIVE_SKILL_TOOL) {
    if (input.skill != null) return String(input.skill);
    if (input.command != null) return String(input.command);
    if (input.name != null) return String(input.name);
    return null;
  }
  return null;
}

// --------------------------------------------------------------------------
// detectSkillFire(jsonlText, expectedSkill) - THE load-bearing detector. Splits the
// stream-json JSONL, JSON.parse per line (skips unparseable lines but COUNTS them:
// > 20% unparseable is jsonl_corrupt, NEVER a silent zero-fire). Scans assistant
// events for skill-fire tool_use blocks and matches the invoked name against the
// expected skill with mos:-namespace tolerance.
//   Returns { ok, reason?, fired, invoked, blocks, total_lines, unparseable_lines }.
//   ok:false + reason:'jsonl_corrupt' when the stream is unusable.
//   When expectedSkill is null, fired == "any skill fired at all" (used for a
//   should_not_trigger query whose skill under test must stay silent).
// --------------------------------------------------------------------------
function detectSkillFire(jsonlText, expectedSkill) {
  const rawLines = String(jsonlText == null ? '' : jsonlText)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (rawLines.length === 0) {
    return { ok: false, reason: 'jsonl_corrupt', fired: false, invoked: null, blocks: [], total_lines: 0, unparseable_lines: 0 };
  }
  let unparseable = 0;
  const events = [];
  for (const ln of rawLines) {
    let ev = null;
    try { ev = JSON.parse(ln); } catch (_e) { unparseable += 1; continue; }
    events.push(ev);
  }
  if (unparseable / rawLines.length > JSONL_CORRUPT_THRESHOLD) {
    return { ok: false, reason: 'jsonl_corrupt', fired: false, invoked: null, blocks: [], total_lines: rawLines.length, unparseable_lines: unparseable };
  }
  const blocks = [];
  const invokedAll = [];
  for (const ev of events) {
    if (!ev || ev.type !== 'assistant' || !ev.message || !Array.isArray(ev.message.content)) continue;
    for (const b of ev.message.content) {
      const inv = extractInvokedSkill(b);
      if (inv !== null) { blocks.push(b); invokedAll.push(inv); }
    }
  }
  const exp = expectedSkill == null ? null : normalizeSkillName(expectedSkill);
  const fired = exp === null ? invokedAll.length > 0 : invokedAll.some((i) => normalizeSkillName(i) === exp);
  return {
    ok: true,
    fired,
    invoked: invokedAll.length ? invokedAll[0] : null,
    blocks,
    total_lines: rawLines.length,
    unparseable_lines: unparseable,
  };
}

// --------------------------------------------------------------------------
// assertStreamJsonArgs(args) - the D7 integrity guardrail. A trigger run MUST use
// --output-format stream-json --verbose; a json-envelope trigger run is rejected so
// its (unverifiable) trigger rate is never computed. Every real trigger/capture
// spawn preflights its own arg vector through this.
// --------------------------------------------------------------------------
function assertStreamJsonArgs(args) {
  if (!Array.isArray(args)) return { ok: false, reason: 'args_not_array' };
  const i = args.indexOf('--output-format');
  if (i < 0 || args[i + 1] !== 'stream-json') return { ok: false, reason: 'not_stream_json' };
  if (!args.includes('--verbose')) return { ok: false, reason: 'missing_verbose' };
  return { ok: true };
}

// --------------------------------------------------------------------------
// defaultSpawn(args, timeoutMs) - real spawnSync with all fuses; input:'' closes
// stdin at once (avoids the CLI's 3s "no stdin" wait). Selftests inject a fake.
// --------------------------------------------------------------------------
function defaultSpawn(args, timeoutMs) {
  return spawnSync('claude', args, {
    env: process.env, encoding: 'utf8', input: '', maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs,
  });
}

// --------------------------------------------------------------------------
// preflightPluginLoad(config) - ONE stream-json run asserting system/init carries
// the mos plugin and no plugin_errors. Copied from huji-batch.preflightPluginLoad:
// 162-192. On failure the CALLER aborts the whole run closed before spending (D7 /
// AI-SPEC Section 6). spawnImpl injectable so the selftest exercises it model-free.
// --------------------------------------------------------------------------
function preflightPluginLoad(config) {
  const cfg = resolveTriggerConfig(config);
  const spawn = (config && config.spawnImpl) || defaultSpawn;
  const args = [
    '-p', 'preflight: confirm the plugin is loaded',
    '--plugin-dir', cfg.pluginDir,
    '--output-format', 'stream-json',
    '--verbose',
    '--max-turns', '1',
    '--no-session-persistence',
  ];
  const guard = assertStreamJsonArgs(args);
  if (!guard.ok) return { ok: false, reason: 'preflight_args_not_stream_json' };
  const res = spawn(args, Math.min(cfg.timeoutMs, 120000));
  if (!res || res.error) {
    return { ok: false, reason: 'preflight_spawn_failed', detail: res && res.error ? String(res.error.message || res.error).slice(0, 200) : 'no_result' };
  }
  let sawInit = false;
  let pluginLoaded = false;
  let pluginErrors = false;
  for (const ln of String(res.stdout || '').split('\n').filter(Boolean)) {
    let ev = null;
    try { ev = JSON.parse(ln); } catch (_e) { continue; }
    if (!ev || typeof ev !== 'object') continue;
    if ((ev.type === 'system' && ev.subtype === 'init') || ev.plugins !== undefined) {
      sawInit = true;
      const plugins = ev.plugins || [];
      if (Array.isArray(plugins) && plugins.some((p) => MOS_PLUGIN_RE.test(JSON.stringify(p)))) pluginLoaded = true;
      const errs = ev.plugin_errors;
      if (errs && ((Array.isArray(errs) && errs.length) || (typeof errs === 'object' && Object.keys(errs).length))) pluginErrors = true;
    }
  }
  if (!sawInit) return { ok: false, reason: 'no_system_init' };
  if (pluginErrors) return { ok: false, reason: 'plugin_errors_present' };
  if (!pluginLoaded) return { ok: false, reason: 'plugin_not_loaded' };
  return { ok: true };
}

// --------------------------------------------------------------------------
// buildCaptureArgs / buildTriggerArgs - the spawn arg vectors. Both are stream-json
// --verbose with the DEFAULT tool set (no --allowedTools) so progressive disclosure
// runs under real conditions (AI-SPEC Section 4 Tool Use). buildTriggerArgs points
// --plugin-dir at a scratch checkout; buildCaptureArgs at the given plugin dir.
// --------------------------------------------------------------------------
function buildCaptureArgs(query, config) {
  const cfg = resolveTriggerConfig(config);
  return [
    '-p', String(query),
    '--plugin-dir', cfg.pluginDir,
    '--model', cfg.model,
    '--output-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'dontAsk',
    '--max-turns', String(cfg.captureMaxTurns),
    '--max-budget-usd', String(cfg.captureBudgetUsd),
    '--no-session-persistence',
  ];
}

function buildTriggerArgs(query, pluginDir, config) {
  const cfg = resolveTriggerConfig(config);
  return [
    '-p', String(query),
    '--plugin-dir', pluginDir,
    '--model', cfg.model,
    '--output-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'dontAsk',
    '--max-turns', String(cfg.triggerMaxTurns),
    '--max-budget-usd', String(cfg.triggerBudgetUsd),
    '--no-session-persistence',
  ];
}

// --------------------------------------------------------------------------
// runCapture({ skill, query, outDir, config, spawnImpl }) - the ONE live step in
// this plan. preflight (abort closed on failure), spawn ONE stream-json subagent,
// write the raw JSONL to out/captures/<skill>.jsonl (assertUnderOut first), then
// report what the detector saw. No capture spawn happens after a failed preflight.
// --------------------------------------------------------------------------
function runCapture(opts) {
  const o = opts || {};
  const cfg = resolveTriggerConfig(o.config);
  const outDir = o.outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const spawn = o.spawnImpl || defaultSpawn;

  if (o.preflight !== false) {
    const pf = preflightPluginLoad(Object.assign({}, o.config, { spawnImpl: o.preflightSpawnImpl || spawn }));
    if (!pf.ok) return { ok: false, reason: 'preflight_failed', detail: pf, spawned: false };
  }

  const args = buildCaptureArgs(o.query, cfg);
  const guard = assertStreamJsonArgs(args);
  if (!guard.ok) return { ok: false, reason: 'capture_args_not_stream_json', spawned: false };

  const res = spawn(args, cfg.timeoutMs);
  if (!res || res.error) return { ok: false, reason: 'capture_spawn_failed', spawned: true };
  const jsonl = String(res.stdout || '');

  const target = path.join(outDir, 'captures', safeStem(o.skill) + '.jsonl');
  const under = assertUnderOut(target, outDir);
  if (!under.ok) return { ok: false, reason: 'capture_outside_out', target, spawned: true };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  writeAtomic(target, jsonl);

  const det = detectSkillFire(jsonl, o.skill);
  return { ok: true, spawned: true, path: target, fired: det.fired, invoked: det.invoked, detector: det };
}

// --------------------------------------------------------------------------
// makeTriggerUnitRecord - a UnitRecord (kind 'trigger') for one run. status
// 'not_evaluated' MUST carry a closed-vocabulary reason (D5). Never a silent skip.
// --------------------------------------------------------------------------
function makeTriggerUnitRecord(o) {
  const rec = {
    unit_id: o.unitId,
    kind: 'trigger',
    model: o.model,
    session_id: o.sessionId != null ? o.sessionId : null,
    total_cost_usd: typeof o.costUsd === 'number' ? o.costUsd : null,
    exit: typeof o.exit === 'number' ? o.exit : null,
    status: o.status,
    not_evaluated_reason: o.reason || null,
    error_issues: o.issues || null,
    payload: o.payload != null ? o.payload : null,
  };
  const parsed = UnitRecordSchema.safeParse(rec);
  if (!parsed.success) {
    throw new Error('skillopt-triggerloop: internal trigger UnitRecord invalid: ' + JSON.stringify(parsed.error.issues));
  }
  return rec;
}

// ==========================================================================
// PART 2 (Task 2): scratch-checkout revision loop + best-by-validation selection.
// ==========================================================================

const matter = require('gray-matter');

// --------------------------------------------------------------------------
// runPool - dependency-free bounded concurrency pool (copied verbatim from
// huji-batch.cjs:200-229). Used for the runsPerQuery fan-out. getLimit re-read each
// iteration; never an unbounded parallel-all (429-storm guard, Pitfall 5).
// --------------------------------------------------------------------------
async function runPool({ items, getLimit, worker, onSettle }) {
  let idx = 0;
  const running = [];
  const results = [];
  const limitNow = () => Math.max(0, getLimit());
  while (idx < items.length || running.length > 0) {
    while (idx < items.length && running.length < limitNow()) {
      const item = items[idx++];
      const entry = { done: false };
      entry.promise = (async () => {
        try { entry.settled = { item, res: await worker(item) }; }
        catch (err) { entry.settled = { item, err }; }
        entry.done = true;
        return entry.settled;
      })();
      running.push(entry);
    }
    if (running.length === 0) break;
    await Promise.race(running.map((e) => e.promise));
    for (let i = running.length - 1; i >= 0; i--) {
      if (running[i].done) {
        const settled = running[i].settled;
        results.push(settled);
        running.splice(i, 1);
        if (onSettle) onSettle(settled);
      }
    }
  }
  return results;
}

// The plugin surface a --plugin-dir checkout needs to (a) load the full skill roster
// AND (b) run the MCP methodology server that actually fires a skill (per the live
// capture, the fire is mcp__plugin_mos_mindrian-os__methodology). node_modules is
// symlinked, not copied, so the MCP server resolves its deps without a heavy copy.
const SCRATCH_COPY_ENTRIES = Object.freeze([
  '.claude-plugin', '.mcp.json', 'skills', 'commands', 'agents', 'hooks',
  'bin', 'lib', 'scripts', 'references', 'data', 'pipelines', 'package.json',
]);
const SCRATCH_SYMLINK_ENTRIES = Object.freeze(['node_modules']);

// --------------------------------------------------------------------------
// buildScratchCheckout(skill, description, scratchDir, opts) - copy the plugin
// skill-loading + MCP surface into out/scratch/<skill>/ (assertUnderOut FIRST, fail
// closed - the real skills/ tree is NEVER a write target, CFM4/D6), then rewrite
// ONLY that skill's SKILL.md description frontmatter inside the scratch copy. The
// full roster is present so progressive disclosure runs under real conditions.
// --------------------------------------------------------------------------
function buildScratchCheckout(skill, description, scratchDir, opts) {
  const o = opts || {};
  const sourceRoot = o.sourceRoot || REPO_ROOT;
  const outRoot = o.outRoot || path.join(REPO_ROOT, PHASE_OUT_DIR);

  // Containment: scratchDir MUST be under the out sandbox. This structurally forbids
  // ever pointing the checkout at the shipped skills/ or scripts/ tree.
  const under = assertUnderOut(scratchDir, outRoot);
  if (!under.ok) return { ok: false, reason: 'scratch_outside_out', scratchDir };

  const skillDir = o.skillDir || skill; // inventory dir == skill name in this repo
  if (o.copyImpl) {
    // Injected copy for the selftest (no real 100MB clone); still exercises the guard + rewrite.
    o.copyImpl(sourceRoot, scratchDir);
  } else {
    fs.mkdirSync(scratchDir, { recursive: true });
    for (const entry of SCRATCH_COPY_ENTRIES) {
      const src = path.join(sourceRoot, entry);
      if (!fs.existsSync(src)) continue;
      fs.cpSync(src, path.join(scratchDir, entry), { recursive: true });
    }
    for (const entry of SCRATCH_SYMLINK_ENTRIES) {
      const src = path.join(sourceRoot, entry);
      const dst = path.join(scratchDir, entry);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        try { fs.symlinkSync(src, dst); } catch (_e) { /* symlink optional */ }
      }
    }
  }

  // Rewrite ONLY the candidate skill's description in the scratch copy.
  const skillMdPath = path.join(scratchDir, 'skills', skillDir, 'SKILL.md');
  const guard = assertUnderOut(skillMdPath, outRoot);
  if (!guard.ok) return { ok: false, reason: 'skill_md_outside_out', skillMdPath };
  if (fs.existsSync(skillMdPath) && description != null) {
    const parsed = matter(fs.readFileSync(skillMdPath, 'utf8'));
    parsed.data.description = description;
    writeAtomic(skillMdPath, matter.stringify(parsed.content, parsed.data));
  }
  return { ok: true, scratchDir, skillMdPath };
}

// --------------------------------------------------------------------------
// runTriggerQuery({ skill, query, scratchDir, config, iteration, split, spawnImpl })
// - measure ONE query: runsPerQuery real stream-json spawns against the scratch
// checkout, each detected via detectSkillFire(jsonl, skill). assertStreamJsonArgs
// preflights every arg vector (D7). A spawn/timeout/corrupt-JSONL run lands as a
// not_evaluated trigger UnitRecord and is EXCLUDED from both numerator AND
// denominator; the rate is over completed runs only, never inflated (D5/D11).
// --------------------------------------------------------------------------
async function runTriggerQuery(opts) {
  const o = opts || {};
  const cfg = resolveTriggerConfig(o.config);
  const spawn = o.spawnImpl || defaultSpawn;
  const runs = cfg.runsPerQuery;
  const items = Array.from({ length: runs }, (_v, i) => i);

  let fires = 0;
  let completed = 0;
  const notEvaluated = [];

  const worker = async (runIdx) => {
    const args = buildTriggerArgs(o.query, o.scratchDir, cfg);
    const guard = assertStreamJsonArgs(args);
    if (!guard.ok) return { runIdx, notEvaluated: true, reason: 'schema_fail' };
    const res = spawn(args, cfg.timeoutMs);
    if (!res || res.error) return { runIdx, notEvaluated: true, reason: 'spawn_failed' };
    if (res.signal === 'SIGTERM') return { runIdx, notEvaluated: true, reason: 'timeout' };
    if (typeof res.status === 'number' && res.status !== 0) return { runIdx, notEvaluated: true, reason: 'nonzero_exit' };
    const det = detectSkillFire(String(res.stdout || ''), o.skill);
    if (!det.ok) return { runIdx, notEvaluated: true, reason: 'empty_envelope' }; // jsonl_corrupt -> not_evaluated, never a silent no-fire
    return { runIdx, notEvaluated: false, fired: det.fired };
  };

  const onSettle = (settled) => {
    const r = settled.res;
    if (!r) return;
    if (r.notEvaluated) { notEvaluated.push(r); return; }
    completed += 1;
    if (r.fired) fires += 1;
  };

  await runPool({ items, getLimit: () => cfg.concurrency, worker, onSettle });

  const trigger_rate = completed > 0 ? fires / completed : 0;
  return {
    skill: o.skill,
    query: o.query,
    split: o.split || 'train',
    iteration: typeof o.iteration === 'number' ? o.iteration : 0,
    runs,
    fires,
    completed_runs: completed,
    not_evaluated_runs: notEvaluated.length,
    trigger_rate,
  };
}

// A query PASSES depending on its kind: a should_trigger query needs the skill under
// test to fire in at least 2/3 of the completed runs; a should_not_trigger query
// needs it to fire in ZERO runs (do-no-harm to a sibling, D3).
const SHOULD_TRIGGER_PASS_RATE = 2 / 3;
function queryPasses(kind, triggerRate) {
  if (kind === 'should_not_trigger') return triggerRate === 0;
  return triggerRate >= SHOULD_TRIGGER_PASS_RATE;
}

// --------------------------------------------------------------------------
// buildRevisePrompt / buildReviseArgs - the revision-subagent spawn. TRAIN failures
// ONLY in -p; the frozen rubric in --append-system-prompt-file; inline
// DescriptionRevisionSchema; --allowedTools Read; --max-turns 2. The prompt NEVER
// contains a validation query string (overfitting guard, AI-SPEC 1b Dimension 3).
// --------------------------------------------------------------------------
function buildRevisePrompt(o) {
  const lines = [
    'SKILL: ' + o.skill,
    'CURRENT DESCRIPTION: ' + (o.currentDescription || ''),
    '',
    'NAMED SIBLING SKILLS (make this skill distinct from these):',
  ];
  for (const s of (o.siblings || [])) lines.push('- ' + s.skill + ': ' + s.description);
  lines.push('');
  lines.push('TRAIN-SET FAILURES (optimize against these ONLY):');
  for (const f of (o.trainFailures || [])) {
    lines.push('- query: ' + f.query + ' | should fire: ' + (f.expected == null ? 'none' : f.expected) + ' | actually fired: ' + (f.actually_fired == null ? 'nothing' : f.actually_fired));
  }
  lines.push('');
  lines.push('Rewrite the description per the rubric. Return only the JSON the schema describes.');
  return lines.join('\n');
}

function buildReviseArgs(o, config) {
  const cfg = resolveTriggerConfig(config);
  return [
    '-p', buildRevisePrompt(o),
    '--append-system-prompt-file', cfg.reviseRubricPath,
    '--plugin-dir', cfg.pluginDir,
    '--model', cfg.reviseModel,
    '--output-format', 'json',
    '--json-schema', inlineSchemaJson(DescriptionRevisionSchema),
    '--allowedTools', 'Read',
    '--max-turns', '2',
    '--max-budget-usd', String(cfg.triggerBudgetUsd),
    '--permission-mode', 'dontAsk',
    '--no-session-persistence',
  ];
}

// --------------------------------------------------------------------------
// selectBestIteration(iterations) - THE do-no-harm selector (D3/CFM1). Picks the
// iteration with the highest VALIDATION pass-rate (ties break to the EARLIEST, so
// the selector can NEVER drift to "last iteration"). Keeps baseline unless a later
// iteration strictly improves it. regressed_query_count = validation queries that
// passed at iteration 0 but fail in the chosen candidate; ANY regression BLOCKS the
// proposed diff (proposed_description stays null). converged=false when no iteration
// beat baseline (best-by-validation baseline kept, marked did-not-converge).
//   iterations[i] = { iteration, validation_pass_rate, validation_passed_set:Set,
//                     description? }.
// --------------------------------------------------------------------------
function selectBestIteration(iterations) {
  const baseline = iterations[0];
  let best = baseline;
  for (let i = 1; i < iterations.length; i++) {
    if (iterations[i].validation_pass_rate > best.validation_pass_rate) best = iterations[i];
  }
  const improved = best.iteration !== baseline.iteration && best.validation_pass_rate > baseline.validation_pass_rate;
  const chosen = improved ? best : baseline;

  const baseSet = baseline.validation_passed_set || new Set();
  const chosenSet = chosen.validation_passed_set || new Set();
  const regressed_queries = [...baseSet].filter((q) => !chosenSet.has(q));
  const regressed_query_count = improved ? regressed_queries.length : 0;
  const blocked_by_regression = regressed_query_count > 0;
  const converged = improved;
  const proposed_description = (improved && !blocked_by_regression && chosen.description != null) ? chosen.description : null;

  return {
    best_iteration: chosen.iteration,
    baseline_validation_rate: baseline.validation_pass_rate,
    best_validation_rate: chosen.validation_pass_rate,
    regressed_query_count,
    regressed_queries,
    converged,
    blocked_by_regression,
    proposed_description,
  };
}

// Measure one iteration's whole query set. Returns per-query TriggerResult rows plus
// the validation pass-set + rate. measureImpl is injectable so the selftest drives
// canned rates with zero spawn; the default measures via runTriggerQuery.
async function measureIteration(o) {
  const { skill, queries, scratchDir, iteration, config } = o;
  const measure = o.measureImpl || (async (q) => runTriggerQuery({
    skill, query: q.query, scratchDir, iteration, split: q.split, config, spawnImpl: o.spawnImpl,
  }));
  const rows = [];
  const validationPassed = new Set();
  let validationTotal = 0;
  for (const q of queries) {
    const m = await measure(q, iteration);
    const row = {
      skill, query: q.query, split: q.split, iteration,
      runs: m.runs, fires: m.fires, trigger_rate: m.trigger_rate,
      completed_runs: m.completed_runs, not_evaluated_runs: m.not_evaluated_runs, kind: q.kind,
    };
    const parsed = TriggerResultSchema.safeParse({
      skill: row.skill, query: row.query, split: row.split, iteration: row.iteration,
      runs: row.runs, fires: row.fires, trigger_rate: Number(row.trigger_rate.toFixed(4)),
    });
    if (!parsed.success) throw new Error('measureIteration: TriggerResult invalid: ' + JSON.stringify(parsed.error.issues));
    rows.push(row);
    if (q.split === 'validation') {
      validationTotal += 1;
      if (queryPasses(q.kind, m.trigger_rate)) validationPassed.add(q.query);
    }
  }
  const validation_pass_rate = validationTotal > 0 ? validationPassed.size / validationTotal : 0;
  return { iteration, rows, validation_passed_set: validationPassed, validation_pass_rate, validation_total: validationTotal };
}

// Collect the TRAIN failures of an iteration (what the reviser is allowed to see).
function trainFailures(iterationMeasure, baselineDescriptionBySkill) {
  const fails = [];
  for (const row of iterationMeasure.rows) {
    if (row.split !== 'train') continue;
    if (!queryPasses(row.kind, row.trigger_rate)) {
      fails.push({ query: row.query, expected: row.kind === 'should_not_trigger' ? null : row.skill, actually_fired: row.trigger_rate > 0 ? 'the skill fired when it should not' : 'nothing' });
    }
  }
  return fails;
}

// --------------------------------------------------------------------------
// runLoopForSkill({ skill, queries, config, ... }) - the full flagged-skill loop.
// Iteration 0 = baseline. Then up to maxIterations (hard cap 5): revise against
// TRAIN failures only, rebuild the scratch checkout with the candidate, re-measure
// train + validation. Select best by validation pass-rate with the do-no-harm gate.
// Persists out/loop/<skill>/iteration-<n>.json + summary.json (LoopSummary-valid).
// reviseImpl/measureImpl/scratchImpl injectable so the selftest runs zero-spawn.
// --------------------------------------------------------------------------
async function runLoopForSkill(o) {
  const cfg = resolveTriggerConfig(o.config);
  const skill = o.skill;
  const queries = o.queries || [];
  const outDir = o.outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const loopDir = path.join(outDir, 'loop', safeStem(skill));

  const scratchImpl = o.scratchImpl || ((desc, iter) => buildScratchCheckout(skill, desc, path.join(outDir, 'scratch', safeStem(skill)), { skillDir: o.skillDir, outRoot: outDir }));
  const reviseImpl = o.reviseImpl || defaultReviseImpl;

  const iterations = [];
  const persist = (iterMeasure) => {
    if (o._noWrite) return;
    const target = path.join(loopDir, 'iteration-' + iterMeasure.iteration + '.json');
    const guard = assertUnderOut(target, outDir);
    if (!guard.ok) throw new Error('runLoopForSkill: iteration path outside out: ' + target);
    fs.mkdirSync(loopDir, { recursive: true });
    const persistable = iterMeasure.rows.map((r) => ({
      skill: r.skill, query: r.query, split: r.split, iteration: r.iteration,
      runs: r.runs, fires: r.fires, trigger_rate: Number(r.trigger_rate.toFixed(4)),
    }));
    writeAtomic(target, JSON.stringify(persistable, null, 2) + '\n');
  };

  // Iteration 0: baseline description, measured on train + validation.
  const baselineDesc = o.baselineDescription != null ? o.baselineDescription : null;
  let currentDesc = baselineDesc;
  scratchImpl(currentDesc, 0);
  const m0 = await measureIteration({ skill, queries, scratchDir: path.join(outDir, 'scratch', safeStem(skill)), iteration: 0, config: cfg, measureImpl: o.measureImpl, spawnImpl: o.spawnImpl });
  m0.description = baselineDesc;
  iterations.push(m0);
  persist(m0);

  for (let iter = 1; iter <= cfg.maxIterations; iter++) {
    const prev = iterations[iterations.length - 1];
    const fails = trainFailures(prev);
    const revision = await reviseImpl({ skill, currentDescription: currentDesc, siblings: o.siblings || [], trainFailures: fails, iteration: iter, config: cfg });
    if (!revision || revision.description == null) break; // reviser failed; keep best so far
    currentDesc = revision.description;
    scratchImpl(currentDesc, iter);
    const m = await measureIteration({ skill, queries, scratchDir: path.join(outDir, 'scratch', safeStem(skill)), iteration: iter, config: cfg, measureImpl: o.measureImpl, spawnImpl: o.spawnImpl });
    m.description = currentDesc;
    iterations.push(m);
    persist(m);
    // Early stop if a strict validation improvement with zero regression is already banked.
    const interim = selectBestIteration(iterations);
    if (interim.converged && !interim.blocked_by_regression && interim.best_iteration === iter) {
      // keep going only if more iterations could help; but a clean win is a fine place to stop.
      if (o.stopOnFirstCleanWin) break;
    }
  }

  const selection = selectBestIteration(iterations);
  const summary = {
    skill,
    iterations_run: Math.min(iterations.length - 1, 5), // revision iterations beyond baseline, cap 5
    best_iteration: selection.best_iteration,
    selected_by: 'validation_pass_rate',
    baseline_validation_rate: Number(selection.baseline_validation_rate.toFixed(4)),
    best_validation_rate: Number(selection.best_validation_rate.toFixed(4)),
    regressed_query_count: selection.regressed_query_count,
    converged: selection.converged,
    proposed_description: selection.proposed_description,
  };
  const parsed = LoopSummarySchema.safeParse(summary);
  if (!parsed.success) throw new Error('runLoopForSkill: LoopSummary invalid: ' + JSON.stringify(parsed.error.issues));

  const summaryOut = Object.assign({}, summary, {
    blocked_by_regression: selection.blocked_by_regression,
    regressed_queries: selection.regressed_queries,
  });
  if (!o._noWrite) {
    const target = path.join(loopDir, 'summary.json');
    const guard = assertUnderOut(target, outDir);
    if (!guard.ok) throw new Error('runLoopForSkill: summary path outside out: ' + target);
    fs.mkdirSync(loopDir, { recursive: true });
    writeAtomic(target, JSON.stringify(summaryOut, null, 2) + '\n');
  }
  return { summary: summaryOut, iterations, selection };
}

// Default revision spawn: build args, spawn json, unwrap + validate DescriptionRevision.
function defaultReviseImpl(o) {
  const cfg = resolveTriggerConfig(o.config);
  const args = buildReviseArgs(o, cfg);
  const res = spawnSync('claude', args, { env: process.env, encoding: 'utf8', input: '', maxBuffer: 8 * 1024 * 1024, timeout: cfg.timeoutMs });
  if (!res || res.error || (typeof res.status === 'number' && res.status !== 0)) return null;
  let env = null;
  try { env = JSON.parse(String(res.stdout || '')); } catch (_e) { return null; }
  let structured = env && env.structured_output;
  if (!structured && env && typeof env.result === 'string') {
    try { structured = JSON.parse(env.result); } catch (_e) { structured = null; }
  }
  if (!structured) return null;
  const parsed = DescriptionRevisionSchema.safeParse(Object.assign({ skill: o.skill, iteration: o.iteration }, structured));
  return parsed.success ? parsed.data : null;
}

// --------------------------------------------------------------------------
// runLoopsFromFunnel - the DEFERRED live entry (gated to the smoke opt-in per
// CONTEXT.md; this plan runs only the two capture spawns live). Reads the flagged
// subset from out/funnel/funnel-results.json and the per-skill query sets, then runs
// runLoopForSkill for each. Aborts closed if the plugin preflight fails.
// --------------------------------------------------------------------------
async function runLoopsFromFunnel(o) {
  const outDir = o.outDir;
  const cfg = resolveTriggerConfig(o.config);
  const pf = preflightPluginLoad(cfg);
  if (!pf.ok) { console.error('skillopt-triggerloop: plugin preflight failed (' + pf.reason + ') - aborting closed.'); process.exit(1); }

  let funnel = null;
  try { funnel = JSON.parse(fs.readFileSync(path.join(outDir, 'funnel', 'funnel-results.json'), 'utf8')); } catch (_e) { funnel = null; }
  if (!funnel || !Array.isArray(funnel.skills)) { console.error('skillopt-triggerloop: no funnel-results.json - run the funnel first.'); process.exit(2); }
  let flagged = funnel.skills.filter((s) => s.verdict === 'flagged').map((s) => s.skill);
  if (o.skills && o.skills.length) flagged = flagged.filter((s) => o.skills.includes(s));

  const summaries = [];
  for (const skill of flagged) {
    let set = null;
    try { set = JSON.parse(fs.readFileSync(path.join(outDir, 'queries', safeStem(skill) + '.json'), 'utf8')); } catch (_e) { set = null; }
    if (!set || !Array.isArray(set.queries)) continue;
    const r = await runLoopForSkill({ skill, queries: set.queries, baselineDescription: null, config: cfg, outDir });
    summaries.push(r.summary);
    console.log('loop ' + skill + ': best_iter=' + r.summary.best_iteration + ' validation ' + r.summary.baseline_validation_rate + ' -> ' + r.summary.best_validation_rate + (r.summary.blocked_by_regression ? ' BLOCKED(regression)' : '') + (r.summary.converged ? '' : ' did-not-converge'));
  }
  console.log('OK skillopt-triggerloop: looped ' + summaries.length + ' flagged skills.');
}

// --------------------------------------------------------------------------
// runSelftestPart2 - fixture-driven, ZERO spawn. Four required fixtures:
//   (1) best-by-validation picks iteration 2 for rates [0.5,0.7,0.9,0.8] (not last).
//   (2) a candidate with a higher aggregate rate but one regressed validation query
//       is BLOCKED (regressed_query_count > 0, proposed_description null).
//   (3) a 5-iteration no-improvement run yields converged:false with baseline kept.
//   (4) a scratch checkout targeting skills/ is rejected by assertUnderOut.
//   plus: the revise prompt contains train queries and NONE of the validation ones.
// --------------------------------------------------------------------------
function runSelftestPart2(assert) {
  // (1) best-by-validation not-last.
  const s1 = selectBestIteration([
    { iteration: 0, validation_pass_rate: 0.5, validation_passed_set: new Set(['a']) },
    { iteration: 1, validation_pass_rate: 0.7, validation_passed_set: new Set(['a', 'b']) },
    { iteration: 2, validation_pass_rate: 0.9, validation_passed_set: new Set(['a', 'b', 'c']), description: 'best desc' },
    { iteration: 3, validation_pass_rate: 0.8, validation_passed_set: new Set(['a', 'b']) },
  ]);
  assert.strictEqual(s1.best_iteration, 2, 'part2: best-by-validation must pick iteration 2, not the last (3)');
  assert.strictEqual(s1.regressed_query_count, 0, 'part2: no regression when best superset of baseline');
  assert.strictEqual(s1.converged, true, 'part2: a strict improvement converges');
  assert.strictEqual(s1.proposed_description, 'best desc', 'part2: proposed description is the best iteration');

  // (2) higher aggregate rate but one regressed validation query -> BLOCKED.
  const s2 = selectBestIteration([
    { iteration: 0, validation_pass_rate: 0.6, validation_passed_set: new Set(['a', 'b', 'c']) },
    { iteration: 1, validation_pass_rate: 0.8, validation_passed_set: new Set(['a', 'b', 'd', 'e']), description: 'regressing desc' },
  ]);
  assert.strictEqual(s2.best_iteration, 1, 'part2: the higher-rate iteration is selected');
  assert.strictEqual(s2.regressed_query_count, 1, 'part2: exactly one validation query (c) regressed');
  assert.strictEqual(s2.blocked_by_regression, true, 'part2: any regression blocks the diff (D3 hard gate)');
  assert.strictEqual(s2.proposed_description, null, 'part2: a blocked candidate proposes nothing');

  // (3) 5-iteration no-improvement -> converged:false, baseline kept.
  const noImprove = [{ iteration: 0, validation_pass_rate: 0.7, validation_passed_set: new Set(['a', 'b']) }];
  for (let i = 1; i <= 5; i++) noImprove.push({ iteration: i, validation_pass_rate: 0.6, validation_passed_set: new Set(['a']), description: 'worse ' + i });
  const s3 = selectBestIteration(noImprove);
  assert.strictEqual(s3.converged, false, 'part2: no improvement across 5 iterations must be converged:false');
  assert.strictEqual(s3.best_iteration, 0, 'part2: baseline is kept when nothing beats it');
  assert.strictEqual(s3.proposed_description, null, 'part2: non-convergence proposes nothing (baseline kept)');

  // The whole thing also produces a schema-valid LoopSummary with selected_by literal.
  const summaryFixture = {
    skill: 'beautiful-question', iterations_run: 5, best_iteration: 0,
    selected_by: 'validation_pass_rate', baseline_validation_rate: 0.7, best_validation_rate: 0.7,
    regressed_query_count: 0, converged: false, proposed_description: null,
  };
  assert.strictEqual(LoopSummarySchema.safeParse(summaryFixture).success, true, 'part2: LoopSummary fixture validates with selected_by validation_pass_rate');

  // (4) scratch checkout targeting skills/ is rejected by assertUnderOut.
  const bad = buildScratchCheckout('act', 'x', path.join(REPO_ROOT, 'skills', 'act'), { outRoot: path.join(REPO_ROOT, PHASE_OUT_DIR) });
  assert.strictEqual(bad.ok, false, 'part2: a scratch dir under skills/ must be rejected (CFM4 containment)');
  assert.strictEqual(bad.reason, 'scratch_outside_out', 'part2: containment reason is scratch_outside_out');

  // buildScratchCheckout rewrites ONLY the candidate SKILL.md inside a real out-sandbox
  // scratch (using an injected copyImpl - no heavy real clone).
  const baseOut = path.join(REPO_ROOT, PHASE_OUT_DIR);
  fs.mkdirSync(baseOut, { recursive: true });
  const tmpOut = fs.mkdtempSync(path.join(baseOut, '.selftest-scratch-'));
  try {
    const scratchDir = path.join(tmpOut, 'scratch', 'demo');
    const copyImpl = (_src, dst) => {
      fs.mkdirSync(path.join(dst, 'skills', 'demo'), { recursive: true });
      fs.writeFileSync(path.join(dst, 'skills', 'demo', 'SKILL.md'), '---\nname: demo\ndescription: OLD description\n---\nbody\n', 'utf8');
    };
    const okc = buildScratchCheckout('demo', 'NEW routing description', scratchDir, { copyImpl, outRoot: tmpOut, skillDir: 'demo' });
    assert.strictEqual(okc.ok, true, 'part2: a scratch dir under out/ is accepted');
    const rewritten = fs.readFileSync(okc.skillMdPath, 'utf8');
    assert.ok(/description: NEW routing description/.test(rewritten), 'part2: candidate description rewritten in the scratch SKILL.md');
    assert.ok(!/OLD description/.test(rewritten), 'part2: old description replaced');
    // The REAL skills/demo (does not exist) or skills/act must be untouched: assert path is under out.
    assert.ok(okc.skillMdPath.includes(path.sep + '.selftest-scratch-'), 'part2: rewrite happened under the out sandbox, never the real skills/ tree');
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  // Revise prompt carries TRAIN failures and NONE of the validation query strings.
  const reviseArgs = buildReviseArgs({
    skill: 'beautiful-question', currentDescription: 'old',
    siblings: [{ skill: 'find-connections', description: 'cross-domain patterns' }],
    trainFailures: [{ query: 'TRAIN-QUERY-alpha', expected: 'beautiful-question', actually_fired: 'nothing' }],
  }, {});
  const promptIdx = reviseArgs.indexOf('-p') + 1;
  const prompt = reviseArgs[promptIdx];
  assert.ok(prompt.includes('TRAIN-QUERY-alpha'), 'part2: revise prompt contains the train failure query');
  assert.ok(!prompt.includes('VALIDATION-QUERY'), 'part2: revise prompt must never contain a validation query string');
  assert.ok(reviseArgs.includes('--allowedTools') && reviseArgs[reviseArgs.indexOf('--allowedTools') + 1] === 'Read', 'part2: revise spawn is --allowedTools Read');
  assert.ok(reviseArgs.includes('--max-turns') && reviseArgs[reviseArgs.indexOf('--max-turns') + 1] === '2', 'part2: revise spawn is --max-turns 2');
  assert.ok(reviseArgs.includes('--json-schema'), 'part2: revise spawn carries an inline --json-schema');

  // A trigger arg vector points --plugin-dir under out/scratch and is stream-json --verbose.
  const trigVec = buildTriggerArgs('q', path.join(REPO_ROOT, PHASE_OUT_DIR, 'scratch', 'beautiful-question'), {});
  assert.strictEqual(assertStreamJsonArgs(trigVec).ok, true, 'part2: trigger vector is stream-json --verbose');
  const pdIdx = trigVec.indexOf('--plugin-dir') + 1;
  assert.ok(trigVec[pdIdx].includes(path.sep + 'scratch' + path.sep), 'part2: trigger --plugin-dir is a scratch checkout, never the repo skills/');

  // An end-to-end zero-spawn loop via injected measure + revise fixtures: baseline
  // weak, iteration 1 improves validation with no regression -> proposed, converged.
  const queries = [
    { query: 'train-pos-1', split: 'train', kind: 'should_trigger' },
    { query: 'train-neg-1', split: 'train', kind: 'should_not_trigger' },
    { query: 'val-pos-1', split: 'validation', kind: 'should_trigger' },
    { query: 'val-neg-1', split: 'validation', kind: 'should_not_trigger' },
  ];
  const canned = {
    0: { 'train-pos-1': 0.0, 'train-neg-1': 0.0, 'val-pos-1': 0.0, 'val-neg-1': 0.0 },
    1: { 'train-pos-1': 1.0, 'train-neg-1': 0.0, 'val-pos-1': 1.0, 'val-neg-1': 0.0 },
  };
  const measureImpl = async (q, iteration) => ({ runs: 3, fires: Math.round((canned[iteration][q.query] || 0) * 3), trigger_rate: canned[iteration][q.query] || 0, completed_runs: 3, not_evaluated_runs: 0 });
  const reviseImpl = async () => ({ skill: 'demo', iteration: 1, description: 'improved routing desc', rationale: 'targets train-pos-1 miss' });
  const scratchImpl = () => ({ ok: true });
  // Run without persistence and without a real scratch, single revision iteration.
  const loop = (async () => runLoopForSkill({
    skill: 'demo', queries, baselineDescription: 'weak', config: { maxIterations: 1 },
    measureImpl, reviseImpl, scratchImpl, _noWrite: true,
  }))();
  return loop.then((res) => {
    assert.strictEqual(res.summary.best_iteration, 1, 'part2: e2e loop selects the improving iteration 1');
    assert.strictEqual(res.summary.converged, true, 'part2: e2e loop converges on a clean win');
    assert.strictEqual(res.summary.regressed_query_count, 0, 'part2: e2e clean win has zero regression');
    assert.ok(res.summary.proposed_description, 'part2: e2e clean win proposes the improved description');
  });
}

// --------------------------------------------------------------------------
// runSelftest (Part 1) - fixture-driven, ZERO spawn, zero spend. The firing and
// non-firing fixtures are the REAL bytes captured live from this plugin (see the
// SKILL_FIRE_TOOL comment); they are also written to disk under out/captures/ by the
// live --capture path. Inline here so CI (tests/run-all-230.sh) is hermetic even
// though .planning/out is gitignored.
// --------------------------------------------------------------------------
function part1Fixtures() {
  // Real init + real assistant tool_use block (verbatim from firing-beautiful-question.jsonl),
  // wrapped in realistic hook/thinking noise so the corrupt-ratio logic is exercised.
  const firing = [
    JSON.stringify({ type: 'system', subtype: 'hook_started', hook_name: 'SessionStart:startup' }),
    JSON.stringify({ type: 'system', subtype: 'init', plugins: [{ name: 'mos' }, { name: 'superpowers' }], plugin_errors: undefined }),
    JSON.stringify({ type: 'system', subtype: 'thinking_tokens', tokens: 128 }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Let me reframe that.' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_01T8jHKF5yU2kQ25vKJv5zJm', name: SKILL_FIRE_TOOL, input: { command: 'beautiful-question', context: 'declining user retention' } }] } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', session_id: 'sess-fire', total_cost_usd: 0.04 }),
  ].join('\n') + '\n';

  const nonfiring = [
    JSON.stringify({ type: 'system', subtype: 'hook_started', hook_name: 'SessionStart:startup' }),
    JSON.stringify({ type: 'system', subtype: 'init', plugins: [{ name: 'mos' }], plugin_errors: undefined }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'I do not have live weather, but happy to chat.' }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', session_id: 'sess-nofire', total_cost_usd: 0.01 }),
  ].join('\n') + '\n';

  // A stream that is mostly garbage: > 20% unparseable -> jsonl_corrupt (never fired:false).
  const corrupt = [
    JSON.stringify({ type: 'system', subtype: 'init', plugins: [{ name: 'mos' }] }),
    '{ this is not valid json <<<',
    'neither is this line',
    '}}} broken',
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }),
  ].join('\n') + '\n';

  return { firing, nonfiring, corrupt };
}

function runSelftestPart1(assert) {
  const fx = part1Fixtures();

  // Firing fixture: fired:true, invoked the bare skill, with mos: tolerance.
  const dFire = detectSkillFire(fx.firing, 'beautiful-question');
  assert.strictEqual(dFire.ok, true, 'part1: firing fixture must parse cleanly');
  assert.strictEqual(dFire.fired, true, 'part1: firing fixture must fire beautiful-question');
  assert.strictEqual(dFire.invoked, 'beautiful-question', 'part1: invoked skill read from input.command');
  const dFireNs = detectSkillFire(fx.firing, 'mos:beautiful-question');
  assert.strictEqual(dFireNs.fired, true, 'part1: namespaced expected (mos:beautiful-question) must still match the bare fire');
  const dWrong = detectSkillFire(fx.firing, 'find-connections');
  assert.strictEqual(dWrong.fired, false, 'part1: a different expected skill must NOT count the beautiful-question fire');

  // Non-firing fixture: fired:false (and any-fire is false).
  const dNo = detectSkillFire(fx.nonfiring, 'beautiful-question');
  assert.strictEqual(dNo.ok, true, 'part1: non-firing fixture must parse cleanly');
  assert.strictEqual(dNo.fired, false, 'part1: non-firing fixture must not fire');
  assert.strictEqual(detectSkillFire(fx.nonfiring, null).fired, false, 'part1: non-firing any-fire is false');

  // Corrupt fixture: jsonl_corrupt, NOT a silent fired:false.
  const dCorrupt = detectSkillFire(fx.corrupt, 'beautiful-question');
  assert.strictEqual(dCorrupt.ok, false, 'part1: corrupt fixture must not parse ok');
  assert.strictEqual(dCorrupt.reason, 'jsonl_corrupt', 'part1: corrupt fixture reason must be jsonl_corrupt');
  assert.strictEqual(detectSkillFire('', 'x').reason, 'jsonl_corrupt', 'part1: empty input is jsonl_corrupt');

  // assertStreamJsonArgs: rejects a json-envelope vector, accepts a stream-json capture vector.
  const jsonVec = ['-p', 'q', '--output-format', 'json', '--verbose'];
  assert.strictEqual(assertStreamJsonArgs(jsonVec).ok, false, 'part1: --output-format json vector must be rejected (D7)');
  const capVec = buildCaptureArgs('q', {});
  assert.strictEqual(assertStreamJsonArgs(capVec).ok, true, 'part1: capture vector is stream-json --verbose');
  assert.strictEqual(assertStreamJsonArgs(['-p', 'q', '--output-format', 'stream-json']).ok, false, 'part1: stream-json without --verbose must be rejected');

  // preflight failure path returns ok:false and runCapture then never spawns.
  const badInitSpawn = () => ({ status: 0, stdout: JSON.stringify({ type: 'system', subtype: 'init', plugins: [] }) + '\n' });
  const pfBad = preflightPluginLoad({ spawnImpl: badInitSpawn });
  assert.strictEqual(pfBad.ok, false, 'part1: preflight with no mos plugin must fail closed');
  assert.strictEqual(pfBad.reason, 'plugin_not_loaded', 'part1: reason is plugin_not_loaded');
  let captureSpawnCalls = 0;
  const cap = runCapture({
    skill: 'beautiful-question', query: 'q',
    preflightSpawnImpl: badInitSpawn,
    spawnImpl: () => { captureSpawnCalls += 1; return { status: 0, stdout: '' }; },
  });
  assert.strictEqual(cap.ok, false, 'part1: runCapture must abort on failed preflight');
  assert.strictEqual(cap.spawned, false, 'part1: no capture spawn after a failed preflight');
  assert.strictEqual(captureSpawnCalls, 0, 'part1: capture spawnImpl must not be called after failed preflight');

  // A good preflight lets runCapture spawn + write under out/ (guarded), using a fake spawn.
  const goodInitSpawn = () => ({ status: 0, stdout: JSON.stringify({ type: 'system', subtype: 'init', plugins: [{ name: 'mos' }] }) + '\n' });
  const baseOut = path.join(REPO_ROOT, PHASE_OUT_DIR);
  fs.mkdirSync(baseOut, { recursive: true });
  const tmpOut = fs.mkdtempSync(path.join(baseOut, '.selftest-capture-'));
  try {
    const capOk = runCapture({
      skill: 'beautiful-question', query: 'q', outDir: tmpOut,
      preflightSpawnImpl: goodInitSpawn,
      spawnImpl: () => ({ status: 0, stdout: fx.firing }),
    });
    assert.strictEqual(capOk.ok, true, 'part1: runCapture succeeds after a good preflight');
    assert.strictEqual(capOk.fired, true, 'part1: runCapture detector sees the fire');
    assert.ok(fs.existsSync(capOk.path), 'part1: capture file written under out/');
    assert.ok(capOk.path.includes(path.sep + 'captures' + path.sep), 'part1: capture lands in out/captures/');
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  // If the REAL live captures are on disk, assert the detector against them too (belt).
  const realFiring = path.join(baseOut, 'captures', 'firing-beautiful-question.jsonl');
  const realNonfiring = path.join(baseOut, 'captures', 'nonfiring-weather.jsonl');
  if (fs.existsSync(realFiring)) {
    const d = detectSkillFire(fs.readFileSync(realFiring, 'utf8'), 'beautiful-question');
    assert.strictEqual(d.fired, true, 'part1: REAL firing capture must fire beautiful-question');
    assert.strictEqual(d.invoked, 'beautiful-question', 'part1: REAL firing capture invoked read from input.command');
  }
  if (fs.existsSync(realNonfiring)) {
    const d = detectSkillFire(fs.readFileSync(realNonfiring, 'utf8'), 'beautiful-question');
    assert.strictEqual(d.fired, false, 'part1: REAL non-firing capture must not fire');
  }
}

// --------------------------------------------------------------------------
// main - switch-case argv router (gsd-tools.cjs pattern), no Commander/yargs.
//   --selftest                     fixture-driven, no spawn, exit
//   --capture <skill> <query...>   ONE live stream-json capture -> out/captures/<skill>.jsonl
//   --dry-run                      print a trigger arg vector, spawn NOTHING
//   --skills <csv>                 flagged skills to loop (Task 2)
//   --out <dir>                    out directory (default PHASE_OUT_DIR)
//   --max-iterations <n>           revision iterations (default 5, hard cap 5)
//   --runs-per-query <n>           runs per query (default 3)
// --------------------------------------------------------------------------
async function main(argv) {
  const args = argv.slice(2);

  if (args.includes('--selftest')) {
    const assert = require('node:assert');
    runSelftestPart1(assert);
    await runSelftestPart2(assert);
    console.log('OK - skillopt-triggerloop self-test passed: detector (fire/no-fire/corrupt) pinned from live captures, stream-json guard, preflight fail-closed, loop best-by-validation + regression block + non-convergence + scratch containment.');
    return;
  }

  let outDir = path.join(REPO_ROOT, PHASE_OUT_DIR);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && args[outIdx + 1]) outDir = path.resolve(args[outIdx + 1]);

  let skills = null;
  const skIdx = args.indexOf('--skills');
  if (skIdx >= 0 && args[skIdx + 1]) skills = args[skIdx + 1].split(',').map((s) => s.trim()).filter(Boolean);

  let maxIterations = 5;
  const miIdx = args.indexOf('--max-iterations');
  if (miIdx >= 0 && args[miIdx + 1]) maxIterations = parseInt(args[miIdx + 1], 10) || 5;

  let runsPerQuery = 3;
  const rpIdx = args.indexOf('--runs-per-query');
  if (rpIdx >= 0 && args[rpIdx + 1]) runsPerQuery = parseInt(args[rpIdx + 1], 10) || 3;

  const config = { maxIterations, runsPerQuery };

  if (args.includes('--capture')) {
    const ci = args.indexOf('--capture');
    const skill = args[ci + 1];
    const query = args.slice(ci + 2).filter((a) => !a.startsWith('--')).join(' ');
    if (!skill || !query) { console.error('usage: --capture <skill> <query...>'); process.exit(2); }
    const r = runCapture({ skill, query, outDir, config });
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exit(1);
    return;
  }

  if (args.includes('--dry-run')) {
    const sampleSkill = (skills && skills[0]) || 'beautiful-question';
    const scratchDir = path.join(outDir, 'scratch', safeStem(sampleSkill));
    const vec = buildTriggerArgs('sample trigger query for ' + sampleSkill, scratchDir, config);
    console.log('# dry-run triggerloop skills=' + (skills ? skills.join(',') : 'all-flagged') + ' max-iterations=' + resolveTriggerConfig(config).maxIterations + ' runs-per-query=' + resolveTriggerConfig(config).runsPerQuery);
    console.log(JSON.stringify(vec));
    if (typeof buildReviseArgs === 'function') {
      const rv = buildReviseArgs({ skill: sampleSkill, currentDescription: 'old', trainFailures: [{ query: 'q', expected: sampleSkill, actually_fired: 'null' }] }, config);
      console.log(JSON.stringify(rv));
    }
    return;
  }

  if (typeof runLoopForSkill !== 'function') {
    console.error('skillopt-triggerloop: live loop requires the flagged funnel results and is gated to the smoke opt-in (Task 2 wiring).');
    process.exit(2);
  }
  // Live loop entry is wired in Task 2 (runLoopsFromFunnel).
  await runLoopsFromFunnel({ outDir, skills, config });
}

module.exports = {
  // Part 1 (Task 1)
  preflightPluginLoad,
  detectSkillFire,
  extractInvokedSkill,
  assertStreamJsonArgs,
  buildCaptureArgs,
  buildTriggerArgs,
  runCapture,
  makeTriggerUnitRecord,
  normalizeSkillName,
  resolveTriggerConfig,
  SKILL_FIRE_TOOL,
  SKILL_INPUT_FIELD,
  NATIVE_SKILL_TOOL,
  PINNED_TRIGGER_MODEL,
  writeAtomic,
  safeStem,
  // Part 2 (Task 2)
  buildScratchCheckout,
  runTriggerQuery,
  runLoopForSkill,
  runLoopsFromFunnel,
  selectBestIteration,
  measureIteration,
  queryPasses,
  buildRevisePrompt,
  buildReviseArgs,
  runPool,
};

if (require.main === module) {
  main(process.argv).catch((e) => { console.error('FATAL skillopt-triggerloop:', e && e.message || e); process.exit(1); });
}
