#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 03 (EPV366-13, D-01, D-02): /mos:eureka is the quick-run
 * alias on the perspective path, and the standalone runner is reachable only
 * behind an explicit legacy flag on both surfaces.
 *
 *   A1  intelligence eureka-run with no context (and with a malformed or
 *       non-true legacy flag) answers with a pointer to research_run op
 *       eureka_recall and starts nothing: zero spawns, zero in-process runs,
 *       no .mindrian/eureka state, on both the http and stdio transports.
 *   A2  eureka-run with context {"legacy":true} reaches the existing runner
 *       (in-process on http, one detached spawn on stdio) and the response
 *       carries the one deprecation line.
 *   A3  eureka-status and eureka-report answer the pointer without the flag
 *       and the runner's state (with the deprecation line) with it.
 *   A4  commands/eureka.md: no ZERO wording, names --legacy, the default run
 *       calls research-planner.cjs eureka-recall; the mirror agrees.
 *   A5  ALL_TOOL_COMMANDS stays 65 and the three eureka compute names stay on
 *       the enum; zero network attempts.
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temp dirs set before
 * any repo module loads; child_process.spawn and scripts/eureka-command.cjs are
 * replaced by counters, so no real scan ever runs.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-alias-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-alias-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
const SAVED_TRANSPORT = process.env.MINDRIAN_TRANSPORT;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-eureka-alias');

// --- spawn seam: count every child the router would start ---------------
const cp = require('node:child_process');
const realSpawn = cp.spawn;
let spawnCount = 0;
cp.spawn = function countingSpawn() { spawnCount += 1; return { unref: function () {}, on: function () {} }; };

// --- in-process seam: a counting stand-in for scripts/eureka-command.cjs ---
const EC_PATH = path.join(REPO_ROOT, 'scripts', 'eureka-command.cjs');
let mainCount = 0;
const stub = new Module(EC_PATH);
stub.filename = EC_PATH;
stub.loaded = true;
stub.exports = { main: async function () { mainCount += 1; } };
require.cache[EC_PATH] = stub;

const toolRouter = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));

const NOTICE = 'The standalone Eureka runner is retired when the Phase 366 spike closes; this path exists only until then.';

const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-alias-room-'));
const handlers = {};
const server = { registerTool: function (name, cfg, fn) { handlers[name] = fn; }, tool: function () {} };
toolRouter.registerRouterTools(server, roomDir, REPO_ROOT, { compact: '' }, 'cli');

function text(resp) { return resp && resp.content && resp.content[0] ? String(resp.content[0].text) : ''; }
function isPointer(resp) {
  const t = text(resp);
  return resp && resp.isError !== true && t.indexOf('research_run') !== -1 && t.indexOf('eureka_recall') !== -1
    && t.indexOf('{"legacy":true}') !== -1 && t.indexOf(NOTICE) === -1;
}
function eurekaStateAbsent() { return !fs.existsSync(path.join(roomDir, '.mindrian', 'eureka')); }

