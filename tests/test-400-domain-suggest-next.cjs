#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400 plan 08 Task 3 (CY-03): suggest_next carries the room's cause and effect domain state and
 * the fixed card steps, so the host model can show the card. Legs Q1 to Q5.
 *
 * Harness: tests/test-399-selector-advisor.cjs N10 (an isolated home, a born fixture room, a session
 * binding, the real sensors tools on a fake server). The isolated home is removed on exit by the helper.
 * Bare node script; exits non-zero on any failure. Hyphens only.
 *
 * Run: node tests/test-400-domain-suggest-next.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cynefin-domains.json'), 'utf8'));
const STAGE1 = DATA.card.stages[0];
const STAGE2 = DATA.card.stages[1];

let passed = 0;
let failed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    failed += 1;
    console.log('  FAIL - ' + label + '\n    ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join('\n    '));
  }
}

function makeServer() {
  const registered = [];
  return {
    registered,
    tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
    registerTool(name, _c, handler) { registered.push({ name, handler }); },
    server: { getClientCapabilities() { return {}; } },
  };
}

function assertCardSteps(howTo) {
  assert.ok(howTo.indexOf('gate_render with kind "cause_effect_domain"') !== -1, 'names gate_render kind cause_effect_domain');
  for (const o of STAGE1.options) {
    assert.ok(howTo.indexOf(JSON.stringify({ id: o.id, label: o.label })) !== -1, 'names stage-1 option ' + o.id);
  }
  for (const o of STAGE2.options) {
    assert.ok(howTo.indexOf(JSON.stringify({ id: o.id, label: o.label })) !== -1, 'names stage-2 option ' + o.id);
  }
  assert.ok(howTo.indexOf('cause_effect.follow_up with stage 2') !== -1, 'names the stage 2 follow_up path');
  assert.ok(howTo.indexOf('only when the gate_answer reply has cause_effect.written true') !== -1, 'written true is the only proof');
  assert.ok(howTo.indexOf('unknown_gate and no domain is stored') !== -1, 'unknown_gate stores nothing');
  assert.ok(/closes a dialog with no answer, nothing is stored/.test(howTo), 'a closed dialog stores nothing');
  assert.equal(new RegExp('[\\u2013\\u2014]').test(howTo), false);
}

// The child tests run with the environment this process started with (the base codes were measured that way).
const ORIGINAL_ENV = Object.assign({}, process.env);

