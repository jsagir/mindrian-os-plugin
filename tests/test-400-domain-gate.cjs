#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400 plan 08 Task 2 (CY-03, O-13): the two-stage cause and effect card and its gate wiring.
 * Legs G1 to G9.
 *
 * The card is a kind (cause_effect_domain) of the existing gate_render and gate_answer tools. The
 * server sets the question and the labels from data/cynefin-domains.json and refuses any other option
 * set. An approve writes the room's domain through the navigation chokepoint inside the gate_answer
 * transaction; reject, defer and the stage-1 "nobody" answer store nothing. Every other kind takes the
 * 399 path.
 *
 * Harness: the real gate tools registered on a fake server (tests/test-345-gate-ratify.cjs precedent),
 * bound to a scratch room through CLAUDE_ACTIVE_ROOM with no session id (tests/test-399-selection-log.cjs
 * precedent), so the gate cannot reach a real room of this process's session. Scratch rooms are removed
 * in finally. Bare node script; exits non-zero on any failure. Hyphens only.
 *
 * Run: node tests/test-400-domain-gate.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const BASE = 'c1e496ae8';

let roomDbMod;
let navigation;
let gateRender;
let gateModule;
try {
  roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
  gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
} catch (e) {
  console.log('SKIP: test-400-domain-gate: node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  process.exit(0);
}

const DATA = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'cynefin-domains.json'), 'utf8'));
const STAGE1 = DATA.card.stages[0];
const STAGE2 = DATA.card.stages[1];
const S1_IDS = STAGE1.options.map((o) => o.id);
const S2_IDS = STAGE2.options.map((o) => o.id);

