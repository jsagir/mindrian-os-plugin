#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 03 (EPV366-13, D-01, D-02), rewritten by plan 366-22
 * (EPV366-25): /mos:eureka is the quick-run alias on the perspective path,
 * and the standalone runner is deleted, so no flag reaches it on any surface.
 *
 *   A1  intelligence eureka-run with any context (none, malformed JSON,
 *       non-true legacy values, other flags) answers with a pointer to
 *       research_run op perspective_recall (perspective "eureka", plan 366-16)
 *       and starts nothing: zero spawns, no .mindrian/eureka state, on both
 *       the http and stdio transports.
 *   A2  context {"legacy":true} is ignored: eureka-run answers the same
 *       pointer, carries no deprecation line and spawns nothing.
 *   A3  eureka-status and eureka-report answer the pointer with and without
 *       the old legacy flag.
 *   A4  commands/eureka.md: no ZERO wording, no --legacy and no legacy runner
 *       section, the default run calls research-planner.cjs eureka-recall and
 *       never names the deleted runner, the enable subcommand survives on the
 *       eureka-enable installer; the mirror agrees.
 *   A5  ALL_TOOL_COMMANDS stays 66 and the three eureka compute names stay on
 *       the intelligence enum; the router reads no flags.legacy and names no
 *       runner file; zero network attempts.
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temp dirs set before
 * any repo module loads; child_process.spawn is replaced by a counter, so no
 * real process ever starts.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

const toolRouter = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));

// The deprecation line the deleted legacy path printed. It must never come back.
const OLD_NOTICE = 'The standalone Eureka runner is retired when the Phase 366 spike closes';

const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-alias-room-'));
const handlers = {};
const configs = {};
const server = { registerTool: function (name, cfg, fn) { handlers[name] = fn; configs[name] = cfg; }, tool: function () {} };
toolRouter.registerRouterTools(server, roomDir, REPO_ROOT, { compact: '' }, 'cli');

function text(resp) { return resp && resp.content && resp.content[0] ? String(resp.content[0].text) : ''; }
function isPointer(resp) {
  const t = text(resp);
  return resp && resp.isError !== true && t.indexOf('research_run') !== -1 && t.indexOf('perspective_recall') !== -1
    && t.indexOf('perspective "eureka"') !== -1 && t.indexOf('legacy') === -1 && t.indexOf(OLD_NOTICE) === -1;
}
function eurekaStateAbsent() { return !fs.existsSync(path.join(roomDir, '.mindrian', 'eureka')); }

