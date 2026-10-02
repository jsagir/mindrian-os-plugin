#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 16 Task 2 (D-09, T-366-67): all six recall stages are offline.
 * One test runs every perspective through the MCP op on the planted fixture room
 * under the net guard, and counts zero network attempts.
 *
 *   Z1  research_run perspective_recall for each id in PERSPECTIVE_IDS returns ok,
 *       carries its own id and at least one candidate
 *   Z2  the analogies response carries statement_template equal to the module's
 *       STATEMENT_TEMPLATE; the other five carry none
 *   Z3  zero network attempts over all six recalls, and over the Stage A run
 *   Z4  end to end per perspective: the module's question set builds a plan that
 *       plan.validatePlan accepts as mos.research-plan/1, and one pair-carrying
 *       researchable leaf rolled supported yields exactly one basket candidate of the
 *       template's declared opportunity_rules kind carrying that leaf's pair and the
 *       perspective id, with zero network attempts
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temp dirs, and the net
 * guard is installed before any repo module loads.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-off-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-off-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const hygieneGuard = hygiene.installNetGuard();
// The fetch guard alone misses sockets, so count raw socket connects and http(s) requests too.
let socketAttempts = 0;
const nodeNet = require('node:net');
const nodeHttp = require('node:http');
const nodeHttps = require('node:https');
const realConnect = nodeNet.Socket.prototype.connect;
nodeNet.Socket.prototype.connect = function () { socketAttempts += 1; throw new Error('no sockets in the offline recall test'); };
const realHttpReq = nodeHttp.request; const realHttpsReq = nodeHttps.request;
nodeHttp.request = function () { socketAttempts += 1; throw new Error('no http in the offline recall test'); };
nodeHttps.request = function () { socketAttempts += 1; throw new Error('no https in the offline recall test'); };
const net = {
  attempts: function () { return hygieneGuard.attempts() + socketAttempts; },
  restore: function () {
    hygieneGuard.restore();
    nodeNet.Socket.prototype.connect = realConnect; nodeHttp.request = realHttpReq; nodeHttps.request = realHttpsReq;
  },
};
const C = hygiene.makeChecker('test-366-offline-recall');

const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const registry = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/index.cjs'));
const planMod = require(path.join(REPO_ROOT, 'lib/core/research-planner/plan.cjs'));
const planner = require(path.join(REPO_ROOT, 'lib/core/research-planner/planner.cjs'));
const Y = require(path.join(REPO_ROOT, 'lib/core/research-planner/pyramid.cjs'));
const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
const analogies = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/analogies-recall.cjs'));
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-off-'));
const room = fixture.buildPerspectiveRoom(root, { name: 'room' });