async function main() {
  const intel = handlers.intelligence;
  C.check('the intelligence handler is registered', typeof intel === 'function');

  // A1: the default answers the pointer and starts nothing, on both transports.
  for (const transport of ['http', 'stdio']) {
    process.env.MINDRIAN_TRANSPORT = transport;
    const contexts = [undefined, '', '{bad json', '{"legacy":"true"}', '{"legacy":1}', '[true]', 'null', '{"offline":true}'];
    for (const ctx of contexts) {
      const before = spawnCount + mainCount;
      const resp = await intel(ctx === undefined ? { command: 'eureka-run' } : { command: 'eureka-run', context: ctx }, {});
      C.check('A1 [' + transport + '] eureka-run context=' + JSON.stringify(ctx) + ' answers the research_run pointer', isPointer(resp), text(resp).slice(0, 160));
      C.check('A1 [' + transport + '] eureka-run context=' + JSON.stringify(ctx) + ' starts nothing', spawnCount + mainCount === before);
    }
  }
  C.check('A1 zero spawns and zero in-process runs without the legacy flag', spawnCount === 0 && mainCount === 0, 'spawn=' + spawnCount + ' main=' + mainCount);
  C.check('A1 no .mindrian/eureka state was written without the legacy flag', eurekaStateAbsent());

  // A3 (default half): status and report answer the pointer without the flag.
  for (const cmd of ['eureka-status', 'eureka-report']) {
    const resp = await intel({ command: cmd, context: '' }, {});
    C.check('A3 ' + cmd + ' without the flag answers the research_run pointer', isPointer(resp), text(resp).slice(0, 160));
  }

  // A2: the legacy flag reaches the existing runner, with the deprecation line.
  process.env.MINDRIAN_TRANSPORT = 'http';
  const httpResp = await intel({ command: 'eureka-run', context: JSON.stringify({ legacy: true, offline: true }) }, {});
  await new Promise(function (r) { setImmediate(r); });
  const httpText = text(httpResp);
  C.check('A2 [http] legacy eureka-run carries the deprecation line first', httpText.indexOf(NOTICE) === 0, httpText.slice(0, 160));
  C.check('A2 [http] legacy eureka-run reaches the runner in-process', mainCount === 1 && httpText.indexOf('"state":"started"') !== -1 && httpText.indexOf('"mode":"in-process"') !== -1, 'main=' + mainCount);
  process.env.MINDRIAN_TRANSPORT = 'stdio';
  const stdioResp = await intel({ command: 'eureka-run', context: '{"legacy":true}' }, {});
  const stdioText = text(stdioResp);
  C.check('A2 [stdio] legacy eureka-run carries the deprecation line first', stdioText.indexOf(NOTICE) === 0, stdioText.slice(0, 160));
  C.check('A2 [stdio] legacy eureka-run detaches exactly one child', spawnCount === 1 && stdioText.indexOf('"mode":"detached"') !== -1, 'spawn=' + spawnCount);

  // A3 (legacy half): status and report reach the runner state.
  const st = await intel({ command: 'eureka-status', context: '{"legacy":true}' }, {});
  C.check('A3 legacy eureka-status carries the deprecation line and the runner state', text(st).indexOf(NOTICE) === 0 && text(st).indexOf('"state":"none"') !== -1, text(st).slice(0, 200));
  const rp = await intel({ command: 'eureka-report', context: '{"legacy":true}' }, {});
  C.check('A3 legacy eureka-report carries the deprecation line and the runner answer', text(rp).indexOf(NOTICE) === 0 && text(rp).indexOf('no eureka report yet') !== -1, text(rp).slice(0, 200));

  // A4: static legs on the door and its generated mirror.
  const door = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'eureka.md'), 'utf8');
  const mirror = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'eureka', 'SKILL.md'), 'utf8');
  C.check('A4 commands/eureka.md has no ZERO writes / ZERO network wording', !/ZERO (writes|network)/i.test(door));
  C.check('A4 skills/eureka/SKILL.md has no ZERO writes / ZERO network wording', !/ZERO (writes|network)/i.test(mirror));
  C.check('A4 commands/eureka.md names --legacy at least twice', (door.match(/--legacy/g) || []).length >= 2);
  C.check('A4 the default run calls research-planner.cjs eureka-recall', door.indexOf('research-planner.cjs" eureka-recall') !== -1);
  C.check('A4 the door carries the deprecation line verbatim', door.indexOf(NOTICE) !== -1);
  const defaultRun = door.split('## Subcommand: run (default)')[1] ? door.split('## Subcommand: run (default)')[1].split('## Legacy runner (--legacy)')[0] : '';
  C.check('A4 the default run never calls scripts/eureka-command.cjs', defaultRun.length > 0 && defaultRun.indexOf('eureka-command.cjs') === -1);
  C.check('A4 the door declares the Form B stages F.6, F.0 and F.8', /hitl_stages:/.test(door) && /"F\.6"/.test(door) && /"F\.0"/.test(door) && /"F\.8"/.test(door));
  C.check('A4 the door carries no em-dash or en-dash', !new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(door));

  // A5: surface pins and network.
  const uniq = new Set(toolRouter.ALL_TOOL_COMMANDS.map(function (c) { return String(c).toLowerCase(); }));
  C.check('A5 ALL_TOOL_COMMANDS stays 65', uniq.size === 65, 'size=' + uniq.size);
  C.check('A5 no eureka compute name leaked into ALL_TOOL_COMMANDS', ['eureka-run', 'eureka-status', 'eureka-report'].every(function (c) { return toolRouter.ALL_TOOL_COMMANDS.indexOf(c) === -1; }));
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');
  C.check('A5 the router gate reads flags.legacy === true', /flags\.legacy\s*===\s*true/.test(src));
  C.check('A5 zero network attempts', net.attempts() === 0, 'attempts=' + net.attempts());
}

main().then(function () {
  const code = C.summary();
  cleanup();
  process.exit(code);
}, function (err) {
  console.log('FAIL: unexpected error (' + String(err && err.message ? err.message : err) + ')');
  C.summary();
  cleanup();
  process.exit(1);
});

function cleanup() {
  cp.spawn = realSpawn;
  net.restore();
  if (SAVED_TRANSPORT === undefined) delete process.env.MINDRIAN_TRANSPORT; else process.env.MINDRIAN_TRANSPORT = SAVED_TRANSPORT;
  for (const d of [roomDir, TMP_HOME, process.env.MINDRIAN_ROOMS_HOME]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}