async function main() {
  const intel = handlers.intelligence;
  C.check('the intelligence handler is registered', typeof intel === 'function');

  // A1: every context answers the pointer and starts nothing, on both transports.
  for (const transport of ['http', 'stdio']) {
    process.env.MINDRIAN_TRANSPORT = transport;
    const contexts = [undefined, '', '{bad json', '{"legacy":"true"}', '{"legacy":1}', '[true]', 'null', '{"offline":true}'];
    for (const ctx of contexts) {
      const before = spawnCount;
      const resp = await intel(ctx === undefined ? { command: 'eureka-run' } : { command: 'eureka-run', context: ctx }, {});
      C.check('A1 [' + transport + '] eureka-run context=' + JSON.stringify(ctx) + ' answers the research_run pointer', isPointer(resp), text(resp).slice(0, 160));
      C.check('A1 [' + transport + '] eureka-run context=' + JSON.stringify(ctx) + ' starts nothing', spawnCount === before);
    }
  }

  // A2: the old legacy flag is ignored on both transports.
  for (const transport of ['http', 'stdio']) {
    process.env.MINDRIAN_TRANSPORT = transport;
    for (const ctx of ['{"legacy":true}', JSON.stringify({ legacy: true, offline: true })]) {
      const resp = await intel({ command: 'eureka-run', context: ctx }, {});
      await new Promise(function (r) { setImmediate(r); });
      C.check('A2 [' + transport + '] eureka-run context=' + ctx + ' ignores the flag and answers the pointer', isPointer(resp), text(resp).slice(0, 160));
      C.check('A2 [' + transport + '] eureka-run context=' + ctx + ' carries no deprecation line', text(resp).indexOf(OLD_NOTICE) === -1);
    }
  }
  C.check('A1/A2 zero spawns across every eureka-run call', spawnCount === 0, 'spawn=' + spawnCount);
  C.check('A1/A2 no .mindrian/eureka state was written', eurekaStateAbsent());

  // A3: status and report answer the pointer with and without the old flag.
  for (const cmd of ['eureka-status', 'eureka-report']) {
    for (const ctx of ['', '{"legacy":true}']) {
      const resp = await intel({ command: cmd, context: ctx }, {});
      C.check('A3 ' + cmd + ' context=' + JSON.stringify(ctx) + ' answers the research_run pointer', isPointer(resp), text(resp).slice(0, 160));
    }
  }
  C.check('A3 status and report wrote no .mindrian/eureka state', eurekaStateAbsent());

  // A4: static legs on the door and its generated mirror.
  const door = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'eureka.md'), 'utf8');
  const mirror = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'eureka', 'SKILL.md'), 'utf8');
  C.check('A4 commands/eureka.md has no ZERO writes / ZERO network wording', !/ZERO (writes|network)/i.test(door));
  C.check('A4 skills/eureka/SKILL.md has no ZERO writes / ZERO network wording', !/ZERO (writes|network)/i.test(mirror));
  C.check('A4 commands/eureka.md no longer names --legacy', door.indexOf('--legacy') === -1);
  C.check('A4 skills/eureka/SKILL.md no longer names --legacy', mirror.indexOf('--legacy') === -1);
  C.check('A4 the door has no legacy runner section', !/^##+ Legacy/m.test(door));
  C.check('A4 the door never names the deleted runner', door.indexOf('eureka-command') === -1 && door.indexOf('eureka-portfolio-report') === -1);
  C.check('A4 the door carries no deprecation line', door.indexOf(OLD_NOTICE) === -1);
  C.check('A4 the default run calls research-planner.cjs eureka-recall', door.indexOf('research-planner.cjs" eureka-recall') !== -1);
  C.check('A4 the enable subcommand runs the eureka-enable installer', door.indexOf('## Subcommand: enable') !== -1 && door.indexOf('lib/core/eureka/eureka-enable.cjs') !== -1);
  C.check('A4 the door declares the Form B stages F.6, F.0 and F.8', /hitl_stages:/.test(door) && /"F\.6"/.test(door) && /"F\.0"/.test(door) && /"F\.8"/.test(door));
  C.check('A4 the door carries no em-dash or en-dash', !new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(door));

  // A5: surface pins and network.
  const uniq = new Set(toolRouter.ALL_TOOL_COMMANDS.map(function (c) { return String(c).toLowerCase(); }));
  // Phase 364-08: methodology gains scientific-roadmap (Tri-Polar reach for /mos:scientific-roadmap)
  C.check('A5 ALL_TOOL_COMMANDS stays 66', uniq.size === 66, 'size=' + uniq.size);
  C.check('A5 no eureka compute name leaked into ALL_TOOL_COMMANDS', ['eureka-run', 'eureka-status', 'eureka-report'].every(function (c) { return toolRouter.ALL_TOOL_COMMANDS.indexOf(c) === -1; }));
  const cmdSchema = configs.intelligence && configs.intelligence.inputSchema && configs.intelligence.inputSchema.shape
    ? configs.intelligence.inputSchema.shape.command : null;
  const enumOpts = cmdSchema && Array.isArray(cmdSchema.options) ? cmdSchema.options : [];
  C.check('A5 the three eureka compute names stay on the intelligence enum', ['eureka-run', 'eureka-status', 'eureka-report'].every(function (c) { return enumOpts.indexOf(c) !== -1; }), JSON.stringify(enumOpts));
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');
  C.check('A5 the router reads no flags.legacy', src.indexOf('flags.legacy') === -1);
  C.check('A5 the router names no runner file', src.indexOf('eureka-command') === -1 && src.indexOf('eureka-portfolio-report') === -1);
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
