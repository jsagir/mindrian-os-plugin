#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-06, Task 2 (bypass 5 of F6, D-08): every Theo tool name has a
 * declared class, content tools are scanned, operational tools are allowed by
 * class, and the hook sees every Theo route.
 *
 * Why it failed on beta.81: the three matchers saw only the six brain_* names
 * on any server plus the mindrian-brain and pws-brain-mcp server keys, so a
 * Theo tool such as search or text2cypher on the `theo` stdio server reached
 * the wire with no hook (MAPS.md map 2, route B1). The guard had typed arms
 * for 9 tool shapes and the two freeform typed tools (search,
 * classify_problem_type); every other content tool ended ambiguous, and no
 * tool was classified operational, so a room_bind on a Theo route would have
 * been gated like a leak.
 *
 * Part 8: every string in this file is invented. The room is the synthetic
 * gate-lexgen room of tests/helpers/synthetic-room-db.cjs (venture name
 * "Brightmoor Kiln", invented). No real room word, room file name or Brain
 * identifier appears here.
 *
 * Cases:
 *   B0  data/theo-tool-classes.json exists: schema_version 1, source, a
 *       classes map whose values are content | operational | auth; counts
 *       printed.
 *   B1  every registered tool name of Theo's catalog (/home/jsagi/Theo/src/mcp,
 *       or MINDRIAN_THEO_CHECKOUT) has a class; the names under
 *       src/mcp/operational are operational; the names under src/mcp/content
 *       are content. SKIP for the live read when the checkout is absent; the
 *       table's own names are then checked for the floor (40 or more).
 *   B2  the connector tool names of MAPS.md map 2 (theo-context, Theo-Claude)
 *       are in the table as content.
 *   B3  the guard exports _theoToolClass: operational, content, unknown name
 *       is content, brain_write is content.
 *   B4  the matcher sees every Theo route (the host simulation: the hook only
 *       runs when BRAIN_SHAPED_TOOL_MATCHER matches).
 *   B5  hook: mcp__theo__search with a room paragraph exits 2.
 *   B6  hook: mcp__theo__text2cypher with a generic cypher and a paragraph
 *       under params exits 2 (the 392-05 walker reaches params).
 *   B7  hook: mcp__theo__room_bind {room} exits 0; classify answers allow,
 *       class operational_tool.
 *   B8  hook: mcp__theo-context__canon_search with a generic query exits 0;
 *       with a paragraph exits 2.
 *   B9  brain_write stays write_blocked on every Theo route (plan 386-04).
 *   B10 the generic content arm: a content tool with no typed arm is decided
 *       by the free-form rules, never ambiguous when it carries a string; a
 *       string past the 256 character cap blocks; a no-string payload keeps
 *       the ambiguous verdict (fail closed toward the gate).
 *   B11 timing: the class lookup adds under 5 ms per classify call (mean over
 *       20 tool names); the hook wall time on a 20-name sample stays under
 *       the 2,000 ms budget per call (mean and max printed).
 *
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const SANITIZER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-response-sanitize.cjs');
const HOOK_PATH = path.join(REPO_ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const TABLE_PATH = path.join(REPO_ROOT, 'data', 'theo-tool-classes.json');
const THEO_MCP_DIR = path.join(process.env.MINDRIAN_THEO_CHECKOUT || '/home/jsagi/Theo', 'src', 'mcp');

// Isolate HOME and the room registry before any plugin module loads.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-06-b5-'));
fs.mkdirSync(path.join(TMP, 'home'));
fs.mkdirSync(path.join(TMP, 'registry'));
process.env.HOME = path.join(TMP, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');

const loader = require(path.join(REPO_ROOT, 'tests', 'helpers', 'audit-probe-loader.cjs'));

const CLASSES = ['content', 'operational', 'auth'];
const ROOM_WORD = 'Brightmoor Kiln';
const GENERIC = 'jobs to be done';
// 3 sentences, one room word, no forbidden pattern (no company suffix, no
// money, no address): the default-deny scan of step 1 clears it on purpose.
const PARAGRAPH = ROOM_WORD + ' signed the first draft of the plan last spring. ' +
  'The second paragraph covers the market size. The third paragraph covers the pricing tiers.';
const GENERIC_CYPHER = 'MATCH (f:Framework) RETURN f.name LIMIT 5';

// The connector names of MAPS.md map 2 (theo-context 14, Theo-Claude 15),
// read from ~/dev/theo-context-fit/server.js and ~/dev/theo-claude/theo-core.js.
const CONNECTOR_NAMES = [
  'canon_search', 'framework_connection', 'framework_route', 'framework_steps', 'problem_lenses',
  'glossary_taxonomy', 'framework_walkthrough', 'concept_relations', 'framework_concepts',
  'larry_move', 'framework_cards', 'prepare_feedback', 'review_guide', 'show_theo_face',
  'practitioner_workspace', 'normalize_framework_name',
];

// The 20-name sample for the timing arms: Theo content and operational names
// on three routes, plus two unknown names (resolve to content).
const SAMPLE_NAMES = [
  'mcp__theo__search', 'mcp__theo__text2cypher', 'mcp__theo__recommend_chain', 'mcp__theo__case_story',
  'mcp__theo__framework_neighborhood', 'mcp__theo__find_connections', 'mcp__theo__taxonomy_ladder',
  'mcp__theo__room_bind', 'mcp__theo__graph_write', 'mcp__theo__gate_render', 'mcp__theo__chain_run',
  'mcp__theo-context__canon_search', 'mcp__theo-context__framework_route', 'mcp__theo-context__problem_lenses',
  'mcp__claude_ai_Theo-Claude__canon_search', 'mcp__claude_ai_theo-claude__glossary_taxonomy',
  'mcp__claude_ai_PWS_Brain__brain_ask', 'mcp__theo__theo_health',
  'mcp__theo__brand_new_tool', 'mcp__theo-context__another_new_tool',
];

let passed = 0;
let failed = 0;
let skipped = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL - ' + name);
    console.error('    ' + (err && err.message ? err.message : err));
  }
}
function skip(name, why) {
  skipped += 1;
  console.log('  SKIP - ' + name + ' (' + why + ')');
}

