#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 12 Task 1 (EPV366-03, D-07): research_run carries ONE perspective
 * op set (perspective_recall, perspective_candidates, perspective_judge) with a
 * perspective enum read from the registry, and the three eureka_* ops stay as
 * deprecated aliases for one release (355 D-26: never a silent rename).
 *
 *   M1  perspective_recall (eureka) returns ok, op, perspective, run_tag, counts, top, plan
 *   M2  the three eureka_* aliases answer with their legacy op name, deprecated true and use_instead
 *   M3  no perspective -> perspective_required with a hint; an unavailable id -> perspective_unavailable with a hint
 *   M4  perspective_candidates paginates (limit, offset, has_more, next_offset, total) and refuses
 *       candidates_missing with a hint naming perspective_recall
 *   M5  perspective_judge runs Stage A through the shared judge with the module and returns the summary
 *   M6  the recall response carries statement_template exactly when the module exports one
 *   M7  the schema enum equals PERSPECTIVE_IDS; the description names the new ops, the alias tokens
 *       and every perspective; no em-dash; zero network attempts
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temp dirs set before any repo module loads.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-mcp-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-mcp-roomshome-'));
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
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: [], restore: function () {} };
const C = hygiene.makeChecker('test-366-mcp-perspective-ops');

const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const registry = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/index.cjs'));
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-mcp-'));
const room = fixture.buildPerspectiveRoom(root, { name: 'room' });

