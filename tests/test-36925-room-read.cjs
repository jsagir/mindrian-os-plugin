#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 23 (FCLOSE-01, FEYMINTO-CROSS row 8): the real-room run reads every nest's FeyMinto and prints, per
 * nest, asked / not asked, the frameworks named and the commands runnable here.
 *
 * Arms:
 *   RR1  `real-room-run --offline --json` carries jobs.feyminto with one entry per core section, each asked false
 *        with not_asked_reason offline; the text report has a "== FeyMinto ==" section whose per-nest lines carry the
 *        section names and "not asked: this run was offline", and no room id and no node id string
 *   RR2  readRoomFeyMinto on a room whose faces were derived with an injected callTool (canned rows) reports asked
 *        true, frameworks_named from suggested_frameworks and commands_runnable_here from the cli markers of
 *        suggested_commands (checked against the raw BRAIN.md frontmatter, not through the module under test)
 *   RR4  the hermetic offline receipt carries feyminto.nests (counts only, never names or ids)
 *   RR3  formatFeyMintoBlock voice: It tried / per-nest lines / It could not; names only
 *   dash guard
 *
 * Isolation: every spawn gets HOME, USERPROFILE and MINDRIAN_ROOMS_HOME in a mkdtemp directory; --offline for the
 * spawned runs; the in-process derivation uses a fake brain-client (no network). Nothing touches ~/MindrianRooms or
 * ~/.mindrian.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const RUN = path.join(ROOT, 'scripts', 'real-room-run.cjs');
const MOD = path.join(ROOT, 'lib', 'core', 'feyminto', 'room-read.cjs');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + String(detail).slice(0, 700) : '')); }
}
function safe(fn, fallback) { try { return fn(); } catch (_e) { return fallback; } }

const CORE = Object.keys(require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs')).CORE_SECTIONS);

function lastJson(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i][0] === '{') { try { return JSON.parse(lines[i]); } catch (_e) { /* next */ } }
  }
  return null;
}

// ---- canned Theo (the same envelope theo-wiring uses) ------------------------------------------------------------
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
const NAV_CMDS = REG.filter((c) => c.surface === 'navigator').map((c) => c.command.replace(/^\/mos:/, ''));
function theoGood(tool, args) {
  if (tool === 'find_frameworks_for_problem_type') {
    return { rows: [{ problemType: args.problem_type, chapters: [{ chapterId: 'ch-01', phaseLabel: 'Frame the problem', toolTypes: ['Matrix'] }], matched: 1, total: 9 }], coverage: { matched: 1, total: 9, status: 'partial' } };
  }
  if (tool === 'commands_for_problem_type') return { rows: [{ command: NAV_CMDS[0], jtbd: 'Name the problem', framework: '5 Whys Technique' }] };
  if (tool === 'recommend_chain') return { grounded: true, chain: [{ step: 1, framework: '5 Whys Technique' }, { step: 2, framework: '80/20 Rule' }] };
  if (tool === 'framework_neighborhood') return { name: args.framework, chapters: [{ id: 'ch-07', label: 'Chapter 7' }], brainRecords: [], commands: [] };
  return null;
}
function installFakeBrain() {
  const bc = require.resolve('../lib/core/brain-client.cjs');
  const real = require(bc);
  const fake = {
    isAvailable: () => true,
    schema: async () => ({ brain_graph_version: 21432 }),
    query: async () => ({ records: [{ name: 'SWOT', description: 'x' }] }),
    search: async () => ({ matches: [{ title: 'Analogy 1', score: 0.8 }] }),
    smartSearch: async () => null,
    callTool: async (tool, args) => theoGood(tool, args),
    getBrainUrl: () => 'https://theo-stub.invalid',
    _test: real._test,
  };
  require.cache[bc] = { id: bc, filename: bc, loaded: true, exports: fake };
  delete require.cache[require.resolve('../lib/core/brain-derivation.cjs')];
  delete require.cache[require.resolve('../lib/core/brain-derivation-prompts.cjs')];
  delete require.cache[MOD];
}

