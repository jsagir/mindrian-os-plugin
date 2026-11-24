#!/usr/bin/env node
'use strict';
// Phase 400 plan 10 (CY-05, consumer half): the two advisor consumers pass the room's cause and
// effect domain to the one advisor lookup. composeNextMove and nextMoveForSection in
// lib/core/feyminto/next-move.cjs; composeWorkflow and advisorOptsForRoom in
// lib/workflow/command-resolver.cjs.
//
// Legs X1 to X6:
//   X1 advisor off: both consumers equal the 399 modules (read from git at the plan base) and the
//      room is not read for the domain (a spy on readCauseEffectForRoom counts 0 calls).
//   X2 advisor on, no stored domain: both consumers equal the 399 modules on the same inputs.
//   X3 complex: the methodology probe command goes ahead of the strong non-fit command in both
//      consumers; next_move.advisor names the domain line; no output holds a raw number.
//   X4 chaotic: neither consumer reorders by the advisor; next_move.advisor is no strong pick with
//      the chaotic note.
//   X5 disorder: the order equals X2 and the note is present.
//   X6 tests/test-399-one-selector-fence.cjs passes (no second selector).
//
// Fixture: a table written at run time with the plan 09 key order (job, level, cause_effect, last).
// The plan 09 fixture row for validate-idea names /mos:explain-decision, which does not serve
// validate-idea, so the selector job key (not the advisor) would decide its order. The run-time
// table uses commands that serve the job, chosen by kind and move_type in data/command-registry.json:
//   explore: /mos:opportunities (utility analyze), /mos:beautiful-question (methodology probe),
//            /mos:bono (methodology analyze), /mos:explore-trends (weak).
//   compare-options (Six Thinking Hats commands): /mos:bono (methodology analyze), /mos:think-hats
//            (methodology probe), /mos:persona (weak).
// Node built-ins only, no network. Hyphens only in this file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'c1e496ae8';
delete process.env.MINDRIAN_DECISION_ADVISOR;
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;

