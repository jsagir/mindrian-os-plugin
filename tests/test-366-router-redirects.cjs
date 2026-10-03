#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 16 Task 1 (D-06, EPV366-10, EPV366-11, T-366-66, T-366-69):
 * the reference-only router stubs point at the perspective ops of research_run.
 *
 *   D1  analysis find-bottlenecks names research_run, op perspective_recall,
 *       perspective "rs", and the paging and Stage A ops
 *   D2  intelligence whitespace names perspective "whitespace"
 *   D3  orchestration scout-hsi names perspective "hsi" and no longer says
 *       "reference only, no compute"; its NOT EXECUTED banner and nothing
 *       written are unchanged
 *   D4  intelligence eureka-run/status/report name op perspective_recall and
 *       perspective "eureka"; the legacy escape is gone (plan 366-22 deleted
 *       the standalone runner, so the pointer no longer names {"legacy":true})
 *   D5  the surface fence: ALL_TOOL_COMMANDS stays 66, find-bottlenecks and
 *       find-analogies stay reachable, every command name stays in its enum, and
 *       no tool description still calls these three reference-only
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME set before any repo
 * module loads; the network guard is installed first.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-redir-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-redir-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-router-redirects');

const toolRouter = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));

const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-redir-room-'));
const handlers = {};
const configs = {};
const server = {
  registerTool: function (name, cfg, fn) { handlers[name] = fn; configs[name] = cfg; },
  tool: function () {},
};
toolRouter.registerRouterTools(server, roomDir, REPO_ROOT, { compact: '' }, 'cli');

function text(resp) { return resp && resp.content && resp.content[0] ? String(resp.content[0].text) : ''; }

/** The one-line pointer: names the tool, the op and the perspective id. */
function pointsAt(t, id) {
  return t.indexOf('research_run') !== -1
    && t.indexOf('perspective_recall') !== -1
    && t.indexOf('perspective "' + id + '"') !== -1;
}

function filesUnder(dir) {
  const out = [];
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entries) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs); else out.push(abs);
    }
  })(dir);
  return out;
}

async function main() {
  const before = filesUnder(roomDir).length;

  // D1
  const bott = await handlers.analysis({ command: 'find-bottlenecks' }, {});
  C.check('D1 analysis find-bottlenecks points at perspective_recall with perspective "rs"', pointsAt(text(bott), 'rs'), text(bott).slice(0, 200));
  C.check('D1 the pointer names perspective_candidates and perspective_judge', text(bott).indexOf('perspective_candidates') !== -1 && text(bott).indexOf('perspective_judge') !== -1);
  C.check('D1 find-bottlenecks is not an error response', bott && bott.isError !== true);

  // D2
  const ws = await handlers.intelligence({ command: 'whitespace' }, {});
  C.check('D2 intelligence whitespace points at perspective_recall with perspective "whitespace"', pointsAt(text(ws), 'whitespace'), text(ws).slice(0, 200));
  C.check('D2 whitespace is not an error response', ws && ws.isError !== true);

  // D3
  const hsi = await handlers.orchestration({ command: 'scout-hsi' }, {});
  const hsiText = text(hsi);
  C.check('D3 orchestration scout-hsi points at perspective_recall with perspective "hsi"', pointsAt(hsiText, 'hsi'), hsiText.slice(0, 300));
  C.check('D3 scout-hsi no longer says "reference only, no compute"', hsiText.indexOf('reference only, no compute') === -1);
  C.check('D3 scout-hsi keeps the NOT EXECUTED banner (the scout family is still unimplemented here)', hsiText.indexOf('NOT EXECUTED') !== -1);
  C.check('D3 scout-hsi still names the full CLI pipeline /mos:scout hsi', hsiText.indexOf('/mos:scout hsi') !== -1);

  // D4
  process.env.MINDRIAN_TRANSPORT = 'http';
  for (const cmd of ['eureka-run', 'eureka-status', 'eureka-report']) {
    const r = await handlers.intelligence({ command: cmd }, {});
    const t = text(r);
    C.check('D4 ' + cmd + ' points at perspective_recall with perspective "eureka"', pointsAt(t, 'eureka'), t.slice(0, 200));
    C.check('D4 ' + cmd + ' no longer names the deprecated eureka_recall op', t.indexOf('eureka_recall') === -1);
    C.check('D4 ' + cmd + ' no longer names a legacy escape (366-22)', t.indexOf('legacy') === -1);
  }
  delete process.env.MINDRIAN_TRANSPORT;

  const written = filesUnder(roomDir).filter(function (f) { return !/pipeline-state/i.test(f); });
  C.check('D1-D4 wrote nothing under the room but the analysis pipeline-state step record', written.length === before, JSON.stringify(written));

  // D5: the fence and the honest descriptions.
  const uniq = new Set(toolRouter.ALL_TOOL_COMMANDS.map(function (c) { return String(c).toLowerCase(); }));
  // Phase 364-08: methodology gains scientific-roadmap (Tri-Polar reach for /mos:scientific-roadmap)
  C.check('D5 ALL_TOOL_COMMANDS stays 66', uniq.size === 66, 'size=' + uniq.size);
  C.check('D5 find-bottlenecks and find-analogies stay MCP-reachable', uniq.has('find-bottlenecks') && uniq.has('find-analogies'));
  function enumOf(tool) {
    try {
      const f = configs[tool].inputSchema.shape.command;
      return Array.from(f.options || (f._def && (f._def.values || f._def.entries) && Object.values(f._def.values || f._def.entries)) || []);
    } catch (_e) { return []; }
  }
  C.check('D5 find-bottlenecks, whitespace and scout-hsi stay in their router enums',
    enumOf('analysis').indexOf('find-bottlenecks') !== -1 && enumOf('intelligence').indexOf('whitespace') !== -1 && enumOf('orchestration').indexOf('scout-hsi') !== -1,
    'analysis=' + enumOf('analysis').length + ' intelligence=' + enumOf('intelligence').length + ' orchestration=' + enumOf('orchestration').length);
  const orchDesc = String(configs.orchestration && configs.orchestration.description || '');
  const anaDesc = String(configs.analysis && configs.analysis.description || '');
  const intDesc = String(configs.intelligence && configs.intelligence.description || '');
  C.check('D5 orchestration description names scout-hsi and perspective_recall', orchDesc.indexOf('scout-hsi') !== -1 && orchDesc.indexOf('perspective_recall') !== -1, orchDesc.slice(0, 120));
  C.check('D5 no description calls scout-hsi reference only', orchDesc.indexOf('reference only, no compute') === -1);
  C.check('D5 analysis description does not call find-bottlenecks reference-only', !/find-bottlenecks[^.]{0,60}reference[- ]only/i.test(anaDesc));
  C.check('D5 intelligence description does not call whitespace reference-only', !/whitespace[^.]{0,60}reference[- ]only/i.test(intDesc));
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');
  C.check('D5 the router source has no "reference only, no compute" left', src.indexOf('reference only, no compute') === -1);
  C.check('D5 the router source names perspective_recall at least 4 times', (src.match(/perspective_recall/g) || []).length >= 4);
  C.check('D5 zero network attempts', net.attempts() === 0, 'attempts=' + net.attempts());
}

main().then(function () {
  const code = C.summary();
  cleanup();
  process.exit(code);
}, function (err) {
  console.log('FAIL: unexpected error (' + String(err && err.stack ? err.stack : err) + ')');
  C.summary();
  cleanup();
  process.exit(1);
});

function cleanup() {
  net.restore();
  for (const d of [roomDir, TMP_HOME, process.env.MINDRIAN_ROOMS_HOME]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}