function freshGuard() {
  delete require.cache[GUARD_PATH];
  return require(GUARD_PATH);
}

function noText(v) {
  const s = JSON.stringify(v);
  return s.indexOf('Brightmoor') === -1 && s.indexOf('paragraph') === -1 && s.indexOf('pricing') === -1;
}

/** Every `export const X_NAME = '<name>'` under a Theo src/mcp directory. */
function theoNamesUnder(dir) {
  const names = new Set();
  if (!fs.existsSync(dir)) return names;
  const re = /export const [A-Z0-9_]+_NAME\s*(?::[^=]+)?=\s*['"]([a-z0-9_]+)['"]/g;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && /\.ts$/.test(ent.name) && !/\.test\.ts$/.test(ent.name)) {
        const src = fs.readFileSync(p, 'utf8');
        let m;
        while ((m = re.exec(src)) !== null) names.add(m[1]);
      }
    }
  };
  walk(dir);
  return names;
}

function readTable() {
  return JSON.parse(fs.readFileSync(TABLE_PATH, 'utf8'));
}

function runHook(toolName, toolInput, env) {
  return spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, session_id: 't392b5' }),
    encoding: 'utf8',
    timeout: 10000,
    env: Object.assign({}, process.env, { PART8_FORCE_BRAIN_AVAILABLE: '1' }, env || {}),
  });
}

console.log('Plan 392-06 Task 2: bypass 5, Theo tool classes and arms\n');

const guard = freshGuard();
const sanitizer = require(SANITIZER_PATH);
const rooms = loader.makeRooms(path.join(TMP, 'rooms'), REPO_ROOT);
const roomDir = rooms.roomFor('gate-lexgen');
const hookEnv = { CLAUDE_ACTIVE_ROOM: roomDir };
let table = null;

