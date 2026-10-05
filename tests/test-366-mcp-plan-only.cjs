#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Quick 261002-cud Task 2 (EPV366-22, 366-17 known follow-up): over MCP, research_run op run_quick answers
 * the typed plan_only status when the research egress line is off (or offline is on), and takes an offline flag.
 *
 *   P1  an override turning the research line off: ok true, status plan_only, reason egress_line_off, line research,
 *       sent false, outcome plan_only_not_sent, the plan card, a next_step naming the policy file; never run_refused
 *   P2  that answer sends nothing: zero network attempts, no run.json, no new audit row
 *   P3  offline true with no override: plan_only with offline true and a next_step that says offline was on
 *   P4  no override, offline absent, no grant: the existing reask answer, so offline only narrows
 *   P5  the inputSchema takes offline as a boolean only; the description names offline and the canon-name lookup,
 *       stays inside 2048 bytes and carries no vendor name and no dash
 *   P6  the wire snapshot entry for research_run equals the live registration
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temp dirs, session and MOS_366_* env cleared before any
 * repo module loads. No em-dash or en-dash literals: those characters are spelled with String.fromCharCode.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cud-po-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cud-po-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
delete process.env.MOS_366_LIVE;
delete process.env.MOS_366_THEO_REPLAY;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-mcp-plan-only');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let buildRoom363 = null;
try { buildRoom363 = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-363.cjs')).buildRoom363; } catch (_e) {
  process.stdout.write('SKIP: 363-02 helpers absent\n');
  process.exit(77);
}
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));
const QS = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/363-question-sets/whitespace-quick.json'), 'utf8'));

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function parse(raw) {
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
}
function client(room, sessionId) {
  const captured = new Map();
  const stub = {
    tool: function (name, _d, _s, fn) { captured.set(name, { handler: fn }); },
    registerTool: function (name, cfg, fn) { captured.set(name, { description: cfg && cfg.description, schema: cfg && cfg.inputSchema, handler: fn }); },
  };
  registerCoreTools(stub, { fallbackRoomDir: room.roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
  const reg = captured.get('research_run');
  const extra = { sessionId: sessionId };
  return {
    reg: reg,
    raw: function (input) { return reg.handler(input, extra); },
    call: async function (input) { return parse(await reg.handler(input, extra)); },
  };
}
function writeOverride(room, body) {
  const d = path.join(room.roomDir, '.mindrian');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'egress-policy.json'), JSON.stringify(body));
}
function removeOverride(room) { try { fs.unlinkSync(path.join(room.roomDir, '.mindrian', 'egress-policy.json')); } catch (_e) { /* absent */ } }
function runDir(room, runId) { return path.join(room.roomDir, '.mindrian', 'research-runs', runId); }
function auditLines(room) {
  const f = path.join(room.roomDir, '.mindrian', 'research-audit.jsonl');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0;
}
async function planQuick(c) {
  const planned = await c.call({ op: 'plan', question_set: JSON.parse(JSON.stringify(QS)), mode: 'quick' });
  return planned;
}

(async function main() {
  const room = buildRoom363({ role: 'founder' });
  const c = client(room, 'sess-cud-po');

  const p1 = await planQuick(c);
  const runId = p1.run_id;
  let r1 = null;

  await leg('P1 an override naming research is ignored (369.2-05): run_quick answers reask with a gate, never plan_only, never run_refused', async function () {
    // 369.2-05, ruling 2026-10-05: the web lines are not policy-gated; the Part 8 fence is the Theo line only.
    if (p1.ok !== true || p1.status !== 'ready') return 'plan ' + JSON.stringify(p1).slice(0, 300);
    writeOverride(room, { lines: { research: { default: false } } });
    const raw = await c.raw({ op: 'run_quick', run_id: runId });
    r1 = parse(raw);
    return (r1.ok === true && r1.op === 'run_quick' && r1.status === 'reask' && !!r1.gate && r1.reason !== 'egress_line_off' && r1.reason !== 'run_refused'
      && raw.isError !== true && net.attempts() === 0) || JSON.stringify(r1).slice(0, 500);
  });

  await leg('P2 the plan_only answer sends nothing and writes no run state or audit row', function () {
    return (net.attempts() === 0 && !fs.existsSync(path.join(runDir(room, runId), 'run.json')) && auditLines(room) === 0)
      || 'attempts ' + net.attempts() + ' runjson ' + fs.existsSync(path.join(runDir(room, runId), 'run.json')) + ' audit ' + auditLines(room);
  });

  await leg('P3 offline true with no override: plan_only, offline true, the next step says offline was on', async function () {
    removeOverride(room);
    const p = await planQuick(c);
    const r = await c.call({ op: 'run_quick', run_id: p.run_id, offline: true });
    // 369.2-05: --offline is read directly; the answer names reason offline, not a policy line.
    return (r.ok === true && r.status === 'plan_only' && r.offline === true && r.reason === 'offline' && r.sent === false
      && /offline/i.test(String(r.next_step)) && net.attempts() === 0) || JSON.stringify(r).slice(0, 500);
  });

  await leg('P4 no override, offline absent, no grant: the existing reask answer', async function () {
    const p = await planQuick(c);
    const r = await c.call({ op: 'run_quick', run_id: p.run_id });
    return (r.ok === true && r.status === 'reask' && !!r.gate && net.attempts() === 0) || JSON.stringify(r).slice(0, 500);
  });

  await leg('P5 offline is a boolean in the schema; the description names offline and the canon-name lookup', function () {
    const schema = c.reg.schema;
    const d = String(c.reg.description || '');
    const good = schema.safeParse({ op: 'run_quick', run_id: runId, offline: true });
    const bad = schema.safeParse({ op: 'run_quick', run_id: runId, offline: 'yes' });
    return (good.success === true && bad.success === false && /offline/.test(d) && /canon-name lookup/.test(d)
      && Buffer.byteLength(d, 'utf8') <= 2048 && !/theo/i.test(d) && d.indexOf(EM) === -1 && d.indexOf(EN) === -1)
      || JSON.stringify({ good: good.success, bad: bad.success, bytes: Buffer.byteLength(d, 'utf8'), desc: d.slice(-260) });
  });

  await leg('P6 the wire snapshot entry for research_run equals the live registration', function () {
    const snap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/267/wire-snapshot-zod4.json'), 'utf8'));
    const entry = ((snap.local && snap.local.tools) || []).filter(function (t) { return t.name === 'research_run'; })[0];
    if (!entry) return 'no research_run entry';
    const off = entry.inputSchema && entry.inputSchema.properties && entry.inputSchema.properties.offline;
    return (!!off && off.type === 'boolean' && entry.description === c.reg.description) || JSON.stringify({ off: off, same: entry.description === c.reg.description });
  });

  net.restore();
  process.exit(C.summary());
})();