async function main() {
  const H = require('./helpers/isolated-home-36925.cjs');
  const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));
  const iso = H.mkIsolatedHome('400ce');
  const born = H.birthFixtureRoom({ iso, slug: 'ce-sug', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed');
  const roomDir = fs.realpathSync(born.roomDir);
  delete process.env.CLAUDE_ACTIVE_ROOM;
  const SESSION = 'test-400-ce-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs')).writeSessionBinding(SESSION, { bound: ['ce-sug'], primary: 'ce-sug', sticky: false }, { home: iso.roomsHome });

  const server = makeServer();
  require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs')).register(server, { fallbackRoomDir: roomDir });
  const suggestNext = server.registered.find((r) => r.name === 'suggest_next').handler;
  const pull = async (sessionId) => JSON.parse((await suggestNext({}, { sessionId })).content[0].text);

  const notSet = await pull(SESSION);
  check('Q1 a bound room with no stored domain: cause_effect is not_set with null domain and verb order and the fixed sentences', () => {
    const c = notSet.cause_effect;
    assert.ok(c && typeof c === 'object', JSON.stringify(Object.keys(notSet)));
    assert.deepEqual(Object.keys(c), ['state', 'domain', 'verb_order', 'how_to']);
    assert.equal(c.state, 'not_set');
    assert.equal(c.domain, null);
    assert.equal(c.verb_order, null);
    assert.ok(c.how_to.startsWith('No cause and effect domain is set for this room, so the decision advisor does not use one. Never guess the domain from the room; only the person sets it. '));
    const keys = Object.keys(notSet);
    assert.equal(keys.indexOf('cause_effect'), keys.indexOf('goal_job') + 1, 'cause_effect follows goal_job');
  });

  // Store complex through the one writer, inside a transaction.
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const db = navigation.openRoomDbForCaller(roomDir);
  try {
    db.exec('BEGIN');
    const w = navigation.writeCauseEffect(db, { domain: 'complex', gateId: 'g-q2', decisionNodeId: 'decision:gate:g-q2' });
    db.exec('COMMIT');
    assert.equal(w.ok, true);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
  const set = await pull(SESSION);
  check('Q2 with complex stored: cause_effect is set, complex, probe sense respond, the fixed change sentence', () => {
    const c = set.cause_effect;
    assert.equal(c.state, 'set');
    assert.equal(c.domain, 'complex');
    assert.deepEqual(c.verb_order, ['probe', 'sense', 'respond']);
    assert.ok(c.how_to.startsWith('The person set the cause and effect domain of this room: complex. To change it, show the card again. '));
    assertCardSteps(c.how_to);
  });

  check('Q3 with no room the reply has no cause_effect key', () => {
    // The MCP read resolver always floors to a directory (the cwd), so "no room" reaches suggest_next as an
    // empty room dir. causeEffectFor returns undefined then, and the reply drops an undefined key, the
    // goal_job idiom.
    const S = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
    for (const none of [undefined, null, '', 3]) {
      assert.equal(S._internal.causeEffectFor(none), undefined);
    }
    const reply = JSON.parse(JSON.stringify({ ok: true, goal_job: undefined, cause_effect: S._internal.causeEffectFor(null) }));
    assert.equal(Object.prototype.hasOwnProperty.call(reply, 'cause_effect'), false);
    // A directory with no room.db is not_set and no file is created.
    const blank = H.mkIsolatedHome('400ce-blank').home;
    const c = S._internal.causeEffectFor(blank);
    assert.equal(c.state, 'not_set');
    assert.equal(fs.existsSync(path.join(blank, '.mindrian')), false);
  });

  check('Q4 how_to names the card, both stages, written true as the only proof, the no-store cases, never guess, and no raw number', () => {
    assertCardSteps(notSet.cause_effect.how_to);
    assert.ok(notSet.cause_effect.how_to.indexOf('Never guess the domain from the room') !== -1);
    assert.equal(PR.hasRawNumber(notSet.cause_effect.how_to), false);
    assert.equal(PR.hasRawNumber(set.cause_effect.how_to), false);
    assert.equal(PR.hasRawNumber(notSet.cause_effect), false);
    assert.equal(PR.hasRawNumber(set.cause_effect), false);
    const card = require(path.join(ROOT, 'lib', 'core', 'cause-effect-card.cjs'));
    assert.equal(notSet.cause_effect.how_to, card.howToSentences(null));
    assert.equal(set.cause_effect.how_to, card.howToSentences('complex'));
  });

  check('Q5 the existing suggest_next tests keep their base exit codes', () => {
    // Base exit codes recorded at base c1e496ae8 before the sensors.cjs edit (400-08 SUMMARY).
    const BASE_CODES = {
      'tests/test-c8j-suggest-next-offer.cjs': 0,
      'tests/test-399-selector-advisor.cjs': 0,
      'tests/test-sensors-part8-sweep.cjs': 0,
      'tests/test-sensors-routing-fence.cjs': 0,
    };
    for (const [t, code] of Object.entries(BASE_CODES)) {
      const r = spawnSync(process.execPath, [path.join(ROOT, t)], { cwd: ROOT, encoding: 'utf8', env: ORIGINAL_ENV, timeout: 180000 });
      assert.equal(r.status, code, t + ' exit ' + r.status + '\n' + String(r.stdout || '').slice(-600) + String(r.stderr || '').slice(-600));
    }
  });

  console.log('test-400-domain-suggest-next: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