check('B0 data/theo-tool-classes.json: schema_version 1, source, classes map with closed values', function () {
  assert.ok(fs.existsSync(TABLE_PATH), 'table missing at ' + path.relative(REPO_ROOT, TABLE_PATH));
  table = readTable();
  assert.strictEqual(table.schema_version, 1, 'schema_version is not 1');
  assert.ok(table.source && typeof table.source === 'object', 'source missing');
  assert.ok(typeof table.source.theo_head === 'string' && /^[0-9a-f]{7,40}$/.test(table.source.theo_head), 'source.theo_head is not a sha');
  assert.ok(table.classes && typeof table.classes === 'object' && !Array.isArray(table.classes), 'classes is not an object');
  assert.strictEqual(table.default_class, 'content', 'default_class is not content');
  assert.deepStrictEqual(table.retired_servers, ['pws-brain-mcp'], 'retired_servers is not [pws-brain-mcp]');
  const counts = { content: 0, operational: 0, auth: 0 };
  for (const name of Object.keys(table.classes)) {
    assert.ok(/^[a-z][a-z0-9_]*$/.test(name), 'name is not a tool name: ' + name);
    const c = table.classes[name];
    assert.ok(CLASSES.indexOf(c) !== -1, name + ' has a class outside the closed set: ' + c);
    counts[c] += 1;
  }
  console.log('    classes: content ' + counts.content + ', operational ' + counts.operational + ', auth ' + counts.auth + ', total ' + Object.keys(table.classes).length);
  assert.ok(counts.operational >= 5, 'fewer than 5 operational names');
});