const captured = new Map();
const stub = {
  tool: function (name, _d, _s, fn) { captured.set(name, fn); },
  registerTool: function (name, _cfg, fn) { captured.set(name, fn); },
};
registerCoreTools(stub, { fallbackRoomDir: room.roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
async function call(input) {
  const raw = await captured.get('research_run')(input, { sessionId: 'sess-366-offline' });
  return JSON.parse(raw.content[0].text);
}

function tagFor(i) { return '20261002T0200' + String(10 + i) + 'Z'; }
function samePair(p, a, b) { return (p.a === a && p.b === b) || (p.a === b && p.b === a); }

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}

(async function main() {
  const ids = registry.PERSPECTIVE_IDS.slice();
  const responses = {};

  await leg('Z1 every perspective answers perspective_recall ok with a candidate on the fixture room (' + ids.length + ' ids)', async function () {
    const bad = [];
    for (let i = 0; i < ids.length; i++) {
      const r = await call({ op: 'perspective_recall', perspective: ids[i], run_tag: tagFor(i) });
      responses[ids[i]] = r;
      const ok = r.ok === true && r.op === 'perspective_recall' && r.perspective === ids[i] && Array.isArray(r.top) && r.top.length >= 1;
      if (!ok) bad.push(ids[i] + ':' + JSON.stringify(r).slice(0, 160));
    }
    return (ids.length === 6 && bad.length === 0) || ('ids=' + ids.length + ' ' + bad.join(' | '));
  });

  await leg('Z2 statement_template rides the analogies response only', function () {
    const bad = [];
    ids.forEach(function (id) {
      const r = responses[id] || {};
      if (id === 'analogies') {
        if (JSON.stringify(r.statement_template) !== JSON.stringify(analogies.STATEMENT_TEMPLATE) || !r.statement_template) bad.push('analogies template mismatch');
      } else if (r.statement_template !== undefined) bad.push(id + ' carries a template');
    });
    return bad.length === 0 || bad.join(' | ');
  });

  await leg('Z3 Stage A runs offline for every perspective too', async function () {
    const bad = [];
    for (let i = 0; i < ids.length; i++) {
      const j = await call({ op: 'perspective_judge', perspective: ids[i], run_tag: tagFor(i) });
      if (!(j.ok === true && j.summary && j.summary.judge === 'none')) bad.push(ids[i] + ':' + JSON.stringify(j).slice(0, 120));
    }
    return bad.length === 0 || bad.join(' | ');
  });
  C.check('Z3 zero network attempts after six recalls and six Stage A runs', net.attempts() === 0, 'attempts=' + net.attempts());

  // Z4: the end-to-end shape, per perspective, on a fresh room per id so one plan never
  // sees another's run state.
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    await leg('Z4 ' + id + ': plan validates and one supported pair leaf yields exactly one declared-kind candidate', function () {
      const sub = fixture.buildPerspectiveRoom(root, { name: 'z4-' + id });
      const mod = registry.getPerspective(id);
      if (!mod) return 'no module';
      const rec = mod.runRecall(sub.roomDir, { tag: tagFor(i) + 'z' });
      if (!rec.question_set) return 'no question set';
      const built = planner.buildPlan(sub.roomDir, rec.question_set, {});
      if (!built || built.ok === false || !built.plan) return 'buildPlan: ' + JSON.stringify(built).slice(0, 300);
      const valid = planMod.validatePlan(built.plan);
      const validOk = (valid === true) || (valid && (valid.ok === true || (Array.isArray(valid.errors) && valid.errors.length === 0)));
      if (!validOk) return 'validatePlan: ' + JSON.stringify(valid).slice(0, 300);
      if (built.plan.schema !== planMod.PLAN_SCHEMA) return 'schema ' + built.plan.schema;

      const tpl = Q.TEMPLATES[mod.TEMPLATE_ID];
      const rule = tpl.opportunity_rules[0];
      const leaf = built.plan.leaves.filter(function (l) { return l.researchable === true && l.pair && l.dimension === rule.dimension; })[0];
      if (!leaf) return 'no researchable pair leaf on ' + rule.dimension + ': ' + JSON.stringify(built.plan.leaves.map(function (l) { return [l.id, l.dimension, l.researchable, !!l.pair]; }));
      const verdicts = {}; verdicts[leaf.id] = 'settled';
      const rolled = Y.rollUp(built.plan.pyramid, built.plan.leaves, [], { verdictByLeaf: verdicts });
      const rolledLeaf = rolled.leaves.filter(function (l) { return l.id === leaf.id; })[0];
      if (!rolledLeaf || rolledLeaf.status !== 'supported') return 'leaf not supported';
      const known = rolled.leaves.filter(function (l) { return /:already_known$/.test(l.dimension) && l.status === 'supported'; });
      if (known.length !== 0) return 'an already_known leaf is supported';
      const cands = Y.opportunityCandidates(rolled.pyramid, rolled.leaves, [], {});
      const hits = cands.filter(function (c) { return c.kind === rule.kind; });
      const okOne = hits.length === 1 && hits[0].leaf_ids.length === 1 && hits[0].leaf_ids[0] === leaf.id
        && hits[0].pair && hits[0].pair.perspective === id && samePair(hits[0].pair, leaf.pair.a, leaf.pair.b);
      return (okOne && cands.length === hits.length) || JSON.stringify({ rule: rule.kind, cands: cands.map(function (c) { return [c.kind, c.leaf_ids, c.pair && c.pair.perspective]; }) });
    });
  }
  C.check('Z4 zero network attempts across all six end-to-end runs', net.attempts() === 0, 'attempts=' + net.attempts());
  C.check('zero network attempts', net.attempts() === 0, 'attempts=' + net.attempts());
})().then(function () {
  const code = C.summary();
  net.restore();
  for (const d of [root, TMP_HOME, process.env.MINDRIAN_ROOMS_HOME]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* tmp */ } }
  process.exit(code);
});
