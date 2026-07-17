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
// PART 2 (Task 2) is appended below this line: buildScratchCheckout,
// runTriggerQuery, runLoopForSkill, best-by-validation selection.
// ==========================================================================

/* eslint-disable no-unused-vars */
// Placeholders wired in Task 2 (kept exported so downstream requires are stable).
let runTriggerQuery = null;
let runLoopForSkill = null;
let buildScratchCheckout = null;
/* eslint-enable no-unused-vars */

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
    if (typeof runSelftestPart2 === 'function') runSelftestPart2(assert);
    console.log('OK - skillopt-triggerloop self-test passed: detector (fire/no-fire/corrupt) pinned from live captures, stream-json guard, preflight fail-closed' + (typeof runSelftestPart2 === 'function' ? ', loop best-by-validation + regression block + non-convergence + scratch containment.' : '.'));
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
};

if (require.main === module) {
  main(process.argv).catch((e) => { console.error('FATAL skillopt-triggerloop:', e && e.message || e); process.exit(1); });
}
