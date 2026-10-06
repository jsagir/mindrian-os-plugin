#!/usr/bin/env node
'use strict';
/*
 * Phase 369.25 plan 21 -- one decision path: the engine, suggest_next and the brief read the next move from the
 * FeyMinto face (lib/core/feyminto/next-move.cjs nextMoveForSection), and no footer recommends a command on its own.
 *
 * RED first: this file is committed before the engine producer, the suggest_next fields and the footer change exist.
 *
 * Arms:
 *   X1  decide() with ctx { roomDir, section } on a nest whose FeyMinto face suggests X while the contract, the ledger and
 *       the navigator table name Y fills ctx.tierCandidates from the face producer (source 'feyminto_face'), Y first, ids
 *       in the '/mos:<name>' form the ranker keys on; the cli surface composes through the same call
 *   X2  fallbacks: a nest with no runnable primary, a section outside the registry, no roomDir, a caller-supplied
 *       tierCandidates, and a bare sectionJobId all leave the ledger producer's output exactly as before; the reason is
 *       named on ctx.tierCandidatesFallbackReason when the face had nothing to say
 *   X2b a fallback names its reason on ctx.tierCandidatesFallbackReason (no_runnable_primary, no_room_dir)
 *   X3  the producer makes zero Brain calls (a spy replaces brain-client in require.cache; the call counts are equal with
 *       and without the producer and no network-capable method is called) and decide() stays under the 1200 ms NAV
 *       budget (measured three times)
 *   X4  suggest_next (in-process, the real register()) returns next_move, next_move_source 'feyminto_face' and the
 *       decision path's own primary for the section argument and for the session's focus; a nest with nothing runnable
 *       answers 'sensor_order' with the reason; the sensor `suggestion` field is kept
 *   X5  footer census: formatSuggestedNext keeps the marker, names suggest_next and the brief, names no other command, and
 *       the call-site count of formatSuggestedNext( in tool-router.cjs is still 65
 *   X6  against the real decide() and the real ranker (the plan 18 carry-over): the face ids as toTierCandidates returns
 *       them (bare) do not steer the ranker at all, the ids the producer writes do, and decide()'s offer_next_step
 *       follows the face (inside the face's set, away from the unsteered offer)
 *   X7  dash guard
 *
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs). Every Theo
 * read is an injected stub: zero network. Nothing is written under ~/MindrianRooms or ~/.mindrian.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const SEC = 'problem-definition';
const GEN = path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs');
const ROUTER = path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs');
const SEED_SQL = path.join(ROOT, 'tests', 'fixtures', 'phase-109', 'sample-room', 'seed.sql');

const arms = [];
function arm(name, fn) { arms.push({ name, fn }); }
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}

function nextMove() { return require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs')); }
function nav() { return require(path.join(ROOT, 'lib', 'core', 'navigation.cjs')); }
function engine() { return require(path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs')); }
function ledger() { return require(path.join(ROOT, 'lib', 'core', 'section-ruling-candidates.cjs')); }
function ranker() { return require(path.join(ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs')); }
function pref(c) { return '/mos:' + c; }

// ---- the plan 17 stub seam (a fake brain-client under the brain-derivation module) -----------------------------------

const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
const NAV_CMDS = REG.filter((c) => c.surface === 'navigator').map((c) => c.command.replace(/^\/mos:/, ''));
function clone(v) { return JSON.parse(JSON.stringify(v === undefined ? null : v)); }

function theoGood(tool, args) {
  if (tool === 'find_frameworks_for_problem_type') {
    return {
      rows: [{ problemType: args.problem_type, chapters: [{ chapterId: 'ch-01', phaseLabel: 'Frame the problem', toolTypes: ['Matrix'] }, { chapterId: 'ch-02', phaseLabel: 'Test the frame', toolTypes: ['Experiment'] }], matched: 2, total: 9 }],
      coverage: { matched: 2, total: 9, status: 'partial' },
    };
  }
  if (tool === 'commands_for_problem_type') return { rows: [{ command: NAV_CMDS[0], jtbd: 'Name the problem', framework: '5 Whys Technique' }] };
  if (tool === 'recommend_chain') return { grounded: true, chain: [{ step: 1, framework: '5 Whys Technique' }, { step: 2, framework: '80/20 Rule' }] };
  if (tool === 'framework_neighborhood') return { name: args.framework, chapters: [{ id: 'ch-07', label: 'Chapter 7' }], brainRecords: [], commands: [] };
  return null;
}

function uninstall() {
  delete require.cache[require.resolve('../lib/core/brain-client.cjs')];
  delete require.cache[require.resolve('../lib/core/brain-derivation.cjs')];
  delete require.cache[require.resolve('../lib/core/brain-derivation-prompts.cjs')];
}

function install() {
  const bc = require.resolve('../lib/core/brain-client.cjs');
  const real = require(bc);
  const fake = {
    isAvailable: () => true,
    schema: async () => ({ brain_graph_version: 21432 }),
    query: async () => ({ records: [{ name: 'SWOT', description: 'x' }] }),
    search: async () => ({ matches: [{ title: 'Analogy 1', score: 0.8 }] }),
    smartSearch: async () => null,
    callTool: async (tool, args) => theoGood(tool, clone(args)),
    getBrainUrl: () => 'https://theo-stub.invalid',
    _test: real._test,
  };
  require.cache[bc] = { id: bc, filename: bc, loaded: true, exports: fake };
  delete require.cache[require.resolve('../lib/core/brain-derivation.cjs')];
  delete require.cache[require.resolve('../lib/core/brain-derivation-prompts.cjs')];
  return require('../lib/core/brain-derivation.cjs');
}

// ---- fixtures ----------------------------------------------------------------------------------------------------

function born(tag) {
  const iso = H.mkIsolatedHome(tag);
  const slug = 'nm-' + tag;
  const b = H.birthFixtureRoom({ iso, slug, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!b || b.ok !== true) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  return { iso, roomDir, slug, sectionPath: path.join(roomDir, SEC) };
}

function writeArtifacts(room) {
  fs.writeFileSync(path.join(room.sectionPath, 'interview-notes.md'),
    '---\ntitle: Zanzibar onboarding interview\nframework: 5 Whys Technique\n---\n# Zanzibar onboarding interview\n\nFounders say onboarding takes three weeks.\n', 'utf8');
  fs.writeFileSync(path.join(room.sectionPath, 'problem-statement.md'),
    '---\ntitle: Problem statement\nframeworks: [80/20 Rule]\n---\n# Problem statement\n\nNew hires wait too long to be useful.\n', 'utf8');
}

function gen(room) {
  const r = spawnSync(process.execPath, [GEN, '--write', room.roomDir, '--section', SEC], { env: room.iso.env, encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0) throw new Error('generator exit ' + r.status + '\n' + r.stderr + r.stdout);
}

// A born nest with a derived FeyMinto face (Theo stubs) on problem-definition.
async function faceRoom(tag) {
  const room = born(tag);
  writeArtifacts(room);
  gen(room);
  const derive = install();
  try {
    const res = await derive.deriveSection(room.roomDir, SEC, {});
    check(res.success === true, 'deriveSection success, got ' + JSON.stringify(res));
  } finally { uninstall(); }
  return room;
}

// The ledger and the born-room db seeded the way tests/test-135-decide-wiring-e2e.cjs seeds it (a real graph), so a
// DECISION_GATE turn can produce an offer.
function seedGraph(room) {
  const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  const db = openRoomDb(room.roomDir);
  try { db.exec(fs.readFileSync(SEED_SQL, 'utf8')); } finally { closeRoomDb(db); }
}

function faceCommands(room) {
  const t = fs.readFileSync(path.join(room.sectionPath, 'BRAIN.md'), 'utf8');
  const m = t.match(/^suggested_commands:\s*(.*)$/m);
  const { decodeFaceList } = require(path.join(ROOT, 'lib', 'core', 'brain-md-schema.cjs'));
  return m ? decodeFaceList(m[1].replace(/^"(.*)"$/, '$1')).map((e) => e.split(':')[0]) : [];
}

function decideCtx(room, section, extra) {
  const folderMemory = require(path.join(ROOT, 'lib', 'core', 'folder-memory.cjs'));
  const sp = path.join(room.roomDir, section);
  return Object.assign({
    quadruple: folderMemory.readQuadruple(sp),
    brainAvailable: false,
    userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'discovery' },
    sectionPath: section,
    problemType: 'IDP',
    roomDir: room.roomDir,
    section,
  }, extra || {});
}

// ---- X1 ---------------------------------------------------------------------------------------------------------

arm('X1 decide() fills ctx.tierCandidates from the face, the composed primary first, in the ranker id form', async () => {
  const room = await faceRoom('x1');
  const NM = nextMove();
  const theoFirst = faceCommands(room)[0];
  const nmMcp = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: room.sectionPath, surface: 'mcp' });
  check(nmMcp.primary && typeof nmMcp.primary.command === 'string', 'the composition has a primary on problem-definition');
  check(typeof theoFirst === 'string' && theoFirst.length > 0, 'the fixture face suggests a command: ' + theoFirst);
  check(theoFirst !== nmMcp.primary.command, 'the setup needs the face suggestion (' + theoFirst + ') to differ from the agreed primary (' + nmMcp.primary.command + ')');

  const ctx = decideCtx(room, SEC);
  const d = engine().decide({ userText: null, sectionPath: SEC, sessionId: 's-x1' }, ctx);
  check(d && d.decision_trace, 'decide() returned a decision');
  check(Array.isArray(ctx.tierCandidates) && ctx.tierCandidates.length === 1, 'ctx.tierCandidates filled by the face producer: ' + JSON.stringify(ctx.tierCandidates));
  eq(ctx.tierCandidates[0].source, 'feyminto_face', 'tier source');
  eq(ctx.tierCandidatesSource, 'feyminto_face', 'ctx.tierCandidatesSource');
  eq(ctx.tierCandidates[0].items[0].id, pref(nmMcp.primary.command), 'the composed primary is first, in the /mos: form the ranker keys on');
  eq(ctx.tierCandidates[0].items.map((i) => i.id), NM.toTierCandidates(nmMcp)[0].items.map((i) => pref(i.id)), 'the same ordered ids as toTierCandidates, prefixed');
  check(ctx.tierCandidates[0].items.length <= 3, 'at most three items (Canon Part 3 MAX_K)');

  const cliNm = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: room.sectionPath, surface: 'cli' });
  const ctxCli = decideCtx(room, SEC, { surface: 'cli' });
  engine().decide({ userText: null, sectionPath: SEC, sessionId: 's-x1b' }, ctxCli);
  eq(ctxCli.tierCandidates[0].items[0].id, pref(cliNm.primary.command), 'ctx.surface cli composes the cli move');
});

// ---- X2 ---------------------------------------------------------------------------------------------------------

arm('X2 with nothing to say the face producer leaves the ledger producer exactly as before, and names why', async () => {
  const room = born('x2');
  const led = ledger();
  const expected = led.buildLedgerCandidates({ jobId: 'find-problem' });
  check(Array.isArray(expected) && expected.length === 1, 'the ledger has a find-problem row');

  // a bare sectionJobId (the ledger's own activation): byte-identical, source section_ledger
  const a = { sectionJobId: 'find-problem' };
  engine().decide({}, a);
  eq(a.tierCandidates, expected, 'sectionJobId alone: the ledger output');
  check(a.tierCandidatesSource === undefined, 'no face source stamped on a ledger fill');

  // a section with no roomDir: the shipped 353 behavior (no face to read)
  const b = { section: SEC };
  engine().decide({}, b);
  eq(b.tierCandidates, expected, 'section without roomDir: the ledger output');
  check(b.tierCandidatesSource === undefined, 'no face source stamped without a roomDir');

  // a nest whose composition has no runnable primary (team has no contract names, no job)
  const NM = nextMove();
  const none = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: path.join(room.roomDir, 'team'), surface: 'mcp' });
  check(none.primary === null, 'precondition: team composes no primary');
  const c = decideCtx(room, 'team');
  engine().decide({}, c);
  check(c.tierCandidates === undefined, 'no primary and no ledger row: ctx.tierCandidates stays unset (byte-identical no-op)');

  // a section outside the registry
  fs.mkdirSync(path.join(room.roomDir, 'not-a-core-section'), { recursive: true });
  const d = decideCtx(room, 'not-a-core-section');
  engine().decide({}, d);
  check(d.tierCandidates === undefined, 'an unknown section stays unset');

  // a caller-supplied tierCandidates wins untouched (the test seam)
  const seam = [{ source: 'caller', items: [{ id: '/mos:act', confidence: null, source: 'caller' }] }];
  const e = decideCtx(room, SEC, { tierCandidates: seam });
  engine().decide({}, e);
  eq(e.tierCandidates, seam, 'a caller-supplied tierCandidates is not replaced');
  check(e.tierCandidatesSource === undefined, 'no face source stamped over a caller seam');
});

arm('X2b a fallback to the ledger names its reason on the context', () => {
  const room = born('x2b');
  const c = decideCtx(room, 'team');
  engine().decide({}, c);
  eq(c.tierCandidatesFallbackReason, 'no_runnable_primary', 'a nest with no runnable primary names the reason');
  const u = decideCtx(room, 'not-a-core-section');
  fs.mkdirSync(path.join(room.roomDir, 'not-a-core-section'), { recursive: true });
  engine().decide({}, u);
  eq(u.tierCandidatesFallbackReason, 'no_runnable_primary', 'an unknown section names the same reason');
  const seam = [{ source: 'caller', items: [{ id: '/mos:act', confidence: null, source: 'caller' }] }];
  const s = decideCtx(room, SEC, { tierCandidates: seam });
  engine().decide({}, s);
  check(s.tierCandidatesFallbackReason === undefined, 'a caller seam names no fallback (the producers never ran)');
  const n = { section: SEC };
  engine().decide({}, n);
  eq(n.tierCandidatesFallbackReason, 'no_room_dir', 'section without roomDir names why the face was not read');
});

// ---- X3 ---------------------------------------------------------------------------------------------------------

arm('X3 the producer makes zero Brain calls and decide() stays inside the 1200 ms NAV budget', async () => {
  const room = await faceRoom('x3');
  const bc = require.resolve('../lib/core/brain-client.cjs');
  const calls = {};
  const bump = (n) => { calls[n] = (calls[n] || 0) + 1; };
  const netMethods = ['callTool', 'query', 'search', 'smartSearch', 'schema'];
  const spy = {
    isAvailable: () => { bump('isAvailable'); return false; },
    getBrainUrl: () => { bump('getBrainUrl'); return 'https://spy.invalid'; },
    ensureAvailable: async () => { bump('ensureAvailable'); return false; },
  };
  netMethods.forEach((n) => { spy[n] = async () => { bump(n); return null; }; });
  const prior = require.cache[bc];
  require.cache[bc] = { id: bc, filename: bc, loaded: true, exports: spy };
  const engPath = require.resolve('../lib/core/navigation-engine.cjs');
  const offerPath = require.resolve('../lib/core/navigation-engine-offer.cjs');
  delete require.cache[engPath];
  delete require.cache[offerPath];
  let withProducer;
  let withoutProducer;
  const times = [];
  try {
    const eng = require(engPath);
    const seam = [{ source: 'caller', items: [{ id: '/mos:act', confidence: null, source: 'caller' }] }];
    Object.keys(calls).forEach((k) => delete calls[k]);
    eng.decide({}, decideCtx(room, SEC, { tierCandidates: seam }));
    withoutProducer = Object.assign({}, calls);
    Object.keys(calls).forEach((k) => delete calls[k]);
    for (let i = 0; i < 3; i += 1) {
      const t0 = process.hrtime.bigint();
      const ctx = decideCtx(room, SEC);
      eng.decide({}, ctx);
      times.push(Number(process.hrtime.bigint() - t0) / 1e6);
      check(ctx.tierCandidatesSource === 'feyminto_face', 'the producer ran on run ' + i);
    }
    withProducer = Object.assign({}, calls);
  } finally {
    if (prior) require.cache[bc] = prior; else delete require.cache[bc];
    delete require.cache[engPath];
    delete require.cache[offerPath];
  }
  netMethods.forEach((n) => {
    check(!withProducer[n] && !withoutProducer[n], 'network-capable brain-client method ' + n + ' was called');
  });
  // three runs with the producer carry exactly three times the per-call count the producer-free run carries
  Object.keys(Object.assign({}, withProducer, withoutProducer)).forEach((k) => {
    eq((withProducer[k] || 0), 3 * (withoutProducer[k] || 0), 'brain-client call count for ' + k + ' (three producer runs vs one producer-free run)');
  });
  times.forEach((ms) => check(ms < 1200, 'decide() took ' + ms.toFixed(1) + ' ms, over the 1200 ms NAV budget'));
  console.log('    decide() ms with the producer (3 runs): ' + times.map((t) => t.toFixed(1)).join(', ') + '; brain-client calls per decide: ' + JSON.stringify(withoutProducer));
});

// ---- X4 ---------------------------------------------------------------------------------------------------------

function fakeServer() {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
      registerTool(name, _c, handler) { registered.push({ name, handler }); },
      server: { getClientCapabilities() { return {}; } },
    },
  };
}

function suggestNextHandler(roomDir) {
  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const fake = fakeServer();
  sensors.register(fake.server, { fallbackRoomDir: roomDir });
  const t = fake.registered.find((r) => r.name === 'suggest_next');
  check(t, 'suggest_next registered through the real register()');
  return t.handler;
}

async function callSuggest(handler, args, sessionId) {
  const res = await handler(args, { sessionId });
  return JSON.parse(res.content[0].text);
}

arm('X4 suggest_next answers with the decision path\'s own next move and says which path produced it', async () => {
  const room = await faceRoom('x4');
  const NM = nextMove();
  const want = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: room.sectionPath, surface: 'mcp' });
  const handler = suggestNextHandler(room.roomDir);

  const p1 = await callSuggest(handler, { section: SEC }, 's-x4-a');
  eq(p1.ok, true, 'ok');
  check('suggestion' in p1, 'the sensor suggestion field is kept');
  eq(p1.next_move_source, 'feyminto_face', 'next_move_source for the section argument');
  eq(p1.next_move.primary, clone(want.primary), 'next_move.primary equals nextMoveForSection for surface mcp');
  eq(p1.next_move.alternatives, clone(want.alternatives), 'alternatives');
  eq(p1.next_move.outcomes_differ, want.outcomes_differ, 'outcomes_differ');
  check(/next_move is the move/.test(p1.note || ''), 'the note says next_move is the move: ' + p1.note);

  // the session's focus names the nest (no section argument)
  const db = nav().openRoomDbForCaller(room.roomDir);
  try {
    const w = nav().writeClaimNode(db, { knowledge_type: 'fact', text: 'Onboarding takes three weeks', sessionId: 's-x4-f', sourceSegment: 'seg-x4', extraProps: { section: SEC } });
    check(w.ok === true, 'writeClaimNode: ' + JSON.stringify(w));
    const f = nav().setFocus(db, 's-x4-f', w.node_id, 'user');
    check(f.ok === true, 'setFocus: ' + JSON.stringify(f));
  } finally { nav().closeRoomDbForCaller(db); }
  const p2 = await callSuggest(handler, {}, 's-x4-f');
  eq(p2.next_move_source, 'feyminto_face', 'next_move_source for the focused nest');
  eq(p2.next_move.primary, clone(want.primary), 'the focused nest gives the same primary');

  // nothing runnable: the sensor order stays the answer and the reason is named
  const p3 = await callSuggest(handler, { section: 'team' }, 's-x4-c');
  eq(p3.next_move_source, 'sensor_order', 'a nest with nothing runnable answers sensor_order');
  eq(p3.next_move.primary, null, 'no primary');
  eq(p3.next_move_reason, 'no_runnable_primary', 'the reason is named');
  check('suggestion' in p3, 'suggestion still present');

  // no section and no focus
  const p4 = await callSuggest(handler, {}, 's-x4-none');
  eq(p4.next_move_source, 'sensor_order', 'no active nest');
  eq(p4.next_move_reason, 'no_active_nest', 'the reason is named');
});

// ---- X5 ---------------------------------------------------------------------------------------------------------

arm('X5 the footer points at the decision path and recommends no command of its own', () => {
  // formatSuggestedNext is module-private in tool-router.cjs (not exported); the function text is cut from the source and
  // run in a vm sandbox, so the census reads the shipped code and not a copy. filterToNavigator is a pass-through here:
  // this arm asserts the footer text, not the surface fence.
  const src0 = fs.readFileSync(ROUTER, 'utf8');
  const start = src0.indexOf('function formatSuggestedNext(');
  const end = src0.indexOf('\n}\n', start);
  check(start !== -1 && end !== -1, 'formatSuggestedNext found in tool-router.cjs');
  const sandbox = { filterToNavigator: (a) => a, out: null };
  require('node:vm').runInNewContext(src0.slice(start, end + 3) + '\nout = formatSuggestedNext;', sandbox);
  const fn = sandbox.out;
  check(typeof fn === 'function', 'formatSuggestedNext is a function');
  const out = fn('room_state', { command: 'status' }, 'any rationale');
  check(out.indexOf('## Suggested Next') !== -1, 'the marker stays (17+ test files split on it)');
  check(out.indexOf('suggest_next') !== -1, 'names suggest_next');
  check(/BRIEF\.md|brief/.test(out), 'names the nest brief');
  check(out.indexOf('status') === -1, 'the offered command does not echo: ' + out);
  check(out.indexOf('any rationale') === -1, 'the caller rationale is not a second recommendation');
  const out2 = fn('act', { command: 'whitespace' }, 'Scout intelligence gathered');
  check(out2 === out, 'one fixed footer for every call site');
  const sites = (src0.match(/formatSuggestedNext\(/g) || []).length;
  eq(sites, 65, 'formatSuggestedNext( occurrences in tool-router.cjs (call sites untouched)');
});

// ---- X6 ---------------------------------------------------------------------------------------------------------

arm('X6 against the real decide() and ranker: the producer ids steer, the bare ids do not', async () => {
  const room = born('x6');
  seedGraph(room);
  const NM = nextMove();
  const ids = (nm) => nm.primary ? NM.toTierCandidates(nm)[0].items.map((i) => i.id) : [];
  const baseline = ranker().rankForSelector({ k: 3, roomState: {} }).map((r) => r.command);

  const SOLUTION = 'solution-design';
  [SEC, SOLUTION].forEach((s) => {
    const nm = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: path.join(room.roomDir, s), surface: 'mcp' });
    const bare = NM.toTierCandidates(nm);
    const barePlain = ranker().rankForSelector({ k: 3, roomState: {}, tierCandidates: bare }).map((r) => r.command);
    eq(barePlain, baseline, s + ': toTierCandidates ids as returned (bare) leave the ranker untouched (they never match a /mos: row)');
    const steered = ranker().rankForSelector({ k: 3, roomState: {}, tierCandidates: [{ source: 'feyminto_face', items: ids(nm).map((i) => ({ id: pref(i), confidence: null, source: 'feyminto_face' })) }] }).map((r) => r.command);
    check(steered.join() !== baseline.join(), s + ': the /mos: ids move the ranked top three: ' + steered.join());
    ids(nm).forEach((i) => check(steered.indexOf(pref(i)) !== -1, s + ': the face id ' + i + ' is in the steered top three: ' + steered.join()));
  });

  // decide(): the offer follows the face (a DECISION_GATE turn over the seeded graph)
  const offerFor = (s, extra) => {
    const db = nav().openRoomDbForCaller(room.roomDir);
    try {
      const ctx = decideCtx(room, s, Object.assign({ operator: 'DECISION_GATE', jtbd: 'size the addressable market', roomState: { db, roomDir: room.roomDir } }, extra || {}));
      const d = engine().decide({ userText: null, sectionPath: s, sessionId: 's-x6' }, ctx);
      return { offer: d.offer_next_step && d.offer_next_step.command, ctx };
    } finally { nav().closeRoomDbForCaller(db); }
  };
  const unsteeredPD = offerFor(SEC, { tierCandidates: [] }).offer;
  const steeredPD = offerFor(SEC);
  eq(steeredPD.ctx.tierCandidatesSource, 'feyminto_face', 'the producer ran inside decide()');
  const faceIdsPD = steeredPD.ctx.tierCandidates[0].items.map((i) => i.id);
  check(typeof steeredPD.offer === 'string', 'decide() produced an offer over the seeded graph');
  check(steeredPD.offer !== unsteeredPD, 'the face moved the offer (unsteered ' + unsteeredPD + ', steered ' + steeredPD.offer + ')');
  check(faceIdsPD.indexOf(steeredPD.offer) !== -1, 'the offer ' + steeredPD.offer + ' is one of the face ids ' + faceIdsPD.join());
  const sd = offerFor(SOLUTION);
  const sdPrimary = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: path.join(room.roomDir, SOLUTION), surface: 'mcp' }).primary.command;
  eq(sd.offer, pref(sdPrimary), SOLUTION + ': the offer is the composed primary');
});

// ---- X7 ---------------------------------------------------------------------------------------------------------

arm('X7 no em or en dash in the files this plan writes', () => {
  const files = [
    'tests/test-36925-next-move.cjs', 'lib/core/navigation-engine.cjs', 'lib/mcp/tools/sensors.cjs',
    'lib/mcp/tool-router.cjs', 'tests/test-276-orchestration-scout-honesty.cjs',
  ].map((f) => path.join(ROOT, f));
  eq(H.dashGuard(files), [], 'no em or en dash (all five files were dash-free at HEAD)');
});

// ---- runner ------------------------------------------------------------------------------------------------------

(async () => {
  let passed = 0;
  let failed = 0;
  const failedNames = [];
  for (const a of arms) {
    try {
      await a.fn();
      passed += 1;
      console.log('PASS: ' + a.name);
    } catch (e) {
      failed += 1;
      failedNames.push(a.name);
      console.log('FAIL: ' + a.name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
    }
  }
  console.log('\ntest-36925-next-move: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) { console.log('failed: ' + failedNames.join(' | ')); process.exit(1); }
})();