let failed = 0;
let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}
function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); } finally { for (const k of Object.keys(vars)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
}

let navigation;
let roomDbMod;
try {
  roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
} catch (e) {
  console.log('SKIP: test-400-advisor-consumers: node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  process.exit(0);
}
const CE = require(path.join(ROOT, 'lib', 'core', 'navigation', 'cause-effect.cjs'));
const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
const RES = require(path.join(ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));
const JT = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
const CY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cynefin-domains.json'), 'utf8'));

// The spy: every consumer reads the domain through this export at call time.
let domainReads = 0;
const realRead = CE.readCauseEffectForRoom;
CE.readCauseEffectForRoom = function counted() { domainReads += 1; return realRead.apply(this, arguments); };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-400-10-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

// The 399 reference: a module at the plan base commit, read from git into scratch. Each relative require and
// __dirname points back at the real folder, so the reference loads the same shared modules (and the same
// shortlist.cjs, which plan 09 proved gives exactly the 399 result without a domain).
function loadBase(rel) {
  const r = spawnSync('git', ['show', BASE + ':' + rel], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) return null;
  const realDir = path.dirname(path.join(ROOT, rel));
  const src = r.stdout
    .replace(/require\((['"])(\.\.?\/[^'"]+)\1\)/g, (_m, _q, p) => 'require(' + JSON.stringify(path.resolve(realDir, p)) + ')')
    .replace(/\b__dirname\b/g, JSON.stringify(realDir));
  const file = path.join(TMP, 'base-' + path.basename(rel));
  fs.writeFileSync(file, src);
  return require(file);
}
const NM0 = loadBase('lib/core/feyminto/next-move.cjs');
const RES0 = loadBase('lib/workflow/command-resolver.cjs');

const E = (command, calibrated) => ({ command, calibrated });
const TABLE = path.join(TMP, 'consumers-table.json');
fs.writeFileSync(TABLE, JSON.stringify({
  schema: 'mos.decision-advisor-table/1',
  table_version: '400-consumers-fixture',
  key_order: ['job', 'definition_level', 'cause_effect', 'last_command'],
  conditioned_rows: true,
  thresholds: { strong: 0.7, possible: 0.5 },
  shortlist_k: 4,
  rows: {
    'explore|*|*|*': [E('/mos:opportunities', 0.95), E('/mos:beautiful-question', 0.9), E('/mos:bono', 0.8), E('/mos:explore-trends', 0.3)],
    'compare-options|*|*|*': [E('/mos:bono', 0.9), E('/mos:think-hats', 0.8), E('/mos:persona', 0.3)],
  },
}));
const ON = { MINDRIAN_DECISION_ADVISOR: 'on', MINDRIAN_DECISION_ADVISOR_TABLE: TABLE };
const OFF = { MINDRIAN_DECISION_ADVISOR: undefined, MINDRIAN_DECISION_ADVISOR_TABLE: TABLE };

// ---- rooms: one per stored domain, plus one with none ----
function makeRoom(name, domain, goal) {
  const roomDir = path.join(TMP, name);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# State\n');
  if (goal) assert.ok(JT.setGoal(roomDir, { jtbd: goal }), 'fixture: goal written');
  if (domain) {
    roomDbMod.closeRoomDb(roomDbMod.openRoomDb(roomDir)); // room.db must exist before the caller door opens it
    const db = navigation.openRoomDbForCaller(roomDir);
    try {
      db.exec('BEGIN');
      const w = navigation.writeCauseEffect(db, { domain, gateId: 'g-' + name, decisionNodeId: 'decision:gate:g-' + name });
      db.exec('COMMIT');
      assert.equal(w.ok, true, 'fixture: domain stored');
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  }
  return roomDir;
}
const NM_JOB = 'explore';
const WF_JOB = 'compare-options';
const WF_FW = 'Six Thinking Hats';
const WF_CMDS = RES.commandsForFramework(WF_FW);
const ROOMS = {};
['none', 'complex', 'chaotic', 'disorder'].forEach((d) => {
  ROOMS[d] = { nm: makeRoom('nm-' + d, d === 'none' ? null : d, null), wf: makeRoom('wf-' + d, d === 'none' ? null : d, WF_JOB) };
});

// ---- next-move inputs ----
const capabilityFor = () => ({ known: true, cli: 'runnable', mcp: 'runnable', label: 'runnable (test)' });
// The contract order differs from every advisor order, so each leg shows which key decided (3 shown at most).
const NAMES = ['bono', 'beautiful-question', 'opportunities'];
function composeInput(extra) {
  return Object.assign({
    jobId: NM_JOB, jobFit: {}, surface: 'mcp', face: { asked: false, commands: [] }, ledgerCandidates: null,
    attempted: [], need: {}, capabilityFor, sources: { contract: { names: NAMES }, navigator_table: { names: [] } },
  }, extra || {});
}
const order = (m) => (m.primary ? [m.primary.command] : []).concat(m.alternatives.map((a) => a.command));
const sansAdvisor = (m) => { const o = Object.assign({}, m); delete o.advisor; return JSON.stringify(o); };
function nest(roomDir) {
  return { section: 'problem-definition', job: { id: NM_JOB }, roomDir, face: { keyed: false }, runs: [], need: { counterevidence: 0, assumptions: 0 } };
}
const nestMove = (M, roomDir) => M.nextMoveForSection({ roomDir, nest: nest(roomDir), surface: 'mcp' });
const CHAINS = [[WF_FW], [WF_FW, 'S-Curve Analysis', 'No Such Framework 400'], ['Jobs to Be Done (JTBD)', 'Systems Thinking']];

check('fixture: the 399 references load from git, and the workflow framework has the expected commands', () => {
  assert.ok(NM0 && typeof NM0.composeNextMove === 'function', 'base next-move.cjs loads');
  assert.ok(RES0 && typeof RES0.composeWorkflow === 'function', 'base command-resolver.cjs loads');
  assert.deepEqual(WF_CMDS, ['/mos:bono', '/mos:hat-briefing', '/mos:persona', '/mos:think-hats']);
  assert.equal(realRead(ROOMS.complex.nm).domain, 'complex');
  assert.equal(realRead(ROOMS.none.nm), null);
});

check('X1 advisor off: both consumers equal the 399 modules, and the room is not read for the domain', () => {
  domainReads = 0;
  withEnv(OFF, () => {
    for (const d of ['none', 'complex', 'chaotic']) {
      assert.equal(JSON.stringify(nestMove(NM, ROOMS[d].nm)), JSON.stringify(nestMove(NM0, ROOMS[d].nm)), 'nest ' + d);
      assert.equal(RES.advisorOptsForRoom(ROOMS[d].wf), null);
      for (const chain of CHAINS) {
        assert.deepStrictEqual(RES.composeWorkflow(chain), RES0.composeWorkflow(chain));
        assert.deepStrictEqual(RES.composeWorkflow(chain, { jobId: WF_JOB, causeEffect: d }), RES0.composeWorkflow(chain, { jobId: WF_JOB }));
      }
    }
    assert.equal(JSON.stringify(NM.composeNextMove(composeInput({ causeEffect: 'complex' }))), JSON.stringify(NM0.composeNextMove(composeInput())));
  });
  assert.equal(domainReads, 0, 'readCauseEffectForRoom calls with the advisor off');
});

check('X2 advisor on and no stored domain: both consumers equal the 399 modules on the same inputs', () => {
  domainReads = 0;
  withEnv(ON, () => {
    const cur = nestMove(NM, ROOMS.none.nm);
    assert.equal(JSON.stringify(cur), JSON.stringify(nestMove(NM0, ROOMS.none.nm)));
    assert.ok(cur.advisor, 'the advisor block is present with the advisor on');
    assert.equal(JSON.stringify(NM.composeNextMove(composeInput())), JSON.stringify(NM0.composeNextMove(composeInput())));
    assert.deepEqual(order(NM.composeNextMove(composeInput())), ['opportunities', 'beautiful-question', 'bono']);
    const opts = RES.advisorOptsForRoom(ROOMS.none.wf);
    assert.deepStrictEqual(opts, RES0.advisorOptsForRoom(ROOMS.none.wf));
    for (const chain of CHAINS) assert.deepStrictEqual(RES.composeWorkflow(chain, opts), RES0.composeWorkflow(chain, opts));
    const wf = RES.composeWorkflow([WF_FW], opts);
    assert.deepEqual(wf[0].ranked_commands, ['/mos:bono', '/mos:think-hats', '/mos:hat-briefing', '/mos:persona']);
    assert.equal(wf[0].command_basis, 'registry_order');
  });
  assert.ok(domainReads >= 2, 'the domain is read on the advisor-on path: ' + domainReads);
});

check('X3 complex: the methodology probe command goes ahead of the strong non-fit command in both consumers', () => {
  withEnv(ON, () => {
    const m = NM.composeNextMove(composeInput({ causeEffect: 'complex' }));
    const o = order(m);
    assert.ok(o.indexOf('beautiful-question') < o.indexOf('opportunities'), o.join(','));
    assert.deepEqual(o, ['beautiful-question', 'opportunities', 'bono']);
    assert.equal(m.advisor.domain.id, 'complex');
    assert.equal(m.advisor.domain.effect, 'reordered');
    assert.ok(m.advisor.summary.indexOf('Cause and effect domain: complex (probe, then sense, then respond)') !== -1, m.advisor.summary);
    assert.equal(PR.hasRawNumber(m.advisor), false);
    assert.equal(/\d\.\d/.test(JSON.stringify(m)), false, 'no raw number in the next-move result');

    const n = nestMove(NM, ROOMS.complex.nm);
    assert.equal(n.advisor.domain.id, 'complex', 'the nest path reads the stored domain');
    assert.equal(PR.hasRawNumber(n.advisor), false);

    const opts = RES.advisorOptsForRoom(ROOMS.complex.wf);
    assert.deepEqual(opts, { jobId: WF_JOB, definitionLevel: opts.definitionLevel, causeEffect: 'complex' });
    const wf = RES.composeWorkflow([WF_FW], opts);
    assert.equal(wf[0].command, '/mos:think-hats');
    assert.equal(wf[0].command_basis, 'advisor');
    assert.deepEqual(wf[0].ranked_commands, ['/mos:think-hats', '/mos:bono', '/mos:hat-briefing', '/mos:persona']);
    assert.equal(/\d\.\d/.test(JSON.stringify(wf)), false, 'no raw number in the workflow');
  });
});

check('X4 chaotic: neither consumer reorders by the advisor; the advisor states no strong pick with the chaotic note', () => {
  withEnv(ON, () => {
    const m = NM.composeNextMove(composeInput({ causeEffect: 'chaotic' }));
    const off = withEnv(OFF, () => NM.composeNextMove(composeInput()));
    assert.deepEqual(order(m), order(off), 'abstain: the order the other keys give');
    assert.deepEqual(order(m), ['bono', 'beautiful-question', 'opportunities']);
    assert.equal(sansAdvisor(m), sansAdvisor(off));
    assert.equal(m.advisor.state, 'no_strong_pick');
    assert.ok(m.advisor.summary.indexOf(PR.noteBody(CY.host_notes.chaotic.text, 'chaotic')) !== -1, m.advisor.summary);
    assert.equal(m.advisor.summary.split('Cause and effect domain: chaotic').length - 1, 1, 'WR-05: the domain head once');
    assert.equal(m.advisor.options.some((x) => x.band === 'strong'), false, 'WR-05: no strong band under no strong pick');
    assert.equal(PR.hasRawNumber(m.advisor), false);

    const n = nestMove(NM, ROOMS.chaotic.nm);
    assert.equal(n.advisor.state, 'no_strong_pick');
    assert.equal(n.advisor.domain.id, 'chaotic');

    const opts = RES.advisorOptsForRoom(ROOMS.chaotic.wf);
    assert.equal(opts.causeEffect, 'chaotic');
    const wf = RES.composeWorkflow([WF_FW], opts);
    assert.deepEqual(wf[0].ranked_commands, WF_CMDS, 'registry order stands');
    assert.equal(wf[0].command, WF_CMDS[0]);
    assert.equal(wf[0].command_basis, 'registry_order');
  });
});

check('X5 disorder: the order equals X2, and the note is present', () => {
  withEnv(ON, () => {
    const m = NM.composeNextMove(composeInput({ causeEffect: 'disorder' }));
    const x2 = NM.composeNextMove(composeInput());
    assert.equal(sansAdvisor(m), sansAdvisor(x2));
    assert.equal(m.advisor.domain.id, 'disorder');
    assert.equal(m.advisor.domain_note, CY.host_notes.disorder.text);
    assert.ok(m.advisor.summary.indexOf(PR.noteBody(CY.host_notes.disorder.text, 'disorder')) !== -1);

    const n = nestMove(NM, ROOMS.disorder.nm);
    const n2 = nestMove(NM0, ROOMS.disorder.nm);
    assert.equal(sansAdvisor(n), sansAdvisor(n2), 'nest order equals the 399 order');
    assert.equal(n.advisor.domain_note, CY.host_notes.disorder.text);

    const opts = RES.advisorOptsForRoom(ROOMS.disorder.wf);
    assert.equal(opts.causeEffect, 'disorder');
    const noDomain = Object.assign({}, opts);
    delete noDomain.causeEffect;
    for (const chain of CHAINS) assert.deepStrictEqual(RES.composeWorkflow(chain, opts), RES0.composeWorkflow(chain, noDomain));
  });
});

check('X5b an unknown or invalid domain value gives exactly the 399 output in both consumers', () => {
  withEnv(ON, () => {
    for (const bad of [undefined, null, '', 'Complex', 'wicked', 7]) {
      assert.equal(JSON.stringify(NM.composeNextMove(composeInput({ causeEffect: bad }))), JSON.stringify(NM0.composeNextMove(composeInput())), String(bad));
      for (const chain of CHAINS) {
        assert.deepStrictEqual(RES.composeWorkflow(chain, { jobId: WF_JOB, causeEffect: bad }), RES0.composeWorkflow(chain, { jobId: WF_JOB }), String(bad));
      }
    }
  });
});

// Review WR-04: equal calibrated values stay equal after the domain reorder, in both consumers. The fit part
// goes first; inside the fit part and inside the non-fit part, the other sort keys (next-move) or registry
// order (composeWorkflow) decide a tie, never the row position.
const TIE_TABLE = path.join(TMP, 'consumers-tie-table.json');
fs.writeFileSync(TIE_TABLE, JSON.stringify({
  schema: 'mos.decision-advisor-table/1',
  table_version: '400-consumers-tie-fixture',
  key_order: ['job', 'definition_level', 'cause_effect', 'last_command'],
  conditioned_rows: true,
  thresholds: { strong: 0.7, possible: 0.5 },
  shortlist_k: 4,
  rows: {
    // explore: two fit probes tie at 0.9, and the row lists explore-trends (not in the contract) first.
    'explore|*|*|*': [E('/mos:opportunities', 0.95), E('/mos:explore-trends', 0.9), E('/mos:beautiful-question', 0.9), E('/mos:bono', 0.8)],
    // compare-options: three non-fit or fit commands tie at 0.9; the row order differs from registry order.
    'compare-options|*|*|*': [E('/mos:bono', 0.95), E('/mos:persona', 0.9), E('/mos:think-hats', 0.9), E('/mos:hat-briefing', 0.9)],
  },
}));
check('X7 WR-04 a domain reorder keeps equal calibrated values equal in both consumers (no row-position preference)', () => {
  withEnv({ MINDRIAN_DECISION_ADVISOR: 'on', MINDRIAN_DECISION_ADVISOR_TABLE: TIE_TABLE }, () => {
    const sl = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'shortlist.cjs')).lookupShortlist({ jobId: NM_JOB, causeEffect: 'complex' });
    assert.equal(sl.domain.effect, 'reordered');
    assert.deepEqual(sl.domain.fits, ['/mos:explore-trends', '/mos:beautiful-question']);
    // The fit tie goes to the contract key (beautiful-question is in the contract), not to the row position.
    const m = NM.composeNextMove(composeInput({ causeEffect: 'complex' }));
    assert.deepEqual(order(m), ['beautiful-question', 'explore-trends', 'opportunities']);
    assert.equal(/\d\.\d/.test(JSON.stringify(m)), false, 'no raw number in the next-move result');
    // composeWorkflow: the fit command first, then value order, and the 0.9 tie keeps registry order
    // (hat-briefing before persona), not the row order (persona before hat-briefing).
    const wf = RES.composeWorkflow([WF_FW], { jobId: WF_JOB, causeEffect: 'complex' });
    assert.deepEqual(wf[0].ranked_commands, ['/mos:think-hats', '/mos:bono', '/mos:hat-briefing', '/mos:persona']);
  });
});

// Review WR-09: both consumers apply the domain over the same option set, the top k of the one lookup.
const K_TABLE = path.join(TMP, 'consumers-k-table.json');
fs.writeFileSync(K_TABLE, JSON.stringify({
  schema: 'mos.decision-advisor-table/1',
  table_version: '400-consumers-k-fixture',
  key_order: ['job', 'definition_level', 'cause_effect', 'last_command'],
  conditioned_rows: true,
  thresholds: { strong: 0.7, possible: 0.5 },
  shortlist_k: 2,
  rows: {
    // Systems Thinking: analyze-systems (fit, rank 2, inside k 2) and systems-thinking (fit, rank 3 = k + 1).
    'find-problem|*|*|*': [E('/mos:root-cause', 0.95), E('/mos:analyze-systems', 0.9), E('/mos:systems-thinking', 0.85)],
    // Only a fit at rank k + 1: the top k (root-cause, bono) has none.
    'explore|*|*|*': [E('/mos:root-cause', 0.95), E('/mos:bono', 0.93), E('/mos:systems-thinking', 0.9)],
  },
}));
check('X8 WR-09 a fit strong entry at rank k + 1 is promoted by neither consumer; a fit inside the top k is promoted by both', () => {
  withEnv({ MINDRIAN_DECISION_ADVISOR: 'on', MINDRIAN_DECISION_ADVISOR_TABLE: K_TABLE }, () => {
    const SL = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'shortlist.cjs'));
    const fw = 'Systems Thinking';
    assert.deepEqual(RES.commandsForFramework(fw), ['/mos:analyze-systems', '/mos:root-cause', '/mos:systems-thinking'], 'fixture: framework commands');
    const q = { jobId: 'find-problem', causeEffect: 'complex' };
    const sl = SL.lookupShortlist(q);
    assert.deepEqual(sl.options.map((x) => x.command), ['/mos:analyze-systems', '/mos:root-cause']);
    assert.deepEqual(sl.domain.fits, ['/mos:analyze-systems'], 'next-move sees only the fit inside k');
    const wf = RES.composeWorkflow([fw], q);
    assert.deepEqual(wf[0].ranked_commands, ['/mos:analyze-systems', '/mos:root-cause', '/mos:systems-thinking'], 'the rank k + 1 fit is not promoted');
    assert.deepEqual(SL.strongOrder(q), ['/mos:analyze-systems', '/mos:root-cause', '/mos:systems-thinking']);
    // The top k holds no fit: the effect is no_change, and composeWorkflow and strongOrder keep value order.
    const q2 = { jobId: 'explore', causeEffect: 'complex' };
    assert.equal(SL.lookupShortlist(q2).domain.effect, 'no_change');
    assert.deepEqual(RES.composeWorkflow([fw], q2)[0].ranked_commands, ['/mos:root-cause', '/mos:systems-thinking', '/mos:analyze-systems']);
    assert.deepEqual(SL.strongOrder(q2), ['/mos:root-cause', '/mos:bono', '/mos:systems-thinking']);
  });
});

check('X6 tests/test-399-one-selector-fence.cjs passes (no second selector)', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests', 'test-399-one-selector-fence.cjs')], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});

console.log('test-400-advisor-consumers: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
