#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 08 Task 1 -- the MCP methodology tool reaches
 * /mos:scientific-roadmap on Desktop and Cowork (SRM364-17, SRM364-18,
 * Tri-Polar, NV-2, ROOT, Part 8). layer: harness
 *
 *   M1  METHODOLOGY_COMMANDS carries 'scientific-roadmap'; the zod enum accepts it
 *   M2  ALL_TOOL_COMMANDS has 66 unique members
 *   M3  stated_goal room, all-null step: reference + status + honest refusal +
 *       /mos:research + uncovered + the Desktop line
 *   M4  authored step: the seven step labels in list order
 *   M5  empty room: /mos:analyze-needs and zero Theo calls
 *   M6  only framework_step {framework} and recommend_chain {WellDefined, 6};
 *       the planted room MARKER never reaches a call
 *   M7  nothing written under the room but the pipeline-state step record;
 *       node and edge counts unchanged; no research-plan/ folder
 *   M8  another methodology command carries no status block
 *   M9  an entry check that throws still returns the reference plus a plain line
 *   M10 zero network attempts
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME before any repo
 * module loads; the fake brain is installed BEFORE tool-router is required.
 * Exit 77 when node:sqlite is missing. House rule: hyphens only, no emoji.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-mcp-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-mcp-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

let DatabaseSync;
try { DatabaseSync = require('node:sqlite').DatabaseSync; } catch (_e) {
  console.log('SKIP: node:sqlite is not available (ENV GAP)');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-mcp');

const FIX = path.join(REPO_ROOT, 'tests/fixtures/364-theo');
function fx(name) { return JSON.parse(fs.readFileSync(path.join(FIX, name + '.json'), 'utf8')); }

// The fake brain is scripted through a mutable cell so one install serves every leg.
const cell = { framework_step: fx('framework-step-all-null'), recommend_chain: fx('recommend-chain-thin') };
const { installFakeBrain } = require(path.join(REPO_ROOT, 'tests/helpers/fake-brain-364.cjs'));
const fake = installFakeBrain({
  framework_step: function () { return cell.framework_step; },
  recommend_chain: function () { return cell.recommend_chain; },
});
const { buildEntryRoom, MARKER } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-364.cjs'));
const toolRouter = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));

const ROOT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-mcp-'));

function register(roomDir) {
  const handlers = {};
  const configs = {};
  const server = {
    registerTool: function (name, cfg, fn) { handlers[name] = fn; configs[name] = cfg; },
    tool: function () {},
  };
  toolRouter.registerRouterTools(server, roomDir, REPO_ROOT, { compact: '' }, 'cli');
  return { handlers: handlers, configs: configs };
}
function text(resp) { return resp && resp.content && resp.content[0] ? String(resp.content[0].text) : ''; }

function filesUnder(dir) {
  const out = [];
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    entries.forEach(function (e) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs); else out.push(abs);
    });
  })(dir);
  return out;
}
function dbCounts(roomDir) {
  const dbFile = filesUnder(roomDir).filter(function (f) { return /room\.db$/.test(f); })[0];
  if (!dbFile) return null;
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    return {
      nodes: db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n,
      edges: db.prepare('SELECT COUNT(*) AS n FROM edges').get().n,
    };
  } finally { db.close(); }
}
// pipeline-state is the one allowed step record; -shm and -wal are SQLite sidecars of a read-only open.
function nonPipeline(files) { return files.filter(function (f) { return !/pipeline-state/i.test(f) && !/room\.db-(shm|wal)$/.test(f); }); }
function statusBlock(t) { const i = t.indexOf('## Scientific Roadmapping status'); return i === -1 ? '' : t.slice(i); }