let checks = 0;
let failed = 0;
async function leg(label, fn) {
  try {
    await fn();
    checks += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    failed += 1;
    console.log('  FAIL - ' + label + '\n    ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join('\n    '));
  }
}

function makeFakeServer() {
  const registered = [];
  return {
    registerTool(name, config, handler) {
      const cfg = config || {};
      registered.push({ name, description: cfg.description, handler });
    },
    _registered: registered,
    server: { getClientCapabilities() { return {}; } },
  };
}

function readKey(roomDir) {
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  try {
    const row = db.prepare("SELECT value FROM identity WHERE key = 'problem.cause_effect'").get();
    return row ? JSON.parse(row.value) : null;
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function clearKey(roomDir) {
  const db = navigation.openRoomDbForCaller(roomDir);
  try {
    db.prepare("DELETE FROM identity WHERE key = 'problem.cause_effect'").run();
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function opts(ids, data) {
  // Caller labels are deliberately wrong: the server replaces them.
  return ids.map((id) => ({ id: id, label: 'caller label ' + id, description: 'caller text' }));
}

async function main() {
  // G1 fails here until the card module exists (RED).
  const card = require(path.join(REPO, 'lib', 'core', 'cause-effect-card.cjs'));

  await leg('G1 normalizeOptions accepts exactly the stage-1 or the stage-2 id set in any order and replaces labels and header', async () => {
    assert.equal(card.CARD_KIND, 'cause_effect_domain');
    const r1 = card.normalizeOptions(opts(S1_IDS.slice().reverse()));
    assert.equal(r1.ok, true);
    assert.equal(r1.stage, 1);
    assert.equal(r1.header, STAGE1.header);
    assert.deepEqual(r1.options, STAGE1.options.map((o) => ({ id: o.id, label: o.label })));
    assert.deepEqual(r1.approving.slice().sort(), S1_IDS.slice().sort());
    const r2 = card.normalizeOptions(opts([S2_IDS[1], S2_IDS[0]]));
    assert.equal(r2.ok, true);
    assert.equal(r2.stage, 2);
    assert.equal(r2.header, STAGE2.header);
    assert.deepEqual(r2.options, STAGE2.options.map((o) => ({ id: o.id, label: o.label })));
    assert.deepEqual(r2.approving.slice().sort(), S2_IDS.slice().sort());
    const valid = { 1: S1_IDS, 2: S2_IDS };
    const bad = [
      opts(S1_IDS.slice(0, 3)),
      opts(S1_IDS.concat(['ce-extra'])),
      opts([S1_IDS[0], S1_IDS[1], S1_IDS[2], S2_IDS[0]]),
      opts([S2_IDS[0]]),
      opts(S1_IDS.concat([S1_IDS[0]])),
      [],
      null,
      undefined,
      'ce-anyone',
    ];
    for (const b of bad) {
      assert.deepEqual(card.normalizeOptions(b), { ok: false, reason: 'bad_cause_effect_options', valid: valid });
    }
    assert.equal(card.isCauseEffectCard({ kind: 'cause_effect_domain' }), true);
    assert.equal(card.isCauseEffectCard({ kind: 'general' }), false);
    assert.equal(card.isCauseEffectCard({ kind: 'strategy_goal' }), false);
    assert.equal(card.isCauseEffectCard(null), false);
  });

  await leg('G2 answerFor maps each option id to its domain or to stage 2; two ids or an unknown id give nothing', async () => {
    assert.deepEqual(card.answerFor(['ce-anyone']), { domain: 'clear', next_stage: null });
    assert.deepEqual(card.answerFor(['ce-trained']), { domain: 'complicated', next_stage: null });
    assert.deepEqual(card.answerFor(['ce-cannot-tell']), { domain: 'disorder', next_stage: null });
    assert.deepEqual(card.answerFor(['ce-probe']), { domain: 'complex', next_stage: null });
    assert.deepEqual(card.answerFor(['ce-act']), { domain: 'chaotic', next_stage: null });
    assert.deepEqual(card.answerFor(['ce-nobody']), { domain: null, next_stage: 2 });
    assert.deepEqual(card.answerFor(['ce-anyone', 'ce-trained']), { domain: null, next_stage: null });
    assert.deepEqual(card.answerFor(['ce-wicked']), { domain: null, next_stage: null });
    assert.deepEqual(card.answerFor([]), { domain: null, next_stage: null });
    assert.deepEqual(card.answerFor(null), { domain: null, next_stage: null });
  });

  await leg('G3 the three rungs render both stages with the fixed header and labels, at most 4 options, and the same normalized answer', async () => {
    const rungs = gateRender._internal;
    for (const stageIds of [S1_IDS, S2_IDS]) {
      const n = card.normalizeOptions(opts(stageIds));
      const c = gateRender.normalizeCard({ gate_id: 'g-ce-' + n.stage, header: n.header, kind: card.CARD_KIND, options: n.options, selectMode: 'single' });
      const pick = stageIds[stageIds.length - 1];
      const labels = n.options.map((o) => o.label);
      assert.ok(n.options.length <= 4);
      const el = await rungs.renderViaElicitation(c, {
        elicitInput: async () => ({ action: 'accept', content: { choice: pick } }),
      });
      assert.equal(el.rendered.message, n.header);
      assert.deepEqual(el.rendered.requestedSchema.properties.choice.oneOf, n.options.map((o) => ({ const: o.id, title: o.label })));
      const aq = await rungs.renderViaAskUserQuestion(c, {
        simulateAskUserQuestion: async () => ({ chosen: [pick] }),
      });
      assert.deepEqual(aq.rendered.contract.superset_options.map((o) => o.label), labels);
      assert.deepEqual(aq.rendered.contract.superset_options.map((o) => o.id), stageIds);
      assert.ok(aq.rendered.contract.superset_options.length <= 4);
      assert.ok(JSON.stringify(aq.rendered).indexOf(n.header) !== -1);
      const tx = await rungs.renderViaText(c, { simulateTextReply: async () => pick });
      assert.equal(tx.rendered.zones.header, n.header);
      for (const l of labels) assert.ok(tx.rendered.zones.body.indexOf(l) !== -1);
      assert.deepEqual(tx.rendered.contract.options, stageIds);
      assert.ok(tx.rendered.contract.options.length <= 4);
      const want = { gate_id: c.gate_id, chosen: [pick], verdict: 'approve' };
      assert.deepEqual(el.answer, want);
      assert.deepEqual(aq.answer, want);
      assert.deepEqual(tx.answer, want);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // G4 to G8: the MCP round trip.
  // ---------------------------------------------------------------------------------------------
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-ce-gate-'));
  const roomDir = path.join(home, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(roomDir));
  const prevRoom = process.env.CLAUDE_ACTIVE_ROOM;
  const prevSession = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CLAUDE_ACTIVE_ROOM = roomDir;
  delete process.env.CLAUDE_CODE_SESSION_ID;

  const fake = makeFakeServer();
  gateModule.register(fake, { fallbackRoomDir: roomDir, surface: 'cli' });
  const renderEntry = fake._registered.find((r) => r.name === 'gate_render');
  const answerEntry = fake._registered.find((r) => r.name === 'gate_answer');
  async function render(args) {
    const res = await renderEntry.handler(args, {});
    return { body: JSON.parse(res.content[0].text), isError: !!res.isError };
  }
  async function answer(gateId, chosen, verdict) {
    const res = await answerEntry.handler({ gate_id: gateId, chosen: chosen, verdict: verdict }, {});
    return { body: JSON.parse(res.content[0].text), isError: !!res.isError };
  }

  try {
    await leg('G4 card rung: gate_render kind cause_effect_domain with the 4 stage-1 ids, then approve ce-trained, writes complicated with the decision node id', async () => {
      clearKey(roomDir);
      const r = await render({ kind: 'cause_effect_domain', header: 'caller header', select_mode: 'multi', options: opts(S1_IDS) });
      assert.equal(r.body.ok, true, JSON.stringify(r.body));
      assert.notEqual(r.body.renderer, 'elicitation');
      assert.equal(r.body.card.header, STAGE1.header);
      assert.equal(r.body.card.kind, 'cause_effect_domain');
      assert.equal(r.body.card.selectMode, 'single');
      assert.deepEqual(r.body.card.options.map((o) => [o.id, o.label]), STAGE1.options.map((o) => [o.id, o.label]));
      const a = await answer(r.body.gate_id, ['ce-trained'], 'approve');
      assert.equal(a.body.ok, true, JSON.stringify(a.body));
      assert.deepEqual(a.body.cause_effect, { ok: true, written: true, domain: 'complicated' });
      const stored = readKey(roomDir);
      assert.equal(stored.domain, 'complicated');
      assert.equal(stored.source, 'navigator');
      assert.equal(stored.gate_id, r.body.gate_id);
      assert.equal(stored.decision_node_id, a.body.reasoning_node.node_id);
      assert.equal(stored.decision_node_id, 'decision:gate:' + r.body.gate_id);
    });

    await leg('G5 stage-1 ce-nobody writes nothing and names stage 2; a stage-2 card answered ce-act writes chaotic', async () => {
      clearKey(roomDir);
      const r = await render({ kind: 'cause_effect_domain', options: opts(S1_IDS) });
      assert.equal(r.body.ok, true, JSON.stringify(r.body));
      const a = await answer(r.body.gate_id, ['ce-nobody'], 'approve');
      assert.equal(a.body.ok, true, JSON.stringify(a.body));
      assert.deepEqual(a.body.cause_effect, { ok: true, written: false, follow_up: { stage: 2, option_ids: ['ce-probe', 'ce-act'] } });
      assert.equal(readKey(roomDir), null);
      const r2 = await render({ kind: 'cause_effect_domain', options: opts(S2_IDS) });
      assert.equal(r2.body.ok, true, JSON.stringify(r2.body));
      assert.equal(r2.body.card.header, STAGE2.header);
      const a2 = await answer(r2.body.gate_id, ['ce-act'], 'approve');
      assert.equal(a2.body.ok, true, JSON.stringify(a2.body));
      assert.deepEqual(a2.body.cause_effect, { ok: true, written: true, domain: 'chaotic' });
      assert.equal(readKey(roomDir).domain, 'chaotic');
    });

    await leg('G6 reject and defer on either stage write no identity key', async () => {
      clearKey(roomDir);
      for (const [ids, pick] of [[S1_IDS, 'ce-anyone'], [S2_IDS, 'ce-probe']]) {
        for (const verdict of ['reject', 'defer']) {
          const r = await render({ kind: 'cause_effect_domain', options: opts(ids) });
          assert.equal(r.body.ok, true, JSON.stringify(r.body));
          const a = await answer(r.body.gate_id, [pick], verdict);
          assert.equal(a.body.ok, true, JSON.stringify(a.body));
          assert.equal(a.body.ratified, false);
          assert.deepEqual(a.body.cause_effect, { ok: true, written: false });
          assert.equal(readKey(roomDir), null);
        }
      }
      // A direct ratify with reject or defer also writes nothing.
      const db = navigation.openRoomDbForCaller(roomDir);
      try {
        for (const verdict of ['reject', 'defer']) {
          assert.deepEqual(card.ratifyCauseEffect(db, { card: { kind: 'cause_effect_domain' }, chosen: ['ce-anyone'], verdict: verdict, gateId: 'g', decisionNodeId: 'n' }), { ok: true, written: false });
        }
        const refused = card.ratifyCauseEffect(db, { card: { kind: 'cause_effect_domain' }, chosen: ['ce-wicked'], verdict: 'approve', gateId: 'g', decisionNodeId: 'n' });
        assert.equal(refused.ok, false);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
      assert.equal(readKey(roomDir), null);
    });

    await leg('G7 caller options outside the two id sets are refused bad_cause_effect_options and no gate is minted', async () => {
      for (const bad of [opts(S1_IDS.slice(0, 3)), opts([S1_IDS[0], S2_IDS[0]]), [{ id: 'approve', label: 'Approve' }]]) {
        const r = await render({ kind: 'cause_effect_domain', options: bad });
        assert.equal(r.body.ok, false);
        assert.equal(r.isError, true);
        assert.equal(r.body.reason, 'bad_cause_effect_options');
        assert.deepEqual(r.body.valid, { 1: S1_IDS, 2: S2_IDS });
        assert.equal(r.body.gate_id, undefined);
      }
      const r = await render({ kind: 'cause_effect_domain', gate_id: 'g-400-08-refused', options: opts(S1_IDS.slice(0, 2)) });
      assert.equal(r.body.reason, 'bad_cause_effect_options');
      const a = await answer('g-400-08-refused', ['ce-anyone'], 'approve');
      assert.equal(a.body.ok, false);
      assert.equal(a.body.cause_effect, undefined);
    });

    await leg('G8 a general card and a strategy_goal card carry no cause_effect key; the gate.cjs change deletes no line', async () => {
      const g = await render({ kind: 'general', options: [{ id: 'opt-a', label: 'Option A' }] });
      assert.equal(g.body.ok, true);
      assert.equal('cause_effect' in g.body, false);
      const ga = await answer(g.body.gate_id, ['opt-a'], 'approve');
      assert.equal(ga.body.ok, true, JSON.stringify(ga.body));
      assert.equal('cause_effect' in ga.body, false);
      const plain = await render({ options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }] });
      const pa = await answer(plain.body.gate_id, ['reject'], 'reject');
      assert.equal(pa.body.ok, true);
      assert.equal('cause_effect' in pa.body, false);
      const s = await render({ kind: 'strategy_goal', options: [{ id: 'keep', label: 'Keep' }, { id: 'defer', label: 'Not now' }] });
      assert.equal(s.body.ok, true);
      assert.equal('cause_effect' in s.body, false);
      const sa = await answer(s.body.gate_id, ['defer'], 'defer');
      assert.equal(sa.body.ok, true, JSON.stringify(sa.body));
      assert.equal('cause_effect' in sa.body, false);
      assert.equal(readKey(roomDir), null);
      const diff = spawnSync('git', ['diff', '--numstat', BASE, '--', 'lib/mcp/tools/gate.cjs'], { cwd: REPO, encoding: 'utf8' });
      assert.equal(diff.status, 0, diff.stderr);
      const line = diff.stdout.trim();
      assert.ok(line.length > 0, 'gate.cjs must differ from the base');
      assert.equal(line.split(/\s+/)[1], '0', 'deleted lines in gate.cjs: ' + line);
    });
  } finally {
    if (prevRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = prevRoom;
    if (prevSession !== undefined) process.env.CLAUDE_CODE_SESSION_ID = prevSession;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
  }

  await leg('G9 the card is a kind of the existing tools: the same tool names register, and the shape check names no new surface', async () => {
    const names = fake._registered.map((r) => r.name).sort();
    assert.deepEqual(names, ['gate_answer', 'gate_list', 'gate_render']);
    const res = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'check-shape-declaration.cjs'), '--check'], { cwd: REPO, encoding: 'utf8' });
    assert.equal(res.status, 0, (res.stdout || '') + (res.stderr || ''));
    const out = (res.stdout || '') + (res.stderr || '');
    assert.equal(/cause[-_]effect/.test(out), false, 'the shape check names the new card');
  });

  console.log('test-400-domain-gate: ' + checks + ' legs passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
