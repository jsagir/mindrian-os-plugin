#!/usr/bin/env node
'use strict';

/**
 * Phase 386 plan 27 (E-AMB): the sprouts_required outcome on the hook,
 * callTool and query().
 *
 * Owner decision option-e (plan 386-26, 2026-11-06): a bare block or a send does
 * not work for contextualised work. A call that carries an edge or a body of
 * text is answered with the typed outcome sprouts_required (plain 5 step split
 * guide, names the sprout route). It never sends, never echoes the text. A call
 * whose strings are all sprouts keeps proceeding with the disclosure.
 *
 * Arms SP1 to SP8. Fixture strings are synthetic. Fake secrets are not needed.
 * A fetch stub counts every wire call. No network, no real room. Node built-ins
 * only. No em dash, no en dash.
 *
 * Doubles:
 *   in process: the part8-egress-guard module object is patched so classify and
 *     theoVerdict return a scripted verdict (DOUBLE) and fall through to the real
 *     guard when DOUBLE is null.
 *   hook child: a node --require preload patches the same functions from the
 *     env var T386_VERDICT (JSON).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HOOK = path.join(REPO, 'scripts', 'part8-egress-guard-hook.cjs');
const GUARD_PATH = path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs');
const CLIENT_PATH = path.join(REPO, 'lib', 'core', 'brain-client.cjs');
const SPLIT_PATH = path.join(REPO, 'lib', 'core', 'part8-split-route.cjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-27-'));
process.env.HOME = TMP;
delete process.env.CLAUDE_ACTIVE_ROOM;
process.env.MINDRIAN_BRAIN_URL = 'http://brain-stub.invalid';
process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real-386-27';
process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';

// ---------------------------------------------------------------------------
// Fetch stub with a counter.
// ---------------------------------------------------------------------------
const wire = [];
globalThis.fetch = async function stubFetch(url, init) {
  const body = init && typeof init.body === 'string' ? init.body : '';
  wire.push({ url: String(url), body: body });
  let method = '';
  try { method = JSON.parse(body).method; } catch (_e) { method = ''; }
  if (method === 'initialize') {
    return { ok: true, status: 200, headers: new Map(), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  }
  const payload = { jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: JSON.stringify({ answer: 'STUB framework guidance' }) }] } };
  return {
    ok: true,
    status: 200,
    headers: new Map(),
    text: async () => 'event: message\ndata: ' + JSON.stringify(payload) + '\n',
    arrayBuffer: async () => new ArrayBuffer(0),
  };
};
function resetWire() { wire.length = 0; }

// ---------------------------------------------------------------------------
// The in-process classify double.
// ---------------------------------------------------------------------------
const guard = require(GUARD_PATH);
const realClassify = guard.classify;
const realTheo = guard.theoVerdict;
let DOUBLE = null;
guard.classify = function (args, opts) {
  if (DOUBLE) return typeof DOUBLE === 'function' ? DOUBLE(args, opts) : DOUBLE;
  return realClassify.call(guard, args, opts);
};
guard.theoVerdict = function (args, opts) {
  if (DOUBLE) return typeof DOUBLE === 'function' ? DOUBLE(args, opts) : DOUBLE;
  return realTheo.call(guard, args, opts);
};

function freshClient() {
  delete require.cache[CLIENT_PATH];
  return require(CLIENT_PATH);
}
const SPLIT = require(SPLIT_PATH);

// ---------------------------------------------------------------------------
// The hook child runner and its preload double.
// ---------------------------------------------------------------------------
const PRELOAD = path.join(TMP, 'preload-double.cjs');
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  "const g = require(" + JSON.stringify(GUARD_PATH) + ");",
  "if (process.env.T386_VERDICT) {",
  "  const v = JSON.parse(process.env.T386_VERDICT);",
  "  g.classify = function () { return v; };",
  "}",
  '',
].join('\n'));

function runHook(toolName, toolInput, extraEnv, scripted) {
  const env = Object.assign({}, process.env, extraEnv || {});
  delete env.T386_VERDICT;
  const args = [];
  if (scripted) {
    env.T386_VERDICT = JSON.stringify(scripted);
    args.push('--require', PRELOAD);
  }
  args.push(HOOK);
  const stdin = JSON.stringify({ tool_name: toolName, tool_input: toolInput, session_id: 's386-27' });
  const res = spawnSync(process.execPath, args, { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '' };
}

const PLUGIN = 'mcp__plugin_mos_mindrian-brain__';
const DIRECT = 'mcp__pws-brain-mcp__';
const BRAIN_ON = { PART8_FORCE_BRAIN_AVAILABLE: '1' };
const BRAIN_OFF = { PART8_FORCE_BRAIN_AVAILABLE: '0' };

// Synthetic body: 3 sentences, ambiguous for an unknown key, free of any
// forbidden pattern. The marker words are checked for echo.
const BODY = 'The pilot ran for three weeks. The team liked the interface a lot. The next step is a wider trial with more users.';
const BODY_MARKERS = ['pilot ran', 'liked the interface', 'wider trial'];
const SPROUT = 'swot analysis';
const SCRIPTED_SPROUTS = { verdict: 'block', class: 'sprouts_required', reason: 'scripted' };

function check(cond, msg) { if (!cond) throw new Error(msg); }
function noMarker(text, label) {
  BODY_MARKERS.forEach((m) => check(String(text).indexOf(m) === -1, label + ' holds a payload byte: ' + m));
}
function checkSentinel(r, label) {
  check(r && r.error === 'egress_blocked', label + ': error egress_blocked, got ' + JSON.stringify(r && r.error));
  check(r.egress_class === SPLIT.SPROUTS_REQUIRED, label + ': egress_class sprouts_required, got ' + r.egress_class);
  check(r.outcome === SPLIT.SPROUTS_REQUIRED, label + ': outcome sprouts_required');
  check(r.route === SPLIT.ROUTE, label + ': route ' + SPLIT.ROUTE + ', got ' + r.route);
  check(Array.isArray(r.split_guide) && r.split_guide.length === 5, label + ': split_guide holds 5 lines');
  check(JSON.stringify(r.split_guide) === JSON.stringify(SPLIT.SPLIT_GUIDE), label + ': split_guide equals the module guide');
  check(typeof r.message === 'string' && r.message === SPLIT.refusalMessage(), label + ': message is the module message');
}

const arms = [];
function arm(label, fn) { arms.push({ label: label, fn: fn }); }

arm('SP1', async () => {
  // Ambiguous call that carries a body string: sprouts_required, 0 fetch.
  const v = realClassify.call(guard, { a: BODY }, { toolName: 'brain_stats' });
  check(v.verdict === 'ambiguous', 'fixture must classify ambiguous, got ' + v.verdict);
  DOUBLE = null;
  const bc = freshClient();
  resetWire();
  const r = await bc.callTool('brain_stats', { a: BODY });
  checkSentinel(r, 'SP1 callTool');
  check(wire.length === 0, 'SP1: 0 fetch calls, got ' + wire.length);
  noMarker(JSON.stringify(r), 'SP1 result');
  check(r.tool === 'brain_stats', 'SP1: tool name carried');
});

arm('SP2', async () => {
  const r = runHook(PLUGIN + 'brain_stats', { a: BODY }, BRAIN_ON);
  check(r.status === 2, 'SP2: hook exits 2, got ' + r.status + ' stderr=' + JSON.stringify(r.stderr));
  check(r.stderr.indexOf(SPLIT.refusalMessage()) !== -1, 'SP2: stderr holds the refusal message');
  check(r.stderr.indexOf('sprouts_required') !== -1, 'SP2: stderr names the reason');
  noMarker(r.stderr, 'SP2 stderr');
});

arm('SP3', async () => {
  DOUBLE = SCRIPTED_SPROUTS;
  const bc = freshClient();
  resetWire();
  const r = await bc.callTool('brain_ask', { question: SPROUT });
  DOUBLE = null;
  checkSentinel(r, 'SP3 callTool brain_ask');
  check(wire.length === 0, 'SP3: 0 fetch calls, got ' + wire.length);
  // A non free-form tool takes the other block branch; same sentinel.
  DOUBLE = SCRIPTED_SPROUTS;
  const r2 = await bc.callTool('brain_stats', { a: SPROUT });
  DOUBLE = null;
  checkSentinel(r2, 'SP3 callTool brain_stats');
  check(wire.length === 0, 'SP3: still 0 fetch calls');
  const h = runHook(PLUGIN + 'brain_ask', { question: SPROUT }, BRAIN_ON, SCRIPTED_SPROUTS);
  check(h.status === 2, 'SP3: hook exits 2, got ' + h.status);
  check(h.stderr.indexOf(SPLIT.refusalMessage()) !== -1, 'SP3: hook stderr holds the guide message');
  // The block verdict applies to every scope, the direct connector too.
  const h2 = runHook(DIRECT + 'brain_ask', { question: SPROUT }, BRAIN_ON, SCRIPTED_SPROUTS);
  check(h2.status === 2 && h2.stderr.indexOf(SPLIT.refusalMessage()) !== -1, 'SP3: direct scope exits 2 with the guide');
});

arm('SP4', async () => {
  DOUBLE = SCRIPTED_SPROUTS;
  const bc = freshClient();
  resetWire();
  const r = await bc.query('MATCH (f:Framework) RETURN f.name');
  DOUBLE = null;
  checkSentinel(r, 'SP4 query');
  check(r.tool === 'brain_query', 'SP4: tool brain_query');
  check(wire.length === 0, 'SP4: 0 fetch calls, got ' + wire.length);
});

arm('SP5', async () => {
  // Parity: the same scripted verdict gives the same class, route and guide.
  DOUBLE = SCRIPTED_SPROUTS;
  const bc = freshClient();
  const a = await bc.callTool('brain_ask', { question: SPROUT });
  const b = await bc.query('MATCH (f:Framework) RETURN f.name');
  const c = await bc.ask(SPROUT);
  DOUBLE = null;
  [a, b, c].forEach((r, i) => checkSentinel(r, 'SP5 surface ' + i));
  ['egress_class', 'outcome', 'route', 'message'].forEach((k) => {
    check(a[k] === b[k] && b[k] === c[k], 'SP5: ' + k + ' equal on callTool, query and ask');
  });
  check(JSON.stringify(a.split_guide) === JSON.stringify(b.split_guide) && JSON.stringify(b.split_guide) === JSON.stringify(c.split_guide), 'SP5: split_guide equal');
  const h = runHook(PLUGIN + 'brain_ask', { question: SPROUT }, BRAIN_ON, SCRIPTED_SPROUTS);
  SPLIT.SPLIT_GUIDE.forEach((line) => check(h.stderr.indexOf(line) !== -1, 'SP5: hook stderr holds guide line: ' + line.slice(0, 20)));
  check(h.stderr.indexOf(a.message) !== -1, 'SP5: hook stderr holds the same message');
});

arm('SP6', async () => {
  DOUBLE = null;
  const bc = freshClient();
  // A sprout-only ambiguous payload proceeds with the disclosure.
  check(realClassify.call(guard, { a: SPROUT }, { toolName: 'brain_stats' }).verdict === 'ambiguous', 'SP6 fixture must be ambiguous');
  resetWire();
  const r = await bc.callTool('brain_stats', { a: SPROUT });
  check(r && r.error !== 'egress_blocked', 'SP6: sprout-only is not refused');
  check(wire.length > 0, 'SP6: sprout-only reaches the wire');
  check(r.egress_disclosure && r.egress_disclosure.verdict === 'ambiguous' && r.egress_disclosure.disposition === 'proceeded', 'SP6: disclosure attached');
  // Numbers and sprouts mixed.
  resetWire();
  const rn = await bc.callTool('brain_stats', { a: SPROUT, n: 3 });
  check(rn && rn.error !== 'egress_blocked' && wire.length > 0, 'SP6: numbers plus sprouts proceed');
  // Hook: sprout-only ambiguous on the plugin scope exits 0; empty exits 0.
  const h = runHook(PLUGIN + 'brain_stats', { a: SPROUT }, BRAIN_ON);
  check(h.status === 0, 'SP6: hook exits 0 for a sprout-only payload, got ' + h.status + ' ' + h.stderr);
  const he = runHook(PLUGIN + 'brain_stats', {}, BRAIN_ON);
  check(he.status === 0, 'SP6: hook exits 0 for an empty payload');
  resetWire();
  const re = await bc.callTool('brain_stats', {});
  check(re && re.error !== 'egress_blocked' && wire.length > 0, 'SP6: empty payload allows');
  // The direct connector still blocks an ambiguous payload.
  const hd = runHook(DIRECT + 'brain_stats', { a: SPROUT }, BRAIN_ON);
  check(hd.status === 2, 'SP6: direct connector exits 2 on ambiguity, got ' + hd.status);
  // Brain-less hook path still allows, even with a body.
  const hb = runHook(PLUGIN + 'brain_stats', { a: BODY }, BRAIN_OFF);
  check(hb.status === 0, 'SP6: Brain-less hook path exits 0, got ' + hb.status);
  const hb2 = runHook(DIRECT + 'brain_stats', { a: SPROUT }, BRAIN_OFF);
  check(hb2.status === 0, 'SP6: Brain-less direct scope exits 0, got ' + hb2.status);
  // The cypher key of brain_query is never read for the shape rule (repo code
  // paths enrichCausalEdges, suggestValidationSteps, hatAwareRecommend send
  // long Cypher templates and have no model to split them).
  DOUBLE = { verdict: 'ambiguous', class: 'unknown', reason: 'scripted' };
  resetWire();
  const rq = await bc.callTool('brain_query', { cypher: 'MATCH (a:Framework) WHERE a.name = "x" RETURN a. Second sentence here. Third sentence there.' });
  DOUBLE = null;
  check(rq && rq.error !== 'egress_blocked', 'SP6: a long cypher on brain_query is not refused');
  check(wire.length > 0, 'SP6: a long cypher on brain_query reaches the wire');
  // Repo-owned wrappers reach the wire.
  const wrappers = [
    ['ask', () => bc.ask('how does design thinking work')],
    ['search', () => bc.search('swot analysis')],
    ['schema', () => bc.schema()],
    ['stats', () => bc.stats()],
    ['query', () => bc.query('MATCH (f:Framework) RETURN f.name LIMIT 3')],
    ['normalizeFrameworkName', () => bc.normalizeFrameworkName('Design Thinkng')],
  ];
  for (let i = 0; i < wrappers.length; i += 1) {
    resetWire();
    const out = await wrappers[i][1]();
    check(!(out && out.error === 'egress_blocked'), 'SP6: wrapper ' + wrappers[i][0] + ' is not refused');
    check(wire.length > 0, 'SP6: wrapper ' + wrappers[i][0] + ' reaches the wire');
  }
});

arm('SP7', async () => {
  const bc = freshClient();
  const others = [
    { verdict: 'block', class: 'content_set', reason: 'scripted' },
    { verdict: 'block', class: 'identifier', reason: 'scripted', token_class: 'identifier' },
  ];
  for (let i = 0; i < others.length; i += 1) {
    const v = others[i];
    DOUBLE = v;
    resetWire();
    const a = await bc.callTool('brain_ask', { question: SPROUT });
    const b = await bc.callTool('brain_stats', { a: SPROUT });
    DOUBLE = null;
    [a, b].forEach((r, j) => {
      check(r && r.error === 'egress_blocked', 'SP7 ' + v.class + ' ' + j + ': still refused');
      check(r.egress_class === v.class, 'SP7 ' + v.class + ' ' + j + ': keeps its class, got ' + r.egress_class);
      check(!Object.prototype.hasOwnProperty.call(r, 'split_guide'), 'SP7 ' + v.class + ' ' + j + ': no split_guide key');
      check(!Object.prototype.hasOwnProperty.call(r, 'outcome'), 'SP7 ' + v.class + ' ' + j + ': no outcome key');
      check(JSON.stringify(r).indexOf('sprouts_required') === -1, 'SP7 ' + v.class + ' ' + j + ': does not mention sprouts_required');
    });
    check(wire.length === 0, 'SP7: 0 fetch calls');
    const h = runHook(PLUGIN + 'brain_ask', { question: SPROUT }, BRAIN_ON, v);
    check(h.status === 2, 'SP7 hook ' + v.class + ': exits 2');
    check(h.stderr.indexOf('sprouts_required') === -1 && h.stderr.indexOf('claim_write') === -1, 'SP7 hook ' + v.class + ': no guide in stderr');
  }
});

arm('SP8', async () => {
  // ask() returns the sprouts_required sentinel unchanged (no disclosure).
  DOUBLE = SCRIPTED_SPROUTS;
  const bc = freshClient();
  resetWire();
  const r = await bc.ask(SPROUT);
  DOUBLE = null;
  checkSentinel(r, 'SP8 ask');
  check(!Object.prototype.hasOwnProperty.call(r, 'egress_disclosure'), 'SP8: not decorated with a disclosure');
  check(wire.length === 0, 'SP8: 0 fetch calls');
  // search() too.
  DOUBLE = SCRIPTED_SPROUTS;
  const s = await bc.search(SPROUT);
  DOUBLE = null;
  checkSentinel(s, 'SP8 search');
});

// ---------------------------------------------------------------------------
(async function main() {
  const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  let failed = 0;
  const only = process.argv[2] || null;
  for (let i = 0; i < arms.length; i += 1) {
    if (only && only !== arms[i].label) continue;
    try {
      await arms[i].fn();
      process.stdout.write('ok - ' + arms[i].label + '\n');
    } catch (e) {
      failed += 1;
      process.stdout.write('FAIL - ' + arms[i].label + ': ' + (e && e.message ? e.message : String(e)) + '\n');
    } finally {
      DOUBLE = null;
    }
  }
  if (DASH.test(fs.readFileSync(__filename, 'utf8'))) {
    failed += 1;
    process.stdout.write('FAIL - dash: this file holds a dash character\n');
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 ? 0 : 1);
})();