function frontmatterLine(text, key) {
  const m = new RegExp('^' + key + ':[ \\t]*(.*)$', 'm').exec(text);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
}
function decodeScalar(s) { try { return decodeURIComponent(s); } catch (_e) { return s; } }

async function main() {
  // ---- RR1 -----------------------------------------------------------------------------------------------------
  const iso = H.mkIsolatedHome('rr1');
  const env = Object.assign({}, iso.env);
  delete env.TAVILY_API_KEY;
  const r1 = cp.spawnSync(process.execPath, [RUN, '--offline', '--json', '--rooms-home', iso.roomsHome, '--receipt-dir', path.join(iso.home, 'receipts')], { encoding: 'utf8', env, timeout: 240000, maxBuffer: 32 * 1024 * 1024 });
  const json = lastJson(r1.stdout);
  check('RR1 setup: the offline run exits 0 and prints JSON', r1.status === 0 && !!json && json.ok === true, 'code ' + r1.status + ' ' + String(r1.stderr).slice(-300));
  const entries = json && json.jobs && json.jobs.feyminto;
  check('RR1 jobs.feyminto has one entry per core section (' + CORE.length + ')', Array.isArray(entries) && entries.length === CORE.length && CORE.every((n) => entries.some((e) => e.nest === n)), String(JSON.stringify(entries)).slice(0, 300));
  check('RR1 every entry is asked false with not_asked_reason offline and the plain line',
    Array.isArray(entries) && entries.length > 0 && entries.every((e) => e.asked === false && e.not_asked_reason === 'offline' && e.not_asked_line === 'not asked: this run was offline'), String(JSON.stringify(entries && entries[0])));

  const r1t = cp.spawnSync(process.execPath, [RUN, '--offline', '--rooms-home', iso.roomsHome, '--receipt-dir', path.join(iso.home, 'receipts')], { encoding: 'utf8', env, timeout: 240000, maxBuffer: 32 * 1024 * 1024 });
  const text = String(r1t.stdout || '');
  const block = (/== FeyMinto ==[\s\S]*?(?=\n== |\nNO RECEIPT|\nRECEIPT|$)/.exec(text) || [''])[0];
  check('RR1 the text report has a "== FeyMinto ==" section in the report voice', block.length > 0 && /It tried:/.test(block) && /It could not:/.test(block), text.slice(0, 600));
  check('RR1 each nest has a line with its section name and "not asked: this run was offline"',
    CORE.every((n) => block.split('\n').some((l) => l.indexOf(n) !== -1 && l.indexOf('not asked: this run was offline') !== -1)), block.slice(0, 900));
  const roomDir = json && json.room && json.room.dir;
  const rid = roomDir ? safe(() => require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')).readRoomIdentity(roomDir, { door: 'in_place' }).room_id, null) : null;
  check('RR1 the block names no room id, no node id and no path',
    !!block && (!rid || (block.indexOf(rid) === -1 && String(JSON.stringify(entries)).indexOf(rid) === -1)) && !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/.test(block) && !/room_id|node_id/.test(block) && block.indexOf(iso.home) === -1, block.slice(0, 500));
  check('RR1 the text report prints the FeyMinto block before the negative block', text.indexOf('== FeyMinto ==') !== -1 && text.indexOf('== FeyMinto ==') < text.indexOf('== Negative leg: rooms that are not ready =='));

  // RR4: the receipt carries the per-nest feyminto summary (hermetic: temp HOME, temp receipt dir, offline)
  const rc4 = path.join(iso.home, 'rr4-receipts');
  const r4 = cp.spawnSync(process.execPath, [RUN, '--offline', '--json', '--read-by', 'Test Reader', '--rooms-home', path.join(iso.home, 'rr4-rooms'), '--receipt-dir', rc4], { encoding: 'utf8', env, timeout: 240000, maxBuffer: 32 * 1024 * 1024 });
  const rfiles = safe(() => fs.readdirSync(rc4).filter((f) => /\.json$/.test(f)), []);
  const receipt = rfiles.length === 1 ? safe(() => JSON.parse(fs.readFileSync(path.join(rc4, rfiles[0]), 'utf8')), null) : null;
  const nests = receipt && receipt.feyminto && receipt.feyminto.nests;
  check('RR4 the hermetic receipt carries feyminto.nests with one summary per core nest: nest, asked, not_asked_reason, counts of frameworks and commands',
    r4.status === 0 && Array.isArray(nests) && nests.length === CORE.length && nests.every((n) => typeof n.nest === 'string' && n.asked === false && n.not_asked_reason === 'offline' && n.frameworks_named === 0 && n.commands_runnable_here === 0), 'code ' + r4.status + ' ' + String(JSON.stringify(receipt && receipt.feyminto)).slice(0, 400));

  // ---- RR2 -----------------------------------------------------------------------------------------------------
  const iso2 = H.mkIsolatedHome('rr2');
  const born = H.birthFixtureRoom({ iso: iso2, slug: 'rr2-room' });
  check('RR2 setup: a born room', born && born.ok === true, JSON.stringify(born).slice(0, 200));
  // one nest with artifacts that name frameworks and a generated MINTO.md, so it carries a handle to send
  const SEC = 'problem-definition';
  fs.writeFileSync(path.join(born.roomDir, SEC, 'interview-notes.md'), '---\ntitle: Zanzibar onboarding interview\nframework: 5 Whys Technique\n---\n# Zanzibar onboarding interview\n\nFounders say onboarding takes three weeks.\n', 'utf8');
  fs.writeFileSync(path.join(born.roomDir, SEC, 'problem-statement.md'), '---\ntitle: Problem statement\nframeworks: [80/20 Rule, Quokka Method]\n---\n# Problem statement\n\nNew hires wait too long to be useful.\n', 'utf8');
  const gen = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs'), '--write', born.roomDir, '--section', SEC], { env: iso2.env, encoding: 'utf8', timeout: 60000 });
  check('RR2 setup: the MINTO generator ran for ' + SEC, gen.status === 0, String(gen.stderr).slice(-200));
  installFakeBrain();
  const mod = safe(() => require(MOD), null);
  if (!mod) {
    check('RR2 the room-read module loads', false, 'module absent: ' + MOD);
    check('RR3 formatFeyMintoBlock exists', false, 'module absent');
  } else {
    check('RR2 the module exports readRoomFeyMinto, feymintoLeg, formatFeyMintoBlock', ['readRoomFeyMinto', 'feymintoLeg', 'formatFeyMintoBlock'].every((k) => typeof mod[k] === 'function'));
    const leg = await mod.feymintoLeg(born.roomDir, { offline: false });
    check('RR2 one entry per core section', Array.isArray(leg) && leg.length === CORE.length && CORE.every((n) => leg.some((e) => e.nest === n)), JSON.stringify(leg).slice(0, 300));
    const askedEntries = (leg || []).filter((e) => e.asked === true);
    check('RR2 at least one nest was asked (the canned Theo answered)', askedEntries.length > 0, JSON.stringify((leg || []).map((e) => [e.nest, e.asked, e.not_asked_reason])));
    const oracle = (leg || []).map((e) => {
      const text2 = safe(() => fs.readFileSync(path.join(born.roomDir, e.nest, 'BRAIN.md'), 'utf8'), '');
      const fw = (frontmatterLine(text2, 'suggested_frameworks') || '').split(',').filter(Boolean).map(decodeScalar);
      const cmds = (frontmatterLine(text2, 'suggested_commands') || '').split(',').filter(Boolean).map((x) => x.split(':')).filter((p) => p.length >= 3 && p[p.length - 2] === 'runnable').map((p) => decodeScalar(p.slice(0, p.length - 2).join(':')));
      return { e, fw, cmds, asked: frontmatterLine(text2, 'asked') === 'true' };
    });
    check('RR2 asked matches the BRAIN.md frontmatter for every nest', oracle.every((o) => o.e.asked === o.asked), JSON.stringify(oracle.map((o) => [o.e.nest, o.e.asked, o.asked])));
    check('RR2 frameworks_named equals suggested_frameworks (decoded) for every asked nest',
      oracle.filter((o) => o.e.asked).every((o) => JSON.stringify(o.e.frameworks_named) === JSON.stringify(o.fw)), JSON.stringify(oracle.filter((o) => o.e.asked).map((o) => [o.e.nest, o.e.frameworks_named, o.fw])).slice(0, 500));
    check('RR2 commands_runnable_here equals the suggested_commands entries marked cli runnable, for every asked nest',
      oracle.filter((o) => o.e.asked).every((o) => JSON.stringify(o.e.commands_runnable_here) === JSON.stringify(o.cmds)), JSON.stringify(oracle.filter((o) => o.e.asked).map((o) => [o.e.nest, o.e.commands_runnable_here, o.cmds])).slice(0, 500));
    check('RR2 at least one asked nest names a command runnable here (the canned command is a navigator command)', askedEntries.some((e) => e.commands_runnable_here.length > 0), JSON.stringify(askedEntries.map((e) => e.commands_runnable_here)));
    check('RR2 queries_sent is a number for asked nests and 0 or null for the rest', (leg || []).every((e) => (e.asked ? typeof e.queries_sent === 'number' && e.queries_sent > 0 : (e.queries_sent === 0 || e.queries_sent === null))), JSON.stringify((leg || []).map((e) => [e.nest, e.asked, e.queries_sent])));
    const read = mod.readRoomFeyMinto(born.roomDir);
    check('RR2 readRoomFeyMinto (no derivation) reads the same entries', JSON.stringify(read.map((e) => [e.nest, e.asked, e.frameworks_named, e.commands_runnable_here])) === JSON.stringify(leg.map((e) => [e.nest, e.asked, e.frameworks_named, e.commands_runnable_here])));
    const brainHash = (d) => H.treeHash(d);
    const beforeOffline = brainHash(born.roomDir);
    const offlineLeg = await mod.feymintoLeg(born.roomDir, { offline: true });
    check('RR2 feymintoLeg offline writes nothing (room tree hash unchanged)', brainHash(born.roomDir) === beforeOffline);
    check('RR2 feymintoLeg offline sends nothing: a nest already asked keeps its recorded answer, every other nest reads not asked with reason offline', offlineLeg.length === CORE.length && offlineLeg.every((e) => (e.asked === true ? askedEntries.some((a) => a.nest === e.nest) : e.not_asked_reason === 'offline')) && offlineLeg.filter((e) => e.asked).length === askedEntries.length, JSON.stringify(offlineLeg.map((e) => [e.nest, e.asked, e.not_asked_reason])).slice(0, 300));

    // ---- RR3 ---------------------------------------------------------------------------------------------------
    const fmt = mod.formatFeyMintoBlock(leg);
    check('RR3 the block: header, It tried, one line per nest with the section name, It could not',
      fmt.indexOf('== FeyMinto ==') === 0 && /It tried:/.test(fmt) && /It could not:/.test(fmt) && CORE.every((n) => fmt.split('\n').some((l) => l.indexOf(n + ':') !== -1)), fmt.slice(0, 600));
    check('RR3 an asked nest prints "asked (N queries)", frameworks and runnable here', /asked \(\d+ queries?\); frameworks: .*; runnable here: /.test(fmt), fmt.slice(0, 900));
    check('RR3 the block carries no room id, no uuid and no path', !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/.test(fmt) && fmt.indexOf(iso2.home) === -1 && fmt.indexOf(born.roomDir) === -1);
  }

  const bad = H.dashGuard([__filename, MOD]);
  check('dash guard: no em dash or en dash in the test or the module', bad.length === 0, bad.join(','));

  console.log('\nPASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log('FAIL: uncaught :: ' + String((e && e.stack) || e).slice(0, 800));
  console.log('\nPASS=' + passed + ' FAIL=' + (failed + 1));
  process.exit(1);
});