if (fs.existsSync(THEO_MCP_DIR)) {
  check('B1 every registered Theo tool name has a class; operational and content directories agree with the table', function () {
    assert.ok(table, 'table not loaded');
    const content = theoNamesUnder(path.join(THEO_MCP_DIR, 'content'));
    const operational = theoNamesUnder(path.join(THEO_MCP_DIR, 'operational'));
    const health = new Set();
    const healthPath = path.join(THEO_MCP_DIR, 'health.ts');
    const healthSrc = fs.existsSync(healthPath) ? fs.readFileSync(healthPath, 'utf8') : '';
    const hm = /export const [A-Z0-9_]+_NAME\s*(?::[^=]+)?=\s*['"]([a-z0-9_]+)['"]/.exec(healthSrc);
    if (hm) health.add(hm[1]);
    assert.ok(content.size >= 40, 'live content catalog read ' + content.size + ' names (expected 40 or more)');
    assert.ok(operational.size >= 5, 'live operational catalog read ' + operational.size + ' names (expected 5 or more)');
    const missing = [];
    const wrong = [];
    for (const n of content) {
      if (!(n in table.classes)) missing.push(n);
      else if (table.classes[n] !== 'content') wrong.push(n + ':' + table.classes[n]);
    }
    for (const n of operational) {
      if (!(n in table.classes)) missing.push(n);
      else if (table.classes[n] !== 'operational') wrong.push(n + ':' + table.classes[n]);
    }
    for (const n of health) {
      if (!(n in table.classes)) missing.push(n);
    }
    assert.deepStrictEqual(missing, [], 'Theo names without a class: ' + missing.join(', '));
    assert.deepStrictEqual(wrong, [], 'Theo names with the wrong class: ' + wrong.join(', '));
    console.log('    live Theo catalog: content ' + content.size + ', operational ' + operational.size + ', health ' + health.size);
  });
} else {
  skip('B1 live Theo catalog read', 'checkout absent at ' + THEO_MCP_DIR);
  check('B1b the table carries the catalog floor without the live read', function () {
    assert.ok(table, 'table not loaded');
    assert.ok(Object.keys(table.classes).length >= 40, 'table names ' + Object.keys(table.classes).length + ' (expected 40 or more)');
  });
}

check('B2 the connector tool names of MAPS.md map 2 are in the table as content', function () {
  assert.ok(table, 'table not loaded');
  const missing = CONNECTOR_NAMES.filter((n) => table.classes[n] !== 'content');
  assert.deepStrictEqual(missing, [], 'connector names missing or not content: ' + missing.join(', '));
});

check('B3 _theoToolClass: operational, content, unknown is content, brain_write is content', function () {
  assert.strictEqual(typeof guard._theoToolClass, 'function', '_theoToolClass is not exported');
  assert.strictEqual(guard._theoToolClass('mcp__theo__room_bind'), 'operational');
  assert.strictEqual(guard._theoToolClass('mcp__theo__graph_write'), 'operational');
  assert.strictEqual(guard._theoToolClass('mcp__theo__gate_answer'), 'operational');
  assert.strictEqual(guard._theoToolClass('mcp__theo__chain_run'), 'operational');
  assert.strictEqual(guard._theoToolClass('mcp__theo__search'), 'content');
  assert.strictEqual(guard._theoToolClass('mcp__theo-context__canon_search'), 'content');
  assert.strictEqual(guard._theoToolClass('mcp__claude_ai_Theo-Claude__framework_route'), 'content');
  assert.strictEqual(guard._theoToolClass('mcp__theo__brand_new_tool'), 'content', 'an unknown name must resolve to content');
  assert.strictEqual(guard._theoToolClass('mcp__theo__brain_write'), 'content');
  assert.strictEqual(guard._theoToolClass('mcp__plugin_mos_mindrian-brain__brain_ask'), 'content');
  assert.strictEqual(guard._theoToolClass(''), 'content');
  assert.strictEqual(guard._theoToolClass(null), 'content');
});

check('B4 the matcher sees every Theo route (host simulation)', function () {
  const seen = ['mcp__theo__search', 'mcp__theo__text2cypher', 'mcp__theo__room_bind', 'mcp__theo-context__canon_search',
    'mcp__claude_ai_Theo-Claude__canon_search', 'mcp__claude_ai_theo-claude__canon_search',
    'mcp__claude_ai_PWS_Brain__brain_ask', 'mcp__claude_ai_PWS_brain__brain_ask', 'mcp__Theo__search'];
  const unseen = seen.filter((n) => !sanitizer.isBrainShapedTool(n));
  assert.deepStrictEqual(unseen, [], 'the matcher does not see: ' + unseen.join(', '));
  assert.strictEqual(sanitizer.isBrainShapedTool('mcp__notion__search'), false, 'the control must not match');
  assert.strictEqual(sanitizer.isBrainShapedTool('mcp__mindrian-os__room_bind'), false, 'the local mindrian-os server must not match');
  assert.strictEqual(sanitizer.isBrainShapedTool('mcp__plugin_mos_mindrian-os__graph_write'), false, 'the plugin-scoped local server must not match');
});

check('B5 hook: mcp__theo__search with a room paragraph exits 2', function () {
  assert.ok(sanitizer.isBrainShapedTool('mcp__theo__search'), 'the host would not run the hook for mcp__theo__search');
  const r = runHook('mcp__theo__search', { query: PARAGRAPH }, hookEnv);
  assert.strictEqual(r.status, 2, 'exit ' + r.status + ', stderr: ' + String(r.stderr).slice(0, 200));
  assert.ok(/Canon Part 8/.test(String(r.stderr)), 'stderr does not name Part 8: ' + String(r.stderr).slice(0, 200));
  assert.ok(/room_content|content_set|sprouts_required/.test(String(r.stderr)), 'stderr names no class: ' + String(r.stderr).slice(0, 200));
  assert.ok(noText(String(r.stderr)), 'stderr carries payload text');
});

check('B6 hook: mcp__theo__text2cypher with a generic cypher and a paragraph under params exits 2', function () {
  assert.ok(sanitizer.isBrainShapedTool('mcp__theo__text2cypher'), 'the host would not run the hook for mcp__theo__text2cypher');
  const r = runHook('mcp__theo__text2cypher', { cypher: GENERIC_CYPHER, params: { x: PARAGRAPH } }, hookEnv);
  assert.strictEqual(r.status, 2, 'exit ' + r.status + ', stderr: ' + String(r.stderr).slice(0, 200));
  assert.ok(noText(String(r.stderr)), 'stderr carries payload text');
  const v = guard.classify({ cypher: GENERIC_CYPHER, params: { x: PARAGRAPH } }, { toolName: 'mcp__theo__text2cypher', roomDir: roomDir });
  assert.strictEqual(v.verdict, 'block', 'classify did not block: ' + JSON.stringify(v));
  assert.ok(noText(v), 'verdict carries text: ' + JSON.stringify(v));
});

check('B7 hook: mcp__theo__room_bind {room} exits 0; classify answers allow, class operational_tool', function () {
  assert.ok(sanitizer.isBrainShapedTool('mcp__theo__room_bind'), 'the host would not run the hook for mcp__theo__room_bind');
  const r = runHook('mcp__theo__room_bind', { room: 'synthetic-room' }, hookEnv);
  assert.strictEqual(r.status, 0, 'exit ' + r.status + ', stderr: ' + String(r.stderr).slice(0, 200));
  const v = guard.classify({ room: 'synthetic-room' }, { toolName: 'mcp__theo__room_bind', roomDir: roomDir });
  assert.strictEqual(v.verdict, 'allow', 'room_bind not allowed: ' + JSON.stringify(v));
  assert.strictEqual(v.class, 'operational_tool', 'class is not operational_tool: ' + JSON.stringify(v));
  // Room content by design: a paragraph under an operational tool is not scanned.
  const w = guard.classify({ room: 'synthetic-room', note: PARAGRAPH }, { toolName: 'mcp__theo__graph_write', roomDir: roomDir });
  assert.strictEqual(w.verdict, 'allow', 'graph_write with room content not allowed: ' + JSON.stringify(w));
  assert.strictEqual(w.class, 'operational_tool');
  assert.ok(noText(w), 'verdict carries text: ' + JSON.stringify(w));
});

check('B8 hook: mcp__theo-context__canon_search with a generic query exits 0; with a paragraph exits 2', function () {
  assert.ok(sanitizer.isBrainShapedTool('mcp__theo-context__canon_search'), 'the host would not run the hook');
  const a = runHook('mcp__theo-context__canon_search', { query: GENERIC }, hookEnv);
  assert.strictEqual(a.status, 0, 'generic query exit ' + a.status + ', stderr: ' + String(a.stderr).slice(0, 200));
  const av = guard.classify({ query: GENERIC }, { toolName: 'mcp__theo-context__canon_search', roomDir: roomDir });
  assert.strictEqual(av.verdict, 'allow', 'generic query not allowed: ' + JSON.stringify(av));
  assert.ok(av.class === 'typed_question' || av.class === 'generic_question', 'class: ' + av.class);
  const b = runHook('mcp__theo-context__canon_search', { query: PARAGRAPH }, hookEnv);
  assert.strictEqual(b.status, 2, 'paragraph exit ' + b.status + ', stderr: ' + String(b.stderr).slice(0, 200));
});

check('B9 brain_write stays write_blocked on every Theo route', function () {
  for (const n of ['mcp__theo__brain_write', 'mcp__claude_ai_PWS_Brain__brain_write', 'mcp__plugin_mos_mindrian-brain__brain_write']) {
    const v = guard.classify({ question: GENERIC }, { toolName: n, roomDir: null });
    assert.strictEqual(v.verdict, 'block', n + ': ' + JSON.stringify(v));
    assert.strictEqual(v.class, 'write_blocked', n + ': ' + JSON.stringify(v));
  }
});

check('B10 the generic content arm: decided by the free-form rules, 256 cap, no-string payload stays ambiguous', function () {
  // A content tool with no typed arm and a generic handle string: allow, never ambiguous.
  const a = guard.classify({ term: GENERIC }, { toolName: 'mcp__theo__brand_new_tool', roomDir: roomDir });
  assert.notStrictEqual(a.verdict, 'ambiguous', 'unknown content tool with a generic string is ambiguous: ' + JSON.stringify(a));
  assert.strictEqual(a.verdict, 'allow', 'generic string not allowed: ' + JSON.stringify(a));
  // The same tool with a room paragraph: block, with the key path and no text.
  const b = guard.classify({ term: PARAGRAPH }, { toolName: 'mcp__theo__brand_new_tool', roomDir: roomDir });
  assert.strictEqual(b.verdict, 'block', 'paragraph not blocked: ' + JSON.stringify(b));
  assert.ok(noText(b), 'verdict carries text: ' + JSON.stringify(b));
  // A Theo content tool with no typed arm (find_chapter_for_need carries a need string).
  const c = guard.classify({ need: GENERIC }, { toolName: 'mcp__theo__find_chapter_for_need', roomDir: roomDir });
  assert.strictEqual(c.verdict, 'allow', 'find_chapter_for_need with a generic need: ' + JSON.stringify(c));
  // A tool WITH a typed arm keeps its fail-closed posture: an extra key stays ambiguous (plan 386-25, TB2).
  const c2 = guard.classify({ query: GENERIC, extra: 'x' }, { toolName: 'mcp__theo__search', roomDir: roomDir });
  assert.strictEqual(c2.verdict, 'ambiguous', 'search with an extra key is not ambiguous: ' + JSON.stringify(c2));
  // A string past the cap blocks even when every word is generic.
  const long = Array(60).fill('jobs to be done').join(' ');
  assert.ok(long.length > 256, 'fixture is not past the cap');
  const d = guard.classify({ term: long }, { toolName: 'mcp__theo__brand_new_tool', roomDir: roomDir });
  assert.strictEqual(d.verdict, 'block', 'string past the cap not blocked: ' + JSON.stringify(d));
  assert.ok(/cap|over|long/.test(String(d.reason) + String(d.token_class) + String(d.shape_reason)), 'reason does not name the cap: ' + JSON.stringify(d));
  // A payload with no string keeps the ambiguous verdict (the gate decides).
  const e = guard.classify({ limit: 5 }, { toolName: 'mcp__theo__brand_new_tool', roomDir: roomDir });
  assert.strictEqual(e.verdict, 'ambiguous', 'no-string payload is not ambiguous: ' + JSON.stringify(e));
  // The existing typed arms are unchanged: a canonical handle still allows by shape.
  const f = guard.classify({ framework: 'Six Thinking Hats' }, { toolName: 'mcp__theo__framework_neighborhood', roomDir: roomDir });
  assert.strictEqual(f.verdict, 'allow', 'framework_neighborhood handle: ' + JSON.stringify(f));
});

check('B11 timing: class lookup under 5 ms per call; hook wall time under 2,000 ms on the 20-name sample', function () {
  // Warm-up, then the mean of one classify per sample name.
  guard.classify({ framework: 'Six Thinking Hats' }, { toolName: SAMPLE_NAMES[0], roomDir: null });
  const t0 = process.hrtime.bigint();
  for (const n of SAMPLE_NAMES) guard.classify({ framework: 'Six Thinking Hats' }, { toolName: n, roomDir: null });
  const perCall = Number(process.hrtime.bigint() - t0) / 1e6 / SAMPLE_NAMES.length;
  console.log('    classify with the class lookup: ' + perCall.toFixed(2) + ' ms per call (mean of ' + SAMPLE_NAMES.length + ')');
  assert.ok(perCall < 5, 'class lookup adds ' + perCall.toFixed(2) + ' ms per call (limit 5 ms)');

  const times = [];
  for (const n of SAMPLE_NAMES) {
    const s = process.hrtime.bigint();
    const r = runHook(n, { framework: 'Six Thinking Hats' }, hookEnv);
    times.push(Number(process.hrtime.bigint() - s) / 1e6);
    assert.ok(r.status === 0 || r.status === 2, n + ' hook exit ' + r.status);
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const max = Math.max.apply(null, times);
  console.log('    hook wall time on ' + times.length + ' names: mean ' + mean.toFixed(0) + ' ms, max ' + max.toFixed(0) + ' ms');
  assert.ok(max < 2000, 'hook wall time max ' + max.toFixed(0) + ' ms (budget 2,000 ms)');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
process.exit(failed === 0 ? 0 : 1);