async function main() {
  // M1 + M2
  const probe = register(path.join(ROOT_DIR, 'probe'));
  C.check('M1 the methodology schema accepts scientific-roadmap',
    probe.configs.methodology.inputSchema.safeParse({ command: 'scientific-roadmap' }).success === true);
  C.check('M1 the schema still rejects an unknown command',
    probe.configs.methodology.inputSchema.safeParse({ command: 'not-a-command' }).success === false);
  const uniq = new Set(toolRouter.ALL_TOOL_COMMANDS.map(function (c) { return String(c).toLowerCase(); }));
  C.check('M2 ALL_TOOL_COMMANDS has 66 unique members', uniq.size === 66, 'size=' + uniq.size);
  C.check('M2 scientific-roadmap is in ALL_TOOL_COMMANDS', uniq.has('scientific-roadmap'));

  // M3: stated_goal, all-null step, thin chain.
  const sg = buildEntryRoom(ROOT_DIR, 'stated_goal');
  const sgBeforeFiles = filesUnder(sg.roomDir);
  const sgBeforeDb = dbCounts(sg.roomDir);
  const sgR = register(sg.roomDir);
  fake.calls.length = 0;
  cell.framework_step = fx('framework-step-all-null');
  cell.recommend_chain = fx('recommend-chain-thin');
  const t3 = text(await sgR.handlers.methodology({ command: 'scientific-roadmap' }));
  C.check('M3 the reference is served', t3.indexOf('# /mos:scientific-roadmap') !== -1, t3.slice(0, 160));
  C.check('M3 the status block heads the entry proposal', t3.indexOf('## Scientific Roadmapping status') !== -1 && t3.indexOf('## Scientific Roadmapping entry check') !== -1);
  C.check('M3 the honest refusal and the research offer', t3.indexOf('Theo has not authored this step yet') !== -1 && t3.indexOf('/mos:research') !== -1);
  C.check('M3 coverage reads uncovered', t3.indexOf('uncovered') !== -1);
  C.check('M3 the Desktop line names gate_render, gate_answer, research_run and Claude Code',
    t3.indexOf('gate_render') !== -1 && t3.indexOf('gate_answer') !== -1 && t3.indexOf('research_run op plan') !== -1 && t3.indexOf('runs in Claude Code') !== -1);

  // M6 on this room
  const calls3 = fake.calls.slice();
  const okShape = calls3.length > 0 && calls3.every(function (c) {
    if (c.tool === 'framework_step') return JSON.stringify(c.args) === JSON.stringify({ framework: 'Scientific Roadmapping' });
    if (c.tool === 'recommend_chain') return JSON.stringify(c.args) === JSON.stringify({ problem_type: 'WellDefined', max_steps: 6 });
    return false;
  });
  C.check('M6 only framework_step {framework} and recommend_chain {WellDefined, 6} cross', okShape, JSON.stringify(calls3));
  C.check('M6 the planted room marker never reaches a call', JSON.stringify(calls3).indexOf(MARKER) === -1 && t3.indexOf(MARKER) !== -1, 'marker in call or absent from entry');

  // M7 on this room
  const sgAfterFiles = filesUnder(sg.roomDir);
  const sgAdded = nonPipeline(sgAfterFiles).filter(function (f) { return sgBeforeFiles.indexOf(f) === -1; });
  C.check('M7 nothing new under the room but the pipeline-state step record', sgAdded.length === 0, JSON.stringify(sgAdded));
  const sgAfterDb = dbCounts(sg.roomDir);
  C.check('M7 node and edge counts unchanged', JSON.stringify(sgBeforeDb) === JSON.stringify(sgAfterDb), JSON.stringify([sgBeforeDb, sgAfterDb]));
  C.check('M7 no research-plan folder', !fs.existsSync(path.join(sg.roomDir, 'research-plan')));

  // M4: authored fixture lists the seven labels in list order.
  cell.framework_step = fx('framework-step-authored');
  const t4 = text(await sgR.handlers.methodology({ command: 'scientific-roadmap' }));
  const labels = ['Tension Qualification', 'Goal Quantification', 'Rung Placement and Type Selection', 'Forum Construction', 'Path Enumeration', 'Constraint Interrogation', 'Catalytic Ranking'];
  const block4 = statusBlock(t4);
  const idx = labels.map(function (l) { return block4.indexOf(l); });
  C.check('M4 all seven step labels appear in list order',
    idx.every(function (i) { return i !== -1; }) && idx.every(function (i, k) { return k === 0 || i > idx[k - 1]; }), JSON.stringify(idx));
  C.check('M4 the non-runnable rows never appear', block4.indexOf('FIXTURE DEFINITION') === -1 && block4.indexOf('FIXTURE ASIDE') === -1);
  C.check('M4 the refusal text is absent once the step is authored', block4.indexOf('Theo has not authored this step yet') === -1);

  // M5: an empty room routes to analyze-needs and makes zero Theo calls.
  const em = buildEntryRoom(ROOT_DIR, 'empty');
  const emR = register(em.roomDir);
  fake.calls.length = 0;
  const t5 = text(await emR.handlers.methodology({ command: 'scientific-roadmap' }));
  C.check('M5 an empty room routes to /mos:analyze-needs', t5.indexOf('/mos:analyze-needs') !== -1, t5.slice(0, 200));
  C.check('M5 an empty room makes zero Theo calls', fake.calls.length === 0, JSON.stringify(fake.calls));
  C.check('M5 an empty room never prints Theo step lines', t5.indexOf('### Theo steps') === -1);

  // M6 sweep: more room states, same wire rule.
  fake.calls.length = 0;
  const states = ['fresh_gq', 'fresh_claim', 'prior_run', 'quantified_goal'];
  for (const st of states) {
    const rm = buildEntryRoom(ROOT_DIR, st);
    await register(rm.roomDir).handlers.methodology({ command: 'scientific-roadmap' });
  }
  C.check('M6 across more room states no call carries the marker or any key but the fixed ones',
    JSON.stringify(fake.calls).indexOf(MARKER) === -1
    && fake.calls.every(function (c) { return c.tool === 'framework_step' || c.tool === 'recommend_chain'; }),
    JSON.stringify(fake.calls).slice(0, 300));

  // M8: another methodology command has no status block and no Theo call.
  fake.calls.length = 0;
  const t8 = text(await sgR.handlers.methodology({ command: 'lean-canvas' }));
  C.check('M8 lean-canvas carries no Scientific Roadmapping status', t8.indexOf('## Scientific Roadmapping status') === -1 && t8.length > 0);
  C.check('M8 lean-canvas makes no Theo call', fake.calls.length === 0);

  // M9: an entry check that throws still returns the reference plus a plain line.
  const srEntryPath = require.resolve(path.join(REPO_ROOT, 'lib/core/research-planner/sr-entry.cjs'));
  const realEntry = require(srEntryPath);
  require.cache[srEntryPath].exports = Object.assign({}, realEntry, { resolveEntry: function () { throw new Error('scripted entry failure'); } });
  let t9 = '';
  let threw = false;
  try { t9 = text(await sgR.handlers.methodology({ command: 'scientific-roadmap' })); } catch (_e) { threw = true; }
  finally { require.cache[srEntryPath].exports = realEntry; }
  C.check('M9 a throwing entry check never throws out of the handler', threw === false);
  C.check('M9 the reference is still served and a plain unavailable line follows',
    t9.indexOf('# /mos:scientific-roadmap') !== -1 && statusBlock(t9).indexOf('entry check is unavailable') !== -1, statusBlock(t9).slice(0, 200));

  // M10
  C.check('M10 zero network attempts', net.attempts() === 0, 'attempts=' + net.attempts());
  const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  C.check('M10 no em-dash or en-dash in this test or the appended status block',
    !DASH.test(fs.readFileSync(__filename, 'utf8')) && !DASH.test(statusBlock(t3)) && !DASH.test(statusBlock(t4)));
}

main().then(function () {
  fake.restore();
  const code = C.summary();
  try { fs.rmSync(ROOT_DIR, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(code);
}).catch(function (e) {
  console.log('FAIL: unexpected error ' + (e && e.stack || e));
  process.exit(1);
});