const captured = new Map();
const stub = {
  tool: function (name, _d, _s, fn) { captured.set(name, fn); },
  registerTool: function (name, cfg, fn) { captured.set(name, fn); captured.set(name + ':cfg', cfg); },
};
registerCoreTools(stub, { fallbackRoomDir: room.roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
async function call(input) {
  const raw = await captured.get('research_run')(input, { sessionId: 'sess-366-mcp' });
  return JSON.parse(raw.content[0].text);
}
const cfg = captured.get('research_run:cfg') || {};

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}

(async function main() {
  const r1 = await call({ op: 'perspective_recall', perspective: 'eureka', max_candidates: 5, run_tag: '20261002T000001Z' });

  await leg('M1 perspective_recall (eureka) returns the recall body', function () {
    const ok = r1.ok === true && r1.op === 'perspective_recall' && r1.perspective === 'eureka' && r1.run_tag === '20261002T000001Z'
      && r1.counts && typeof r1.counts.sections === 'number' && Array.isArray(r1.top) && 'plan' in r1 && typeof r1.next_step === 'string'
      && r1.deprecated === undefined;
    return ok || JSON.stringify(r1).slice(0, 400);
  });

  await leg('M1b every registered perspective answers perspective_recall with its own id', async function () {
    const bad = [];
    for (const id of registry.PERSPECTIVE_IDS) {
      const r = await call({ op: 'perspective_recall', perspective: id, run_tag: '20261002T0000' + (10 + registry.PERSPECTIVE_IDS.indexOf(id)) + 'Z' });
      if (!(r.ok === true && r.perspective === id && Array.isArray(r.top))) bad.push(id + ':' + JSON.stringify(r).slice(0, 120));
    }
    return bad.length === 0 || bad.join(' | ');
  });

  await leg('M2 the three eureka_* aliases answer with the legacy op, deprecated and use_instead', async function () {
    const rec = await call({ op: 'eureka_recall', max_candidates: 5, run_tag: '20261002T000002Z' });
    const can = await call({ op: 'eureka_candidates', run_tag: '20261002T000002Z', limit: 2 });
    const jud = await call({ op: 'eureka_judge', run_tag: '20261002T000002Z' });
    const okRec = rec.ok === true && rec.op === 'eureka_recall' && rec.deprecated === true && rec.use_instead === 'perspective_recall' && rec.counts && Array.isArray(rec.top);
    const okCan = can.ok === true && can.op === 'eureka_candidates' && can.deprecated === true && can.use_instead === 'perspective_candidates' && can.count === 2 && can.total >= 2;
    const okJud = jud.ok === true && jud.op === 'eureka_judge' && jud.deprecated === true && jud.use_instead === 'perspective_judge' && jud.summary && jud.summary.judge === 'none';
    const bad = await call({ op: 'eureka_judge', run_tag: '20990101T000000Z' });
    const okBad = bad.ok === false && /eureka_recall/.test(String(bad.hint));
    return (okRec && okCan && okJud && okBad) || JSON.stringify({ okRec: okRec, okCan: okCan, okJud: okJud, okBad: okBad, rec: JSON.stringify(rec).slice(0, 150) });
  });

  await leg('M3 refusals name a reason and a hint for the next op', async function () {
    const none = await call({ op: 'perspective_recall' });
    const noneC = await call({ op: 'perspective_candidates', run_tag: '20261002T000001Z' });
    const noneJ = await call({ op: 'perspective_judge', run_tag: '20261002T000001Z' });
    const okNone = [none, noneC, noneJ].every(function (r) { return r.ok === false && r.reason === 'perspective_required' && typeof r.hint === 'string' && /eureka/.test(r.hint); });
    // the schema enum blocks an unknown id at the edge; the handler still refuses one that reaches it
    const missingId = 'not-a-perspective';
    const hasModule = registry.available(missingId);
    const un = await call({ op: 'perspective_recall', perspective: missingId });
    const okUn = hasModule === false && un.ok === false && un.reason === 'perspective_unavailable' && typeof un.hint === 'string';
    const tagless = await call({ op: 'perspective_candidates', perspective: 'eureka' });
    const okTag = tagless.ok === false && tagless.reason === 'run_tag_required' && typeof tagless.hint === 'string';
    process.stdout.write('  note - perspective_unavailable for a registered id is skipped: all six modules are present (' + registry.PERSPECTIVE_IDS.filter(registry.available).length + ' of ' + registry.PERSPECTIVE_IDS.length + ')\n');
    return (okNone && okUn && okTag) || JSON.stringify({ okNone: okNone, okUn: okUn, okTag: okTag });
  });

  await leg('M4 perspective_candidates paginates and refuses candidates_missing with a hint', async function () {
    const p0 = await call({ op: 'perspective_candidates', perspective: 'eureka', run_tag: r1.run_tag, limit: 1, offset: 0 });
    const ok0 = p0.ok === true && p0.op === 'perspective_candidates' && p0.perspective === 'eureka' && p0.count === 1 && p0.has_more === true && p0.next_offset === 1 && p0.total >= 2 && p0.judged === false;
    const pl = await call({ op: 'perspective_candidates', perspective: 'eureka', run_tag: r1.run_tag, limit: 1, offset: p0.total - 1 });
    const okL = pl.ok === true && pl.has_more === false && pl.next_offset === null;
    const miss = await call({ op: 'perspective_candidates', perspective: 'eureka', run_tag: '20990101T000000Z' });
    const okM = miss.ok === false && miss.reason === 'candidates_missing' && /perspective_recall/.test(String(miss.hint));
    return (ok0 && okL && okM) || JSON.stringify({ ok0: ok0, okL: okL, okM: okM, p0: JSON.stringify(p0).slice(0, 200) });
  });

  await leg('M5 perspective_judge runs Stage A with the module and the verdicts show up in the next page', async function () {
    const j = await call({ op: 'perspective_judge', perspective: 'eureka', run_tag: r1.run_tag });
    const okJ = j.ok === true && j.op === 'perspective_judge' && j.perspective === 'eureka' && j.summary && j.summary.judge === 'none' && Array.isArray(j.passed);
    const p1 = await call({ op: 'perspective_candidates', perspective: 'eureka', run_tag: r1.run_tag, limit: 1 });
    const okP = p1.ok === true && p1.judged === true && p1.items[0].stage_a && typeof p1.items[0].stage_a.pass === 'boolean';
    const miss = await call({ op: 'perspective_judge', perspective: 'eureka', run_tag: '20990101T000000Z' });
    const okM = miss.ok === false && /perspective_recall/.test(String(miss.hint));
    return (okJ && okP && okM) || JSON.stringify({ okJ: okJ, okP: okP, okM: okM, j: JSON.stringify(j).slice(0, 200) });
  });

  await leg('M6 statement_template rides the recall response exactly when the module exports one', async function () {
    const bad = [];
    for (const id of registry.PERSPECTIVE_IDS) {
      const mod = registry.getPerspective(id);
      const r = await call({ op: 'perspective_recall', perspective: id, run_tag: '20261002T0000' + (20 + registry.PERSPECTIVE_IDS.indexOf(id)) + 'Z' });
      const wants = !!(mod && mod.STATEMENT_TEMPLATE);
      const has = Object.prototype.hasOwnProperty.call(r, 'statement_template') && r.statement_template !== undefined;
      if (wants !== has) bad.push(id + ' wants=' + wants + ' has=' + has);
      if (wants && JSON.stringify(r.statement_template) !== JSON.stringify(mod.STATEMENT_TEMPLATE)) bad.push(id + ' template differs');
    }
    const eu = await call({ op: 'perspective_recall', perspective: 'eureka', run_tag: '20261002T000030Z' });
    if ('statement_template' in eu) bad.push('eureka carries a template');
    return bad.length === 0 || bad.join(' | ');
  });

  await leg('M7 the schema enum is the registry list; the description names the ops, the aliases and every perspective', function () {
    const mod = require(path.join(REPO_ROOT, 'lib/mcp/tools/research.cjs'));
    const schema = mod._internal.inputSchema;
    const okEnum = schema.safeParse({ op: 'perspective_recall', perspective: 'rs' }).success
      && !schema.safeParse({ op: 'perspective_recall', perspective: '../eureka' }).success
      && registry.PERSPECTIVE_IDS.every(function (id) { return schema.safeParse({ op: 'perspective_recall', perspective: id }).success; });
    const ops = ['perspective_recall', 'perspective_candidates', 'perspective_judge', 'eureka_recall', 'eureka_judge', 'eureka_candidates'];
    const okOps = ops.every(function (o) { return schema.safeParse({ op: o }).success; });
    const d = String(cfg.description || '');
    const okDesc = /perspective_recall/.test(d) && /perspective_candidates/.test(d) && /perspective_judge/.test(d)
      && /eureka_recall/.test(d) && /eureka_candidates/.test(d) && /deprecated/.test(d)
      && registry.PERSPECTIVE_IDS.every(function (id) { return d.indexOf(id) !== -1; })
      && !/[\u2014\u2013]/.test(d) && Buffer.byteLength(d, 'utf8') <= 2048;
    return (okEnum && okOps && okDesc) || JSON.stringify({ okEnum: okEnum, okOps: okOps, okDesc: okDesc, len: Buffer.byteLength(d, 'utf8') });
  });

  const attemptCount = (net && typeof net.attempts === 'function') ? net.attempts() : ((net && Array.isArray(net.attempts)) ? net.attempts.length : 0);
  C.check('zero network attempts', attemptCount === 0, String(attemptCount));

  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
})().catch(function (err) {
  process.stderr.write('test-366-mcp-perspective-ops THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
